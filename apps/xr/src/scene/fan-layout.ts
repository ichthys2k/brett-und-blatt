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

/** `widen` spreizt den Fächer seitlich (an der Hand, damit sich jede Karte einzeln mit dem Strahl treffen lässt). */
export function fanSlot(index: number, total: number, widen = 1): FanSlot {
  const two = total > MAX_SINGLE_ROW;
  const perRow = two ? Math.ceil(total / 2) : total;
  const row: 0 | 1 = two && index >= perRow ? 1 : 0;
  const col = row === 0 ? index : index - perRow;
  const count = row === 0 ? perRow : total - perRow;
  const off = col - (count - 1) / 2;
  const spread = Math.min(0.055, 0.5 / Math.max(count, 1));
  return { row, x: off * spread * widen, dy: -row * 0.06 - Math.abs(off) * 0.002, dz: row * 0.045 - Math.abs(off) * 0.004, tilt: -off * 0.03 };
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

/**
 * Reaktionsleiste an der eigenen Tischkante (#585): Abstand zur Tischmitte (z) und Höhe über der
 * Tischplatte. Bei elf bis sechzehn Handkarten (zwei Reihen) reicht die untere Reihe bis z = 0,49;
 * die Leiste liegt dahinter (näher am Spieler), damit sie keine Karte überdeckt.
 */
export const REACTION_BAR = { z: 0.56, y: 0.03, height: 0.048, tilt: Math.PI / 3 };

/** Lage der unteren Fächerreihe (Mitte und halbe Ausdehnung) relativ zur Tischmitte: z und Höhe über der Tischplatte. */
export function fanRowExtent(row: 0 | 1, fanZ: number, fanY: number, cardH = 0.096, cardTilt = 0.55): { zMin: number; zMax: number; yMin: number; yMax: number } {
  const slot = fanSlot(row === 1 ? 11 : 0, 12);
  const cz = fanZ + slot.dz;
  const cy = fanY + slot.dy;
  const dz = (cardH / 2) * Math.sin(cardTilt);
  const dy = (cardH / 2) * Math.cos(cardTilt);
  return { zMin: cz - dz, zMax: cz + dz, yMin: cy - dy, yMax: cy + dy };
}
