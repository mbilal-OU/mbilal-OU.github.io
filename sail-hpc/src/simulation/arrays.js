const DEFAULT_MAX_ARRAY_TASKS = 1000;

export function parseArraySpecification(value, { maxTasks = DEFAULT_MAX_ARRAY_TASKS } = {}) {
  const raw = typeof value === "object" && value !== null
    ? value.specification
    : value;
  const specification = String(raw ?? "").trim();
  if (!specification) throw new Error("Array specification is required");

  const percentParts = specification.split("%");
  if (percentParts.length > 2) throw new Error(`Invalid array specification '${specification}'`);

  const body = percentParts[0].trim();
  const concurrencyLimit = percentParts.length === 2
    ? positiveInteger(percentParts[1], "array concurrency limit")
    : null;

  const taskIds = [];
  const seen = new Set();

  for (const tokenRaw of body.split(",")) {
    const token = tokenRaw.trim();
    if (!token) throw new Error(`Invalid empty array token in '${specification}'`);

    if (/^\d+$/.test(token)) {
      addTask(Number(token));
      continue;
    }

    const match = token.match(/^(\d+)-(\d+)(?::(\d+))?$/);
    if (!match) throw new Error(`Unsupported array token '${token}'`);

    const start = Number(match[1]);
    const end = Number(match[2]);
    const step = Number(match[3] || 1);
    if (end < start) throw new Error(`Array range end must be >= start in '${token}'`);
    if (step < 1) throw new Error(`Array step must be >= 1 in '${token}'`);

    for (let taskId = start; taskId <= end; taskId += step) addTask(taskId);
  }

  if (taskIds.length === 0) throw new Error("Array specification produced no tasks");
  if (taskIds.length > maxTasks) {
    throw new Error(`Array specification expands to ${taskIds.length} tasks; maximum is ${maxTasks}`);
  }
  if (concurrencyLimit !== null && concurrencyLimit > taskIds.length) {
    throw new Error("Array concurrency limit cannot exceed the number of tasks");
  }

  return Object.freeze({
    specification,
    taskIds: Object.freeze(taskIds),
    concurrencyLimit,
  });

  function addTask(taskId) {
    if (!Number.isInteger(taskId) || taskId < 0) throw new Error("Array task IDs must be non-negative integers");
    if (!seen.has(taskId)) {
      seen.add(taskId);
      taskIds.push(taskId);
    }
  }
}

export function arrayTaskJobId(parentJobId, taskId) {
  if (!parentJobId) throw new Error("parentJobId is required");
  if (!Number.isInteger(Number(taskId)) || Number(taskId) < 0) throw new Error("taskId must be a non-negative integer");
  return `${String(parentJobId)}_${Number(taskId)}`;
}

function positiveInteger(value, label) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) throw new Error(`${label} must be a positive integer`);
  return parsed;
}
