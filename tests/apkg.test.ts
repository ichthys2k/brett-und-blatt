import { unzipSync, zipSync } from 'fflate';
import { decompress } from 'fzstd';
import initSqlJs from 'sql.js';
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

let deps: ApkgDeps;
beforeAll(async () => {
  const SQL = await initSqlJs();
  deps = sqlDeps(SQL, decompress);
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
