import { JOB_STATES } from "./state-machine.js";

export function createSyntheticAccounting(job, workload = {}) {
  if (!job || typeof job !== "object") throw new Error("job is required");
  if (!job.spec) throw new Error("job.spec is required");

  const startedAt = Number(job.startedAtSeconds ?? job.submittedAtSeconds ?? 0);
  const endedAt = Number(job.endedAtSeconds ?? job.updatedAtSeconds ?? startedAt);
  const elapsedSeconds = Math.max(0, endedAt - startedAt);
  const allocatedCpus = Number(job.spec.ntasks ?? 1) * Number(job.spec.cpusPerTask ?? 1);
  const requestedMemoryMB = Number(job.spec.memoryMB ?? 0);
  const requestedGpus = Number(job.spec.gpus ?? 0);

  const utilization = clamp(Number(workload.cpuUtilizationFraction ?? 0.72), 0, 1);
  const modeledCpuUsedSeconds = round3(elapsedSeconds * allocatedCpus * utilization);
  const allocatedCpuSeconds = elapsedSeconds * allocatedCpus;
  const cpuEfficiencyPct = allocatedCpuSeconds > 0
    ? round1((modeledCpuUsedSeconds / allocatedCpuSeconds) * 100)
    : 0;

  const modeledPeakMemoryMB = determinePeakMemory(job, workload, requestedMemoryMB);
  const memoryEfficiencyPct = requestedMemoryMB > 0
    ? round1((Math.min(modeledPeakMemoryMB, requestedMemoryMB) / requestedMemoryMB) * 100)
    : 0;

  return Object.freeze({
    synthetic: true,
    label: "Synthetic pedagogical accounting",
    state: job.state,
    elapsedSeconds,
    allocatedCpus,
    allocatedCpuSeconds,
    modeledCpuUsedSeconds,
    cpuEfficiencyPct,
    requestedMemoryMB,
    modeledMaxRSSMB: modeledPeakMemoryMB,
    memoryEfficiencyPct,
    requestedGpus,
    exitCode: exitCodeForState(job.state),
  });
}

function determinePeakMemory(job, workload, requestedMemoryMB) {
  if (job.state === JOB_STATES.OUT_OF_MEMORY) return requestedMemoryMB;

  const explicit = Number(
    workload.peakMemoryMB
    ?? workload.memoryFailure?.requiredMemoryMB
    ?? NaN,
  );
  if (Number.isFinite(explicit) && explicit >= 0) {
    return round1(Math.min(explicit, requestedMemoryMB || explicit));
  }

  const fraction = clamp(Number(workload.memoryUtilizationFraction ?? 0.62), 0, 1);
  return round1(requestedMemoryMB * fraction);
}

function exitCodeForState(state) {
  if (state === JOB_STATES.COMPLETED) return "0:0";
  if (state === JOB_STATES.CANCELLED) return "0:15";
  if (state === JOB_STATES.OUT_OF_MEMORY) return "0:125";
  if (state === JOB_STATES.TIMEOUT) return "0:124";
  return "1:0";
}

function clamp(value, min, max) {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}

function round1(value) {
  return Math.round(value * 10) / 10;
}

function round3(value) {
  return Math.round(value * 1000) / 1000;
}
