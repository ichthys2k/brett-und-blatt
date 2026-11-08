import { useSyncExternalStore } from 'react';

/*
 * Vibration bei Treffern und Fehlern (#89): kurze Impulse über `navigator.vibrate`, wo das Gerät es kann
 * (Android-Browser; iOS-Safari kennt die Funktion nicht – dort passiert einfach nichts). Je Gerät schaltbar
 * auf `#/ton`, standardmäßig an. Die Muster folgen den Klangnamen, die ein Spiel ohnehin meldet.
 */
const KEY = 'brett-und-blatt:vibration';

/** Muster in Millisekunden (Vibrieren, Pause, …). */
export const HAPTIC_PATTERNS = {
  /** Würfel, Stein setzen: ein leichtes Tippen. */
  tick: [12],
  /** Treffer, Schlagen, richtige Antwort. */
  hit: [35],
  /** Fehler, falsche Antwort, Verlust: zwei kurze Stöße. */
  error: [30, 60, 30],
  /** Sieg: aufsteigend. */
  win: [30, 50, 30, 50, 80],
} as const;
export type HapticKind = keyof typeof HAPTIC_PATTERNS;

const KINDS: Record<string, HapticKind> = {
  wuerfeln: 'tick',
  'wuerfel-einzeln': 'tick',
  'wuerfel-halten': 'tick',
  'bingo-stempel': 'tick',
  treffer: 'hit',
  versenkt: 'hit',
  'schiff-treffer': 'hit',
  'schiff-versenkt': 'hit',
  'flotte-versenkt': 'hit',
  'stein-schlagen': 'hit',
  'fs-treffer': 'hit',
  'drachen-schaden-tier': 'hit',
  'drachen-schaden-held': 'hit',
  'quiz-richtig': 'hit',
  'buchstabe-richtig': 'hit',
  'wort-perle': 'hit',
  'wort-lang': 'hit',
  paar: 'hit',
  'stapel-fertig': 'hit',
  'mauer-stein': 'hit',
  'gomoku-fuenf': 'hit',
  muehle: 'hit',
  'schach-matt': 'hit',
  'kein-paar': 'error',
  'quiz-falsch': 'error',
  'rechnen-falsch': 'error',
  'galgen-falsch': 'error',
  'galgen-verloren': 'error',
  'steuer-nimmt': 'error',
  'nh-buh': 'error',
  'leben-weg': 'error',
  'zeit-um': 'error',
  niederlage: 'error',
  sieg: 'win',
};

/** Welches Muster gehört zu einem Klangnamen? null: keines. */
export function hapticFor(soundName: string): HapticKind | null {
  return KINDS[soundName] ?? null;
}

let enabled = load();
const listeners = new Set<() => void>();

function load(): boolean {
  try {
    return window.localStorage.getItem(KEY) !== 'aus';
  } catch {
    return true;
  }
}

export function hapticsSupported(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
}

export function setHaptics(on: boolean): void {
  enabled = on;
  try {
    window.localStorage.setItem(KEY, on ? 'an' : 'aus');
  } catch {
    // gesperrt – gilt bis zum Neuladen
  }
  for (const listener of listeners) listener();
  if (on) vibrate('tick');
}

export function useHaptics(): boolean {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => enabled,
  );
}

/** Vibriert, wenn das Gerät es kann, der Schalter an ist und die Person nicht „weniger Bewegung“ wünscht. */
export function vibrate(kind: HapticKind): void {
  if (!enabled || !hapticsSupported()) return;
  try {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    navigator.vibrate(HAPTIC_PATTERNS[kind] as unknown as number[]);
  } catch {
    // ohne Vibration weiterspielen
  }
}
