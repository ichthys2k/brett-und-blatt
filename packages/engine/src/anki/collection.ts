import { newGuid, newId } from './ids';
import { DEFAULT_DECK_ID, STOCK_BASIC_ID, defaultDeck, stockNotetypes } from './stock';
import { cleanFieldText, fieldIsEmpty } from './text';
import type { AnkiCard, AnkiCollection, AnkiDeck, AnkiGrave, AnkiNote, AnkiNotetype } from './types';

/*
 * Eine Sammlung im Sinne von Anki: Notiztypen, Stapel, Notizen und Löschvermerke. Reine Funktionen auf unveränderlichen Werten
 * (jede Änderung gibt eine neue Sammlung zurück), ohne Browser. Karten werden aus Notiz und Notiztyp abgeleitet; der Lernstand je
 * Karte kommt mit L5, die Karten selbst gibt es beim Export (L3) mit ihren Kennungen.
 */

export const COLLECTION_NOTES_MAX = 50_000;
export const FIELD_LENGTH_MAX = 50_000;
export const FIELDS_MAX = 40;
/** Löschvermerke bleiben so lange, damit ein anderes Gerät Gelöschtes nicht zurückbringt. */
const GRAVE_KEEP_MS = 90 * 24 * 60 * 60 * 1000;

const sec = (ms: number): number => Math.floor(ms / 1000);

/** Eine neue Sammlung mit den eingebauten Notiztypen und dem Standardstapel (beide mit Zeit 0, damit sie auf jedem Gerät gleich sind). */
export function emptyCollection(): AnkiCollection {
  return { v: 2, notetypes: stockNotetypes(), decks: [defaultDeck()], notes: [], graves: [] };
}

/** Ohne die eingebauten Notiztypen und den Standardstapel, solange sie unverändert sind (`sanitizeCollection` setzt sie wieder ein); für Speicher und Sicherung. */
export function compactCollection(col: AnkiCollection): AnkiCollection {
  const stock = new Map(stockNotetypes().map((nt) => [nt.id, JSON.stringify(nt)]));
  const plainDeck = JSON.stringify(defaultDeck());
  return { ...col, notetypes: col.notetypes.filter((nt) => stock.get(nt.id) !== JSON.stringify(nt)), decks: col.decks.filter((d) => JSON.stringify(d) !== plainDeck) };
}

export const notetypeOf = (col: AnkiCollection, id: number): AnkiNotetype | undefined => col.notetypes.find((nt) => nt.id === id);
export const deckOf = (col: AnkiCollection, id: number): AnkiDeck | undefined => col.decks.find((deck) => deck.id === id);

// ---------------------------------------------------------------- Karten

/** Lückennummern (c1, c2 …), die in den Feldern stehen, die die Vorderseite mit `{{cloze:Feld}}` zeigt; Ergebnis als Nummern ab 0. */
export function clozeOrds(nt: AnkiNotetype, fields: readonly string[]): number[] {
  const used = new Set<string>();
  for (const tmpl of nt.tmpls) for (const m of tmpl.qfmt.matchAll(/\{\{(?:[^{}:]+:)*cloze:(?:[^{}:]+:)*([^{}:]+)\}\}/g)) used.add(m[1]!);
  const ords = new Set<number>();
  for (const name of used) {
    const at = nt.flds.findIndex((f) => f.name === name);
    const text = at >= 0 ? (fields[at] ?? '') : '';
    for (const m of text.matchAll(/\{\{c(\d+)::/g)) {
      const n = Number(m[1]);
      if (n >= 1 && n <= 99) ords.add(n - 1);
    }
  }
  return [...ords].sort((a, b) => a - b);
}

/** Welche Karten eine Notiz ergibt (Nummern der Vorlagen bzw. Lücken). Anki erzeugt keine Karte mit leerer Vorderseite. */
export function cardOrds(nt: AnkiNotetype, fields: readonly string[]): number[] {
  if (nt.type === 1) return clozeOrds(nt, fields);
  const out: number[] = [];
  for (const [ord, kind, needed] of nt.req) {
    if (kind === 'none') continue;
    const filled = needed.map((i) => !fieldIsEmpty(fields[i] ?? ''));
    if (kind === 'any' ? filled.some(Boolean) : filled.every(Boolean)) out.push(ord);
  }
  return out.sort((a, b) => a - b);
}

/** Feste Kennung einer abgeleiteten Karte. */
export const derivedCardId = (noteId: number, ord: number): number => noteId * 100 + ord;

export function cardsOf(col: AnkiCollection): AnkiCard[] {
  const types = new Map(col.notetypes.map((nt) => [nt.id, nt]));
  const cards: AnkiCard[] = [];
  for (const note of col.notes) {
    const nt = types.get(note.mid);
    if (!nt) continue;
    for (const ord of cardOrds(nt, note.fields)) cards.push({ id: derivedCardId(note.id, ord), nid: note.id, did: note.did, ord });
  }
  return cards;
}

// ---------------------------------------------------------------- Stapel

/** Stapelnamen sind eindeutig; ein gleicher Name bekommt eine Zahl angehängt. */
function uniqueDeckName(col: AnkiCollection, name: string, except?: number): string {
  const base = name.split('::').map((part) => part.trim()).filter(Boolean).join('::').slice(0, 120) || 'Stapel';
  const taken = new Set(col.decks.filter((d) => d.id !== except).map((d) => d.name.toLowerCase()));
  let candidate = base;
  for (let n = 2; taken.has(candidate.toLowerCase()); n++) candidate = `${base} (${n})`;
  return candidate;
}

export function addDeck(col: AnkiCollection, name: string, now = Date.now()): { col: AnkiCollection; deck: AnkiDeck } {
  const id = newId(now, new Set(col.decks.map((d) => d.id)));
  const deck: AnkiDeck = { ...defaultDeck(), id, name: uniqueDeckName(col, name), mod: sec(now) };
  return { col: { ...col, decks: [...col.decks, deck] }, deck };
}

export function renameDeck(col: AnkiCollection, id: number, name: string, now = Date.now()): AnkiCollection {
  const deck = deckOf(col, id);
  if (!deck || deck.id === DEFAULT_DECK_ID) return col;
  const next = uniqueDeckName(col, name, id);
  if (next === deck.name) return col;
  return { ...col, decks: col.decks.map((d) => (d.id === id ? { ...d, name: next, mod: sec(now) } : d)) };
}

/** Löscht einen Stapel samt seinen Notizen (der Standardstapel bleibt). */
export function removeDeck(col: AnkiCollection, id: number, now = Date.now()): AnkiCollection {
  if (id === DEFAULT_DECK_ID || !deckOf(col, id)) return col;
  const gone = col.notes.filter((n) => n.did === id);
  return {
    ...col,
    decks: col.decks.filter((d) => d.id !== id),
    notes: col.notes.filter((n) => n.did !== id),
    graves: pruneGraves([...col.graves, { kind: 'deck', key: String(id), at: now }, ...gone.map((n): AnkiGrave => ({ kind: 'note', key: n.guid, at: now }))], now),
  };
}

// ---------------------------------------------------------------- Notizen

export interface NewNote {
  notetypeId: number;
  deckId: number;
  fields: string[];
  tags?: string[];
  guid?: string;
  id?: number;
}

const cleanTags = (tags: readonly string[] | undefined): string[] => [...new Set((tags ?? []).map((t) => t.trim().replace(/\s+/g, '_')).filter(Boolean))].slice(0, 50);

export function addNote(col: AnkiCollection, input: NewNote, now = Date.now()): { col: AnkiCollection; note: AnkiNote } {
  const nt = notetypeOf(col, input.notetypeId);
  if (!nt) throw new Error(`Notiztyp ${input.notetypeId} unbekannt`);
  if (!deckOf(col, input.deckId)) throw new Error(`Stapel ${input.deckId} unbekannt`);
  if (input.fields.length !== nt.flds.length) throw new Error(`Notiztyp „${nt.name}“ hat ${nt.flds.length} Felder, nicht ${input.fields.length}`);
  const note: AnkiNote = {
    id: input.id ?? newId(now, new Set(col.notes.map((n) => n.id))),
    guid: input.guid ?? newGuid(),
    mid: nt.id,
    did: input.deckId,
    mod: sec(now),
    tags: cleanTags(input.tags),
    fields: input.fields.map((f) => cleanFieldText(f).slice(0, FIELD_LENGTH_MAX)),
  };
  return { col: { ...col, notes: [...col.notes, note] }, note };
}

export function updateNote(col: AnkiCollection, id: number, patch: Partial<Pick<AnkiNote, 'fields' | 'tags' | 'did'>>, now = Date.now()): AnkiCollection {
  const note = col.notes.find((n) => n.id === id);
  if (!note) return col;
  const nt = notetypeOf(col, note.mid);
  const fields = patch.fields && nt && patch.fields.length === nt.flds.length ? patch.fields.map((f) => cleanFieldText(f).slice(0, FIELD_LENGTH_MAX)) : note.fields;
  const tags = patch.tags ? cleanTags(patch.tags) : note.tags;
  const did = patch.did !== undefined && deckOf(col, patch.did) ? patch.did : note.did;
  if (fields.every((f, i) => f === note.fields[i]) && tags.join(' ') === note.tags.join(' ') && did === note.did) return col;
  return { ...col, notes: col.notes.map((n) => (n.id === id ? { ...n, fields, tags, did, mod: sec(now) } : n)) };
}

export function removeNote(col: AnkiCollection, id: number, now = Date.now()): AnkiCollection {
  const note = col.notes.find((n) => n.id === id);
  if (!note) return col;
  return { ...col, notes: col.notes.filter((n) => n.id !== id), graves: pruneGraves([...col.graves, { kind: 'note', key: note.guid, at: now }], now) };
}

// ---------------------------------------------------------------- Löschvermerke, Prüfen, Zusammenführen

function pruneGraves(graves: AnkiGrave[], now: number): AnkiGrave[] {
  const latest = new Map<string, AnkiGrave>();
  for (const grave of graves) {
    if (now - grave.at > GRAVE_KEEP_MS) continue;
    const key = `${grave.kind}:${grave.key}`;
    const known = latest.get(key);
    if (!known || grave.at > known.at) latest.set(key, grave);
  }
  return [...latest.values()];
}

const isObject = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const int = (value: unknown): number | null => (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : null);

function sanitizeNotetype(value: unknown): AnkiNotetype | null {
  if (!isObject(value)) return null;
  const id = int(value.id);
  if (id === null || typeof value.name !== 'string' || !Array.isArray(value.flds) || !Array.isArray(value.tmpls) || value.flds.length === 0 || value.flds.length > FIELDS_MAX || value.tmpls.length === 0 || value.tmpls.length > 100) return null;
  const flds = value.flds.filter((f): f is Record<string, unknown> => isObject(f) && typeof f.name === 'string').map((f, i) => ({ ...f, name: String(f.name).slice(0, 100), ord: i }));
  const tmpls = value.tmpls
    .filter((t): t is Record<string, unknown> => isObject(t) && typeof t.name === 'string' && typeof t.qfmt === 'string' && typeof t.afmt === 'string')
    .map((t, i) => ({ ...t, name: String(t.name).slice(0, 100), ord: i, qfmt: String(t.qfmt), afmt: String(t.afmt) }));
  if (flds.length === 0 || tmpls.length === 0) return null;
  const req = Array.isArray(value.req)
    ? value.req.filter((r): r is [number, 'any' | 'all' | 'none', number[]] => Array.isArray(r) && typeof r[0] === 'number' && (r[1] === 'any' || r[1] === 'all' || r[1] === 'none') && Array.isArray(r[2]) && r[2].every((n) => typeof n === 'number'))
    : [];
  const sortf = int(value.sortf);
  return { ...value, id, name: value.name.slice(0, 100), type: value.type === 1 ? 1 : 0, mod: int(value.mod) ?? 0, sortf: sortf !== null && sortf < flds.length ? sortf : 0, flds, tmpls, css: typeof value.css === 'string' ? value.css : '', req };
}

function sanitizeDeck(value: unknown): AnkiDeck | null {
  if (!isObject(value)) return null;
  const id = int(value.id);
  if (id === null || typeof value.name !== 'string' || !value.name.trim()) return null;
  return { ...value, id, name: value.name.slice(0, 200), mod: int(value.mod) ?? 0 };
}

/** Macht aus fremden Daten eine gültige Sammlung (Unbrauchbares fällt weg; Notizen ohne Notiztyp ebenso, Notizen ohne Stapel kommen in den Standardstapel). */
export function sanitizeCollection(value: unknown): AnkiCollection {
  const v = isObject(value) ? value : {};
  const base = emptyCollection();
  const notetypes = new Map<number, AnkiNotetype>();
  for (const nt of base.notetypes) notetypes.set(nt.id, nt);
  if (Array.isArray(v.notetypes)) for (const item of v.notetypes.slice(0, 200)) {
    const nt = sanitizeNotetype(item);
    if (nt) notetypes.set(nt.id, nt);
  }
  const decks = new Map<number, AnkiDeck>([[DEFAULT_DECK_ID, base.decks[0]!]]);
  if (Array.isArray(v.decks)) for (const item of v.decks.slice(0, 5000)) {
    const deck = sanitizeDeck(item);
    if (deck) decks.set(deck.id, deck);
  }
  const notes = new Map<string, AnkiNote>();
  if (Array.isArray(v.notes)) for (const item of v.notes.slice(0, COLLECTION_NOTES_MAX)) {
    if (!isObject(item)) continue;
    const id = int(item.id);
    const nt = typeof item.mid === 'number' ? notetypes.get(item.mid) : undefined;
    if (id === null || typeof item.guid !== 'string' || !item.guid || item.guid.length > 40 || !nt || !Array.isArray(item.fields) || item.fields.length !== nt.flds.length || !item.fields.every((f) => typeof f === 'string')) continue;
    const did = typeof item.did === 'number' && decks.has(item.did) ? item.did : DEFAULT_DECK_ID;
    const tags = Array.isArray(item.tags) ? cleanTags(item.tags.filter((t): t is string => typeof t === 'string')) : [];
    const flags = int(item.flags);
    notes.set(item.guid, {
      id,
      guid: item.guid,
      mid: nt.id,
      did,
      mod: int(item.mod) ?? 0,
      tags,
      fields: (item.fields as string[]).map((f) => cleanFieldText(f).slice(0, FIELD_LENGTH_MAX)),
      ...(flags ? { flags } : {}),
      ...(typeof item.data === 'string' && item.data ? { data: item.data.slice(0, 5000) } : {}),
    });
  }
  const graves: AnkiGrave[] = [];
  if (Array.isArray(v.graves)) for (const item of v.graves.slice(0, 50_000)) {
    if (isObject(item) && (item.kind === 'note' || item.kind === 'deck' || item.kind === 'notetype') && typeof item.key === 'string' && item.key.length <= 40 && typeof item.at === 'number' && Number.isFinite(item.at)) graves.push({ kind: item.kind, key: item.key, at: item.at });
  }
  return { v: 2, notetypes: [...notetypes.values()], decks: [...decks.values()], notes: [...notes.values()], graves };
}

/**
 * Führt zwei Stände zusammen (zwei Geräte, oder Gerät und Sicherung): Je Notiz (über die `guid`), Stapel und Notiztyp gewinnt die jüngere Änderung,
 * bei Gleichstand der lokale Stand. Ein Löschvermerk gilt, solange nach ihm nichts Neueres geändert wurde.
 */
export function mergeCollections(remote: AnkiCollection, local: AnkiCollection, now = Date.now()): AnkiCollection {
  const graves = pruneGraves([...remote.graves, ...local.graves], now);
  const graveAt = new Map(graves.map((g) => [`${g.kind}:${g.key}`, g.at]));
  // Bei gleicher Änderungszeit gewinnt der lokale Stand.
  const youngest = <K, T extends { mod: number }>(remoteItems: Map<K, T>, localItems: Map<K, T>): Map<K, T> => {
    const out = new Map(localItems);
    for (const [key, item] of remoteItems) {
      const mine = out.get(key);
      if (!mine || item.mod > mine.mod) out.set(key, item);
    }
    return out;
  };
  const keep = <T extends { mod: number }>(kind: AnkiGrave['kind'], key: string, item: T): boolean => (graveAt.get(`${kind}:${key}`) ?? -1) < item.mod * 1000;

  const notetypes = youngest(new Map(remote.notetypes.map((nt) => [nt.id, nt])), new Map(local.notetypes.map((nt) => [nt.id, nt])));
  const decks = youngest(new Map(remote.decks.map((d) => [d.id, d])), new Map(local.decks.map((d) => [d.id, d])));
  for (const [id, deck] of decks) if (id !== DEFAULT_DECK_ID && !keep('deck', String(id), deck)) decks.delete(id);
  const notes = youngest(new Map(remote.notes.map((n) => [n.guid, n])), new Map(local.notes.map((n) => [n.guid, n])));
  const live = [...notes.values()].filter((n) => keep('note', n.guid, n) && notetypes.has(n.mid)).map((n) => (decks.has(n.did) ? n : { ...n, did: DEFAULT_DECK_ID }));
  const liveGuids = new Set(live.map((n) => n.guid));
  const liveDecks = new Set(decks.keys());
  const keptGraves = graves.filter((g) => (g.kind === 'note' ? !liveGuids.has(g.key) : g.kind === 'deck' ? !liveDecks.has(Number(g.key)) : true));
  return { v: 2, notetypes: [...notetypes.values()], decks: [...decks.values()], notes: live, graves: keptGraves };
}

const canonical = (col: AnkiCollection): string => JSON.stringify({ ...col, notetypes: [...col.notetypes].sort((a, b) => a.id - b.id), decks: [...col.decks].sort((a, b) => a.id - b.id), notes: [...col.notes].sort((a, b) => a.guid.localeCompare(b.guid)), graves: [...col.graves].sort((a, b) => `${a.kind}:${a.key}`.localeCompare(`${b.kind}:${b.key}`)) });
export const sameCollection = (a: AnkiCollection, b: AnkiCollection): boolean => canonical(a) === canonical(b);

export { STOCK_BASIC_ID };
