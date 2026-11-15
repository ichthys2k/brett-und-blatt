import { useSyncExternalStore } from 'react';

/*
 * Vibration bei Treffern und Fehlern (#89): kurze Impulse über `navigator.vibrate`, wo das Gerät es kann
 * (Android-Browser; iOS-Safari kennt die Funktion nicht – dort passiert einfach nichts). Je Gerät schaltbar
 * auf `#/ton`, standardmäßig an. Die Muster folgen den Klangnamen, die ein Spiel ohnehin meldet.
 */
const KEY = 'brett-und-blatt:vibration';

/** Muster in Millisekunden (Vibrieren, Pause, …). */
export const HAPTIC_PATTERNS = {
  /** Würfel, Stein setzen, Klopfen, letzte Karte: ein leichtes Tippen. */
  tick: [12],
  /** Treffer, Schlagen, richtige Antwort, Klatschen. */
  hit: [35],
  /** Kräftiger Stoß: All-In, Schachmatt, Umwandlung, Revolution, große Ansagen. */
  heavy: [60, 40, 80],
  /** Fehler, falsche Antwort, Strafe, Verlust, Schach geboten: zwei kurze Stöße. */
  error: [30, 60, 30],
  /** Sieg, Bingo, Speed: aufsteigend. */
  win: [30, 50, 30, 50, 80],
} as const;
export type HapticKind = keyof typeof HAPTIC_PATTERNS;

const KINDS: Record<string, HapticKind> = {
  wuerfeln: 'tick',
  'wuerfel-einzeln': 'tick',
  'wuerfel-halten': 'tick',
  'wuerfelbecher-schuetteln': 'tick',
  'bingo-stempel': 'tick',
  'stein-fallen': 'tick',
  'klopfen-stoss': 'tick',
  'reizen-klopfen': 'tick',
  'schach-rochade': 'tick',
  'ruebenacker-hopps': 'tick',
  'ruf-mau': 'tick',
  'ruf-eins': 'tick',
  treffer: 'hit',
  versenkt: 'hit',
  'schiff-treffer': 'hit',
  'schiff-versenkt': 'hit',
  'flotte-versenkt': 'hit',
  'stein-schlagen': 'hit',
  'go-gefangene': 'hit',
  'fs-treffer': 'hit',
  'fs-angriff': 'hit',
  'drachen-schaden-tier': 'hit',
  'drachen-schaden-held': 'hit',
  'quiz-richtig': 'hit',
  'buchstabe-richtig': 'hit',
  'wort-perle': 'hit',
  'wort-lang': 'hit',
  'wort-mittel': 'hit',
  'wort-kurz': 'hit',
  paar: 'hit',
  'karten-klatsch': 'hit',
  'stapel-fertig': 'hit',
  'mauer-stein': 'hit',
  'mauer-fertig': 'hit',
  'gomoku-fuenf': 'hit',
  muehle: 'hit',
  'schach-umwandlung': 'hit',
  'poker-pot': 'hit',
  'ruf-fertig': 'hit',
  'ruf-re': 'hit',
  'ruf-kontra': 'hit',
  'ruf-sauspiel': 'hit',
  'ruf-wenz': 'hit',
  'ruf-revolution': 'hit',
  'schach-matt': 'heavy',
  'poker-all-in': 'heavy',
  'ruf-maexle': 'heavy',
  'ruf-tout': 'heavy',
  'ruf-solo': 'heavy',
  'ruf-schwarz': 'heavy',
  'ruf-schneider': 'heavy',
  'kein-paar': 'error',
  'quiz-falsch': 'error',
  'rechnen-falsch': 'error',
  'galgen-falsch': 'error',
  'galgen-verloren': 'error',
  'steuer-nimmt': 'error',
  'strafe-ziehen': 'error',
  'peter-gezogen': 'error',
  'ruebenacker-maulwurf': 'error',
  'ruf-schach': 'error',
  'nh-buh': 'error',
  'leben-weg': 'error',
  'zeit-um': 'error',
  niederlage: 'error',
  sieg: 'win',
  'ruf-bingo': 'win',
  'ruf-speed': 'win',
  'ruf-kartenblitz': 'win',
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

/** Vibriert mit einem benannten Muster, wenn das Gerät es kann, der Schalter an ist und „weniger Bewegung“ aus ist. */
export function vibrate(kind: HapticKind): void {
  vibratePattern(HAPTIC_PATTERNS[kind]);
}

/** Vibriert mit einem beliebigen Muster in Millisekunden (z. B. je Kreatur oder Zauber). */
export function vibratePattern(pattern: readonly number[]): void {
  if (!enabled || !hapticsSupported() || pattern.length === 0) return;
  try {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    navigator.vibrate([...pattern]);
  } catch {
    // ohne Vibration weiterspielen
  }
}
