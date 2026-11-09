import { LIBRARY_KEY } from '@brett-und-blatt/ui';
import { mergeLibrary, newPackId, newRowId, parsePackText, sameLibrary, sanitizeLibrary, type PackRow, type UserPack } from '@brett-und-blatt/engine';
import { passSyncSoon } from './playerPass';

/*
 * Bibliothek des Passes (#101): eigene Pakete (Paare aus Feld A und B) im Pass-Block `bibliothek`. Jedes Paket und jede Zeile hat eine
 * feste Kennung, die beim Bearbeiten bleibt. Gelöschte Pakete bleiben eine Weile als Vermerk, damit ein anderes Gerät sie nicht zurückbringt.
 */

export { LIBRARY_KEY, mergeLibrary, sameLibrary, sanitizeLibrary };

export function loadLibrary(): UserPack[] {
  try {
    return sanitizeLibrary(JSON.parse(window.localStorage.getItem(LIBRARY_KEY) ?? 'null'));
  } catch {
    return [];
  }
}

export function saveLibrary(list: UserPack[]): void {
  try {
    window.localStorage.setItem(LIBRARY_KEY, JSON.stringify(list));
  } catch {
    // ohne Speicher gilt die Bibliothek nur bis zum Neuladen
  }
  passSyncSoon();
}

/** Zeilen aus dem Text; eine Zeile behält ihre Kennung, wenn sie (fast) unverändert geblieben ist. */
export function rowsFromText(text: string, previous: readonly PackRow[]): { rows: PackRow[]; skipped: number } {
  const { rows, skipped } = parsePackText(text);
  const free = [...previous];
  const take = (match: (row: PackRow) => boolean): string | null => {
    const at = free.findIndex(match);
    return at >= 0 ? free.splice(at, 1)[0]!.id : null;
  };
  const withIds = rows.map((row) => ({ id: take((p) => p.a === row.a && p.b === row.b) ?? '', ...row }));
  for (const row of withIds) if (!row.id) row.id = take((p) => p.a === row.a || p.b === row.b) ?? newRowId();
  return { rows: withIds, skipped };
}

export const textFromRows = (rows: readonly PackRow[]): string => rows.map((row) => `${row.a};${row.b}`).join('\n');

export function savePack(existing: UserPack | null, name: string, rows: PackRow[]): UserPack {
  const pack: UserPack = { id: existing?.id ?? newPackId(), name, rows, at: Date.now() };
  saveLibrary([pack, ...loadLibrary().filter((p) => p.id !== pack.id)]);
  return pack;
}

export function deletePack(id: string): void {
  saveLibrary([{ id, name: '', rows: [], at: Date.now(), deleted: true }, ...loadLibrary().filter((p) => p.id !== id)]);
}
