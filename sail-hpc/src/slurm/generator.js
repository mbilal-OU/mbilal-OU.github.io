import { normalizeJobSpec } from "../core/job-spec.js";
import { formatMemoryMB, formatWalltimeSeconds } from "../core/units.js";

export function generateSlurmScript(inputSpec) {
  const spec = normalizeJobSpec(inputSpec);
  const lines = ["#!/bin/bash", ""];

  pushDirective(lines, "--job-name", spec.jobName);
  pushDirective(lines, "--partition", spec.partition);
  pushDirective(lines, "--account", spec.account);
  pushDirective(lines, "--qos", spec.qos);
  pushDirective(lines, "--nodes", spec.nodes);
  pushDirective(lines, "--ntasks", spec.ntasks);
  pushDirective(lines, "--cpus-per-task", spec.cpusPerTask);
  if (spec.memoryMB !== null) pushDirective(lines, "--mem", formatMemoryMB(spec.memoryMB));
  if (spec.walltimeSeconds !== null) pushDirective(lines, "--time", formatWalltimeSeconds(spec.walltimeSeconds));
  if (spec.array) pushDirective(lines, "--array", spec.array.specification);
  if (spec.dependency) pushDirective(lines, "--dependency", spec.dependency.raw);

  if (spec.gres) pushDirective(lines, "--gres", spec.gres);
  else if (spec.gpus > 0) pushDirective(lines, "--gpus", spec.gpus);

  pushDirective(lines, "--output", spec.output);
  pushDirective(lines, "--error", spec.error);
  pushDirective(lines, "--mail-user", spec.mailUser);
  pushDirective(lines, "--mail-type", spec.mailType);
  pushDirective(lines, "--export", spec.exportPolicy);
  if (spec.exclusive) lines.push("#SBATCH --exclusive");

  for (const raw of spec.unparsedDirectives) {
    const payload = String(raw).replace(/^#SBATCH\s*/, "").trim();
    if (payload) lines.push(`#SBATCH ${payload}`);
  }

  lines.push("");

  if (spec.purgeModules) lines.push("module purge");
  if (spec.modules.length) lines.push(`module load ${spec.modules.join(" ")}`);
  if (spec.condaEnvironment) lines.push(`conda activate ${shellQuote(spec.condaEnvironment)}`);
  if (spec.workingDirectory) lines.push(`cd ${shellQuote(spec.workingDirectory)}`);
  for (const [key, value] of Object.entries(spec.environmentVariables)) {
    lines.push(`export ${key}=${shellQuote(value)}`);
  }

  const hasSetup = spec.purgeModules
    || spec.modules.length
    || spec.condaEnvironment
    || spec.workingDirectory
    || Object.keys(spec.environmentVariables).length;
  if (hasSetup && spec.commandBlock) lines.push("");
  if (spec.commandBlock) lines.push(spec.commandBlock);

  return `${trimTrailingBlankLines(lines).join("\n")}\n`;
}

function pushDirective(lines, flag, value) {
  if (value === null || value === undefined || value === "") return;
  lines.push(`#SBATCH ${flag}=${value}`);
}

function shellQuote(value) {
  const text = String(value);
  if (/^[A-Za-z0-9_./:@%+=,-]+$/.test(text)) return text;
  return `'${text.replace(/'/g, `'"'"'`)}'`;
}

function trimTrailingBlankLines(lines) {
  const result = [...lines];
  while (result.length && result.at(-1) === "") result.pop();
  return result;
}
