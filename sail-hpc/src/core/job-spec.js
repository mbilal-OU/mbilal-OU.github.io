export const JOB_SPEC_SCHEMA_VERSION = "1";

export function createDefaultJobSpec() {
  return {
    schemaVersion: JOB_SPEC_SCHEMA_VERSION,
    jobName: "job",
    partition: null,
    account: null,
    qos: null,
    nodes: 1,
    ntasks: 1,
    cpusPerTask: 1,
    memoryMB: null,
    walltimeSeconds: null,
    gpus: 0,
    gres: null,
    array: null,
    dependency: null,
    output: null,
    error: null,
    mailUser: null,
    mailType: null,
    exportPolicy: null,
    exclusive: false,
    purgeModules: false,
    modules: [],
    condaEnvironment: null,
    workingDirectory: null,
    environmentVariables: {},
    commandBlock: "",
    unparsedDirectives: [],
    revisionLineage: [],
    provenance: {
      source: "unknown",
      scenarioId: null,
      parentJobId: null,
    },
  };
}

export function normalizeJobSpec(spec = {}) {
  const normalized = { ...createDefaultJobSpec(), ...spec };

  normalized.schemaVersion = String(normalized.schemaVersion || JOB_SPEC_SCHEMA_VERSION);
  normalized.jobName = String(normalized.jobName || "job");
  normalized.partition = nullableString(normalized.partition);
  normalized.account = nullableString(normalized.account);
  normalized.qos = nullableString(normalized.qos);
  normalized.nodes = positiveInt(normalized.nodes, 1, "nodes");
  normalized.ntasks = positiveInt(normalized.ntasks, 1, "ntasks");
  normalized.cpusPerTask = positiveInt(normalized.cpusPerTask, 1, "cpusPerTask");
  normalized.memoryMB = nullableNonNegativeInt(normalized.memoryMB, "memoryMB");
  normalized.walltimeSeconds = nullableNonNegativeInt(normalized.walltimeSeconds, "walltimeSeconds");
  normalized.gpus = nonNegativeInt(normalized.gpus, 0, "gpus");
  normalized.gres = nullableString(normalized.gres);
  normalized.array = normalizeArray(normalized.array);
  normalized.dependency = normalizeDependency(normalized.dependency);
  normalized.output = nullableString(normalized.output);
  normalized.error = nullableString(normalized.error);
  normalized.mailUser = nullableString(normalized.mailUser);
  normalized.mailType = nullableString(normalized.mailType);
  normalized.exportPolicy = nullableString(normalized.exportPolicy);
  normalized.exclusive = Boolean(normalized.exclusive);
  normalized.purgeModules = Boolean(normalized.purgeModules);
  normalized.modules = [...new Set((normalized.modules || []).map((value) => String(value).trim()).filter(Boolean))];
  normalized.condaEnvironment = nullableString(normalized.condaEnvironment);
  normalized.workingDirectory = nullableString(normalized.workingDirectory);
  normalized.environmentVariables = normalizeEnvironmentVariables(normalized.environmentVariables);
  normalized.commandBlock = String(normalized.commandBlock || "").trimEnd();
  normalized.unparsedDirectives = (normalized.unparsedDirectives || []).map((value) => String(value).trim()).filter(Boolean);
  normalized.revisionLineage = [...new Set((normalized.revisionLineage || []).map((value) => String(value).trim()).filter(Boolean))];
  normalized.provenance = {
    source: String(normalized.provenance?.source || "unknown"),
    scenarioId: nullableString(normalized.provenance?.scenarioId),
    parentJobId: nullableString(normalized.provenance?.parentJobId),
  };

  return normalized;
}

function normalizeArray(value) {
  if (!value) return null;
  const specification = String(value.specification ?? value).trim();
  return specification ? { specification } : null;
}

function normalizeDependency(value) {
  if (!value) return null;
  if (typeof value === "string") {
    const raw = value.trim();
    return raw ? { raw } : null;
  }
  const raw = String(value.raw || "").trim();
  return raw ? { raw } : null;
}

function normalizeEnvironmentVariables(value) {
  if (!value) return {};
  if (typeof value !== "object" || Array.isArray(value)) {
    throw new Error("environmentVariables must be an object");
  }
  const result = {};
  for (const [rawKey, rawValue] of Object.entries(value)) {
    const key = String(rawKey).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) throw new Error(`Invalid environment variable name '${key}'`);
    result[key] = String(rawValue ?? "");
  }
  return result;
}

function nullableString(value) {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text ? text : null;
}

function positiveInt(value, fallback, label) {
  if (value === null || value === undefined || value === "") return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) throw new Error(`${label} must be a positive integer`);
  return parsed;
}

function nonNegativeInt(value, fallback, label) {
  if (value === null || value === undefined || value === "") return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) throw new Error(`${label} must be a non-negative integer`);
  return parsed;
}

function nullableNonNegativeInt(value, label) {
  if (value === null || value === undefined || value === "") return null;
  return nonNegativeInt(value, 0, label);
}
