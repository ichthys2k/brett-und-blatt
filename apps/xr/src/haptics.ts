/**
 * Vibration der Controller (#380): kurze Impulse beim Überfahren, Auslösen, „Du bist dran“ und bei
 * abgelehnter Eingabe. Ohne Aktor (Handtracking, Browser ohne Brille) geschieht nichts; Fehler
 * des Geräts werden verschluckt. Welcher Controller ein Ereignis auslöste, melden die Zeiger
 * nicht, deshalb antworten alle verbundenen Controller (leicht genug, um nicht zu stören).
 */

export type HapticKind = 'hover' | 'select' | 'move' | 'turn' | 'error';

/** Stärke (0–1) und Dauer (ms) je Impuls; ein Muster ist eine Folge von Impulsen mit Pausen. */
export interface Pulse {
  strength: number;
  ms: number;
  /** Pause bis zum nächsten Impuls des Musters. */
  gap?: number;
}

export const PATTERNS: Record<HapticKind, Pulse[]> = {
  hover: [{ strength: 0.12, ms: 15 }],
  select: [{ strength: 0.35, ms: 35 }],
  move: [{ strength: 0.7, ms: 80 }],
  turn: [
    { strength: 0.45, ms: 60, gap: 70 },
    { strength: 0.45, ms: 60 },
  ],
  error: [
    { strength: 0.8, ms: 40, gap: 50 },
    { strength: 0.8, ms: 40, gap: 50 },
    { strength: 0.8, ms: 40 },
  ],
};

/** Hover-Impulse höchstens so oft, damit schnelles Überfahren nicht brummt. */
const HOVER_MIN_GAP_MS = 90;

const STORE = 'brett-und-blatt-xr-vibration';
let enabled = readEnabled();
let lastHover = 0;
let sessionOf: () => XRSession | null = () => null;
const listeners = new Set<() => void>();

function readEnabled(): boolean {
  try {
    return localStorage.getItem(STORE) !== 'aus';
  } catch {
    return true;
  }
}

export function vibrationEnabled(): boolean {
  return enabled;
}

export function setVibration(on: boolean): void {
  enabled = on;
  try {
    localStorage.setItem(STORE, on ? 'an' : 'aus');
  } catch {
    // ohne Speicher gilt die Einstellung nur bis zum Neuladen
  }
  listeners.forEach((l) => l());
}

export function onVibrationChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => void listeners.delete(fn);
}

/** Sagt dem Helfer, woher er die laufende Sitzung bekommt (der Canvas meldet sie). */
export function bindHapticSession(get: () => XRSession | null): void {
  sessionOf = get;
}

interface Actuator {
  pulse?: (value: number, duration: number) => unknown;
  playEffect?: (type: string, params: Record<string, number>) => unknown;
}

function actuatorsOf(session: XRSession | null): Actuator[] {
  const found: Actuator[] = [];
  for (const source of session?.inputSources ?? []) {
    const pad = source.gamepad as (Gamepad & { hapticActuators?: Actuator[]; vibrationActuator?: Actuator }) | null | undefined;
    const actuator = pad?.hapticActuators?.[0] ?? pad?.vibrationActuator;
    if (actuator) found.push(actuator);
  }
  return found;
}

function fire(actuator: Actuator, pulse: Pulse): void {
  try {
    if (typeof actuator.pulse === 'function') void actuator.pulse(pulse.strength, pulse.ms);
    else if (typeof actuator.playEffect === 'function') void actuator.playEffect('dual-rumble', { duration: pulse.ms, strongMagnitude: pulse.strength, weakMagnitude: pulse.strength });
  } catch {
    // ein Gerät ohne Vibration darf nichts kaputt machen
  }
}

/** Spielt das Muster auf allen Controllern; gibt zurück, ob etwas ausgelöst wurde. */
export function pulse(kind: HapticKind): boolean {
  if (!enabled) return false;
  const now = performance.now();
  if (kind === 'hover') {
    if (now - lastHover < HOVER_MIN_GAP_MS) return false;
    lastHover = now;
  }
  const actuators = actuatorsOf(sessionOf());
  if (actuators.length === 0) return false;
  let delay = 0;
  for (const step of PATTERNS[kind]) {
    const at = delay;
    if (at === 0) actuators.forEach((a) => fire(a, step));
    else setTimeout(() => actuators.forEach((a) => fire(a, step)), at);
    delay += step.ms + (step.gap ?? 0);
  }
  return true;
}
