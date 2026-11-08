import { describe, expect, it } from 'vitest';
import { DOWN_AT, LEVEL_REF, UP_AT, formOf, levelStats, ratingOf, suggest, winRate } from '../apps/web/src/lib/botRating';
import { emptyBook, mergeBooks, recordGame, type Book, type PlayedGame } from '../apps/web/src/lib/partiebuch';

const game = (id: string, outcome: PlayedGame['outcome'], extra: Partial<PlayedGame> = {}): PlayedGame => ({ id, gameId: 'chess', endedAt: 1000 + Number(id.replace(/\D/g, '') || 0), durationMs: 1, mode: 'bots', seats: [], outcome, ...extra });

function play(book: Book, device: string, level: 'easy' | 'medium' | 'hard', outcomes: PlayedGame['outcome'][], prefix = 'g'): Book {
  let next = book;
  outcomes.forEach((outcome, i) => {
    next = recordGame(next, game(`${prefix}${device}${level}${i}`, outcome), device, level);
  });
  return next;
}

describe('Bot-Wertung (#144)', () => {
  it('zählt je Stufe, nur gegen Bots und über alle Geräte', () => {
    let book = play(emptyBook(), 'phone', 'medium', ['win', 'win', 'loss']);
    book = play(book, 'tablet', 'medium', ['draw']);
    book = recordGame(book, game('solo1', 'win', { mode: 'solo' }), 'phone', null);
    book = recordGame(book, game('hot1', 'win', { mode: 'hotseat' }), 'phone', null);
    const stats = levelStats(book, 'chess');
    expect(stats.medium).toEqual({ played: 4, won: 2, drawn: 1, lost: 1 });
    expect(stats.easy.played + stats.hard.played).toBe(0);
    expect(levelStats(book, 'go').medium.played).toBe(0);
  });

  it('Sieg und Remis in Punkten', () => {
    expect(winRate({ played: 0, won: 0, drawn: 0, lost: 0 })).toBeNull();
    expect(winRate({ played: 4, won: 2, drawn: 2, lost: 0 })).toBe(0.75);
  });

  it('keine Leistungszahl vor fünf Partien', () => {
    const stats = levelStats(play(emptyBook(), 'p', 'medium', ['win', 'win', 'win', 'win']), 'chess');
    expect(ratingOf(stats)).toEqual({ rating: null, games: 4 });
  });

  it('wer gegen eine Stufe die Hälfte holt, liegt nahe an deren Bezugswert', () => {
    for (const level of ['easy', 'medium', 'hard'] as const) {
      const stats = levelStats(play(emptyBook(), 'p', level, ['win', 'loss', 'win', 'loss', 'win', 'loss', 'win', 'loss']), 'chess');
      expect(Math.abs(ratingOf(stats).rating! - LEVEL_REF[level])).toBeLessThanOrEqual(10);
    }
  });

  it('mehr Siege = höhere Zahl, schwerere Gegner zählen mehr, Grenzen halten', () => {
    const wins = ['win', 'win', 'win', 'win', 'win', 'win', 'loss'] as const;
    const easy = ratingOf(levelStats(play(emptyBook(), 'p', 'easy', [...wins]), 'chess')).rating!;
    const hard = ratingOf(levelStats(play(emptyBook(), 'p', 'hard', [...wins]), 'chess')).rating!;
    expect(hard).toBeGreaterThan(easy);
    const losses = ratingOf(levelStats(play(emptyBook(), 'p', 'easy', Array(30).fill('loss')), 'chess')).rating!;
    expect(losses).toBeGreaterThanOrEqual(400);
    expect(losses).toBeLessThan(easy);
    const allWins = ratingOf(levelStats(play(emptyBook(), 'p', 'hard', Array(60).fill('win')), 'chess')).rating!;
    expect(allWins).toBeLessThanOrEqual(2000);
  });

  it('entsteht nur aus Zählern: zwei Geräte zusammenführen ändert nichts am Ergebnis', () => {
    const phone = play(emptyBook(), 'phone', 'medium', ['win', 'win', 'loss']);
    const tablet = play(emptyBook(), 'tablet', 'medium', ['win', 'loss', 'draw']);
    const merged = mergeBooks(phone, tablet);
    expect(ratingOf(levelStats(merged, 'chess'))).toEqual(ratingOf(levelStats(mergeBooks(tablet, phone), 'chess')));
    expect(ratingOf(levelStats(mergeBooks(merged, phone), 'chess'))).toEqual(ratingOf(levelStats(merged, 'chess')));
  });

  it('Form: die letzten 20 Partien gegen Bots in diesem Spiel', () => {
    let book = emptyBook();
    for (let i = 0; i < 25; i++) book = recordGame(book, game(`f${i}`, i < 5 ? 'loss' : 'win'), 'p', 'medium');
    book = recordGame(book, game('h1', 'loss', { mode: 'hotseat', endedAt: 99999 }), 'p', null);
    book = recordGame(book, game('x1', 'loss', { gameId: 'go', endedAt: 99998 }), 'p', 'medium');
    expect(formOf(book, 'chess')).toEqual({ games: 20, points: 20 });
    expect(formOf(book, 'chess', 3)).toEqual({ games: 3, points: 3 });
  });

  it('Vorschlag: wer klar gewinnt, soll höher; wer kaum gewinnt, niedriger; sonst nichts', () => {
    const stats = (outcomes: PlayedGame['outcome'][], level: 'easy' | 'medium' | 'hard' = 'medium') => levelStats(play(emptyBook(), 'p', level, outcomes), 'chess');
    const win8 = stats(['win', 'win', 'win', 'win', 'win', 'win', 'win', 'loss']);
    expect(suggest(win8, 'medium', true)).toMatchObject({ kind: 'up', to: 'hard', from: 'medium', games: 8 });
    expect(suggest(win8, 'medium', false)).toBeNull(); // mehr als zwei Plätze
    expect(suggest(win8, 'hard', true)).toBeNull(); // keine andere Stufe gespielt
    const hardWins = stats(['win', 'win', 'win', 'win', 'win'], 'hard');
    expect(suggest(hardWins, 'hard', true)).toBeNull(); // schon ganz oben
    const lose = stats(['loss', 'loss', 'loss', 'loss', 'loss', 'win'], 'medium');
    expect(suggest(lose, 'medium', true)).toMatchObject({ kind: 'down', to: 'easy' });
    expect(suggest(stats(['loss', 'loss', 'loss', 'loss'], 'medium'), 'medium', true)).toBeNull(); // zu wenige Partien
    expect(suggest(stats(['win', 'loss', 'win', 'loss', 'win', 'loss']), 'medium', true)).toBeNull();
    expect(UP_AT).toBeGreaterThan(0.5);
    expect(DOWN_AT).toBeLessThan(0.5);
  });
});
