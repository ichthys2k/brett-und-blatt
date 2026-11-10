import { addDeck } from './collection';
import { newGuid } from './ids';
import { cleanFieldText, stripHtmlKeepMedia } from './text';
import type { AnkiCollection, AnkiDeck, AnkiNote, AnkiNotetype } from './types';
import { STOCK_BASIC_ID } from './stock';

/*
 * Text-Import und -Export im Format von Anki (Vorhaben #101, L2; Handbuch „Text Files“ und „Exporting“, Quellcode
 * `rslib/src/import_export/text/`): reiner UTF-8-Text, Felder getrennt durch Tab, Senkrechtstrich, Semikolon, Doppelpunkt, Komma oder
 * Leerzeichen; Felder in Anführungszeichen dürfen Zeilenumbrüche und das Trennzeichen enthalten; Kopfzeilen `#separator:`, `#html:`,
 * `#tags:`, `#columns:`, `#notetype:`, `#deck:` und `#… column:`; Zeilen mit `#` am Anfang sind Kommentare. Reine Logik ohne Browser.
 */

export type Delimiter = 'tab' | 'pipe' | 'semicolon' | 'colon' | 'comma' | 'space';
/** Die Reihenfolge ist die, in der Anki ein Trennzeichen aus dem Text errät (erstes Zeichen, das vorkommt). */
export const DELIMITERS: readonly Delimiter[] = ['tab', 'pipe', 'semicolon', 'colon', 'comma', 'space'];
export const DELIMITER_CHAR: Readonly<Record<Delimiter, string>> = { tab: '\t', pipe: '|', semicolon: ';', colon: ':', comma: ',', space: ' ' };

export interface TextFileHeaders {
  separator?: Delimiter;
  html?: boolean;
  tags?: string[];
  columns?: string[];
  /** Name oder Kennung des Notiztyps. */
  notetype?: string;
  /** Name oder Kennung des Stapels. */
  deck?: string;
  /** Spaltennummern ab 1. */
  notetypeColumn?: number;
  deckColumn?: number;
  tagsColumn?: number;
  guidColumn?: number;
}

export interface ParsedTextFile {
  headers: TextFileHeaders;
  delimiter: Delimiter;
  /** Steht HTML in den Feldern? Nach `#html:` oder, wenn das fehlt, geraten (irgendein Feld mit einem Tag). */
  isHtml: boolean;
  rows: string[][];
  /** Zahl der Spalten (nach der ersten Datenzeile bzw. `#columns:`). */
  columnCount: number;
}

const HEADER_KEYS = ['separator', 'html', 'tags', 'columns', 'notetype', 'deck', 'notetype column', 'deck column', 'tags column', 'guid column'] as const;
const HTML_TAG = /(<!--.*?-->)|(<style.*?>.*?<\/style>)|(<script.*?>.*?<\/script>)|(<.*?>)/is;
const GUESS_WINDOW = 8 * 1024;

const delimiterFromValue = (value: string): Delimiter | null => {
  const name = value.trim().toLowerCase();
  return DELIMITERS.find((d) => name === d || value === DELIMITER_CHAR[d]) ?? null;
};
const positive = (value: string): number | undefined => {
  const n = Number(value.trim());
  return Number.isInteger(n) && n >= 1 ? n : undefined;
};

/** Liest die Kopfzeilen am Anfang; gibt dazu den Text ab der ersten Datenzeile zurück. */
function splitHeaders(text: string): { raw: Map<string, string>; body: string } {
  const raw = new Map<string, string>();
  let rest = text.replace(/^﻿/, '');
  for (;;) {
    if (!rest.startsWith('#')) break;
    const end = rest.indexOf('\n');
    const line = (end < 0 ? rest : rest.slice(0, end)).replace(/\r$/, '');
    const m = /^#([a-z ]+):(.*)$/is.exec(line);
    if (m) {
      const key = m[1]!.trim().toLowerCase();
      if ((HEADER_KEYS as readonly string[]).includes(key)) raw.set(key, m[2]!);
    }
    rest = end < 0 ? '' : rest.slice(end + 1);
  }
  return { raw, body: rest };
}

/** Zerlegt den Text in Datensätze: Anführungszeichen mit Verdopplung, Zeilenumbrüche in Feldern, `#`-Zeilen sind Kommentare, leere Zeilen entfallen. */
export function splitRecords(text: string, delimiter: string): string[][] {
  const records: string[][] = [];
  const n = text.length;
  let i = 0;
  while (i < n) {
    if (text[i] === '#') {
      while (i < n && text[i] !== '\n') i++;
      i++;
      continue;
    }
    if (text[i] === '\r' || text[i] === '\n') {
      if (text[i] === '\r' && text[i + 1] === '\n') i++;
      i++;
      continue;
    }
    const record: string[] = [];
    for (;;) {
      let field = '';
      if (text[i] === '"') {
        i++;
        while (i < n) {
          if (text[i] === '"') {
            if (text[i + 1] === '"') {
              field += '"';
              i += 2;
              continue;
            }
            i++;
            break;
          }
          field += text[i++];
        }
      }
      while (i < n && text[i] !== delimiter && text[i] !== '\n' && text[i] !== '\r') field += text[i++];
      record.push(field);
      if (i < n && text[i] === delimiter) {
        i++;
        continue;
      }
      if (text[i] === '\r') i++;
      if (text[i] === '\n') i++;
      break;
    }
    records.push(record);
  }
  return records;
}

export function parseTextFile(text: string): ParsedTextFile {
  const { raw, body } = splitHeaders(text);
  const separator = raw.has('separator') ? delimiterFromValue(raw.get('separator')!) : null;
  const delimiter = separator ?? DELIMITERS.find((d) => body.slice(0, GUESS_WINDOW).includes(DELIMITER_CHAR[d])) ?? 'space';
  const ch = DELIMITER_CHAR[delimiter];
  const headers: TextFileHeaders = {};
  if (separator) headers.separator = separator;
  if (raw.has('html')) headers.html = raw.get('html')!.trim().toLowerCase() === 'true';
  if (raw.has('tags')) headers.tags = raw.get('tags')!.split(/\s+/).filter(Boolean);
  if (raw.has('columns')) headers.columns = splitRecords(raw.get('columns')!, ch)[0] ?? [];
  if (raw.has('notetype')) headers.notetype = raw.get('notetype')!.trim();
  if (raw.has('deck')) headers.deck = raw.get('deck')!.trim();
  for (const [key, name] of [['notetype column', 'notetypeColumn'], ['deck column', 'deckColumn'], ['tags column', 'tagsColumn'], ['guid column', 'guidColumn']] as const) {
    const n = raw.has(key) ? positive(raw.get(key)!) : undefined;
    if (n) headers[name] = n;
  }
  const records = splitRecords(body, ch);
  const columnCount = headers.columns?.length || records[0]?.length || 0;
  const rows = records.map((r) => Array.from({ length: columnCount }, (_, i) => r[i] ?? ''));
  const isHtml = headers.html ?? rows.some((r) => r.some((f) => HTML_TAG.test(f)));
  return { headers, delimiter, isHtml, rows, columnCount };
}

// ---------------------------------------------------------------- Import

export type DuplicateMode = 'update' | 'ignore' | 'new';

export interface TextImportOptions {
  /** Notiztyp für alle Zeilen (ohne Notiztyp-Spalte). */
  notetypeId: number;
  /** Stapel für neue Notizen (ohne Stapel-Spalte). */
  deckId: number;
  /** Je Feld des Notiztyps die Spalte (ab 1), 0 = keine. */
  fieldColumns: number[];
  tagsColumn?: number;
  guidColumn?: number;
  deckColumn?: number;
  notetypeColumn?: number;
  /** Tags für jede Notiz. */
  globalTags?: string[];
  duplicates: DuplicateMode;
  /** „Notiztyp“: gleiche erste Felder im selben Notiztyp; „Notiztyp und Stapel“: zusätzlich im selben Stapel. */
  matchScope: 'notetype' | 'notetype+deck';
  /** Steht HTML in den Feldern? Sonst wird Text maskiert und Zeilenumbruch wird `<br>`. */
  isHtml: boolean;
}

export interface TextImportLog {
  new: number;
  updated: number;
  /** Schon vorhanden und unverändert, oder ausgelassen. */
  duplicate: number;
  /** Ohne erstes Feld oder mit unbekanntem Notiztyp. */
  skipped: number;
  /** Neu angelegte Stapel (Name). */
  createdDecks: string[];
  /** Zeilen mit einem Notiztyp, den es nicht gibt. */
  unknownNotetype: number;
}

/** Wie Anki ohne HTML: `htmlescape::encode_minimal` und Zeilenumbruch → `<br>`. */
export const textToHtml = (text: string): string =>
  text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\r?\n/g, '<br>');

const byNameOrId = <T extends { id: number; name: string }>(list: readonly T[], value: string): T | undefined => {
  const v = value.trim();
  if (!v) return undefined;
  return list.find((x) => x.name === v) ?? (/^\d+$/.test(v) ? list.find((x) => x.id === Number(v)) : undefined) ?? list.find((x) => x.name.toLowerCase() === v.toLowerCase());
};

/** Vorschlag für die Zuordnung der Spalten: Kopfzeilen gelten, sonst die ersten Spalten für die Felder, die folgende Spalte für die Tags. */
export function suggestImport(col: AnkiCollection, file: ParsedTextFile): TextImportOptions {
  const h = file.headers;
  const notetype = (h.notetype ? byNameOrId(col.notetypes, h.notetype) : undefined) ?? col.notetypes.find((nt) => nt.id === STOCK_BASIC_ID) ?? col.notetypes[0]!;
  const deck = (h.deck ? byNameOrId(col.decks, h.deck) : undefined) ?? col.decks[0]!;
  const special = new Set([h.guidColumn, h.notetypeColumn, h.deckColumn, h.tagsColumn].filter((n): n is number => !!n));
  const regular: number[] = [];
  for (let c = 1; c <= file.columnCount; c++) if (!special.has(c)) regular.push(c);
  const fieldColumns = notetype.flds.map((_, i) => regular[i] ?? 0);
  const afterFields = regular[notetype.flds.length];
  return {
    notetypeId: notetype.id,
    deckId: deck.id,
    fieldColumns,
    ...(h.tagsColumn ? { tagsColumn: h.tagsColumn } : afterFields ? { tagsColumn: afterFields } : {}),
    ...(h.guidColumn ? { guidColumn: h.guidColumn } : {}),
    ...(h.deckColumn ? { deckColumn: h.deckColumn } : {}),
    ...(h.notetypeColumn ? { notetypeColumn: h.notetypeColumn } : {}),
    ...(h.tags?.length ? { globalTags: h.tags } : {}),
    duplicates: 'update',
    matchScope: 'notetype',
    isHtml: file.isHtml,
  };
}

const tagsOf = (value: string): string[] => value.split(/[\s,]+/).filter(Boolean);
const normalizedFirst = (html: string): string => stripHtmlKeepMedia(html).trim();

/**
 * Übernimmt die Zeilen als Notizen. Duplikate erkennt Anki am ersten Feld (ohne HTML) im selben Notiztyp, oder über die Spalte mit der `guid`.
 * Ohne Stapel-Spalte kommen neue Notizen in den gewählten Stapel; ein Stapel, den es noch nicht gibt, wird angelegt.
 */
export function importTextFile(col: AnkiCollection, file: ParsedTextFile, options: TextImportOptions, now = Date.now()): { col: AnkiCollection; log: TextImportLog } {
  const log: TextImportLog = { new: 0, updated: 0, duplicate: 0, skipped: 0, createdDecks: [], unknownNotetype: 0 };
  const types = new Map(col.notetypes.map((nt) => [nt.id, nt]));
  let decks: AnkiDeck[] = [...col.decks];
  const notes: AnkiNote[] = [...col.notes];
  const byGuid = new Map(notes.map((n, i) => [n.guid, i]));
  const byFirst = new Map<string, number[]>();
  const ids = new Set(notes.map((n) => n.id));
  const index = (i: number) => {
    const note = notes[i]!;
    const key = `${note.mid}\u0000${normalizedFirst(note.fields[0] ?? '')}`;
    byFirst.set(key, [...(byFirst.get(key) ?? []), i]);
  };
  notes.forEach((_, i) => index(i));
  const regularColumns: number[] = [];
  {
    const special = new Set([options.guidColumn, options.notetypeColumn, options.deckColumn, options.tagsColumn].filter((n): n is number => !!n));
    for (let c = 1; c <= file.columnCount; c++) if (!special.has(c)) regularColumns.push(c);
  }
  const text = (value: string) => cleanFieldText(options.isHtml ? value : textToHtml(value));
  let nextId = Math.floor(now);
  const takeId = () => {
    while (ids.has(nextId)) nextId++;
    ids.add(nextId);
    return nextId++;
  };
  const mod = Math.floor(now / 1000);

  const deckFor = (value: string): AnkiDeck => {
    const found = byNameOrId(decks, value);
    if (found) return found;
    const name = value.trim() || (decks.find((d) => d.id === options.deckId)?.name ?? 'Standard');
    const added = addDeck({ ...col, decks }, name, takeId());
    decks = added.col.decks;
    log.createdDecks.push(added.deck.name);
    return added.deck;
  };
  const defaultDeck = decks.find((d) => d.id === options.deckId) ?? decks[0]!;

  for (const row of file.rows) {
    const at = (column: number | undefined): string => (column ? (row[column - 1] ?? '') : '');
    let nt: AnkiNotetype | undefined = types.get(options.notetypeId);
    let columns = options.fieldColumns;
    if (options.notetypeColumn) {
      nt = byNameOrId(col.notetypes, at(options.notetypeColumn));
      if (!nt) {
        log.unknownNotetype++;
        log.skipped++;
        continue;
      }
      // Mit Notiztyp-Spalte gilt die gleiche Reihenfolge für jeden Notiztyp: erste normale Spalte = erstes Feld usw.
      columns = nt.flds.map((_, i) => regularColumns[i] ?? 0);
    }
    if (!nt) {
      log.skipped++;
      continue;
    }
    const fields = nt.flds.map((_, i) => text(at(columns[i])));
    const first = normalizedFirst(fields[0] ?? '');
    if (!first) {
      log.skipped++;
      continue;
    }
    const tags = [...new Set([...tagsOf(at(options.tagsColumn)), ...(options.globalTags ?? [])])];
    const guid = at(options.guidColumn).trim();
    const deck = options.deckColumn ? deckFor(at(options.deckColumn)) : defaultDeck;

    let match = guid ? byGuid.get(guid) : undefined;
    if (match === undefined) {
      const candidates = byFirst.get(`${nt.id}\u0000${first}`) ?? [];
      match = candidates.find((i) => options.matchScope === 'notetype' || notes[i]!.did === deck.id);
    }
    if (match !== undefined && options.duplicates !== 'new') {
      if (options.duplicates === 'ignore') {
        log.duplicate++;
        continue;
      }
      const old = notes[match]!;
      const sameNotetype = old.mid === nt.id;
      const nextFields = sameNotetype ? fields : old.fields;
      const nextTags = [...new Set([...old.tags, ...tags])];
      if (nextFields.every((f, i) => f === old.fields[i]) && nextTags.join(' ') === old.tags.join(' ')) {
        log.duplicate++;
        continue;
      }
      notes[match] = { ...old, fields: nextFields, tags: nextTags, mod };
      log.updated++;
      continue;
    }
    const note: AnkiNote = { id: takeId(), guid: guid && !byGuid.has(guid) ? guid : newGuid(), mid: nt.id, did: deck.id, mod, tags, fields };
    notes.push(note);
    byGuid.set(note.guid, notes.length - 1);
    index(notes.length - 1);
    log.new++;
  }
  return { col: { ...col, decks, notes }, log };
}

// ---------------------------------------------------------------- Export

export interface TextExportOptions {
  /** Nur dieser Stapel samt Unterstapeln; sonst alle. */
  deckId?: number;
  guid: boolean;
  notetype: boolean;
  deck: boolean;
  tags: boolean;
  /** Mit HTML (so gespeichert) oder als reiner Text. */
  html: boolean;
}

/** Text einer Zeile ohne HTML: Zeilenumbrüche und Absätze werden zu Leerzeichen, Dateinamen von Medien bleiben stehen. */
export function htmlToTextLine(html: string): string {
  return stripHtmlKeepMedia(
    html
      .replace(/<\s*br\s*\/?>|<\/?\s*(?:div|p|li|ul|ol|tr|td|th|table|h[1-6])\b[^>]*>/gi, ' ')
      .replace(/\[\[type:[^\]]*\]\]/g, '')
      .replace(/\[sound:([^\]]+)\]/g, '$1'),
  )
    .replace(/\s+/g, ' ')
    .trim();
}

const quoteField = (value: string, delimiter: string, first: boolean): string =>
  value.includes(delimiter) || /["\r\n]/.test(value) || (first && value.startsWith('#')) ? `"${value.replace(/"/g, '""')}"` : value;

/** Die Notizen als Text im Format von Anki (Tab, Kopfzeilen; Spalten: guid, Notiztyp, Stapel, Felder, Tags). */
export function exportTextFile(col: AnkiCollection, options: TextExportOptions): string {
  const deck = options.deckId === undefined ? undefined : col.decks.find((d) => d.id === options.deckId);
  const inScope = (did: number): boolean => {
    if (!deck) return true;
    const d = col.decks.find((x) => x.id === did);
    return !!d && (d.id === deck.id || d.name.startsWith(`${deck.name}::`));
  };
  const types = new Map(col.notetypes.map((nt) => [nt.id, nt]));
  const decks = new Map(col.decks.map((d) => [d.id, d]));
  const notes = col.notes.filter((n) => inScope(n.did) && types.has(n.mid)).sort((a, b) => a.id - b.id);
  const fieldColumns = Math.max(0, ...notes.map((n) => n.fields.length));
  const ch = DELIMITER_CHAR.tab;
  const lines = ['#separator:tab', `#html:${options.html}`];
  let column = 0;
  if (options.guid) lines.push(`#guid column:${++column}`);
  if (options.notetype) lines.push(`#notetype column:${++column}`);
  if (options.deck) lines.push(`#deck column:${++column}`);
  column += fieldColumns;
  if (options.tags) lines.push(`#tags column:${column + 1}`);
  for (const note of notes) {
    const cells: string[] = [];
    if (options.guid) cells.push(note.guid);
    if (options.notetype) cells.push(types.get(note.mid)!.name);
    if (options.deck) cells.push(decks.get(note.did)?.name ?? '');
    for (let i = 0; i < fieldColumns; i++) {
      const f = note.fields[i] ?? '';
      cells.push(options.html ? f : htmlToTextLine(f));
    }
    if (options.tags) cells.push(note.tags.join(' '));
    lines.push(cells.map((c, i) => quoteField(c, ch, i === 0)).join(ch));
  }
  return `${lines.join('\n')}\n`;
}

// ---------------------------------------------------------------- Kleine Hilfen für die Oberfläche

/** Zusammenfassung eines Stapels für Listen. */
export interface DeckSummary {
  id: number;
  name: string;
  notes: number;
}
export const deckSummaries = (col: AnkiCollection): DeckSummary[] => col.decks.map((d) => ({ id: d.id, name: d.name, notes: col.notes.filter((n) => n.did === d.id).length }));
