import { useSyncExternalStore } from 'react';
import { parseShellParam, parseStoredShell, resolveShell, type Shell } from './shellCore';

/*
 * Gewählte und geltende Darstellung im Browser (#607, K1), nach dem Muster von `look.ts`.
 * Gespeichert wird nur „Klassisch“ (`brett-und-blatt:oberflaeche` = `klassisch`, seit #639; ohne Eintrag gilt die Konsole); der Startparameter
 * `?modus=konsole|klassisch` gilt nur für diesen Aufruf. Die geltende Darstellung steht als
 * `data-shell="console"` an <html> (klassisch: kein Attribut).
 */

export type { Shell } from './shellCore';

const SHELL_KEY = 'brett-und-blatt:oberflaeche';

function loadShell(): Shell {
  try {
    return parseStoredShell(window.localStorage.getItem(SHELL_KEY));
  } catch {
    return 'console';
  }
}

const param: Shell | null = typeof window === 'undefined' ? null : parseShellParam(window.location.search);
const listeners = new Set<() => void>();
let chosen: Shell = typeof window === 'undefined' ? 'classic' : loadShell();
let active: Shell = 'classic';

function compute(): Shell {
  if (typeof window === 'undefined') return 'classic';
  return resolveShell({ chosen, param });
}

function apply(): void {
  active = compute();
  if (typeof document !== 'undefined') {
    if (active === 'console') document.documentElement.dataset.shell = 'console';
    else delete document.documentElement.dataset.shell;
  }
  for (const listener of listeners) listener();
}

/** Die gespeicherte Wahl (ohne Startparameter). */
export function chosenShell(): Shell {
  return chosen;
}

/** Die Darstellung, die gerade gilt. */
export function activeShell(): Shell {
  return active;
}

/** Der Startparameter dieses Aufrufs oder `null`. */
export function shellParam(): Shell | null {
  return param;
}

export function setShell(next: Shell): void {
  chosen = next;
  try {
    if (next === 'classic') window.localStorage.setItem(SHELL_KEY, 'klassisch');
    else window.localStorage.removeItem(SHELL_KEY);
  } catch {
    // Ohne Speicher gilt die Wahl nur bis zum Neuladen.
  }
  apply();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export const useChosenShell = (): Shell => useSyncExternalStore(subscribe, () => chosen, () => 'classic');
export const useActiveShell = (): Shell => useSyncExternalStore(subscribe, () => active, () => 'classic');

if (typeof window !== 'undefined') {
  apply();
  window.addEventListener('storage', (event) => {
    if (event.key !== SHELL_KEY) return;
    chosen = loadShell();
    apply();
  });
}
