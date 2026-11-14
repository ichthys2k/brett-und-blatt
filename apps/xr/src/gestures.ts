/**
 * Gesten als Reaktionen (#386): Daumen hoch, Winken und Klatschen aus den Gelenken des
 * Handtrackings. Reine Rechnung ohne Brille, damit sie sich testen lässt; die Szene füttert den
 * `GestureTracker` mit den Gelenken (`GestureWatcher`). Eine Geste muss kurz gehalten werden und
 * hat eine Sperrzeit, damit nichts versehentlich oder gehäuft ausgelöst wird. Zeigen mit dem
 * Finger oder der Pinch zum Greifen sind keine dieser Gesten.
 */
export type Vec3 = [number, number, number];

export interface Joints {
  wrist: Vec3;
  thumbTip: Vec3;
  indexTip: Vec3;
  indexKnuckle: Vec3;
  middleTip: Vec3;
  middleKnuckle: Vec3;
  ringTip: Vec3;
  ringKnuckle: Vec3;
  littleTip: Vec3;
  littleKnuckle: Vec3;
}

export type Gesture = 'thumbsUp' | 'wave' | 'clap';

/** Welche vorhandene Reaktion eine Geste auslöst (👋 gibt es im Protokoll nicht, Winken zeigt 🎉). */
export const GESTURE_REACTION: Record<Gesture, '👍' | '🎉' | '👏'> = { thumbsUp: '👍', wave: '🎉', clap: '👏' };

const HOLD_THUMBS_MS = 500;
const COOLDOWN_MS = 5000;
const WAVE_WINDOW_MS = 1200;
const WAVE_TURNS = 3;
const WAVE_AMPLITUDE = 0.04;
const CLAP_WINDOW_MS = 500;

const dist = (a: Vec3, b: Vec3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

type Finger = [Vec3, Vec3];
const fingers = (j: Joints): Finger[] => [
  [j.indexTip, j.indexKnuckle],
  [j.middleTip, j.middleKnuckle],
  [j.ringTip, j.ringKnuckle],
  [j.littleTip, j.littleKnuckle],
];

/** Fingerspitze nah am Handgelenk: eingerollt. */
const curled = (j: Joints) => fingers(j).every(([tip, knuckle]) => dist(tip, j.wrist) < dist(knuckle, j.wrist) * 1.1);
/** Alle vier Finger gestreckt: offene Hand. */
export const openPalm = (j: Joints) => fingers(j).every(([tip, knuckle]) => dist(tip, j.wrist) > dist(knuckle, j.wrist) * 1.5);

/** Daumen hoch: Faust, Daumen deutlich nach oben und über allen Fingerspitzen. */
export function isThumbsUp(j: Joints): boolean {
  if (!curled(j)) return false;
  const highestFinger = Math.max(...fingers(j).map(([tip]) => tip[1]));
  return j.thumbTip[1] - j.wrist[1] > 0.06 && j.thumbTip[1] > highestFinger + 0.03;
}

/** Wendepunkte der Seitwärtsbewegung mit genügend Ausschlag. */
export function turns(points: Vec3[], amplitude = WAVE_AMPLITUDE): number {
  if (points.length < 3) return 0;
  const rangeX = Math.max(...points.map((p) => p[0])) - Math.min(...points.map((p) => p[0]));
  const rangeZ = Math.max(...points.map((p) => p[2])) - Math.min(...points.map((p) => p[2]));
  const axis = rangeX >= rangeZ ? 0 : 2;
  let count = 0;
  let direction = 0;
  let anchor = points[0]![axis]!;
  for (const point of points.slice(1)) {
    const value = point[axis]!;
    const delta = value - anchor;
    if (Math.abs(delta) < amplitude) continue;
    const next = delta > 0 ? 1 : -1;
    if (direction !== 0 && next !== direction) count++;
    direction = next;
    anchor = value;
  }
  return count;
}

export class GestureTracker {
  private thumbsSince: number | null = null;
  private trail: { at: number; left: Vec3 | null; right: Vec3 | null; leftOpen: boolean; rightOpen: boolean }[] = [];
  private blockedUntil = 0;

  /** Neue Gelenke einer Aufnahme; liefert eine Geste, wenn eine erkannt und gehalten wurde. */
  feed(now: number, hands: { left: Joints | null; right: Joints | null }): Gesture | null {
    const { left, right } = hands;
    this.trail.push({ at: now, left: left?.wrist ?? null, right: right?.wrist ?? null, leftOpen: left ? openPalm(left) : false, rightOpen: right ? openPalm(right) : false });
    this.trail = this.trail.filter((t) => now - t.at <= WAVE_WINDOW_MS);
    if (now < this.blockedUntil) {
      this.thumbsSince = null;
      return null;
    }
    const fire = (gesture: Gesture): Gesture => {
      this.blockedUntil = now + COOLDOWN_MS;
      this.thumbsSince = null;
      this.trail = [];
      return gesture;
    };

    // Daumen hoch: kurz gehalten.
    if ((left && isThumbsUp(left)) || (right && isThumbsUp(right))) {
      this.thumbsSince ??= now;
      if (now - this.thumbsSince >= HOLD_THUMBS_MS) return fire('thumbsUp');
    } else this.thumbsSince = null;

    // Klatschen: Hände waren auseinander und treffen sich.
    if (left && right && openPalm(left) && openPalm(right)) {
      const recent = this.trail.filter((t) => now - t.at <= CLAP_WINDOW_MS && t.left && t.right);
      const gaps = recent.map((t) => dist(t.left!, t.right!));
      if (gaps.length >= 3 && Math.max(...gaps) > 0.22 && gaps[gaps.length - 1]! < 0.1) return fire('clap');
    }

    // Winken: offene Hand, mehrfach hin und her.
    for (const side of ['left', 'right'] as const) {
      const open = side === 'left' ? left && openPalm(left) : right && openPalm(right);
      if (!open) continue;
      const path = this.trail.filter((t) => (side === 'left' ? t.leftOpen : t.rightOpen) && t[side]).map((t) => t[side]!);
      if (turns(path) >= WAVE_TURNS) return fire('wave');
    }
    return null;
  }
}

const STORE = 'brett-und-blatt-xr-gesten';
let enabled = readEnabled();
const listeners = new Set<() => void>();

function readEnabled(): boolean {
  try {
    return localStorage.getItem(STORE) !== 'aus';
  } catch {
    return true;
  }
}

export const gesturesEnabled = (): boolean => enabled;

export function setGesturesEnabled(on: boolean): void {
  enabled = on;
  try {
    localStorage.setItem(STORE, on ? 'an' : 'aus');
  } catch {
    // ohne Speicher nur bis zum Neuladen
  }
  for (const fn of listeners) fn();
}

export function onGesturesChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
