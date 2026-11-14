/**
 * Kartenfächer an der Haltehand (#384): Wahl „an der Hand / am Tisch“ und die Lage der
 * Haltehand im Tischsystem. Die Szene schreibt die Lage jeden Bildaufbau (`HandAnchor`), der
 * Kartentisch liest sie und hängt den Fächer daran, solange die Hand über der Tischplatte ist.
 * Reine Rechnung in `fanAttached` und `fanYaw`, damit sie sich testen lässt.
 */
export type FanMode = 'hand' | 'table';

const STORE = 'brett-und-blatt-xr-faecher';
let mode: FanMode = readMode();
const listeners = new Set<() => void>();

function readMode(): FanMode {
  try {
    return localStorage.getItem(STORE) === 'table' ? 'table' : 'hand';
  } catch {
    return 'hand';
  }
}

export function fanMode(): FanMode {
  return mode;
}

export function setFanMode(next: FanMode): void {
  mode = next;
  try {
    localStorage.setItem(STORE, next);
  } catch {
    // ohne Speicher nur bis zum Neuladen
  }
  for (const fn of listeners) fn();
}

export function onFanModeChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Lage der Haltehand (linker Controller) im Tischsystem; `active` nur mit sichtbarem Controller. */
export const handAnchor: { active: boolean; x: number; y: number; z: number; headX: number; headZ: number } = { active: false, x: 0, y: 0, z: 0, headX: 0, headZ: 0 };

/** Der Fächer hängt an der Hand, wenn gewählt, Controller da und die Hand über der Tischplatte angehoben ist. */
export function fanAttached(selected: FanMode, active: boolean, handY: number, tableTop: number, lift = 0.15): boolean {
  return selected === 'hand' && active && handY > tableTop + lift;
}

/** Drehung um die Hochachse, damit die Kartenvorderseiten (+z) zum Kopf zeigen. */
export function fanYaw(hand: [number, number], head: [number, number]): number {
  return Math.atan2(head[0] - hand[0], head[1] - hand[1]);
}
