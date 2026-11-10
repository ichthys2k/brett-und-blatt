import { describe, expect, it } from 'vitest';
import {
  DEFAULT_DECK_ID,
  STOCK_BASIC_ID,
  STOCK_CLOZE_ID,
  addDeck,
  addNote,
  emptyCollection,
  exportTextFile,
  htmlToTextLine,
  importTextFile,
  parseTextFile,
  splitRecords,
  suggestImport,
  textToHtml,
  type AnkiCollection,
} from '../src';

const T0 = 1_700_000_000_000;
const run = (col: AnkiCollection, text: string, over: Partial<ReturnType<typeof suggestImport>> = {}) => {
  const file = parseTextFile(text);
  return importTextFile(col, file, { ...suggestImport(col, file), ...over }, T0);
};

describe('Anki-Text: Einlesen', () => {
  it('rät das Trennzeichen in Ankis Reihenfolge: Tab vor Senkrechtstrich vor Semikolon vor Doppelpunkt vor Komma', () => {
    expect(parseTextFile('a\tb').delimiter).toBe('tab');
    expect(parseTextFile('a|b;c').delimiter).toBe('pipe');
    expect(parseTextFile('a;b,c').delimiter).toBe('semicolon');
    expect(parseTextFile('a:b,c').delimiter).toBe('colon');
    expect(parseTextFile('a,b').delimiter).toBe('comma');
    expect(parseTextFile('ab').delimiter).toBe('space');
  });
  it('liest Anführungszeichen, Verdopplung, Zeilenumbrüche und Trennzeichen in Feldern', () => {
    expect(splitRecords('hello;"this is\na two line answer"\ntwo;this is a one line field\n"this includes a ; (semicolon)";another field\nx;"field ""quoted"" inside"\n', ';')).toEqual([
      ['hello', 'this is\na two line answer'],
      ['two', 'this is a one line field'],
      ['this includes a ; (semicolon)', 'another field'],
      ['x', 'field "quoted" inside'],
    ]);
  });
  it('überspringt Kommentare und leere Zeilen, versteht CRLF und BOM', () => {
    const file = parseTextFile('﻿# Kommentar\r\napple;banana;grape\r\n\r\nfirst;second;third\r\n');
    expect(file.rows).toEqual([['apple', 'banana', 'grape'], ['first', 'second', 'third']]);
    expect(file.columnCount).toBe(3);
  });
  it('füllt zu kurze Zeilen auf und schneidet zu lange ab (nach der ersten Zeile)', () => {
    const file = parseTextFile('a;b\nc\nd;e;f\n');
    expect(file.rows).toEqual([['a', 'b'], ['c', ''], ['d', 'e']]);
  });
  it('liest alle Kopfzeilen', () => {
    const file = parseTextFile('#separator:Semicolon\n#html:true\n#tags:eins zwei\n#columns:Front;Back;Extra\n#notetype:Einfach\n#deck:Latein\n#notetype column:4\n#deck column:5\n#tags column:3\n#guid column:6\nx;y;t;Einfach;Latein;g1\n');
    expect(file.headers).toEqual({ separator: 'semicolon', html: true, tags: ['eins', 'zwei'], columns: ['Front', 'Back', 'Extra'], notetype: 'Einfach', deck: 'Latein', notetypeColumn: 4, deckColumn: 5, tagsColumn: 3, guidColumn: 6 });
    expect(file.delimiter).toBe('semicolon');
    expect(file.columnCount).toBe(3);
  });
  it('Trennzeichen als Zeichen oder Name', () => {
    expect(parseTextFile('#separator:|\na|b\n').delimiter).toBe('pipe');
    expect(parseTextFile('#separator:\t\na\tb\n').delimiter).toBe('tab');
    expect(parseTextFile('#separator:comma\na;b,c\n').delimiter).toBe('comma');
  });
  it('rät HTML, wenn die Kopfzeile fehlt', () => {
    expect(parseTextFile('a;<b>b</b>\n').isHtml).toBe(true);
    expect(parseTextFile('a;b\n').isHtml).toBe(false);
    expect(parseTextFile('#html:false\na;<b>\n').isHtml).toBe(false);
  });
});

describe('Anki-Text: Import', () => {
  const basic = emptyCollection();
  it('ohne HTML: Text wird maskiert, Zeilenumbruch wird <br>', () => {
    expect(textToHtml('a < b & "c"\nneu')).toBe('a &lt; b &amp; &quot;c&quot;<br>neu');
    const { col } = run(basic, '#html:false\nHaus;"Zeile 1\nZeile 2 <b>"\n');
    expect(col.notes[0]!.fields).toEqual(['Haus', 'Zeile 1<br>Zeile 2 &lt;b&gt;']);
  });
  it('mit HTML bleibt das HTML, Tags kommen aus der dritten Spalte', () => {
    const { col, log } = run(basic, '#html:true\n<b>Haus</b>;house;Vokabeln Klasse5\n');
    expect(log.new).toBe(1);
    expect(col.notes[0]).toMatchObject({ fields: ['<b>Haus</b>', 'house'], tags: ['Vokabeln', 'Klasse5'], mid: STOCK_BASIC_ID, did: DEFAULT_DECK_ID });
  });
  it('ordnet Notiztyp, Stapel und Tags aus Spalten zu; fehlende Stapel werden angelegt', () => {
    const text = '#separator:tab\n#notetype column:1\n#deck column:2\n#tags column:5\nEinfach\tLatein\tpuer\tKnabe\tnomen\nUnbekannt\tLatein\tx\ty\t\n';
    const { col, log } = run(basic, text);
    expect(log.new).toBe(1);
    expect(log.unknownNotetype).toBe(1);
    expect(log.createdDecks).toEqual(['Latein']);
    const note = col.notes[0]!;
    expect(note.fields).toEqual(['puer', 'Knabe']);
    expect(note.tags).toEqual(['nomen']);
    expect(col.decks.find((d) => d.id === note.did)!.name).toBe('Latein');
  });
  it('Lückentext-Notiztyp: erste Spalten werden die Felder', () => {
    const { col } = run(basic, '#html:true\n#notetype:Lückentext\n{{c1::Paris}} ist die Hauptstadt;Frankreich\n');
    expect(col.notes[0]).toMatchObject({ mid: STOCK_CLOZE_ID, fields: ['{{c1::Paris}} ist die Hauptstadt', 'Frankreich'] });
  });
  it('überspringt Zeilen mit leerem ersten Feld', () => {
    const { log } = run(basic, ';b\n<br>;c\nok;d\n');
    expect(log.skipped).toBe(2);
    expect(log.new).toBe(1);
  });

  it('Duplikate: aktualisieren, ignorieren oder als neu', () => {
    const first = run(basic, 'house;Haus\ndog;Hund\n').col;
    const update = run(first, 'house;Heim\ndog;Hund\ncat;Katze\n');
    expect(update.log).toMatchObject({ new: 1, updated: 1, duplicate: 1 });
    expect(update.col.notes.find((n) => n.fields[0] === 'house')!.fields[1]).toBe('Heim');
    expect(update.col.notes).toHaveLength(3);
    const ignore = run(first, 'house;Heim\n', { duplicates: 'ignore' });
    expect(ignore.log.duplicate).toBe(1);
    expect(ignore.col.notes.find((n) => n.fields[0] === 'house')!.fields[1]).toBe('Haus');
    const again = run(first, 'house;Heim\n', { duplicates: 'new' });
    expect(again.col.notes).toHaveLength(3);
    expect(new Set(again.col.notes.map((n) => n.guid)).size).toBe(3);
  });
  it('Duplikate erkennt man am ersten Feld ohne HTML; Bereich Notiztyp und Stapel', () => {
    const base = run(basic, '#html:true\n<b>house</b>;Haus\n').col;
    expect(run(base, 'house;Heim\n').log.updated).toBe(1);
    const other = addDeck(base, 'Anderer', T0);
    const inOther = run(other.col, 'house;Heim\n', { deckId: other.deck.id, matchScope: 'notetype+deck' });
    expect(inOther.log.new).toBe(1);
  });
  it('die guid-Spalte aktualisiert dieselbe Notiz, auch wenn sich das erste Feld ändert', () => {
    const base = run(basic, '#guid column:3\nhouse;Haus;g-1\n').col;
    expect(base.notes[0]!.guid).toBe('g-1');
    const next = run(base, '#guid column:3\nHaus am See;Haus;g-1\n');
    expect(next.log.updated).toBe(1);
    expect(next.col.notes).toHaveLength(1);
    expect(next.col.notes[0]!.fields[0]).toBe('Haus am See');
  });
  it('Zeilen derselben Datei, die sich wiederholen, zählen als Duplikat', () => {
    const { log, col } = run(basic, 'a;1\na;1\na;2\n');
    expect(log.new).toBe(1);
    expect(log.updated).toBe(1);
    expect(col.notes[0]!.fields[1]).toBe('2');
  });
});

describe('Anki-Text: Export', () => {
  const build = () => {
    let col = emptyCollection();
    const latein = addDeck(col, 'Latein', T0);
    col = latein.col;
    col = addNote(col, { notetypeId: STOCK_BASIC_ID, deckId: latein.deck.id, fields: ['puer', 'Knabe'], tags: ['nomen'], guid: 'g1' }, T0).col;
    col = addNote(col, { notetypeId: STOCK_BASIC_ID, deckId: latein.deck.id, fields: ['<b>a</b>;b', 'Zeile 1<br>Zeile 2 "x"'], guid: 'g2' }, T0 + 1).col;
    col = addNote(col, { notetypeId: STOCK_BASIC_ID, deckId: DEFAULT_DECK_ID, fields: ['#kein Kommentar', 'x'], guid: 'g3' }, T0 + 2).col;
    return { col, deckId: latein.deck.id };
  };
  it('schreibt Kopfzeilen und Spalten in Ankis Reihenfolge: guid, Notiztyp, Stapel, Felder, Tags', () => {
    const { col, deckId } = build();
    const text = exportTextFile(col, { deckId, guid: true, notetype: true, deck: true, tags: true, html: true });
    const lines = text.split('\n');
    expect(lines.slice(0, 6)).toEqual(['#separator:tab', '#html:true', '#guid column:1', '#notetype column:2', '#deck column:3', '#tags column:6']);
    expect(lines[6]).toBe('g1\tEinfach\tLatein\tpuer\tKnabe\tnomen');
    expect(text).toContain('"Zeile 1<br>Zeile 2 ""x"""');
    expect(text.endsWith('\n')).toBe(true);
  });
  it('nur der gewählte Stapel; ohne Zusatzspalten keine Spaltenkopfzeilen', () => {
    const { col, deckId } = build();
    const text = exportTextFile(col, { deckId, guid: false, notetype: false, deck: false, tags: false, html: true });
    expect(text).not.toContain('column:');
    expect(text.split('\n').filter((l) => !l.startsWith('#') && l)).toHaveLength(2);
    expect(exportTextFile(col, { guid: false, notetype: false, deck: false, tags: false, html: true }).split('\n').filter((l) => !l.startsWith('#') && l)).toHaveLength(3);
  });
  it('quotiert ein erstes Feld, das mit # beginnt, damit es kein Kommentar wird', () => {
    const { col } = build();
    const text = exportTextFile(col, { guid: false, notetype: false, deck: false, tags: false, html: true });
    expect(text).toContain('"#kein Kommentar"\tx');
    const back = run(emptyCollection(), text);
    expect(back.col.notes.some((n) => n.fields[0] === '#kein Kommentar')).toBe(true);
  });
  it('ohne HTML: Text mit Leerzeichen statt Absätzen', () => {
    expect(htmlToTextLine('<div>Eins</div><div>Zwei&nbsp;drei</div> a<br>b [sound:x.mp3] <img src="y.png">')).toBe('Eins Zwei drei a b x.mp3 y.png');
  });
  it('Rundlauf: Export mit allen Spalten und Import in eine leere Sammlung ergibt dieselben Notizen', () => {
    const { col } = build();
    const text = exportTextFile(col, { guid: true, notetype: true, deck: true, tags: true, html: true });
    const back = run(emptyCollection(), text);
    expect(back.log).toMatchObject({ new: 3, skipped: 0, unknownNotetype: 0 });
    const keys = (c: AnkiCollection) => c.notes.map((n) => [n.guid, n.fields, n.tags, c.decks.find((d) => d.id === n.did)!.name]).sort((a, b) => String(a[0]).localeCompare(String(b[0])));
    expect(keys(back.col)).toEqual(keys(col));
  });
  it('Rundlauf: bearbeiten und wieder einlesen aktualisiert über die guid, auch wenn das erste Feld sich ändert', () => {
    const { col } = build();
    const edited = exportTextFile(col, { guid: true, notetype: true, deck: true, tags: true, html: true }).replace('puer\t', 'puella\t');
    const back = run(col, edited);
    expect(back.log.updated).toBe(1);
    expect(back.col.notes).toHaveLength(3);
    expect(back.col.notes.find((n) => n.guid === 'g1')!.fields[0]).toBe('puella');
  });
});
