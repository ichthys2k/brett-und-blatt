/**
 * Einstellungen und Befehle für die Bedienung (#388): Händigkeit, Sitzen/Stehen, eingeklapptes
 * Fenster und der Draht vom Handgelenk-Menü zum Fenster über dem Tisch. Gespeichert wird im Gerät;
 * ohne Speicher gelten die Werte bis zum Neuladen.
 */
export type Handedness = 'right' | 'left';
export type Posture = 'sitting' | 'standing';

const KEYS = { hand: 'brett-und-blatt-xr-haendigkeit', posture: 'brett-und-blatt-xr-haltung', collapsed: 'brett-und-blatt-xr-fenster-zu' } as const;

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function write(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // nur bis zum Neuladen
  }
}

let handedness: Handedness = read(KEYS.hand) === 'left' ? 'left' : 'right';
let posture: Posture = read(KEYS.posture) === 'standing' ? 'standing' : 'sitting';
let collapsed = read(KEYS.collapsed) === 'zu';
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((fn) => fn());

export const onUiStateChange = (fn: () => void): (() => void) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

export const getHandedness = (): Handedness => handedness;
export function setHandedness(next: Handedness): void {
  handedness = next;
  write(KEYS.hand, next);
  notify();
}
/** Haltehand (Fächer, Handgelenk-Menü): die Hand, die nicht schreibt. */
export const holdingHand = (): 'left' | 'right' => (handedness === 'right' ? 'left' : 'right');

export const getPosture = (): Posture => posture;
export function setPosture(next: Posture): void {
  posture = next;
  write(KEYS.posture, next);
  notify();
}
/** Voreinstellung der Tischhöhe: Im Stehen liegt der Tisch etwas höher (zusätzlich zur Handeinstellung). */
export const POSTURE_LIFT: Record<Posture, number> = { sitting: 0, standing: 0.15 };

export const isCollapsed = (): boolean => collapsed;
export function setCollapsed(next: boolean): void {
  collapsed = next;
  write(KEYS.collapsed, next ? 'zu' : 'auf');
  notify();
}

/** Befehl des Handgelenk-Menüs an das Fenster: Seite öffnen oder Aufgeben vorbereiten. */
export type PanelCommand = 'phrases' | 'voice' | 'view' | 'resign';
const commandListeners = new Set<(command: PanelCommand) => void>();
export const onPanelCommand = (fn: (command: PanelCommand) => void): (() => void) => {
  commandListeners.add(fn);
  return () => commandListeners.delete(fn);
};
export const sendPanelCommand = (command: PanelCommand): void => commandListeners.forEach((fn) => fn(command));

/** Seite der Wahlknöpfe: bei der schreibenden Hand (Rechtshänder rechts), in Metern von der Tischmitte. */
export const choiceOffset = (): number => (handedness === 'right' ? 0.25 : -0.25);

/**
 * Handflächen-Normale aus Handgelenk und den Grundgelenken von Zeige- und kleinem Finger (Handtracking).
 * Rechte Hand mit Fläche nach unten: Zeigefinger links, kleiner Finger rechts → Kreuzprodukt zeigt nach unten,
 * also aus der Handfläche heraus; bei der linken Hand dreht sich das Vorzeichen.
 */
export function palmNormal(wrist: [number, number, number], indexBase: [number, number, number], pinkyBase: [number, number, number], hand: 'left' | 'right'): [number, number, number] {
  const a = [indexBase[0] - wrist[0], indexBase[1] - wrist[1], indexBase[2] - wrist[2]];
  const b = [pinkyBase[0] - wrist[0], pinkyBase[1] - wrist[1], pinkyBase[2] - wrist[2]];
  const c: [number, number, number] = [a[1]! * b[2]! - a[2]! * b[1]!, a[2]! * b[0]! - a[0]! * b[2]!, a[0]! * b[1]! - a[1]! * b[0]!];
  const sign = hand === 'right' ? 1 : -1;
  return [c[0] * sign, c[1] * sign, c[2] * sign];
}

/** Blickt man auf die Innenseite des Handgelenks? `up` zeigt von der Handfläche weg (Controller-Oberseite). */
export function facesHead(hand: [number, number, number], up: [number, number, number], head: [number, number, number], minDot = 0.6): boolean {
  const to = [head[0] - hand[0], head[1] - hand[1], head[2] - hand[2]] as const;
  const length = Math.hypot(...to) || 1;
  const upLength = Math.hypot(...up) || 1;
  return (to[0] * up[0] + to[1] * up[1] + to[2] * up[2]) / (length * upLength) > minDot;
}
