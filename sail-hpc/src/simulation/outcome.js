import { JOB_STATES } from "./state-machine.js";

export function resolveTerminalOutcome(spec, workload) {
  const walltimeSeconds = positiveNumber(spec?.walltimeSeconds, "walltimeSeconds");
  const requestedMemoryMB = positiveNumber(spec?.memoryMB, "memoryMB");
  const modeledRuntimeSeconds = positiveNumber(workload?.modeledRuntimeSeconds, "modeledRuntimeSeconds");

  const events = [
    { state: JOB_STATES.COMPLETED, atSeconds: modeledRuntimeSeconds, reason: "Modeled workload completed" },
  ];

  if (modeledRuntimeSeconds > walltimeSeconds) {
    events.push({
      state: JOB_STATES.TIMEOUT,
      atSeconds: walltimeSeconds,
      reason: "Modeled runtime exceeded requested walltime",
    });
  }

  if (workload?.memoryFailure) {
    const requiredMemoryMB = positiveNumber(workload.memoryFailure.requiredMemoryMB, "requiredMemoryMB");
    const atSeconds = nonNegativeNumber(workload.memoryFailure.atSeconds, "memoryFailure.atSeconds");
    if (requiredMemoryMB > requestedMemoryMB && atSeconds <= modeledRuntimeSeconds) {
      events.push({
        state: JOB_STATES.OUT_OF_MEMORY,
        atSeconds,
        reason: `Modeled memory demand ${requiredMemoryMB} MB exceeded requested ${requestedMemoryMB} MB`,
      });
    }
  }

  events.sort((a, b) => {
    if (a.atSeconds !== b.atSeconds) return a.atSeconds - b.atSeconds;
    return priority(a.state) - priority(b.state);
  });

  return Object.freeze(events[0]);
}

function priority(state) {
  if (state === JOB_STATES.OUT_OF_MEMORY) return 0;
  if (state === JOB_STATES.TIMEOUT) return 1;
  return 2;
}

function positiveNumber(value, label) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) throw new Error(`${label} must be a positive finite number`);
  return parsed;
}

function nonNegativeNumber(value, label) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) throw new Error(`${label} must be a finite non-negative number`);
  return parsed;
}
