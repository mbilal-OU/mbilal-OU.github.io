(() => {
  "use strict";

  const VERSION = "2.0.3";
  const USER = "student";
  const bootTime = Date.now();
  const $ = (id) => document.getElementById(id);

  const terminal = $("terminal-output");
  const input = $("command-input");
  const toastEl = $("toast");

  let commandHistory = [];
  let histPos = 0;
  let nextJobId = 73001;
  let completedUserJobs = 0;
  let condaEnv = null;
  const loadedModules = new Set();

  const partitionMeta = {
    short:   { limit: "02:00:00", label: "short CPU jobs" },
    compute: { limit: "3-00:00:00", label: "general CPU workloads" },
    highmem: { limit: "2-00:00:00", label: "memory-intensive jobs" },
    gpu:     { limit: "2-00:00:00", label: "accelerator workloads" }
  };

  const nodes = [
    { name:"short01", partition:"short", cpus:32, memGB:128, gpus:0 },
    { name:"short02", partition:"short", cpus:32, memGB:128, gpus:0 },
    { name:"cpu01", partition:"compute", cpus:64, memGB:256, gpus:0 },
    { name:"cpu02", partition:"compute", cpus:64, memGB:256, gpus:0 },
    { name:"cpu03", partition:"compute", cpus:64, memGB:256, gpus:0 },
    { name:"cpu04", partition:"compute", cpus:64, memGB:256, gpus:0 },
    { name:"cpu05", partition:"compute", cpus:64, memGB:256, gpus:0 },
    { name:"cpu06", partition:"compute", cpus:64, memGB:256, gpus:0, override:"drain" },
    { name:"hm01", partition:"highmem", cpus:128, memGB:1024, gpus:0 },
    { name:"hm02", partition:"highmem", cpus:128, memGB:1024, gpus:0 },
    { name:"gpu01", partition:"gpu", cpus:48, memGB:512, gpus:4 },
    { name:"gpu02", partition:"gpu", cpus:48, memGB:512, gpus:4 }
  ].map(n => ({ ...n, usedCpus:0, usedMemGB:0, usedGpus:0 }));

  const files = {
    "hello.sh": {
      kind:"script",
      description:"Minimal first Slurm job",
      runtime:11,
      minMemGB:1,
      content:`#!/bin/bash
#SBATCH --job-name=hello
#SBATCH --partition=short
#SBATCH --nodes=1
#SBATCH --ntasks=1
#SBATCH --cpus-per-task=1
#SBATCH --mem=1G
#SBATCH --time=00:05:00
#SBATCH --output=hello_%j.out

hostname
echo "Hello from Slurm job $SLURM_JOB_ID"`
    },
    "samples.txt": {
      kind:"data",
      description:"Example FASTQ sample sheet",
      content:`sample_A
sample_B
sample_C
sample_D
sample_E
sample_F`
    },
    "fastqc_array.sh": {
      kind:"script",
      description:"FASTQ quality-control job array",
      runtime:16,
      minMemGB:4,
      content:`#!/bin/bash
#SBATCH --job-name=fastqc
#SBATCH --partition=short
#SBATCH --array=1-6%2
#SBATCH --cpus-per-task=2
#SBATCH --mem=4G
#SBATCH --time=00:20:00
#SBATCH --output=logs/fastqc_%A_%a.out

module load FastQC
SAMPLE=$(sed -n "\${SLURM_ARRAY_TASK_ID}p" samples.txt)
fastqc --threads "$SLURM_CPUS_PER_TASK" "reads/\${SAMPLE}_R1.fastq.gz" "reads/\${SAMPLE}_R2.fastq.gz"`
    },
    "rna_align.sh": {
      kind:"script",
      description:"RNA-seq alignment stage",
      runtime:22,
      minMemGB:16,
      content:`#!/bin/bash
#SBATCH --job-name=rna_align
#SBATCH --partition=compute
#SBATCH --cpus-per-task=12
#SBATCH --mem=24G
#SBATCH --time=02:00:00
#SBATCH --output=logs/rna_align_%j.out

module load HISAT2 SAMtools
hisat2 -p "$SLURM_CPUS_PER_TASK" -x ref/genome -1 reads_R1.fastq.gz -2 reads_R2.fastq.gz | \
  samtools sort -@ 4 -o aligned.bam
samtools index aligned.bam`
    },
    "rna_counts.sh": {
      kind:"script",
      description:"RNA-seq feature-counting stage",
      runtime:13,
      minMemGB:8,
      content:`#!/bin/bash
#SBATCH --job-name=rna_counts
#SBATCH --partition=compute
#SBATCH --cpus-per-task=6
#SBATCH --mem=12G
#SBATCH --time=01:00:00
#SBATCH --output=logs/rna_counts_%j.out

module load Subread
featureCounts -T "$SLURM_CPUS_PER_TASK" -a genes.gtf -o counts.txt aligned.bam`
    },
    "align_heavy.sh": {
      kind:"script",
      description:"Memory-sensitive alignment exercise",
      runtime:15,
      minMemGB:16,
      content:`#!/bin/bash
#SBATCH --job-name=align_heavy
#SBATCH --partition=compute
#SBATCH --cpus-per-task=8
#SBATCH --mem=4G
#SBATCH --time=01:00:00

# Training scenario: this request is intentionally too small.
module load BWA SAMtools
bwa mem -t "$SLURM_CPUS_PER_TASK" ref.fa R1.fastq.gz R2.fastq.gz | samtools sort -o sample.bam`
    },
    "pangenome.sh": {
      kind:"script",
      description:"High-memory bacterial pangenome example",
      runtime:24,
      minMemGB:64,
      content:`#!/bin/bash
#SBATCH --job-name=pangenome
#SBATCH --partition=highmem
#SBATCH --cpus-per-task=32
#SBATCH --mem=96G
#SBATCH --time=12:00:00
#SBATCH --output=logs/pangenome_%j.out

module load Roary
roary -e -n -p "$SLURM_CPUS_PER_TASK" -i 50 -cd 50 gff/*.gff`
    },
    "gromacs_gpu.sh": {
      kind:"script",
      description:"GPU molecular-dynamics example",
      runtime:26,
      minMemGB:12,
      content:`#!/bin/bash
#SBATCH --job-name=md_gpu
#SBATCH --partition=gpu
#SBATCH --cpus-per-task=8
#SBATCH --mem=24G
#SBATCH --gres=gpu:1
#SBATCH --time=04:00:00
#SBATCH --output=logs/md_%j.out

module load GROMACS
srun gmx mdrun -deffnm production -ntomp "$SLURM_CPUS_PER_TASK" -nb gpu`
    }
  };

  const availableModules = [
    "FastQC", "fastp", "BWA", "SAMtools", "HISAT2", "Subread", "IQ-TREE", "Roary", "GROMACS", "Python", "R"
  ];

  const computeTools = new Set([
    "fastqc", "fastp", "bwa", "samtools", "hisat2", "featureCounts", "iqtree2", "roary", "gmx", "python", "python3", "Rscript"
  ]);

  const jobs = [];

  function pseudoSeed(v) {
    const s = String(v).split("").reduce((a,c) => a + c.charCodeAt(0), 0);
    return (s * 9301 + 49297) % 233280;
  }

  function nowClock() { return new Date().toTimeString().slice(0,8); }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function pad(v, n) { v = String(v); return v.length >= n ? v : v + " ".repeat(n-v.length); }
  function fmtElapsed(sec) {
    sec = Math.max(0, Math.floor(sec || 0));
    const d = Math.floor(sec / 86400); sec %= 86400;
    const h = Math.floor(sec / 3600); sec %= 3600;
    const m = Math.floor(sec / 60); const s = sec % 60;
    if (d) return `${d}-${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`;
    if (h) return `${h}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`;
    return `${m}:${String(s).padStart(2,"0")}`;
  }
  function parseMem(s) {
    if (typeof s === "number") return s;
    const m = String(s || "").trim().match(/^([0-9.]+)\s*([KMGT]?)B?$/i);
    if (!m) return NaN;
    const v = Number(m[1]); const u = m[2].toUpperCase();
    const mult = {K:1/1024/1024, M:1/1024, G:1, T:1024, "":1/1024}[u];
    return v * mult;
  }
  function fmtMem(gb) {
    if (!Number.isFinite(gb)) return "0G";
    if (gb < 1) return `${Math.round(gb*1024)}M`;
    return `${Math.round(gb*10)/10}G`;
  }
  function shellSplit(raw) {
    const out = [];
    const re = /"([^"]*)"|'([^']*)'|([^\s]+)/g;
    let m;
    while ((m = re.exec(raw))) out.push(m[1] ?? m[2] ?? m[3]);
    return out;
  }
  function print(text="", cls="out-line") {
    String(text).split("\n").forEach(row => {
      const div = document.createElement("div");
      div.className = `line ${cls}`;
      div.textContent = row;
      terminal.appendChild(div);
    });
    terminal.scrollTop = terminal.scrollHeight;
  }
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add("show");
    window.clearTimeout(toast._t);
    toast._t = window.setTimeout(() => toastEl.classList.remove("show"), 2400);
  }
  function currentPrompt() {
    const env = condaEnv ? `(${condaEnv}) ` : "";
    return `${env}${USER}@login-01:~$`;
  }
  function refreshPrompt() {
    document.querySelector(".prompt").textContent = currentPrompt();
    document.querySelector(".terminal-identity code").textContent = `${condaEnv ? `(${condaEnv}) ` : ""}${USER}@login-01:~`;
  }

  function nodeState(n) {
    if (n.override) return n.override;
    if (n.usedCpus === 0 && n.usedMemGB === 0 && n.usedGpus === 0) return "idle";
    const cpuFull = n.usedCpus >= n.cpus;
    const memFull = n.usedMemGB >= n.memGB * .96;
    const gpuFull = n.gpus > 0 && n.usedGpus >= n.gpus;
    return (cpuFull || memFull || gpuFull) ? "alloc" : "mix";
  }
  function avail(n) {
    return { cpus:n.cpus-n.usedCpus, memGB:n.memGB-n.usedMemGB, gpus:n.gpus-n.usedGpus };
  }

  function seedBackgroundJobs() {
    const bg = [
      { id:72104, name:"metagenome", user:"amina", partition:"compute", state:"R", cpus:24, memGB:80, gpus:0, node:"cpu01", baseSec:6380 },
      { id:72111, name:"variant_call", user:"li", partition:"compute", state:"R", cpus:16, memGB:48, gpus:0, node:"cpu02", baseSec:2850 },
      { id:72115, name:"md_prod", user:"omar", partition:"gpu", state:"R", cpus:8, memGB:64, gpus:1, node:"gpu01", baseSec:4130 },
      { id:72118, name:"assembly", user:"nora", partition:"highmem", state:"R", cpus:40, memGB:420, gpus:0, node:"hm01", baseSec:1750 },
      { id:72122, name:"qc_batch", user:"priya", partition:"short", state:"R", cpus:8, memGB:16, gpus:0, node:"short01", baseSec:480 },
      { id:72129, name:"deep_model", user:"tariq", partition:"gpu", state:"PD", cpus:12, memGB:80, gpus:4, reason:"(Priority)", baseSec:0 },
      { id:72131, name:"big_assembly", user:"sam", partition:"highmem", state:"PD", cpus:96, memGB:900, gpus:0, reason:"(Priority)", baseSec:0 }
    ];
    bg.forEach(j => {
      const job = { ...j, npc:true, nodes:1, ntasks:1, cpusPerTask:j.cpus, submittedAt:Date.now()-120000, nodelist:j.node || "", nodeNames:j.node ? [j.node] : [] };
      jobs.push(job);
      if (j.state === "R" && j.node) {
        const n = nodes.find(x => x.name === j.node);
        n.usedCpus += j.cpus; n.usedMemGB += j.memGB; n.usedGpus += j.gpus;
      }
    });
  }

  function jobElapsed(j) {
    if (j.npc) return j.state === "R" ? fmtElapsed(j.baseSec + (Date.now()-bootTime)/1000) : "0:00";
    if (j.state === "PD") return "0:00";
    const end = j.state === "R" ? Date.now() : (j.endedAt || Date.now());
    return fmtElapsed((end - (j.startedAt || j.submittedAt))/1000);
  }

  function parseArraySpec(spec) {
    if (!spec) return null;
    const [body, limitRaw] = String(spec).split("%");
    const limit = limitRaw ? Math.max(1, Number(limitRaw) || 1) : Infinity;
    const ids = [];
    for (const part of body.split(",")) {
      const stepMatch = part.match(/^(\d+)-(\d+)(?::(\d+))?$/);
      if (stepMatch) {
        const lo=+stepMatch[1], hi=+stepMatch[2], step=+(stepMatch[3] || 1);
        if (hi < lo || step < 1 || hi-lo > 1000) return null;
        for (let i=lo; i<=hi; i+=step) ids.push(i);
      } else if (/^\d+$/.test(part)) ids.push(+part);
      else return null;
    }
    return { ids:[...new Set(ids)], limit };
  }

  function defaultDirs() {
    return { name:"job", partition:"short", nodes:1, ntasks:1, cpusPerTask:1, memGB:1, gpus:0, time:"00:30:00", output:"slurm-%j.out", array:null, dependency:null, exclusive:false };
  }

  function setDir(d, flag, val) {
    const f = flag.replace(/^--?/, "");
    if (["partition","p"].includes(f)) d.partition = val;
    else if (["job-name","J"].includes(f)) d.name = val;
    else if (["nodes","N"].includes(f)) d.nodes = Math.max(1, parseInt(val) || 1);
    else if (["ntasks","n"].includes(f)) d.ntasks = Math.max(1, parseInt(val) || 1);
    else if (["cpus-per-task","c"].includes(f)) d.cpusPerTask = Math.max(1, parseInt(val) || 1);
    else if (f === "mem") { const m=parseMem(val); if (Number.isFinite(m)) d.memGB=m; }
    else if (["time","t"].includes(f)) d.time = val;
    else if (["output","o"].includes(f)) d.output = val;
    else if (["array","a"].includes(f)) d.array = val;
    else if (f === "gres") { const m=String(val).match(/gpu(?::[^:]+)?:(\d+)/); d.gpus = m ? +m[1] : (String(val).startsWith("gpu") ? 1 : 0); }
    else if (f === "gpus") d.gpus = Math.max(0, parseInt(val) || 0);
    else if (f === "dependency") {
      const m=String(val).match(/^(afterok|afterany|afternotok):(\d+(?:_\d+)?)$/);
      if (m) d.dependency = { type:m[1], jobId:m[2] };
    }
    else if (f === "exclusive") d.exclusive = true;
  }

  function parseDirectiveLine(line, d) {
    const payload = line.replace(/^\s*#SBATCH\s+/, "").trim();
    const bits = shellSplit(payload);
    if (!bits.length) return;
    const eq = bits[0].match(/^(--[^=]+)=(.*)$/);
    if (eq) setDir(d, eq[1], eq[2]);
    else if (bits[0].startsWith("-")) setDir(d, bits[0], bits[1] ?? true);
  }

  function parseScript(content) {
    const d = defaultDirs();
    for (const line of content.split("\n")) {
      if (/^\s*#SBATCH\b/.test(line)) parseDirectiveLine(line, d);
      else if (line.trim() && !line.trim().startsWith("#") && !line.startsWith("#!")) break;
    }
    return d;
  }

  function parseSbatchArgs(args, d) {
    let script = null;
    for (let i=0; i<args.length; i++) {
      const a = args[i];
      if (!a.startsWith("-")) { script = a; continue; }
      const eq = a.match(/^(--[^=]+)=(.*)$/);
      if (eq) { setDir(d, eq[1], eq[2]); continue; }
      const boolOnly = ["--exclusive"].includes(a);
      if (boolOnly) setDir(d, a, true);
      else {
        const v = args[i+1];
        if (v !== undefined && !v.startsWith("-")) { setDir(d, a, v); i++; }
        else setDir(d, a, true);
      }
    }
    return script;
  }

  function dependencyStatus(j) {
    if (!j.dependency) return "ready";
    const dep = jobs.find(x => String(x.id) === String(j.dependency.jobId));
    if (!dep) return "never";
    if (j.dependency.type === "afterok") {
      if (dep.state === "CD") return "ready";
      if (["F","OOM","CA"].includes(dep.state)) return "never";
      return "waiting";
    }
    if (j.dependency.type === "afternotok") {
      if (["F","OOM","CA"].includes(dep.state)) return "ready";
      if (dep.state === "CD") return "never";
      return "waiting";
    }
    if (j.dependency.type === "afterany") {
      return ["CD","F","OOM","CA"].includes(dep.state) ? "ready" : "waiting";
    }
    return "ready";
  }

  function runningArrayCount(root) {
    return jobs.filter(j => j.arrayRoot === root && j.state === "R").length;
  }

  function resourceRequest(j) {
    const totalCpu = Math.max(1, (j.ntasks || 1) * (j.cpusPerTask || 1));
    return {
      cpuPerNode: Math.max(1, Math.ceil(totalCpu / Math.max(1, j.nodes || 1))),
      memPerNode: Math.max(.125, j.memGB || 1),
      gpuPerNode: Math.max(0, j.gpus || 0)
    };
  }

  function findPlacement(j) {
    const req = resourceRequest(j);
    const candidates = nodes.filter(n => n.partition === j.partition && !n.override).filter(n => {
      const a = avail(n);
      if (j.exclusive && (n.usedCpus || n.usedMemGB || n.usedGpus)) return false;
      return a.cpus >= req.cpuPerNode && a.memGB >= req.memPerNode && a.gpus >= req.gpuPerNode;
    });
    if (candidates.length < j.nodes) return null;
    return candidates.sort((a,b) => (a.usedCpus/a.cpus) - (b.usedCpus/b.cpus)).slice(0,j.nodes);
  }

  function allocate(j, selected) {
    const req = resourceRequest(j);
    j.allocation = [];
    selected.forEach(n => {
      n.usedCpus += req.cpuPerNode; n.usedMemGB += req.memPerNode; n.usedGpus += req.gpuPerNode;
      j.allocation.push({ node:n.name, cpus:req.cpuPerNode, memGB:req.memPerNode, gpus:req.gpuPerNode });
    });
    j.nodeNames = selected.map(n=>n.name);
    j.nodelist = j.nodeNames.join(",");
  }

  function release(j) {
    (j.allocation || []).forEach(a => {
      const n = nodes.find(x => x.name === a.node);
      if (!n) return;
      n.usedCpus = Math.max(0, n.usedCpus-a.cpus);
      n.usedMemGB = Math.max(0, n.usedMemGB-a.memGB);
      n.usedGpus = Math.max(0, n.usedGpus-a.gpus);
    });
    j.allocation = [];
  }

  function tryScheduleAll() {
    const pending = jobs.filter(j => !j.npc && j.state === "PD").sort((a,b) => a.submitOrder-b.submitOrder);
    pending.forEach(j => {
      if (j.held) return;
      const ds = dependencyStatus(j);
      if (ds !== "ready") return;
      if (j.arrayRoot && Number.isFinite(j.arrayLimit) && runningArrayCount(j.arrayRoot) >= j.arrayLimit) return;
      const placement = findPlacement(j);
      if (!placement) return;
      allocate(j, placement);
      j.state = "R";
      j.startedAt = Date.now();
      const base = j.simRuntime || 12;
      j.endedAtPlanned = j.startedAt + (base + (pseudoSeed(j.id)%6))*1000;
      j.cpuEff = clamp(58 + (pseudoSeed(j.id)%39), 1, 99);
      j.maxRSSGB = Math.min(j.memGB*.92, Math.max(.25, (j.minMemGB || j.memGB*.5) * (.78 + (pseudoSeed(j.id)%18)/100)));
      toast(`job ${j.id} started on ${j.nodelist}`);
    });
  }

  function tryFinishAll() {
    const now = Date.now();
    jobs.filter(j => !j.npc && j.state === "R" && now >= j.endedAtPlanned).forEach(j => {
      release(j);
      j.endedAt = now;
      if (j.minMemGB && j.memGB < j.minMemGB) {
        j.state = "OOM";
        j.exitCode = "0:125";
        j.reason = "OutOfMemory";
        toast(`job ${j.id} failed: out of memory`);
      } else {
        j.state = "CD";
        j.exitCode = "0:0";
        toast(`job ${j.id} completed`);
      }
      completedUserJobs++;
    });
  }

  function submitOne(d, scriptName, fileMeta, arrayRoot=null, arrayTask=null, arrayLimit=Infinity) {
    const id = arrayRoot ? `${arrayRoot}_${arrayTask}` : nextJobId++;
    const j = {
      id, arrayRoot, arrayTask, arrayLimit,
      name:d.name, user:USER, partition:d.partition, state:"PD", nodes:d.nodes,
      ntasks:d.ntasks, cpusPerTask:d.cpusPerTask, memGB:d.memGB, gpus:d.gpus,
      time:d.time, output:d.output, dependency:d.dependency, exclusive:d.exclusive,
      script:scriptName, submittedAt:Date.now(), submitOrder:Date.now()+Math.random(),
      simRuntime:fileMeta.runtime || 12, minMemGB:fileMeta.minMemGB || 0
    };
    jobs.push(j);
    return j;
  }

  function cmdSbatch(args) {
    if (!args.length) { print("sbatch: error: no batch script specified", "err-line"); return; }
    let guessed = args.find(a => !a.startsWith("-") && files[a]);
    if (!guessed) guessed = args[args.length-1];
    if (!files[guessed] || files[guessed].kind !== "script") { print(`sbatch: error: unable to open file ${guessed || ""}`, "err-line"); return; }
    const meta = files[guessed];
    const d = parseScript(meta.content);
    const scriptName = parseSbatchArgs(args, d) || guessed;
    if (!files[scriptName]) { print(`sbatch: error: unable to open file ${scriptName}`, "err-line"); return; }
    if (!partitionMeta[d.partition]) { print(`sbatch: error: invalid partition specified: ${d.partition}`, "err-line"); return; }
    if (d.gpus > 0 && d.partition !== "gpu") { print("sbatch: error: GPU resources are only configured in the gpu partition in this training cluster", "err-line"); return; }
    const req = resourceRequest(d);
    const maxNode = nodes.filter(n=>n.partition===d.partition && !n.override).sort((a,b)=>b.cpus-a.cpus)[0];
    if (!maxNode || req.cpuPerNode > maxNode.cpus || d.memGB > maxNode.memGB || d.gpus > maxNode.gpus) {
      print("sbatch: error: requested resources cannot fit on any node in that partition", "err-line"); return;
    }
    if (d.dependency && !jobs.some(j => String(j.id) === String(d.dependency.jobId))) {
      print(`sbatch: error: Invalid dependency specified: job ${d.dependency.jobId} not found`, "err-line"); return;
    }
    const arr = parseArraySpec(d.array);
    if (d.array && !arr) { print(`sbatch: error: invalid job array specification: ${d.array}`, "err-line"); return; }
    if (arr) {
      const root = nextJobId++;
      arr.ids.forEach(task => submitOne(d, scriptName, meta, root, task, arr.limit));
      print(`Submitted batch job ${root}`, "ok-line");
      print(`  array tasks: ${arr.ids.length}${Number.isFinite(arr.limit) ? `, max ${arr.limit} running at once` : ""}`, "sys-line");
    } else {
      const j = submitOne(d, scriptName, meta);
      print(`Submitted batch job ${j.id}`, "ok-line");
      if (d.dependency) print(`  dependency: ${d.dependency.type}:${d.dependency.jobId}`, "sys-line");
    }
    tryScheduleAll();
  }

  function queueReason(j) {
    if (j.state !== "PD") return j.nodelist || "";
    if (j.held) return "(JobHeldUser)";
    const ds = dependencyStatus(j);
    if (ds === "waiting") return "(Dependency)";
    if (ds === "never") return "(DependencyNeverSatisfied)";
    if (j.arrayRoot && Number.isFinite(j.arrayLimit) && runningArrayCount(j.arrayRoot) >= j.arrayLimit) return "(JobArrayTaskLimit)";
    return j.reason || "(Resources)";
  }

  function cmdSinfo(args) {
    const pIdx = args.indexOf("-p");
    const pFilter = pIdx >= 0 ? args[pIdx+1] : null;
    const nodeMode = args.includes("-N") || args.includes("--Node");
    if (nodeMode) {
      print(pad("NODELIST",12)+pad("NODES",7)+pad("PARTITION",11)+pad("STATE",8)+pad("CPUS(A/I/O/T)",16)+"MEMORY");
      nodes.forEach(n => {
        if (pFilter && n.partition !== pFilter) return;
        const st=nodeState(n); const idle=n.override ? 0 : Math.max(0,n.cpus-n.usedCpus); const other=n.override ? n.cpus : 0;
        print(pad(n.name,12)+pad("1",7)+pad(n.partition,11)+pad(st,8)+pad(`${n.usedCpus}/${idle}/${other}/${n.cpus}`,16)+`${n.memGB}G`);
      });
      return;
    }
    print(pad("PARTITION",12)+pad("AVAIL",7)+pad("TIMELIMIT",13)+pad("NODES",7)+pad("STATE",8)+"NODELIST");
    Object.keys(partitionMeta).forEach(p => {
      if (pFilter && p !== pFilter) return;
      const ns=nodes.filter(n=>n.partition===p); const groups={};
      ns.forEach(n => (groups[nodeState(n)] ||= []).push(n.name));
      Object.entries(groups).forEach(([st,names]) => print(pad(p+(p==="compute"?"*":""),12)+pad("up",7)+pad(partitionMeta[p].limit,13)+pad(names.length,7)+pad(st,8)+names.join(",")));
    });
  }

  function cmdSqueue(args) {
    let list = jobs.filter(j => ["PD","R"].includes(j.state));
    if (args.includes("--me")) list = list.filter(j=>j.user===USER);
    let i=args.indexOf("-u"); if (i>=0) list=list.filter(j=>j.user===args[i+1]);
    i=args.indexOf("-p"); if (i>=0) list=list.filter(j=>j.partition===args[i+1]);
    i=args.indexOf("-j"); if (i>=0) list=list.filter(j=>String(j.id)===String(args[i+1]));
    const stateArg=args.find(a=>a.startsWith("--states=")); if (stateArg) { const ss=stateArg.split("=")[1].split(","); list=list.filter(j=>ss.includes(j.state)); }
    if (args.includes("--sort=-p")) list.sort((a,b)=>pseudoSeed(b.id)-pseudoSeed(a.id));
    else list.sort((a,b)=>String(a.id).localeCompare(String(b.id)));
    print(pad("JOBID",11)+pad("PARTITION",11)+pad("NAME",14)+pad("USER",10)+pad("ST",4)+pad("TIME",9)+pad("CPUS",6)+pad("MEM",8)+"NODELIST(REASON)");
    if (!list.length) { print("(no jobs match)", "sys-line"); return; }
    list.forEach(j => {
      const r=resourceRequest(j);
      print(pad(j.id,11)+pad(j.partition,11)+pad(j.name.slice(0,13),14)+pad(j.user,10)+pad(j.state,4)+pad(jobElapsed(j),9)+pad(r.cpuPerNode*j.nodes,6)+pad(fmtMem(j.memGB),8)+queueReason(j));
    });
  }

  function cmdScancel(args) {
    if (!args.length) { print("scancel: error: missing job id", "err-line"); return; }
    let targets=[];
    if (args[0] === "-u") targets=jobs.filter(j=>j.user===args[1] && ["PD","R"].includes(j.state));
    else if (args[0] === "-p") targets=jobs.filter(j=>j.partition===args[1] && j.user===USER && ["PD","R"].includes(j.state));
    else {
      const j=jobs.find(x=>String(x.id)===String(args[0]));
      if (!j) { print(`scancel: error: Invalid job id specified: ${args[0]}`, "err-line"); return; }
      targets=[j];
    }
    let count=0;
    targets.forEach(j => {
      if (j.user!==USER) { print(`scancel: error: Kill job error on job id ${j.id}: Access/permission denied`, "err-line"); return; }
      if (!["PD","R"].includes(j.state)) return;
      if (j.state==="R") release(j);
      j.state="CA"; j.endedAt=Date.now(); j.exitCode="0:15"; count++;
    });
    if (count) print(`scancel: cancelled ${count} job(s)`, "ok-line");
  }

  function cmdScontrol(args) {
    if (args[0]==="show" && args[1]==="job") {
      const j=jobs.find(x=>String(x.id)===String(args[2]));
      if (!j) { print(`scontrol: error: Job ${args[2] || ""} not found`, "err-line"); return; }
      const stateNames={PD:"PENDING",R:"RUNNING",CD:"COMPLETED",CA:"CANCELLED",OOM:"OUT_OF_MEMORY",F:"FAILED"};
      print(`JobId=${j.id} JobName=${j.name}`);
      print(`   UserId=${j.user} Partition=${j.partition} JobState=${stateNames[j.state] || j.state}`);
      print(`   NumNodes=${j.nodes || 1} NumCPUs=${resourceRequest(j).cpuPerNode*(j.nodes||1)} MinMemoryNode=${fmtMem(j.memGB)} Gres=${j.gpus ? `gpu:${j.gpus}` : "(null)"}`);
      print(`   RunTime=${jobElapsed(j)} TimeLimit=${j.time || partitionMeta[j.partition]?.limit || "N/A"} Reason=${j.state==="PD" ? queueReason(j).replace(/[()]/g,"") : "None"}`);
      if (j.dependency) print(`   Dependency=${j.dependency.type}:${j.dependency.jobId}`);
      print(`   NodeList=${j.nodelist || "(null)"} WorkDir=/home/${j.user} Command=${j.script || "N/A"}`);
      return;
    }
    if (args[0]==="show" && args[1]==="node") {
      const n=nodes.find(x=>x.name===args[2]);
      if (!n) { print(`scontrol: error: Node ${args[2] || ""} not found`, "err-line"); return; }
      const a=avail(n);
      print(`NodeName=${n.name} Partition=${n.partition} State=${nodeState(n).toUpperCase()}`);
      print(`   CPUTot=${n.cpus} CPUAlloc=${n.usedCpus} CPULoad=${(n.usedCpus/n.cpus*100).toFixed(1)}%`);
      print(`   RealMemory=${n.memGB*1024} AllocMem=${Math.round(n.usedMemGB*1024)} FreeMem=${Math.round(a.memGB*1024)} Gres=${n.gpus ? `gpu:${n.gpus}` : "(null)"}`);
      return;
    }
    if (args[0]==="show" && args[1]==="partition") {
      const p=args[2]; if (!partitionMeta[p]) { print(`scontrol: error: Partition ${p || ""} not found`, "err-line"); return; }
      const ns=nodes.filter(n=>n.partition===p);
      print(`PartitionName=${p} TotalNodes=${ns.length} State=UP MaxTime=${partitionMeta[p].limit}`);
      print(`   Nodes=${ns.map(n=>n.name).join(",")} Default=${p==="compute"?"YES":"NO"}`);
      return;
    }
    if (args[0]==="show" && args[1]==="config") {
      print("ClusterName=forge-training");
      print("SelectType=select/cons_tres");
      print("SelectTypeParameters=CR_Core_Memory");
      print("PriorityType=priority/multifactor");
      print("AccountingStorageType=accounting_storage/slurmdbd");
      print("NOTE: values are simulated for teaching.", "sys-line");
      return;
    }
    if (["hold","release"].includes(args[0])) {
      const j=jobs.find(x=>String(x.id)===String(args[1]));
      if (!j || j.user!==USER) { print("scontrol: error: invalid job id or permission denied", "err-line"); return; }
      if (j.state!=="PD") { print(`scontrol: error: Job ${j.id} is not pending`, "err-line"); return; }
      j.held=args[0]==="hold"; print(`Job ${j.id} ${j.held?"held":"released"}`, "ok-line"); return;
    }
    print("scontrol: supported: show job, show node, show partition, show config, hold, release", "sys-line");
  }

  function cmdSacct(args) {
    let list=jobs.filter(j=>j.user===USER);
    const jIdx=args.indexOf("-j"); if (jIdx>=0) list=list.filter(j=>String(j.id)===String(args[jIdx+1]) || String(j.arrayRoot)===String(args[jIdx+1]));
    list=list.slice().sort((a,b)=>String(a.id).localeCompare(String(b.id)));
    print(pad("JobID",12)+pad("JobName",15)+pad("Partition",11)+pad("State",16)+pad("Elapsed",12)+pad("MaxRSS",10)+"ExitCode");
    if (!list.length) { print("(no accounting records yet)", "sys-line"); return; }
    const names={CD:"COMPLETED",CA:"CANCELLED",OOM:"OUT_OF_MEMORY",R:"RUNNING",PD:"PENDING",F:"FAILED"};
    list.forEach(j=>print(pad(j.id,12)+pad(j.name.slice(0,14),15)+pad(j.partition,11)+pad(names[j.state]||j.state,16)+pad(jobElapsed(j),12)+pad(j.maxRSSGB?fmtMem(j.maxRSSGB):"",10)+(j.exitCode||"0:0")));
  }

  function cmdSeff(args) {
    const id=args[0]; const j=jobs.find(x=>String(x.id)===String(id));
    if (!j || j.user!==USER) { print(`seff: job ${id || ""} not found`, "err-line"); return; }
    if (["PD"].includes(j.state)) { print(`Job ID: ${j.id}\nState: PENDING\nEfficiency data is available after a job starts.`, "sys-line"); return; }
    const r=resourceRequest(j); const cpuEff=j.cpuEff || 0; const memEff=j.maxRSSGB ? (j.maxRSSGB/j.memGB*100) : 0;
    print(`Job ID: ${j.id}`);
    print(`Cluster: forge-training`);
    print(`User/Group: ${USER}/bioinfo`);
    print(`State: ${{CD:"COMPLETED",OOM:"OUT_OF_MEMORY",CA:"CANCELLED",R:"RUNNING"}[j.state] || j.state}`);
    print(`Cores: ${r.cpuPerNode*j.nodes}`);
    print(`CPU Efficiency: ${cpuEff.toFixed ? cpuEff.toFixed(1) : cpuEff}%`);
    print(`Memory Efficiency: ${memEff.toFixed(1)}% of ${fmtMem(j.memGB)} (${j.maxRSSGB ? fmtMem(j.maxRSSGB) : "sampling"} max RSS)`);
    if (j.state==="OOM") print("Recommendation: increase --mem after checking MaxRSS and application behavior.", "warn-line");
    else if (j.state==="CD" && memEff < 35) print("Right-sizing hint: the job used substantially less memory than requested.", "info-line");
  }

  function cmdSstat(args) {
    const jIdx=args.indexOf("-j"); const id=jIdx>=0 ? args[jIdx+1] : args[0];
    const j=jobs.find(x=>String(x.id)===String(id));
    if (!j || j.state!=="R") { print(`sstat: no running steps found for job ${id || ""}`, "sys-line"); return; }
    const rss=Math.max(.2,(j.maxRSSGB||j.memGB*.5)*(.82+(Date.now()%10)/100));
    print(pad("JobID",14)+pad("AveCPU",10)+pad("AveRSS",10)+pad("MaxRSS",10)+"MaxVMSize");
    print(pad(`${j.id}.batch`,14)+pad(jobElapsed(j),10)+pad(fmtMem(rss*.75),10)+pad(fmtMem(rss),10)+fmtMem(rss*1.25));
  }

  function cmdSprio(args) {
    const list=jobs.filter(j=>j.state==="PD").slice().sort((a,b)=>pseudoSeed(b.id)-pseudoSeed(a.id));
    print(pad("JOBID",12)+pad("PARTITION",12)+pad("USER",10)+pad("PRIORITY",11)+pad("AGE",8)+pad("FAIRSHARE",11)+"JOBSIZE");
    list.forEach(j=>{ const p=1000+pseudoSeed(j.id)%9000; print(pad(j.id,12)+pad(j.partition,12)+pad(j.user,10)+pad(p,11)+pad(20+pseudoSeed(j.id)%500,8)+pad(100+pseudoSeed(j.id)%800,11)+(10+pseudoSeed(j.id)%100)); });
  }

  function cmdSrun(args) {
    if (!args.length) { print("srun: error: executable name not specified", "err-line"); return; }
    if (args.includes("--pty") && args.includes("bash")) { print("srun: interactive shell allocated on short02 (simulated)", "ok-line"); print("This sandbox does not open a nested shell. Use sbatch to practice persistent jobs.", "sys-line"); return; }
    const executable=args.find(a=>!a.startsWith("-"));
    if (executable==="hostname") { print("short02"); return; }
    print(`srun: simulated launch of ${args.join(" ")}`, "info-line");
  }

  function cmdSalloc(args) {
    print("salloc: Granted job allocation 73999 (simulated interactive allocation)", "ok-line");
    print("Use srun inside an allocation on a real cluster. FORGE keeps you on the training login shell.", "sys-line");
  }

  function cmdSdiag() {
    print("Scheduler diagnostics (simulated)");
    print(`Jobs submitted: ${jobs.length}`);
    print(`Jobs running: ${jobs.filter(j=>j.state==="R").length}`);
    print(`Jobs pending: ${jobs.filter(j=>j.state==="PD").length}`);
    print("Backfill cycle mean: 42 ms");
    print("Server thread count: 18");
  }

  function cmdSacctmgr(args) {
    if (args[0]==="show" && (args[1]==="associations" || args[1]==="assoc")) {
      print(pad("Cluster",16)+pad("Account",14)+pad("User",12)+pad("Partition",12)+pad("GrpTRESMins",18)+"MaxJobs");
      print(pad("forge-training",16)+pad("bioinfo",14)+pad(USER,12)+pad("",12)+pad("cpu=250000",18)+"20");
      return;
    }
    print("sacctmgr: read-only training view supports 'show associations'", "sys-line");
  }

  function cmdModule(args) {
    const sub=args[0] || "list";
    if (["avail","av"].includes(sub)) { print("Example software modules in this training cluster:", "info-line"); print(availableModules.join("   ")); return; }
    if (sub==="load") { if (!args[1]) { print("module load: missing module name", "err-line"); return; } args.slice(1).forEach(m=>loadedModules.add(m)); print(`Loaded: ${args.slice(1).join(", ")}`, "ok-line"); return; }
    if (sub==="unload") { args.slice(1).forEach(m=>loadedModules.delete(m)); print(`Unloaded: ${args.slice(1).join(", ")}`, "ok-line"); return; }
    if (sub==="purge") { loadedModules.clear(); print("All modules unloaded", "ok-line"); return; }
    if (sub==="list") { print(loadedModules.size ? [...loadedModules].join("   ") : "No modules loaded", "sys-line"); return; }
    print("module: supported: avail, load, unload, purge, list", "sys-line");
  }

  function cmdConda(args) {
    if (args[0]==="env" && args[1]==="list") { print("# conda environments:\nbase                 /opt/conda\nbioinfo              /opt/conda/envs/bioinfo\n rnaseq               /opt/conda/envs/rnaseq"); return; }
    if (args[0]==="activate") { condaEnv=args[1] || "base"; refreshPrompt(); print(`Activated environment: ${condaEnv}`, "ok-line"); return; }
    if (args[0]==="deactivate") { condaEnv=null; refreshPrompt(); return; }
    print("conda: supported: env list, activate <env>, deactivate", "sys-line");
  }

  const manuals = {
    sbatch:"sbatch [OPTIONS] script\nSubmit a batch script. Practice --partition, --cpus-per-task, --mem, --time, --array, --gres and --dependency in FORGE.",
    squeue:"squeue [OPTIONS]\nInspect active jobs. Practice --me, -u USER, -p PARTITION, -j JOBID and --states=R,PD.",
    sinfo:"sinfo [OPTIONS]\nInspect partitions and node states. Practice -N and -p PARTITION.",
    sacct:"sacct [-j JOBID]\nInspect job accounting after submission and completion.",
    scontrol:"scontrol show job|node|partition|config ...\nInspect and manage scheduler objects. FORGE also supports hold and release.",
    seff:"seff JOBID\nSummarize simulated CPU and memory efficiency for one user job."
  };

  function cmdMan(args) { const m=manuals[args[0]]; print(m || `No local FORGE manual entry for ${args[0] || ""}.`, m?"info-line":"sys-line"); }
  function cmdLs() { print(Object.keys(files).join("   ")); }
  function cmdCat(args) { const f=files[args[0]]; if (!f) print(`cat: ${args[0] || ""}: No such file or directory`, "err-line"); else print(f.content); }
  function cmdHistory() { commandHistory.forEach((c,i)=>print(`${String(i+1).padStart(4," ")}  ${c}`)); }
  function cmdWhoami() { print(USER); }
  function cmdPwd() { print(`/home/${USER}`); }
  function cmdHelp() {
    print("FORGE command groups", "info-line");
    print("Slurm: sinfo squeue sbatch scancel scontrol sacct srun salloc sstat sprio seff sdiag sacctmgr");
    print("Environment: module conda");
    print("Shell: ls cat pwd whoami history clear man help");
    print("Tip: use the Learn and Labs tabs to run guided commands.", "sys-line");
  }

  const catalog = [
    { name:"Cluster basics", items:[
      ["sinfo","Show partitions and aggregate node states"],
      ["sinfo -N","Switch to a node-by-node resource view"],
      ["sinfo -p gpu","Inspect only the GPU partition"],
      ["squeue","Show all running and pending jobs"],
      ["squeue --me","Show only your jobs"],
      ["whoami","Confirm your training-cluster user"],
      ["ls","List pre-staged sandbox files"]
    ]},
    { name:"Batch resources", items:[
      ["cat hello.sh","Inspect a minimal batch script before submitting it"],
      ["sbatch hello.sh","Submit your first job"],
      ["sbatch --cpus-per-task=8 --mem=16G rna_align.sh","Override resource directives at submission"],
      ["sbatch --partition=gpu --gres=gpu:1 gromacs_gpu.sh","Request a GPU as a generic resource"],
      ["scontrol show job {JOBID}","Inspect the full job record"],
      ["scancel {JOBID}","Cancel a job that you own"]
    ]},
    { name:"Software modules", items:[
      ["module avail","Discover scientific software available on the cluster"],
      ["module load HISAT2 SAMtools","Load software required by an alignment workflow"],
      ["module list","Verify the modules currently loaded in your environment"],
      ["module purge","Remove all loaded modules before starting a clean environment"],
      ["conda env list","List example Conda environments"],
      ["conda activate bioinfo","Activate a training bioinformatics environment"],
      ["roary -e -n -p 32 gff/*.gff","Trigger the login-node policy warning for a compute-heavy tool"]
    ]},
    { name:"Arrays and dependencies", items:[
      ["cat fastqc_array.sh","Inspect a sample-parallel QC array"],
      ["sbatch --array=1-6%2 fastqc_array.sh","Submit six array tasks with a concurrency cap of two"],
      ["sbatch rna_align.sh","Submit the first stage of an RNA-seq workflow"],
      ["sbatch --dependency=afterok:{JOBID} rna_counts.sh","Start counting only after alignment succeeds"],
      ["squeue --states=R,PD","Filter the queue by active states"]
    ]},
    { name:"Monitoring and efficiency", items:[
      ["sacct","Review your accounting history"],
      ["sstat -j {RUNNING_JOBID}","Inspect live statistics for a running user job"],
      ["seff {JOBID}","Summarize CPU and memory efficiency"],
      ["sprio","Inspect pending-job priority factors"],
      ["scontrol show node cpu01","Inspect allocatable resources on one node"],
      ["sdiag","Inspect scheduler-level diagnostics"]
    ]}
  ];

  const labDefs = [
    {
      title:"First batch job",
      desc:"Inspect the cluster, read a script, submit it and verify its accounting record.",
      steps:[
        ["Inspect available partitions","sinfo", /^sinfo(?:\s|$)/],
        ["Read the batch script","cat hello.sh", /^cat\s+hello\.sh$/],
        ["Submit the script","sbatch hello.sh", /^sbatch\s+hello\.sh$/],
        ["Watch your queue","squeue --me", /^squeue\s+--me$/],
        ["Check accounting","sacct", /^sacct(?:\s|$)/]
      ]
    },
    {
      title:"Software modules and environments",
      desc:"Practice the module workflow used on shared HPC systems before launching scientific software.",
      steps:[
        ["Discover available software","module avail", /^module\s+avail$/],
        ["Load analysis tools","module load HISAT2 SAMtools", /^module\s+load\s+HISAT2\s+SAMtools$/],
        ["Verify your environment","module list", /^module\s+list$/],
        ["Inspect Conda environments","conda env list", /^conda\s+env\s+list$/],
        ["Return to a clean module state","module purge", /^module\s+purge$/]
      ]
    },
    {
      title:"FASTQ QC with a job array",
      desc:"Use one array task per sample and cap concurrent work to avoid flooding the partition.",
      steps:[
        ["Inspect the sample sheet","cat samples.txt", /^cat\s+samples\.txt$/],
        ["Inspect the array script","cat fastqc_array.sh", /^cat\s+fastqc_array\.sh$/],
        ["Submit the array","sbatch --array=1-6%2 fastqc_array.sh", /^sbatch\b.*fastqc_array\.sh$/],
        ["Inspect array tasks","squeue --me", /^squeue\s+--me$/],
        ["Review all task records","sacct", /^sacct(?:\s|$)/]
      ]
    },
    {
      title:"RNA-seq dependency chain",
      desc:"Separate alignment and counting into jobs linked with afterok so stage 2 cannot start early.",
      steps:[
        ["Submit alignment","sbatch rna_align.sh", /^sbatch\s+rna_align\.sh$/],
        ["Chain feature counting","sbatch --dependency=afterok:{JOBID} rna_counts.sh", /^sbatch\b.*--dependency=afterok:\S+.*rna_counts\.sh$/],
        ["Observe dependency state","squeue --me", /^squeue\s+--me$/],
        ["Inspect the dependent job","scontrol show job {JOBID}", /^scontrol\s+show\s+job\s+\S+$/],
        ["Verify workflow history","sacct", /^sacct(?:\s|$)/]
      ]
    },
    {
      title:"Diagnose an out-of-memory job",
      desc:"Run an intentionally under-sized alignment, inspect the failure and resubmit with adequate memory.",
      steps:[
        ["Submit the under-sized job","sbatch align_heavy.sh", /^sbatch\s+align_heavy\.sh$/],
        ["Inspect accounting after failure","sacct", /^sacct(?:\s|$)/],
        ["Inspect efficiency","seff {JOBID}", /^seff\s+\S+$/],
        ["Resubmit with more memory","sbatch --mem=24G align_heavy.sh", /^sbatch\b.*--mem(?:=|\s+)24G.*align_heavy\.sh$/],
        ["Compare efficiency","seff {JOBID}", /^seff\s+\S+$/]
      ]
    },
    {
      title:"GPU scientific workload",
      desc:"Request an accelerator explicitly, monitor the running job and inspect final efficiency.",
      steps:[
        ["Inspect GPU nodes","sinfo -p gpu", /^sinfo\s+-p\s+gpu$/],
        ["Inspect the GPU script","cat gromacs_gpu.sh", /^cat\s+gromacs_gpu\.sh$/],
        ["Submit the GPU job","sbatch gromacs_gpu.sh", /^sbatch\s+gromacs_gpu\.sh$/],
        ["Sample live resource usage","sstat -j {RUNNING_JOBID}", /^sstat\b.*-j\s+\S+$/],
        ["Review efficiency","seff {JOBID}", /^seff\s+\S+$/]
      ]
    }
  ];

  let labProgress = loadLabProgress();
  function loadLabProgress() {
    try {
      const raw=JSON.parse(localStorage.getItem("forge-lab-progress-v2") || "null");
      if (Array.isArray(raw) && raw.length===labDefs.length) return raw;
    } catch (_) {}
    return labDefs.map(l=>l.steps.map(()=>false));
  }
  function saveLabProgress() { try { localStorage.setItem("forge-lab-progress-v2", JSON.stringify(labProgress)); } catch (_) {} }

  function resolveTemplate(cmd) {
    const mine=jobs.filter(j=>j.user===USER);
    const latest=[...mine].reverse()[0];
    const running=[...mine].reverse().find(j=>j.state==="R");
    return cmd.replaceAll("{JOBID}", latest ? latest.id : "73001").replaceAll("{RUNNING_JOBID}", running ? running.id : (latest ? latest.id : "73001"));
  }

  function checkLabs(raw) {
    labDefs.forEach((lab,li)=>lab.steps.forEach((s,si)=>{
      if (!labProgress[li][si] && labProgress[li].slice(0,si).every(Boolean) && s[2].test(raw.trim())) {
        labProgress[li][si]=true; saveLabProgress();
        toast(`Lab ${li+1}: step ${si+1} complete`);
      }
    }));
    renderLabs();
  }

  function runCommand(raw) {
    const trimmed=String(raw || "").trim();
    if (!trimmed) return;
    print(`${currentPrompt()} ${trimmed}`, "prompt-line");
    commandHistory.push(trimmed); histPos=commandHistory.length;
    const parts=shellSplit(trimmed); const cmd=parts[0], args=parts.slice(1);
    if (computeTools.has(cmd)) {
      print(`Policy warning: '${cmd}' is a compute-heavy scientific command and should not be run on the login node.`, "warn-line");
      print("Create or inspect an sbatch script, request appropriate resources, then submit it with sbatch.", "sys-line");
      checkLabs(trimmed); return;
    }
    switch (cmd) {
      case "sinfo": cmdSinfo(args); break;
      case "squeue": cmdSqueue(args); break;
      case "sbatch": cmdSbatch(args); break;
      case "scancel": cmdScancel(args); break;
      case "scontrol": cmdScontrol(args); break;
      case "sacct": cmdSacct(args); break;
      case "srun": cmdSrun(args); break;
      case "salloc": cmdSalloc(args); break;
      case "sstat": cmdSstat(args); break;
      case "sprio": cmdSprio(args); break;
      case "seff": cmdSeff(args); break;
      case "sdiag": cmdSdiag(); break;
      case "sacctmgr": cmdSacctmgr(args); break;
      case "module": cmdModule(args); break;
      case "conda": cmdConda(args); break;
      case "ls": cmdLs(); break;
      case "cat": cmdCat(args); break;
      case "pwd": cmdPwd(); break;
      case "whoami": cmdWhoami(); break;
      case "history": cmdHistory(); break;
      case "man": cmdMan(args); break;
      case "clear": terminal.innerHTML=""; break;
      case "help": cmdHelp(); break;
      default: print(`${cmd}: command not found. Type 'help' or use the Learn tab.`, "err-line");
    }
    checkLabs(trimmed);
    renderAll();
  }

  function renderCatalog(filter="") {
    const wrap=$("command-catalog"); wrap.innerHTML="";
    const f=filter.toLowerCase().trim(); let count=0;
    catalog.forEach((cat,catIndex)=>{
      const items=cat.items.filter(([cmd,desc])=>!f || cmd.toLowerCase().includes(f) || desc.toLowerCase().includes(f));
      if (!items.length) return;
      count += items.length;
      const sec=document.createElement("section"); sec.className="cat"; sec.dataset.category=cat.name;
      sec.innerHTML=`<div class="cat-head"><b><span class="cat-index">${String(catIndex+1).padStart(2,"0")}</span>${cat.name}</b><span>${items.length}</span></div>`;
      items.forEach(([cmd,desc])=>{
        const el=document.createElement("div"); el.className="cmd-item"; el.tabIndex=0;
        el.innerHTML=`<code></code><div class="desc"></div>`;
        el.querySelector("code").textContent=cmd; el.querySelector(".desc").textContent=desc;
        const fire=()=>runCommand(resolveTemplate(cmd));
        el.onclick=fire; el.onkeydown=e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();fire();}};
        sec.appendChild(el);
      });
      wrap.appendChild(sec);
    });
    if (!count) wrap.innerHTML=`<div class="no-results">No matching commands</div>`;
  }

  function renderLabs() {
    const wrap=$("lab-list"); const previousOpen=wrap.querySelector(".lab-card.open")?.dataset.lab;
    wrap.innerHTML="";
    let firstIncomplete=labProgress.findIndex(p=>p.some(x=>!x)); if(firstIncomplete<0) firstIncomplete=0;
    labDefs.forEach((lab,li)=>{
      const done=labProgress[li].filter(Boolean).length; const complete=done===lab.steps.length;
      const card=document.createElement("article"); card.className=`lab-card ${complete?"complete":""} ${li===firstIncomplete?"current":""}`; card.dataset.lab=li;
      if (String(li)===previousOpen || (!previousOpen && li===firstIncomplete)) card.classList.add("open");
      const head=document.createElement("div"); head.className="lab-head";
      head.innerHTML=`<div class="lab-num">${complete?"✓":li+1}</div><div class="lab-copy"><strong></strong><p></p><div class="lab-progress"><span style="width:${done/lab.steps.length*100}%"></span></div></div>`;
      head.querySelector("strong").textContent=lab.title; head.querySelector("p").textContent=lab.desc;
      head.onclick=()=>card.classList.toggle("open"); card.appendChild(head);
      const steps=document.createElement("div"); steps.className="lab-steps";
      lab.steps.forEach((s,si)=>{
        const row=document.createElement("div"); row.className=`lab-step ${labProgress[li][si]?"done":""}`;
        const label=document.createElement("span"); label.textContent=s[0]; const code=document.createElement("code"); code.textContent=s[1]; code.title="Run this command"; code.onclick=e=>{e.stopPropagation();runCommand(resolveTemplate(s[1]));};
        row.append(label,code); steps.appendChild(row);
      });
      card.appendChild(steps); wrap.appendChild(card);
    });
  }

  const capstoneChecks = [
    ["Bash shebang", text => /^#!\s*\/bin\/bash/m.test(text)],
    ["Job name", text => /^#SBATCH\s+--job-name(?:=|\s+)\S+/m.test(text)],
    ["short partition", text => /^#SBATCH\s+--partition(?:=|\s+)short\b/m.test(text)],
    ["2 CPUs per task", text => /^#SBATCH\s+--cpus-per-task(?:=|\s+)2\b/m.test(text)],
    ["4 GB memory", text => /^#SBATCH\s+--mem(?:=|\s+)(?:4G|4096M)\b/im.test(text)],
    ["20 minute walltime", text => /^#SBATCH\s+--time(?:=|\s+)(?:00:20:00|0-00:20:00)\b/m.test(text)],
    ["Log output in logs/", text => /^#SBATCH\s+--output(?:=|\s+)logs\/\S+/m.test(text)],
    ["Load FastQC module", text => /^\s*module\s+load\s+.*\bFastQC\b/im.test(text)],
    ["Run FastQC on both reads", text => /\bfastqc\b[^\n]*sample_A_R1\.fastq\.gz[^\n]*sample_A_R2\.fastq\.gz/im.test(text)]
  ];

  function validateCapstoneScript() {
    const editor=$("script-workshop-editor");
    if (!editor) return {all:false, results:[]};
    const text=editor.value;
    const results=capstoneChecks.map(([label,test])=>({label, pass:Boolean(test(text))}));
    return {all:results.every(r=>r.pass), results};
  }

  function renderCapstoneChecklist() {
    const wrap=$("script-checklist");
    if (!wrap) return false;
    const result=validateCapstoneScript();
    wrap.innerHTML="";
    result.results.forEach(r=>{
      const row=document.createElement("div");
      row.className=`script-check ${r.pass?"pass":"fail"}`;
      row.textContent=r.label;
      wrap.appendChild(row);
    });
    return result.all;
  }

  function setCapstoneFeedback(message, state="") {
    const el=$("script-workshop-feedback");
    if (!el) return;
    el.textContent=message;
    el.className=`workshop-feedback ${state}`.trim();
  }

  function saveCapstoneScript(requireValid=false) {
    const valid=renderCapstoneChecklist();
    if (requireValid && !valid) {
      setCapstoneFeedback("The script still has missing requirements. Fix the highlighted checks before submitting.", "bad");
      return false;
    }
    files["capstone_job.sh"]={kind:"script",description:"Manually written Slurm capstone script",runtime:16,minMemGB:4,content:$("script-workshop-editor").value};
    renderScriptList();
    setCapstoneFeedback(valid ? "All checks passed. capstone_job.sh is ready to submit." : "Draft saved as capstone_job.sh. Complete the remaining checks before submitting.", valid?"good":"bad");
    return true;
  }

  function generateBuilderScript() {
    const name=$("build-name").value.trim() || "my_analysis";
    const part=$("build-partition").value;
    const cpus=Math.max(1,Number($("build-cpus").value)||1);
    const mem=Math.max(1,Number($("build-mem").value)||1);
    const time=$("build-time").value.trim() || "01:00:00";
    const gpus=Math.max(0,Number($("build-gpus").value)||0);
    const array=$("build-array").value.trim();
    const command=$("build-command").value.trim() || "echo analysis";
    let lines=["#!/bin/bash",`#SBATCH --job-name=${name}`,`#SBATCH --partition=${part}`,`#SBATCH --cpus-per-task=${cpus}`,`#SBATCH --mem=${mem}G`,`#SBATCH --time=${time}`,`#SBATCH --output=${name}_%j.out`];
    if (array) lines.push(`#SBATCH --array=${array}`);
    if (gpus) lines.push(`#SBATCH --gres=gpu:${gpus}`);
    lines.push("", "set -euo pipefail", "", command);
    return lines.join("\n");
  }

  function renderBuilderPreview() { $("script-preview").textContent=generateBuilderScript(); }
  function saveCustomScript(showToast=true) {
    files["custom_job.sh"]={kind:"script",description:"Generated with the FORGE batch builder",runtime:15,minMemGB:0,content:generateBuilderScript()};
    renderScriptList(); if(showToast) toast("custom_job.sh saved in the sandbox");
  }
  function renderScriptList() {
    const wrap=$("script-list"); wrap.innerHTML="";
    Object.entries(files).forEach(([name,meta])=>{
      const b=document.createElement("button"); b.type="button"; b.className="script-chip"; b.textContent=name; b.title=meta.description || "";
      b.onclick=()=>runCommand(`cat ${name}`); wrap.appendChild(b);
    });
  }

  function renderMetrics() {
    const eligible=nodes.filter(n=>!n.override);
    const totalCpu=eligible.reduce((a,n)=>a+n.cpus,0), usedCpu=eligible.reduce((a,n)=>a+n.usedCpus,0);
    const totalMem=eligible.reduce((a,n)=>a+n.memGB,0), usedMem=eligible.reduce((a,n)=>a+n.usedMemGB,0);
    const totalGpu=eligible.reduce((a,n)=>a+n.gpus,0), usedGpu=eligible.reduce((a,n)=>a+n.usedGpus,0);
    const cpuPct=Math.round(usedCpu/totalCpu*100), memPct=Math.round(usedMem/totalMem*100), gpuPct=totalGpu?Math.round(usedGpu/totalGpu*100):0;
    $("cpu-label").textContent=`${cpuPct}%`; $("cpu-meter").style.width=`${cpuPct}%`; $("cpu-detail").textContent=`${usedCpu} / ${totalCpu} cores allocated`;
    $("mem-label").textContent=`${memPct}%`; $("mem-meter").style.width=`${memPct}%`; $("mem-detail").textContent=`${Math.round(usedMem)} / ${totalMem} GB allocated`;
    $("gpu-label").textContent=`${gpuPct}%`; $("gpu-meter").style.width=`${gpuPct}%`; $("gpu-detail").textContent=`${usedGpu} / ${totalGpu} GPUs allocated`;
    const running=jobs.filter(j=>j.state==="R").length, pending=jobs.filter(j=>j.state==="PD").length;
    $("queue-label").textContent=running+pending; $("running-count").textContent=running; $("pending-count").textContent=pending; $("completed-detail").textContent=`${completedUserJobs} user jobs finished`;
  }

  function renderQueue() {
    const body=$("queue-body"); body.innerHTML="";
    jobs.filter(j=>["R","PD"].includes(j.state)).sort((a,b)=>String(a.id).localeCompare(String(b.id))).forEach(j=>{
      const tr=document.createElement("tr"); const r=resourceRequest(j);
      [j.id,j.partition,j.name,j.user,j.state,jobElapsed(j),r.cpuPerNode*j.nodes,fmtMem(j.memGB),queueReason(j)].forEach((v,i)=>{const td=document.createElement("td");td.textContent=v;if(i===4)td.className=`state-${j.state}`;tr.appendChild(td);});
      body.appendChild(tr);
    });
    const recent=$("recent-body"); recent.innerHTML="";
    jobs.filter(j=>j.user===USER).slice().reverse().slice(0,10).forEach(j=>{
      const tr=document.createElement("tr");
      [j.id,j.state,jobElapsed(j),j.maxRSSGB?fmtMem(j.maxRSSGB):"",j.cpuEff?`${Math.round(j.cpuEff)}%`:""].forEach((v,i)=>{const td=document.createElement("td");td.textContent=v;if(i===1)td.className=`state-${j.state}`;tr.appendChild(td);});
      recent.appendChild(tr);
    });
  }

  function renderNodes() {
    const pc=$("partition-cards"); pc.innerHTML="";
    Object.entries(partitionMeta).forEach(([p,m])=>{
      const ns=nodes.filter(n=>n.partition===p); const idle=ns.filter(n=>nodeState(n)==="idle").length;
      const c=document.createElement("div"); c.className="partition-card";
      c.innerHTML=`<div class="p-top"><strong>${p}</strong><span>up</span></div><p>${ns.length} nodes | ${idle} idle<br>limit ${m.limit}<br>${m.label}</p>`; pc.appendChild(c);
    });
    const ng=$("node-grid"); ng.innerHTML="";
    nodes.forEach(n=>{
      const st=nodeState(n), a=avail(n); const c=document.createElement("div"); c.className="node-card";
      c.innerHTML=`<div class="node-top"><strong>${n.name}</strong><span class="node-state ${st}">${st}</span></div><p>${n.partition}<br>CPU ${n.usedCpus}/${n.cpus} | MEM ${Math.round(n.usedMemGB)}/${n.memGB}G${n.gpus?` | GPU ${n.usedGpus}/${n.gpus}`:""}<br>free: ${a.cpus} cores, ${Math.round(a.memGB)}G</p>`; ng.appendChild(c);
    });
  }

  function renderAll() { renderMetrics(); renderQueue(); renderNodes(); renderScriptList(); }

  function setupTabs() {
    document.querySelectorAll(".tab").forEach(tab=>tab.addEventListener("click",()=>{
      document.querySelectorAll(".tab").forEach(x=>x.classList.remove("active")); document.querySelectorAll(".tabpane").forEach(x=>x.classList.remove("active"));
      tab.classList.add("active"); $(`pane-${tab.dataset.tab}`).classList.add("active");
    }));
  }

  function setupEvents() {
    $("command-form").addEventListener("submit",e=>{e.preventDefault();const v=input.value;input.value="";runCommand(v);});
    input.addEventListener("keydown",e=>{
      if(e.key==="ArrowUp"){if(histPos>0){histPos--;input.value=commandHistory[histPos]||"";}e.preventDefault();}
      if(e.key==="ArrowDown"){if(histPos<commandHistory.length){histPos++;input.value=commandHistory[histPos]||"";}e.preventDefault();}
    });
    $("terminal-help").onclick=()=>runCommand("help");
    $("reset-cluster").onclick=()=>{try{localStorage.removeItem("forge-lab-progress-v2");}catch(_){} location.reload();};
    $("command-search").addEventListener("input",e=>renderCatalog(e.target.value));
    document.querySelectorAll("[data-run-command]").forEach(btn=>btn.addEventListener("click",()=>runCommand(btn.dataset.runCommand)));
    document.querySelectorAll("[data-open-tab]").forEach(btn=>btn.addEventListener("click",()=>{
      const target=document.querySelector(`.tab[data-tab="${btn.dataset.openTab}"]`); if(target) target.click();
    }));
    document.querySelectorAll("[data-catalog-target]").forEach(btn=>btn.addEventListener("click",()=>{
      const target=document.querySelector(`.cat[data-category="${btn.dataset.catalogTarget}"]`);
      if(target) target.scrollIntoView({behavior:"smooth",block:"start"});
    }));
    const capEditor=$("script-workshop-editor");
    if (capEditor) capEditor.addEventListener("input",()=>{renderCapstoneChecklist(); setCapstoneFeedback("Keep writing. The checklist updates as your script becomes complete.");});
    if ($("check-capstone-script")) $("check-capstone-script").onclick=()=>{
      const valid=renderCapstoneChecklist();
      setCapstoneFeedback(valid ? "Excellent. Your script contains every required Slurm and workflow component." : "Some requirements are still missing. Use the checklist to finish the script.", valid?"good":"bad");
    };
    if ($("save-capstone-script")) $("save-capstone-script").onclick=()=>{saveCapstoneScript(false); toast("capstone_job.sh saved in the sandbox");};
    if ($("submit-capstone-script")) $("submit-capstone-script").onclick=()=>{if(saveCapstoneScript(true)) runCommand("sbatch capstone_job.sh");};
    ["build-name","build-partition","build-cpus","build-mem","build-time","build-gpus","build-array","build-command"].forEach(id=>$(id).addEventListener("input",renderBuilderPreview));
    $("save-script").onclick=()=>saveCustomScript(true);
    $("run-script").onclick=()=>{saveCustomScript(false);runCommand("sbatch custom_job.sh");};
  }

  function boot() {
    $("version-badge").textContent=`v${VERSION}`;
    seedBackgroundJobs();
    setupTabs(); setupEvents(); renderCatalog(); renderLabs(); renderCapstoneChecklist(); renderBuilderPreview(); renderAll(); refreshPrompt();
    print(`FORGE Slurm Lab ${VERSION} online`, "info-line");
    print("Training cluster: 4 partitions, 12 nodes, live resource-aware scheduler", "sys-line");
    print("This is a simulation. It does not run Slurm or process real bioinformatics data.", "warn-line");
    print("Use the highlighted command bar above. Start with 'sinfo', then follow Learn or the guided Labs.", "sys-line");
    print("");
    window.setInterval(()=>{
      tryScheduleAll(); tryFinishAll(); renderMetrics(); renderQueue(); renderNodes(); $("clock").textContent=nowClock();
    },1000);
    $("clock").textContent=nowClock();
    input.focus();
  }

  boot();
})();
