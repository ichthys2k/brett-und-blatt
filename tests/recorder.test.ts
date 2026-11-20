import { beforeEach, describe, expect, it, vi } from 'vitest';

// Ein Speicher wie localStorage, damit der echte Recorder samt Pässen läuft.
const data = new Map<string, string>();
vi.stubGlobal('window', {
  localStorage: {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
    key: (i: number) => [...data.keys()][i] ?? null,
    get length() {
      return data.size;
    },
  },
});
vi.mock('../apps/web/src/lib/playerPass', () => ({ passSyncSoon: () => undefined }));
vi.mock('../apps/web/src/lib/chronikStore', () => ({ rememberReplay: () => undefined }));

const { rowsFor, saveRows, countsAsGame, saveFinds, albumSeat, BOOK_KEY, TROPHIES_KEY } = await import('../apps/web/src/lib/passRecorder');
const { ALBUM_KEY, sanitizeAlbum } = await import('../apps/web/src/lib/album');
const { sanitizeBook } = await import('../apps/web/src/lib/partiebuch');
const { sanitizeTrophies } = await import('../apps/web/src/lib/pokale');
const { createPassBook } = await import('../apps/web/src/lib/passes');

const seats = [{ kind: 'human' as const, name: 'Mia' }, { kind: 'bot' as const, name: 'Computer', level: 'hard' as const }];
const finish = (id: string, winner: number, at: number) => {
  const rows = rowsFor({ gameId: 'chess', sessionId: id, result: { kind: 'win', winners: [winner] }, seats, endedAt: at, durationMs: 1000 });
  return saveRows(rows, seats);
};

describe('Recorder schreibt Buch und Pokale (#142, #146)', () => {
  beforeEach(() => data.clear());

  it('ein Sieg: Buch, Stempel, Pokal mit Urkunde; die Niederlage danach nur ins Buch', () => {
    expect(finish('s1', 0, 5000)).toBe(true);
    const book = sanitizeBook(JSON.parse(data.get(BOOK_KEY)!));
    expect(book.recent.map((g) => g.outcome)).toEqual(['win']);
    expect(book.stamps).toMatchObject({ 'chess/first': 5000, 'chess/win': 5000, 'chess/win-hard': 5000 });
    const trophies = sanitizeTrophies(JSON.parse(data.get(TROPHIES_KEY)!));
    expect(trophies).toEqual([{ id: 's1', gameId: 'chess', at: 5000, mode: 'bots', level: 'hard', opponents: ['Computer'], cert: 'schwer' }]);

    expect(finish('s2', 1, 6000)).toBe(false);
    expect(sanitizeTrophies(JSON.parse(data.get(TROPHIES_KEY)!))).toHaveLength(1);
    expect(sanitizeBook(JSON.parse(data.get(BOOK_KEY)!)).recent).toHaveLength(2);
  });

  it('der zweite Sieg gegen schwer ist ein Pokal, aber keine Urkunde mehr', () => {
    finish('s1', 0, 5000);
    expect(finish('s2', 0, 7000)).toBe(true);
    const [newest, oldest] = sanitizeTrophies(JSON.parse(data.get(TROPHIES_KEY)!));
    expect(newest!.cert).toBeUndefined();
    expect(oldest!.cert).toBe('schwer');
  });

  it('dieselbe Partie zweimal gemeldet zählt einmal', () => {
    finish('s1', 0, 5000);
    finish('s1', 0, 5000);
    const book = sanitizeBook(JSON.parse(data.get(BOOK_KEY)!));
    expect(Object.values(book.counts)[0]!.chess!['bots/hard']).toEqual({ played: 1, won: 1, drawn: 0, lost: 0, rated: 0, ratedWon: 0 });
    expect(sanitizeTrophies(JSON.parse(data.get(TROPHIES_KEY)!))).toHaveLength(1);
  });

  it('Hot-Seat: Der Sieg geht ins Buch und in den Pokalschrank des Passes des Platzes, auch wenn er nicht aktiv ist', () => {
    const book = createPassBook({
      get: (k) => data.get(k) ?? null,
      set: (k, v) => void data.set(k, v),
      remove: (k) => void data.delete(k),
      keys: () => [...data.keys()],
    });
    const mia = book.touch({ name: 'Mia', avatar: '🦊', hasCode: true })!;
    const lena = book.createNew({ name: 'Mia', avatar: '🦊', hasCode: true })!;
    book.switchTo(mia, { name: 'Lena', avatar: '🐸', hasCode: false });
    const hot = [{ kind: 'human' as const, name: 'Mia', passId: mia }, { kind: 'human' as const, name: 'Lena', passId: lena }];
    const got = saveRows(rowsFor({ gameId: 'dame', sessionId: 'h1', result: { kind: 'win', winners: [1] }, seats: hot, endedAt: 9000, durationMs: 1 }), hot);
    // Mia (aktiv) hat verloren: kein Pokal; Lena hat gewonnen: Pokal im beiseite gelegten Fach
    expect(got).toBe(false);
    expect(data.get(TROPHIES_KEY)).toBeUndefined();
    const stashed = JSON.parse(data.get(`brett-und-blatt:pass:${lena}:${TROPHIES_KEY}`)!);
    expect(sanitizeTrophies(stashed).map((t) => [t.id, t.mode])).toEqual([['h1', 'hotseat']]);
  });
});

describe('Recorder: Gast zeichnet nichts auf (#558)', () => {
  beforeEach(() => data.clear());

  it('eine Partie als Gast legt weder Buch noch Pokal noch Album an', () => {
    const book = createPassBook({
      get: (k) => data.get(k) ?? null,
      set: (k, v) => void data.set(k, v),
      remove: (k) => void data.delete(k),
      keys: () => [...data.keys()],
    });
    book.createNew({ name: '', avatar: '', hasCode: false }, { guest: true });
    expect(book.activeIsGuest()).toBe(true);
    expect(finish('g1', 0, 5000)).toBe(false);
    saveFinds('kapitel', 3, ['a']);
    expect(data.get(BOOK_KEY)).toBeUndefined();
    expect(data.get(TROPHIES_KEY)).toBeUndefined();
    expect(data.get(ALBUM_KEY)).toBeUndefined();
  });
});

describe('Recorder: Sammelalbum (#148)', () => {
  beforeEach(() => data.clear());

  it('welcher Platz sammelt: online der eigene, lokal der erste mit freiem Namen', () => {
    const humanFree = { kind: 'human' as const, name: 'Mia' };
    const bot = { kind: 'bot' as const, name: 'Computer' };
    expect(albumSeat([bot, humanFree])).toBe(1);
    expect(albumSeat([humanFree, humanFree])).toBe(0);
    expect(albumSeat([bot, bot])).toBeNull();
    expect(albumSeat([humanFree, bot], { yourSeat: 1 })).toBe(1);
    expect(albumSeat([humanFree, bot], { yourSeat: null })).toBeNull();
    expect(albumSeat([{ kind: 'human' as const, name: 'Lena', passId: 'bbbbbbbbbbbb' }])).toBeNull();
  });

  it('schreibt Funde ins Album des aktiven Passes, doppelte zählen nicht', () => {
    saveFinds('quartett', 32, ['tiere:A1', 'tiere:A2']);
    saveFinds('quartett', 32, ['tiere:A2', 'tiere:B1']);
    saveFinds('pairs', 20, []);
    const album = sanitizeAlbum(JSON.parse(data.get(ALBUM_KEY)!));
    expect(Object.keys(album)).toEqual(['quartett']);
    expect(Object.keys(album.quartett!.found).sort()).toEqual(['tiere:A1', 'tiere:A2', 'tiere:B1']);
    expect(album.quartett!.total).toBe(32);
  });

  it('Serienspiele (#560): Aufgeben in der ersten Runde zählt nicht, das Serienende und spätere Aufgabe schon', () => {
    const resigned = { kind: 'win' as const, winners: [1], reason: 'resign' };
    const timeout = { kind: 'win' as const, winners: [1], reason: 'time' };
    const seriesEnd = { kind: 'win' as const, winners: [0] };
    expect(countsAsGame(resigned, 0)).toBe(false);
    expect(countsAsGame(timeout, 0)).toBe(false);
    expect(countsAsGame(resigned, 3)).toBe(true);
    expect(countsAsGame(seriesEnd, 12)).toBe(true);
    // Spiele ohne Serie bleiben unberührt.
    expect(countsAsGame(resigned)).toBe(true);
    expect(countsAsGame(resigned, null)).toBe(true);
  });

  it('Skat-Serie: nur das Ergebnis der ganzen Serie wird eine Zeile im Buch', async () => {
    const { gameUi } = await import('../packages/games/skat/src/ui/index');
    const done = gameUi.seriesRoundsDone!;
    const view = (gameNumber: number, phase: string) => ({ gameNumber, phase, totalGames: 12 }) as never;
    expect(done(view(1, 'bidding'))).toBe(0);
    expect(done(view(1, 'play'))).toBe(0);
    expect(done(view(1, 'roundOver'))).toBe(1);
    expect(done(view(1, 'passedOut'))).toBe(1);
    expect(done(view(5, 'bidding'))).toBe(4);
    expect(done(view(13, 'roundOver'))).toBe(12);
    const skatSeats = [{ kind: 'human' as const, name: 'Mia' }, { kind: 'bot' as const, name: 'Computer', level: 'medium' as const }];
    const aufgabe = { kind: 'win' as const, winners: [1], reason: 'resign' };
    if (countsAsGame(aufgabe, done(view(1, 'play')))) saveRows(rowsFor({ gameId: 'skat', sessionId: 'k1', result: aufgabe, seats: skatSeats, endedAt: 1, durationMs: 1 }), skatSeats);
    expect(data.get(BOOK_KEY)).toBeUndefined();
    const ende = { kind: 'win' as const, winners: [0] };
    if (countsAsGame(ende, done(view(13, 'roundOver')))) saveRows(rowsFor({ gameId: 'skat', sessionId: 'k2', result: ende, seats: skatSeats, endedAt: 2, durationMs: 1 }), skatSeats);
    expect(sanitizeBook(JSON.parse(data.get(BOOK_KEY)!)).recent.map((g) => g.outcome)).toEqual(['win']);
  });
});
