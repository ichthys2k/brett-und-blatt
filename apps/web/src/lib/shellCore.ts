/*
 * Darstellung der App (#607, K1): „Klassisch“ (Standard) oder „Konsole“ (Bibliothek für Controller,
 * Handheld und Fernseher). Reine Funktionen ohne `window`, damit sie sich ohne DOM testen lassen;
 * den Zustand im Browser hält `shell.ts`.
 */

export type Shell = 'classic' | 'console';

/** Unter dieser Fenstergröße gilt immer die klassische Oberfläche (#607, Festlegung 5). */
export const CONSOLE_MIN_WIDTH = 700;
export const CONSOLE_MIN_HEIGHT = 360;

/** Liest `?modus=konsole` bzw. `?modus=klassisch` aus `location.search`; alles andere ergibt `null`. */
export function parseShellParam(search: string): Shell | null {
  const value = new URLSearchParams(search).get('modus');
  if (value === 'konsole') return 'console';
  if (value === 'klassisch') return 'classic';
  return null;
}

/** Liest den gespeicherten Wert: `'konsole'` → `'console'`, alles andere (auch `null`) → `'classic'`. */
export function parseStoredShell(raw: string | null): Shell {
  return raw === 'konsole' ? 'console' : 'classic';
}

/** Die Darstellung, die wirklich gilt: Parameter vor gespeicherter Wahl; Konsole nur im Querformat ab der Mindestgröße. */
export function resolveShell(input: { chosen: Shell; param: Shell | null; width: number; height: number }): Shell {
  const wanted = input.param ?? input.chosen;
  const fits = input.width >= CONSOLE_MIN_WIDTH && input.height >= CONSOLE_MIN_HEIGHT && input.width > input.height;
  return wanted === 'console' && fits ? 'console' : 'classic';
}
