const VERSION = "depth7-20260828";
const EXAM_KEY = "sail-hpc-practical-readiness-exam-v2";
const LAB_KEY = "sail-hpc-building-lab-v2";

const RESOURCES = {
  "What is an HPC cluster?": {
    summary: "Orient yourself before submitting work: partitions, nodes, filesystem location and site policy.",
    items: [
      ["sinfo","modeled","Inspect partitions and node availability."],
      ["sinfo -o '%P %a %l %D %C'","reference","Formatted partition summary on a real Slurm site."],
      ["scontrol show partition","reference","Inspect partition limits and policy."],
      ["scontrol show node <node>","reference","Inspect node state/configuration."],
      ["hostname","reference","Confirm which host you are on."],
      ["pwd && ls","reference","Orient yourself in the filesystem."]
    ],
    practice: "Identify the training partitions, then list which names/limits must be rechecked on your institution's cluster."
  },
  "Login node vs compute node": {
    summary: "Keep preparation light on login nodes and move compute-heavy work into scheduled allocations.",
    items: [
      ["squeue -u $USER","reference","Inspect your jobs."],
      ["salloc","reference","Request an interactive allocation."],
      ["srun --pty bash","reference","Open an interactive shell inside an allocation when permitted."],
      ["srun <program>","reference","Launch a task/job step under Slurm."],
      ["top / htop","reference","Inspect local processes when available."],
      ["exit","reference","Leave the interactive allocation cleanly."]
    ],
    practice: "Explain how you would move a heavy command from the login node into a batch or interactive allocation."
  },
  "What Slurm does": {
    summary: "Separate scheduler responsibilities from the scientific application's responsibilities.",
    items: [
      ["sbatch job.sh","reference","Submit a saved batch script."],
      ["sbatch current","modeled","Submit the current SAIL-HPC JobSpec."],
      ["srun <program>","reference","Launch a program or job step."],
      ["salloc","reference","Request an interactive allocation."],
      ["squeue","modeled","Inspect pending/running jobs."],
      ["sacct","modeled","Inspect terminal job accounting."]
    ],
    practice: "Explain the difference between sbatch, srun and salloc and when each should be used."
  },
  "Partitions and resources": {
    summary: "Describe the workload accurately; more resources do not automatically make a job faster.",
    items: [
      ["#SBATCH --partition=compute","reference","Select a site-defined partition."],
      ["#SBATCH --nodes=1","reference","Request node count."],
      ["#SBATCH --ntasks=1","reference","Request task/process count."],
      ["#SBATCH --cpus-per-task=8","reference","Request CPUs for one threaded task."],
      ["#SBATCH --mem=16G","reference","Request total job memory."],
      ["#SBATCH --time=02:00:00","reference","Set walltime limit."],
      ["#SBATCH --gres=gpu:1","reference","Common GPU request form; site syntax may differ."],
      ["sprio -j <jobid>","reference","Inspect priority components on a real Slurm site."]
    ],
    practice: "Build a one-node, one-task, 8-CPU, 16-GB, two-hour request and explain every directive."
  },
  "Your first batch script": {
    summary: "Write a complete batch script you can explain, save, submit and debug.",
    items: [
      ["#!/bin/bash","reference","Select the interpreter."],
      ["#SBATCH --job-name=my_job","reference","Name the job."],
      ["#SBATCH --output=logs/%x-%j.out","reference","Capture stdout."],
      ["#SBATCH --error=logs/%x-%j.err","reference","Capture stderr."],
      ["mkdir -p logs","reference","Create the log directory."],
      ["sbatch job.sh","reference","Submit the saved script."]
    ],
    practice: "Complete the Slurm Building Lab instead of relying only on the form Builder."
  },
  "Modules and Conda": {
    summary: "Resource allocation and software environment are separate layers; verify both.",
    items: [
      ["module avail","reference","List available modules."],
      ["module spider <software>","reference","Search module trees on Lmod sites."],
      ["module load <software>","reference","Load site software."],
      ["module list","reference","Record loaded modules."],
      ["module purge","reference","Return to a clean module state."],
      ["conda activate <env>","reference","Activate a Conda environment after site initialization."],
      ["which <program>","reference","Verify executable path."],
      ["<program> --version","reference","Record software version."]
    ],
    practice: "Prepare a script that activates one environment, verifies the executable/version and runs the scientific command."
  },
  "Monitor a job": {
    summary: "Observe state and evidence rather than resubmitting because a job appears slow.",
    items: [
      ["squeue","modeled","Inspect active jobs."],
      ["squeue -u $USER","reference","Filter to your jobs on a real cluster."],
      ["scontrol show job <jobid>","modeled","Inspect one job in detail."],
      ["sstat -j <jobid>.batch","reference","Inspect live job-step resource statistics where configured."],
      ["tail -f logs/job.out","reference","Follow stdout."],
      ["less logs/job.err","reference","Inspect stderr."]
    ],
    practice: "Submit a training job, inspect it while active, then inspect logs/accounting after completion."
  },
  "Why jobs stay pending": {
    summary: "PENDING is diagnostic information. Read the reason before changing the request.",
    items: [
      ["squeue","modeled","Inspect pending reason."],
      ["scontrol show job <jobid>","modeled","Inspect detailed reason/resource/dependency information."],
      ["sprio -j <jobid>","reference","Inspect priority factors."],
      ["sshare","reference","Inspect fair-share associations where permitted."],
      ["scontrol hold <jobid>","modeled","Hold a job."],
      ["scontrol release <jobid>","modeled","Release a held job."]
    ],
    practice: "Differentiate Resources, Dependency, Hold, Priority and account/QOS problems before proposing a fix."
  },
  "Job arrays": {
    summary: "Use arrays for many similar independent tasks rather than duplicating scripts.",
    items: [
      ["#SBATCH --array=1-12%3","reference","Create 12 tasks with a concurrency cap of 3."],
      ["$SLURM_ARRAY_TASK_ID","reference","Use the current array index."],
      ["%A_%a","reference","Use parent/task IDs in log names."],
      ["squeue","modeled","Observe array task states."],
      ["scancel <array_jobid>","modeled","Cancel modeled array work."],
      ["sacct -j <array_jobid>","reference","Inspect array accounting on a real site."]
    ],
    practice: "Build an array for 12 samples with %3 concurrency and array-safe log names."
  },
  "Dependencies": {
    summary: "Express workflow ordering through scheduler state instead of manual polling.",
    items: [
      ["--dependency=afterok:<jobid>","reference","Run only after upstream success."],
      ["--dependency=afterany:<jobid>","reference","Run after upstream termination."],
      ["--dependency=afternotok:<jobid>","reference","Run after upstream failure."],
      ["sbatch --dependency=afterok:$jid next.sh","reference","Common submission pattern."],
      ["scontrol show job <jobid>","modeled","Inspect dependency reason."],
      ["squeue","modeled","Observe waiting downstream jobs."]
    ],
    practice: "Create a two-stage workflow where stage 2 cannot run unless stage 1 succeeds."
  },
  "OOM and TIMEOUT": {
    summary: "Change future requests only when evidence supports the change.",
    items: [
      ["sacct","modeled","Inspect terminal state/accounting."],
      ["seff <jobid>","modeled","Review deterministic efficiency-style feedback."],
      ["scontrol show job <jobid>","modeled","Inspect request and state."],
      ["grep -i -E 'oom|out of memory|killed' logs/*.err","reference","Search logs for memory evidence."],
      ["tail -n 100 logs/job.err","reference","Inspect final error context."],
      ["sstat -j <jobid>.batch","reference","Use live stats where available."]
    ],
    practice: "Run OOM and TIMEOUT scenarios and revise memory only for OOM, walltime/runtime only for TIMEOUT."
  },
  "Accounting and revision": {
    summary: "Use post-run evidence to right-size future requests instead of permanently over-requesting.",
    items: [
      ["sacct","modeled","Inspect completed-job accounting."],
      ["seff <jobid>","modeled","Review modeled CPU/memory efficiency."],
      ["sacct -j <jobid> --format=JobID,State,Elapsed,AllocCPUS,MaxRSS","reference","Typical real accounting query."],
      ["sreport","reference","Know that accounting reports may be available depending on policy."],
      ["du -sh <path>","reference","Check storage usage."],
      ["quota","reference","Check quota where supported."]
    ],
    practice: "Compare requested CPU/memory/walltime with observed evidence and justify a revised request."
  },
  "Moving to a real cluster": {
    summary: "Transfer is a verification process, not copy-paste deployment.",
    items: [
      ["sinfo","modeled","Recheck partition names/limits."],
      ["sacctmgr show assoc user=$USER","reference","Inspect account/QOS associations where permitted."],
      ["module avail","reference","Recheck software names/versions."],
      ["pwd && df -h .","reference","Verify filesystem/capacity context."],
      ["which <program> && <program> --version","reference","Verify executable provenance/version."],
      ["sbatch --test-only job.sh","reference","Submission validation where supported; verify site/version first."],
      ["sbatch job.sh","reference","Submit a deliberately small first real test."]
    ],
    practice: "Before first real submission verify partition, account/QOS, modules, paths, storage, version, resource limits and logs."
  }
};

const SCRIPT_CHECKS = [
  ["Shebang",s=>/^#!\s*\/bin\/(?:ba)?sh/m.test(s)],
  ["Job name",s=>/#SBATCH\s+--job-name(?:=|\s+)\S+/i.test(s)],
  ["Compute partition",s=>/#SBATCH\s+(?:-p\s+compute|--partition(?:=|\s+)compute)/i.test(s)],
  ["8 CPUs per task",s=>/#SBATCH\s+--cpus-per-task(?:=|\s+)8\b/i.test(s)],
  ["16 GB total memory",s=>/#SBATCH\s+--mem(?:=|\s+)(?:16G|16384M)\b/i.test(s)],
  ["Two-hour walltime",s=>/#SBATCH\s+(?:-t\s+02:00:00|--time(?:=|\s+)02:00:00)/i.test(s)],
  ["Job-aware stdout/stderr",s=>/#SBATCH\s+--output(?:=|\s+)\S*(?:%j|%x)/i.test(s)&&/#SBATCH\s+--error(?:=|\s+)\S*(?:%j|%x)/i.test(s)],
  ["IQ-TREE environment",s=>/module\s+load\s+.*IQ[-_ ]?TREE/i.test(s)],
  ["IQ-TREE command",s=>/iqtree2?\s+.*(?:-s\s+alignment\.fasta|alignment\.fasta)/i.test(s)],
  ["Threads tied to allocation",s=>/(?:-T|--threads?)\s+["']?\$\{?SLURM_CPUS_PER_TASK\}?/i.test(s)]
];

const LABS = [
  {title:"01 · Basic batch job",level:"Guided",brief:"Run paired-end FastQC on short with 2 CPUs, 4 GB memory, 20 minutes and separate logs.",starter:`#!/bin/bash
#SBATCH --job-name=fastqc_one
#SBATCH --partition=short
#SBATCH --cpus-per-task=2
#SBATCH --mem=4G
#SBATCH --time=00:20:00
#SBATCH --output=logs/%x-%j.out
#SBATCH --error=logs/%x-%j.err

module load FastQC
mkdir -p logs
fastqc reads/sample_A_R1.fastq.gz reads/sample_A_R2.fastq.gz`,checks:[["shebang",s=>/^#!\s*\/bin\/(?:ba)?sh/m.test(s)],["job name",s=>/#SBATCH\s+--job-name/i.test(s)],["short partition",s=>/#SBATCH\s+(?:-p\s+short|--partition(?:=|\s+)short)/i.test(s)],["2 CPUs",s=>/#SBATCH\s+--cpus-per-task(?:=|\s+)2\b/i.test(s)],["4 GB",s=>/#SBATCH\s+--mem(?:=|\s+)(?:4G|4096M)\b/i.test(s)],["20 min",s=>/#SBATCH\s+--time(?:=|\s+)00:20:00/i.test(s)],["stdout",s=>/#SBATCH\s+--output/i.test(s)],["stderr",s=>/#SBATCH\s+--error/i.test(s)],["FastQC module",s=>/module\s+load\s+FastQC/i.test(s)],["FastQC command",s=>/\bfastqc\s+/i.test(s)]]},
  {title:"02 · Threaded scientific job",level:"Guided",brief:"Build an IQ-TREE job where the program actually receives the CPU count requested from Slurm.",starter:`#!/bin/bash
#SBATCH --job-name=phylogeny
#SBATCH --partition=compute
#SBATCH --cpus-per-task=8
#SBATCH --mem=16G
#SBATCH --time=02:00:00
#SBATCH --output=logs/%x-%j.out
#SBATCH --error=logs/%x-%j.err

module load IQ-TREE
mkdir -p logs
iqtree2 -s alignment.fasta -T "$SLURM_CPUS_PER_TASK"`,checks:[["compute partition",s=>/--partition(?:=|\s+)compute/i.test(s)],["8 CPUs",s=>/--cpus-per-task(?:=|\s+)8\b/i.test(s)],["16 GB",s=>/--mem(?:=|\s+)(?:16G|16384M)/i.test(s)],["2 hours",s=>/--time(?:=|\s+)02:00:00/i.test(s)],["IQ-TREE module",s=>/module\s+load\s+.*IQ[-_ ]?TREE/i.test(s)],["IQ-TREE",s=>/\biqtree2?\b/i.test(s)],["threads tied to allocation",s=>/\$\{?SLURM_CPUS_PER_TASK\}?/i.test(s)],["logs",s=>/--output/i.test(s)&&/--error/i.test(s)]]},
  {title:"03 · Job array",level:"Guided",brief:"Process 12 samples as an array while allowing at most three simultaneous tasks.",starter:`#!/bin/bash
#SBATCH --job-name=qc_array
#SBATCH --partition=short
#SBATCH --array=1-12%3
#SBATCH --cpus-per-task=2
#SBATCH --mem=4G
#SBATCH --time=00:30:00
#SBATCH --output=logs/%A_%a.out

module load FastQC
fastqc "reads/sample_${SLURM_ARRAY_TASK_ID}.fastq.gz"`,checks:[["array 1-12%3",s=>/--array(?:=|\s+)1-12%3/i.test(s)],["task id",s=>/SLURM_ARRAY_TASK_ID/i.test(s)],["array-safe logs",s=>/%A|%a/i.test(s)],["2 CPUs",s=>/--cpus-per-task(?:=|\s+)2\b/i.test(s)],["4 GB",s=>/--mem(?:=|\s+)(?:4G|4096M)/i.test(s)],["scientific command",s=>/fastqc|python|Rscript|bash/i.test(s)]]},
  {title:"04 · Dependency",level:"Practice",brief:"Write a downstream R summary job that starts only if upstream job 73001 succeeds.",starter:`#!/bin/bash
#SBATCH --job-name=summarize
#SBATCH --partition=short
#SBATCH --cpus-per-task=1
#SBATCH --mem=4G
#SBATCH --time=00:30:00
#SBATCH --dependency=afterok:73001
#SBATCH --output=logs/%x-%j.out

module load R
Rscript summarize.R results/ summary.tsv`,checks:[["afterok:73001",s=>/--dependency(?:=|\s+)afterok:73001/i.test(s)],["partition",s=>/--partition/i.test(s)],["memory",s=>/--mem/i.test(s)],["time",s=>/--time/i.test(s)],["R module",s=>/module\s+load\s+R\b/i.test(s)],["Rscript",s=>/\bRscript\s+/i.test(s)]]},
  {title:"05 · GPU request",level:"Practice",brief:"Construct a single-GPU job without assuming the scheduler configures your application automatically.",starter:`#!/bin/bash
#SBATCH --job-name=gpu_train
#SBATCH --partition=gpu
#SBATCH --gres=gpu:1
#SBATCH --cpus-per-task=4
#SBATCH --mem=16G
#SBATCH --time=01:00:00
#SBATCH --output=logs/%x-%j.out

module load CUDA
python3 train.py --device cuda`,checks:[["gpu partition",s=>/--partition(?:=|\s+)gpu/i.test(s)],["1 GPU",s=>/--gres(?:=|\s+)gpu:1/i.test(s)],["4 CPUs",s=>/--cpus-per-task(?:=|\s+)4\b/i.test(s)],["16 GB",s=>/--mem(?:=|\s+)(?:16G|16384M)/i.test(s)],["1 hour",s=>/--time(?:=|\s+)01:00:00/i.test(s)],["GPU-aware command",s=>/cuda|gpu/i.test(s)]]},
  {title:"06 · Manual capstone",level:"Independent",brief:"Write a complete IQ-TREE batch job: compute; 8 CPUs; 16 GB; 2 hours; separate stdout/stderr; load IQ-TREE; make IQ-TREE use the Slurm CPU allocation.",starter:`#!/bin/bash

# Write the complete script yourself.
`,checks:SCRIPT_CHECKS}
];

const QUESTIONS = [
  ["k1","Which command first shows partitions and node availability?",["sinfo","sacct","scancel","module load"],"sinfo",2],["k2","Which command focuses on pending/running jobs?",["squeue","sreport","hostname","pwd"],"squeue",2],["k3","Which command submits a saved batch script?",["sbatch job.sh","sacct job.sh","sprio job.sh","sinfo job.sh"],"sbatch job.sh",2],["k4","Which command commonly launches tasks/job steps?",["srun","sacct","sinfo","sshare"],"srun",2],["k5","Which command requests an interactive allocation?",["salloc","scancel","sreport","seff"],"salloc",2],["k6","Which command is appropriate for completed-job accounting?",["sacct","squeue","module list","pwd"],"sacct",2],["k7","Which command can show live job-step resource statistics where configured?",["sstat","sbatch","sinfo","salloc"],"sstat",2],["k8","Which command inspects scheduling priority components?",["sprio","seff","scancel","module purge"],"sprio",2],["k9","Which tool commonly summarizes CPU/memory efficiency where installed?",["seff","srun","salloc","hostname"],"seff",2],["k10","Which command cancels a job?",["scancel","sacct","sstat","sreport"],"scancel",2],
  ["r1","One program uses 8 threads. Which request matches that model?",["--ntasks=8","--cpus-per-task=8 with one task","--nodes=8","--array=1-8"],"--cpus-per-task=8 with one task",4],["r2","Which directive requests 16 GB total job memory?",["--mem=16G","--mem-per-cpu=16G","--cpus-per-task=16","--time=16:00:00"],"--mem=16G",4],["r3","Which directive limits a job to two hours?",["--time=02:00:00","--mem=2G","--nodes=2","--array=2"],"--time=02:00:00",4],["r4","Which array creates 12 tasks with max 3 concurrent?",["--array=1-12%3","--array=3-12","--cpus-per-task=12","--ntasks=3"],"--array=1-12%3",4],["r5","Stage B should run only if A succeeds. Which dependency?",["afterok","afterany","afternotok","singleton memory"],"afterok",4],
  ["d1","Job ends OUT_OF_MEMORY and logs show memory pressure. What first?",["Memory request and application memory behavior","Add GPUs","Increase array size","Change job name"],"Memory request and application memory behavior",5],["d2","Job reaches TIMEOUT while memory is well below request. Best next step?",["Review runtime, walltime and application performance","Double memory automatically","Request GPU regardless","Resubmit unchanged"],"Review runtime, walltime and application performance",5],["d3","Downstream job is PENDING with Reason=Dependency. Inspect first?",["Upstream job state and dependency expression","Node hostname","File permissions only","GPU model"],"Upstream job state and dependency expression",5],["d4","Requested 8 CPUs but command never receives threads. Key issue?",["Slurm allocation does not automatically make the application multithreaded","Memory is always too low","Partition must be GPU","Arrays are required"],"Slurm allocation does not automatically make the application multithreaded",5],
  ["t1","Before transfer to a real site, what must be rechecked?",["Partition name/limits","SAIL-HPC accent","Certificate ID","Viewport"],"Partition name/limits",2],["t2","Which site-specific association may be required?",["Account/QOS","HTML theme","Tutorial number","SVG size"],"Account/QOS",2],["t3","Before module load Tool, what must you verify?",["Site's actual module name/version","SVG support","GitHub avatar","Queue color"],"Site's actual module name/version",2],["t4","What should be checked for input/output paths?",["Filesystem location, permissions, quota and scratch/project policy","Only extension","Only job name","Nothing"],"Filesystem location, permissions, quota and scratch/project policy",2],["t5","Safest first real-cluster transfer?",["A small test job after reading local documentation","Largest production run","Heavy work on login node","Ignore local policy"],"A small test job after reading local documentation",2]
];

boot();

function boot(){injectCSS();enhanceLearn();buildDialog();enhanceAssessment();gateCertificate();}
function injectCSS(){if(document.querySelector('link[data-depth-hotfix]'))return;const l=document.createElement("link");l.rel="stylesheet";l.href=`assets/css/learning-depth.css?v=${VERSION}`;l.dataset.depthHotfix=VERSION;document.head.append(l);}
function enhanceLearn(){const sidebar=document.querySelector(".tutorial-sidebar"),content=document.querySelector(".tutorial-content"),title=document.getElementById("lesson-title");if(!sidebar||!content||!title)return;if(!document.getElementById("building-lab-launcher")){const wrap=el("div",{className:"lab-launcher",id:"building-lab-launcher"}),btn=el("button",{type:"button"});btn.append(el("strong",{},"Slurm Building Lab"),el("small",{},"Guided scripts → arrays → dependencies → manual capstone"));btn.addEventListener("click",openLab);wrap.append(btn);sidebar.append(wrap);}let panel=document.getElementById("lesson-depth-panel");if(!panel){panel=el("section",{className:"depth-panel",id:"lesson-depth-panel"});const tip=document.getElementById("lesson-tip");tip?.parentElement?tip.parentElement.insertBefore(panel,tip):content.append(panel);}const render=()=>renderLesson(title.textContent.trim(),panel);render();new MutationObserver(render).observe(title,{childList:true,subtree:true,characterData:true});}
function renderLesson(title,panel){const data=RESOURCES[title];if(!data)return;panel.replaceChildren();const head=el("div",{className:"depth-panel-head"}),copyBox=el("div");copyBox.append(el("span",{className:"eyebrow"},"Expanded resources"),el("h3",{},"Commands, directives and real-cluster literacy"),el("p",{},data.summary));head.append(copyBox,el("span",{className:"depth-count"},`${data.items.length} items`));panel.append(head);const grid=el("div",{className:"depth-grid"});data.items.forEach(([cmd,mode,purpose])=>{const card=el("article",{className:"resource-card"}),top=el("div",{className:"resource-card-top"});top.append(el("code",{},cmd),el("span",{className:`fidelity-chip ${mode}`},mode==="modeled"?"Modeled":"Reference"));const actions=el("div",{className:"resource-actions"}),b=el("button",{type:"button"},mode==="modeled"?"Insert in terminal":"Copy example");b.addEventListener("click",()=>mode==="modeled"?openTerminal(cmd):copyText(cmd,b));actions.append(b);card.append(top,el("p",{},purpose),actions);grid.append(card);});panel.append(grid);const practice=el("div",{className:"depth-practice"}),c=el("div");c.append(el("strong",{},"Required practice for this module"),el("span",{},data.practice));const b=el("button",{type:"button"},title==="Your first batch script"?"Open Building Lab":"Open practice terminal");b.addEventListener("click",()=>title==="Your first batch script"?openLab():openTerminal(data.items.find(x=>x[1]==="modeled")?.[0]||"help"));practice.append(c,b);panel.append(practice);}
function buildDialog(){if(document.getElementById("slurm-building-lab"))return;const d=el("dialog",{className:"lab-dialog",id:"slurm-building-lab"}),shell=el("div",{className:"lab-shell"}),top=el("div",{className:"lab-topbar"}),c=el("div");c.append(el("span",{className:"eyebrow"},"Hands-on practical"),el("h2",{},"Slurm Building Lab"),el("p",{},"Write and validate batch scripts yourself; use the form Builder only after you can explain the script."));const close=el("button",{type:"button"},"Close");close.addEventListener("click",()=>d.close());top.append(c,close);const body=el("div",{className:"lab-body"}),side=el("nav",{className:"lab-sidebar"}),main=el("section",{className:"lab-main"});body.append(side,main);shell.append(top,body);d.append(shell);document.body.append(d);let current=0;const render=()=>{side.replaceChildren();LABS.forEach((lab,i)=>{const b=el("button",{type:"button",className:`lab-exercise${i===current?" active":""}`});b.append(el("span",{},lab.level),el("strong",{},lab.title),el("small",{},i===5?"100/100 required":"Practice and validate"));b.addEventListener("click",()=>{current=i;render();});side.append(b);});renderLab(LABS[current],main,current);};d._render=render;render();}
function renderLab(lab,main,index){main.replaceChildren();const brief=el("div",{className:"lab-brief"});brief.append(el("span",{className:"eyebrow"},lab.level),el("h3",{},lab.title),el("p",{},lab.brief));main.append(brief);const ta=el("textarea",{className:"lab-editor",spellcheck:"false"});ta.value=read(LAB_KEY,{})[`draft:${index}`]||lab.starter;ta.addEventListener("input",()=>{const s=read(LAB_KEY,{});s[`draft:${index}`]=ta.value;localStorage.setItem(LAB_KEY,JSON.stringify(s));});main.append(ta);const actions=el("div",{className:"lab-actions"}),check=el("button",{type:"button",className:"primary"},"Check script"),reset=el("button",{type:"button"},"Reset"),load=el("button",{type:"button"},"Load into main Builder");actions.append(check,reset,load);main.append(actions);const score=el("div",{className:"lab-score"});score.append(el("div",{className:"lab-score-head"},[el("span",{},"Not scored yet"),el("strong",{},"—")]));main.append(score);check.addEventListener("click",()=>scoreLab(lab,ta.value,score));reset.addEventListener("click",()=>{ta.value=lab.starter;score.replaceChildren(el("div",{className:"lab-score-head"},[el("span",{},"Reset"),el("strong",{},"—")]))});load.addEventListener("click",()=>loadBuilder(ta.value));}
function scoreLab(lab,script,target){const results=lab.checks.map(([label,test])=>[label,!!test(script)]),passed=results.filter(x=>x[1]).length,pct=Math.round(passed/results.length*100);target.replaceChildren();target.append(el("div",{className:"lab-score-head"},[el("span",{},`${passed} of ${results.length} rubric items satisfied`),el("strong",{},`${pct}/100`)]));const rub=el("div",{className:"rubric"});results.forEach(([label,ok])=>rub.append(el("div",{className:`rubric-item${ok?" pass":""}`},`${ok?"✓":"○"} ${label}`)));target.append(rub);}
function openLab(){const d=document.getElementById("slurm-building-lab");d?._render?.();if(d?.showModal)d.showModal();else d?.setAttribute("open","");}
function loadBuilder(script){document.getElementById("slurm-building-lab")?.close?.();location.hash="#/builder";setTimeout(()=>{const t=document.getElementById("import-text");if(t)t.value=script;document.getElementById("import-script")?.click();},120);}
function openTerminal(cmd){location.hash="#/practice";setTimeout(()=>{const i=document.getElementById("terminal-input");if(i){i.value=["sinfo","squeue","sbatch current","sacct","help"].includes(cmd)?cmd:"help";i.focus();}},100);}
function copyText(value,button){navigator.clipboard?.writeText(value).then(()=>{button.textContent="Copied";setTimeout(()=>button.textContent="Copy example",800);}).catch(()=>{});}
function enhanceAssessment(){const host=document.querySelector('[data-view="assessment"] .workspace-main');if(!host||document.getElementById("practical-readiness-exam"))return;const h=host.querySelector(".page-head h1");if(h)h.textContent="SAIL-HPC Practical Readiness Examination";const p=host.querySelector(".page-head p");if(p)p.textContent="Independent 100-point capstone: commands, resources, diagnosis, manual Slurm scripting and real-cluster transfer. 100/100 required.";const exam=el("section",{className:"readiness-exam",id:"practical-readiness-exam"});exam.append(el("div",{className:"exam-intro"},[el("span",{className:"eyebrow"},"Certificate assessment"),el("h2",{},"100/100 means every modeled competency was demonstrated"),el("p",{},"Retakes are allowed. Incorrect answers are not revealed during scoring.")]));const groups=[["A · Command selection",20,QUESTIONS.slice(0,10)],["B · Resource and directive design",20,QUESTIONS.slice(10,15)],["C · Failure and scheduler diagnosis",20,QUESTIONS.slice(15,19)],["E · Real-cluster transfer safety",10,QUESTIONS.slice(19,24)]];groups.slice(0,3).forEach(g=>exam.append(questionGroup(...g)));exam.append(scriptSection());exam.append(questionGroup(...groups[3]));const score=el("div",{className:"exam-scorecard"}),left=el("div");left.append(el("p",{},"Current submitted examination score"),el("strong",{id:"readiness-score"},`${savedScore()}/100`));const act=el("div",{className:"actions"}),submit=el("button",{type:"button",className:"primary"},"Submit examination"),reset=el("button",{type:"button"},"Reset answers");act.append(submit,reset);score.append(left,act);exam.append(score);exam.append(el("div",{className:"exam-feedback",id:"readiness-feedback"},savedScore()===100?"100/100 achieved. Certificate unlocked.":"Certificate requires 100/100."));const old=document.getElementById("assessment-task-list");old?host.insertBefore(exam,old):host.append(exam);submit.addEventListener("click",submitExam);reset.addEventListener("click",resetExam);updateExam(savedScore());}
function questionGroup(title,points,qs){const d=el("details",{className:"exam-section"}),s=el("summary");s.append(el("span",{},title),el("span",{},`${points} points`));d.append(s);const body=el("div",{className:"exam-body"});qs.forEach(([id,prompt,opts])=>{const f=el("fieldset",{className:"exam-question"});f.append(el("legend",{},prompt));const o=el("div",{className:"exam-options"});opts.forEach(v=>{const l=el("label"),i=el("input",{type:"radio",name:id,value:v});l.append(i,document.createTextNode(v));o.append(l);});f.append(o);body.append(f);});d.append(body);return d;}
function scriptSection(){const d=el("details",{className:"exam-section"}),s=el("summary");s.append(el("span",{},"D · Manual Slurm script capstone"),el("span",{},"30 points"));d.append(s);const b=el("div",{className:"exam-body"});b.append(el("p",{},"Write a complete IQ-TREE batch job: compute partition, 8 CPUs for one threaded task, 16 GB total memory, 2-hour walltime, separate stdout/stderr logs, load IQ-TREE, and ensure IQ-TREE uses the Slurm CPU allocation."));b.append(el("textarea",{className:"exam-script",id:"exam-script-editor",spellcheck:"false"}),el("p",{className:"exam-feedback"},"Scored against 10 hidden structural requirements worth 3 points each."));d.append(b);return d;}
function submitExam(){let score=0;QUESTIONS.forEach(([id,,,answer,pts])=>{if(document.querySelector(`input[name="${id}"]:checked`)?.value===answer)score+=pts;});const script=document.getElementById("exam-script-editor")?.value||"";score+=SCRIPT_CHECKS.filter(([,test])=>test(script)).length*3;localStorage.setItem(EXAM_KEY,JSON.stringify({score,submittedAt:new Date().toISOString()}));updateExam(score);}
function resetExam(){localStorage.removeItem(EXAM_KEY);document.querySelectorAll('#practical-readiness-exam input[type="radio"]').forEach(x=>x.checked=false);const t=document.getElementById("exam-script-editor");if(t)t.value="";updateExam(0);}
function savedScore(){return Number(read(EXAM_KEY,{}).score||0);}
function updateExam(score){const s=document.getElementById("readiness-score");if(s)s.textContent=`${score}/100`;const f=document.getElementById("readiness-feedback");if(f){f.textContent=score===100?"100/100 achieved. Certificate eligibility unlocked.":`${score}/100. Return to Learn, Practice and the Building Lab, then retake.`;f.classList.toggle("ok",score===100);}const old=document.getElementById("assessment-score");if(old)old.textContent=String(score);gateCertificate();}
function gateCertificate(){const claim=document.getElementById("claim-certificate");if(!claim)return;const apply=()=>{const ok=savedScore()===100;claim.disabled=!ok;claim.textContent=ok?"Claim completion certificate":"Certificate requires 100/100";};apply();if(!claim.dataset.depthGate){claim.dataset.depthGate="1";new MutationObserver(apply).observe(claim,{attributes:true,attributeFilter:["disabled"]});claim.addEventListener("click",e=>{if(savedScore()!==100){e.preventDefault();e.stopImmediatePropagation();apply();}},true);}const gen=document.getElementById("generate-certificate");if(gen)gen.disabled=savedScore()!==100;}
function read(key,fallback){try{return JSON.parse(localStorage.getItem(key)||"")||fallback;}catch{return fallback;}}
function el(tag,attrs={},children=null){const n=document.createElement(tag);Object.entries(attrs).forEach(([k,v])=>{if(k==="className")n.className=v;else if(k==="type")n.type=v;else if(k==="name")n.name=v;else if(k==="value")n.value=v;else if(k==="spellcheck")n.spellcheck=!!v;else if(v!=null)n.setAttribute(k,String(v));});if(children!=null)(Array.isArray(children)?children:[children]).forEach(c=>n.append(c instanceof Node?c:document.createTextNode(String(c))));return n;}
