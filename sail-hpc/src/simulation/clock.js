export class DeterministicClock {
  constructor(startSeconds = 0) {
    assertFiniteNonNegative(startSeconds, "startSeconds");
    this._seconds = Number(startSeconds);
  }

  now() {
    return this._seconds;
  }

  advance(seconds) {
    assertFiniteNonNegative(seconds, "seconds");
    this._seconds += Number(seconds);
    return this._seconds;
  }

  set(seconds) {
    assertFiniteNonNegative(seconds, "seconds");
    if (Number(seconds) < this._seconds) {
      throw new Error("Simulation clock cannot move backwards");
    }
    this._seconds = Number(seconds);
    return this._seconds;
  }

  snapshot() {
    return Object.freeze({ nowSeconds: this._seconds });
  }
}

function assertFiniteNonNegative(value, label) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`${label} must be a finite non-negative number`);
  }
}
