import { cardOrds, derivedCardId, emptyCollection } from '../collection';
import { noteKeys } from '../text';
import { defaultDeck, STOCK_BASIC_ID } from '../stock';
import type { AnkiCollection, AnkiDeck, AnkiNotetype } from '../types';
import { encodeMediaEntries, pbVarint } from './proto';
import { sha1 } from '../sha1';
import type { ApkgCard, ApkgData, ApkgDeps, ApkgRevlog, SqlDb } from './types';

/*
 * Schreibt ein Anki-Paket im älteren Format (Legacy 2: `meta` mit Version 2, `collection.anki21` mit Schema 11, dazu die kleine
 * Platzhalter-Sammlung `collection.anki2`, die alte Anki-Versionen zum Aktualisieren auffordert). Aktuelle Anki-Versionen lesen es.
 * Das neue Format (zstd, Schema 18) folgt. Reine Logik: SQLite und ZIP kommen von außen (`ApkgDeps`, Web-App).
 */

const SCHEMA_11 = [
  'CREATE TABLE col (id integer PRIMARY KEY, crt integer NOT NULL, mod integer NOT NULL, scm integer NOT NULL, ver integer NOT NULL, dty integer NOT NULL, usn integer NOT NULL, ls integer NOT NULL, conf text NOT NULL, models text NOT NULL, decks text NOT NULL, dconf text NOT NULL, tags text NOT NULL)',
  'CREATE TABLE notes (id integer PRIMARY KEY, guid text NOT NULL, mid integer NOT NULL, mod integer NOT NULL, usn integer NOT NULL, tags text NOT NULL, flds text NOT NULL, sfld integer NOT NULL, csum integer NOT NULL, flags integer NOT NULL, data text NOT NULL)',
  'CREATE TABLE cards (id integer PRIMARY KEY, nid integer NOT NULL, did integer NOT NULL, ord integer NOT NULL, mod integer NOT NULL, usn integer NOT NULL, type integer NOT NULL, queue integer NOT NULL, due integer NOT NULL, ivl integer NOT NULL, factor integer NOT NULL, reps integer NOT NULL, lapses integer NOT NULL, left integer NOT NULL, odue integer NOT NULL, odid integer NOT NULL, flags integer NOT NULL, data text NOT NULL)',
  'CREATE TABLE revlog (id integer PRIMARY KEY, cid integer NOT NULL, usn integer NOT NULL, ease integer NOT NULL, ivl integer NOT NULL, lastIvl integer NOT NULL, factor integer NOT NULL, time integer NOT NULL, type integer NOT NULL)',
  'CREATE TABLE graves (usn integer NOT NULL, oid integer NOT NULL, type integer NOT NULL)',
  'CREATE INDEX ix_notes_usn ON notes (usn)',
  'CREATE INDEX ix_cards_usn ON cards (usn)',
  'CREATE INDEX ix_revlog_usn ON revlog (usn)',
  'CREATE INDEX ix_cards_nid ON cards (nid)',
  'CREATE INDEX ix_cards_sched ON cards (did, queue, due)',
  'CREATE INDEX ix_revlog_cid ON revlog (cid)',
  'CREATE INDEX ix_notes_csum ON notes (csum)',
];

const DEFAULT_CONF = { activeDecks: [1], curDeck: 1, newSpread: 0, collapseTime: 1200, timeLim: 0, estTimes: true, dueCounts: true, curModel: null, nextPos: 1, sortType: 'noteFld', sortBackwards: false, addToCur: true };
const DEFAULT_DCONF = {
  '1': {
    id: 1,
    mod: 0,
    name: 'Default',
    usn: 0,
    maxTaken: 60,
    autoplay: true,
    timer: 0,
    replayq: true,
    new: { bury: false, delays: [1, 10], initialFactor: 2500, ints: [1, 4, 0], order: 1, perDay: 20 },
    rev: { bury: false, ease4: 1.3, ivlFct: 1, maxIvl: 36500, perDay: 200, hardFactor: 1.2 },
    lapse: { delays: [10], leechAction: 1, leechFails: 8, minInt: 1, mult: 0 },
    dyn: false,
  },
};

export interface ApkgWriteOptions {
  /** Lernfortschritt (Karten-Zustand, Protokoll) mitgeben? Sonst sind alle Karten neu und die Tags `leech` und `marked` fallen weg. */
  scheduling: boolean;
  /** Medien mitgeben? */
  media: boolean;
  /** `legacy2` (Standard): alle Anki-Versionen lesen es. `latest`: kleiner (zstd), für neuere Anki-Versionen. */
  format?: 'legacy2' | 'latest';
  now?: number;
}

/** Namen der Dateien, auf die Felder, Vorlagen und CSS verweisen. */
export function usedMedia(col: AnkiCollection): Set<string> {
  const names = new Set<string>();
  const scan = (text: string) => {
    for (const m of text.matchAll(/<\s*(?:img|audio|video|source|object)\b[^>]*?\b(?:src|data)\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s>]+))/gi)) names.add(decodeURIComponent((m[1] ?? m[2] ?? m[3] ?? '').replace(/%(?![0-9a-f]{2})/gi, '%25')));
    for (const m of text.matchAll(/\[sound:([^\]]+)\]/g)) names.add(m[1]!);
    for (const m of text.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/g)) if (!/^(?:https?:|data:)/i.test(m[1]!)) names.add(m[1]!);
  };
  for (const note of col.notes) for (const field of note.fields) scan(field);
  for (const nt of col.notetypes) {
    scan(nt.css);
    for (const t of nt.tmpls) {
      scan(t.qfmt);
      scan(t.afmt);
    }
  }
  return names;
}

/** Nur ein Stapel samt Unterstapeln, mit den Notiztypen, die seine Notizen brauchen (der Standardstapel bleibt immer dabei). */
export function subsetCollection(col: AnkiCollection, deckId: number): AnkiCollection {
  const deck = col.decks.find((d) => d.id === deckId);
  if (!deck) return col;
  const decks = col.decks.filter((d) => d.id === 1 || d.id === deck.id || d.name.startsWith(`${deck.name}::`));
  const ids = new Set(decks.map((d) => d.id));
  const notes = col.notes.filter((n) => ids.has(n.did));
  const used = new Set(notes.map((n) => n.mid));
  return { ...col, decks, notes, notetypes: col.notetypes.filter((nt) => used.has(nt.id)), graves: [] };
}

const csv = (tags: readonly string[]): string => (tags.length ? ` ${tags.join(' ')} ` : '');

function fillDb(db: SqlDb, data: { collection: AnkiCollection; cards: ApkgCard[]; revlog: ApkgRevlog[]; conf: Record<string, unknown> | null; dconf: Record<string, unknown> | null }, now: number): void {
  for (const sql of SCHEMA_11) db.run(sql);
  const sec = Math.floor(now / 1000);
  const models: Record<string, unknown> = {};
  for (const nt of data.collection.notetypes) models[String(nt.id)] = { vers: [], tags: [], latexsvg: false, ...nt, usn: -1, mod: nt.mod || sec };
  const decks: Record<string, unknown> = {};
  const baseDeck = { ...defaultDeck(), lrnToday: [0, 0], revToday: [0, 0], newToday: [0, 0], timeToday: [0, 0], browserCollapsed: true, extendNew: 0, extendRev: 0 };
  for (const d of data.collection.decks) decks[String(d.id)] = { ...baseDeck, ...d, usn: -1, mod: d.mod || sec, ...(d.id === 1 ? { name: 'Default' } : {}) };
  const crt = Math.floor(sec / 86400) * 86400;
  db.run('INSERT INTO col VALUES (1, ?, ?, ?, 11, 0, 0, 0, ?, ?, ?, ?, ?)', [crt, now, now, JSON.stringify(data.conf ?? DEFAULT_CONF), JSON.stringify(models), JSON.stringify(decks), JSON.stringify(data.dconf ?? DEFAULT_DCONF), '{}']);
  const sortf = new Map(data.collection.notetypes.map((nt) => [nt.id, nt.sortf]));
  db.batch(
    'INSERT INTO notes VALUES (?, ?, ?, ?, -1, ?, ?, ?, ?, ?, ?)',
    data.collection.notes.map((n) => {
      const keys = noteKeys(n.fields, sortf.get(n.mid) ?? 0);
      return [n.id, n.guid, n.mid, n.mod, csv(n.tags), n.fields.join('\x1f'), keys.sfld, keys.csum, n.flags ?? 0, n.data ?? ''];
    }),
  );
  db.batch(
    'INSERT INTO cards VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    data.cards.map((c) => [c.id, c.nid, c.did, c.ord, c.mod, c.usn, c.type, c.queue, c.due, c.ivl, c.factor, c.reps, c.lapses, c.left, c.odue, c.odid, c.flags, c.data]),
  );
  db.batch(
    'INSERT INTO revlog VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    data.revlog.map((r) => [r.id, r.cid, r.usn, r.ease, r.ivl, r.lastIvl, r.factor, r.time, r.type]),
  );
}

/** Karten für den Export: die gelesenen mit ihrem Stand, dazu fehlende (neue Notizen, neue Vorlagen) als neue Karten. */
function cardsFor(col: AnkiCollection, existing: readonly ApkgCard[] | undefined, scheduling: boolean, now: number): ApkgCard[] {
  const types = new Map(col.notetypes.map((nt) => [nt.id, nt]));
  const byKey = new Map((existing ?? []).map((c) => [`${c.nid}:${c.ord}`, c]));
  const out: ApkgCard[] = [];
  let position = 1;
  const sec = Math.floor(now / 1000);
  for (const note of col.notes) {
    const nt = types.get(note.mid);
    if (!nt) continue;
    for (const ord of cardOrds(nt, note.fields)) {
      const known = byKey.get(`${note.id}:${ord}`);
      if (known && scheduling) {
        out.push(known);
        continue;
      }
      out.push({ id: known?.id ?? derivedCardId(note.id, ord), nid: note.id, did: known ? known.odid || known.did : note.did, ord, mod: sec, usn: -1, type: 0, queue: 0, due: position++, ivl: 0, factor: 0, reps: 0, lapses: 0, left: 0, odue: 0, odid: 0, flags: 0, data: '' });
    }
  }
  return out;
}

function stripTags(col: AnkiCollection): AnkiCollection {
  return { ...col, notes: col.notes.map((n) => (n.tags.some((t) => t === 'leech' || t === 'marked') ? { ...n, tags: n.tags.filter((t) => t !== 'leech' && t !== 'marked') } : n)) };
}

/** Ohne Lernfortschritt: alle Karten neu, kein Protokoll, die Tags `leech` und `marked` fallen weg (wie Anki beim Weitergeben eines Stapels). */
export function withoutScheduling(data: ApkgData, now = Date.now()): ApkgData {
  const collection = stripTags(data.collection);
  return { ...data, collection, cards: cardsFor(collection, data.cards, false, now), revlog: [] };
}

const PLACEHOLDER_TEXT = 'Please update to the latest Anki version, then import the .colpkg/.apkg file again.';

/** Baut die Dateien eines Pakets im Format Legacy 2 (Dateiname → Inhalt, noch nicht gepackt). */
export function buildApkg(data: Pick<ApkgData, 'collection'> & Partial<Pick<ApkgData, 'cards' | 'revlog' | 'media' | 'conf' | 'dconf'>>, options: ApkgWriteOptions, deps: ApkgDeps): Record<string, Uint8Array> {
  const now = options.now ?? Date.now();
  const collection = options.scheduling ? data.collection : stripTags(data.collection);
  const cards = cardsFor(collection, data.cards, options.scheduling, now);
  const cardIds = new Set(cards.map((c) => c.id));
  const revlog = options.scheduling ? (data.revlog ?? []).filter((r) => cardIds.has(r.cid)) : [];
  const ensureDefault = collection.decks.some((d) => d.id === 1) ? collection.decks : [{ ...defaultDeck() } as AnkiDeck, ...collection.decks];
  // Wie Anki beim Export eines Stapels: nur die Notiztypen, die die Notizen brauchen.
  const usedTypes = new Set(collection.notes.map((n) => n.mid));
  const col: AnkiCollection = { ...collection, decks: ensureDefault, notetypes: collection.notetypes.filter((nt) => usedTypes.has(nt.id)) };

  const main = deps.open();
  const placeholderDb = deps.open();
  try {
    fillDb(main, { collection: col, cards, revlog, conf: data.conf ?? null, dconf: data.dconf ?? null }, now);
    const basic = emptyCollection().notetypes.find((nt) => nt.id === STOCK_BASIC_ID) as AnkiNotetype;
    const placeholder: AnkiCollection = { ...emptyCollection(), notetypes: [basic], notes: [{ id: now, guid: 'placeholder', mid: STOCK_BASIC_ID, did: 1, mod: Math.floor(now / 1000), tags: [], fields: [PLACEHOLDER_TEXT, ''] }] };
    fillDb(placeholderDb, { collection: placeholder, cards: cardsFor(placeholder, undefined, false, now), revlog: [], conf: null, dconf: null }, now);
    const latest = options.format === 'latest';
    if (latest && !deps.zstd) throw new Error('Für das neue Paketformat fehlt der zstd-Packer.');
    const pack = (bytes: Uint8Array): Uint8Array => (latest ? deps.zstd!(bytes) : bytes);
    const files: Record<string, Uint8Array> = latest
      ? { meta: new Uint8Array([0x08, ...pbVarint(3)]), 'collection.anki21b': pack(main.export()) }
      : { meta: new Uint8Array([0x08, ...pbVarint(2)]), 'collection.anki21': main.export(), 'collection.anki2': placeholderDb.export() };
    const media: Record<string, string> = {};
    const entries: { name: string; size: number; sha1: Uint8Array }[] = [];
    if (options.media && data.media) {
      let index = 0;
      for (const name of [...usedMedia(col)].sort()) {
        const bytes = data.media.get(name);
        if (!bytes) continue;
        files[String(index)] = pack(bytes);
        media[String(index)] = name;
        entries.push({ name, size: bytes.length, sha1: sha1(bytes) });
        index++;
      }
    }
    files.media = latest ? pack(encodeMediaEntries(entries)) : new TextEncoder().encode(JSON.stringify(media));
    return files;
  } finally {
    main.close();
    placeholderDb.close();
  }
}
