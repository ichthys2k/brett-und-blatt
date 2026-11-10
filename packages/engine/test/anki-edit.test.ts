import { describe, expect, it } from 'vitest';
import {
  DEFAULT_DECK_ID,
  STOCK_BASIC_ID,
  STOCK_CLOZE_ID,
  STOCK_OPTIONAL_REVERSED_ID,
  STOCK_REVERSED_ID,
  addDeck,
  addField,
  addNote,
  addTemplate,
  cardOrds,
  changeNotetype,
  cloneNotetype,
  computeReq,
  deckTree,
  emptyCollection,
  findDuplicates,
  moveField,
  notesWithoutCards,
  notetypeOf,
  removeField,
  removeNotetype,
  removeTemplate,
  renameField,
  renameFieldInTemplate,
  searchNotes,
  stockNotetypes,
  templateUsesFields,
  updateTemplate,
  type AnkiCollection,
} from '../src';

const T0 = 1_700_000_000_000;

describe('Anki-Bearbeiten: welche Felder braucht eine Vorlage', () => {
  it('fester Text zählt nicht, Abschnitte und Filter schon', () => {
    expect(templateUsesFields('Was ist das? {{Bild}}', new Set())).toBe(false);
    expect(templateUsesFields('Was ist das? {{Bild}}', new Set(['Bild']))).toBe(true);
    expect(templateUsesFields('{{text:Bild}}', new Set(['Bild']))).toBe(true);
    expect(templateUsesFields('{{#A}}{{B}}{{/A}}', new Set(['A']))).toBe(false);
    expect(templateUsesFields('{{#A}}{{B}}{{/A}}', new Set(['A', 'B']))).toBe(true);
    expect(templateUsesFields('{{^A}}{{B}}{{/A}}', new Set(['B']))).toBe(true);
    expect(templateUsesFields('{{FrontSide}}', new Set(['A']))).toBe(false);
  });
  it('berechnet für die eingebauten Notiztypen dieselben Angaben, die sie mitbringen', () => {
    for (const nt of stockNotetypes()) expect(computeReq(nt), nt.name).toEqual(nt.req);
  });
  it('„alle“, wenn erst mehrere Felder zusammen etwas zeigen', () => {
    const nt = { ...stockNotetypes()[0]!, tmpls: [{ ...stockNotetypes()[0]!.tmpls[0]!, qfmt: '{{#Vorderseite}}{{#Rückseite}}{{Vorderseite}}{{Rückseite}}{{/Rückseite}}{{/Vorderseite}}' }] };
    expect(computeReq(nt)).toEqual([[0, 'all', [0, 1]]]);
  });
});

describe('Anki-Bearbeiten: Felder', () => {
  const base = () => {
    let col = emptyCollection();
    col = addNote(col, { notetypeId: STOCK_BASIC_ID, deckId: DEFAULT_DECK_ID, fields: ['a', 'b'] }, T0).col;
    return col;
  };
  it('neues Feld: Notizen bekommen ein leeres Feld; Namen sind eindeutig', () => {
    let col = addField(base(), STOCK_BASIC_ID, 'Beispiel', T0 + 1000);
    expect(notetypeOf(col, STOCK_BASIC_ID)!.flds.map((f) => f.name)).toEqual(['Vorderseite', 'Rückseite', 'Beispiel']);
    expect(col.notes[0]!.fields).toEqual(['a', 'b', '']);
    expect(addField(col, STOCK_BASIC_ID, 'beispiel', T0)).toBe(col);
    col = addField(col, STOCK_BASIC_ID, 'Mit: Doppelpunkt', T0);
    expect(notetypeOf(col, STOCK_BASIC_ID)!.flds.at(-1)!.name).toBe('Mit Doppelpunkt');
  });
  it('Feld umbenennen zieht die Vorlagen mit', () => {
    const col = renameField(base(), STOCK_BASIC_ID, 0, 'Frage', T0);
    const nt = notetypeOf(col, STOCK_BASIC_ID)!;
    expect(nt.flds[0]!.name).toBe('Frage');
    expect(nt.tmpls[0]!.qfmt).toBe('{{Frage}}');
    expect(nt.req).toEqual([[0, 'any', [0]]]);
    expect(renameFieldInTemplate('{{#Alt}}{{text:hint:Alt}}{{Altlast}}{{/Alt}}', 'Alt', 'Neu')).toBe('{{#Neu}}{{text:hint:Neu}}{{Altlast}}{{/Neu}}');
  });
  it('Feld löschen und verschieben: die Notizen ziehen mit, das letzte Feld bleibt', () => {
    let col = addField(base(), STOCK_BASIC_ID, 'Drei', T0);
    col = { ...col, notes: col.notes.map((n) => ({ ...n, fields: ['a', 'b', 'c'] })) };
    const moved = moveField(col, STOCK_BASIC_ID, 2, 0, T0);
    expect(moved.notes[0]!.fields).toEqual(['c', 'a', 'b']);
    expect(notetypeOf(moved, STOCK_BASIC_ID)!.flds.map((f) => [f.name, f.ord])).toEqual([['Drei', 0], ['Vorderseite', 1], ['Rückseite', 2]]);
    const removed = removeField(col, STOCK_BASIC_ID, 1, T0);
    expect(removed.notes[0]!.fields).toEqual(['a', 'c']);
    let one = removeField(removed, STOCK_BASIC_ID, 0, T0);
    expect(removeField(one, STOCK_BASIC_ID, 0, T0)).toBe(one);
    one = removeField(one, STOCK_BASIC_ID, 5, T0);
    expect(notetypeOf(one, STOCK_BASIC_ID)!.flds).toHaveLength(1);
  });
});

describe('Anki-Bearbeiten: Vorlagen und Notiztypen', () => {
  it('Vorlage ändern berechnet, welche Karten entstehen', () => {
    let col = addNote(emptyCollection(), { notetypeId: STOCK_REVERSED_ID, deckId: DEFAULT_DECK_ID, fields: ['a', ''] }, T0).col;
    expect(cardOrds(notetypeOf(col, STOCK_REVERSED_ID)!, ['a', ''])).toEqual([0]);
    col = updateTemplate(col, STOCK_REVERSED_ID, 1, { qfmt: '{{Vorderseite}}' }, T0);
    expect(cardOrds(notetypeOf(col, STOCK_REVERSED_ID)!, ['a', ''])).toEqual([0, 1]);
  });
  it('Vorlage hinzufügen und löschen; mindestens eine bleibt', () => {
    let col = addTemplate(emptyCollection(), STOCK_BASIC_ID, 'Zweite', T0);
    expect(notetypeOf(col, STOCK_BASIC_ID)!.tmpls.map((t) => [t.name, t.ord])).toEqual([['Karte 1', 0], ['Zweite', 1]]);
    col = removeTemplate(col, STOCK_BASIC_ID, 0, T0);
    expect(notetypeOf(col, STOCK_BASIC_ID)!.tmpls.map((t) => [t.name, t.ord])).toEqual([['Zweite', 0]]);
    expect(removeTemplate(col, STOCK_BASIC_ID, 0, T0)).toBe(col);
    expect(addTemplate(emptyCollection(), STOCK_CLOZE_ID, 'x', T0).notetypes).toEqual(emptyCollection().notetypes);
  });
  it('Notiztyp kopieren, Unbenutzte löschen, Benutzte nicht', () => {
    const copy = cloneNotetype(emptyCollection(), STOCK_BASIC_ID, 'Meine Karten', T0)!;
    expect(notetypeOf(copy.col, copy.id)).toMatchObject({ name: 'Meine Karten' });
    expect(copy.id).not.toBe(STOCK_BASIC_ID);
    const used = addNote(copy.col, { notetypeId: copy.id, deckId: DEFAULT_DECK_ID, fields: ['a', 'b'] }, T0).col;
    expect(removeNotetype(used, copy.id, T0)).toBe(used);
    const gone = removeNotetype(copy.col, copy.id, T0);
    expect(gone.notetypes.some((t) => t.id === copy.id)).toBe(false);
    expect(gone.graves[0]).toMatchObject({ kind: 'notetype', key: String(copy.id) });
  });
  it('Notiztyp einer Notiz wechseln mit Zuordnung der Felder', () => {
    const col = addNote(emptyCollection(), { notetypeId: STOCK_BASIC_ID, deckId: DEFAULT_DECK_ID, fields: ['vorn', 'hinten'] }, T0);
    const next = changeNotetype(col.col, col.note.id, STOCK_OPTIONAL_REVERSED_ID, [1, 0, -1], T0 + 1000);
    expect(next.notes[0]).toMatchObject({ mid: STOCK_OPTIONAL_REVERSED_ID, fields: ['hinten', 'vorn', ''] });
    expect(changeNotetype(col.col, col.note.id, STOCK_OPTIONAL_REVERSED_ID, [0, 1], T0)).toBe(col.col);
  });
});

describe('Anki-Bearbeiten: Suche', () => {
  const build = (): AnkiCollection => {
    let col = emptyCollection();
    const latein = addDeck(col, 'Latein::Nomen', T0);
    col = latein.col;
    const items: [number, number, string[], string[]][] = [
      [STOCK_BASIC_ID, latein.deck.id, ['puer', 'Knabe'], ['nomen', 'klasse5']],
      [STOCK_BASIC_ID, latein.deck.id, ['mensa', '<b>Tisch</b>'], ['nomen']],
      [STOCK_BASIC_ID, DEFAULT_DECK_ID, ['house', 'Haus'], []],
      [STOCK_CLOZE_ID, DEFAULT_DECK_ID, ['{{c1::Rom}} liegt in Italien', ''], ['erdkunde']],
    ];
    items.forEach(([notetypeId, deckId, fields, tags], i) => {
      col = addNote(col, { notetypeId, deckId, fields, tags }, T0 + i).col;
    });
    return col;
  };
  const found = (query: string) => searchNotes(build(), query).map((n) => n.fields[0]);
  it('freie Wörter: alle müssen vorkommen, ohne Beachtung von Groß und Klein und HTML', () => {
    expect(found('')).toHaveLength(4);
    expect(found('tisch')).toEqual(['mensa']);
    expect(found('puer knabe')).toEqual(['puer']);
    expect(found('puer tisch')).toEqual([]);
  });
  it('Satz in Anführungszeichen, Verneinung, oder', () => {
    expect(found('"liegt in"')).toEqual(['{{c1::Rom}} liegt in Italien']);
    expect(found('-puer nomen')).toEqual(['mensa']);
    expect(found('puer or house')).toEqual(['puer', 'house']);
  });
  it('tag:, deck:, note:, Feld:Wert und Platzhalter', () => {
    expect(found('tag:klasse5')).toEqual(['puer']);
    expect(found('tag:nomen')).toEqual(['puer', 'mensa']);
    expect(found('tag:none')).toEqual(['house']);
    expect(found('deck:Latein')).toEqual(['puer', 'mensa']);
    expect(found('deck:Standard')).toEqual(['house', '{{c1::Rom}} liegt in Italien']);
    expect(found('note:Lückentext')).toEqual(['{{c1::Rom}} liegt in Italien']);
    expect(found('Rückseite:Haus')).toEqual(['house']);
    expect(found('Vorderseite:pu*')).toEqual(['puer']);
    expect(found('Vorderseite:pue_')).toEqual(['puer']);
    expect(found('-tag:nomen -note:Lückentext')).toEqual(['house']);
  });
});

describe('Anki-Bearbeiten: Aufräumen und Baum', () => {
  it('findet Duplikate am ersten Feld und Notizen ohne Karte', () => {
    let col = emptyCollection();
    for (const [i, f] of [['a', '1'], ['<b>A</b>', '2'], ['b', '3'], ['', 'leer']].entries()) col = addNote(col, { notetypeId: STOCK_BASIC_ID, deckId: DEFAULT_DECK_ID, fields: f as string[] }, T0 + i).col;
    expect(findDuplicates(col).map((g) => g.map((n) => n.fields[1]))).toEqual([['1', '2']]);
    expect(notesWithoutCards(col).map((n) => n.fields[1])).toEqual(['leer']);
  });
  it('Stapelbaum mit eigenen und gesamten Notizen', () => {
    let col = emptyCollection();
    const eltern = addDeck(col, 'Latein', T0);
    const kind = addDeck(eltern.col, 'Latein::Nomen', T0 + 1);
    col = addNote(kind.col, { notetypeId: STOCK_BASIC_ID, deckId: kind.deck.id, fields: ['x', 'y'] }, T0).col;
    expect(deckTree(col).map((d) => [d.label, d.depth, d.own, d.total])).toEqual([['Latein', 0, 0, 1], ['Nomen', 1, 1, 1], ['Standard', 0, 0, 0]]);
  });
});
