import { describe, expect, it, vi } from 'vitest';
import { certificateText } from '../apps/web/src/lib/certificate';
import { emptyBook, recordGame, type PlayedGame } from '../apps/web/src/lib/partiebuch';
import { MAX_TROPHIES, addTrophy, mergeTrophies, sameTrophies, sanitizeTrophies, shelves, trophyFor, type Trophy } from '../apps/web/src/lib/pokale';

const game = (id: string, extra: Partial<PlayedGame> = {}): PlayedGame => ({
  id,
  gameId: 'chess',
  endedAt: 1000,
  durationMs: 1,
  mode: 'bots',
  seats: [{ name: 'Mia', kind: 'human', you: true }, { name: 'Computer', kind: 'bot', level: 'hard' }],
  outcome: 'win',
  ...extra,
});
const trophy = (id: string, at: number, extra: Partial<Trophy> = {}): Trophy => ({ id, gameId: 'chess', at, mode: 'bots', opponents: [], ...extra });

describe('Pokalschrank (#146)', () => {
  it('nur Siege geben einen Pokal, mit Gegnern, Modus und Stufe', () => {
    expect(trophyFor(game('a', { outcome: 'loss' }), 'hard', true)).toBeNull();
    expect(trophyFor(game('a', { outcome: 'draw' }), 'hard', true)).toBeNull();
    expect(trophyFor(game('a'), 'medium', false)).toEqual({ id: 'a', gameId: 'chess', at: 1000, mode: 'bots', level: 'medium', opponents: ['Computer'] });
    const online = trophyFor(game('o', { mode: 'online', seats: [{ name: 'Mia', kind: 'human', you: true }, ...Array.from({ length: 8 }, (_, i) => ({ name: `G${i}`, kind: 'human' as const }))] }), null, false)!;
    expect(online.opponents).toHaveLength(5);
    expect(online.level).toBeUndefined();
  });

  it('Urkunde für Turniersiege und den ersten Sieg gegen schwer je Spiel', () => {
    expect(trophyFor(game('t', { mode: 'tournament' }), null, false)!.cert).toBe('turnier');
    expect(trophyFor(game('h'), 'hard', true)!.cert).toBe('schwer');
    expect(trophyFor(game('h2'), 'hard', false)!.cert).toBeUndefined();
    expect(trophyFor(game('m'), 'medium', true)!.cert).toBeUndefined();
  });

  it('legt Pokale ab, ohne eine Partie doppelt, und behält die neuesten 60', () => {
    let list: Trophy[] = [];
    for (let i = 1; i <= 70; i++) list = addTrophy(list, trophy(`g${i}`, i * 1000));
    expect(list).toHaveLength(MAX_TROPHIES);
    expect(list[0]!.id).toBe('g70');
    expect(list.at(-1)!.id).toBe('g11');
    expect(addTrophy(list, trophy('g70', 70_000))).toBe(list);
  });

  it('zwei Geräte vereinigen ihre Pokale, vertauschbar und wiederholbar', () => {
    const phone = [trophy('a', 3000), trophy('b', 1000)];
    const tablet = [trophy('c', 2000), trophy('a', 3000)];
    const merged = mergeTrophies(phone, tablet);
    expect(merged.map((t) => t.id)).toEqual(['a', 'c', 'b']);
    expect(sameTrophies(mergeTrophies(tablet, phone), merged)).toBe(true);
    expect(sameTrophies(mergeTrophies(merged, merged), merged)).toBe(true);
  });

  it('Regalfächer: Zahl der Siege aus den Zählern, auch wenn ältere Pokale verdichtet sind', () => {
    let book = emptyBook();
    for (let i = 0; i < 4; i++) book = recordGame(book, game(`w${i}`, { endedAt: 1000 + i }), 'g1', 'hard');
    book = recordGame(book, game('l', { outcome: 'loss', endedAt: 5000 }), 'g1', 'hard');
    book = recordGame(book, game('x', { gameId: 'go', endedAt: 6000 }), 'g1', 'easy');
    book = recordGame(book, game('y', { gameId: 'dame', outcome: 'loss', endedAt: 7000 }), 'g1', 'easy');
    const list = shelves(book, [trophy('w3', 1003)]);
    expect(list.map((s) => [s.gameId, s.wins, s.trophies.length])).toEqual([['chess', 4, 1], ['go', 1, 0]]);
  });

  it('bereinigt fremde Daten', () => {
    expect(sanitizeTrophies(null)).toEqual([]);
    const dirty = sanitizeTrophies([
      trophy('ok', 5, { cert: 'turnier', level: 'hard', opponents: ['x'.repeat(100)] }),
      { id: 'kaputt' },
      { ...trophy('x', 5), mode: 'cheat' },
      { ...trophy('y', -1) },
      { ...trophy('z', 7), cert: 'gold', level: 'unbesiegbar', opponents: [1, 'a', 'b', 'c', 'd', 'e', 'f'] },
    ]);
    expect(dirty.map((t) => t.id)).toEqual(['z', 'ok']);
    expect(dirty[1]!.opponents[0]).toHaveLength(40);
    expect(dirty[0]).toEqual({ id: 'z', gameId: 'chess', at: 7, mode: 'bots', opponents: ['a', 'b', 'c', 'd', 'e'] });
  });

  it('Urkundentext nennt Spiel, Datum und Anlass', () => {
    vi.setSystemTime(new Date('2026-11-08T10:00:00Z'));
    const t = certificateText(trophy('t', Date.UTC(2026, 10, 8, 12), { mode: 'tournament', cert: 'turnier', opponents: ['Lena', 'Tom'] }), 'Schach', 'Mia');
    expect(t.title).toBe('Urkunde für den Turniersieg');
    expect(t.lines.join(' ')).toContain('Mia');
    expect(t.lines.join(' ')).toContain('„Schach“');
    expect(t.lines.join(' ')).toContain('Lena, Tom');
    const hard = certificateText(trophy('h', Date.UTC(2026, 10, 8, 12), { level: 'hard', cert: 'schwer' }), 'Schach', '');
    expect(hard.title).toBe('Urkunde für einen besonderen Sieg');
    expect(hard.lines[0]).toContain('„schwer“');
    expect(hard.lines[0]).toContain('Eine Spielerin oder ein Spieler');
  });
});
