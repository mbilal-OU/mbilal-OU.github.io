const DEPTH_VERSION = "1.0.0-rc1";
const EXAM_KEY = "sail-hpc-practical-readiness-exam-v1";
const LAB_KEY = "sail-hpc-building-lab-v1";

const MODELED_COMMANDS = new Set([
  "sinfo", "squeue", "sbatch current", "sacct", "seff <jobid>",
  "scontrol show job <jobid>", "scontrol hold <jobid>",
  "scontrol release <jobid>", "scancel <jobid>", "help",
]);

const LESSON_RESOURCES = Object.freeze({
  "What is an HPC cluster?": lessonResources(
    "Orient yourself before you submit anything. Learn what is available, where work belongs, and which information is local policy.",
    [
      r("sinfo", "Inspect partitions and node availability.", "modeled"),
      r("sinfo -o '%P %a %l %D %C'", "Know that real Slurm supports formatted partition summaries.", "reference"),
      r("scontrol show partition", "Inspect detailed partition policy on a real cluster.", "reference"),
      r("scontrol show node <node>", "Inspect detailed node configuration/state.", "reference"),
      r("hostname", "Confirm which host you are on before heavy work.", "reference"),
      r("pwd && ls", "Orient yourself in the filesystem before using paths in jobs.", "reference"),
    ],
    "Open the training cluster view, identify the short/compute/highmem/gpu partitions, then explain which values must be rechecked on your institution's cluster."
  ),
  "Login node vs compute node": lessonResources(
    "Learn the boundary between light interactive preparation and scheduled compute work.",
    [
      r("squeue -u $USER", "Inspect your jobs before starting or resubmitting work.", "reference"),
      r("salloc", "Request an interactive allocation on clusters that permit it.", "reference"),
      r("srun --pty bash", "Launch an interactive shell inside an allocation when site policy supports it.", "reference"),
      r("srun <program>", "Launch a task/job step under Slurm control.", "reference"),
      r("top / htop", "Recognize local process inspection tools; site availability varies.", "reference"),
      r("exit", "Leave an interactive allocation/shell cleanly.", "reference"),
    ],
    "Describe how you would move a heavy command you tested locally into a scheduled batch or interactive allocation rather than running it on the login node."
  ),
  "What Slurm does": lessonResources(
    "Separate the scheduler's job from the scientific application's job.",
    [
      r("sbatch job.sh", "Submit a batch script on a real cluster.", "reference"),
      r("sbatch current", "Submit the current SAIL-HPC JobSpec.", "modeled"),
      r("srun <program>", "Launch a program/job step within Slurm.", "reference"),
      r("salloc", "Obtain an interactive allocation.", "reference"),
      r("squeue", "Observe queued/running work.", "modeled"),
      r("sacct", "Inspect completed/terminal job accounting.", "modeled"),
    ],
    "Be able to explain the difference between sbatch, srun, and salloc without treating them as interchangeable."
  ),
  "Partitions and resources": lessonResources(
    "A correct resource request describes the work without assuming that more resources always mean faster execution.",
    [
      r("#SBATCH --partition=compute", "Select a site-defined partition.", "reference"),
      r("#SBATCH --nodes=1", "Request nodes explicitly when needed.", "reference"),
      r("#SBATCH --ntasks=1", "Request task/process count.", "reference"),
      r("#SBATCH --cpus-per-task=8", "Request CPU cores for a threaded task.", "reference"),
      r("#SBATCH --mem=16G", "Request job memory.", "reference"),
      r("#SBATCH --time=02:00:00", "Set a walltime limit.", "reference"),
      r("#SBATCH --gres=gpu:1", "Common GPU generic-resource request form; site syntax may vary.", "reference"),
      r("sprio -j <jobid>", "Inspect priority components on a real Slurm site.", "reference"),
    ],
    "Open the Builder and create a one-node, one-task, 8-CPU, 16-GB, two-hour request. Then verify every generated #SBATCH line."
  ),
  "Your first batch script": lessonResources(
    "Build a complete script you can read, explain, save, and submit.",
    [
      r("#!/bin/bash", "Choose the interpreter for the batch script.", "reference"),
      r("#SBATCH --job-name=my_job", "Give the job a useful name.", "reference"),
      r("#SBATCH --output=logs/%x-%j.out", "Capture stdout with job-aware filenames.", "reference"),
      r("#SBATCH --error=logs/%x-%j.err", "Capture stderr separately when useful.", "reference"),
      r("mkdir -p logs", "Create output/log directories before the command writes to them.", "reference"),
      r("sbatch job.sh", "Submit the saved script on real Slurm.", "reference"),
    ],
    "Complete the dedicated Slurm Building Lab below. Do not rely only on the form Builder."
  ),
  "Modules and Conda": lessonResources(
    "Resource allocation and software availability are different layers. A scheduler can allocate CPUs to a job that still fails because the executable/environment is wrong.",
    [
      r("module avail", "List visible environment modules.", "reference"),
      r("module spider <software>", "Search module trees on Lmod-based sites.", "reference"),
      r("module load <software>", "Load a site-provided software environment.", "reference"),
      r("module list", "Record what is currently loaded.", "reference"),
      r("module purge", "Return to a clean module state.", "reference"),
      r("conda activate <env>", "Activate a Conda environment after site initialization.", "reference"),
      r("which <program>", "Verify which executable will run.", "reference"),
      r("<program> --version", "Record software version for reproducibility.", "reference"),
    ],
    "Prepare a script that loads or activates exactly one software environment, verifies the executable/version, and then runs the scientific command."
  ),
  "Monitor a job": lessonResources(
    "Monitor states and evidence rather than repeatedly resubmitting because a job appears slow.",
    [
      r("squeue", "Inspect active modeled jobs.", "modeled"),
      r("squeue -u $USER", "Filter to your jobs on a real cluster.", "reference"),
      r("scontrol show job <jobid>", "Inspect one modeled job in detail.", "modeled"),
      r("sstat -j <jobid>.batch", "Inspect live resource statistics where configured.", "reference"),
      r("tail -f logs/job.out", "Follow application output while a job runs.", "reference"),
      r("less logs/job.err", "Inspect stderr without dumping a large file to screen.", "reference"),
    ],
    "Submit a training job, inspect it while pending/running, then inspect its logs/accounting after completion."
  ),
  "Why jobs stay pending": lessonResources(
    "A PENDING state is information. Diagnose the scheduler reason before changing the job.",
    [
      r("squeue", "See pending state and modeled reason.", "modeled"),
      r("scontrol show job <jobid>", "Inspect detailed reason/dependency/resource information.", "modeled"),
      r("sprio -j <jobid>", "Inspect priority factors on a real site.", "reference"),
      r("sshare", "Inspect fair-share/accounting associations where permitted.", "reference"),
      r("scontrol hold <jobid>", "Hold a pending modeled job.", "modeled"),
      r("scontrol release <jobid>", "Release a held modeled job.", "modeled"),
    ],
    "Differentiate Resources, Dependency, Hold, Priority, invalid-policy and account/QOS problems before proposing a fix."
  ),
  "Job arrays": lessonResources(
    "Use arrays for many similar independent tasks instead of generating many nearly identical scripts.",
    [
      r("#SBATCH --array=1-12%3", "Create 12 tasks with at most three concurrent.", "reference"),
      r("$SLURM_ARRAY_TASK_ID", "Use the current array index inside the command.", "reference"),
      r("%A_%a", "Use parent/task identifiers in array log filenames.", "reference"),
      r("squeue", "Observe modeled array task states.", "modeled"),
      r("scancel <array_jobid>", "Cancel modeled work; real Slurm also supports array-element targeting.", "modeled"),
      r("sacct -j <array_jobid>", "Inspect array accounting on a real site.", "reference"),
    ],
    "Build an array for 12 samples with a %3 concurrency limit and output names that do not overwrite each other."
  ),
  "Dependencies": lessonResources(
    "Express workflow ordering through scheduler state instead of manual polling loops.",
    [
      r("--dependency=afterok:<jobid>", "Start only after upstream success.", "reference"),
      r("--dependency=afterany:<jobid>", "Start after upstream termination regardless of result.", "reference"),
      r("--dependency=afternotok:<jobid>", "Start after upstream failure.", "reference"),
      r("sbatch --dependency=afterok:$jid next.sh", "Common real-cluster submission pattern.", "reference"),
      r("scontrol show job <jobid>", "Inspect modeled dependency reason.", "modeled"),
      r("squeue", "Observe waiting downstream jobs.", "modeled"),
    ],
    "Create a two-stage workflow where stage 2 cannot run unless stage 1 completes successfully."
  ),
  "OOM and TIMEOUT": lessonResources(
    "Failures should change your next request only when the evidence supports the change.",
    [
      r("sacct", "Inspect modeled terminal state/accounting.", "modeled"),
      r("seff <jobid>", "Inspect deterministic efficiency-style feedback.", "modeled"),
      r("scontrol show job <jobid>", "Inspect state and request details.", "modeled"),
      r("grep -i -E 'oom|out of memory|killed' logs/*.err", "Search application logs for memory evidence.", "reference"),
      r("tail -n 100 logs/job.err", "Inspect the final error context.", "reference"),
      r("sstat -j <jobid>.batch", "Use live statistics where available/configured.", "reference"),
    ],
    "Run both OOM and TIMEOUT scenarios. Revise memory only for OOM and walltime/runtime behavior only for TIMEOUT."
  ),
  "Accounting and revision": lessonResources(
    "Use post-run evidence to improve future requests instead of permanently copying oversized values.",
    [
      r("sacct", "Inspect modeled completed-job accounting.", "modeled"),
      r("seff <jobid>", "Review modeled CPU/memory efficiency.", "modeled"),
      r("sacct -j <jobid> --format=JobID,State,Elapsed,AllocCPUS,MaxRSS", "Typical real-cluster accounting query.", "reference"),
      r("sreport", "Know that Slurm accounting reports may be available to users/admins depending on site policy.", "reference"),
      r("du -sh <path>", "Check storage usage when output growth matters.", "reference"),
      r("quota", "Check quota where the filesystem supports it.", "reference"),
    ],
    "Compare requested CPU/memory/walltime with observed evidence and justify a revised request in one sentence per resource."
  ),
  "Moving to a real cluster": lessonResources(
    "Transfer is a verification process, not copy-paste deployment.",
    [
      r("sinfo", "Recheck real partition names/limits.", "modeled"),
      r("sacctmgr show assoc user=$USER", "Know how account/QOS associations may be inspected where permitted.", "reference"),
      r("module avail", "Recheck software names/versions.", "reference"),
      r("pwd && df -h .", "Verify working filesystem and capacity context.", "reference"),
      r("which <program> && <program> --version", "Verify executable provenance/version.", "reference"),
      r("sbatch --test-only job.sh", "Know that some Slurm versions/sites support submission validation without actually running; verify locally before relying on it.", "reference"),
      r("sbatch job.sh", "Submit a deliberately small first real test.", "reference"),
    ],
    "Before first real submission, verify partition, account/QOS, modules, paths/storage, software version, resource limits, log destinations and local usage policy."
  ),
});

const BUILDING_LABS = Object.freeze([
  lab("basic", "01 · Basic batch job", "Guided", "Run paired-end FastQC on the short partition with 2 CPUs, 4 GB memory, 20 minutes and explicit log files.", ["short partition", "2 CPUs", "4 GB", "00:20:00", "FastQC module", "stdout + stderr"], `#!/bin/bash\n#SBATCH --job-name=fastqc_one\n#SBATCH --partition=short\n#SBATCH --cpus-per-task=2\n#SBATCH --mem=4G\n#SBATCH --time=00:20:00\n#SBATCH --output=logs/%x-%j.out\n#SBATCH --error=logs/%x-%j.err\n\nmodule load FastQC\nmkdir -p logs\nfastqc reads/sample_A_R1.fastq.gz reads/sample_A_R2.fastq.gz`, basicChecks()),
  lab("threaded", "02 · Threaded scientific job", "Guided", "Build an IQ-TREE job where the program actually receives the CPU count requested from Slurm.", ["compute partition", "8 CPUs", "16 GB", "02:00:00", "IQ-TREE", "SLURM_CPUS_PER_TASK"], `#!/bin/bash\n#SBATCH --job-name=phylogeny\n#SBATCH --partition=compute\n#SBATCH --cpus-per-task=8\n#SBATCH --mem=16G\n#SBATCH --time=02:00:00\n#SBATCH --output=logs/%x-%j.out\n\nmodule load IQ-TREE\nmkdir -p logs\niqtree2 -s alignment.fasta -T "$SLURM_CPUS_PER_TASK"`, threadedChecks()),
  lab("array", "03 · Sample array", "Guided", "Process 12 similar samples as an array while limiting concurrency to three tasks.", ["array 1-12%3", "SLURM_ARRAY_TASK_ID", "array-safe logs", "2 CPUs", "4 GB"], `#!/bin/bash\n#SBATCH --job-name=qc_array\n#SBATCH --partition=short\n#SBATCH --array=1-12%3\n#SBATCH --cpus-per-task=2\n#SBATCH --mem=4G\n#SBATCH --time=00:30:00\n#SBATCH --output=logs/%A_%a.out\n\nmodule load FastQC\nfastqc "reads/sample_${SLURM_ARRAY_TASK_ID}.fastq.gz"`, arrayChecks()),
  lab("dependency", "04 · Dependent stage", "Practice", "Write a downstream summary job that waits for successful completion of upstream job 73001.", ["afterok:73001", "1 task", "R environment", "explicit logs"], `#!/bin/bash\n#SBATCH --job-name=summarize\n#SBATCH --partition=short\n#SBATCH --cpus-per-task=1\n#SBATCH --mem=4G\n#SBATCH --time=00:30:00\n#SBATCH --dependency=afterok:73001\n#SBATCH --output=logs/%x-%j.out\n\nmodule load R\nRscript summarize.R results/ summary.tsv`, dependencyChecks()),
  lab("gpu", "05 · GPU request", "Practice", "Construct a single-GPU batch job without assuming that requesting a GPU automatically configures the application.", ["gpu partition", "1 GPU", "4 CPUs", "16 GB", "1 hour"], `#!/bin/bash\n#SBATCH --job-name=gpu_train\n#SBATCH --partition=gpu\n#SBATCH --gres=gpu:1\n#SBATCH --cpus-per-task=4\n#SBATCH --mem=16G\n#SBATCH --time=01:00:00\n#SBATCH --output=logs/%x-%j.out\n\nmodule load CUDA\npython3 train.py --device cuda`, gpuChecks()),
  lab("capstone", "06 · Manual Slurm capstone", "Independent", "Without using the form Builder, write a complete threaded phylogenomics job from the brief. Score 100/100 before loading it into the main Builder.", [], `#!/bin/bash\n\n# Write the complete job yourself.\n# Scenario: compute partition; 8 CPUs; 16 GB memory; 2 hours.\n# Create separate stdout/stderr logs in logs/.\n# Load IQ-TREE and run alignment.fasta using the Slurm CPU allocation.\n`, capstoneChecks(), true),
]);

const KNOWLEDGE_QUESTIONS = Object.freeze([
  q("k1", "Which command is the best first choice for viewing partitions and node availability?", ["sinfo", "sacct", "scancel", "module load"], "sinfo", 2),
  q("k2", "Which command focuses on jobs that are pending or running?", ["squeue", "sreport", "hostname", "pwd"], "squeue", 2),
  q("k3", "Which command submits a saved batch script on a real Slurm cluster?", ["sbatch job.sh", "sacct job.sh", "sprio job.sh", "sinfo job.sh"], "sbatch job.sh", 2),
  q("k4", "Which Slurm command is commonly used to launch tasks/job steps?", ["srun", "sacct", "sinfo", "sshare"], "srun", 2),
  q("k5", "Which command requests an interactive allocation?", ["salloc", "scancel", "sreport", "seff"], "salloc", 2),
  q("k6", "Which command is most appropriate for completed-job accounting?", ["sacct", "squeue", "module list", "pwd"], "sacct", 2),
  q("k7", "Which command can show live job-step resource statistics where configured?", ["sstat", "sbatch", "sinfo", "salloc"], "sstat", 2),
  q("k8", "Which command is designed to inspect scheduling priority components?", ["sprio", "seff", "scancel", "module purge"], "sprio", 2),
  q("k9", "Which tool commonly summarizes CPU/memory efficiency for a completed job on sites that provide it?", ["seff", "srun", "salloc", "hostname"], "seff", 2),
  q("k10", "Which command cancels a job?", ["scancel", "sacct", "sstat", "sreport"], "scancel", 2),
]);

const RESOURCE_QUESTIONS = Object.freeze([
  q("r1", "A single program can use 8 threads. Which request best matches that model?", ["--ntasks=8", "--cpus-per-task=8 with one task", "--nodes=8", "--array=1-8"], "--cpus-per-task=8 with one task", 4),
  q("r2", "You want a 16 GB total memory limit for the job. Which directive expresses that directly?", ["--mem=16G", "--mem-per-cpu=16G", "--cpus-per-task=16", "--time=16:00:00"], "--mem=16G", 4),
  q("r3", "Which directive limits a job to two hours?", ["--time=02:00:00", "--mem=2G", "--nodes=2", "--array=2"], "--time=02:00:00", 4),
  q("r4", "Which array specification creates 12 tasks but allows only three to run concurrently?", ["--array=1-12%3", "--array=3-12", "--cpus-per-task=12", "--ntasks=3"], "--array=1-12%3", 4),
  q("r5", "Stage B should run only if Stage A succeeds. Which dependency expresses that?", ["afterok", "afterany", "afternotok", "singleton memory"], "afterok", 4),
]);

const DIAGNOSIS_QUESTIONS = Object.freeze([
  q("d1", "A job ends OUT_OF_MEMORY and logs show the process was killed while memory usage approached the request. What should you examine/revise first?", ["Memory request and application memory behavior", "Add GPUs", "Increase array size", "Change job name"], "Memory request and application memory behavior", 5),
  q("d2", "A job reaches TIMEOUT while memory remains well below the request. What is the best next step?", ["Review runtime, walltime and application performance", "Double memory automatically", "Request a GPU regardless of software", "Resubmit unchanged repeatedly"], "Review runtime, walltime and application performance", 5),
  q("d3", "A downstream job is PENDING with Reason=Dependency. What should you inspect first?", ["Upstream job state and dependency expression", "Node hostname", "Disk file permissions only", "GPU model"], "Upstream job state and dependency expression", 5),
  q("d4", "You requested 8 CPUs but accounting shows very low CPU utilization and the command never receives a thread argument. What is the key issue?", ["Slurm allocation does not automatically make the application multithreaded", "Memory is always too low", "The partition must be GPU", "Arrays are required for threading"], "Slurm allocation does not automatically make the application multithreaded", 5),
]);

const TRANSFER_QUESTIONS = Object.freeze([
  q("t1", "Before copying a training script to a real site, which value must be rechecked?", ["Partition name/limits", "The SAIL-HPC orange accent", "Certificate ID", "Browser viewport"], "Partition name/limits", 2),
  q("t2", "Which site-specific association may be required for submission?", ["Account/QOS", "HTML theme", "Tutorial number", "SVG size"], "Account/QOS", 2),
  q("t3", "What should you verify before relying on `module load Tool`?", ["The site's actual module name/version", "That the browser supports SVG", "Your GitHub avatar", "The queue color"], "The site's actual module name/version", 2),
  q("t4", "What should be checked for input/output paths?", ["Filesystem location, permissions, quota and scratch/project policy", "Only filename extension", "Only job name", "Nothing if the script worked in SAIL-HPC"], "Filesystem location, permissions, quota and scratch/project policy", 2),
  q("t5", "What is the safest first real-cluster transfer?", ["A small test job after reading local documentation", "The largest production run immediately", "Run heavy work on the login node", "Ignore local policy because Slurm is universal"], "A small test job after reading local documentation", 2),
]);

const EXAM_SCRIPT_CHECKS = Object.freeze([
  check("Shebang", (s) => /^#!\s*\/bin\/(?:ba)?sh/m.test(s)),
  check("Job name", (s) => /#SBATCH\s+--job-name(?:=|\s+)\S+/i.test(s)),
  check("Compute partition", (s) => /#SBATCH\s+(?:-p\s+compute|--partition(?:=|\s+)compute)/i.test(s)),
  check("8 CPUs per task", (s) => /#SBATCH\s+--cpus-per-task(?:=|\s+)8\b/i.test(s)),
  check("16 GB total memory", (s) => /#SBATCH\s+--mem(?:=|\s+)(?:16G|16384M)\b/i.test(s)),
  check("Two-hour walltime", (s) => /#SBATCH\s+(?:-t\s+02:00:00|--time(?:=|\s+)02:00:00)/i.test(s)),
  check("Job-aware logs", (s) => /#SBATCH\s+--output(?:=|\s+)\S*(?:%j|%x)/i.test(s) && /#SBATCH\s+--error(?:=|\s+)\S*(?:%j|%x)/i.test(s)),
  check("IQ-TREE environment", (s) => /module\s+load\s+.*IQ[-_ ]?TREE/i.test(s)),
  check("IQ-TREE command", (s) => /iqtree2?\s+.*(?:-s\s+alignment\.fasta|alignment\.fasta)/i.test(s)),
  check("Threads tied to allocation", (s) => /(?:-T|--threads?)\s+["']?\$\{?SLURM_CPUS_PER_TASK\}?/i.test(s)),
]);

bootDepth();

function bootDepth() {
  injectStyles();
  enhanceLearning();
  createBuildingLab();
  enhanceAssessment();
  updateCertificateNaming();
  addCertificateGate();
}

function injectStyles() {
  if (document.querySelector('link[data-sail-depth]')) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = "assets/css/learning-depth.css?v=depth6-20260828";
  link.dataset.sailDepth = DEPTH_VERSION;
  document.head.appendChild(link);
}

function enhanceLearning() {
  const sidebar = document.querySelector(".tutorial-sidebar");
  const content = document.querySelector(".tutorial-content");
  const title = document.getElementById("lesson-title");
  if (!sidebar || !content || !title) return;

  if (!document.getElementById("building-lab-launcher")) {
    const launcher = el("div", { className: "lab-launcher", id: "building-lab-launcher" });
    const open = el("button", { type: "button" });
    open.append(el("strong", {}, "Slurm Building Lab"), el("small", {}, "Guided scripts → arrays → dependencies → manual capstone"));
    open.addEventListener("click", () => openBuildingLab());
    launcher.append(open);
    sidebar.append(launcher);
  }

  if (!document.getElementById("lesson-depth-panel")) {
    const panel = el("section", { className: "depth-panel", id: "lesson-depth-panel", ariaLabel: "Expanded lesson resources" });
    const tip = document.getElementById("lesson-tip");
    if (tip?.parentElement) tip.parentElement.insertBefore(panel, tip);
    else content.append(panel);
  }

  renderLessonDepth(title.textContent.trim());
  const observer = new MutationObserver(() => renderLessonDepth(title.textContent.trim()));
  observer.observe(title, { childList: true, characterData: true, subtree: true });
}

function renderLessonDepth(title) {
  const target = document.getElementById("lesson-depth-panel");
  const entry = LESSON_RESOURCES[title];
  if (!target || !entry) return;
  target.replaceChildren();

  const head = el("div", { className: "depth-panel-head" });
  const copy = el("div");
  copy.append(el("span", { className: "eyebrow" }, "Expanded resources"), el("h3", {}, "Commands, directives and real-cluster literacy"), el("p", {}, entry.summary));
  head.append(copy, el("span", { className: "depth-count" }, `${entry.resources.length} items`));
  target.append(head);

  const grid = el("div", { className: "depth-grid" });
  for (const item of entry.resources) grid.append(resourceCard(item));
  target.append(grid);

  const practice = el("div", { className: "depth-practice" });
  const pcopy = el("div");
  pcopy.append(el("strong", {}, "Required practice for this module"), el("span", {}, entry.practice));
  const button = el("button", { type: "button" }, title === "Your first batch script" ? "Open Building Lab" : "Open practice terminal");
  button.addEventListener("click", () => title === "Your first batch script" ? openBuildingLab() : openTerminal(chooseModeled(entry.resources)));
  practice.append(pcopy, button);
  target.append(practice);

  const map = el("div", { className: "knowledge-map" });
  map.append(
    mapItem("Understand", "Explain what the concept controls."),
    mapItem("Recognize", "Know the relevant commands/directives."),
    mapItem("Apply", "Use it in terminal or script practice."),
    mapItem("Transfer", "Identify site-specific values before real use."),
  );
  target.append(map);
}

function resourceCard(item) {
  const card = el("article", { className: "resource-card" });
  const top = el("div", { className: "resource-card-top" });
  top.append(el("code", {}, item.command), el("span", { className: `fidelity-chip ${item.mode}` }, item.mode === "modeled" ? "Modeled" : "Reference"));
  card.append(top, el("p", {}, item.purpose));
  const actions = el("div", { className: "resource-actions" });
  const button = el("button", { type: "button" }, item.mode === "modeled" ? "Insert in terminal" : "Copy example");
  button.addEventListener("click", () => item.mode === "modeled" ? openTerminal(item.command) : copyText(item.command, button));
  actions.append(button);
  card.append(actions);
  return card;
}

function createBuildingLab() {
  if (document.getElementById("slurm-building-lab")) return;
  const dialog = el("dialog", { className: "lab-dialog", id: "slurm-building-lab" });
  const shell = el("div", { className: "lab-shell" });
  const top = el("div", { className: "lab-topbar" });
  const copy = el("div");
  copy.append(el("span", { className: "eyebrow" }, "Hands-on practical"), el("h2", {}, "Slurm Building Lab"), el("p", {}, "Build scripts manually. The form Builder remains available, but this lab makes you write and validate the batch script yourself."));
  const close = el("button", { type: "button", ariaLabel: "Close Slurm Building Lab" }, "Close");
  close.addEventListener("click", () => dialog.close());
  top.append(copy, close);

  const body = el("div", { className: "lab-body" });
  const side = el("nav", { className: "lab-sidebar", ariaLabel: "Slurm Building Lab exercises" });
  const main = el("section", { className: "lab-main", id: "lab-main" });
  body.append(side, main);
  shell.append(top, body);
  dialog.append(shell);
  document.body.append(dialog);

  let current = BUILDING_LABS[0].id;
  const render = () => {
    side.replaceChildren();
    for (const labItem of BUILDING_LABS) {
      const button = el("button", { type: "button", className: `lab-exercise${labItem.id === current ? " active" : ""}` });
      button.append(el("span", {}, labItem.level), el("strong", {}, labItem.title), el("small", {}, labItem.id === "capstone" ? "100/100 required" : "Practice and validate"));
      button.addEventListener("click", () => { current = labItem.id; render(); });
      side.append(button);
    }
    renderLab(BUILDING_LABS.find((item) => item.id === current), main);
  };
  dialog._renderLab = render;
  render();
}

function renderLab(labItem, main) {
  main.replaceChildren();
  const brief = el("div", { className: "lab-brief" });
  brief.append(el("span", { className: "eyebrow" }, labItem.level), el("h3", {}, labItem.title), el("p", {}, labItem.brief));
  if (!labItem.hideRequirements && labItem.requirements.length) {
    const req = el("div", { className: "requirement-list" });
    for (const item of labItem.requirements) req.append(el("span", {}, item));
    brief.append(req);
  } else if (labItem.hideRequirements) {
    brief.append(el("p", {}, "Independent mode: the brief is intentionally concise. No directive-by-directive hints are shown before scoring."));
  }
  main.append(brief);

  const editor = el("textarea", { className: "lab-editor", id: "lab-script-editor", spellcheck: "false", ariaLabel: `${labItem.title} script editor` });
  editor.value = loadLabDraft(labItem.id) || labItem.starter;
  editor.addEventListener("input", () => saveLabDraft(labItem.id, editor.value));
  main.append(editor);

  const actions = el("div", { className: "lab-actions" });
  const checkButton = el("button", { type: "button", className: "primary" }, "Check script");
  const resetButton = el("button", { type: "button" }, "Reset exercise");
  const loadButton = el("button", { type: "button" }, "Load into main Builder");
  actions.append(checkButton, resetButton, loadButton);
  main.append(actions);

  const score = el("div", { className: "lab-score", id: "lab-score" });
  score.append(el("div", { className: "lab-score-head" }, [el("span", {}, "Not scored yet"), el("strong", {}, "—")]), el("p", { className: "exam-feedback" }, labItem.id === "capstone" ? "Capstone requires every rubric item for 100/100." : "Use this feedback while learning; the certificate exam does not provide these hints."));
  main.append(score);

  checkButton.addEventListener("click", () => scoreLab(labItem, editor.value, score));
  resetButton.addEventListener("click", () => { editor.value = labItem.starter; saveLabDraft(labItem.id, editor.value); score.replaceChildren(el("div", { className: "lab-score-head" }, [el("span", {}, "Reset"), el("strong", {}, "—")])); });
  loadButton.addEventListener("click", () => loadScriptIntoBuilder(editor.value));
}

function scoreLab(labItem, script, target) {
  const results = labItem.checks.map((item) => ({ ...item, pass: Boolean(item.test(script)) }));
  const passed = results.filter((item) => item.pass).length;
  const score = Math.round((passed / results.length) * 100);
  target.replaceChildren();
  const head = el("div", { className: "lab-score-head" });
  head.append(el("span", {}, `${passed} of ${results.length} rubric items satisfied`), el("strong", {}, `${score}/100`));
  target.append(head);
  const rubric = el("div", { className: "rubric" });
  for (const item of results) rubric.append(el("div", { className: `rubric-item${item.pass ? " pass" : ""}` }, `${item.pass ? "✓" : "○"} ${item.label}`));
  target.append(rubric);
  const feedback = el("p", { className: `exam-feedback${score === 100 ? " ok" : ""}` }, score === 100 ? "Complete. You can explain and transfer every required component of this exercise." : "Keep revising. In the training lab the rubric names are visible; the certificate exam will remove these hints.");
  target.append(feedback);
  if (score === 100) {
    const state = readJSON(LAB_KEY, {});
    state[labItem.id] = { score, completedAt: new Date().toISOString() };
    localStorage.setItem(LAB_KEY, JSON.stringify(state));
  }
}

function openBuildingLab() {
  const dialog = document.getElementById("slurm-building-lab");
  dialog?._renderLab?.();
  if (dialog?.showModal) dialog.showModal();
  else if (dialog) dialog.setAttribute("open", "");
}

function enhanceAssessment() {
  const host = document.querySelector('[data-view="assessment"] .workspace-main');
  if (!host || document.getElementById("practical-readiness-exam")) return;
  const head = host.querySelector(".page-head");
  const title = head?.querySelector("h1");
  const copy = head?.querySelector("p");
  if (title) title.textContent = "SAIL-HPC Practical Readiness Examination";
  if (copy) copy.textContent = "A 100-point independent capstone covering command selection, resource design, failure diagnosis, manual Slurm scripting and real-cluster transfer. No guided answer scaffolding.";

  const exam = el("section", { className: "readiness-exam", id: "practical-readiness-exam" });
  const intro = el("div", { className: "exam-intro" });
  intro.append(el("span", { className: "eyebrow" }, "Certificate assessment"), el("h2", {}, "100/100 means every competency was demonstrated"), el("p", {}, "The exam is intentionally stricter than the tutorials. Retakes are allowed. Incorrect answers are not revealed; return to Learn, Practice or the Slurm Building Lab, then try again."));
  exam.append(intro);

  exam.append(questionSection("exam-commands", "A · Command selection", 20, KNOWLEDGE_QUESTIONS));
  exam.append(questionSection("exam-resources", "B · Resource and directive design", 20, RESOURCE_QUESTIONS));
  exam.append(questionSection("exam-diagnosis", "C · Failure and scheduler diagnosis", 20, DIAGNOSIS_QUESTIONS));
  exam.append(scriptExamSection());
  exam.append(questionSection("exam-transfer", "E · Real-cluster transfer safety", 10, TRANSFER_QUESTIONS));

  const scorecard = el("div", { className: "exam-scorecard" });
  const scopy = el("div");
  scopy.append(el("p", {}, "Current submitted examination score"), el("strong", { id: "readiness-score" }, `${savedExamScore()}/100`));
  const actions = el("div", { className: "actions" });
  const submit = el("button", { type: "button", className: "primary", id: "submit-readiness-exam" }, "Submit examination");
  const reset = el("button", { type: "button", id: "reset-readiness-exam" }, "Reset answers");
  actions.append(submit, reset);
  scorecard.append(scopy, actions);
  exam.append(scorecard);
  const feedback = el("div", { className: "exam-feedback", id: "readiness-feedback" }, savedExamScore() === 100 ? "100/100 achieved. Certificate eligibility is unlocked." : "Certificate requires 100/100 on this examination.");
  exam.append(feedback);

  const taskList = document.getElementById("assessment-task-list");
  if (taskList) host.insertBefore(exam, taskList);
  else host.append(exam);

  restoreExamAnswers();
  submit.addEventListener("click", submitExam);
  reset.addEventListener("click", resetExam);
  updateExamUI(savedExamScore());
}

function questionSection(id, title, points, questions) {
  const details = el("details", { className: "exam-section", id });
  const summary = el("summary");
  summary.append(el("span", {}, title), el("span", {}, `${points} points`));
  details.append(summary);
  const body = el("div", { className: "exam-body" });
  for (const question of questions) body.append(renderQuestion(question));
  details.append(body);
  return details;
}

function renderQuestion(question) {
  const wrap = el("fieldset", { className: "exam-question" });
  const legend = el("legend", {}, question.prompt);
  wrap.append(legend);
  const options = el("div", { className: "exam-options" });
  for (const option of question.options) {
    const label = el("label");
    const input = el("input", { type: "radio", name: question.id, value: option });
    input.addEventListener("change", persistExamAnswers);
    label.append(input, document.createTextNode(option));
    options.append(label);
  }
  wrap.append(options);
  return wrap;
}

function scriptExamSection() {
  const details = el("details", { className: "exam-section", id: "exam-script" });
  const summary = el("summary");
  summary.append(el("span", {}, "D · Manual Slurm script capstone"), el("span", {}, "30 points"));
  details.append(summary);
  const body = el("div", { className: "exam-body" });
  body.append(el("p", {}, "Write a complete IQ-TREE batch job: compute partition, 8 CPUs for one threaded task, 16 GB total memory, 2-hour walltime, separate stdout/stderr logs, load IQ-TREE, and ensure IQ-TREE uses the Slurm CPU allocation. No directive checklist is shown during the exam."));
  const editor = el("textarea", { className: "exam-script", id: "exam-script-editor", spellcheck: "false", ariaLabel: "Manual Slurm script examination editor" });
  editor.placeholder = "#!/bin/bash\n\n# Write the complete batch script here...";
  editor.addEventListener("input", persistExamAnswers);
  body.append(editor, el("p", { className: "exam-feedback" }, "This section is scored against 10 hidden structural requirements worth 3 points each."));
  details.append(body);
  return details;
}

function submitExam() {
  persistExamAnswers();
  const score = calculateExamScore();
  const saved = readJSON(EXAM_KEY, {});
  saved.score = score;
  saved.submittedAt = new Date().toISOString();
  saved.version = DEPTH_VERSION;
  localStorage.setItem(EXAM_KEY, JSON.stringify(saved));
  updateExamUI(score);
}

function calculateExamScore() {
  let score = 0;
  for (const question of [...KNOWLEDGE_QUESTIONS, ...RESOURCE_QUESTIONS, ...DIAGNOSIS_QUESTIONS, ...TRANSFER_QUESTIONS]) {
    const selected = document.querySelector(`input[name="${question.id}"]:checked`);
    if (selected?.value === question.answer) score += question.points;
  }
  const script = document.getElementById("exam-script-editor")?.value || "";
  score += EXAM_SCRIPT_CHECKS.filter((item) => item.test(script)).length * 3;
  return score;
}

function updateExamUI(score) {
  const readiness = document.getElementById("readiness-score");
  if (readiness) readiness.textContent = `${score}/100`;
  const oldScore = document.getElementById("assessment-score");
  if (oldScore) oldScore.textContent = String(score);
  const title = document.getElementById("assessment-result-title");
  const copy = document.getElementById("assessment-result-copy");
  const feedback = document.getElementById("readiness-feedback");
  if (score === 100) {
    if (title) title.textContent = "Practical readiness examination complete";
    if (copy) copy.textContent = "100/100 achieved across command selection, resource design, diagnosis, manual Slurm scripting and real-cluster transfer.";
    if (feedback) { feedback.textContent = "100/100 achieved. Certificate eligibility is unlocked."; feedback.classList.add("ok"); }
  } else {
    if (title) title.textContent = "Certificate not yet unlocked";
    if (copy) copy.textContent = `Current practical readiness score: ${score}/100. Return to the learning resources and retake until every competency is correct.`;
    if (feedback) { feedback.textContent = `${score}/100. Incorrect answers are not revealed. Use Learn, Practice and the Building Lab before retaking.`; feedback.classList.remove("ok"); }
  }
  enforceClaimButton(score);
  enforceCertificateView(score);
}

function resetExam() {
  localStorage.removeItem(EXAM_KEY);
  for (const input of document.querySelectorAll('#practical-readiness-exam input[type="radio"]')) input.checked = false;
  const editor = document.getElementById("exam-script-editor");
  if (editor) editor.value = "";
  updateExamUI(0);
}

function persistExamAnswers() {
  const answers = {};
  for (const input of document.querySelectorAll('#practical-readiness-exam input[type="radio"]:checked')) answers[input.name] = input.value;
  const state = readJSON(EXAM_KEY, {});
  state.answers = answers;
  state.script = document.getElementById("exam-script-editor")?.value || "";
  localStorage.setItem(EXAM_KEY, JSON.stringify(state));
}

function restoreExamAnswers() {
  const state = readJSON(EXAM_KEY, {});
  for (const [name, value] of Object.entries(state.answers || {})) {
    const escaped = cssEscape(value);
    const input = document.querySelector(`input[name="${name}"][value="${escaped}"]`);
    if (input) input.checked = true;
  }
  const editor = document.getElementById("exam-script-editor");
  if (editor) editor.value = state.script || "";
}

function addCertificateGate() {
  const claim = document.getElementById("claim-certificate");
  if (!claim) return;
  claim.addEventListener("click", (event) => {
    const score = savedExamScore();
    if (score !== 100) {
      event.preventDefault();
      event.stopImmediatePropagation();
      updateExamUI(score);
      return;
    }
    event.preventDefault();
    event.stopImmediatePropagation();
    location.hash = "#/certificate";
  }, true);
  const observer = new MutationObserver(() => enforceClaimButton(savedExamScore()));
  observer.observe(claim, { attributes: true, attributeFilter: ["disabled"] });
  addEventListener("hashchange", () => enforceCertificateView(savedExamScore()));
  enforceClaimButton(savedExamScore());
}

function enforceClaimButton(score) {
  const claim = document.getElementById("claim-certificate");
  if (!claim) return;
  const allowed = score === 100;
  claim.disabled = !allowed;
  claim.textContent = allowed ? "Claim completion certificate" : "Certificate requires 100/100";
  let note = document.getElementById("certificate-gate-note");
  if (!note) {
    note = el("div", { className: "certificate-gate-note", id: "certificate-gate-note" });
    claim.insertAdjacentElement("afterend", note);
  }
  note.textContent = allowed ? "Eligibility verified by the SAIL-HPC Practical Readiness Examination." : "Complete all 100 points, including the manual script capstone, to unlock the certificate.";
}

function enforceCertificateView(score) {
  const generate = document.getElementById("generate-certificate");
  if (!generate) return;
  const allowed = score === 100;
  generate.disabled = !allowed;
  if (!allowed && location.hash.includes("certificate")) {
    const status = document.getElementById("certificate-status");
    if (status) text(status, "Certificate generation is locked until the Practical Readiness Examination score is 100/100.");
  }
}

function updateCertificateNaming() {
  for (const node of document.querySelectorAll(".certificate-preview strong")) {
    if (node.textContent.trim() === "SAIL-HPC Beginner Transfer Check") node.textContent = "SAIL-HPC Practical Readiness Examination";
  }
  const heading = document.querySelector('[data-view="certificate"] .panel-head h1');
  if (heading) heading.textContent = "Claim your practice-completion certificate";
}

function openTerminal(command) {
  const normalized = MODELED_COMMANDS.has(command) ? command : "help";
  location.hash = "#/practice";
  setTimeout(() => {
    const input = document.getElementById("terminal-input");
    if (!input) return;
    input.value = normalized;
    input.focus();
  }, 80);
}

function loadScriptIntoBuilder(script) {
  const dialog = document.getElementById("slurm-building-lab");
  dialog?.close?.();
  location.hash = "#/builder";
  setTimeout(() => {
    const textarea = document.getElementById("import-text");
    if (textarea) textarea.value = script;
    document.getElementById("import-script")?.click();
  }, 100);
}

function chooseModeled(resources) {
  return resources.find((item) => item.mode === "modeled")?.command || "help";
}

function copyText(value, button) {
  const done = () => { const old = button.textContent; button.textContent = "Copied"; setTimeout(() => button.textContent = old, 900); };
  if (navigator.clipboard?.writeText) navigator.clipboard.writeText(value).then(done).catch(() => fallbackCopy(value, done));
  else fallbackCopy(value, done);
}

function fallbackCopy(value, done) {
  const area = document.createElement("textarea");
  area.value = value;
  area.style.position = "fixed";
  area.style.opacity = "0";
  document.body.append(area);
  area.select();
  document.execCommand("copy");
  area.remove();
  done();
}

function saveLabDraft(id, script) {
  const state = readJSON(LAB_KEY, {});
  state[`draft:${id}`] = script;
  localStorage.setItem(LAB_KEY, JSON.stringify(state));
}
function loadLabDraft(id) { return readJSON(LAB_KEY, {})[`draft:${id}`] || ""; }
function savedExamScore() { return Number(readJSON(EXAM_KEY, {}).score || 0); }
function readJSON(key, fallback) { try { return JSON.parse(localStorage.getItem(key) || "") || fallback; } catch { return fallback; } }
function cssEscape(value) { return String(value).replace(/["\\]/g, "\\$&"); }

function el(tag, attrs = {}, children = null) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (key === "className") node.className = value;
    else if (key === "ariaLabel") node.setAttribute("aria-label", value);
    else if (key === "spellcheck") node.spellcheck = value === true || value === "true";
    else if (key === "type") node.type = value;
    else if (key === "name") node.name = value;
    else if (key === "value") node.value = value;
    else if (value !== undefined && value !== null) node.setAttribute(key, String(value));
  }
  if (children !== null && children !== undefined) {
    const list = Array.isArray(children) ? children : [children];
    for (const child of list) node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return node;
}
function text(node, value) { node.textContent = value; return node; }
function mapItem(title, body) { const node = el("div"); node.append(el("strong", {}, title), el("span", {}, body)); return node; }
function r(command, purpose, mode) { return Object.freeze({ command, purpose, mode }); }
function lessonResources(summary, resources, practice) { return Object.freeze({ summary, resources: Object.freeze(resources), practice }); }
function q(id, prompt, options, answer, points) { return Object.freeze({ id, prompt, options: Object.freeze(options), answer, points }); }
function check(label, test) { return Object.freeze({ label, test }); }
function lab(id, title, level, brief, requirements, starter, checks, hideRequirements = false) { return Object.freeze({ id, title, level, brief, requirements: Object.freeze(requirements), starter, checks: Object.freeze(checks), hideRequirements }); }

function basicChecks() { return [check("Shebang", s => /^#!\s*\/bin\/(?:ba)?sh/m.test(s)), check("Job name", s => /#SBATCH\s+--job-name/i.test(s)), check("short partition", s => /#SBATCH\s+(?:-p\s+short|--partition(?:=|\s+)short)/i.test(s)), check("2 CPUs", s => /#SBATCH\s+--cpus-per-task(?:=|\s+)2\b/i.test(s)), check("4 GB memory", s => /#SBATCH\s+--mem(?:=|\s+)(?:4G|4096M)\b/i.test(s)), check("20-minute time", s => /#SBATCH\s+--time(?:=|\s+)00:20:00/i.test(s)), check("stdout log", s => /#SBATCH\s+--output/i.test(s)), check("stderr log", s => /#SBATCH\s+--error/i.test(s)), check("FastQC module", s => /module\s+load\s+FastQC/i.test(s)), check("FastQC command", s => /fastqc\s+/i.test(s))]; }
function threadedChecks() { return [check("compute partition", s => /#SBATCH\s+(?:-p\s+compute|--partition(?:=|\s+)compute)/i.test(s)), check("8 CPUs", s => /#SBATCH\s+--cpus-per-task(?:=|\s+)8\b/i.test(s)), check("16 GB", s => /#SBATCH\s+--mem(?:=|\s+)(?:16G|16384M)/i.test(s)), check("2 hours", s => /#SBATCH\s+--time(?:=|\s+)02:00:00/i.test(s)), check("IQ-TREE module", s => /module\s+load\s+.*IQ[-_ ]?TREE/i.test(s)), check("IQ-TREE command", s => /iqtree2?/i.test(s)), check("Threads use SLURM CPUs", s => /\$\{?SLURM_CPUS_PER_TASK\}?/i.test(s)), check("Output logging", s => /#SBATCH\s+--output/i.test(s))]; }
function arrayChecks() { return [check("Array 1-12%3", s => /#SBATCH\s+--array(?:=|\s+)1-12%3/i.test(s)), check("2 CPUs", s => /#SBATCH\s+--cpus-per-task(?:=|\s+)2\b/i.test(s)), check("4 GB", s => /#SBATCH\s+--mem(?:=|\s+)(?:4G|4096M)/i.test(s)), check("Task ID in command", s => /SLURM_ARRAY_TASK_ID/i.test(s)), check("Array-safe log IDs", s => /%(?:A|a)/i.test(s)), check("Scientific command", s => /fastqc|python|Rscript|bash/i.test(s))]; }
function dependencyChecks() { return [check("afterok dependency", s => /#SBATCH\s+--dependency(?:=|\s+)afterok:73001/i.test(s)), check("Partition", s => /#SBATCH\s+--partition/i.test(s)), check("Memory", s => /#SBATCH\s+--mem/i.test(s)), check("Time", s => /#SBATCH\s+--time/i.test(s)), check("R module", s => /module\s+load\s+R\b/i.test(s)), check("Rscript command", s => /Rscript\s+/i.test(s))]; }
function gpuChecks() { return [check("gpu partition", s => /#SBATCH\s+(?:-p\s+gpu|--partition(?:=|\s+)gpu)/i.test(s)), check("1 GPU", s => /#SBATCH\s+--gres(?:=|\s+)gpu:1/i.test(s)), check("4 CPUs", s => /#SBATCH\s+--cpus-per-task(?:=|\s+)4\b/i.test(s)), check("16 GB", s => /#SBATCH\s+--mem(?:=|\s+)(?:16G|16384M)/i.test(s)), check("1 hour", s => /#SBATCH\s+--time(?:=|\s+)01:00:00/i.test(s)), check("GPU-aware command", s => /cuda|gpu/i.test(s))]; }
function capstoneChecks() { return EXAM_SCRIPT_CHECKS; }
