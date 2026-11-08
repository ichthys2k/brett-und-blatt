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

function load(): boolean {
  try {
    return parseHandView(window.localStorage.getItem(KEY));
  } catch {
    return false;
  }
}

let enabled = load();

export function setHandView(next: boolean): void {
  enabled = next;
  try {
    window.localStorage.setItem(KEY, next ? 'an' : 'aus');
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
export const useHandView = (): boolean => useSyncExternalStore(subscribe, () => enabled, () => false);
