export function normalizeClusterPolicy(policy = {}) {
  const rawPartitions = policy.partitions ?? {};
  if (!rawPartitions || typeof rawPartitions !== "object" || Array.isArray(rawPartitions)) {
    throw new Error("policy.partitions must be an object");
  }

  const partitions = {};
  for (const [name, raw] of Object.entries(rawPartitions)) {
    const partitionName = String(name).trim();
    if (!partitionName) throw new Error("partition name cannot be empty");
    partitions[partitionName] = Object.freeze({
      maxWalltimeSeconds: optionalPositiveInteger(raw?.maxWalltimeSeconds, `${partitionName}.maxWalltimeSeconds`),
      maxCpusPerJob: optionalPositiveInteger(raw?.maxCpusPerJob, `${partitionName}.maxCpusPerJob`),
      maxMemoryMBPerJob: optionalPositiveInteger(raw?.maxMemoryMBPerJob, `${partitionName}.maxMemoryMBPerJob`),
      maxGpusPerJob: optionalNonNegativeInteger(raw?.maxGpusPerJob, `${partitionName}.maxGpusPerJob`),
    });
  }

  const defaultPartition = nullableString(policy.defaultPartition);
  if (defaultPartition && !partitions[defaultPartition]) {
    throw new Error(`defaultPartition ${defaultPartition} is not defined in policy.partitions`);
  }

  return Object.freeze({
    name: String(policy.name || "training-cluster"),
    defaultPartition,
    partitions: Object.freeze(partitions),
  });
}

export function validateJobAgainstClusterPolicy(spec, inputPolicy) {
  const policy = normalizeClusterPolicy(inputPolicy);
  const diagnostics = [];
  const partition = spec?.partition || policy.defaultPartition;

  if (!partition) {
    diagnostics.push(error("PARTITION_REQUIRED", "A partition is required by this cluster profile"));
    return diagnostics;
  }

  const partitionPolicy = policy.partitions[partition];
  if (!partitionPolicy) {
    diagnostics.push(error("UNKNOWN_PARTITION", `Partition '${partition}' is not defined by this cluster profile`));
    return diagnostics;
  }

  const cpus = Number(spec?.ntasks ?? 1) * Number(spec?.cpusPerTask ?? 1);
  const memoryMB = Number(spec?.memoryMB ?? 0);
  const walltimeSeconds = Number(spec?.walltimeSeconds ?? 0);
  const gpus = Number(spec?.gpus ?? 0);

  if (partitionPolicy.maxWalltimeSeconds != null && walltimeSeconds > partitionPolicy.maxWalltimeSeconds) {
    diagnostics.push(error(
      "PARTITION_WALLTIME_LIMIT",
      `Requested walltime ${walltimeSeconds}s exceeds ${partition} limit ${partitionPolicy.maxWalltimeSeconds}s`,
    ));
  }
  if (partitionPolicy.maxCpusPerJob != null && cpus > partitionPolicy.maxCpusPerJob) {
    diagnostics.push(error(
      "PARTITION_CPU_LIMIT",
      `Requested ${cpus} CPUs exceeds ${partition} limit ${partitionPolicy.maxCpusPerJob}`,
    ));
  }
  if (partitionPolicy.maxMemoryMBPerJob != null && memoryMB > partitionPolicy.maxMemoryMBPerJob) {
    diagnostics.push(error(
      "PARTITION_MEMORY_LIMIT",
      `Requested ${memoryMB} MB exceeds ${partition} limit ${partitionPolicy.maxMemoryMBPerJob} MB`,
    ));
  }
  if (partitionPolicy.maxGpusPerJob != null && gpus > partitionPolicy.maxGpusPerJob) {
    diagnostics.push(error(
      "PARTITION_GPU_LIMIT",
      `Requested ${gpus} GPUs exceeds ${partition} limit ${partitionPolicy.maxGpusPerJob}`,
    ));
  }

  return diagnostics;
}

export function hasPolicyErrors(diagnostics) {
  return diagnostics.some((diagnostic) => diagnostic.severity === "error");
}

function error(code, message) {
  return Object.freeze({ severity: "error", code, message });
}

function optionalPositiveInteger(value, label) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) throw new Error(`${label} must be a positive integer`);
  return parsed;
}

function optionalNonNegativeInteger(value, label) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) throw new Error(`${label} must be a non-negative integer`);
  return parsed;
}

function nullableString(value) {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text || null;
}
