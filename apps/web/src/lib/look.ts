import { useSyncExternalStore } from 'react';

/*
 * Aussehen der App, je Gerät: „Taverne“ (Standard) oder „Schlicht“. Die Farben
 * stehen in look.css und hängen am Attribut data-look auf <html>. Wer erhöhten
 * Kontrast eingestellt hat, bekommt immer „Schlicht“.
 */
export type Look = 'plain' | 'tavern';

const LOOK_KEY = 'brett-und-blatt:aussehen';

function loadLook(): Look {
  try {
    return window.localStorage.getItem(LOOK_KEY) === 'plain' ? 'plain' : 'tavern';
  } catch {
    return 'tavern';
  }
}

const contrastQuery = window.matchMedia('(prefers-contrast: more)');
const listeners = new Set<() => void>();
let chosen = loadLook();

/** Das Aussehen, das gerade wirklich gilt. */
export function activeLook(): Look {
  return contrastQuery.matches ? 'plain' : chosen;
}

function apply(): void {
  document.documentElement.dataset.look = activeLook();
  for (const listener of listeners) listener();
}

export function setLook(next: Look): void {
  chosen = next;
  try {
    window.localStorage.setItem(LOOK_KEY, next);
  } catch {
    // Ohne Speicher gilt die Wahl nur bis zum Neuladen.
  }
  apply();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export const useChosenLook = (): Look => useSyncExternalStore(subscribe, () => chosen);
export const useActiveLook = (): Look => useSyncExternalStore(subscribe, activeLook);
export const contrastForcesPlain = (): boolean => contrastQuery.matches;

contrastQuery.addEventListener('change', apply);
apply();
