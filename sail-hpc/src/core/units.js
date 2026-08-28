export function parseMemoryToMB(value) {
  if (typeof value === "number") {
    if (!Number.isFinite(value) || value < 0) throw new Error("memory must be a non-negative finite number");
    return Math.round(value);
  }

  const raw = String(value ?? "").trim();
  if (!raw) throw new Error("memory value is required");

  const match = raw.match(/^([0-9]+(?:\.[0-9]+)?)\s*([KMGT]?)B?$/i);
  if (!match) throw new Error(`unsupported memory value: ${raw}`);

  const amount = Number(match[1]);
  const unit = match[2].toUpperCase();
  const factors = {
    "": 1,
    K: 1 / 1024,
    M: 1,
    G: 1024,
    T: 1024 * 1024,
  };

  return Math.round(amount * factors[unit]);
}

export function formatMemoryMB(memoryMB) {
  const mb = Number(memoryMB);
  if (!Number.isFinite(mb) || mb < 0) throw new Error("memoryMB must be a non-negative finite number");
  if (mb >= 1024 * 1024 && mb % (1024 * 1024) === 0) return `${mb / (1024 * 1024)}T`;
  if (mb >= 1024 && mb % 1024 === 0) return `${mb / 1024}G`;
  return `${Math.round(mb)}M`;
}

export function parseWalltimeToSeconds(value) {
  if (typeof value === "number") {
    if (!Number.isFinite(value) || value < 0) throw new Error("walltime must be a non-negative finite number");
    return Math.round(value);
  }

  const raw = String(value ?? "").trim();
  if (!raw) throw new Error("walltime value is required");

  let days = 0;
  let timePart = raw;
  if (raw.includes("-")) {
    const parts = raw.split("-");
    if (parts.length !== 2 || !/^\d+$/.test(parts[0])) throw new Error(`unsupported walltime value: ${raw}`);
    days = Number(parts[0]);
    timePart = parts[1];
  }

  const pieces = timePart.split(":");
  if (pieces.some((piece) => !/^\d+$/.test(piece))) throw new Error(`unsupported walltime value: ${raw}`);

  let hours = 0;
  let minutes = 0;
  let seconds = 0;

  if (pieces.length === 1) {
    minutes = Number(pieces[0]);
  } else if (pieces.length === 2) {
    minutes = Number(pieces[0]);
    seconds = Number(pieces[1]);
  } else if (pieces.length === 3) {
    hours = Number(pieces[0]);
    minutes = Number(pieces[1]);
    seconds = Number(pieces[2]);
  } else {
    throw new Error(`unsupported walltime value: ${raw}`);
  }

  if (seconds > 59 || minutes > 59) throw new Error(`unsupported walltime value: ${raw}`);
  return days * 86400 + hours * 3600 + minutes * 60 + seconds;
}

export function formatWalltimeSeconds(totalSeconds) {
  let seconds = Number(totalSeconds);
  if (!Number.isFinite(seconds) || seconds < 0) throw new Error("totalSeconds must be a non-negative finite number");
  seconds = Math.round(seconds);

  const days = Math.floor(seconds / 86400);
  seconds %= 86400;
  const hours = Math.floor(seconds / 3600);
  seconds %= 3600;
  const minutes = Math.floor(seconds / 60);
  seconds %= 60;

  const hh = String(hours).padStart(2, "0");
  const mm = String(minutes).padStart(2, "0");
  const ss = String(seconds).padStart(2, "0");
  return days > 0 ? `${days}-${hh}:${mm}:${ss}` : `${hh}:${mm}:${ss}`;
}
