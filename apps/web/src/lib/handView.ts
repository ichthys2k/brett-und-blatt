import { useSyncExternalStore } from 'react';

/**
 * Hand-Ansicht (#100): Wer mit dem Handy neben einem Tisch-Bildschirm spielt, sieht nur die eigene Hand und
 * die Knöpfe. Die Wahl gilt je Gerät; ohne Angabe bleibt die normale Ansicht.
 */
const KEY = 'brett-und-blatt:handansicht';
const listeners = new Set<() => void>();

/** Liest den gespeicherten Wert: nur „an“ schaltet die Hand-Ansicht ein. */
export function parseHandView(stored: string | null): boolean {
  return stored === 'an';
}

/** Was auf diesem Gerät gewählt wurde: „an“, „aus“ oder noch nichts (dann bietet der Tisch sie bei Bedarf an). */
export type HandViewChoice = 'an' | 'aus' | null;

export function parseHandViewChoice(stored: string | null): HandViewChoice {
  return stored === 'an' || stored === 'aus' ? stored : null;
}

function load(): HandViewChoice {
  try {
    return parseHandViewChoice(window.localStorage.getItem(KEY));
  } catch {
    return null;
  }
}

let choice: HandViewChoice = load();

export function setHandView(next: boolean): void {
  choice = next ? 'an' : 'aus';
  try {
    window.localStorage.setItem(KEY, choice!);
  } catch {
    // Ohne Speicher gilt die Wahl nur bis zum Neuladen.
  }
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Ob die Hand-Ansicht auf diesem Gerät gewählt ist. */
export const useHandView = (): boolean => useSyncExternalStore(subscribe, () => choice === 'an', () => false);

/** Die Wahl auf diesem Gerät; `null`, solange noch nie gewählt wurde. */
export const useHandViewChoice = (): HandViewChoice => useSyncExternalStore(subscribe, () => choice, () => null);
