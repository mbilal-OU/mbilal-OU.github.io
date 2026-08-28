import { createDefaultJobSpec, normalizeJobSpec } from "../core/job-spec.js";
import { parseMemoryToMB, parseWalltimeToSeconds } from "../core/units.js";

const VALUE_OPTIONS = new Map([
  ["--job-name", "jobName"], ["-J", "jobName"],
  ["--partition", "partition"], ["-p", "partition"],
  ["--account", "account"], ["-A", "account"],
  ["--qos", "qos"],
  ["--nodes", "nodes"], ["-N", "nodes"],
  ["--ntasks", "ntasks"], ["-n", "ntasks"],
  ["--cpus-per-task", "cpusPerTask"], ["-c", "cpusPerTask"],
  ["--mem", "memoryMB"],
  ["--time", "walltimeSeconds"], ["-t", "walltimeSeconds"],
  ["--output", "output"], ["-o", "output"],
  ["--error", "error"], ["-e", "error"],
  ["--array", "array"], ["-a", "array"],
  ["--dependency", "dependency"],
  ["--gres", "gres"],
  ["--gpus", "gpus"],
  ["--mail-user", "mailUser"],
  ["--mail-type", "mailType"],
  ["--export", "exportPolicy"],
]);

export function parseSlurmScript(text, provenance = { source: "imported-script", scenarioId: null, parentJobId: null }) {
  const source = String(text ?? "").replace(/\r\n?/g, "\n");
  if (!source.trim()) throw new Error("Slurm script is empty");

  const lines = source.split("\n");
  const spec = createDefaultJobSpec();
  spec.provenance = provenance;

  let inHeader = true;
  let sawExecutableLine = false;
  const body = [];

  for (const line of lines) {
    const trimmed = line.trim();

    if (inHeader && (trimmed === "" || trimmed.startsWith("#!") || (trimmed.startsWith("#") && !trimmed.startsWith("#SBATCH")))) {
      continue;
    }

    if (inHeader && trimmed.startsWith("#SBATCH")) {
      parseDirective(trimmed.replace(/^#SBATCH\s*/, ""), spec);
      continue;
    }

    if (trimmed && !trimmed.startsWith("#")) {
      inHeader = false;
      sawExecutableLine = true;
    }

    if (!inHeader || sawExecutableLine) body.push(line);
  }

  parseBody(body, spec);
  return normalizeJobSpec(spec);
}

function parseDirective(payload, spec) {
  const tokens = shellSplit(payload);
  if (!tokens.length) return;

  const first = tokens[0];
  if (first === "--exclusive") {
    spec.exclusive = true;
    return;
  }

  let option = first;
  let value = tokens[1];
  const equals = first.match(/^(--[^=]+)=(.*)$/);
  if (equals) {
    option = equals[1];
    value = equals[2];
  }

  const field = VALUE_OPTIONS.get(option);
  if (!field || value === undefined) {
    spec.unparsedDirectives.push(payload);
    return;
  }

  try {
    assignKnownDirective(spec, field, value);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Invalid #SBATCH directive '${payload}': ${message}`);
  }
}

function assignKnownDirective(spec, field, value) {
  switch (field) {
    case "nodes":
    case "ntasks":
    case "cpusPerTask": {
      const parsed = Number(value);
      if (!Number.isInteger(parsed) || parsed < 1) throw new Error(`${field} must be a positive integer`);
      spec[field] = parsed;
      return;
    }
    case "memoryMB":
      spec.memoryMB = parseMemoryToMB(value);
      return;
    case "walltimeSeconds":
      spec.walltimeSeconds = parseWalltimeToSeconds(value);
      return;
    case "array":
      spec.array = { specification: String(value) };
      return;
    case "dependency":
      spec.dependency = { raw: String(value) };
      return;
    case "gres":
      spec.gres = String(value);
      spec.gpus = gpuCountFromGres(value);
      return;
    case "gpus": {
      const parsed = Number(value);
      if (!Number.isInteger(parsed) || parsed < 0) throw new Error("gpus must be a non-negative integer");
      spec.gpus = parsed;
      return;
    }
    default:
      spec[field] = String(value);
  }
}

function parseBody(lines, spec) {
  const commandLines = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (/^module\s+purge(?:\s|$)/i.test(trimmed)) {
      spec.purgeModules = true;
      continue;
    }
    const moduleLoad = trimmed.match(/^module\s+load\s+(.+)$/i);
    if (moduleLoad) {
      spec.modules.push(...shellSplit(moduleLoad[1]));
      continue;
    }
    const conda = trimmed.match(/^(?:conda\s+activate|source\s+activate)\s+([^\s#]+)\s*$/i);
    if (conda) {
      spec.condaEnvironment = conda[1];
      continue;
    }
    const workingDirectory = trimmed.match(/^cd\s+(.+)$/);
    if (workingDirectory && isSimpleShellValue(workingDirectory[1])) {
      spec.workingDirectory = unquoteShellValue(workingDirectory[1]);
      continue;
    }
    const exported = trimmed.match(/^export\s+([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (exported && isSimpleShellValue(exported[2])) {
      spec.environmentVariables[exported[1]] = unquoteShellValue(exported[2]);
      continue;
    }
    commandLines.push(line);
  }

  while (commandLines.length && commandLines[0].trim() === "") commandLines.shift();
  while (commandLines.length && commandLines.at(-1).trim() === "") commandLines.pop();
  spec.commandBlock = commandLines.join("\n");
}

function gpuCountFromGres(value) {
  const entries = String(value).split(",").map((entry) => entry.trim()).filter(Boolean);
  let total = 0;

  for (const entry of entries) {
    const parts = entry.split(":");
    if (parts[0].toLowerCase() !== "gpu") continue;

    if (parts.length === 1) total += 1;
    else if (parts.length === 2 && /^\d+$/.test(parts[1])) total += Number(parts[1]);
    else if (parts.length >= 3 && /^\d+$/.test(parts.at(-1))) total += Number(parts.at(-1));
    else total += 1;
  }

  return total;
}

function shellSplit(raw) {
  const out = [];
  const regex = /"([^"]*)"|'([^']*)'|([^\s]+)/g;
  let match;
  while ((match = regex.exec(String(raw)))) out.push(match[1] ?? match[2] ?? match[3]);
  return out;
}

function isSimpleShellValue(value) {
  const text = String(value).trim();
  if (!text) return true;
  if (/^"[^"]*"$/.test(text) || /^'[^']*'$/.test(text)) return true;
  return !/[;&|`$()<>]/.test(text) && !/\s/.test(text);
}

function unquoteShellValue(value) {
  const text = String(value).trim();
  if ((text.startsWith('"') && text.endsWith('"')) || (text.startsWith("'") && text.endsWith("'"))) {
    return text.slice(1, -1);
  }
  return text;
}
