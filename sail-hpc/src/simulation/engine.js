import { normalizeJobSpec } from "../core/job-spec.js";
import { DeterministicClock } from "./clock.js";
import { ResourceLedger } from "./resource-ledger.js";
import {
  hasPolicyErrors,
  normalizeClusterPolicy,
  validateJobAgainstClusterPolicy,
} from "./cluster-policy.js";
import {
  JOB_STATES,
  createPendingJob,
  isTerminalState,
  transitionJob,
} from "./state-machine.js";
import { resolveTerminalOutcome } from "./outcome.js";
import { arrayTaskJobId, parseArraySpecification } from "./arrays.js";
import { evaluateDependency, parseDependency } from "./dependencies.js";
import { createSyntheticAccounting } from "./accounting.js";

export const SIMULATION_RECORD_VERSION = "1";

export class SimulationEngine {
  constructor({
    nodes,
    clock = new DeterministicClock(0),
    firstJobId = 73001,
    clusterPolicy = null,
    recordActions = true,
  } = {}) {
    if (!(clock instanceof DeterministicClock)) {
      throw new Error("clock must be a DeterministicClock");
    }
    const parsedFirstJobId = Number(firstJobId);
    if (!Number.isInteger(parsedFirstJobId) || parsedFirstJobId < 1) {
      throw new Error("firstJobId must be a positive integer");
    }
    if (!Array.isArray(nodes) || nodes.length === 0) {
      throw new Error("nodes must contain at least one node");
    }

    this.clock = clock;
    this.clusterPolicy = clusterPolicy ? normalizeClusterPolicy(clusterPolicy) : null;
    this.initialNodes = deepClone(nodes);
    this.initialFirstJobId = parsedFirstJobId;
    this.ledger = new ResourceLedger(nodes);
    this.nextJobId = parsedFirstJobId;
    this.jobs = new Map();
    this.arrays = new Map();
    this.workloads = new Map();
    this.runningEvents = new Map();
    this.submissionSequence = 0;
    this.actionLog = [];
    this.recordActions = Boolean(recordActions);
  }

  submit(spec, workload) {
    let normalizedSpec = normalizeJobSpec(spec);
    validateRunnableSpec(normalizedSpec);
    validateWorkload(workload);
    parseDependency(normalizedSpec.dependency);

    normalizedSpec = this.#applyClusterPolicy(normalizedSpec);
    this.#record({ type: "submit", spec: deepClone(normalizedSpec), workload: deepClone(workload) });

    if (normalizedSpec.array) {
      return this.#submitArray(normalizedSpec, workload);
    }
    return this.#submitSingle(normalizedSpec, workload);
  }

  schedule() {
    const pendingJobs = [...this.jobs.values()]
      .filter((job) => job.state === JOB_STATES.PENDING)
      .sort(compareSubmissionOrder);

    for (const current of pendingJobs) {
      if (current.held) {
        this.#setPendingReason(current, "JobHeldUser");
        continue;
      }

      const dependency = evaluateDependency(
        current.spec.dependency,
        (jobId) => this.#resolveDependencyTarget(jobId),
      );
      if (dependency.status !== "ready") {
        this.#setPendingReason(current, dependency.reason);
        continue;
      }

      if (!this.#arrayConcurrencyAllows(current)) {
        this.#setPendingReason(current, "ArrayTaskLimit");
        continue;
      }

      const allocation = this.ledger.allocate(current.id, current.spec);
      if (!allocation) {
        this.#setPendingReason(current, "Resources");
        continue;
      }

      const running = transitionJob(
        current,
        JOB_STATES.RUNNING,
        this.clock.now(),
        `Allocated on ${allocation.nodeId}`,
      );
      this.jobs.set(current.id, { ...running, allocation: { ...allocation } });

      const outcome = resolveTerminalOutcome(current.spec, this.workloads.get(current.id));
      this.runningEvents.set(current.id, Object.freeze({
        state: outcome.state,
        reason: outcome.reason,
        terminalAtSeconds: this.clock.now() + outcome.atSeconds,
      }));
    }

    return this.snapshot();
  }

  advance(seconds) {
    const delta = Number(seconds);
    if (!Number.isFinite(delta) || delta < 0) {
      throw new Error("advance seconds must be a finite non-negative number");
    }
    this.#record({ type: "advance", seconds: delta });

    const targetSeconds = this.clock.now() + delta;

    while (true) {
      const nextEventTime = this.#nextTerminalTimeAtOrBefore(targetSeconds);
      if (nextEventTime === null) break;

      this.clock.set(nextEventTime);
      this.#finishEventsAt(nextEventTime);
      this.schedule();
    }

    this.clock.set(targetSeconds);
    return this.snapshot();
  }

  cancel(jobId, reason = "Cancelled by user") {
    const id = String(jobId);
    this.#record({ type: "cancel", jobId: id, reason });

    if (this.arrays.has(id)) {
      for (const taskId of this.arrays.get(id).taskIds) {
        const task = this.jobs.get(taskId);
        if (task && !isTerminalState(task.state)) this.#cancelOne(taskId, reason);
      }
      this.schedule();
      return this.getJob(id);
    }

    const result = this.#cancelOne(id, reason);
    this.schedule();
    return result;
  }

  hold(jobId) {
    const id = String(jobId);
    this.#record({ type: "hold", jobId: id });

    if (this.arrays.has(id)) {
      let changed = 0;
      for (const taskId of this.arrays.get(id).taskIds) {
        const current = this.jobs.get(taskId);
        if (current?.state === JOB_STATES.PENDING && !current.held) {
          this.jobs.set(taskId, {
            ...current,
            held: true,
            stateReason: "JobHeldUser",
            updatedAtSeconds: this.clock.now(),
          });
          changed += 1;
        }
      }
      if (!changed) throw new Error(`Array ${id} has no pending tasks that can be held`);
      return this.getJob(id);
    }

    const current = this.jobs.get(id);
    if (!current) throw new Error(`Unknown job ${id}`);
    if (current.state !== JOB_STATES.PENDING) throw new Error(`Only pending jobs can be held; ${id} is ${current.state}`);
    if (current.held) throw new Error(`Job ${id} is already held`);
    this.jobs.set(id, {
      ...current,
      held: true,
      stateReason: "JobHeldUser",
      updatedAtSeconds: this.clock.now(),
    });
    return this.getJob(id);
  }

  release(jobId) {
    const id = String(jobId);
    this.#record({ type: "release", jobId: id });

    if (this.arrays.has(id)) {
      let changed = 0;
      for (const taskId of this.arrays.get(id).taskIds) {
        const current = this.jobs.get(taskId);
        if (current?.state === JOB_STATES.PENDING && current.held) {
          this.jobs.set(taskId, {
            ...current,
            held: false,
            stateReason: null,
            updatedAtSeconds: this.clock.now(),
          });
          changed += 1;
        }
      }
      if (!changed) throw new Error(`Array ${id} has no held pending tasks to release`);
      this.schedule();
      return this.getJob(id);
    }

    const current = this.jobs.get(id);
    if (!current) throw new Error(`Unknown job ${id}`);
    if (current.state !== JOB_STATES.PENDING || !current.held) {
      throw new Error(`Job ${id} is not a held pending job`);
    }
    this.jobs.set(id, {
      ...current,
      held: false,
      stateReason: null,
      updatedAtSeconds: this.clock.now(),
    });
    this.schedule();
    return this.getJob(id);
  }

  getJob(jobId) {
    const id = String(jobId);
    if (this.arrays.has(id)) return this.#arraySummary(id);
    const job = this.jobs.get(id);
    if (!job) return null;
    return cloneJob(job);
  }

  getAccounting(jobId) {
    const id = String(jobId);
    if (this.arrays.has(id)) {
      return this.arrays.get(id).taskIds.map((taskId) => ({
        jobId: taskId,
        accounting: deepClone(this.jobs.get(taskId)?.accounting ?? null),
      }));
    }
    return deepClone(this.jobs.get(id)?.accounting ?? null);
  }

  listJobs({ includeArrayTasks = true } = {}) {
    const jobs = [...this.jobs.values()]
      .sort(compareSubmissionOrder)
      .filter((job) => includeArrayTasks || !job.arrayParentId)
      .map(cloneJob);
    return jobs;
  }

  listArrays() {
    return [...this.arrays.keys()].map((id) => this.#arraySummary(id));
  }

  snapshot() {
    return {
      clock: this.clock.snapshot(),
      jobs: this.listJobs(),
      arrays: this.listArrays(),
      resources: this.ledger.snapshot(),
      clusterPolicy: deepClone(this.clusterPolicy),
    };
  }

  exportRecord(metadata = {}) {
    return {
      recordVersion: SIMULATION_RECORD_VERSION,
      metadata: deepClone(metadata),
      initial: {
        nodes: deepClone(this.initialNodes),
        firstJobId: this.initialFirstJobId,
        clusterPolicy: deepClone(this.clusterPolicy),
      },
      actions: deepClone(this.actionLog),
      finalSnapshot: this.snapshot(),
    };
  }

  static replay(record) {
    if (!record || String(record.recordVersion) !== SIMULATION_RECORD_VERSION) {
      throw new Error(`Unsupported simulation record version '${record?.recordVersion}'`);
    }
    const engine = new SimulationEngine({
      nodes: record.initial?.nodes,
      firstJobId: record.initial?.firstJobId,
      clusterPolicy: record.initial?.clusterPolicy,
      recordActions: false,
    });

    for (const action of record.actions || []) {
      switch (action.type) {
        case "submit":
          engine.submit(action.spec, action.workload);
          break;
        case "advance":
          engine.advance(action.seconds);
          break;
        case "cancel":
          engine.cancel(action.jobId, action.reason);
          break;
        case "hold":
          engine.hold(action.jobId);
          break;
        case "release":
          engine.release(action.jobId);
          break;
        default:
          throw new Error(`Unsupported replay action '${action.type}'`);
      }
    }
    return engine;
  }

  static verifyRecord(record) {
    const replayed = SimulationEngine.replay(record).snapshot();
    return stableStringify(replayed) === stableStringify(record.finalSnapshot);
  }

  #submitSingle(normalizedSpec, workload) {
    const id = String(this.nextJobId++);
    const pending = this.#newPendingJob(id, normalizedSpec, workload, {});
    this.jobs.set(id, pending);
    this.schedule();
    return this.getJob(id);
  }

  #submitArray(normalizedSpec, workload) {
    const parsed = parseArraySpecification(normalizedSpec.array);
    const parentId = String(this.nextJobId++);
    const taskIds = [];

    for (const taskId of parsed.taskIds) {
      const id = arrayTaskJobId(parentId, taskId);
      const pending = this.#newPendingJob(id, normalizedSpec, workload, {
        arrayParentId: parentId,
        arrayTaskId: taskId,
        arrayConcurrencyLimit: parsed.concurrencyLimit,
      });
      this.jobs.set(id, pending);
      taskIds.push(id);
    }

    this.arrays.set(parentId, Object.freeze({
      parentId,
      specification: parsed.specification,
      concurrencyLimit: parsed.concurrencyLimit,
      taskIds: Object.freeze(taskIds),
      submittedAtSeconds: this.clock.now(),
    }));
    this.schedule();
    return this.getJob(parentId);
  }

  #newPendingJob(id, spec, workload, extra) {
    const pending = createPendingJob({
      id,
      submittedAtSeconds: this.clock.now(),
      spec: deepFreeze(deepClone(spec)),
    });
    const job = {
      ...pending,
      ...extra,
      held: false,
      submissionSequence: this.submissionSequence++,
      allocation: null,
      accounting: null,
    };
    this.workloads.set(id, freezeWorkload(workload));
    return job;
  }

  #applyClusterPolicy(normalizedSpec) {
    if (!this.clusterPolicy) return normalizedSpec;
    let spec = normalizedSpec;
    if (!spec.partition && this.clusterPolicy.defaultPartition) {
      spec = { ...spec, partition: this.clusterPolicy.defaultPartition };
    }
    const diagnostics = validateJobAgainstClusterPolicy(spec, this.clusterPolicy);
    if (hasPolicyErrors(diagnostics)) {
      throw new Error(`Cluster policy rejected job: ${diagnostics.map((d) => d.message).join("; ")}`);
    }
    return spec;
  }

  #setPendingReason(current, reason) {
    if (current.stateReason === reason) return;
    this.jobs.set(current.id, {
      ...current,
      stateReason: reason,
      updatedAtSeconds: this.clock.now(),
    });
  }

  #arrayConcurrencyAllows(job) {
    if (!job.arrayParentId || job.arrayConcurrencyLimit == null) return true;
    const array = this.arrays.get(job.arrayParentId);
    if (!array) throw new Error(`Array metadata missing for ${job.arrayParentId}`);
    const runningCount = array.taskIds
      .map((id) => this.jobs.get(id))
      .filter((task) => task?.state === JOB_STATES.RUNNING)
      .length;
    return runningCount < job.arrayConcurrencyLimit;
  }

  #resolveDependencyTarget(jobId) {
    const id = String(jobId);
    if (this.arrays.has(id)) return this.#arraySummary(id);
    const job = this.jobs.get(id);
    if (!job) return null;
    return {
      id,
      state: job.state,
      terminal: isTerminalState(job.state),
    };
  }

  #arraySummary(parentId) {
    const meta = this.arrays.get(String(parentId));
    if (!meta) return null;
    const tasks = meta.taskIds.map((id) => this.jobs.get(id)).filter(Boolean);
    const terminal = tasks.length > 0 && tasks.every((task) => isTerminalState(task.state));
    const allCompleted = terminal && tasks.every((task) => task.state === JOB_STATES.COMPLETED);
    const anyRunning = tasks.some((task) => task.state === JOB_STATES.RUNNING);
    const anyPending = tasks.some((task) => task.state === JOB_STATES.PENDING);
    const state = allCompleted
      ? JOB_STATES.COMPLETED
      : terminal
        ? JOB_STATES.FAILED
        : anyRunning
          ? JOB_STATES.RUNNING
          : JOB_STATES.PENDING;

    const counts = {};
    for (const task of tasks) counts[task.state] = (counts[task.state] || 0) + 1;

    return {
      id: meta.parentId,
      isArray: true,
      specification: meta.specification,
      concurrencyLimit: meta.concurrencyLimit,
      taskIds: [...meta.taskIds],
      state,
      terminal,
      stateReason: anyPending && !anyRunning ? "Pending array tasks" : null,
      submittedAtSeconds: meta.submittedAtSeconds,
      counts,
      tasks: tasks.map(cloneJob),
    };
  }

  #cancelOne(id, reason) {
    const current = this.jobs.get(id);
    if (!current) throw new Error(`Unknown job ${id}`);
    if (isTerminalState(current.state)) {
      throw new Error(`Job ${id} is already terminal (${current.state})`);
    }

    if (current.state === JOB_STATES.RUNNING) {
      this.ledger.release(id);
      this.runningEvents.delete(id);
    }

    const cancelled = transitionJob(
      current,
      JOB_STATES.CANCELLED,
      this.clock.now(),
      reason,
    );
    const finalized = this.#attachAccounting(cancelled);
    this.jobs.set(id, finalized);
    return cloneJob(finalized);
  }

  #attachAccounting(job) {
    if (!isTerminalState(job.state)) return job;
    const accounting = createSyntheticAccounting(job, this.workloads.get(job.id));
    return { ...job, allocation: null, accounting };
  }

  #nextTerminalTimeAtOrBefore(targetSeconds) {
    let next = null;
    for (const event of this.runningEvents.values()) {
      if (event.terminalAtSeconds > targetSeconds) continue;
      if (next === null || event.terminalAtSeconds < next) next = event.terminalAtSeconds;
    }
    return next;
  }

  #finishEventsAt(atSeconds) {
    const due = [...this.runningEvents.entries()]
      .filter(([, event]) => event.terminalAtSeconds === atSeconds)
      .sort(([a], [b]) => compareJobIds(a, b));

    for (const [id, event] of due) {
      const current = this.jobs.get(id);
      if (!current || current.state !== JOB_STATES.RUNNING) {
        throw new Error(`Terminal event for non-running job ${id}`);
      }

      this.ledger.release(id);
      this.runningEvents.delete(id);
      const terminal = transitionJob(current, event.state, atSeconds, event.reason);
      this.jobs.set(id, this.#attachAccounting(terminal));
    }
  }

  #record(action) {
    if (this.recordActions) this.actionLog.push(deepClone(action));
  }
}

function validateRunnableSpec(spec) {
  if (!Number.isInteger(spec.memoryMB) || spec.memoryMB < 1) {
    throw new Error("Runnable jobs require memoryMB >= 1");
  }
  if (!Number.isInteger(spec.walltimeSeconds) || spec.walltimeSeconds < 1) {
    throw new Error("Runnable jobs require walltimeSeconds >= 1");
  }
  if (spec.nodes !== 1) {
    throw new Error("SAIL-HPC v1.0 publication model supports one-node jobs only; refusing to approximate multi-node topology");
  }
  if (spec.array) parseArraySpecification(spec.array);
}

function validateWorkload(workload) {
  if (!workload || typeof workload !== "object") {
    throw new Error("workload is required");
  }
  const runtime = Number(workload.modeledRuntimeSeconds);
  if (!Number.isFinite(runtime) || runtime <= 0) {
    throw new Error("workload.modeledRuntimeSeconds must be a positive finite number");
  }
  if (workload.memoryFailure) {
    const atSeconds = Number(workload.memoryFailure.atSeconds);
    const requiredMemoryMB = Number(workload.memoryFailure.requiredMemoryMB);
    if (!Number.isFinite(atSeconds) || atSeconds <= 0) throw new Error("memoryFailure.atSeconds must be positive");
    if (!Number.isFinite(requiredMemoryMB) || requiredMemoryMB <= 0) throw new Error("memoryFailure.requiredMemoryMB must be positive");
  }
}

function freezeWorkload(workload) {
  return deepFreeze(deepClone(workload));
}

function compareSubmissionOrder(a, b) {
  return Number(a.submissionSequence ?? 0) - Number(b.submissionSequence ?? 0);
}

function compareJobIds(a, b) {
  const [aParent, aTask = "-1"] = String(a).split("_");
  const [bParent, bTask = "-1"] = String(b).split("_");
  return Number(aParent) - Number(bParent) || Number(aTask) - Number(bTask);
}

function cloneJob(job) {
  return deepClone(job);
}

function deepClone(value) {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value));
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}

function stableStringify(value) {
  return JSON.stringify(sortObject(value));
}

function sortObject(value) {
  if (Array.isArray(value)) return value.map(sortObject);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.keys(value).sort().map((key) => [key, sortObject(value[key])]),
  );
}
