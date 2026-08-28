export class ResourceLedger {
  constructor(nodes) {
    if (!Array.isArray(nodes) || nodes.length === 0) throw new Error("At least one node is required");
    this.nodes = nodes.map(normalizeNode);
    this.allocations = new Map();
  }

  allocate(jobId, spec) {
    if (!jobId) throw new Error("jobId is required");
    if (this.allocations.has(String(jobId))) throw new Error(`Job ${jobId} is already allocated`);

    const request = normalizeRequest(spec);
    if (request.nodes !== 1) {
      throw new Error("Multi-node placement is not yet modeled; refusing to approximate it");
    }

    const node = this.nodes.find((candidate) => fits(candidate, request));
    if (!node) return null;

    node.allocatedCpus += request.cpus;
    node.allocatedMemoryMB += request.memoryMB;
    node.allocatedGpus += request.gpus;
    assertNodeInvariant(node);

    const allocation = Object.freeze({
      jobId: String(jobId),
      nodeId: node.id,
      partition: node.partition,
      cpus: request.cpus,
      memoryMB: request.memoryMB,
      gpus: request.gpus,
    });
    this.allocations.set(String(jobId), allocation);
    return allocation;
  }

  release(jobId) {
    const key = String(jobId);
    const allocation = this.allocations.get(key);
    if (!allocation) throw new Error(`Job ${jobId} has no active allocation`);

    const node = this.nodes.find((candidate) => candidate.id === allocation.nodeId);
    if (!node) throw new Error(`Allocation refers to unknown node ${allocation.nodeId}`);

    node.allocatedCpus -= allocation.cpus;
    node.allocatedMemoryMB -= allocation.memoryMB;
    node.allocatedGpus -= allocation.gpus;
    assertNodeInvariant(node);
    this.allocations.delete(key);
    return allocation;
  }

  snapshot() {
    return {
      nodes: this.nodes.map((node) => ({
        ...node,
        availableCpus: node.cpus - node.allocatedCpus,
        availableMemoryMB: node.memoryMB - node.allocatedMemoryMB,
        availableGpus: node.gpus - node.allocatedGpus,
      })),
      allocations: [...this.allocations.values()].map((allocation) => ({ ...allocation })),
    };
  }
}

function normalizeNode(node) {
  if (!node?.id) throw new Error("Each node requires an id");
  const normalized = {
    id: String(node.id),
    partition: nullableString(node.partition),
    cpus: positiveInteger(node.cpus, "node cpus"),
    memoryMB: positiveInteger(node.memoryMB, "node memoryMB"),
    gpus: nonNegativeInteger(node.gpus ?? 0, "node gpus"),
    allocatedCpus: 0,
    allocatedMemoryMB: 0,
    allocatedGpus: 0,
  };
  assertNodeInvariant(normalized);
  return normalized;
}

function normalizeRequest(spec) {
  const nodes = positiveInteger(spec?.nodes ?? 1, "requested nodes");
  const ntasks = positiveInteger(spec?.ntasks ?? 1, "requested ntasks");
  const cpusPerTask = positiveInteger(spec?.cpusPerTask ?? 1, "requested cpusPerTask");
  const memoryMB = positiveInteger(spec?.memoryMB ?? 1, "requested memoryMB");
  const gpus = nonNegativeInteger(spec?.gpus ?? 0, "requested gpus");

  return {
    nodes,
    partition: nullableString(spec?.partition),
    cpus: ntasks * cpusPerTask,
    memoryMB,
    gpus,
  };
}

function fits(node, request) {
  if (request.partition && node.partition !== request.partition) return false;
  return (
    node.cpus - node.allocatedCpus >= request.cpus &&
    node.memoryMB - node.allocatedMemoryMB >= request.memoryMB &&
    node.gpus - node.allocatedGpus >= request.gpus
  );
}

function assertNodeInvariant(node) {
  if (node.allocatedCpus < 0 || node.allocatedMemoryMB < 0 || node.allocatedGpus < 0) {
    throw new Error(`Negative allocation detected on ${node.id}`);
  }
  if (node.allocatedCpus > node.cpus || node.allocatedMemoryMB > node.memoryMB || node.allocatedGpus > node.gpus) {
    throw new Error(`Resource overcommit detected on ${node.id}`);
  }
}

function positiveInteger(value, label) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) throw new Error(`${label} must be a positive integer`);
  return parsed;
}

function nonNegativeInteger(value, label) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) throw new Error(`${label} must be a non-negative integer`);
  return parsed;
}

function nullableString(value) {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text || null;
}
