/*
 * Darstellung der App (#607, K1): „Konsole“ (seit #639 Standard) oder „Klassisch“ (die frühere Oberfläche). Reine Funktionen ohne `window`, damit sie sich ohne DOM testen lassen;
 * den Zustand im Browser hält `shell.ts`.
 */

export type Shell = 'classic' | 'console';

/** Liest `?modus=konsole` bzw. `?modus=klassisch` aus `location.search`; alles andere ergibt `null`. */
export function parseShellParam(search: string): Shell | null {
  const value = new URLSearchParams(search).get('modus');
  if (value === 'konsole') return 'console';
  if (value === 'klassisch') return 'classic';
  return null;
}

/**
 * Liest den gespeicherten Wert (#639: die Konsole ist Standard): `'klassisch'` → `'classic'`, alles andere – auch
 * `null` und das frühere `'konsole'` – → `'console'`.
 */
export function parseStoredShell(raw: string | null): Shell {
  return raw === 'klassisch' ? 'classic' : 'console';
}

/**
 * Die Darstellung, die wirklich gilt: Parameter vor gespeicherter Wahl. Seit #637 (Hochformat der Konsole) gilt
 * die Konsole in jeder Fenstergröße; die frühere Mindestgröße 700 × 360 im Querformat ist entfallen.
 */
export function resolveShell(input: { chosen: Shell; param: Shell | null }): Shell {
  return input.param ?? input.chosen;
}
