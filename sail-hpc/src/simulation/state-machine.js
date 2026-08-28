export const JOB_STATES = Object.freeze({
  PENDING: "PENDING",
  RUNNING: "RUNNING",
  COMPLETED: "COMPLETED",
  FAILED: "FAILED",
  OUT_OF_MEMORY: "OUT_OF_MEMORY",
  TIMEOUT: "TIMEOUT",
  CANCELLED: "CANCELLED",
});

const TERMINAL = new Set([
  JOB_STATES.COMPLETED,
  JOB_STATES.FAILED,
  JOB_STATES.OUT_OF_MEMORY,
  JOB_STATES.TIMEOUT,
  JOB_STATES.CANCELLED,
]);

const ALLOWED = new Map([
  [JOB_STATES.PENDING, new Set([JOB_STATES.RUNNING, JOB_STATES.CANCELLED, JOB_STATES.FAILED])],
  [JOB_STATES.RUNNING, new Set([
    JOB_STATES.COMPLETED,
    JOB_STATES.FAILED,
    JOB_STATES.OUT_OF_MEMORY,
    JOB_STATES.TIMEOUT,
    JOB_STATES.CANCELLED,
  ])],
]);

export function isTerminalState(state) {
  return TERMINAL.has(state);
}

export function canTransition(fromState, toState) {
  if (fromState === toState) return false;
  return ALLOWED.get(fromState)?.has(toState) ?? false;
}

export function transitionJob(job, toState, atSeconds, reason = null) {
  if (!job || typeof job !== "object") throw new Error("job is required");
  if (!Object.values(JOB_STATES).includes(job.state)) throw new Error(`Unknown current state: ${job.state}`);
  if (!Object.values(JOB_STATES).includes(toState)) throw new Error(`Unknown target state: ${toState}`);
  if (!Number.isFinite(Number(atSeconds)) || Number(atSeconds) < 0) throw new Error("atSeconds must be non-negative");
  if (isTerminalState(job.state)) throw new Error(`Terminal job cannot transition from ${job.state}`);
  if (!canTransition(job.state, toState)) throw new Error(`Invalid transition ${job.state} -> ${toState}`);

  const next = {
    ...job,
    state: toState,
    stateReason: reason,
    updatedAtSeconds: Number(atSeconds),
    history: [
      ...(Array.isArray(job.history) ? job.history : []),
      Object.freeze({ from: job.state, to: toState, atSeconds: Number(atSeconds), reason }),
    ],
  };

  if (toState === JOB_STATES.RUNNING && next.startedAtSeconds == null) next.startedAtSeconds = Number(atSeconds);
  if (isTerminalState(toState)) next.endedAtSeconds = Number(atSeconds);
  return next;
}

export function createPendingJob({ id, submittedAtSeconds = 0, spec = null }) {
  if (!id) throw new Error("job id is required");
  if (!Number.isFinite(Number(submittedAtSeconds)) || Number(submittedAtSeconds) < 0) {
    throw new Error("submittedAtSeconds must be non-negative");
  }
  return {
    id: String(id),
    spec,
    state: JOB_STATES.PENDING,
    stateReason: null,
    submittedAtSeconds: Number(submittedAtSeconds),
    updatedAtSeconds: Number(submittedAtSeconds),
    startedAtSeconds: null,
    endedAtSeconds: null,
    history: [],
  };
}
