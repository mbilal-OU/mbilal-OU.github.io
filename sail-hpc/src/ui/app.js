import { normalizeJobSpec } from "../core/job-spec.js";
import { parseWalltimeToSeconds, formatWalltimeSeconds, formatMemoryMB } from "../core/units.js";
import { parseSlurmScript } from "../slurm/parser.js";
import { generateSlurmScript } from "../slurm/generator.js";
import { SimulationEngine } from "../simulation/engine.js";
import { JOB_STATES } from "../simulation/state-machine.js";
import {
  getScientificScenario,
  listScientificScenarios,
  SCIENTIFIC_SCENARIO_SET_VERSION,
} from "../scenarios/scientific-scenarios.js";
import {
  TRAINING_CLUSTER_NODES,
  TRAINING_CLUSTER_POLICY,
  TRAINING_CLUSTER_VERSION,
} from "../scenarios/training-cluster.js";

const APP_VERSION = "1.0.0-rc1";
const $ = (id) => document.getElementById(id);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const TERMINAL_STATES = new Set([
  JOB_STATES.COMPLETED,
  JOB_STATES.CANCELLED,
  JOB_STATES.OUT_OF_MEMORY,
  JOB_STATES.TIMEOUT,
  JOB_STATES.FAILED,
]);

let engine = newEngine();
let currentScenario = getScientificScenario("alignment-oom-v1");
let selectedJobId = null;
let revisionParentJobId = null;
let importedSpec = null;
let currentRoute = "home";
let tutorialIndex = 0;
let assessmentSessionActive = false;
let assessmentPendingJobId = null;
let certificateData = null;

const tutorialProgress = new Set(readJSON("sail-hpc-tutorial-progress", []));
const assessmentState = readJSON("sail-hpc-assessment", {
  completed: {},
  evidence: {},
});

const SCENARIO_META = Object.freeze({
  "script-wrapper-v1": { domain: "General HPC", difficulty: "Beginner", concepts: ["pipeline", "basic"] },
  "fastq-qc-array-v1": { domain: "Bioinformatics", difficulty: "Beginner", concepts: ["array", "parallelism"] },
  "rna-seq-dependency-v1": { domain: "Bioinformatics", difficulty: "Intermediate", concepts: ["dependency", "workflow"] },
  "alignment-oom-v1": { domain: "Bioinformatics", difficulty: "Beginner", concepts: ["memory", "failure"] },
  "bacterial-pangenome-v1": { domain: "Genomics", difficulty: "Intermediate", concepts: ["memory", "cpu"] },
  "phylogeny-threading-v1": { domain: "Genomics", difficulty: "Intermediate", concepts: ["cpu", "walltime"] },
  "gpu-md-v1": { domain: "Molecular simulation", difficulty: "Intermediate", concepts: ["gpu", "placement"] },
  "walltime-timeout-v1": { domain: "General HPC", difficulty: "Beginner", concepts: ["walltime", "failure"] },
  "overrequest-rightsize-v1": { domain: "General HPC", difficulty: "Intermediate", concepts: ["accounting", "right-sizing"] },
});

const COMMAND_GROUPS = Object.freeze([
  { title: "Discover", commands: [
    { command: "sinfo", purpose: "Show training partitions and resource availability." },
    { command: "squeue", purpose: "Show active jobs and pending reasons." },
  ] },
  { title: "Submit", commands: [
    { command: "sbatch current", purpose: "Submit the current canonical JobSpec." },
  ] },
  { title: "Inspect", commands: [
    { command: "scontrol show job <jobid>", purpose: "Inspect one modeled job in detail." },
    { command: "sacct", purpose: "Review terminal states and synthetic accounting." },
    { command: "seff <jobid>", purpose: "Review deterministic efficiency-style feedback." },
  ] },
  { title: "Control", commands: [
    { command: "scontrol hold <jobid>", purpose: "Hold a pending job." },
    { command: "scontrol release <jobid>", purpose: "Release a held pending job." },
    { command: "scancel <jobid>", purpose: "Cancel a pending or running modeled job." },
  ] },
]);

const TUTORIALS = Object.freeze([
  lesson("What is an HPC cluster?", "An HPC cluster combines many compute nodes behind a shared access environment. You usually log in to a login node, prepare work there, and ask a scheduler to place compute-heavy work on compute nodes.", "sinfo", "Inspect the training cluster and identify its partitions.", "PARTITION  NODES  CPU(A/T)  MEMORY_GB(A/T)\nshort      ...    ...       ...\ncompute    ...    ...       ...", "The cluster you eventually use will have its own names, limits, accounts and policies."),
  lesson("Login node vs compute node", "The login node is for editing, compiling, light inspection and submitting jobs. Heavy analysis belongs on scheduled compute resources so one user does not disrupt everyone else.", "squeue", "Inspect the current queue instead of starting heavy work directly on a login node.", "JOBID  PARTITION  NAME  STATE  NODELIST(REASON)", "A real institution may enforce login-node limits differently. Always read local policy."),
  lesson("What Slurm does", "Slurm accepts a resource request, tracks job state, allocates resources and records accounting information. A batch script combines resource directives with the command you want to run.", "help", "Open the focused command help and identify the submission command.", "Supported commands include sinfo, squeue, sbatch current, sacct, seff, scontrol and scancel.", "SAIL-HPC implements a deliberately narrow educational subset rather than full Slurm."),
  lesson("Partitions and resources", "A partition groups compute resources under a site policy. Your job requests CPU, memory, walltime and, where relevant, GPU resources from a partition.", "sinfo", "Inspect available partitions and their current resource state.", "PARTITION  NODES  CPU(A/T)  MEMORY_GB(A/T)  GPU(A/T)", "Your account may have access to only some partitions on a real cluster."),
  lesson("Your first batch script", "A Slurm batch script is ordinary shell text plus #SBATCH directives. Keep the command visible and editable so you understand exactly what will run.", "sbatch current", "Build a small job in the Builder, then return here and submit the current JobSpec.", "Submitted current JobSpec.", "The Builder teaches the script; it does not replace knowing what the script contains."),
  lesson("Modules and Conda", "Scheduler resources and software environments are separate concerns. A valid job must request resources and also load or activate the software environment needed by the command.", "help", "Review the environment guidance in your pipeline or scenario before submission.", "Environment configuration remains site-dependent.", "Module names and Conda setup vary by institution and must be adapted before real use."),
  lesson("Monitor a job", "Use queue and job-inspection tools to determine whether work is pending, running or complete rather than guessing from elapsed time.", "squeue", "Inspect active jobs and their state reasons.", "JOBID  PARTITION  NAME  STATE  NODELIST(REASON)", "Pending is not automatically an error. The reason matters."),
  lesson("Why jobs stay pending", "A job can wait because resources are unavailable, a dependency is not ready, the job is held, or another modeled constraint blocks scheduling.", "scontrol show job <jobid>", "Inspect a pending job and read its reason field.", "JobId=... State=PENDING Reason=Resources", "Real Slurm has many more pending reasons and priority factors than SAIL-HPC models."),
  lesson("Job arrays", "Arrays represent many similar tasks with one job definition. A concurrency cap such as %2 limits how many array tasks can run at the same time.", "squeue", "Open the FASTQ array scenario, submit it, and observe how concurrency changes the queue.", "Array tasks appear as individual modeled records while the parent summarizes progress.", "SAIL-HPC materializes educational task records immediately; real Slurm's internal record creation differs."),
  lesson("Dependencies", "Dependencies connect workflow stages. In the supported subset, afterok waits for success, afterany waits for termination, and afternotok waits for a failed upstream outcome.", "scontrol show job <jobid>", "Inspect a job waiting on a dependency and identify the dependency reason.", "State=PENDING Reason=Dependency", "The real Slurm dependency language is broader than the single-expression subset modeled here."),
  lesson("OOM and TIMEOUT", "OUT_OF_MEMORY and TIMEOUT are different failure classes. Diagnose the evidence first, then revise only the resource that explains the failure.", "sacct", "Run a failure scenario and inspect its terminal state before revising it.", "JOBID  STATE          ELAPSED  MAXRSS  CPU_EFF\n...    OUT_OF_MEMORY  ...      ...     ...", "SAIL-HPC uses deterministic workload models. Synthetic accounting is not measured performance."),
  lesson("Accounting and revision", "Post-run accounting can guide the next request. Right-sizing is not the same as requesting the maximum possible resources.", "seff <jobid>", "Inspect one completed job, then compare requested resources with modeled utilization.", "CPU Efficiency: ...\nMemory Efficiency: ...\nNOTE: Synthetic pedagogical accounting", "On a real cluster, use site-supported accounting and actual logs rather than SAIL-HPC estimates."),
  lesson("Moving to a real cluster", "Transfer means taking the ordinary Slurm script and adapting it to the target institution. Re-check partitions, accounts/QOS, modules, storage paths, software versions and limits before submitting a small real test.", "sinfo", "Before real submission, identify which values in your script are site-specific.", "Check local documentation before the first real job.", "A 100% SAIL-HPC practice score is a transfer-readiness checkpoint, not a universal professional credential."),
]);

const ASSESSMENT_TASKS = Object.freeze([
  { id: "orientation", title: "Cluster orientation", points: 10, description: "Inspect available training partitions and resources without command-card hints.", action: "Open terminal task" },
  { id: "submitMonitor", title: "Submit and monitor", points: 15, description: "Submit a valid basic job and inspect its state.", action: "Open Builder" },
  { id: "resource", title: "Resource reasoning", points: 20, description: "Right-size the provided workload to ≤4 CPU, ≤16 GB memory and ≤30 minutes, then complete it.", action: "Open resource task" },
  { id: "pending", title: "Pending-job diagnosis", points: 10, description: "Inspect a prepared pending job and determine why it cannot start.", action: "Open pending task" },
  { id: "failure", title: "Failure diagnosis", points: 20, description: "Produce a modeled OOM, diagnose it, revise the same job without the guided-answer button, and complete the revision.", action: "Open OOM task" },
  { id: "array", title: "Arrays and dependencies", points: 15, description: "Complete the sample-parallel array scenario while preserving its concurrency cap.", action: "Open array task" },
  { id: "transfer", title: "Real-cluster transfer", points: 10, description: "Identify the values that must be rechecked against the real institution before submission.", action: "Open transfer check" },
]);

boot();

function boot() {
  bindRouting();
  bindGlobalControls();
  bindBuilder();
  bindTerminal();
  bindTutorial();
  bindAssessment();
  bindCertificate();
  populateScenarioSelect();
  renderHomeScenarios();
  renderScenarioExplorer();
  renderCommandCatalog();
  loadScenario(currentScenario.id);
  renderTutorial();
  renderAssessment();
  renderAll();
  terminalPrint("SAIL-HPC deterministic training environment ready.");
  terminalPrint("Type help for the publication-supported command subset.");
  const initial = location.hash.replace(/^#\/?/, "");
  route(validRoute(initial) ? initial : "home", { updateHash: false });
}

function bindRouting() {
  document.addEventListener("click", (event) => {
    const button = event.target.closest("[data-route]");
    if (!button) return;
    event.preventDefault();
    route(button.dataset.route);
  });
  addEventListener("hashchange", () => {
    const name = location.hash.replace(/^#\/?/, "");
    if (validRoute(name)) route(name, { updateHash: false });
  });
}

function bindGlobalControls() {
  $("help-button")?.addEventListener("click", () => $("help-dialog")?.showModal());
  $("model-boundary-button")?.addEventListener("click", () => $("help-dialog")?.showModal());
  $("workspace-reset")?.addEventListener("click", () => {
    if (currentRoute === "practice") clearTerminal();
    else if (currentRoute === "observe") resetSimulation();
    else if (currentRoute === "learn") { tutorialIndex = 0; renderTutorial(); }
    else if (currentRoute === "assessment") resetAssessment();
    else route("home");
  });
}

function route(name, { updateHash = true } = {}) {
  if (!validRoute(name)) name = "home";
  currentRoute = name;
  for (const view of $$('[data-view]')) view.hidden = view.dataset.view !== name;
  const bar = $("workspace-bar");
  bar.hidden = name === "home";
  $("workspace-title").textContent = routeTitle(name);
  if (updateHash) history.replaceState(null, "", `#/${name}`);
  if (name === "practice") {
    const catalog = $("command-catalog")?.closest(".command-catalog-panel");
    if (catalog) catalog.hidden = assessmentSessionActive;
    setTimeout(() => $("terminal-input")?.focus(), 0);
  }
  if (name === "assessment") renderAssessment();
  if (name === "observe") renderAll();
  scrollTo({ top: 0, behavior: "smooth" });
}

function validRoute(name) {
  return ["home", "pipeline", "learn", "practice", "scenarios", "builder", "observe", "assessment", "certificate"].includes(name);
}

function routeTitle(name) {
  return ({
    pipeline: "My pipeline",
    learn: "Guided beginner path",
    practice: assessmentSessionActive ? "Assessment terminal" : "Terminal practice",
    scenarios: "Scientific scenarios",
    builder: assessmentSessionActive ? "Assessment Builder" : "Slurm Builder",
    observe: "Observe & Diagnose",
    assessment: "100-point transfer check",
    certificate: "Practice-completion certificate",
  })[name] || "SAIL-HPC";
}

function newEngine() {
  return new SimulationEngine({
    nodes: TRAINING_CLUSTER_NODES,
    clusterPolicy: TRAINING_CLUSTER_POLICY,
    firstJobId: 73001,
  });
}

function populateScenarioSelect() {
  const select = $("scenario-select");
  select.replaceChildren();
  for (const scenario of listScientificScenarios()) {
    const option = document.createElement("option");
    option.value = scenario.id;
    option.textContent = scenario.title;
    select.appendChild(option);
  }
  select.value = currentScenario.id;
}

function renderHomeScenarios() {
  const target = $("home-scenarios");
  target.replaceChildren();
  const featured = ["alignment-oom-v1", "fastq-qc-array-v1", "rna-seq-dependency-v1", "bacterial-pangenome-v1", "gpu-md-v1", "walltime-timeout-v1"];
  for (const id of featured) {
    let scenario;
    try { scenario = getScientificScenario(id); } catch { continue; }
    const meta = SCENARIO_META[id] || {};
    const button = document.createElement("button");
    button.type = "button";
    button.className = "scenario-mini";
    const strong = document.createElement("strong");
    strong.textContent = scenario.title;
    const span = document.createElement("span");
    span.textContent = `${meta.domain || "Scientific HPC"} · ${meta.difficulty || "Practice"}`;
    button.append(strong, span);
    button.addEventListener("click", () => openScenario(id));
    target.appendChild(button);
  }
}

function renderScenarioExplorer(filter = "all") {
  const filters = $("scenario-filters");
  filters.replaceChildren();
  const filterNames = ["all", "beginner", "intermediate", "failure", "array", "dependency", "gpu", "bioinformatics"];
  for (const name of filterNames) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `filter-chip${filter === name ? " active" : ""}`;
    button.textContent = titleCase(name);
    button.addEventListener("click", () => renderScenarioExplorer(name));
    filters.appendChild(button);
  }

  const grid = $("scenario-grid");
  grid.replaceChildren();
  for (const scenario of listScientificScenarios()) {
    const meta = SCENARIO_META[scenario.id] || { domain: "Scientific HPC", difficulty: "Practice", concepts: [] };
    const searchable = [meta.domain, meta.difficulty, ...meta.concepts].join(" ").toLowerCase();
    if (filter !== "all" && !searchable.includes(filter)) continue;
    const card = document.createElement("article");
    card.className = "scenario-card";
    const tags = document.createElement("div");
    tags.className = "meta";
    for (const value of [meta.domain, meta.difficulty, ...meta.concepts.slice(0, 2)]) {
      const tag = document.createElement("span");
      tag.className = "tag";
      tag.textContent = value;
      tags.appendChild(tag);
    }
    const h2 = document.createElement("h2");
    h2.textContent = scenario.title;
    const p = document.createElement("p");
    p.textContent = scenario.learningObjective;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "primary";
    button.textContent = "Open scenario →";
    button.addEventListener("click", () => openScenario(scenario.id));
    card.append(tags, h2, p, button);
    grid.appendChild(card);
  }
}

function openScenario(id) {
  assessmentSessionActive = false;
  loadScenario(id);
  route("builder");
}

function bindBuilder() {
  $("scenario-select")?.addEventListener("change", () => loadScenario($("scenario-select").value));
  for (const id of ["job-name", "partition", "cpus", "memory-gb", "walltime", "gpus", "array-spec", "dependency", "modules", "builder-conda", "working-directory", "command-block", "modeled-runtime", "modeled-peak-memory"]) {
    $(id)?.addEventListener("input", renderPreview);
    $(id)?.addEventListener("change", renderPreview);
  }
  $("test-job")?.addEventListener("click", submitBuilderJob);
  $("advance-60")?.addEventListener("click", () => advanceSimulation(60));
  $("advance-600")?.addEventListener("click", () => advanceSimulation(600));
  $("run-long")?.addEventListener("click", () => advanceSimulation(100000));
  $("reset-simulation")?.addEventListener("click", resetSimulation);
  $("load-selected")?.addEventListener("click", loadSelectedIntoBuilder);
  $("apply-revision")?.addEventListener("click", applyRevision);
  $("diagnose-revise")?.addEventListener("click", () => { loadSelectedIntoBuilder(); route("builder"); });
  $("copy-script")?.addEventListener("click", copyScript);
  $("download-script")?.addEventListener("click", downloadScript);
  $("download-record")?.addEventListener("click", downloadRecord);
  $("import-script")?.addEventListener("click", importScript);
}

function loadScenario(id) {
  currentScenario = getScientificScenario(id);
  importedSpec = null;
  revisionParentJobId = null;
  writeSpecToBuilder(currentScenario.spec);
  $("modeled-runtime").value = currentScenario.workload.modeledRuntimeSeconds;
  $("modeled-peak-memory").value = round2((currentScenario.workload.peakMemoryMB ?? currentScenario.spec.memoryMB * 0.62) / 1024);
  $("scenario-objective").textContent = currentScenario.learningObjective;
  $("scenario-boundary").textContent = "Resource values are pedagogical scenario parameters, not recommendations for a production cluster.";
  $("scenario-select").value = currentScenario.id;
  renderPreview();
}

function writeSpecToBuilder(spec) {
  $("job-name").value = spec.jobName || "job";
  $("partition").value = spec.partition || "short";
  $("cpus").value = spec.cpusPerTask || 1;
  $("memory-gb").value = round2((spec.memoryMB || 1024) / 1024);
  $("walltime").value = formatWalltimeSeconds(spec.walltimeSeconds || 1800);
  $("gpus").value = spec.gpus || 0;
  $("array-spec").value = spec.array?.specification || "";
  $("dependency").value = spec.dependency?.raw || "";
  $("modules").value = (spec.modules || []).join(", ");
  $("working-directory").value = spec.workingDirectory || "";
  $("command-block").value = spec.commandBlock || "";
  $("builder-conda").value = spec.provenance?.condaEnvironment || "";
}

function readBuilderSpec() {
  const base = importedSpec ? { ...importedSpec } : { ...currentScenario.spec };
  const parent = revisionParentJobId ? engine.getJob(revisionParentJobId) : null;
  const lineage = parent?.spec?.revisionLineage ? [...parent.spec.revisionLineage, revisionParentJobId] : (revisionParentJobId ? [revisionParentJobId] : []);
  const conda = $("builder-conda").value.trim();
  let commandBlock = $("command-block").value.trimEnd();
  if (conda && !/conda activate\s+/i.test(commandBlock)) {
    commandBlock = `source ~/.bashrc\nconda activate ${conda}\n${commandBlock}`;
  }
  return normalizeJobSpec({
    ...base,
    jobName: $("job-name").value.trim() || "job",
    partition: $("partition").value,
    nodes: 1,
    ntasks: 1,
    cpusPerTask: integer($("cpus").value, "CPU / cores"),
    memoryMB: Math.round(number($("memory-gb").value, "Memory") * 1024),
    walltimeSeconds: parseWalltimeToSeconds($("walltime").value),
    gpus: nonNegativeInteger($("gpus").value, "GPUs"),
    array: $("array-spec").value.trim() ? { specification: $("array-spec").value.trim() } : null,
    dependency: $("dependency").value.trim() ? { raw: $("dependency").value.trim() } : null,
    modules: $("modules").value.split(",").map((value) => value.trim()).filter(Boolean),
    workingDirectory: $("working-directory").value.trim() || null,
    commandBlock,
    revisionLineage: lineage,
    provenance: {
      ...(base.provenance || {}),
      source: importedSpec ? "imported-script" : "builder",
      scenarioId: currentScenario.id,
      parentJobId: revisionParentJobId,
      condaEnvironment: conda || null,
    },
  });
}

function readWorkload() {
  return {
    ...currentScenario.workload,
    modeledRuntimeSeconds: number($("modeled-runtime").value, "Modeled runtime"),
    peakMemoryMB: Math.round(number($("modeled-peak-memory").value, "Modeled peak memory") * 1024),
  };
}

function renderPreview() {
  try {
    const spec = readBuilderSpec();
    $("script-preview").textContent = generateSlurmScript(spec);
    $("builder-validation").textContent = `Valid JobSpec · ${spec.ntasks * spec.cpusPerTask} CPU · ${formatMemoryMB(spec.memoryMB)} · ${formatWalltimeSeconds(spec.walltimeSeconds)}`;
    $("builder-validation").dataset.status = "ok";
    renderBuilderResourceSummary(spec);
  } catch (error) {
    $("script-preview").textContent = "# Fix the validation error to generate a script.";
    $("builder-validation").textContent = error.message;
    $("builder-validation").dataset.status = "error";
    $("builder-resource-summary").replaceChildren();
  }
}

function renderBuilderResourceSummary(spec) {
  const target = $("builder-resource-summary");
  target.replaceChildren();
  for (const [label, value] of [
    ["Partition", spec.partition],
    ["CPU", `${spec.ntasks * spec.cpusPerTask} cores`],
    ["Memory", formatMemoryMB(spec.memoryMB)],
    ["Walltime", formatWalltimeSeconds(spec.walltimeSeconds)],
  ]) {
    const span = document.createElement("span");
    const small = document.createElement("small");
    small.textContent = label;
    const strong = document.createElement("strong");
    strong.textContent = value;
    span.append(small, strong);
    target.appendChild(span);
  }
}

function submitBuilderJob() {
  try {
    const spec = readBuilderSpec();
    const submitted = engine.submit(spec, readWorkload());
    selectedJobId = submitted.id;
    revisionParentJobId = null;
    if (assessmentSessionActive) assessmentState.evidence.submitted = true;
    evaluateAssessmentEvidence();
    renderAll();
    announce(`Submitted ${submitted.isArray ? "array" : "job"} ${submitted.id}. Current state: ${submitted.state}.`);
    route("observe");
  } catch (error) {
    announce(error.message, true);
  }
}

function advanceSimulation(seconds) {
  try {
    engine.advance(seconds);
    renderAll();
    evaluateAssessmentEvidence();
    announce(`Advanced deterministic simulation by ${seconds} seconds.`);
  } catch (error) {
    announce(error.message, true);
  }
}

function resetSimulation() {
  engine = newEngine();
  selectedJobId = null;
  revisionParentJobId = null;
  assessmentPendingJobId = null;
  renderAll();
  announce("Simulation reset to the versioned training-cluster baseline.");
  terminalPrint("Simulation reset.");
}

function renderAll() {
  renderMetrics();
  renderQueue();
  renderArrays();
  renderNodes();
  renderDiagnosis();
  renderRevisionComparison();
  evaluateAssessmentEvidence();
}

function renderMetrics() {
  const snapshot = engine.snapshot();
  const nodes = snapshot.resources.nodes;
  const totals = nodes.reduce((acc, node) => {
    acc.cpus += node.cpus; acc.usedCpus += node.allocatedCpus;
    acc.memory += node.memoryMB; acc.usedMemory += node.allocatedMemoryMB;
    acc.gpus += node.gpus; acc.usedGpus += node.allocatedGpus;
    return acc;
  }, { cpus: 0, usedCpus: 0, memory: 0, usedMemory: 0, gpus: 0, usedGpus: 0 });
  const jobs = snapshot.jobs;
  const running = jobs.filter((job) => job.state === JOB_STATES.RUNNING).length;
  const pending = jobs.filter((job) => job.state === JOB_STATES.PENDING).length;
  $("clock-value").textContent = `${snapshot.clock.nowSeconds}s`;
  $("running-value").textContent = String(running);
  $("pending-value").textContent = String(pending);
  $("cpu-value").textContent = `${totals.usedCpus}/${totals.cpus}`;
  $("memory-value").textContent = `${round1(totals.usedMemory / 1024)}/${round1(totals.memory / 1024)} GB`;
  $("gpu-value").textContent = `${totals.usedGpus}/${totals.gpus}`;
  $("gpu-metric").hidden = totals.gpus === 0;
  $("jobs-value").textContent = `${running} R · ${pending} PD`;
}

function renderQueue() {
  const target = $("queue-body");
  target.replaceChildren();
  const jobs = engine.listJobs();
  $("queue-empty").hidden = jobs.length > 0;
  $("queue-wrap").hidden = jobs.length === 0;
  for (const job of jobs) {
    const row = document.createElement("tr");
    if (job.id === selectedJobId) row.classList.add("selected-row");
    row.appendChild(cellButton(job.id, () => selectJob(job.id)));
    row.appendChild(cell(job.spec.jobName));
    row.appendChild(cell(job.state));
    row.appendChild(cell(job.stateReason || "—"));
    row.appendChild(cell(String(job.spec.ntasks * job.spec.cpusPerTask)));
    row.appendChild(cell(formatMemoryMB(job.spec.memoryMB)));
    row.appendChild(cell(job.allocation?.nodeId || "—"));
    target.appendChild(row);
  }
}

function renderArrays() {
  const target = $("array-summary");
  target.replaceChildren();
  const arrays = engine.listArrays();
  target.hidden = arrays.length === 0;
  for (const array of arrays) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "array-chip";
    button.textContent = `${array.id} [${array.specification}] · ${array.state} · ${formatCounts(array.counts)}`;
    button.addEventListener("click", () => selectJob(array.id));
    target.appendChild(button);
  }
}

function renderNodes() {
  const target = $("node-cards");
  target.replaceChildren();
  for (const node of engine.snapshot().resources.nodes) {
    const card = document.createElement("article");
    card.className = "node-card";
    const strong = document.createElement("strong"); strong.textContent = node.id;
    const span = document.createElement("span");
    span.textContent = `${node.partition} · CPU ${node.allocatedCpus}/${node.cpus} · RAM ${round1(node.allocatedMemoryMB / 1024)}/${round1(node.memoryMB / 1024)} GB${node.gpus ? ` · GPU ${node.allocatedGpus}/${node.gpus}` : ""}`;
    card.append(strong, span); target.appendChild(card);
  }
}

function selectJob(id) {
  selectedJobId = String(id);
  renderAll();
}

function renderDiagnosis() {
  const target = $("diagnosis");
  const accounting = $("accounting");
  target.replaceChildren();
  accounting.replaceChildren();
  if (!selectedJobId) {
    target.textContent = "Select a job to understand its modeled outcome.";
    accounting.textContent = "Synthetic accounting appears after a job reaches a terminal state.";
    return;
  }
  const job = engine.getJob(selectedJobId);
  if (!job) { target.textContent = "Selected job no longer exists."; return; }
  if (job.isArray) {
    const h3 = document.createElement("h3"); h3.textContent = `Array ${job.id}`;
    const p = document.createElement("p"); p.textContent = `${job.state}. ${formatCounts(job.counts)}. Concurrency cap: ${job.concurrencyLimit ?? "none"}.`;
    target.append(h3, p);
    const terminalAccounting = engine.getAccounting(job.id).filter((entry) => entry.accounting);
    accounting.textContent = terminalAccounting.length ? `${terminalAccounting.length}/${job.taskIds.length} tasks have synthetic pedagogical accounting records.` : "No terminal array-task accounting yet.";
    return;
  }

  const h3 = document.createElement("h3");
  h3.textContent = `${job.spec.jobName} · ${job.state}`;
  h3.className = TERMINAL_STATES.has(job.state) && job.state !== JOB_STATES.COMPLETED ? "state-bad" : job.state === JOB_STATES.COMPLETED ? "state-good" : "";
  const what = document.createElement("p");
  what.textContent = diagnosisFor(job);
  target.append(h3, what);

  if (job.accounting) {
    accounting.textContent = `${job.accounting.label}: elapsed ${job.accounting.elapsedSeconds}s · CPU efficiency ${job.accounting.cpuEfficiencyPct}% · modeled MaxRSS ${formatMemoryMB(job.accounting.modeledMaxRSSMB)} · memory use/request ${job.accounting.memoryEfficiencyPct}% · exit ${job.accounting.exitCode}. These values are modeled, not measurements.`;
  } else {
    accounting.textContent = "No accounting record yet. Accounting is generated deterministically only when the job terminates.";
  }
}

function diagnosisFor(job) {
  if (job.state === JOB_STATES.OUT_OF_MEMORY) return `What happened: modeled OUT_OF_MEMORY. ${job.stateReason}. Compare the requested memory with the scenario requirement, then revise the same job.`;
  if (job.state === JOB_STATES.TIMEOUT) return `What happened: modeled TIMEOUT. ${job.stateReason}. Compare modeled runtime with requested walltime before revising.`;
  if (job.state === JOB_STATES.PENDING) {
    if (/DependencyNeverSatisfied/.test(job.stateReason || "")) return `Pending because the supported dependency condition cannot become true: ${job.stateReason}.`;
    if (/Dependency/.test(job.stateReason || "")) return `Pending on a dependency: ${job.stateReason}. Inspect the upstream job before changing resources.`;
    if (job.stateReason === "JobHeldUser") return "Pending because the job is held. A real Slurm site may expose different hold/priority semantics.";
    if (job.stateReason === "ArrayTaskLimit") return "Pending because the array concurrency cap is already occupied.";
    return `Pending: ${job.stateReason || "scheduler decision"}. The training cluster currently lacks a fitting free allocation.`;
  }
  if (job.state === JOB_STATES.RUNNING) return `Running on ${job.allocation?.nodeId || "a training node"}. Advance deterministic time to observe the modeled outcome.`;
  if (job.state === JOB_STATES.COMPLETED) return "Completed in the modeled environment. Review synthetic accounting and compare the request with the modeled workload before deciding whether a revision is useful.";
  if (job.state === JOB_STATES.CANCELLED) return "Cancelled. Resources were released exactly once and newly eligible pending work was rescheduled.";
  return `${job.state}: ${job.stateReason || "modeled outcome"}.`;
}

function renderRevisionComparison() {
  const target = $("revision-comparison");
  target.replaceChildren();
  target.hidden = true;
  if (!selectedJobId) return;
  const revised = engine.getJob(selectedJobId);
  if (!revised || revised.isArray || !revised.spec?.revisionLineage?.length) return;
  const originalId = revised.spec.revisionLineage[revised.spec.revisionLineage.length - 1];
  const original = engine.getJob(originalId);
  if (!original || original.isArray) return;
  target.hidden = false;
  const h3 = document.createElement("h3"); h3.textContent = "Original vs revised";
  const grid = document.createElement("div"); grid.className = "comparison-grid";
  grid.append(comparisonSide(`Original ${original.id}`, original), textNode("→"), comparisonSide(`Revised ${revised.id}`, revised));
  target.append(h3, grid);
}

function comparisonSide(title, job) {
  const box = document.createElement("div"); box.className = "comparison-side";
  const strong = document.createElement("strong"); strong.textContent = title;
  const dl = document.createElement("dl");
  for (const [label, value] of [["CPU", job.spec.ntasks * job.spec.cpusPerTask], ["Memory", formatMemoryMB(job.spec.memoryMB)], ["Walltime", formatWalltimeSeconds(job.spec.walltimeSeconds)], ["Outcome", job.state]]) {
    const dt = document.createElement("dt"); dt.textContent = label;
    const dd = document.createElement("dd"); dd.textContent = String(value);
    dl.append(dt, dd);
  }
  box.append(strong, dl); return box;
}

function loadSelectedIntoBuilder() {
  if (!selectedJobId) return announce("Select a job first.", true);
  const selected = engine.getJob(selectedJobId);
  const sourceJob = selected?.isArray ? selected.tasks[0] : selected;
  if (!sourceJob?.spec) return announce("This selection cannot be loaded into the Builder.", true);
  importedSpec = null;
  revisionParentJobId = selectedJobId;
  writeSpecToBuilder(sourceJob.spec);
  if (sourceJob.spec.provenance?.scenarioId) {
    try { currentScenario = getScientificScenario(sourceJob.spec.provenance.scenarioId); $("scenario-select").value = currentScenario.id; } catch { /* custom imported job */ }
  }
  renderPreview();
  announce(`Loaded job ${selectedJobId} into the Builder as a revision parent.`);
}

function applyRevision() {
  if (assessmentSessionActive) return announce("Guided revisions are disabled during the independent assessment.", true);
  if (!selectedJobId) return announce("Select a job before applying a modeled revision.", true);
  const selected = engine.getJob(selectedJobId);
  const sourceJob = selected?.isArray ? selected.tasks[0] : selected;
  if (!sourceJob?.spec) return announce("Selected item has no JobSpec.", true);
  let scenario;
  try { scenario = getScientificScenario(sourceJob.spec.provenance?.scenarioId || currentScenario.id); } catch { scenario = currentScenario; }
  loadSelectedIntoBuilder();
  if (scenario.revision) writeSpecToBuilder({ ...sourceJob.spec, ...scenario.revision });
  else if (sourceJob.state === JOB_STATES.OUT_OF_MEMORY) $("memory-gb").value = round2((sourceJob.spec.memoryMB * 1.5) / 1024);
  else if (sourceJob.state === JOB_STATES.TIMEOUT) $("walltime").value = formatWalltimeSeconds(sourceJob.spec.walltimeSeconds * 2);
  renderPreview();
  announce("Guided revision loaded. Inspect the changed request before resubmitting.");
}

function importScript() {
  try {
    const parsed = parseSlurmScript($("import-text").value, { source: "imported-script", scenarioId: currentScenario.id, parentJobId: null });
    importedSpec = parsed;
    revisionParentJobId = null;
    writeSpecToBuilder(parsed);
    renderPreview();
    announce(`Imported Slurm script. ${parsed.unparsedDirectives.length} unsupported directive(s) preserved.`);
  } catch (error) { announce(error.message, true); }
}

async function copyScript() {
  try { await navigator.clipboard.writeText(generateSlurmScript(readBuilderSpec())); announce("Slurm script copied to clipboard."); }
  catch (error) { announce(`Could not copy script: ${error.message}`, true); }
}

function downloadScript() {
  try { const spec = readBuilderSpec(); downloadText(`${safeFilename(spec.jobName)}.sh`, generateSlurmScript(spec), "text/x-shellscript"); announce("Exported ordinary editable Slurm script."); }
  catch (error) { announce(error.message, true); }
}

function downloadRecord() {
  const record = engine.exportRecord({ software: "SAIL-HPC", softwareVersion: APP_VERSION, trainingClusterVersion: TRAINING_CLUSTER_VERSION, scenarioSetVersion: SCIENTIFIC_SCENARIO_SET_VERSION });
  record.replayVerified = SimulationEngine.verifyRecord(record);
  downloadText("sail-hpc-simulation-record.json", JSON.stringify(record, null, 2), "application/json");
  announce(`Exported deterministic simulation record. Replay verification: ${record.replayVerified ? "PASS" : "FAIL"}.`);
}

function bindTerminal() {
  $("terminal-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const command = $("terminal-input").value.trim();
    if (!command) return;
    terminalPrint(`student@sail-login:~$ ${command}`, "command");
    $("terminal-input").value = "";
    runTerminalCommand(command);
  });
  $("terminal-clear")?.addEventListener("click", clearTerminal);
}

function renderCommandCatalog() {
  const target = $("command-catalog");
  target.replaceChildren();
  for (const group of COMMAND_GROUPS) {
    const section = document.createElement("section"); section.className = "command-group";
    const h3 = document.createElement("h3"); h3.textContent = group.title;
    section.appendChild(h3);
    for (const item of group.commands) {
      const card = document.createElement("div"); card.className = "command-card";
      const code = document.createElement("code"); code.textContent = item.command;
      const button = document.createElement("button"); button.type = "button"; button.textContent = "Insert";
      button.addEventListener("click", () => insertTerminalCommand(item.command.replace("<jobid>", selectedJobId || "73001")));
      const p = document.createElement("p"); p.textContent = item.purpose;
      card.append(code, button, p); section.appendChild(card);
    }
    target.appendChild(section);
  }
}

function insertTerminalCommand(command) {
  route("practice");
  $("terminal-input").value = command;
  $("terminal-input").focus();
}

function runTerminalCommand(command) {
  const parts = command.match(/"([^"]*)"|'([^']*)'|([^\s]+)/g)?.map((token) => token.replace(/^['"]|['"]$/g, "")) || [];
  const verb = (parts[0] || "").toLowerCase();
  try {
    if (verb === "sinfo") { terminalSinfo(); markAssessmentEvidence("sinfo"); return; }
    if (verb === "squeue") { terminalSqueue(); markAssessmentEvidence("squeue"); return; }
    if (verb === "sacct") { terminalSacct(); markAssessmentEvidence("sacct"); return; }
    if (verb === "sbatch" && parts[1] === "current") { submitBuilderJob(); terminalPrint(`Submitted current JobSpec. Selected job: ${selectedJobId}.`); return; }
    if (verb === "seff" && parts[1]) { terminalSeff(parts[1]); markAssessmentEvidence("inspect", parts[1]); return; }
    if (verb === "scancel" && parts[1]) { engine.cancel(parts[1]); renderAll(); terminalPrint(`Cancelled ${parts[1]}.`); return; }
    if (verb === "scontrol" && parts[1] === "hold" && parts[2]) { engine.hold(parts[2]); renderAll(); terminalPrint(`Held ${parts[2]}.`); return; }
    if (verb === "scontrol" && parts[1] === "release" && parts[2]) { engine.release(parts[2]); renderAll(); terminalPrint(`Released ${parts[2]}.`); return; }
    if (verb === "scontrol" && parts[1] === "show" && parts[2] === "job" && parts[3]) { terminalShowJob(parts[3]); markAssessmentEvidence("inspect", parts[3]); return; }
    if (verb === "advance" && parts[1]) { advanceSimulation(number(parts[1], "advance seconds")); terminalPrint(`Clock is now ${engine.snapshot().clock.nowSeconds}s.`); return; }
    if (verb === "whoami") { terminalPrint("student"); return; }
    if (verb === "pwd") { terminalPrint("/home/student"); return; }
    if (verb === "help") { terminalPrint("Supported scheduler subset: sinfo, squeue, sbatch current, sacct, seff <jobid>, scontrol show job <jobid>, scontrol hold <jobid>, scontrol release <jobid>, scancel <jobid>, advance <seconds>. Shell helpers: whoami, pwd. This is not complete Slurm or a real shell."); return; }
    terminalPrint(`Unsupported command '${command}'. Type help for the publication-supported subset.`, "error");
  } catch (error) { terminalPrint(error.message, "error"); }
}

function terminalSinfo() {
  const lines = ["PARTITION NODES CPU(A/T) MEMORY_GB(A/T) GPU(A/T)"];
  const byPartition = new Map();
  for (const node of engine.snapshot().resources.nodes) { if (!byPartition.has(node.partition)) byPartition.set(node.partition, []); byPartition.get(node.partition).push(node); }
  for (const [partition, nodes] of byPartition) {
    const sums = nodes.reduce((a, n) => ({ cpuA: a.cpuA+n.allocatedCpus, cpuT:a.cpuT+n.cpus, memA:a.memA+n.allocatedMemoryMB, memT:a.memT+n.memoryMB, gpuA:a.gpuA+n.allocatedGpus, gpuT:a.gpuT+n.gpus }), { cpuA:0,cpuT:0,memA:0,memT:0,gpuA:0,gpuT:0 });
    lines.push(`${partition} ${nodes.length} ${sums.cpuA}/${sums.cpuT} ${round1(sums.memA/1024)}/${round1(sums.memT/1024)} ${sums.gpuA}/${sums.gpuT}`);
  }
  terminalPrint(lines.join("\n"));
}

function terminalSqueue() {
  const jobs = engine.listJobs().filter((job) => !TERMINAL_STATES.has(job.state));
  const lines = ["JOBID PARTITION NAME STATE NODELIST(REASON)"];
  for (const job of jobs) lines.push(`${job.id} ${job.spec.partition} ${job.spec.jobName} ${job.state} ${job.allocation?.nodeId || job.stateReason || "—"}`);
  terminalPrint(lines.join("\n"));
}

function terminalSacct() {
  const lines = ["JOBID STATE ELAPSED MAXRSS CPU_EFF NOTE"];
  for (const job of engine.listJobs()) {
    const a = job.accounting;
    lines.push(`${job.id} ${job.state} ${a?.elapsedSeconds ?? "—"} ${a ? formatMemoryMB(a.modeledMaxRSSMB) : "—"} ${a ? `${a.cpuEfficiencyPct}%` : "—"} ${a ? "SYNTHETIC" : "—"}`);
  }
  terminalPrint(lines.join("\n"));
}

function terminalSeff(id) {
  const job = engine.getJob(id);
  if (!job || job.isArray) return terminalPrint(`No single task ${id}.`, "error");
  if (!job.accounting) return terminalPrint(`Job ${id} has no terminal accounting yet.`);
  const a = job.accounting;
  terminalPrint(`Job ID: ${id}\nState: ${job.state}\nCPU Efficiency: ${a.cpuEfficiencyPct}%\nMemory Utilized: ${formatMemoryMB(a.modeledMaxRSSMB)}\nMemory Efficiency: ${a.memoryEfficiencyPct}%\nNOTE: Synthetic pedagogical accounting; not measured cluster performance.`);
}

function terminalShowJob(id) {
  const job = engine.getJob(id);
  if (!job) return terminalPrint(`Unknown job ${id}.`, "error");
  if (job.isArray) return terminalPrint(`ArrayId=${job.id} State=${job.state} Tasks=${job.taskIds.length} Concurrency=${job.concurrencyLimit ?? "unlimited"}`);
  terminalPrint(`JobId=${job.id} JobName=${job.spec.jobName} Partition=${job.spec.partition} State=${job.state} Reason=${job.stateReason || "None"} CPUs=${job.spec.ntasks * job.spec.cpusPerTask} Memory=${formatMemoryMB(job.spec.memoryMB)} Walltime=${formatWalltimeSeconds(job.spec.walltimeSeconds)} Node=${job.allocation?.nodeId || "None"}`);
}

function terminalPrint(text, kind = "output") {
  const line = document.createElement("pre");
  line.className = `terminal-line ${kind}`;
  line.textContent = text;
  $("terminal-output").appendChild(line);
  $("terminal-output").scrollTop = $("terminal-output").scrollHeight;
}

function clearTerminal() {
  $("terminal-output").replaceChildren();
  terminalPrint("Terminal cleared.");
}

function bindTutorial() {
  $("lesson-prev")?.addEventListener("click", () => { tutorialIndex = Math.max(0, tutorialIndex - 1); renderTutorial(); });
  $("lesson-next")?.addEventListener("click", () => {
    tutorialProgress.add(tutorialIndex);
    saveTutorialProgress();
    tutorialIndex = Math.min(TUTORIALS.length - 1, tutorialIndex + 1);
    renderTutorial();
  });
  $("lesson-insert")?.addEventListener("click", () => insertTerminalCommand(TUTORIALS[tutorialIndex].command.replace("<jobid>", selectedJobId || "73001")));
  $("lesson-why")?.addEventListener("click", () => announce(TUTORIALS[tutorialIndex].tip));
  $("download-cheatsheet")?.addEventListener("click", downloadCheatSheet);
}

function renderTutorial() {
  const list = $("lesson-list");
  list.replaceChildren();
  TUTORIALS.forEach((item, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `lesson-button${index === tutorialIndex ? " active" : ""}${tutorialProgress.has(index) ? " completed" : ""}`;
    const num = document.createElement("span"); num.className = "num"; num.textContent = String(index + 1);
    const title = document.createElement("span"); title.textContent = item.title;
    const status = document.createElement("span"); status.className = "status"; status.textContent = tutorialProgress.has(index) ? "✓" : "○";
    button.append(num, title, status);
    button.addEventListener("click", () => { tutorialIndex = index; renderTutorial(); });
    list.appendChild(button);
  });
  const completed = tutorialProgress.size;
  $("lesson-progress-text").textContent = `${completed} of ${TUTORIALS.length} completed`;
  $("lesson-progress-bar").style.width = `${Math.round((completed / TUTORIALS.length) * 100)}%`;
  const item = TUTORIALS[tutorialIndex];
  $("lesson-kicker").textContent = `Lesson ${tutorialIndex + 1} of ${TUTORIALS.length}`;
  $("lesson-title").textContent = item.title;
  $("lesson-percent").textContent = `${Math.round((completed / TUTORIALS.length) * 100)}% complete`;
  $("lesson-copy").replaceChildren(paragraph(item.copy));
  $("lesson-task").textContent = item.task;
  $("lesson-command").textContent = item.command;
  $("lesson-example-output").textContent = item.output;
  $("lesson-tip").textContent = `Tip: ${item.tip}`;
  $("lesson-prev").disabled = tutorialIndex === 0;
  $("lesson-next").textContent = tutorialIndex === TUTORIALS.length - 1 ? "Mark path complete" : `Next lesson: ${TUTORIALS[tutorialIndex + 1].title} →`;
}

function downloadCheatSheet() {
  const lines = ["SAIL-HPC command cheat sheet", "", ...COMMAND_GROUPS.flatMap((group) => [group.title, ...group.commands.map((item) => `  ${item.command} - ${item.purpose}`), ""]), "Remember: adapt partitions, accounts/QOS, modules, paths and site limits to the real institution."];
  downloadText("sail-hpc-command-cheatsheet.txt", lines.join("\n"), "text/plain");
}

function bindAssessment() {
  $("reset-assessment")?.addEventListener("click", resetAssessment);
  $("claim-certificate")?.addEventListener("click", () => { if (assessmentScore() === 100) route("certificate"); });
  for (const tab of $$('[data-assessment-tab]')) {
    tab.addEventListener("click", () => {
      for (const other of $$('[data-assessment-tab]')) other.classList.toggle("active", other === tab);
      const showReview = tab.dataset.assessmentTab === "review";
      $("assessment-task-list").hidden = showReview;
      $("assessment-review").hidden = !showReview;
      if (showReview) renderAssessmentReview();
    });
  }
}

function renderAssessment() {
  const target = $("assessment-task-list");
  target.replaceChildren();
  for (const task of ASSESSMENT_TASKS) {
    const completed = Boolean(assessmentState.completed[task.id]);
    const row = document.createElement("article"); row.className = `assessment-task${completed ? " completed" : ""}`;
    const status = document.createElement("span"); status.className = "task-status"; status.textContent = completed ? "✓" : "○";
    const copy = document.createElement("div"); const h3 = document.createElement("h3"); h3.textContent = task.title; const p = document.createElement("p"); p.textContent = task.description; copy.append(h3, p);
    const side = document.createElement("div"); side.className = "task-side"; const points = document.createElement("div"); points.className = "points"; points.textContent = `${completed ? task.points : 0}/${task.points}`; const button = document.createElement("button"); button.type = "button"; button.textContent = completed ? "Review" : task.action; button.addEventListener("click", () => openAssessmentTask(task.id)); side.append(points, button);
    row.append(status, copy, side); target.appendChild(row);
  }
  renderScoreBreakdown();
  const score = assessmentScore();
  $("assessment-score").textContent = String(score);
  const { title, copy } = assessmentResult(score);
  $("assessment-result-title").textContent = title;
  $("assessment-result-copy").textContent = copy;
  $("claim-certificate").disabled = score !== 100;
  $("claim-certificate").textContent = score === 100 ? "Claim completion certificate →" : "100/100 required for certificate";
}

function renderScoreBreakdown() {
  const target = $("score-breakdown"); target.replaceChildren();
  for (const task of ASSESSMENT_TASKS) {
    const row = document.createElement("div"); row.className = "score-breakdown-row";
    const name = document.createElement("span"); name.textContent = task.title;
    const max = document.createElement("span"); max.textContent = `${task.points} pts`;
    const score = document.createElement("strong"); score.textContent = assessmentState.completed[task.id] ? String(task.points) : "0";
    row.append(name, max, score); target.appendChild(row);
  }
}

function renderAssessmentReview() {
  const target = $("assessment-review"); target.replaceChildren();
  target.append(
    heading("Key transfer takeaways"),
    paragraph("A perfect SAIL-HPC score means the modeled beginner tasks were completed. It does not override a real institution's account rules, documentation, software environment, storage paths, scheduler configuration or supervision requirements."),
    paragraph("Before your first real job, re-check the target cluster's partition, account/QOS, module or environment, file-system paths, walltime/resource limits and supported accounting tools."),
  );
}

function openAssessmentTask(id) {
  assessmentSessionActive = true;
  $("apply-revision").hidden = true;
  if (id === "orientation") {
    clearTerminal();
    terminalPrint("ASSESSMENT TASK: Inspect available training partitions and resources. No command-card hints are shown.");
    route("practice");
    return;
  }
  if (id === "submitMonitor") {
    loadScenario("script-wrapper-v1");
    announce("Assessment task: submit a valid basic job, then inspect its state using the terminal.");
    route("builder");
    return;
  }
  if (id === "resource") {
    loadScenario("overrequest-rightsize-v1");
    announce("Assessment task: revise this workload to no more than 4 CPU, 16 GB memory and 30 minutes, then complete it.");
    route("builder");
    return;
  }
  if (id === "pending") {
    setupPendingAssessment();
    return;
  }
  if (id === "failure") {
    loadScenario("alignment-oom-v1");
    announce("Assessment task: produce the modeled OOM, diagnose it, revise the same job manually, and complete the revision.");
    route("builder");
    return;
  }
  if (id === "array") {
    loadScenario("fastq-qc-array-v1");
    announce("Assessment task: complete the sample-parallel array while preserving its concurrency cap.");
    route("builder");
    return;
  }
  if (id === "transfer") {
    route("assessment");
    showTransferQuiz();
  }
}

function setupPendingAssessment() {
  resetSimulation();
  const scenario = getScientificScenario("script-wrapper-v1");
  const spec = normalizeJobSpec({ ...scenario.spec, jobName: "pending_check", dependency: { raw: "afterok:99999" }, provenance: { source: "assessment", scenarioId: "script-wrapper-v1" } });
  const submitted = engine.submit(spec, scenario.workload);
  assessmentPendingJobId = submitted.id;
  renderAll();
  clearTerminal();
  terminalPrint(`ASSESSMENT TASK: Job ${submitted.id} is pending. Inspect it and determine why it cannot start.`);
  route("practice");
}

function showTransferQuiz() {
  let card = $("transfer-quiz-card");
  if (card) { card.scrollIntoView({ behavior: "smooth" }); return; }
  card = document.createElement("article"); card.className = "panel assessment-review"; card.id = "transfer-quiz-card";
  card.append(heading("Real-cluster transfer check"), paragraph("Select every value that must be checked against the real institution before using an exported SAIL-HPC script. Do not select items that are portable shell syntax."));
  const options = [
    ["partition", "Partition name and limits", true],
    ["account", "Account / QOS requirements", true],
    ["modules", "Available modules or environment", true],
    ["paths", "Storage and working-directory paths", true],
    ["limits", "Site walltime/resource policies", true],
    ["shebang", "The fact that #!/bin/bash is shell syntax", false],
  ];
  const form = document.createElement("div"); form.className = "checklist";
  for (const [key, labelText] of options) {
    const label = document.createElement("label"); label.className = "transfer-option";
    const input = document.createElement("input"); input.type = "checkbox"; input.dataset.transferKey = key;
    const span = document.createElement("span"); span.textContent = labelText;
    label.append(input, span); form.appendChild(label);
  }
  const check = document.createElement("button"); check.type = "button"; check.className = "primary"; check.textContent = "Check transfer choices";
  const status = document.createElement("div"); status.className = "status-message";
  check.addEventListener("click", () => {
    const selected = new Set($$('[data-transfer-key]:checked').map((input) => input.dataset.transferKey));
    const expected = new Set(options.filter((option) => option[2]).map((option) => option[0]));
    const correct = selected.size === expected.size && [...expected].every((key) => selected.has(key));
    if (correct) { assessmentState.completed.transfer = true; saveAssessment(); status.textContent = "Transfer-awareness task complete."; renderAssessment(); }
    else status.textContent = "Not yet. Re-check which values depend on the real institution.";
  });
  card.append(form, check, status);
  $("assessment-task-list").after(card);
  card.scrollIntoView({ behavior: "smooth" });
}

function markAssessmentEvidence(kind, jobId = null) {
  if (!assessmentSessionActive) return;
  if (kind === "sinfo") assessmentState.completed.orientation = true;
  if (kind === "squeue") assessmentState.evidence.monitored = true;
  if (kind === "inspect") {
    assessmentState.evidence.inspected = true;
    if (assessmentPendingJobId && String(jobId) === String(assessmentPendingJobId)) assessmentState.completed.pending = true;
  }
  evaluateAssessmentEvidence();
  saveAssessment();
  renderAssessment();
}

function evaluateAssessmentEvidence() {
  if (!assessmentSessionActive) return;
  const jobs = engine.listJobs();
  if (assessmentState.evidence.submitted && assessmentState.evidence.monitored) assessmentState.completed.submitMonitor = true;

  if (jobs.some((job) => job.state === JOB_STATES.COMPLETED && job.spec.provenance?.scenarioId === "overrequest-rightsize-v1" && job.spec.cpusPerTask <= 4 && job.spec.memoryMB <= 16384 && job.spec.walltimeSeconds <= 1800)) assessmentState.completed.resource = true;

  const oomJobs = jobs.filter((job) => job.state === JOB_STATES.OUT_OF_MEMORY && job.spec.provenance?.scenarioId === "alignment-oom-v1");
  if (oomJobs.length) {
    const oomIds = new Set(oomJobs.map((job) => String(job.id)));
    if (jobs.some((job) => job.state === JOB_STATES.COMPLETED && job.spec.revisionLineage?.some((id) => oomIds.has(String(id))))) assessmentState.completed.failure = true;
  }

  const arrays = engine.listArrays();
  if (arrays.some((array) => array.state === JOB_STATES.COMPLETED && /%\d+/.test(array.specification || ""))) assessmentState.completed.array = true;
  saveAssessment();
  renderAssessment();
}

function assessmentScore() {
  return ASSESSMENT_TASKS.reduce((sum, task) => sum + (assessmentState.completed[task.id] ? task.points : 0), 0);
}

function assessmentResult(score) {
  if (score === 100) return { title: "SAIL-HPC beginner transfer check complete", copy: "You completed all modeled beginner competencies. You are ready to begin work on a real cluster using that institution's documentation, account rules, software environment and supervision requirements." };
  if (score >= 80) return { title: "Strong beginner practice performance", copy: "You are close. Review the remaining independent task(s) before claiming the practice-completion certificate." };
  if (score >= 60) return { title: "Core concepts developing", copy: "Continue practicing the incomplete domains and use the guided path when you need explanation." };
  return { title: "More practice recommended", copy: "Complete the independent tasks after working through the guided lessons and scientific scenarios." };
}

function resetAssessment() {
  assessmentSessionActive = true;
  assessmentState.completed = {};
  assessmentState.evidence = {};
  localStorage.removeItem("sail-hpc-assessment");
  const quiz = $("transfer-quiz-card"); if (quiz) quiz.remove();
  $("apply-revision").hidden = true;
  resetSimulation();
  renderAssessment();
}

function saveAssessment() { localStorage.setItem("sail-hpc-assessment", JSON.stringify(assessmentState)); }

function bindCertificate() {
  $("generate-certificate")?.addEventListener("click", generateCertificate);
  $("download-certificate")?.addEventListener("click", downloadCertificate);
  $("print-certificate")?.addEventListener("click", printCertificate);
}

async function generateCertificate() {
  if (assessmentScore() !== 100) return certificateStatus("A 100/100 assessment score is required before generating the certificate.", true);
  const name = $("certificate-name").value.trim();
  const email = $("certificate-email").value.trim();
  const affiliation = $("certificate-affiliation").value.trim();
  const country = $("certificate-country").value.trim();
  if (!name || !email || !affiliation || !country) return certificateStatus("Full name, email, affiliation and country are required.", true);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return certificateStatus("Enter a valid email address.", true);
  const date = new Date().toISOString().slice(0, 10);
  const id = await certificateId(`${name}|${email}|${affiliation}|${country}|${date}|100`);
  certificateData = { name, email, affiliation, country, date, id, score: 100 };
  $("certificate-name-preview").textContent = name;
  $("certificate-affiliation-preview").textContent = `${affiliation} · ${country}`;
  $("certificate-date-preview").textContent = date;
  $("certificate-id-preview").textContent = id;
  $("download-certificate").disabled = false;
  $("print-certificate").disabled = false;
  certificateStatus("Certificate generated locally. Email is used only in local certificate metadata and is not shown on the face of the certificate.");
}

async function certificateId(source) {
  const bytes = new TextEncoder().encode(source);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const hex = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  return `SAIL-${hex.slice(0, 12).toUpperCase()}`;
}

function downloadCertificate() {
  if (!certificateData) return certificateStatus("Generate the certificate first.", true);
  downloadText(`SAIL-HPC-${safeFilename(certificateData.name)}-${certificateData.id}.svg`, certificateSVG(certificateData), "image/svg+xml");
}

function printCertificate() {
  if (!certificateData) return certificateStatus("Generate the certificate first.", true);
  const win = window.open("", "_blank", "noopener,noreferrer");
  if (!win) return certificateStatus("The browser blocked the print window. Allow pop-ups or use Download SVG.", true);
  const svg = certificateSVG(certificateData);
  win.document.write(`<!doctype html><html><head><title>${escapeHTML(certificateData.id)}</title><style>html,body{margin:0;background:#ddd}svg{display:block;width:100%;height:auto}@media print{body{background:white}}</style></head><body>${svg}<script>addEventListener('load',()=>print())<\/script></body></html>`);
  win.document.close();
}

function certificateSVG(data) {
  const name = escapeXML(data.name), affiliation = escapeXML(data.affiliation), country = escapeXML(data.country), date = escapeXML(data.date), id = escapeXML(data.id), email = escapeXML(data.email);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1100" viewBox="0 0 1600 1100"><rect width="1600" height="1100" fill="#f7f4ee"/><rect x="45" y="45" width="1510" height="1010" rx="18" fill="none" stroke="#d78c31" stroke-width="4"/><rect x="62" y="62" width="1476" height="976" rx="14" fill="none" stroke="#e5b77b" stroke-width="2"/><g font-family="Arial,Helvetica,sans-serif" text-anchor="middle"><g stroke="#f29a38" stroke-width="8" fill="none" stroke-linecap="round"><path d="M735 120h90c26 0 42 16 42 36s-16 36-42 36h-55c-26 0-42 16-42 36s16 36 42 36h95"/></g><text x="800" y="315" font-size="40" font-weight="700" fill="#1a1d22">SAIL-HPC</text><text x="800" y="375" font-size="27" fill="#a5661d">Scheduler-Aware Interactive Learning for High-Performance Computing</text><text x="800" y="470" font-family="Georgia,serif" font-size="66" font-weight="700" fill="#1a1d22">Certificate of Practice Completion</text><text x="800" y="535" font-size="24" letter-spacing="5" fill="#73757a">THIS CERTIFIES THAT</text><text x="800" y="625" font-family="Georgia,serif" font-size="68" fill="#1a1d22">${name}</text><text x="800" y="675" font-size="27" fill="#c27522">${affiliation} · ${country}</text><line x1="430" y1="720" x2="1170" y2="720" stroke="#a5a5a5"/><text x="800" y="775" font-size="28" fill="#555">completed the</text><text x="800" y="820" font-size="34" font-weight="700" fill="#1a1d22">SAIL-HPC Beginner Transfer Check</text><circle cx="800" cy="915" r="78" fill="#d78c31"/><circle cx="800" cy="915" r="64" fill="none" stroke="#ffe6bd" stroke-width="6"/><text x="800" y="928" font-size="44" font-weight="800" fill="white">100%</text><text x="260" y="945" font-size="23" fill="#555">${date}</text><text x="1340" y="945" font-size="23" fill="#555">100 / 100</text><text x="800" y="1030" font-size="20" fill="#666">Certificate ID: ${id} · Local metadata email: ${email}</text></g></svg>`;
}

function certificateStatus(message, error = false) {
  $("certificate-status").textContent = message;
  $("certificate-status").dataset.status = error ? "error" : "ok";
}

function saveTutorialProgress() { localStorage.setItem("sail-hpc-tutorial-progress", JSON.stringify([...tutorialProgress])); }

function announce(message, error = false) {
  const target = $("status-message");
  if (target) { target.textContent = message; target.dataset.status = error ? "error" : "ok"; }
}

function lesson(title, copy, command, task, output, tip) { return Object.freeze({ title, copy, command, task, output, tip }); }
function paragraph(text) { const p = document.createElement("p"); p.textContent = text; return p; }
function heading(text) { const h = document.createElement("h2"); h.textContent = text; return h; }
function textNode(text) { const span = document.createElement("span"); span.textContent = text; return span; }
function cell(text) { const td = document.createElement("td"); td.textContent = text; return td; }
function cellButton(text, action) { const td = document.createElement("td"); const button = document.createElement("button"); button.type="button"; button.className="job-link"; button.textContent=text; button.addEventListener("click", action); td.appendChild(button); return td; }
function formatCounts(counts = {}) { return Object.entries(counts).map(([state, count]) => `${state}:${count}`).join(" · "); }
function titleCase(value) { return String(value).replace(/\b\w/g, (m) => m.toUpperCase()); }
function safeFilename(value) { return String(value || "job").replace(/[^A-Za-z0-9._-]+/g, "_").slice(0, 80); }
function integer(value, label) { const parsed = Number(value); if (!Number.isInteger(parsed) || parsed < 1) throw new Error(`${label} must be a positive integer`); return parsed; }
function nonNegativeInteger(value, label) { const parsed = Number(value); if (!Number.isInteger(parsed) || parsed < 0) throw new Error(`${label} must be a non-negative integer`); return parsed; }
function number(value, label) { const parsed = Number(value); if (!Number.isFinite(parsed) || parsed <= 0) throw new Error(`${label} must be a positive number`); return parsed; }
function round1(value) { return Math.round(value * 10) / 10; }
function round2(value) { return Math.round(value * 100) / 100; }
function downloadText(filename, text, type) { const blob = new Blob([text], { type }); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href=url; a.download=filename; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 0); }
function readJSON(key, fallback) { try { const value = localStorage.getItem(key); return value ? JSON.parse(value) : fallback; } catch { return fallback; } }
function escapeXML(value) { return String(value).replace(/[&<>"']/g, (char) => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&apos;" })[char]); }
function escapeHTML(value) { return escapeXML(value); }
