import { describe, expect, it } from 'vitest';
import { emptyBook, mergeBooks, recordGame, sameBooks, sanitizeBook, stampsEarnedBy, type PlayedGame } from '../apps/web/src/lib/partiebuch';
import { categoryStamp, stampCount, stampsFor } from '../apps/web/src/lib/stamps';

const game = (id: string, extra: Partial<PlayedGame> = {}): PlayedGame => ({ id, gameId: 'chess', endedAt: 1000, durationMs: 1, mode: 'bots', seats: [], outcome: 'loss', ...extra });
const earned = (book: ReturnType<typeof emptyBook>, gameId = 'chess') => stampsFor(book, gameId).filter((s) => s.earned).map((s) => s.kind);

describe('Stempel im Pass (#145)', () => {
  it('welche Stempel eine Partie verdient', () => {
    expect(stampsEarnedBy(game('a'), 'medium')).toEqual(['chess/first']);
    expect(stampsEarnedBy(game('a', { outcome: 'win' }), 'hard')).toEqual(['chess/first', 'chess/win', 'chess/win-hard']);
    expect(stampsEarnedBy(game('a', { outcome: 'win', mode: 'solo' }), null)).toEqual(['chess/first', 'chess/win']);
    expect(stampsEarnedBy(game('a', { mode: 'online' }), null)).toEqual(['chess/first', 'chess/online']);
    expect(stampsEarnedBy(game('a', { mode: 'tournament', outcome: 'win' }), null)).toEqual(['chess/first', 'chess/win', 'chess/tournament']);
    // Remis und Niederlage geben keinen Siegstempel
    expect(stampsEarnedBy(game('a', { outcome: 'draw' }), 'easy')).toEqual(['chess/first']);
  });

  it('der Stempel trägt das Datum des ersten Mals', () => {
    let book = recordGame(emptyBook(), game('a', { endedAt: 5000 }), 'g1', 'easy');
    book = recordGame(book, game('b', { endedAt: 9000, outcome: 'win' }), 'g1', 'easy');
    book = recordGame(book, game('c', { endedAt: 12000, outcome: 'win' }), 'g1', 'easy');
    const stamps = stampsFor(book, 'chess');
    expect(stamps.find((s) => s.kind === 'first')).toEqual({ kind: 'first', earned: true, at: 5000 });
    expect(stamps.find((s) => s.kind === 'win')).toEqual({ kind: 'win', earned: true, at: 9000 });
    expect(stamps.find((s) => s.kind === 'win-easy')!.at).toBe(9000);
    expect(earned(book)).toEqual(['first', 'win', 'win-easy']);
    expect(stamps.find((s) => s.kind === 'online')).toEqual({ kind: 'online', earned: false, at: null });
  });

  it('Bücher ohne Stempeldaten zeigen die Stempel aus den Zählern, nur ohne Datum', () => {
    const old = sanitizeBook({ counts: { g1: { chess: { 'bots/hard': { played: 3, won: 1, drawn: 0, lost: 2 }, 'online/-': { played: 1, won: 0, drawn: 0, lost: 1 } } } } });
    expect(old.stamps).toEqual({});
    expect(stampsFor(old, 'chess').filter((s) => s.earned).map((s) => [s.kind, s.at])).toEqual([['first', null], ['win', null], ['win-hard', null], ['online', null]]);
  });

  it('beim Zusammenführen gewinnt die früheste Zeit', () => {
    const phone = recordGame(emptyBook(), game('a', { endedAt: 8000 }), 'phone', 'easy');
    const tablet = recordGame(emptyBook(), game('b', { endedAt: 3000 }), 'tablet', 'easy');
    const merged = mergeBooks(phone, tablet);
    expect(merged.stamps['chess/first']).toBe(3000);
    expect(sameBooks(mergeBooks(tablet, phone), merged)).toBe(true);
    expect(sameBooks(mergeBooks(merged, merged), merged)).toBe(true);
  });

  it('Rubrikstempel: erst wenn jedes Spiel der Rubrik gespielt wurde, mit dem Datum des Letzten', () => {
    let book = recordGame(emptyBook(), game('a', { gameId: 'chess', endedAt: 1000 }), 'g1', null);
    book = recordGame(book, game('b', { gameId: 'go', endedAt: 2000 }), 'g1', null);
    expect(categoryStamp(book, ['chess', 'go', 'checkers'])).toEqual({ earned: false, at: null, played: 2, total: 3 });
    book = recordGame(book, game('c', { gameId: 'checkers', endedAt: 7000 }), 'g1', null);
    expect(categoryStamp(book, ['chess', 'go', 'checkers'])).toEqual({ earned: true, at: 7000, played: 3, total: 3 });
    expect(categoryStamp(book, [])).toMatchObject({ earned: false });
    expect(stampCount(book, ['chess', 'go', 'checkers'])).toBe(3);
  });

  it('bereinigt fremde Stempel', () => {
    const book = sanitizeBook({ stamps: { 'chess/first': 5, 'Böse/Art!': 5, 'chess/win': -1, 'chess/online': 'x', 'go/tournament': 9 } });
    expect(book.stamps).toEqual({ 'chess/first': 5, 'go/tournament': 9 });
  });
});
