/*
 * Ausgeblendete offene Runden (Turniere): ein fremdes Turnier lässt sich nicht löschen, aber auf diesem Gerät verstecken.
 * Nur eine Merkliste von Codes in `localStorage`; für andere ändert sich nichts.
 */
export const HIDDEN_KEY = 'brett-und-blatt:ausgeblendet';
const MAX = 100;

export function loadHidden(): string[] {
  try {
    const list = JSON.parse(window.localStorage.getItem(HIDDEN_KEY) ?? '[]');
    return Array.isArray(list) ? list.filter((c): c is string => typeof c === 'string').slice(0, MAX) : [];
  } catch {
    return [];
  }
}
function save(list: string[]): void {
  try {
    window.localStorage.setItem(HIDDEN_KEY, JSON.stringify(list.slice(0, MAX)));
  } catch {
    // ohne Speicher gilt das Ausblenden nur bis zum Neuladen
  }
}
export function hideRoom(code: string): string[] {
  const next = [code, ...loadHidden().filter((c) => c !== code)];
  save(next);
  return next;
}
export function showAllHidden(): string[] {
  save([]);
  return [];
}
