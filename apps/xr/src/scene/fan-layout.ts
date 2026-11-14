/**
 * Kartenfächer (#384): Lage jeder Karte, bei mehr als zehn Karten in zwei Reihen, und die
 * Erkennung eines Wurfs Richtung Tischmitte. Reine Rechnung ohne three.js.
 */
export const MAX_SINGLE_ROW = 10;

export interface FanSlot {
  row: 0 | 1;
  /** Seitlicher Versatz zur Fächermitte. */
  x: number;
  /** Höhenversatz gegenüber der oberen Reihe (Mitte höher, untere Reihe tiefer). */
  dy: number;
  /** Tiefenversatz (untere Reihe liegt vorn, Rand nach hinten). */
  dz: number;
  /** Kippung um die Blickachse. */
  tilt: number;
}

export function fanSlot(index: number, total: number): FanSlot {
  const two = total > MAX_SINGLE_ROW;
  const perRow = two ? Math.ceil(total / 2) : total;
  const row: 0 | 1 = two && index >= perRow ? 1 : 0;
  const col = row === 0 ? index : index - perRow;
  const count = row === 0 ? perRow : total - perRow;
  const off = col - (count - 1) / 2;
  const spread = Math.min(0.055, 0.5 / Math.max(count, 1));
  return { row, x: off * spread, dy: -row * 0.06 - Math.abs(off) * 0.002, dz: row * 0.045 - Math.abs(off) * 0.004, tilt: -off * 0.03 };
}

export interface Sample {
  x: number;
  z: number;
  t: number;
}

/** Wurf: schnell (m/s) und in Richtung Mitte (Kosinus zwischen Bewegung und Weg zur Mitte). */
export function isThrow(samples: Sample[], center: [number, number], minSpeed = 0.9, minCosine = 0.7): boolean {
  if (samples.length < 2) return false;
  const a = samples[Math.max(0, samples.length - 4)]!;
  const b = samples[samples.length - 1]!;
  const dt = (b.t - a.t) / 1000;
  if (dt <= 0) return false;
  const vx = (b.x - a.x) / dt;
  const vz = (b.z - a.z) / dt;
  const speed = Math.hypot(vx, vz);
  if (speed < minSpeed) return false;
  const tx = center[0] - b.x;
  const tz = center[1] - b.z;
  const length = Math.hypot(tx, tz);
  if (length < 1e-6) return true;
  return (vx * tx + vz * tz) / (speed * length) >= minCosine;
}
