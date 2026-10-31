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

/** Farbe der Browserleiste; `dark` entspricht dem zweiten Eintrag in index.html. */
const BAR_COLORS: Record<Look, { light: string; dark: string }> = {
  plain: { light: '#1f6f5c', dark: '#121417' },
  tavern: { light: '#5a3b22', dark: '#1d1510' },
};

function apply(): void {
  const look = activeLook();
  document.documentElement.dataset.look = look;
  for (const meta of document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')) {
    meta.content = BAR_COLORS[look][meta.media.includes('dark') ? 'dark' : 'light'];
  }
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
