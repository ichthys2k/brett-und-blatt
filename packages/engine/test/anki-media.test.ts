import { describe, expect, it } from 'vitest';
import { STOCK_BASIC_ID, STOCK_CLOZE_ID, addDeck, addNote, changeNotetypeMany, checkMediaFile, defaultFieldMap, emptyCollection, kindOf, mediaFileName, moveNotes, tagNotes } from '../src';

const T0 = 1_700_000_000_000;
const bytes = (...n: number[]) => new Uint8Array(n);

describe('Medien hinzufügen', () => {
  it('erkennt Bild und Ton, lehnt Skript-Formate ab', () => {
    expect(kindOf('Katze.JPG')).toBe('image');
    expect(kindOf('a.mp3')).toBe('audio');
    expect(kindOf('a.svg')).toBeNull();
    expect(checkMediaFile('a.svg', 10)).toMatch(/Erlaubt/);
    expect(checkMediaFile('a.png', 0)).toMatch(/leer/);
    expect(checkMediaFile('a.png', 6 * 1024 * 1024)).toMatch(/zu groß/);
    expect(checkMediaFile('a.mp3', 100, 50 * 1024 * 1024)).toMatch(/voll/);
    expect(checkMediaFile('a.png', 100)).toBeNull();
  });
  it('vergibt freie Namen ohne Sonderzeichen', () => {
    const taken = new Map<string, Uint8Array>();
    expect(mediaFileName('Mein Bild (1).PNG', bytes(1), taken)).toEqual({ name: 'Mein_Bild_1_.png', existing: false });
    taken.set('x.png', bytes(1, 2));
    expect(mediaFileName('x.png', bytes(1, 2), taken)).toEqual({ name: 'x.png', existing: true });
    const other = mediaFileName('x.png', bytes(9), taken);
    expect(other.existing).toBe(false);
    expect(other.name).toMatch(/^x-[0-9a-f]{6}\.png$/);
  });
});

describe('Sammelaktionen', () => {
  const make = () => {
    let col = emptyCollection();
    const deck = addDeck(col, 'Latein', T0);
    col = deck.col;
    const a = addNote(col, { notetypeId: STOCK_BASIC_ID, deckId: 1, fields: ['a', '1'], tags: ['alt'] }, T0);
    const b = addNote(a.col, { notetypeId: STOCK_BASIC_ID, deckId: 1, fields: ['b', '2'] }, T0 + 1);
    return { col: b.col, ids: [a.note.id, b.note.id], deckId: deck.deck.id };
  };
  it('verschiebt in einen Stapel und ignoriert unbekannte', () => {
    const { col, ids, deckId } = make();
    expect(moveNotes(col, ids, deckId).notes.every((n) => n.did === deckId)).toBe(true);
    expect(moveNotes(col, ids, 999)).toBe(col);
  });
  it('setzt und entfernt Tags', () => {
    const { col, ids } = make();
    const plus = tagNotes(col, ids, ['neu', 'zwei wörter'.replace(' ', '_')]);
    expect(plus.notes[0]!.tags).toEqual(['alt', 'neu', 'zwei_wörter']);
    const minus = tagNotes(plus, ids, [], ['ALT']);
    expect(minus.notes[0]!.tags).toEqual(['neu', 'zwei_wörter']);
  });
  it('wechselt den Notiztyp mehrerer Notizen', () => {
    const { col, ids } = make();
    const basic = col.notetypes.find((t) => t.id === STOCK_BASIC_ID)!;
    const cloze = col.notetypes.find((t) => t.id === STOCK_CLOZE_ID)!;
    const map = defaultFieldMap(basic, cloze);
    expect(map).toEqual([0, 1]);
    const next = changeNotetypeMany(col, ids, STOCK_CLOZE_ID, map);
    expect(next.notes.map((n) => [n.mid, n.fields])).toEqual([[STOCK_CLOZE_ID, ['a', '1']], [STOCK_CLOZE_ID, ['b', '2']]]);
  });
});
