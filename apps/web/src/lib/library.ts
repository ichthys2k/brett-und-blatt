import { LIBRARY_KEY } from '@brett-und-blatt/ui';
import { collectionFromStored, compactCollection, deletePack as deleteDeckPack, emptyCollection, idFromSeed, packIdOf, packsOf, rowsFromText, sanitizeLibrary, savePackRows, textFromRows, type AnkiCollection, type UserPack } from '@brett-und-blatt/engine';
import { moveShare } from './packShare';
import { passSyncSoon } from './playerPass';

/*
 * Bibliothek des Passes (#101, L1): eine Sammlung im Anki-Modell (Notizen, Notiztypen, Stapel) im Pass-Block `bibliothek`. Ein „Paket“ ist
 * die Sicht auf einen Stapel: jede Notiz mit zwei Feldern ergibt ein Paar (Feld A, Feld B). Die frühere Liste von Paketen wird beim ersten
 * Lesen umgestellt (Kennungen entstehen aus den alten, damit alle Geräte dasselbe ergeben). Gelöschte Stapel hinterlassen Löschvermerke.
 */

export { LIBRARY_KEY };

export function loadCollection(): AnkiCollection {
  try {
    const raw = JSON.parse(window.localStorage.getItem(LIBRARY_KEY) ?? 'null');
    const col = collectionFromStored(raw);
    // Die frühere Liste von Paketen wird einmal umgestellt und gleich im neuen Format gespeichert; geteilte Pakete behalten ihren Link.
    if (Array.isArray(raw)) {
      for (const old of sanitizeLibrary(raw)) if (!old.deleted) moveShare(old.id, packIdOf(idFromSeed(`deck:${old.id}`)));
      saveCollection(col);
    }
    return col;
  } catch {
    return emptyCollection();
  }
}

export function saveCollection(col: AnkiCollection): void {
  try {
    window.localStorage.setItem(LIBRARY_KEY, JSON.stringify(compactCollection(col)));
  } catch {
    // ohne Speicher gilt die Bibliothek nur bis zum Neuladen
  }
  passSyncSoon();
}

/** Die Pakete (Stapel mit mindestens einem Paar). */
export const loadLibrary = (): UserPack[] => packsOf(loadCollection());

export { rowsFromText, textFromRows };

/** Legt ein Paket an oder aktualisiert es (der Stapel bleibt derselbe, Zeilen behalten ihre Notiz). */
export function savePack(existing: Pick<UserPack, 'id'> | null, name: string, rows: readonly { id?: string; a: string; b: string }[]): UserPack {
  const saved = savePackRows(loadCollection(), existing?.id ?? null, name, rows);
  saveCollection(saved.col);
  return packsOf(saved.col).find((pack) => pack.id === saved.packId)!;
}

export function deletePack(id: string): void {
  saveCollection(deleteDeckPack(loadCollection(), id));
}
