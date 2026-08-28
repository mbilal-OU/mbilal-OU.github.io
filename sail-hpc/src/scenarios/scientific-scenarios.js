export const SCIENTIFIC_SCENARIO_SET_VERSION = "1.0.0-rc1";

const scenarios = [
  scenario({
    id: "script-wrapper-v1",
    title: "Custom Python or R script wrapper",
    learningObjective: "Move an existing non-interactive script into a transparent Slurm batch workflow without inheriting a scientific failure model.",
    spec: {
      jobName: "script_job",
      partition: "short",
      nodes: 1,
      ntasks: 1,
      cpusPerTask: 2,
      memoryMB: 4096,
      walltimeSeconds: 1200,
      gpus: 0,
      commandBlock: "python3 analysis.py input.tsv results.tsv",
    },
    workload: { modeledRuntimeSeconds: 180, peakMemoryMB: 1536, cpuUtilizationFraction: 0.55 },
    expectedOutcome: "COMPLETED",
  }),
  scenario({
    id: "fastq-qc-array-v1",
    title: "FASTQ quality-control array",
    learningObjective: "Use a Slurm job array and a concurrency cap for sample-parallel work.",
    spec: {
      jobName: "fastqc",
      partition: "short",
      nodes: 1,
      ntasks: 1,
      cpusPerTask: 2,
      memoryMB: 4096,
      walltimeSeconds: 1200,
      gpus: 0,
      array: { specification: "1-6%2" },
      output: "logs/fastqc_%A_%a.out",
      modules: ["FastQC"],
      commandBlock: "fastqc --threads \"$SLURM_CPUS_PER_TASK\" reads/${SAMPLE}_R1.fastq.gz reads/${SAMPLE}_R2.fastq.gz",
    },
    workload: { modeledRuntimeSeconds: 90, peakMemoryMB: 2600, cpuUtilizationFraction: 0.78 },
    expectedOutcome: "COMPLETED",
  }),
  scenario({
    id: "rna-seq-dependency-v1",
    title: "RNA-seq dependency chain",
    learningObjective: "Chain an alignment stage to a downstream counting stage with afterok.",
    spec: {
      jobName: "rna_align",
      partition: "compute",
      nodes: 1,
      ntasks: 1,
      cpusPerTask: 12,
      memoryMB: 24576,
      walltimeSeconds: 7200,
      modules: ["HISAT2", "SAMtools"],
      commandBlock: "hisat2 -p \"$SLURM_CPUS_PER_TASK\" -x ref/genome -1 reads_R1.fastq.gz -2 reads_R2.fastq.gz | samtools sort -o aligned.bam",
    },
    workload: { modeledRuntimeSeconds: 900, peakMemoryMB: 16200, cpuUtilizationFraction: 0.81 },
    expectedOutcome: "COMPLETED",
  }),
  scenario({
    id: "alignment-oom-v1",
    title: "Memory-sensitive sequence alignment",
    learningObjective: "Diagnose modeled out-of-memory failure and revise the memory request.",
    spec: {
      jobName: "align_heavy",
      partition: "compute",
      nodes: 1,
      ntasks: 1,
      cpusPerTask: 8,
      memoryMB: 4096,
      walltimeSeconds: 3600,
      modules: ["BWA", "SAMtools"],
      commandBlock: "bwa mem -t \"$SLURM_CPUS_PER_TASK\" ref.fa R1.fastq.gz R2.fastq.gz | samtools sort -o sample.bam",
    },
    workload: {
      modeledRuntimeSeconds: 1200,
      peakMemoryMB: 15000,
      cpuUtilizationFraction: 0.74,
      memoryFailure: { atSeconds: 180, requiredMemoryMB: 16384 },
    },
    expectedOutcome: "OUT_OF_MEMORY",
    revision: { memoryMB: 20480 },
    revisedExpectedOutcome: "COMPLETED",
  }),
  scenario({
    id: "bacterial-pangenome-v1",
    title: "Bacterial pangenome analysis",
    learningObjective: "Reason about CPU, memory and walltime for a memory-intensive bioinformatics workload.",
    spec: {
      jobName: "pangenome",
      partition: "highmem",
      nodes: 1,
      ntasks: 1,
      cpusPerTask: 32,
      memoryMB: 98304,
      walltimeSeconds: 43200,
      modules: ["Roary"],
      commandBlock: "roary -e -n -p \"$SLURM_CPUS_PER_TASK\" -i 50 -cd 50 gff/*.gff",
    },
    workload: { modeledRuntimeSeconds: 14400, peakMemoryMB: 76000, cpuUtilizationFraction: 0.84 },
    expectedOutcome: "COMPLETED",
  }),
  scenario({
    id: "phylogeny-threading-v1",
    title: "Phylogenetic inference",
    learningObjective: "Connect thread count and walltime to a CPU-bound scientific workload.",
    spec: {
      jobName: "phylogeny",
      partition: "compute",
      nodes: 1,
      ntasks: 1,
      cpusPerTask: 16,
      memoryMB: 16384,
      walltimeSeconds: 7200,
      modules: ["IQ-TREE"],
      commandBlock: "iqtree2 -s alignment.fasta -T \"$SLURM_CPUS_PER_TASK\" -m MFP -B 1000",
    },
    workload: { modeledRuntimeSeconds: 3600, peakMemoryMB: 9800, cpuUtilizationFraction: 0.9 },
    expectedOutcome: "COMPLETED",
  }),
  scenario({
    id: "gpu-md-v1",
    title: "GPU molecular dynamics",
    learningObjective: "Request GPU/GRES resources and observe accelerator-constrained placement.",
    spec: {
      jobName: "md_gpu",
      partition: "gpu",
      nodes: 1,
      ntasks: 1,
      cpusPerTask: 8,
      memoryMB: 24576,
      walltimeSeconds: 14400,
      gpus: 1,
      modules: ["GROMACS"],
      commandBlock: "srun gmx mdrun -deffnm production -ntomp \"$SLURM_CPUS_PER_TASK\" -nb gpu",
    },
    workload: { modeledRuntimeSeconds: 5400, peakMemoryMB: 14000, cpuUtilizationFraction: 0.68 },
    expectedOutcome: "COMPLETED",
  }),
  scenario({
    id: "walltime-timeout-v1",
    title: "Walltime failure",
    learningObjective: "Diagnose a modeled TIMEOUT and revise the requested walltime.",
    spec: {
      jobName: "timeout_demo",
      partition: "short",
      nodes: 1,
      ntasks: 1,
      cpusPerTask: 4,
      memoryMB: 8192,
      walltimeSeconds: 300,
      commandBlock: "python3 long_analysis.py",
    },
    workload: { modeledRuntimeSeconds: 720, peakMemoryMB: 4500, cpuUtilizationFraction: 0.76 },
    expectedOutcome: "TIMEOUT",
    revision: { walltimeSeconds: 900 },
    revisedExpectedOutcome: "COMPLETED",
  }),
  scenario({
    id: "overrequest-rightsize-v1",
    title: "Inefficient over-request",
    learningObjective: "Use deterministic synthetic accounting to right-size an over-requested job.",
    spec: {
      jobName: "rightsize",
      partition: "compute",
      nodes: 1,
      ntasks: 1,
      cpusPerTask: 16,
      memoryMB: 65536,
      walltimeSeconds: 7200,
      commandBlock: "python3 analysis.py",
    },
    workload: {
      modeledRuntimeSeconds: 900,
      peakMemoryMB: 8200,
      cpuUtilizationFraction: 0.24,
      memoryUtilizationFraction: 0.13,
    },
    expectedOutcome: "COMPLETED",
    revision: { cpusPerTask: 4, memoryMB: 12288, walltimeSeconds: 1800 },
    revisedExpectedOutcome: "COMPLETED",
  }),
];

export const SCIENTIFIC_SCENARIOS = Object.freeze(
  Object.fromEntries(scenarios.map((entry) => [entry.id, entry])),
);

export function getScientificScenario(id) {
  const found = SCIENTIFIC_SCENARIOS[String(id)];
  if (!found) throw new Error(`Unknown scientific scenario '${id}'`);
  return clone(found);
}

export function listScientificScenarios() {
  return Object.values(SCIENTIFIC_SCENARIOS).map(clone);
}

function scenario({ id, title, learningObjective, spec, workload, expectedOutcome, revision = null, revisedExpectedOutcome = null }) {
  return deepFreeze({
    id,
    version: "1",
    title,
    learningObjective,
    pedagogicalResourceValues: true,
    spec: {
      schemaVersion: "1",
      ntasks: 1,
      nodes: 1,
      cpusPerTask: 1,
      gpus: 0,
      provenance: { source: "scientific-scenario", scenarioId: id },
      ...spec,
    },
    workload,
    expectedOutcome,
    revision,
    revisedExpectedOutcome,
  });
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}
