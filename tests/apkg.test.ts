import { unzipSync, zipSync } from 'fflate';
import { decompress } from 'fzstd';
import initSqlJs from 'sql.js';
import { init as initZstd, compress as zstdCompress } from '@bokuweb/zstd-wasm';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  ApkgError,
  DEFAULT_DECK_ID,
  STOCK_BASIC_ID,
  STOCK_CLOZE_ID,
  addDeck,
  addNote,
  buildApkg,
  cardsOf,
  emptyCollection,
  readApkg,
  safeMediaName,
  subsetCollection,
  usedMedia,
  zstdContentSize,
  type ApkgDeps,
} from '../packages/engine/src';
import { sqlDeps } from '../apps/web/src/lib/ankiSql';
import { encodeMediaEntries, pbEncodeBytes, pbEncodeString, pbEncodeVarint } from '../packages/engine/src/anki/apkg/proto';

let deps: ApkgDeps;
beforeAll(async () => {
  const SQL = await initSqlJs();
  await initZstd();
  // Packen mit zstd-wasm, Entpacken mit fzstd: so zeigt der Test auch, dass beide dasselbe Format meinen.
  deps = sqlDeps(SQL, decompress, (bytes) => zstdCompress(bytes, 6));
});
const T0 = 1_700_000_000_000;

function sample() {
  let col = emptyCollection();
  const deck = addDeck(col, 'Latein::Nomen', T0);
  col = deck.col;
  col = addNote(col, { notetypeId: STOCK_BASIC_ID, deckId: deck.deck.id, fields: ['puer <img src="knabe.jpg">', 'Knabe [sound:puer.mp3]'], tags: ['nomen', 'leech'], guid: 'g1' }, T0).col;
  col = addNote(col, { notetypeId: STOCK_CLOZE_ID, deckId: deck.deck.id, fields: ['{{c1::Roma}} ist die Hauptstadt', 'Italien'], guid: 'g2' }, T0 + 1).col;
  const media = new Map([['knabe.jpg', new Uint8Array([1, 2, 3])], ['puer.mp3', new Uint8Array([4, 5])], ['unbenutzt.png', new Uint8Array([9])]]);
  return { col, media, deckId: deck.deck.id };
}
const pack = (files: Record<string, Uint8Array>) => unzipSync(zipSync(files));

describe('Anki-Pakete: Schreiben (Legacy 2) und Lesen', () => {
  it('schreibt meta, Sammlung, Platzhalter und Medien; nur benutzte Medien kommen mit', () => {
    const { col, media } = sample();
    const files = buildApkg({ collection: col, media }, { scheduling: true, media: true, now: T0 }, deps);
    expect(Object.keys(files).sort()).toEqual(['0', '1', 'collection.anki2', 'collection.anki21', 'media', 'meta']);
    expect([...files.meta!]).toEqual([0x08, 0x02]);
    const list = JSON.parse(new TextDecoder().decode(files.media!)) as Record<string, string>;
    expect(Object.values(list).sort()).toEqual(['knabe.jpg', 'puer.mp3']);
    expect([...usedMedia(col)].sort()).toEqual(['knabe.jpg', 'puer.mp3']);
    const placeholder = readApkg({ ...files, 'collection.anki21': files['collection.anki2']! }, deps);
    expect(placeholder.collection.notes[0]!.fields[0]).toContain('update to the latest Anki');
  });
  it('Rundlauf: schreiben und wieder lesen ergibt dieselben Notizen, Notiztypen, Stapel und Medien', () => {
    const { col, media } = sample();
    const files = pack(buildApkg({ collection: col, media }, { scheduling: true, media: true, now: T0 }, deps));
    const back = readApkg(files, deps);
    expect(back.version).toBe('legacy2');
    expect(back.warnings).toEqual([]);
    expect(back.collection.notes.map((n) => [n.guid, n.fields, n.tags, n.mid]).sort()).toEqual(col.notes.map((n) => [n.guid, n.fields, n.tags, n.mid]).sort());
    expect(back.collection.decks.map((d) => d.name).sort()).toEqual(['Default', 'Latein::Nomen']);
    expect(back.collection.notetypes.map((nt) => nt.name).sort()).toEqual(['Einfach', 'Lückentext']);
    expect(back.cards.map((c) => [c.nid, c.ord]).sort()).toEqual(cardsOf(col).map((c) => [c.nid, c.ord]).sort());
    expect([...back.media.keys()].sort()).toEqual(['knabe.jpg', 'puer.mp3']);
    expect([...back.media.get('knabe.jpg')!]).toEqual([1, 2, 3]);
  });
  it('Lernfortschritt: mit scheduling bleibt er, ohne wird alles neu und leech und marked fallen weg', () => {
    const { col, media } = sample();
    const first = readApkg(pack(buildApkg({ collection: col, media }, { scheduling: true, media: false, now: T0 }, deps)), deps);
    const learned = first.cards.map((c) => ({ ...c, type: 2, queue: 2, due: 40, ivl: 12, factor: 2500, reps: 5, lapses: 1, data: '{"s":12.5,"d":5.1}' }));
    const revlog = [{ id: T0 + 5, cid: learned[0]!.id, usn: -1, ease: 3, ivl: 12, lastIvl: 6, factor: 2500, time: 4000, type: 1 }];
    const kept = readApkg(pack(buildApkg({ collection: first.collection, cards: learned, revlog, media: new Map() }, { scheduling: true, media: false, now: T0 }, deps)), deps);
    expect(kept.cards.every((c) => c.ivl === 12 && c.type === 2 && c.data === '{"s":12.5,"d":5.1}')).toBe(true);
    expect(kept.revlog).toEqual(revlog);
    const clean = readApkg(pack(buildApkg({ collection: first.collection, cards: learned, revlog, media: new Map() }, { scheduling: false, media: false, now: T0 }, deps)), deps);
    expect(clean.cards.every((c) => c.type === 0 && c.ivl === 0 && c.reps === 0 && c.data === '')).toBe(true);
    expect(clean.revlog).toEqual([]);
    expect(clean.collection.notes.find((n) => n.guid === 'g1')!.tags).toEqual(['nomen']);
    expect(kept.collection.notes.find((n) => n.guid === 'g1')!.tags).toEqual(['nomen', 'leech']);
  });
  it('neue Notizen bekommen beim Schreiben neue Karten; unbekannte Schlüssel in Notiztypen bleiben', () => {
    const { col } = sample();
    const custom = { ...col.notetypes.find((nt) => nt.id === STOCK_BASIC_ID)!, zukunft: { x: 1 }, css: '.card{color:red}' };
    const files = pack(buildApkg({ collection: { ...col, notetypes: col.notetypes.map((nt) => (nt.id === STOCK_BASIC_ID ? custom : nt)) } }, { scheduling: true, media: false, now: T0 }, deps));
    const back = readApkg(files, deps);
    expect(back.collection.notetypes.find((nt) => nt.id === STOCK_BASIC_ID)).toMatchObject({ zukunft: { x: 1 }, css: '.card{color:red}' });
    expect(back.cards).toHaveLength(2);
  });
  it('ein Stapel samt Unterstapeln: nur dessen Notizen und Notiztypen', () => {
    const { col, deckId } = sample();
    const other = addDeck(col, 'Anderes', T0 + 9);
    const withOther = addNote(other.col, { notetypeId: STOCK_BASIC_ID, deckId: other.deck.id, fields: ['x', 'y'], guid: 'g9' }, T0 + 9).col;
    const subset = subsetCollection(withOther, deckId);
    expect(subset.notes.map((n) => n.guid).sort()).toEqual(['g1', 'g2']);
    expect(subset.decks.map((d) => d.name).sort()).toEqual(['Latein::Nomen', 'Standard']);
    const added = addDeck(withOther, 'Latein', T0 + 20);
    expect(subsetCollection(added.col, added.deck.id).notes.map((n) => n.guid).sort()).toEqual(['g1', 'g2']);
  });
});

describe('Anki-Pakete: Schutz', () => {
  it('lehnt fehlende Sammlung und zu neue Versionen ab', () => {
    expect(() => readApkg({}, deps)).toThrow(ApkgError);
    expect(() => readApkg({ meta: new Uint8Array([0x08, 0x09]) }, deps)).toThrow(/neueren Anki/);
  });
  it('Mediennamen: kein Pfad, keine Steuerzeichen, kein versteckter Name', () => {
    expect(safeMediaName('bild.jpg')).toBe('bild.jpg');
    for (const bad of ['../x.png', 'a/b.png', 'a\\b.png', '', '.versteckt', '..', 'a\u0000b']) expect(safeMediaName(bad)).toBeNull();
  });
  it('unsichere Mediennamen im Paket werden übersprungen und gemeldet', () => {
    const { col } = sample();
    const files = buildApkg({ collection: col, media: new Map([['knabe.jpg', new Uint8Array([1])], ['puer.mp3', new Uint8Array([2])]]) }, { scheduling: true, media: true, now: T0 }, deps);
    files.media = new TextEncoder().encode(JSON.stringify({ '0': '../draussen.jpg', '1': 'puer.mp3' }));
    const back = readApkg(files, deps);
    expect([...back.media.keys()]).toEqual(['puer.mp3']);
    expect(back.warnings.join(' ')).toMatch(/nicht übernommen/);
  });
  it('warnt vor Skripten in Vorlagen, behält sie aber', () => {
    const { col } = sample();
    const nt = col.notetypes.find((n) => n.id === STOCK_BASIC_ID)!;
    const scripted = { ...col, notetypes: col.notetypes.map((n) => (n === nt ? { ...n, tmpls: [{ ...n.tmpls[0]!, qfmt: '{{Vorderseite}}<script>alert(1)</script>' }] } : n)) };
    const back = readApkg(pack(buildApkg({ collection: scripted }, { scheduling: true, media: false, now: T0 }, deps)), deps);
    expect(back.warnings.join(' ')).toMatch(/Skripte/);
    expect(back.collection.notetypes.find((n) => n.id === STOCK_BASIC_ID)!.tmpls[0]!.qfmt).toContain('<script>');
  });
  it('liest die Größe aus dem Kopf eines zstd-Rahmens', () => {
    // Rahmen mit Single_Segment und Frame_Content_Size von 1 Byte: 5 Byte Kopf, Größe 200
    expect(zstdContentSize(new Uint8Array([0x28, 0xb5, 0x2f, 0xfd, 0x20, 200, 0, 0]))).toBe(200);
    expect(zstdContentSize(new Uint8Array([1, 2, 3, 4, 5, 6]))).toBeNull();
  });
  it('der Standardstapel bleibt auch in einem Paket mit nur einem Unterstapel', () => {
    const { col, deckId } = sample();
    const back = readApkg(pack(buildApkg({ collection: subsetCollection(col, deckId) }, { scheduling: true, media: false, now: T0 }, deps)), deps);
    expect(back.collection.decks.some((d) => d.id === DEFAULT_DECK_ID)).toBe(true);
  });
});


describe('Anki-Pakete: neues Format (zstd)', () => {
  it('schreibt meta Version 3, zstd-gepackte Sammlung und Medien mit Protobuf-Liste; Lesen ergibt dasselbe', () => {
    const { col, media } = sample();
    const files = buildApkg({ collection: col, media }, { scheduling: true, media: true, format: 'latest', now: T0 }, deps);
    expect(Object.keys(files).sort()).toEqual(['0', '1', 'collection.anki21b', 'media', 'meta']);
    expect([...files.meta!]).toEqual([0x08, 0x03]);
    expect(zstdContentSize(files['collection.anki21b']!)).toBeGreaterThan(1000);
    const back = readApkg(pack(files), deps);
    expect(back.version).toBe('latest');
    expect(back.collection.notes.map((n) => [n.guid, n.fields]).sort()).toEqual(col.notes.map((n) => [n.guid, n.fields]).sort());
    expect([...back.media.keys()].sort()).toEqual(['knabe.jpg', 'puer.mp3']);
    expect([...back.media.get('puer.mp3')!]).toEqual([4, 5]);
  });
  it('ohne zstd-Packer kein neues Format', () => {
    const { col } = sample();
    expect(() => buildApkg({ collection: col }, { scheduling: true, media: false, format: 'latest' }, { open: deps.open, unzstd: deps.unzstd })).toThrow(/zstd/);
  });
  it('die Medienliste enthält Namen, Größe und SHA-1 in der Reihenfolge der Dateien', () => {
    const bytes = encodeMediaEntries([{ name: 'a.png', size: 3, sha1: new Uint8Array(20).fill(7) }]);
    expect(bytes[0]).toBe(0x0a);
    expect([...bytes].slice(-22)).toEqual([0x1a, 20, ...new Array(20).fill(7)]);
  });
  it('liest Schema 18: Notiztypen, Felder, Vorlagen und Stapel aus eigenen Tabellen mit Protobuf', () => {
    const db = deps.open();
    for (const sql of [
      'CREATE TABLE col (id integer PRIMARY KEY, crt integer, mod integer, scm integer, ver integer, dty integer, usn integer, ls integer, conf text, models text, decks text, dconf text, tags text)',
      'CREATE TABLE notetypes (id integer NOT NULL PRIMARY KEY, name text NOT NULL, mtime_secs integer NOT NULL, usn integer NOT NULL, config blob NOT NULL)',
      'CREATE TABLE fields (ntid integer NOT NULL, ord integer NOT NULL, name text NOT NULL, config blob NOT NULL, PRIMARY KEY (ntid, ord))',
      'CREATE TABLE templates (ntid integer NOT NULL, ord integer NOT NULL, name text NOT NULL, mtime_secs integer NOT NULL, usn integer NOT NULL, config blob NOT NULL, PRIMARY KEY (ntid, ord))',
      'CREATE TABLE decks (id integer PRIMARY KEY NOT NULL, name text NOT NULL, mtime_secs integer NOT NULL, usn integer NOT NULL, common blob NOT NULL, kind blob NOT NULL)',
      'CREATE TABLE notes (id integer PRIMARY KEY, guid text, mid integer, mod integer, usn integer, tags text, flds text, sfld integer, csum integer, flags integer, data text)',
      'CREATE TABLE cards (id integer PRIMARY KEY, nid integer, did integer, ord integer, mod integer, usn integer, type integer, queue integer, due integer, ivl integer, factor integer, reps integer, lapses integer, left integer, odue integer, odid integer, flags integer, data text)',
      'CREATE TABLE revlog (id integer PRIMARY KEY, cid integer, usn integer, ease integer, ivl integer, lastIvl integer, factor integer, time integer, type integer)',
    ]) db.run(sql);
    const cat = (...parts: Uint8Array[]) => Uint8Array.from(parts.flatMap((p) => [...p]));
    db.run("INSERT INTO col VALUES (1, 0, 0, 0, 18, 0, 0, 0, '', '', '', '', '')");
    const ntConfig = cat(pbEncodeString(3, '.card{color:red}'), pbEncodeString(5, 'pre'), pbEncodeBytes(8, cat(pbEncodeVarint(2, 1), pbEncodeBytes(3, new Uint8Array([0])))), pbEncodeBytes(255, new TextEncoder().encode('{"zukunft":1}')));
    db.run('INSERT INTO notetypes VALUES (?, ?, ?, ?, ?)', [77, 'Mein Typ', 1000, 0, ntConfig]);
    db.run('INSERT INTO fields VALUES (77, 0, ?, ?)', ['Vorn', cat(pbEncodeString(3, 'Arial'), pbEncodeVarint(4, 22), pbEncodeVarint(9, 555))]);
    db.run('INSERT INTO fields VALUES (77, 1, ?, ?)', ['Hinten', cat(pbEncodeVarint(1, 1))]);
    db.run('INSERT INTO templates VALUES (77, 0, ?, 1000, 0, ?)', ['Karte 1', cat(pbEncodeString(1, '{{Vorn}}'), pbEncodeString(2, '{{FrontSide}}<hr>{{Hinten}}'), pbEncodeVarint(8, 99))]);
    db.run('INSERT INTO decks VALUES (?, ?, 1000, 0, ?, ?)', [1, 'Default', new Uint8Array(), pbEncodeBytes(1, pbEncodeVarint(1, 1))]);
    db.run('INSERT INTO decks VALUES (?, ?, 1000, 0, ?, ?)', [5, 'Latein\x1fNomen', new Uint8Array(), pbEncodeBytes(1, cat(pbEncodeVarint(1, 1), pbEncodeString(4, 'Beschreibung')))]);
    db.run("INSERT INTO notes VALUES (10, 'gx', 77, 1000, 0, ' a b ', ?, 'x', 1, 0, '')", ['eins\x1fzwei']);
    db.run('INSERT INTO cards VALUES (20, 10, 5, 0, 1000, 0, 2, 2, 5, 9, 2500, 3, 0, 0, 0, 0, 0, ?)', ['{"s":3.2}']);
    const raw = db.export();
    db.close();
    const files = { meta: new Uint8Array([0x08, 0x03]), 'collection.anki21b': zstdCompress(raw, 3), media: zstdCompress(new Uint8Array(0), 3) };
    const back = readApkg(files, deps);
    expect(back.version).toBe('latest');
    expect(back.collection.notetypes).toHaveLength(1);
    expect(back.collection.notetypes[0]).toMatchObject({ id: 77, name: 'Mein Typ', type: 0, css: '.card{color:red}', latexPre: 'pre', req: [[0, 'any', [0]]], zukunft: 1 });
    expect(back.collection.notetypes[0]!.flds).toMatchObject([{ name: 'Vorn', ord: 0, font: 'Arial', size: 22, id: 555 }, { name: 'Hinten', ord: 1, sticky: true }]);
    expect(back.collection.notetypes[0]!.tmpls[0]).toMatchObject({ name: 'Karte 1', qfmt: '{{Vorn}}', afmt: '{{FrontSide}}<hr>{{Hinten}}', id: 99 });
    expect(back.collection.decks.map((d) => d.name).sort()).toEqual(['Default', 'Latein::Nomen']);
    expect(back.collection.decks.find((d) => d.id === 5)).toMatchObject({ desc: 'Beschreibung', dyn: 0 });
    expect(back.collection.notes[0]).toMatchObject({ guid: 'gx', did: 5, fields: ['eins', 'zwei'], tags: ['a', 'b'] });
    expect(back.cards[0]).toMatchObject({ id: 20, ivl: 9, data: '{"s":3.2}' });
    // und wieder zurück ins ältere Format
    const again = readApkg(pack(buildApkg(back, { scheduling: true, media: false, now: T0 }, deps)), deps);
    expect(again.collection.notetypes[0]).toMatchObject({ name: 'Mein Typ', zukunft: 1 });
    expect(again.cards[0]).toMatchObject({ ivl: 9 });
  });
});

// Mit einem echten Anki-Paket (nicht im Repository, Lizenz unklar): ANKI_TESTPAKET=/Pfad/zur/Datei.apkg
const proc = (globalThis as unknown as { process: { env: Record<string, string | undefined>; getBuiltinModule(name: 'node:fs'): { existsSync(path: string): boolean; readFileSync(path: string): Uint8Array } } }).process;
const real = proc.env.ANKI_TESTPAKET;
const fs = proc.getBuiltinModule('node:fs');
describe.skipIf(!real || !fs.existsSync(real))('Anki-Pakete: echtes Paket aus Anki', () => {
  it('liest es und schreibt es zurück', () => {
    const data = readApkg(unzipSync(new Uint8Array(fs.readFileSync(real!))), deps);
    expect(data.collection.notes.length).toBeGreaterThan(0);
    const again = readApkg(pack(buildApkg(data, { scheduling: true, media: true }, deps)), deps);
    expect(again.collection.notes.length).toBe(data.collection.notes.length);
    expect(again.cards.length).toBe(data.cards.length);
    expect(again.revlog.length).toBe(data.revlog.length);
  });
});
