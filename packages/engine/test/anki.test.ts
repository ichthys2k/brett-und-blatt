import { describe, expect, it } from 'vitest';
import {
  DEFAULT_DECK_ID,
  STOCK_BASIC_ID,
  STOCK_CLOZE_ID,
  STOCK_OPTIONAL_REVERSED_ID,
  STOCK_REVERSED_ID,
  addDeck,
  addNote,
  cardOrds,
  cardsOf,
  collectionFromStored,
  compactCollection,
  deletePack,
  emptyCollection,
  fieldChecksum,
  guidFromSeed,
  idFromSeed,
  joinFields,
  mergeCollections,
  migrateLibrary,
  newGuid,
  notetypeOf,
  packsOf,
  removeDeck,
  removeNote,
  sameCollection,
  sanitizeCollection,
  savePackRows,
  sha1Hex,
  splitFields,
  stripHtmlKeepMedia,
  updateNote,
  type AnkiCollection,
  type UserPack,
} from '../src';

const T0 = 1_700_000_000_000;

describe('Anki: Grundbausteine', () => {
  it('SHA-1 stimmt mit den bekannten Werten überein', () => {
    expect(sha1Hex('')).toBe('da39a3ee5e6b4b0d3255bfef95601890afd80709');
    expect(sha1Hex('abc')).toBe('a9993e364706816aba3e25717850c26c9cd0d89d');
    expect(sha1Hex('a'.repeat(1000))).toBe('291e9a6c66994949b57ba5e650361e98fc36b1ba');
  });
  it('Prüfsumme: erste vier Byte von SHA-1 als Zahl', () => {
    expect(fieldChecksum('abc')).toBe(0xa9993e36);
  });
  it('trennt und verbindet Felder mit 0x1F', () => {
    expect(joinFields(['a', 'b'])).toBe('a\x1fb');
    expect(splitFields('a\x1fb\x1f')).toEqual(['a', 'b', '']);
  });
  it('entfernt HTML, lässt Dateinamen von Medien stehen', () => {
    expect(stripHtmlKeepMedia('<b>Haus</b> &amp; Hof').trim()).toBe('Haus & Hof');
    expect(stripHtmlKeepMedia('<div>Katze <img src="katze.jpg"></div>').replace(/\s+/g, ' ').trim()).toBe('Katze katze.jpg');
    expect(stripHtmlKeepMedia('<style>.a{}</style>x<!-- c -->y')).toBe('xy');
    expect(stripHtmlKeepMedia("[sound:a.mp3]")).toBe('[sound:a.mp3]');
  });
  it('Kennungen: Alphabet, Festigkeit', () => {
    expect(newGuid()).toMatch(/^[a-zA-Z0-9!#$%&()*+,\-./:;<=>?@[\]^_`{|}~]{1,11}$/);
    expect(guidFromSeed('x')).toBe(guidFromSeed('x'));
    expect(guidFromSeed('x')).not.toBe(guidFromSeed('y'));
    expect(idFromSeed('x')).toBeGreaterThan(1_600_000_000_000);
    expect(idFromSeed('x')).toBe(idFromSeed('x'));
  });
});

describe('Anki: Karten einer Notiz', () => {
  const col = emptyCollection();
  const type = (id: number) => notetypeOf(col, id)!;
  it('Einfach: Karte nur mit Vorderseite', () => {
    expect(cardOrds(type(STOCK_BASIC_ID), ['Haus', 'house'])).toEqual([0]);
    expect(cardOrds(type(STOCK_BASIC_ID), ['', 'house'])).toEqual([]);
    expect(cardOrds(type(STOCK_BASIC_ID), ['<br>', 'x'])).toEqual([]);
  });
  it('Einfach und umgekehrt: zwei Karten, je nach Feld', () => {
    expect(cardOrds(type(STOCK_REVERSED_ID), ['a', 'b'])).toEqual([0, 1]);
    expect(cardOrds(type(STOCK_REVERSED_ID), ['a', ''])).toEqual([0]);
  });
  it('Optional umgekehrt: zweite Karte nur mit dem dritten Feld', () => {
    expect(cardOrds(type(STOCK_OPTIONAL_REVERSED_ID), ['a', 'b', ''])).toEqual([0]);
    expect(cardOrds(type(STOCK_OPTIONAL_REVERSED_ID), ['a', 'b', 'y'])).toEqual([0, 1]);
  });
  it('Lückentext: eine Karte je Lückennummer', () => {
    expect(cardOrds(type(STOCK_CLOZE_ID), ['{{c1::Paris}} ist die Hauptstadt von {{c2::Frankreich::Land}}', ''])).toEqual([0, 1]);
    expect(cardOrds(type(STOCK_CLOZE_ID), ['{{c2::nur zwei}}', ''])).toEqual([1]);
    expect(cardOrds(type(STOCK_CLOZE_ID), ['ohne Lücke', ''])).toEqual([]);
  });
  it('leitet Karten mit festen Kennungen ab', () => {
    const { col: next, note } = addNote(col, { notetypeId: STOCK_REVERSED_ID, deckId: DEFAULT_DECK_ID, fields: ['a', 'b'] }, T0);
    expect(cardsOf(next).map((c) => [c.id, c.ord])).toEqual([[note.id * 100, 0], [note.id * 100 + 1, 1]]);
  });
});

describe('Anki: Notizen und Stapel', () => {
  it('legt Notizen an, prüft Feldzahl und Steuerzeichen', () => {
    const col = emptyCollection();
    expect(() => addNote(col, { notetypeId: STOCK_BASIC_ID, deckId: DEFAULT_DECK_ID, fields: ['nur eins'] })).toThrow();
    expect(() => addNote(col, { notetypeId: 999, deckId: DEFAULT_DECK_ID, fields: ['a', 'b'] })).toThrow();
    const { note } = addNote(col, { notetypeId: STOCK_BASIC_ID, deckId: DEFAULT_DECK_ID, fields: ['a\x00\x07b', 'x\ty'], tags: ['Bio  Zelle', 'bio_zelle', ' '] }, T0);
    expect(note.fields).toEqual(['ab', 'x\ty']);
    expect(note.tags).toEqual(['Bio_Zelle', 'bio_zelle']);
    expect(note.mod).toBe(Math.floor(T0 / 1000));
  });
  it('Stapelnamen sind eindeutig', () => {
    let col = emptyCollection();
    col = addDeck(col, 'Latein', T0).col;
    const second = addDeck(col, 'latein', T0 + 1);
    expect(second.deck.name).toBe('latein (2)');
  });
  it('Ändern setzt die Zeit nur bei echter Änderung; Löschen hinterlässt einen Vermerk', () => {
    let col = emptyCollection();
    const { col: withNote, note } = addNote(col, { notetypeId: STOCK_BASIC_ID, deckId: DEFAULT_DECK_ID, fields: ['a', 'b'] }, T0);
    col = withNote;
    expect(updateNote(col, note.id, { fields: ['a', 'b'] }, T0 + 5000)).toBe(col);
    col = updateNote(col, note.id, { fields: ['a', 'c'] }, T0 + 5000);
    expect(col.notes[0]!.mod).toBe(Math.floor((T0 + 5000) / 1000));
    col = removeNote(col, note.id, T0 + 9000);
    expect(col.notes).toHaveLength(0);
    expect(col.graves).toEqual([{ kind: 'note', key: note.guid, at: T0 + 9000 }]);
  });
  it('Stapel löschen nimmt die Notizen mit; der Standardstapel bleibt', () => {
    let col = emptyCollection();
    const deck = addDeck(col, 'X', T0);
    col = addNote(deck.col, { notetypeId: STOCK_BASIC_ID, deckId: deck.deck.id, fields: ['a', 'b'] }, T0).col;
    col = removeDeck(col, deck.deck.id, T0 + 1000);
    expect(col.notes).toHaveLength(0);
    expect(col.decks.map((d) => d.id)).toEqual([DEFAULT_DECK_ID]);
    expect(removeDeck(col, DEFAULT_DECK_ID, T0)).toBe(col);
  });
});

describe('Anki: Prüfen und Zusammenführen', () => {
  it('verwirft Unbrauchbares, behält unbekannte Schlüssel der Notiztypen', () => {
    const base = emptyCollection();
    const custom = { ...notetypeOf(base, STOCK_BASIC_ID)!, id: 77, name: 'Mein Typ', zukunft: { x: 1 } };
    const col = sanitizeCollection({
      notetypes: [custom, { id: 'kaputt' }],
      decks: [{ id: 5, name: 'Bio', mod: 1, besonders: true }, { id: 6, name: '  ' }],
      notes: [
        { id: 10, guid: 'g1', mid: 77, did: 5, mod: 1, tags: ['t'], fields: ['a', 'b'] },
        { id: 11, guid: 'g2', mid: 77, did: 5, mod: 1, fields: ['zu wenig'] },
        { id: 12, guid: 'g3', mid: 404, did: 5, mod: 1, fields: ['a', 'b'] },
        { id: 13, guid: 'g4', mid: 77, did: 999, mod: 1, fields: ['a', 'b'] },
      ],
      graves: [{ kind: 'note', key: 'weg', at: 5 }, { kind: 'x', key: 'k', at: 1 }],
    });
    expect(col.notes.map((n) => [n.guid, n.did])).toEqual([['g1', 5], ['g4', DEFAULT_DECK_ID]]);
    expect(notetypeOf(col, 77)).toMatchObject({ zukunft: { x: 1 } });
    expect(col.decks.find((d) => d.id === 5)).toMatchObject({ besonders: true });
    expect(col.decks.some((d) => d.id === 6)).toBe(false);
    expect(col.graves).toHaveLength(1);
    expect(sanitizeCollection(null).notes).toEqual([]);
  });

  const withNote = (fields: [string, string], mod: number, guid = 'g'): AnkiCollection => ({ ...emptyCollection(), notes: [{ id: 1, guid, mid: STOCK_BASIC_ID, did: DEFAULT_DECK_ID, mod, tags: [], fields }] });
  it('führt je Notiz die jüngere Änderung zusammen, bei Gleichstand gewinnt der lokale Stand', () => {
    const remote = withNote(['r', 'x'], 20);
    const local = withNote(['l', 'x'], 10);
    expect(mergeCollections(remote, local, 30_000).notes[0]!.fields[0]).toBe('r');
    expect(mergeCollections(withNote(['r', 'x'], 10), local, 30_000).notes[0]!.fields[0]).toBe('l');
  });
  it('Löschvermerk gilt, bis jemand danach etwas ändert', () => {
    const deleted: AnkiCollection = { ...emptyCollection(), graves: [{ kind: 'note', key: 'g', at: 15_000 }] };
    expect(mergeCollections(deleted, withNote(['a', 'b'], 10), 20_000).notes).toHaveLength(0);
    expect(mergeCollections(deleted, withNote(['a', 'b'], 16), 20_000).notes).toHaveLength(1);
  });
  it('Zusammenführen ist unabhängig von der Reihenfolge der Geräte (bei verschiedenen Zeiten)', () => {
    const a = withNote(['a', '1'], 10, 'g1');
    const b = { ...withNote(['b', '2'], 20, 'g2') };
    const ab = mergeCollections(a, b, 30_000);
    const ba = mergeCollections(b, a, 30_000);
    expect(sameCollection(ab, ba)).toBe(true);
    expect(ab.notes).toHaveLength(2);
  });
  it('Notizen eines gelöschten Stapels landen nicht beim Standardstapel, wenn der Vermerk neuer ist', () => {
    const local = emptyCollection();
    const remote = { ...addDeck(emptyCollection(), 'X', 5000).col };
    const deckId = remote.decks[1]!.id;
    const gone = { ...local, graves: [{ kind: 'deck' as const, key: String(deckId), at: 9000 }] };
    expect(mergeCollections(remote, gone, 10_000).decks.map((d) => d.id)).toEqual([DEFAULT_DECK_ID]);
  });
});

describe('Anki: Pakete der Spiele als Sicht auf Stapel', () => {
  const pack = (over: Partial<UserPack> = {}): UserPack => ({ id: 'p-12345678', name: 'Vokabeln', rows: [{ id: 'r-000001', a: 'house', b: 'Haus' }, { id: 'r-000002', a: 'dog & cat', b: 'Hund <und> Katze' }], at: T0, ...over });

  it('stellt die bisherige Bibliothek auf Anki-Notizen um, auf jedem Gerät gleich', () => {
    const one = migrateLibrary([pack()]);
    const two = migrateLibrary([pack()]);
    expect(sameCollection(one, two)).toBe(true);
    expect(one.notes).toHaveLength(2);
    expect(one.notes[1]!.fields).toEqual(['dog &amp; cat', 'Hund &lt;und&gt; Katze']);
    expect(one.notes.every((n) => n.mid === STOCK_BASIC_ID)).toBe(true);
    const packs = packsOf(one);
    expect(packs).toHaveLength(1);
    expect(packs[0]!.name).toBe('Vokabeln');
    expect(packs[0]!.rows.map((r) => [r.a, r.b])).toEqual([['house', 'Haus'], ['dog & cat', 'Hund <und> Katze']]);
    expect(packs[0]!.rows[0]!.id).toMatch(/^n-[0-9a-f]{6,16}$/);
    expect(packs[0]!.id).toMatch(/^d-[0-9a-f]{6,16}$/);
  });
  it('gelöschte Pakete werden zu Löschvermerken und kommen nicht zurück', () => {
    const col = migrateLibrary([pack({ deleted: true, rows: [] })]);
    expect(col.decks).toHaveLength(1);
    expect(col.graves).toHaveLength(1);
    const merged = mergeCollections(migrateLibrary([pack({ at: T0 - 1000 })]), col, T0 + 1000);
    expect(packsOf(merged)).toEqual([]);
  });
  it('lässt für Speicher und Sicherung die eingebauten Typen weg und setzt sie beim Lesen wieder ein', () => {
    const col = savePackRows(emptyCollection(), null, 'Neu', [{ a: 'x', b: 'y' }], T0).col;
    const compact = compactCollection(col);
    expect(compact.notetypes).toEqual([]);
    expect(compact.decks.map((d) => d.name)).toEqual(['Neu']);
    expect(sameCollection(sanitizeCollection(JSON.parse(JSON.stringify(compact))), col)).toBe(true);
  });
  it('nimmt auch die alte Liste im gespeicherten Wert', () => {
    expect(packsOf(collectionFromStored([pack()]))).toHaveLength(1);
    expect(packsOf(collectionFromStored(migrateLibrary([pack()])))).toHaveLength(1);
    expect(collectionFromStored('Müll').notes).toEqual([]);
  });
  it('speichert Zeilen: neu, geändert, gelöscht; HTML in unveränderten Feldern bleibt', () => {
    let col = migrateLibrary([pack()]);
    const [existing] = packsOf(col);
    col = { ...col, notes: col.notes.map((n, i) => (i === 0 ? { ...n, fields: ['<b>house</b>', n.fields[1]!] } : n)) };
    const rows = [
      { id: existing!.rows[0]!.id, a: 'house', b: 'Haus (neu)' },
      { a: 'tree', b: 'Baum' },
    ];
    const saved = savePackRows(col, existing!.id, 'Vokabeln 2', rows, T0 + 60_000);
    const [now] = packsOf(saved.col);
    expect(saved.packId).toBe(existing!.id);
    expect(now!.name).toBe('Vokabeln 2');
    expect(now!.rows.map((r) => [r.a, r.b])).toEqual([['house', 'Haus (neu)'], ['tree', 'Baum']]);
    const first = saved.col.notes.find((n) => n.fields[1] === 'Haus (neu)')!;
    expect(first.fields[0]).toBe('<b>house</b>');
    expect(saved.col.graves).toHaveLength(1);
  });
  it('legt ein neues Paket als Stapel an und löscht es wieder', () => {
    const made = savePackRows(emptyCollection(), null, 'Neu', [{ a: 'x', b: 'y' }], T0);
    expect(packsOf(made.col)).toHaveLength(1);
    const gone = deletePack(made.col, made.packId, T0 + 1000);
    expect(packsOf(gone)).toEqual([]);
    expect(gone.graves.some((g) => g.kind === 'deck')).toBe(true);
  });
  it('Notizen mit Bild, Ton oder Lücken sind keine Paare', () => {
    let col = emptyCollection();
    const deck = addDeck(col, 'Gemischt', T0);
    col = deck.col;
    for (const fields of [['<img src="a.jpg">', 'Bild'], ['Ton', '[sound:a.mp3]'], ['Text', '']]) col = addNote(col, { notetypeId: STOCK_BASIC_ID, deckId: deck.deck.id, fields }, T0 + col.notes.length).col;
    col = addNote(col, { notetypeId: STOCK_CLOZE_ID, deckId: deck.deck.id, fields: ['{{c1::x}}', 'y'] }, T0 + 10).col;
    col = addNote(col, { notetypeId: STOCK_BASIC_ID, deckId: deck.deck.id, fields: ['ja', 'gut'] }, T0 + 20).col;
    expect(packsOf(col)[0]!.rows.map((r) => r.a)).toEqual(['ja']);
  });
});
