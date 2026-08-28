export const TRAINING_CLUSTER_VERSION = "1.0.0-rc1";

export const TRAINING_CLUSTER_POLICY = Object.freeze({
  name: "SAIL-HPC fictional training cluster",
  version: TRAINING_CLUSTER_VERSION,
  defaultPartition: "short",
  partitions: Object.freeze({
    short: Object.freeze({
      maxWalltimeSeconds: 2 * 60 * 60,
      maxCpusPerJob: 32,
      maxMemoryMBPerJob: 128 * 1024,
      maxGpusPerJob: 0,
    }),
    compute: Object.freeze({
      maxWalltimeSeconds: 3 * 24 * 60 * 60,
      maxCpusPerJob: 64,
      maxMemoryMBPerJob: 256 * 1024,
      maxGpusPerJob: 0,
    }),
    highmem: Object.freeze({
      maxWalltimeSeconds: 2 * 24 * 60 * 60,
      maxCpusPerJob: 128,
      maxMemoryMBPerJob: 1024 * 1024,
      maxGpusPerJob: 0,
    }),
    gpu: Object.freeze({
      maxWalltimeSeconds: 2 * 24 * 60 * 60,
      maxCpusPerJob: 48,
      maxMemoryMBPerJob: 512 * 1024,
      maxGpusPerJob: 4,
    }),
  }),
});

export const TRAINING_CLUSTER_NODES = Object.freeze([
  node("short01", "short", 32, 128, 0),
  node("short02", "short", 32, 128, 0),
  node("cpu01", "compute", 64, 256, 0),
  node("cpu02", "compute", 64, 256, 0),
  node("cpu03", "compute", 64, 256, 0),
  node("cpu04", "compute", 64, 256, 0),
  node("cpu05", "compute", 64, 256, 0),
  node("hm01", "highmem", 128, 1024, 0),
  node("hm02", "highmem", 128, 1024, 0),
  node("gpu01", "gpu", 48, 512, 4),
  node("gpu02", "gpu", 48, 512, 4),
]);

export const TRAINING_MODULES = Object.freeze([
  "FastQC",
  "fastp",
  "BWA",
  "SAMtools",
  "HISAT2",
  "Subread",
  "IQ-TREE",
  "Roary",
  "GROMACS",
  "Python",
  "R",
]);

function node(id, partition, cpus, memoryGB, gpus) {
  return Object.freeze({
    id,
    partition,
    cpus,
    memoryMB: memoryGB * 1024,
    gpus,
  });
}
