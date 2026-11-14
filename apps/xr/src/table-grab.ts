/**
 * Tisch mit den Händen greifen (#387): Griff-Taste an der Tischkante hält den Tisch fest. Eine Hand
 * verschiebt und hebt, zwei Hände skalieren (nur Mixed Reality, in den Grenzen von #370). Reine
 * Rechnung hier, die Szene (`TableGrab`) liest die Controller. Die Hand bewegt sich im Raum der
 * Brille; der Tisch folgt ihr, indem der Standpunkt (`offset`) gegenläufig verschoben wird.
 */
export type Vec3 = [number, number, number];
export interface Offset {
  x: number;
  y: number;
  z: number;
}

/** Greifzone: ein Ring um die Tischmitte, knapp über und unter der Tischplatte. */
export const EDGE_MIN = 0.4;
export const EDGE_MAX = 0.95;
export const EDGE_HEIGHT = 0.3;
export const OFFSET_LIMIT: Offset = { x: 0.6, y: 0.5, z: 0.6 };
export const SCALE_LIMITS = { min: 0.3, max: 1 };

export function inEdgeZone(p: Vec3, center: Vec3): boolean {
  const radius = Math.hypot(p[0] - center[0], p[2] - center[2]);
  return radius >= EDGE_MIN && radius <= EDGE_MAX && Math.abs(p[1] - center[1]) <= EDGE_HEIGHT;
}

export function clampOffset(o: Offset): Offset {
  const clamp = (v: number, limit: number) => Math.max(-limit, Math.min(limit, v));
  return { x: clamp(o.x, OFFSET_LIMIT.x), y: clamp(o.y, OFFSET_LIMIT.y), z: clamp(o.z, OFFSET_LIMIT.z) };
}

/** Neuer Standpunkt, wenn die Hand von `start` nach `now` wanderte und der Tisch ihr folgen soll. */
export function dragOffset(start: Offset, handStart: Vec3, handNow: Vec3): Offset {
  return clampOffset({ x: start.x - (handNow[0] - handStart[0]), y: start.y + (handNow[1] - handStart[1]), z: start.z - (handNow[2] - handStart[2]) });
}

/** Neue Tischgröße, wenn die Hände von Abstand `d0` auf `d` gezogen wurden. */
export function pinchScale(scaleStart: number, d0: number, d: number): number {
  if (d0 < 0.05) return scaleStart;
  return Math.max(SCALE_LIMITS.min, Math.min(SCALE_LIMITS.max, Math.round(scaleStart * (d / d0) * 100) / 100));
}

/** Läuft gerade ein Tischgriff? Dann zeigt die Griff-Taste nicht (`PoseSender`). */
export const tableGrab = { active: false };

const LOCK = 'brett-und-blatt-xr-tisch-fest';
let locked = readLocked();
const listeners = new Set<() => void>();

function readLocked(): boolean {
  try {
    return localStorage.getItem(LOCK) === 'fest';
  } catch {
    return false;
  }
}

export const tableLocked = (): boolean => locked;

export function setTableLocked(on: boolean): void {
  locked = on;
  try {
    localStorage.setItem(LOCK, on ? 'fest' : 'frei');
  } catch {
    // ohne Speicher nur bis zum Neuladen
  }
  for (const fn of listeners) fn();
}

export function onTableLockedChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
