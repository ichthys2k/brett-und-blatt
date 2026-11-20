import { describe, expect, it } from 'vitest';
import { emptyBook, mergeBooks, recordGame, sanitizeBook, type Book, type Counter, type Mode, type PlayedGame } from '../apps/web/src/lib/partiebuch';
import { LEVELS, levelOf, nextLevelGaps } from '../apps/web/src/lib/stufen';
import { CATEGORIES } from '../apps/web/src/lib/rubriken';
import { buildProgress, type Progress } from '../apps/web/src/lib/unlocks';

/* Stufen aus den Zählern (#571): Schwellen an der Grenze, Alternativzeile, nur gewertete Partien, Hot-Seat, nie sinkend. */

const zero = (): Progress => buildProgress({ book: emptyBook() });
const at = (over: Partial<Progress>): Progress => ({ ...zero(), ...over });

const FULL: Record<number, Partial<Progress>> = {
  1: { rated: 10, ratedGames: 3 },
  2: { rated: 40, ratedGames: 8, beatMediumGames: 1, humanRated: 5 },
  3: { rated: 120, ratedGames: 20, beatMediumGames: 5, beatHardGames: 1, categoriesComplete: 1, humanRated: 20 },
  4: { rated: 500, ratedGames: 40, beatMediumGames: 15, beatHardGames: 5, categoriesComplete: 2, humanRated: 60 },
};

describe('Stufenleiter (#571)', () => {
  it('fünf Stufen mit den Titeln aus dem Konzept', () => {
    expect(LEVELS.map((level) => level.title)).toEqual(['Neuling', 'Stammgast', 'Zunftmitglied', 'Meister', 'Hofrat']);
    expect(levelOf(zero()).title).toBe('Neuling');
  });

  it('jede Stufe gilt an der Schwelle und nicht eins darunter (jede Zeile einzeln)', () => {
    for (const rank of [1, 2, 3, 4]) {
      const full = at(FULL[rank]!);
      expect(levelOf(full).rank, `Stufe ${rank} voll`).toBe(rank);
      for (const [stat, min] of Object.entries(FULL[rank]!) as [keyof Progress, number][]) {
        // Die Alternativzeile (Menschen oder Lerntage) fällt nur aus, wenn auch die andere Option fehlt.
        expect(levelOf({ ...full, [stat]: min - 1 }).rank, `Stufe ${rank}: ${stat} = ${min - 1}`).toBeLessThan(rank);
      }
    }
  });

  it('Alternativzeile: Lerntage ersetzen die Partien mit Menschen', () => {
    const base = { ...FULL[2], humanRated: 0 };
    expect(levelOf(at({ ...base, learnDays: 2 })).rank).toBe(1);
    expect(levelOf(at({ ...base, learnDays: 3 })).rank).toBe(2);
    expect(levelOf(at({ ...FULL[3], humanRated: 19, learnDays: 9 })).rank).toBe(2);
    expect(levelOf(at({ ...FULL[3], humanRated: 0, learnDays: 10 })).rank).toBe(3);
    expect(levelOf(at({ ...FULL[4], humanRated: 59, learnDays: 30 })).rank).toBe(4);
  });

  it('Partien allein genügen nicht; eine fehlende Zeile hält die Stufe an', () => {
    // Nur Partien, sonst nichts: bleibt beim Neuling.
    expect(levelOf(at({ rated: 5000 })).rank).toBe(0);
    // ohne Sieg gegen „schwer“ gilt auch Stufe 3 nicht
    expect(levelOf(at({ ...FULL[4], beatHardGames: 0 })).rank).toBe(2);
    expect(levelOf(at({ ...FULL[4], beatHardGames: 4 })).rank).toBe(3);
  });

  it('nextLevelGaps nennt je Zeile, was fehlt, lesbar für Screenreader', () => {
    const next = nextLevelGaps(at({ rated: 10, ratedGames: 2 }));
    expect(next?.level.title).toBe('Stammgast');
    expect(levelOf(at({ rated: 10, ratedGames: 2 })).rank).toBe(0);
    expect(next!.gaps).toEqual([
      { label: 'Partien', done: true, have: 10, min: 10, missing: 0, text: 'geschafft' },
      { label: 'Verschiedene Spiele', done: false, have: 2, min: 3, missing: 1, text: 'noch 1 Spiel zum ersten Mal spielen' },
    ]);
    const second = nextLevelGaps(at({ ...FULL[1], rated: 37, ratedGames: 5, learnDays: 1, humanRated: 4 }))!;
    expect(second.level.title).toBe('Zunftmitglied');
    expect(second.gaps.map((gap) => gap.text)).toEqual([
      'noch 3 Partien',
      'noch 3 Spiele zum ersten Mal spielen',
      'noch 1 Spiel mit Sieg gegen einen mittleren oder schweren Bot',
      'noch 1 Partie mit Menschen oder noch 2 Lerntage im Karteikasten',
    ]);
    // bei zwei Wegen zählt der nähere
    expect(second.gaps[3]).toMatchObject({ have: 4, min: 5, missing: 1 });
    expect(nextLevelGaps(at(FULL[4]!))).toBeNull();
  });
});

describe('Stufen aus dem Partiebuch (#571)', () => {
  const play = (book: Book, n: number, gameId: string, mode: Mode, level: 'easy' | 'medium' | 'hard' | null, opts: { rated?: boolean; won?: boolean; tag?: string } = {}): Book => {
    let next = book;
    for (let i = 0; i < n; i++) {
      const game: PlayedGame = { id: `${opts.tag ?? 't'}-${gameId}-${mode}-${next.recent.length}-${i}-${Math.random()}`, gameId, endedAt: 1000 + i, durationMs: 90_000, mode, seats: [], outcome: opts.won ? 'win' : 'loss' };
      next = recordGame(next, game, 'g1', level, opts.rated ?? true);
    }
    return next;
  };

  it('zählt nur gewertete Partien', () => {
    let book = play(emptyBook(), 10, 'chess', 'bots', 'easy', { rated: false });
    expect(buildProgress({ book }).played).toBe(10);
    expect(buildProgress({ book }).rated).toBe(0);
    book = play(book, 9, 'chess', 'bots', 'easy');
    expect(levelOf(buildProgress({ book })).rank).toBe(0);
    book = play(book, 1, 'chess', 'bots', 'easy');
    book = play(book, 1, 'skat', 'solo', null);
    book = play(book, 1, 'uno', 'solo', null);
    const progress = buildProgress({ book });
    expect(progress).toMatchObject({ rated: 12, ratedGames: 3 });
    expect(levelOf(progress).title).toBe('Stammgast');
  });

  it('Siege zählen als Spiel mit Sieg gegen mittel/schwer nur gewertet und nur in der Bot-Stufe', () => {
    let book = emptyBook();
    book = play(book, 1, 'chess', 'bots', 'easy', { won: true });
    book = play(book, 1, 'skat', 'bots', 'medium', { won: true, rated: false });
    book = play(book, 1, 'uno', 'bots', 'medium', { won: true });
    book = play(book, 2, 'ludo', 'bots', 'hard', { won: true });
    book = play(book, 1, 'go', 'bots', 'hard', { won: false });
    expect(buildProgress({ book })).toMatchObject({ beatMediumGames: 2, beatHardGames: 1 });
  });

  it('Hot-Seat, online und Turnier zählen als Partien mit Menschen', () => {
    let book = play(emptyBook(), 2, 'chess', 'hotseat', null);
    book = play(book, 2, 'chess', 'online', null);
    book = play(book, 1, 'chess', 'tournament', null);
    book = play(book, 4, 'chess', 'solo', null);
    book = play(book, 3, 'chess', 'hotseat', null, { rated: false });
    expect(buildProgress({ book }).humanRated).toBe(5);
  });

  it('Rubriken komplett aus den Stempeln (jedes Spiel einmal gespielt)', () => {
    let book = emptyBook();
    for (const id of CATEGORIES.find((category) => category.id === 'math')!.gameIds) book = play(book, 1, id, 'solo', null);
    expect(buildProgress({ book }).categoriesComplete).toBe(1);
  });

  it('rückwirkend: ein altes Buch ohne gewertete Zähler gilt als gewertet', () => {
    const games = Object.fromEntries(Array.from({ length: 25 }, (_, i) => [`game-${i}`, { 'solo/-': { played: 6, won: 1, drawn: 0, lost: 5 } }]));
    const old = sanitizeBook({ counts: { g1: games }, stamps: {}, recent: [] });
    const progress = buildProgress({ book: old, learnDays: 0 });
    expect(progress).toMatchObject({ rated: 150, ratedGames: 25 });
    // 150 Partien und 25 Spiele, aber noch kein Sieg gegen mittel/schwer: Stammgast
    expect(levelOf(progress).title).toBe('Stammgast');
  });

  it('die Stufe sinkt nie: Zähler wachsen nur, auch beim Zusammenführen und mit nicht gewerteten Partien', () => {
    let phone = emptyBook();
    let tablet = emptyBook();
    let last = 0;
    for (let i = 0; i < 60; i++) {
      const id = `game-${i % 25}`;
      phone = play(phone, 1, id, i % 3 === 0 ? 'hotseat' : 'solo', null, { rated: i % 4 !== 0, won: true, tag: 'p' });
      tablet = play(tablet, 1, id, 'bots', 'hard', { rated: i % 2 === 0, won: i % 5 === 0, tag: 'q' });
      for (const book of [phone, mergeBooks(phone, tablet), mergeBooks(tablet, phone)]) {
        const rank = levelOf(buildProgress({ book, learnDays: i })).rank;
        if (book === phone) continue;
        expect(rank).toBeGreaterThanOrEqual(last);
        if (book === mergeBooks(phone, tablet)) last = rank;
      }
    }
    // Gegenprobe: ein Zähler, der nur wächst
    const counters: Counter[] = Object.values(phone.counts.g1!).flatMap((buckets) => Object.values(buckets));
    expect(counters.every((counter) => counter.rated <= counter.played && counter.ratedWon <= counter.rated)).toBe(true);
  });
});
