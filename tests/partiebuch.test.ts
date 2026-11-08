import type { Result, SeatConfig } from '../packages/engine/src';
import { describe, expect, it, vi } from 'vitest';
import { emptyBook, localMode, mergeBooks, outcomeFor, recordGame, sameBooks, sanitizeBook, strongestBot, totals, type PlayedGame } from '../apps/web/src/lib/partiebuch';
import { createPassBook, type Store } from '../apps/web/src/lib/passes';

vi.mock('../apps/web/src/lib/playerPass', () => ({ passSyncSoon: () => undefined }));
const { rowsFor } = await import('../apps/web/src/lib/passRecorder');

const human = (name: string, extra: Partial<SeatConfig> = {}): SeatConfig => ({ kind: 'human', name, ...extra });
const bot = (level: 'easy' | 'medium' | 'hard' = 'medium'): SeatConfig => ({ kind: 'bot', name: 'Bot', level });
const game = (id: string, extra: Partial<PlayedGame> = {}): PlayedGame => ({ id, gameId: 'chess', endedAt: 1000, durationMs: 5000, mode: 'bots', seats: [], outcome: 'win', ...extra });

describe('Partiebuch (#142)', () => {
  it('erkennt die Spielart aus den Plätzen', () => {
    expect(localMode([human('a')])).toBe('solo');
    expect(localMode([human('a'), bot()])).toBe('bots');
    expect(localMode([human('a'), human('b')])).toBe('hotseat');
    expect(localMode([human('a'), human('b'), bot()])).toBe('hotseat');
    expect(strongestBot([human('a'), bot('easy'), bot('hard')])).toBe('hard');
    expect(strongestBot([human('a')])).toBeNull();
  });

  it('Ergebnis aus Sicht eines Platzes', () => {
    expect(outcomeFor({ kind: 'win', winners: [1] }, 1)).toBe('win');
    expect(outcomeFor({ kind: 'win', winners: [1] }, 0)).toBe('loss');
    expect(outcomeFor({ kind: 'draw' }, 0)).toBe('draw');
    expect(outcomeFor({ kind: 'loss' }, 0)).toBe('loss');
  });

  it('zählt je Spiel, Modus und Bot-Stufe, und jede Partie nur einmal', () => {
    let book = recordGame(emptyBook(), game('a'), 'g1', 'hard');
    book = recordGame(book, game('b', { outcome: 'loss', endedAt: 2000 }), 'g1', 'hard');
    book = recordGame(book, game('c', { outcome: 'draw', endedAt: 3000 }), 'g1', 'easy');
    expect(recordGame(book, game('a'), 'g1', 'hard')).toBe(book);
    expect(totals(book, 'chess')).toEqual({ played: 3, won: 1, drawn: 1, lost: 1 });
    expect(book.counts.g1!.chess!['bots/hard']).toEqual({ played: 2, won: 1, drawn: 0, lost: 1 });
    expect(book.recent.map((g) => g.id)).toEqual(['c', 'b', 'a']);
  });

  it('zwei Geräte führen zusammen, ohne etwas doppelt zu zählen', () => {
    const phone = recordGame(recordGame(emptyBook(), game('a'), 'phone', 'medium'), game('b', { endedAt: 2000 }), 'phone', 'medium');
    const tablet = recordGame(emptyBook(), game('c', { endedAt: 3000, outcome: 'loss' }), 'tablet', 'medium');
    const merged = mergeBooks(phone, tablet);
    expect(totals(merged)).toEqual({ played: 3, won: 2, drawn: 0, lost: 1 });
    // vertauschbar und beliebig oft anwendbar
    expect(sameBooks(mergeBooks(tablet, phone), merged)).toBe(true);
    expect(sameBooks(mergeBooks(merged, phone), merged)).toBe(true);
    expect(sameBooks(mergeBooks(merged, merged), merged)).toBe(true);
    // das Telefon spielt weiter, das Zusammenführen zählt nur den Zuwachs
    const phone2 = recordGame(phone, game('d', { endedAt: 4000 }), 'phone', 'medium');
    expect(totals(mergeBooks(phone2, merged)).played).toBe(4);
  });

  it('behält nur die letzten 50 Kopfzeilen, die Zähler bleiben', () => {
    let book = emptyBook();
    for (let i = 1; i <= 60; i++) book = recordGame(book, game(`g${i}`, { endedAt: i * 1000 }), 'g1', null);
    expect(book.recent).toHaveLength(50);
    expect(book.recent[0]!.id).toBe('g60');
    expect(totals(book).played).toBe(60);
  });

  it('bereinigt fremde Daten', () => {
    expect(sanitizeBook(null)).toEqual(emptyBook());
    const dirty = sanitizeBook({
      counts: { g1: { chess: { 'bots/hard': { played: 3, won: 9, drawn: 9, lost: 9 }, 'quatsch/x': { played: 1 } }, 'Böse Id!': {} }, '!': {} },
      recent: [game('ok'), { id: 'kaputt' }, { ...game('x'), mode: 'cheat' }, { ...game('y'), seats: [{ kind: 'human', name: 'x'.repeat(100) }, { kind: 'nope' }] }],
    });
    expect(dirty.counts.g1!.chess).toEqual({ 'bots/hard': { played: 3, won: 3, drawn: 0, lost: 0 } });
    expect(dirty.recent.map((g) => g.id).sort()).toEqual(['ok', 'y']);
    expect(dirty.recent.find((g) => g.id === 'y')!.seats).toEqual([{ name: 'x'.repeat(40), kind: 'human' }]);
  });
});

describe('Recorder: Zeilen aus einem Partieende (#142)', () => {
  const base = { gameId: 'chess', sessionId: 'S1', endedAt: 5000, durationMs: 4000 };

  it('Solo und gegen Bot: eine Zeile für den aktiven Pass', () => {
    const rows = rowsFor({ ...base, result: { kind: 'win', winners: [0] }, seats: [human('Mia'), bot('hard')], scores: [12, 3] });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ passId: null, game: { mode: 'bots', outcome: 'win', place: 1, score: 12 } });
    expect(rows[0]!.game.seats).toEqual([{ name: 'Mia', kind: 'human', you: true }, { name: 'Bot', kind: 'bot', level: 'hard' }]);
  });

  it('Hot-Seat mit zwei Pässen: jeder bekommt sein eigenes Ergebnis', () => {
    const rows = rowsFor({ ...base, result: { kind: 'win', winners: [1] }, seats: [human('Mia', { passId: 'aaaaaaaaaaaa' }), human('Lena', { passId: 'bbbbbbbbbbbb' })] });
    expect(rows.map((r) => [r.passId, r.game.outcome])).toEqual([['aaaaaaaaaaaa', 'loss'], ['bbbbbbbbbbbb', 'win']]);
    expect(rows.every((r) => r.game.mode === 'hotseat')).toBe(true);
  });

  it('Plätze mit freiem Namen zählen nicht, nur der erste gehört dem aktiven Pass', () => {
    const rows = rowsFor({ ...base, result: { kind: 'draw' }, seats: [human('Ich'), human('Gast'), human('Lena', { passId: 'bbbbbbbbbbbb' })] });
    expect(rows.map((r) => r.passId)).toEqual([null, 'bbbbbbbbbbbb']);
  });

  it('online nur der eigene Platz, Zuschauer nichts, Turnier als eigener Modus', () => {
    const seats = [human('A'), human('B')];
    const result: Result = { kind: 'win', winners: [0] };
    expect(rowsFor({ ...base, result, seats, online: { yourSeat: 0, tournament: false } }).map((r) => [r.game.mode, r.game.outcome])).toEqual([['online', 'win']]);
    expect(rowsFor({ ...base, result, seats, online: { yourSeat: 1, tournament: true } }).map((r) => [r.game.mode, r.game.outcome])).toEqual([['tournament', 'loss']]);
    expect(rowsFor({ ...base, result, seats, online: { yourSeat: null, tournament: false } })).toEqual([]);
  });

  it('Aufgeben und verlorenes Solitaire sind Niederlagen', () => {
    expect(rowsFor({ ...base, result: { kind: 'win', winners: [1], reason: 'resign' }, seats: [human('Mia'), bot()] })[0]!.game.outcome).toBe('loss');
    expect(rowsFor({ ...base, result: { kind: 'loss' }, seats: [human('Mia')] })[0]).toMatchObject({ game: { mode: 'solo', outcome: 'loss' } });
  });
});

describe('Partiebuch im Speicher der Pässe', () => {
  function memory(): Store & { data: Map<string, string> } {
    const data = new Map<string, string>();
    return { data, get: (k) => data.get(k) ?? null, set: (k, v) => void data.set(k, v), remove: (k) => void data.delete(k), keys: () => [...data.keys()] };
  }
  const A = { name: 'Mia', avatar: '🦊', hasCode: true };

  it('schreibt ins Buch des aktiven Passes oder beiseite ins Buch eines anderen', () => {
    const store = memory();
    const book = createPassBook(store);
    const mia = book.touch(A)!;
    const lena = book.createNew(A)!;
    book.switchTo(mia, { name: 'Lena', avatar: '🐸', hasCode: false });
    const KEY = 'brett-und-blatt:partiebuch';
    book.updateStored(null, KEY, () => '"mia"');
    book.updateStored(lena, KEY, () => '"lena"');
    expect(store.get(KEY)).toBe('"mia"');
    expect(store.get(`brett-und-blatt:pass:${lena}:${KEY}`)).toBe('"lena"');
    // nach dem Wechsel liegt Lenas Buch unter dem gewohnten Schlüssel
    book.switchTo(lena, A);
    expect(store.get(KEY)).toBe('"lena"');
  });
});
