import { newRowId, parsePackText, sanitizeLibrary, type PackRow, type UserPack } from '../packs';
import { addDeck, addNote, deckOf, emptyCollection, notetypeOf, removeDeck, removeNote, renameDeck, sanitizeCollection, updateNote } from './collection';
import { guidFromSeed, idFromSeed } from './ids';
import { DEFAULT_DECK_ID, STOCK_BASIC_ID } from './stock';
import { stripHtml } from './text';
import type { AnkiCollection, AnkiNote } from './types';

/*
 * Brücke zu den Spielen (Vorhaben #101, L1): Paare finden, Schwarzer Peter und Bingo kennen weiter nur „Pakete“ aus Paaren (Feld A,
 * Feld B). Ein Paket ist jetzt die Sicht auf einen **Stapel** der Sammlung: jede Notiz mit mindestens zwei Feldern ergibt ein Paar
 * aus dem Text der ersten beiden Felder. Die Spiele selbst und ihre verborgene Option `pack` bleiben unverändert.
 */

const hex = (n: number): string => n.toString(16).padStart(6, '0');
export const packIdOf = (deckId: number): string => `d-${hex(deckId)}`;
export const rowIdOf = (noteId: number): string => `n-${hex(noteId)}`;
const parseId = (id: string): number | null => (/^[a-z]-[0-9a-f]{6,16}$/.test(id) ? parseInt(id.slice(2), 16) : null);
export const deckIdOfPack = (packId: string): number | null => (packId.startsWith('d-') ? parseId(packId) : null);

export const escapeHtml = (text: string): string => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const plain = (html: string): string => stripHtml(html).replace(/\s+/g, ' ').trim();
const hasMedia = (html: string): boolean => /<\s*(?:img|audio|video|object|source)\b|\[sound:/i.test(html);

/** Taugt die Notiz als Paar? Normale Notiztypen mit zwei Feldern, ohne Bild und Ton, beide Seiten mit Text. */
function pairOf(col: AnkiCollection, note: AnkiNote): PackRow | null {
  const nt = notetypeOf(col, note.mid);
  if (!nt || nt.type !== 0 || note.fields.length < 2) return null;
  const [first, second] = note.fields as [string, string];
  if (hasMedia(first) || hasMedia(second)) return null;
  const a = plain(first);
  const b = plain(second);
  return a && b ? { id: rowIdOf(note.id), a, b } : null;
}

/** Die Stapel als Pakete: nur Stapel, in denen mindestens ein Paar steckt. */
export function packsOf(col: AnkiCollection): UserPack[] {
  const packs: UserPack[] = [];
  for (const deck of col.decks) {
    const notes = col.notes.filter((n) => n.did === deck.id);
    const rows: PackRow[] = [];
    let at = deck.mod * 1000;
    for (const note of notes) {
      const row = pairOf(col, note);
      if (!row) continue;
      rows.push(row);
      at = Math.max(at, note.mod * 1000);
    }
    if (rows.length > 0 && deck.id !== DEFAULT_DECK_ID) packs.push({ id: packIdOf(deck.id), name: deck.name, rows, at });
  }
  return packs;
}

/**
 * Legt ein Paket als Stapel an oder aktualisiert es: Zeilen mit bekannter Kennung bleiben dieselbe Notiz (ihr Feld ändert sich nur, wenn
 * der Text sich geändert hat, damit eingebettetes HTML nicht verloren geht), neue Zeilen werden Notizen, fehlende Zeilen werden gelöscht.
 */
export function savePackRows(col: AnkiCollection, packId: string | null, name: string, rows: readonly { id?: string; a: string; b: string }[], now = Date.now()): { col: AnkiCollection; packId: string } {
  let next = col;
  let deckId = packId ? deckIdOfPack(packId) : null;
  if (deckId !== null && !deckOf(next, deckId)) deckId = null;
  if (deckId === null) {
    const added = addDeck(next, name, now);
    next = added.col;
    deckId = added.deck.id;
  } else {
    next = renameDeck(next, deckId, name, now);
  }
  const deck = deckId;
  const existing = new Map(next.notes.filter((n) => n.did === deck).map((n) => [rowIdOf(n.id), n]));
  const wanted = new Set<string>();
  for (const row of rows) {
    const known = row.id ? existing.get(row.id) : undefined;
    if (known) {
      wanted.add(row.id!);
      const [first, second, ...rest] = known.fields;
      const fields = [plain(first ?? '') === row.a ? (first ?? '') : escapeHtml(row.a), plain(second ?? '') === row.b ? (second ?? '') : escapeHtml(row.b), ...rest];
      next = updateNote(next, known.id, { fields }, now);
    } else {
      const added = addNote(next, { notetypeId: STOCK_BASIC_ID, deckId: deck, fields: [escapeHtml(row.a), escapeHtml(row.b)] }, now + wanted.size + next.notes.length);
      next = added.col;
      wanted.add(rowIdOf(added.note.id));
    }
  }
  for (const [id, note] of existing) if (!wanted.has(id) && pairOf(next, note)) next = removeNote(next, note.id, now);
  return { col: next, packId: packIdOf(deck) };
}

export function deletePack(col: AnkiCollection, packId: string, now = Date.now()): AnkiCollection {
  const deckId = deckIdOfPack(packId);
  return deckId === null ? col : removeDeck(col, deckId, now);
}

// ---------------------------------------------------------------- Übergang von der alten Bibliothek

/**
 * Macht aus der bisherigen Bibliothek (Liste von Paketen mit Zeilen A und B) eine Sammlung. Kennungen entstehen aus den alten Kennungen,
 * damit jedes Gerät beim Umstellen dieselben Stapel und Notizen bekommt und sie sich später zusammenführen lassen.
 */
export function migrateLibrary(packs: readonly UserPack[]): AnkiCollection {
  let col = emptyCollection();
  for (const pack of packs) {
    const deckId = idFromSeed(`deck:${pack.id}`);
    if (pack.deleted) {
      col = { ...col, graves: [...col.graves, { kind: 'deck', key: String(deckId), at: pack.at }] };
      continue;
    }
    const added = addDeck(col, pack.name, pack.at);
    // addDeck vergibt eine Kennung aus der Uhr; für den Übergang soll sie aus der alten Kennung entstehen.
    col = { ...added.col, decks: added.col.decks.map((d) => (d.id === added.deck.id ? { ...d, id: deckId, mod: Math.floor(pack.at / 1000) } : d)) };
    for (const row of pack.rows) {
      const note: AnkiNote = { id: idFromSeed(`note:${row.id}`), guid: guidFromSeed(row.id), mid: STOCK_BASIC_ID, did: deckId, mod: Math.floor(pack.at / 1000), tags: [], fields: [escapeHtml(row.a), escapeHtml(row.b)] };
      col = { ...col, notes: [...col.notes, note] };
    }
  }
  return col;
}

/** Der Wert, wie er gespeichert wird: die neue Sammlung, oder die bisherige Liste von Paketen (wird umgestellt). */
export function collectionFromStored(value: unknown): AnkiCollection {
  return Array.isArray(value) ? migrateLibrary(sanitizeLibrary(value)) : sanitizeCollection(value);
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
