import { JOB_STATES, isTerminalState } from "./state-machine.js";

const SUPPORTED_TYPES = new Set(["afterok", "afterany", "afternotok"]);

export function parseDependency(value) {
  if (!value) return null;
  const raw = typeof value === "object" && value !== null ? value.raw : value;
  const text = String(raw ?? "").trim();
  if (!text) return null;

  if (text.includes(",")) {
    throw new Error("Multiple dependency expressions are not supported in SAIL-HPC v1.0");
  }

  const parts = text.split(":");
  if (parts.length !== 2) {
    throw new Error(`Unsupported dependency syntax '${text}'; expected type:jobid`);
  }

  const type = parts[0].trim().toLowerCase();
  const jobId = parts[1].trim();
  if (!SUPPORTED_TYPES.has(type)) throw new Error(`Unsupported dependency type '${type}'`);
  if (!/^\d+(?:_\d+)?$/.test(jobId)) throw new Error(`Unsupported dependency job id '${jobId}'`);

  return Object.freeze({ raw: text, type, jobId });
}

export function evaluateDependency(value, resolveTarget) {
  const dependency = parseDependency(value);
  if (!dependency) return Object.freeze({ status: "ready", reason: null, dependency: null });
  if (typeof resolveTarget !== "function") throw new Error("resolveTarget must be a function");

  const target = resolveTarget(dependency.jobId);
  if (!target) {
    return Object.freeze({
      status: "never",
      reason: `DependencyNeverSatisfied: unknown job ${dependency.jobId}`,
      dependency,
    });
  }

  const terminal = target.terminal === true || isTerminalState(target.state);
  const succeeded = target.state === JOB_STATES.COMPLETED;

  if (!terminal) {
    return Object.freeze({
      status: "waiting",
      reason: `Dependency: waiting for ${dependency.raw}`,
      dependency,
    });
  }

  if (dependency.type === "afterany") {
    return Object.freeze({ status: "ready", reason: null, dependency });
  }

  if (dependency.type === "afterok") {
    return Object.freeze({
      status: succeeded ? "ready" : "never",
      reason: succeeded ? null : `DependencyNeverSatisfied: ${dependency.jobId} did not complete successfully`,
      dependency,
    });
  }

  return Object.freeze({
    status: succeeded ? "never" : "ready",
    reason: succeeded ? `DependencyNeverSatisfied: ${dependency.jobId} completed successfully` : null,
    dependency,
  });
}
