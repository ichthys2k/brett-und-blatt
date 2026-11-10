import { sanitizeCollection } from '../collection';
import type { AnkiCollection } from '../types';
import { pbBool, pbHas, pbMessages, pbNumber, pbNumbers, pbOther, pbParse, pbString } from './proto';
import { APKG_MAX_BYTES, type ApkgCard, type ApkgData, type ApkgDeps, type ApkgRevlog, type ApkgVersion, type SqlDb } from './types';
import { zstdContentSize } from './zstd';

/*
 * Liest ein Anki-Paket (Vorhaben #101, L3). Verstanden werden alle drei Fassungen (Bericht `anki-recherche.md`, Abschnitt 3.1): Legacy 1
 * (`collection.anki2`), Legacy 2 (`collection.anki21`, meist mit `meta`) und das neue Format (`collection.anki21b`, zstd, Schema 18 mit
 * Protobuf). Alles landet im Modell aus L1: Notiztypen und Stapel als Schema-11-JSON mit allen Schlüsseln, Notizen, dazu Karten mit ihrem
 * Lernstand, das Protokoll und die Medien. Nichts aus dem Paket wird ausgeführt.
 */

export class ApkgError extends Error {
  constructor(
    readonly code: 'missing' | 'tooNew' | 'corrupt' | 'tooBig' | 'schema',
    message: string,
  ) {
    super(message);
  }
}

const COLLECTION_FILE: Record<ApkgVersion, string> = { legacy1: 'collection.anki2', legacy2: 'collection.anki21', latest: 'collection.anki21b' };
const MEDIA_FILE_MAX = 20 * 1024 * 1024;
const DECODER = new TextDecoder();
const num = (value: unknown): number => (typeof value === 'number' && Number.isFinite(value) ? value : Number(value) || 0);
const text = (value: unknown): string => (typeof value === 'string' ? value : value == null ? '' : String(value));

function detectVersion(files: Record<string, Uint8Array>): ApkgVersion {
  const meta = files.meta;
  if (meta) {
    let version = 0;
    try {
      version = pbNumber(pbParse(meta), 1);
    } catch {
      throw new ApkgError('corrupt', 'Die Datei „meta“ im Paket ist beschädigt.');
    }
    if (version === 1) return 'legacy1';
    if (version === 2) return 'legacy2';
    if (version === 3) return 'latest';
    throw new ApkgError('tooNew', 'Dieses Paket stammt aus einer neueren Anki-Version, die hier noch nicht gelesen wird.');
  }
  return files['collection.anki21'] ? 'legacy2' : 'legacy1';
}

/** Ein Dateiname aus einem Paket: nur der Name, ohne Pfad und Steuerzeichen. Sonst `null`. */
export function safeMediaName(name: string): string | null {
  const normalized = name.normalize('NFC');
  if (!normalized || normalized.length > 255 || /[\\/\x00-\x1f]/.test(normalized) || normalized === '.' || normalized === '..' || normalized.startsWith('.')) return null;
  return normalized;
}

function readMedia(files: Record<string, Uint8Array>, version: ApkgVersion, deps: ApkgDeps, warnings: string[]): Map<string, Uint8Array> {
  const out = new Map<string, Uint8Array>();
  const listFile = files.media;
  if (!listFile) return out;
  const entries: { zip: string; name: string }[] = [];
  if (version === 'latest') {
    const list = pbParse(deps.unzstd(listFile));
    pbMessages(list, 1).forEach((entry, index) => {
      const legacy = entry.get(255)?.[0];
      entries.push({ zip: String(typeof legacy === 'number' ? legacy : index), name: pbString(entry, 1) });
    });
  } else {
    let map: unknown;
    try {
      map = JSON.parse(DECODER.decode(listFile));
    } catch {
      throw new ApkgError('corrupt', 'Die Medienliste im Paket ist beschädigt.');
    }
    if (map && typeof map === 'object') for (const [zip, name] of Object.entries(map as Record<string, unknown>)) if (typeof name === 'string') entries.push({ zip, name });
  }
  let skipped = 0;
  for (const { zip, name } of entries) {
    const safe = safeMediaName(name);
    const raw = files[zip];
    if (!safe || !raw) {
      skipped++;
      continue;
    }
    if (version === 'latest') {
      const size = zstdContentSize(raw);
      if (size === null || size > MEDIA_FILE_MAX) {
        skipped++;
        continue;
      }
    } else if (raw.length > MEDIA_FILE_MAX) {
      skipped++;
      continue;
    }
    out.set(safe, version === 'latest' ? deps.unzstd(raw) : raw);
  }
  if (skipped > 0) warnings.push(`${skipped} Mediendatei${skipped === 1 ? '' : 'en'} nicht übernommen (unsicherer Name, zu groß oder fehlend).`);
  return out;
}

function json(value: unknown): Record<string, unknown> {
  try {
    const parsed = JSON.parse(text(value));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

// ---------------------------------------------------------------- Schema 11 (JSON in der Tabelle `col`)

function schema11(db: SqlDb): { notetypes: unknown[]; decks: unknown[]; conf: Record<string, unknown>; dconf: Record<string, unknown> } {
  const col = db.all('SELECT models, decks, dconf, conf FROM col')[0];
  if (!col) throw new ApkgError('corrupt', 'Die Sammlung im Paket ist leer.');
  const models = json(col.models);
  const decks = json(col.decks);
  const fix = (map: Record<string, unknown>) =>
    Object.entries(map).map(([key, value]) => (value && typeof value === 'object' ? { ...(value as object), id: num((value as { id?: unknown }).id ?? key) } : value));
  return { notetypes: fix(models), decks: fix(decks), conf: json(col.conf), dconf: json(col.dconf) };
}

// ---------------------------------------------------------------- Schema 18 (eigene Tabellen mit Protobuf)

function schema18(db: SqlDb): { notetypes: unknown[]; decks: unknown[] } {
  const fieldRows = db.all('SELECT ntid, ord, name, config FROM fields ORDER BY ntid, ord');
  const templateRows = db.all('SELECT ntid, ord, name, config FROM templates ORDER BY ntid, ord');
  const notetypes = db.all('SELECT id, name, mtime_secs, config FROM notetypes').map((row) => {
    const id = num(row.id);
    const config = pbParse(row.config as Uint8Array);
    const other = pbOther(config);
    const reqKinds = ['none', 'any', 'all'] as const;
    return {
      ...other,
      id,
      name: text(row.name),
      type: pbNumber(config, 1) === 1 ? 1 : 0,
      mod: num(row.mtime_secs),
      usn: 0,
      sortf: pbNumber(config, 2),
      did: null,
      css: pbString(config, 3),
      latexPre: pbString(config, 5),
      latexPost: pbString(config, 6),
      latexsvg: pbBool(config, 7),
      req: pbMessages(config, 8).map((r) => [pbNumber(r, 1), reqKinds[pbNumber(r, 2)] ?? 'none', pbNumbers(r, 3)]),
      flds: fieldRows
        .filter((f) => num(f.ntid) === id)
        .map((f) => {
          const c = pbParse(f.config as Uint8Array);
          return {
            ...pbOther(c),
            name: text(f.name),
            ord: num(f.ord),
            sticky: pbBool(c, 1),
            rtl: pbBool(c, 2),
            font: pbString(c, 3, 'Arial'),
            size: pbNumber(c, 4, 20),
            description: pbString(c, 5),
            plainText: pbBool(c, 6),
            collapsed: pbBool(c, 7),
            excludeFromSearch: pbBool(c, 8),
            ...(pbHas(c, 9) ? { id: pbNumber(c, 9) } : {}),
            ...(pbHas(c, 10) ? { tag: pbNumber(c, 10) } : {}),
            preventDeletion: pbBool(c, 11),
          };
        }),
      tmpls: templateRows
        .filter((t) => num(t.ntid) === id)
        .map((t) => {
          const c = pbParse(t.config as Uint8Array);
          const target = pbNumber(c, 5);
          return {
            ...pbOther(c),
            name: text(t.name),
            ord: num(t.ord),
            qfmt: pbString(c, 1),
            afmt: pbString(c, 2),
            bqfmt: pbString(c, 3),
            bafmt: pbString(c, 4),
            did: target || null,
            bfont: pbString(c, 6),
            bsize: pbNumber(c, 7),
            ...(pbHas(c, 8) ? { id: pbNumber(c, 8) } : {}),
          };
        }),
    };
  });
  const decks = db.all('SELECT id, name, mtime_secs, kind FROM decks').map((row) => {
    const kind = pbParse(row.kind instanceof Uint8Array ? row.kind : new Uint8Array());
    const normal = pbMessages(kind, 1)[0];
    return {
      id: num(row.id),
      name: text(row.name).replace(/\x1f/g, '::'),
      mod: num(row.mtime_secs),
      usn: 0,
      desc: normal ? pbString(normal, 4) : '',
      dyn: pbHas(kind, 2) ? 1 : 0,
      conf: normal ? pbNumber(normal, 1, 1) : 1,
      collapsed: false,
    };
  });
  return { notetypes, decks };
}

/** Liest die Dateien eines entpackten Pakets (Dateiname → Inhalt). */
export function readApkg(files: Record<string, Uint8Array>, deps: ApkgDeps): ApkgData {
  const version = detectVersion(files);
  const file = files[COLLECTION_FILE[version]];
  if (!file) throw new ApkgError('missing', `Im Paket fehlt die Sammlung (${COLLECTION_FILE[version]}).`);
  const warnings: string[] = [];
  let bytes = file;
  if (version === 'latest') {
    const size = zstdContentSize(file);
    if (size !== null && size > 5 * APKG_MAX_BYTES) throw new ApkgError('tooBig', 'Die Sammlung im Paket ist zu groß.');
    bytes = deps.unzstd(file);
  }
  const db = deps.open(bytes);
  try {
    const colRow = db.all('SELECT ver, crt FROM col')[0];
    const ver = num(colRow?.ver);
    const crt = num(colRow?.crt);
    let notetypes: unknown[];
    let decks: unknown[];
    let conf: Record<string, unknown> | null = null;
    let dconf: Record<string, unknown> | null = null;
    if (ver >= 14) ({ notetypes, decks } = schema18(db));
    else if (ver >= 1) ({ notetypes, decks, conf, dconf } = schema11(db));
    else throw new ApkgError('schema', 'Das Paket hat ein unbekanntes Format.');

    const cardRows = db.all('SELECT id, nid, did, ord, mod, usn, type, queue, due, ivl, factor, reps, lapses, left, odue, odid, flags, data FROM cards');
    const cards: ApkgCard[] = cardRows.map((c) => ({
      id: num(c.id),
      nid: num(c.nid),
      did: num(c.did),
      ord: num(c.ord),
      mod: num(c.mod),
      usn: num(c.usn),
      type: num(c.type),
      queue: num(c.queue),
      due: num(c.due),
      ivl: num(c.ivl),
      factor: num(c.factor),
      reps: num(c.reps),
      lapses: num(c.lapses),
      left: num(c.left),
      odue: num(c.odue),
      odid: num(c.odid),
      flags: num(c.flags),
      data: text(c.data),
    }));
    // Der Stapel einer Notiz ist der ihrer ersten Karte (bei Karten in gefilterten Stapeln der ursprüngliche).
    const deckOfNote = new Map<number, number>();
    for (const card of [...cards].sort((a, b) => a.ord - b.ord)) if (!deckOfNote.has(card.nid)) deckOfNote.set(card.nid, card.odid || card.did);
    const noteRows = db.all('SELECT id, guid, mid, mod, tags, flds, flags, data FROM notes');
    const notes = noteRows.map((n) => ({
      id: num(n.id),
      guid: text(n.guid),
      mid: num(n.mid),
      did: deckOfNote.get(num(n.id)) ?? 1,
      mod: num(n.mod),
      tags: text(n.tags).split(/\s+/).filter(Boolean),
      fields: text(n.flds).split('\x1f'),
      flags: num(n.flags),
      data: text(n.data),
    }));
    const cleaned = sanitizeCollection({ notetypes, decks, notes, graves: [] });
    // `sanitizeCollection` setzt die eingebauten Notiztypen und den Standardstapel ein; ein Paket bringt nur mit, was es selbst enthält.
    const idOf = (item: unknown): number => num((item as { id?: unknown } | null)?.id);
    const typeIds = new Set(notetypes.map(idOf));
    const deckIds = new Set(decks.map(idOf));
    const collection: AnkiCollection = {
      ...cleaned,
      notetypes: cleaned.notetypes.filter((nt) => typeIds.has(nt.id)),
      decks: cleaned.decks.filter((d) => deckIds.has(d.id) || cleaned.notes.some((n) => n.did === d.id)),
    };
    if (collection.notes.length < notes.length) warnings.push(`${notes.length - collection.notes.length} Notiz${notes.length - collection.notes.length === 1 ? '' : 'en'} nicht übernommen (unbekannter Notiztyp oder falsche Feldzahl).`);
    const ids = new Set(collection.notes.map((n) => n.id));
    const revlog: ApkgRevlog[] = db.all('SELECT id, cid, usn, ease, ivl, lastIvl, factor, time, type FROM revlog').map((r) => ({
      id: num(r.id),
      cid: num(r.cid),
      usn: num(r.usn),
      ease: num(r.ease),
      ivl: num(r.ivl),
      lastIvl: num(r.lastIvl),
      factor: num(r.factor),
      time: num(r.time),
      type: num(r.type),
    }));
    const keptCards = cards.filter((c) => ids.has(c.nid));
    const cardIds = new Set(keptCards.map((c) => c.id));
    if (collection.notetypes.some((nt) => nt.tmpls.some((t) => /<script\b/i.test(t.qfmt) || /<script\b/i.test(t.afmt)))) warnings.push('Vorlagen enthalten Skripte. Sie werden hier nicht ausgeführt, bleiben aber im Paket erhalten.');
    if (collection.notetypes.some((nt) => /@import|url\(\s*["']?https?:/i.test(nt.css))) warnings.push('Das Aussehen (CSS) verweist auf Adressen im Netz. Das wird hier nicht geladen.');
    return { version, collection, cards: keptCards, revlog: revlog.filter((r) => cardIds.has(r.cid)), media: readMedia(files, version, deps, warnings), ...(crt > 0 ? { crt } : {}), conf, dconf, warnings };
  } finally {
    db.close();
  }
}
