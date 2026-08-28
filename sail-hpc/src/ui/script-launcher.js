const $ = (id) => document.getElementById(id);

const LONG_FORM_NAME = "Simulation-Augmented Interactive Learning for High-Performance Computing";

const profiles = Object.freeze({
  python: profile("Python", "analysis.py", "python3", "Python", "python3 analysis.py input.tsv results.tsv", [
    "Accept inputs as command-line arguments rather than input() prompts.",
    "Use explicit input/output paths and write results to files.",
    "Record packages with Conda, a requirements file, or the site's module environment.",
    "Requesting more Slurm CPUs does not automatically make Python use more threads.",
  ], `# Minimal non-interactive Python pattern\nimport argparse\nparser = argparse.ArgumentParser()\nparser.add_argument("input")\nparser.add_argument("output")\nargs = parser.parse_args()`),
  r: profile("R", "analysis.R", "Rscript", "R", "Rscript analysis.R input.csv results.csv", [
    "Use Rscript for non-interactive batch execution.",
    "Read arguments with commandArgs(trailingOnly = TRUE).",
    "Write plots/tables to files rather than relying on RStudio panes.",
    "Record packages with renv, a module, or another reproducible environment.",
  ], `# Minimal non-interactive R pattern\nargs <- commandArgs(trailingOnly = TRUE)\ninput_file <- args[1]\noutput_file <- args[2]`),
  bash: profile("Bash / shell", "pipeline.sh", "bash", "", "bash pipeline.sh input.tsv results/", [
    "Use set -euo pipefail where appropriate so failures do not pass silently.",
    "Avoid commands that wait for interactive confirmation.",
    "Use explicit paths and create output/log directories deliberately.",
    "Load required tools/modules before the script starts.",
  ], `#!/usr/bin/env bash\nset -euo pipefail\ninput="$1"\noutdir="$2"\nmkdir -p "$outdir"`),
  julia: profile("Julia", "analysis.jl", "julia", "Julia", "julia analysis.jl input.tsv results.tsv", [
    "Read command-line values from ARGS.",
    "Write outputs to files and avoid REPL-only assumptions.",
    "Record the Julia/project environment used by the workflow.",
    "Map Slurm CPUs to Julia threads only when the program is written to use them.",
  ], `input = ARGS[1]\noutput = ARGS[2]\n# analysis goes here`),
  matlab: profile("MATLAB", "analysis.m", "matlab -batch", "MATLAB", "matlab -batch \"analysis\"", [
    "Use MATLAB batch/non-interactive execution supported by your site.",
    "Do not rely on desktop GUI prompts.",
    "Confirm license availability and site-specific MATLAB module/version.",
    "Write outputs and figures to files.",
  ], `% MATLAB batch-friendly pattern\ninput_file = getenv('INPUT_FILE');\n% analysis goes here\nexit;`),
  perl: profile("Perl", "analysis.pl", "perl", "Perl", "perl analysis.pl input.tsv results.tsv", [
    "Read values from @ARGV.",
    "Avoid terminal prompts during scheduled execution.",
    "Write outputs explicitly and return a non-zero status on failure.",
    "Record module/library requirements.",
  ], `my ($input, $output) = @ARGV;\ndie "usage: analysis.pl input output\\n" unless $output;`),
  java: profile("Java / JAR", "analysis.jar", "java -jar", "Java", "java -jar analysis.jar input.tsv results.tsv", [
    "Pass arguments on the java -jar command line.",
    "Choose heap settings deliberately when the application requires them.",
    "Confirm the Java version/module on the target cluster.",
    "Write outputs and logs to files.",
  ], `// Typical batch launch\njava -jar analysis.jar input.tsv results.tsv`),
  node: profile("Node.js", "analysis.js", "node", "Node.js", "node analysis.js input.json results.json", [
    "Read values from process.argv.",
    "Avoid server/listener processes unless the scheduled job is intentionally long-lived.",
    "Record npm/package-lock or environment requirements.",
    "Write results to files.",
  ], `const [input, output] = process.argv.slice(2);\nif (!output) process.exit(2);`),
  ruby: profile("Ruby", "analysis.rb", "ruby", "Ruby", "ruby analysis.rb input.tsv results.tsv", [
    "Read arguments from ARGV.",
    "Avoid interactive prompts.",
    "Record gem/runtime requirements.",
    "Write outputs to files.",
  ], `input, output = ARGV\nabort "usage" unless output`),
  php: profile("PHP CLI", "analysis.php", "php", "PHP", "php analysis.php input.tsv results.tsv", [
    "Use the CLI runtime, not a web server.",
    "Read arguments from $argv.",
    "Avoid browser/session assumptions.",
    "Write results to files.",
  ], `$input = $argv[1] ?? null;\n$output = $argv[2] ?? null;`),
  compiled: profile("Compiled executable", "./analysis", "", "", "./analysis input.tsv results.tsv", [
    "Confirm the executable is built for the cluster architecture and required libraries are available.",
    "Pass inputs/outputs as command-line arguments or config files.",
    "Use MPI/OpenMP only if the executable was designed for them.",
    "Request CPUs/memory to match the program's actual parallel model.",
  ], `./analysis input.tsv results.tsv`),
  nextflow: profile("Nextflow", "main.nf", "nextflow run", "Nextflow", "nextflow run main.nf -profile slurm", [
    "Nextflow can submit its own tasks to Slurm; distinguish the workflow launcher from per-task resources.",
    "Use a Slurm-aware executor/config for the real cluster.",
    "Keep work and publish directories on appropriate filesystems.",
    "Confirm container/module support and executor policy at the target institution.",
  ], `nextflow run main.nf -profile slurm --input samples.csv`),
  snakemake: profile("Snakemake", "Snakefile", "snakemake", "Snakemake", "snakemake --profile slurm", [
    "Use a Slurm executor/profile appropriate for the installed Snakemake version.",
    "Resource declarations belong at rule/job level where possible.",
    "Confirm software-environment handling with Conda, modules, or containers.",
    "Do not assume the login node should perform heavy workflow tasks.",
  ], `snakemake --profile slurm --jobs 50`),
  cwl: profile("CWL / cwltool", "workflow.cwl", "cwltool", "CWL", "cwltool workflow.cwl inputs.yml", [
    "Confirm how CWL jobs are mapped to the site's scheduler.",
    "Keep inputs portable and file paths explicit.",
    "Record containers/software requirements.",
    "Do not treat a CWL runner as automatically Slurm-aware.",
  ], `cwltool workflow.cwl inputs.yml`),
  wdl: profile("WDL / Cromwell", "workflow.wdl", "java -jar cromwell.jar run", "Java", "java -jar cromwell.jar run workflow.wdl --inputs inputs.json", [
    "Use a Cromwell backend configured for the real cluster if scheduling workflow tasks through Slurm.",
    "Keep workflow inputs and runtime attributes explicit.",
    "Confirm container and filesystem support.",
    "The launcher job and workflow task jobs may need different resource reasoning.",
  ], `java -jar cromwell.jar run workflow.wdl --inputs inputs.json`),
  jupyter: profile("Jupyter notebook via nbconvert", "analysis.ipynb", "jupyter nbconvert --to notebook --execute", "Jupyter", "jupyter nbconvert --to notebook --execute analysis.ipynb --output executed.ipynb", [
    "Execute notebooks non-interactively with nbconvert or another batch runner.",
    "Remove widgets/prompts that require a human response.",
    "Parameterize input/output paths rather than editing cells manually per run.",
    "Record the notebook environment and package versions.",
  ], `jupyter nbconvert --to notebook --execute analysis.ipynb --output executed.ipynb`),
  container: profile("Container command", "container-image.sif", "apptainer exec", "Apptainer", "apptainer exec image.sif python analysis.py input.tsv results.tsv", [
    "Confirm whether Apptainer/Singularity or another container runtime is supported.",
    "Bind only required paths and respect site container policy.",
    "Resource requests still belong to Slurm even when software runs inside a container.",
    "Do not embed credentials in container command lines.",
  ], `apptainer exec image.sif python analysis.py input.tsv results.tsv`),
  custom: profile("Custom shell command", "", "", "", "my-command --input data --output results", [
    "Provide the exact non-interactive shell command you want the batch job to run.",
    "Confirm it exits on failure and writes results/logs to files.",
    "Document the software environment required by the command.",
    "Choose Slurm resources based on how the command actually uses CPU, memory, GPU and time.",
  ], `my-command --input data --output results`),
});

boot();

function boot() {
  const language = $("launcher-language");
  if (!language) return;
  language.addEventListener("change", () => loadProfile(language.value, true));
  for (const id of ["launcher-script", "launcher-args", "launcher-module", "launcher-conda", "launcher-workdir"]) {
    $(id)?.addEventListener("input", render);
    $(id)?.addEventListener("change", render);
  }
  $("pipeline-file")?.addEventListener("change", handleLocalFile);
  $("launcher-copy-command")?.addEventListener("click", copyCommand);
  $("launcher-load-builder")?.addEventListener("click", sendToBuilder);
  loadProfile(language.value || "python", false);
  installReadinessLayer();
}

function loadProfile(key, reset) {
  const p = profiles[key] || profiles.custom;
  if (reset) {
    $("launcher-script").value = p.defaultTarget;
    $("launcher-module").value = p.defaultModule;
    $("launcher-conda").value = "";
    $("launcher-args").value = defaultArgsFor(key);
  }
  $("language-local-command").textContent = p.localExample;
  $("language-snippet").textContent = p.snippet;
  const list = $("language-essentials");
  list.replaceChildren();
  for (const item of p.essentials) {
    const li = document.createElement("li");
    li.textContent = item;
    list.appendChild(li);
  }
  render();
}

function render() {
  const p = profiles[$("launcher-language").value] || profiles.custom;
  const command = buildCommand(p, $("launcher-script").value, $("launcher-args").value);
  $("launcher-summary").textContent = command;
  const checks = {
    target: Boolean($("launcher-script").value.trim() || p === profiles.custom),
    args: true,
    environment: Boolean($("launcher-module").value.trim() || $("launcher-conda").value.trim() || !p.defaultModule),
    outputs: true,
    interactive: true,
  };
  for (const [key, done] of Object.entries(checks)) {
    const item = document.querySelector(`[data-check="${key}"]`);
    if (!item) continue;
    item.dataset.done = String(done);
    item.textContent = `${done ? "✓" : "○"} ${checkLabel(key)}`;
  }
}

function sendToBuilder() {
  const p = profiles[$("launcher-language").value] || profiles.custom;
  const target = $("launcher-script").value.trim();
  const command = buildCommand(p, target, $("launcher-args").value);
  const scenario = $("scenario-select");
  if (scenario) {
    scenario.value = "script-wrapper-v1";
    scenario.dispatchEvent(new Event("change", { bubbles: true }));
  }
  $("job-name").value = safeJobName(target || p.label);
  $("modules").value = $("launcher-module").value.trim();
  $("builder-conda").value = $("launcher-conda").value.trim();
  $("working-directory").value = $("launcher-workdir").value.trim();
  $("command-block").value = command;
  for (const field of [$("job-name"), $("modules"), $("builder-conda"), $("working-directory"), $("command-block")]) {
    field?.dispatchEvent(new Event("input", { bubbles: true }));
    field?.dispatchEvent(new Event("change", { bubbles: true }));
  }
  location.hash = "#/builder";
}

async function copyCommand() {
  const p = profiles[$("launcher-language").value] || profiles.custom;
  const command = buildCommand(p, $("launcher-script").value, $("launcher-args").value);
  try {
    await navigator.clipboard.writeText(command);
    $("launcher-summary").textContent = `${command}  ✓ copied`;
  } catch {
    $("launcher-summary").textContent = command;
  }
}

async function handleLocalFile(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  $("launcher-script").value = file.name;
  const inferred = inferProfile(file.name);
  if (inferred) {
    $("launcher-language").value = inferred;
    loadProfile(inferred, false);
  }
  try {
    const text = await file.text();
    if (text.length <= 200000) sessionStorage.setItem("sail-hpc-local-pipeline-preview", text);
  } catch {
    // File name is still useful even if the browser cannot read the file as text.
  }
  render();
}

function buildCommand(p, target, args) {
  const trimmedTarget = String(target || "").trim();
  const suffix = String(args || "").trim();
  if (p === profiles.custom) return `${trimmedTarget}${suffix ? ` ${suffix}` : ""}`.trim();
  const command = [p.executable, shellQuoteIfNeeded(trimmedTarget || p.defaultTarget)].filter(Boolean).join(" ");
  return `${command}${suffix ? ` ${suffix}` : ""}`.trim();
}

function inferProfile(name) {
  const lower = String(name).toLowerCase();
  if (lower.endsWith(".py")) return "python";
  if (lower.endsWith(".r")) return "r";
  if (lower.endsWith(".sh") || lower.endsWith(".bash")) return "bash";
  if (lower.endsWith(".jl")) return "julia";
  if (lower.endsWith(".m")) return "matlab";
  if (lower.endsWith(".pl")) return "perl";
  if (lower.endsWith(".jar") || lower.endsWith(".java")) return "java";
  if (lower.endsWith(".js")) return "node";
  if (lower.endsWith(".rb")) return "ruby";
  if (lower.endsWith(".php")) return "php";
  if (lower.endsWith(".nf")) return "nextflow";
  if (lower.includes("snakefile") || lower.endsWith(".smk")) return "snakemake";
  if (lower.endsWith(".cwl")) return "cwl";
  if (lower.endsWith(".wdl")) return "wdl";
  if (lower.endsWith(".ipynb")) return "jupyter";
  if (lower.endsWith(".sif")) return "container";
  return "custom";
}

function profile(label, defaultTarget, executable, defaultModule, localExample, essentials, snippet) {
  return Object.freeze({ label, defaultTarget, executable, defaultModule, localExample, essentials, snippet });
}
function shellQuoteIfNeeded(value) { if (!/\s/.test(value)) return value; return `'${value.replaceAll("'", `'\\''`)}'`; }
function safeJobName(filename) { return String(filename || "pipeline").split(/[\\/]/).pop().replace(/\.(py|r|sh|bash|jl|m|pl|jar|java|js|rb|php|nf|smk|cwl|wdl|ipynb|sif)$/i, "").replace(/[^A-Za-z0-9_-]+/g, "_").slice(0, 40) || "pipeline_job"; }
function defaultArgsFor(key) { return ({ python:"input.tsv results.tsv", r:"input.csv results.csv", bash:"input.tsv results/", julia:"input.tsv results.tsv", perl:"input.tsv results.tsv", java:"input.tsv results.tsv", node:"input.json results.json", ruby:"input.tsv results.tsv", php:"input.tsv results.tsv", compiled:"input.tsv results.tsv", nextflow:"-profile slurm", snakemake:"--profile slurm", cwl:"inputs.yml", wdl:"--inputs inputs.json", jupyter:"--output executed.ipynb", container:"python analysis.py input.tsv results.tsv", custom:"" })[key] || ""; }
function checkLabel(key) { return ({ target:"Target or command provided", args:"Arguments considered", environment:"Environment considered", outputs:"Outputs should go to files", interactive:"No interactive input during batch execution" })[key]; }

function installReadinessLayer() {
  patchProductLongForm();
  keepMobileHelpAccessible();
  installReferenceCommandCards();
  installReadinessReview();
  interceptReferenceCommands();
  overrideCertificateSVGDownload();
}

function patchProductLongForm() {
  document.title = `SAIL-HPC | ${LONG_FORM_NAME}`;
  const description = document.querySelector('meta[name="description"]');
  if (description) description.content = `SAIL-HPC, ${LONG_FORM_NAME}, is a browser-first Slurm/HPC training environment for guided learning, deterministic simulation, diagnosis, revision, assessment and transfer to real clusters.`;
  const brandLong = document.querySelector(".brand-copy small");
  if (brandLong) brandLong.textContent = LONG_FORM_NAME;
  const footerBrand = document.querySelector("footer div:first-child");
  if (footerBrand) footerBrand.textContent = `SAIL-HPC · ${LONG_FORM_NAME}`;
  const certificateLong = document.querySelector(".certificate-preview small");
  if (certificateLong) certificateLong.textContent = LONG_FORM_NAME;
}

function keepMobileHelpAccessible() {
  if (document.getElementById("sail-mobile-help-style")) return;
  const style = document.createElement("style");
  style.id = "sail-mobile-help-style";
  style.textContent = `
    @media (max-width:1100px){
      .topnav{display:flex!important}
      .topnav .nav-button:not(#help-button){display:none!important}
      #help-button{display:inline-flex!important}
    }
    .readiness-note{margin:1rem 1.3rem;padding:1rem;border:1px solid var(--line);border-radius:10px;background:rgba(23,29,36,.55)}
    .readiness-note h3{margin:.1rem 0 .35rem;font-size:1rem}
    .readiness-note p{margin:.2rem 0 .8rem;color:var(--muted);font-size:.82rem}
    .readiness-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:.55rem}
    .readiness-item{padding:.7rem;border:1px solid var(--line);border-radius:9px;background:var(--panel-3)}
    .readiness-item strong,.readiness-item code{display:block;margin-bottom:.25rem}
    .readiness-item small{color:var(--muted)}
    .reference-badge{display:inline-block;margin-bottom:.35rem;padding:.15rem .38rem;border:1px solid rgba(231,190,106,.4);border-radius:999px;color:var(--warning);font-size:.62rem;font-weight:800;text-transform:uppercase;letter-spacing:.05em}
    @media (max-width:720px){.readiness-grid{grid-template-columns:1fr}}
  `;
  document.head.appendChild(style);
}

function installReferenceCommandCards() {
  const catalog = $("command-catalog");
  if (!catalog || document.getElementById("reference-command-group")) return;
  const section = document.createElement("section");
  section.className = "command-group";
  section.id = "reference-command-group";
  const h3 = document.createElement("h3");
  h3.textContent = "Real-cluster literacy";
  section.appendChild(h3);

  const references = [
    ["srun --pty bash", "Reference-only: know how srun launches tasks/job steps and is commonly used for interactive work."],
    ["salloc", "Reference-only: know how an interactive allocation is requested before launching work."],
    ["sstat <jobid>", "Reference-only: know that running job/step resource information may be available through sstat."],
    ["sprio -j <jobid>", "Reference-only: know that real priority factors may be inspected with sprio when the site configuration supports it."],
  ];
  for (const [command, purpose] of references) {
    const card = document.createElement("div");
    card.className = "command-card";
    const badge = document.createElement("span");
    badge.className = "reference-badge";
    badge.textContent = "reference-only";
    const code = document.createElement("code");
    code.textContent = command;
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = "Insert";
    button.addEventListener("click", () => {
      location.hash = "#/practice";
      const input = $("terminal-input");
      if (!input) return;
      input.value = command.replace("<jobid>", currentJobIdFromUI());
      setTimeout(() => input.focus(), 0);
    });
    const p = document.createElement("p");
    p.textContent = purpose;
    card.append(badge, code, button, p);
    section.appendChild(card);
  }
  catalog.appendChild(section);
}

function installReadinessReview() {
  const lessonNav = document.querySelector('.tutorial-content .lesson-nav');
  if (!lessonNav || document.getElementById("real-cluster-readiness-review")) return;
  const details = document.createElement("details");
  details.className = "disclosure readiness-note";
  details.id = "real-cluster-readiness-review";
  const summary = document.createElement("summary");
  summary.textContent = "Real-cluster readiness review";
  const body = document.createElement("div");
  body.className = "disclosure-body";
  const intro = document.createElement("p");
  intro.textContent = "Before your first institutional job, make sure you recognize these extra Slurm and shell concepts. They are deliberately separated from the 13-step guided core so the beginner path stays clean.";
  body.appendChild(intro);

  const grid = document.createElement("div");
  grid.className = "readiness-grid";
  const items = [
    ["srun", "Launch tasks/job steps; often used inside allocations or for interactive work."],
    ["salloc", "Request an interactive allocation, then launch work inside it."],
    ["sstat", "Inspect resource information for running jobs/job steps where the site supports it."],
    ["sprio", "Inspect priority components where the site's priority configuration supports it."],
    ["Paths", "Be comfortable with pwd, ls, cd, absolute/relative paths, and explicit working directories."],
    ["Logs", "Know where stdout/stderr go and how to inspect job output instead of guessing why a job failed."],
    ["Software", "Know that modules, Conda, containers, and versions are separate from CPU/memory requests."],
    ["Threads", "Know that --cpus-per-task does not automatically make a program use that many threads."],
    ["Storage", "Check home/project/scratch paths, quotas, and temporary-file policy before scaling."],
    ["Transfer", "Re-check partition, account/QOS, modules, paths, limits, and site policy before real sbatch submission."],
  ];
  for (const [title, description] of items) {
    const item = document.createElement("div");
    item.className = "readiness-item";
    const strong = document.createElement("strong");
    strong.textContent = title;
    const small = document.createElement("small");
    small.textContent = description;
    item.append(strong, small);
    grid.appendChild(item);
  }
  body.appendChild(grid);

  const download = document.createElement("button");
  download.type = "button";
  download.textContent = "Download real-cluster readiness sheet";
  download.addEventListener("click", downloadReadinessSheet);
  body.appendChild(download);
  details.append(summary, body);
  lessonNav.before(details);
}

function interceptReferenceCommands() {
  const form = $("terminal-form");
  if (!form || form.dataset.referenceCommandsBound === "true") return;
  form.dataset.referenceCommandsBound = "true";
  form.addEventListener("submit", (event) => {
    const input = $("terminal-input");
    const command = input?.value.trim() || "";
    const verb = command.split(/\s+/)[0]?.toLowerCase();
    const outputs = {
      srun: "REFERENCE-ONLY IN SAIL-HPC\nOn a real Slurm cluster, srun launches tasks/job steps and can be used in interactive workflows. SAIL-HPC does not execute arbitrary shell/scientific commands, so this command is taught for transfer literacy rather than simulated as production execution.",
      salloc: "REFERENCE-ONLY IN SAIL-HPC\nOn a real Slurm cluster, salloc requests an interactive allocation. Users commonly launch work inside that allocation with srun. SAIL-HPC does not create a real interactive shell allocation.",
      sstat: "REFERENCE-ONLY IN SAIL-HPC\nOn a real Slurm cluster, sstat can report resource information for running jobs/job steps where supported. Use SAIL-HPC Observe for deterministic modeled values; do not interpret them as measured sstat output.",
      sprio: "REFERENCE-ONLY IN SAIL-HPC\nOn real clusters, sprio can expose job-priority components when the priority configuration supports it. SAIL-HPC does not model production multifactor priority, fair-share, backfill, or queue-time prediction.",
    };
    if (!outputs[verb]) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    appendTerminalReference(`student@sail-login:~$ ${command}`, "command");
    appendTerminalReference(outputs[verb], "output");
    input.value = "";
    input.focus();
  }, true);
}

function appendTerminalReference(text, kind) {
  const output = $("terminal-output");
  if (!output) return;
  const line = document.createElement("pre");
  line.className = `terminal-line ${kind}`;
  line.textContent = text;
  output.appendChild(line);
  output.scrollTop = output.scrollHeight;
}

function currentJobIdFromUI() {
  const selected = document.querySelector('#queue-body tr[aria-selected="true"]');
  const firstCell = selected?.querySelector("td");
  if (firstCell?.textContent.trim()) return firstCell.textContent.trim();
  const firstRow = document.querySelector("#queue-body tr td");
  return firstRow?.textContent.trim() || "73001";
}

function downloadReadinessSheet() {
  const text = `SAIL-HPC REAL-CLUSTER READINESS\n${LONG_FORM_NAME}\n\nMODELED CORE\nsinfo\nsqueue\nsbatch <script.sh> on a real cluster\nscontrol show job <jobid>\nsacct\nseff <jobid> where available\nscancel <jobid>\n\nREFERENCE COMMAND LITERACY\nsrun\nsalloc\nsstat\nsprio\n\nSHELL / ENVIRONMENT\npwd, ls, cd, mkdir\nstdout/stderr and log inspection\nmodule avail / module load / module list / module purge\nConda or site-approved environments\napplication threading vs --cpus-per-task\nhome/project/scratch storage policy\n\nBEFORE REAL SUBMISSION\nCheck partition, account/QOS, walltime limits, modules/software versions, paths, storage, GPU syntax, array/dependency syntax and local policy. Submit a small validation job before scaling.\n\nA SAIL-HPC 100/100 score is a beginner transfer-readiness checkpoint, not universal professional certification.\n`;
  const blob = new Blob([text], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "SAIL-HPC-real-cluster-readiness.txt";
  a.click();
  URL.revokeObjectURL(url);
}

function overrideCertificateSVGDownload() {
  const button = $("download-certificate");
  if (!button || button.dataset.longFormOverride === "true") return;
  button.dataset.longFormOverride = "true";
  button.addEventListener("click", (event) => {
    if (button.disabled) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const name = $("certificate-name")?.value.trim() || "SAIL-HPC learner";
    const affiliation = $("certificate-affiliation")?.value.trim() || "Independent learner";
    const country = $("certificate-country")?.value.trim() || "";
    const date = $("certificate-date-preview")?.textContent.trim() || new Date().toISOString().slice(0, 10);
    const id = $("certificate-id-preview")?.textContent.trim() || "Local certificate ID";
    const svg = readinessCertificateSVG({ name, affiliation, country, date, id });
    const blob = new Blob([svg], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "SAIL-HPC-certificate.svg";
    a.click();
    URL.revokeObjectURL(url);
  }, true);
}

function readinessCertificateSVG(data) {
  const safe = (value) => String(value).replace(/[&<>"']/g, (char) => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&apos;" })[char]);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1100" viewBox="0 0 1600 1100"><rect width="1600" height="1100" fill="#f7f4ee"/><rect x="45" y="45" width="1510" height="1010" rx="18" fill="none" stroke="#d78c31" stroke-width="4"/><rect x="62" y="62" width="1476" height="976" rx="14" fill="none" stroke="#e5b77b" stroke-width="2"/><g font-family="Arial,Helvetica,sans-serif" text-anchor="middle"><g stroke="#f29a38" stroke-width="8" fill="none" stroke-linecap="round"><path d="M735 120h90c26 0 42 16 42 36s-16 36-42 36h-55c-26 0-42 16-42 36s16 36 42 36h95"/></g><text x="800" y="315" font-size="40" font-weight="700" fill="#1a1d22">SAIL-HPC</text><text x="800" y="375" font-size="27" fill="#a5661d">${safe(LONG_FORM_NAME)}</text><text x="800" y="470" font-family="Georgia,serif" font-size="66" font-weight="700" fill="#1a1d22">Certificate of Practice Completion</text><text x="800" y="535" font-size="24" letter-spacing="5" fill="#73757a">THIS CERTIFIES THAT</text><text x="800" y="625" font-family="Georgia,serif" font-size="68" fill="#1a1d22">${safe(data.name)}</text><text x="800" y="675" font-size="27" fill="#c27522">${safe(data.affiliation)}${data.country ? ` · ${safe(data.country)}` : ""}</text><line x1="430" y1="720" x2="1170" y2="720" stroke="#a5a5a5"/><text x="800" y="775" font-size="28" fill="#555">completed the</text><text x="800" y="820" font-size="34" font-weight="700" fill="#1a1d22">SAIL-HPC Beginner Transfer Check</text><circle cx="800" cy="915" r="78" fill="#d78c31"/><circle cx="800" cy="915" r="64" fill="none" stroke="#ffe6bd" stroke-width="6"/><text x="800" y="928" font-size="44" font-weight="800" fill="white">100%</text><text x="260" y="945" font-size="23" fill="#555">${safe(data.date)}</text><text x="1340" y="945" font-size="23" fill="#555">100 / 100</text><text x="800" y="1030" font-size="20" fill="#666">Certificate ID: ${safe(data.id)} · Practice-completion artifact, not a professional license</text></g></svg>`;
}
