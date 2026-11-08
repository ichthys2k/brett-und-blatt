import type { BotLevel, Result, SeatConfig } from '@brett-und-blatt/engine';

/*
 * Partiebuch des Spielerpasses (Vorhaben #135, Schritt #142): jede beendete Partie als Kopfzeile plus Zähler je Spiel.
 * Reine Funktionen ohne Speicher und Oberfläche; der Recorder (`passRecorder.ts`) ruft sie beim Partieende,
 * der Pass-Block (`passBlocks.ts`) gleicht das Buch zwischen Geräten ab.
 *
 * Zähler liegen je Gerät (`counts[Gerät][Spiel][Eimer]`) und wachsen nur: Beim Zusammenführen gilt je Zahl der größere
 * Wert, also wird nichts doppelt gezählt (wie das Zählerbuch im Narrenhof). Die Kopfzeilen der letzten Partien werden
 * nach Kennung vereinigt; die ältesten fallen heraus, die Zähler bleiben.
 */

export type Mode = 'solo' | 'bots' | 'hotseat' | 'online' | 'tournament';
export type Outcome = 'win' | 'draw' | 'loss';

export interface PlayedSeat {
  name: string;
  avatar?: string;
  kind: 'human' | 'bot';
  level?: BotLevel;
  you?: boolean;
}

export interface PlayedGame {
  id: string;
  gameId: string;
  endedAt: number;
  durationMs: number;
  mode: Mode;
  /** Mitspieler zum Zeitpunkt der Partie: nur Spitzname, Bild, Art und Bot-Stufe, keine Kennungen. */
  seats: PlayedSeat[];
  outcome: Outcome;
  /** Platz bei mehreren Spielern (nur der Sieg ist sicher bekannt). */
  place?: number;
  score?: number | string;
}

export interface Counter {
  played: number;
  won: number;
  drawn: number;
  lost: number;
}

/** Zähler: Gerät → Spiel → Eimer (`<Modus>/<stärkste Bot-Stufe oder ->`). */
export type Counts = Record<string, Record<string, Record<string, Counter>>>;

export interface Book {
  counts: Counts;
  /** Neueste zuerst. */
  recent: PlayedGame[];
}

export const MAX_RECENT = 50;
const MAX_SEATS = 10;
const MAX_NAME = 40;
const MODES: readonly Mode[] = ['solo', 'bots', 'hotseat', 'online', 'tournament'];
const OUTCOMES: readonly Outcome[] = ['win', 'draw', 'loss'];
const LEVELS: readonly BotLevel[] = ['easy', 'medium', 'hard'];
const ID_PATTERN = /^[\w.:/-]{1,80}$/;
const GAME_PATTERN = /^[a-z0-9-]{1,40}$/;

export const emptyBook = (): Book => ({ counts: {}, recent: [] });

/** Spielart aus den Plätzen: allein, gegen Bots oder mit mehreren Menschen an einem Gerät. */
export function localMode(seats: readonly Pick<SeatConfig, 'kind'>[]): Mode {
  const humans = seats.filter((seat) => seat.kind === 'human').length;
  if (humans >= 2) return 'hotseat';
  return seats.length > humans ? 'bots' : 'solo';
}

/** Stärkste Bot-Stufe am Tisch oder null. */
export function strongestBot(seats: readonly Pick<SeatConfig, 'kind' | 'level'>[]): BotLevel | null {
  let best = -1;
  for (const seat of seats) if (seat.kind === 'bot') best = Math.max(best, LEVELS.indexOf(seat.level ?? 'medium'));
  return best < 0 ? null : LEVELS[best]!;
}

/** Ergebnis aus Sicht eines Platzes: Sieg nur, wenn der Platz zu den Gewinnern gehört; „loss“ gilt für alle. */
export function outcomeFor(result: Result, seat: number): Outcome {
  if (result.kind === 'draw') return 'draw';
  if (result.kind === 'win') return result.winners.includes(seat) ? 'win' : 'loss';
  return 'loss';
}

const bucketOf = (mode: Mode, level: BotLevel | null) => `${mode}/${level ?? '-'}`;
export const bucketKey = bucketOf;

/** Trägt eine Partie ein; liegt ihre Kennung schon in den letzten Partien, geschieht nichts. */
export function recordGame(book: Book, game: PlayedGame, deviceId: string, level: BotLevel | null): Book {
  if (book.recent.some((entry) => entry.id === game.id)) return book;
  const device = book.counts[deviceId] ?? {};
  const forGame = device[game.gameId] ?? {};
  const key = bucketOf(game.mode, level);
  const before = forGame[key] ?? { played: 0, won: 0, drawn: 0, lost: 0 };
  const after: Counter = {
    played: before.played + 1,
    won: before.won + (game.outcome === 'win' ? 1 : 0),
    drawn: before.drawn + (game.outcome === 'draw' ? 1 : 0),
    lost: before.lost + (game.outcome === 'loss' ? 1 : 0),
  };
  return {
    counts: { ...book.counts, [deviceId]: { ...device, [game.gameId]: { ...forGame, [key]: after } } },
    recent: [game, ...book.recent].sort((a, b) => b.endedAt - a.endedAt).slice(0, MAX_RECENT),
  };
}

const natural = (value: unknown, max = 1_000_000): number => (typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.min(Math.floor(value), max) : 0);
/** Zeitstempel in ms (bis zum Jahr 2286) und Dauern in ms (bis rund 11 Tage). */
const MAX_TIME = 10_000_000_000_000;
const MAX_DURATION = 1_000_000_000;

function sanitizeSeat(value: unknown): PlayedSeat | null {
  const { name, avatar, kind, level, you } = (value ?? {}) as Record<string, unknown>;
  if (kind !== 'human' && kind !== 'bot') return null;
  return {
    name: typeof name === 'string' ? name.slice(0, MAX_NAME) : '',
    ...(typeof avatar === 'string' && avatar ? { avatar: avatar.slice(0, 20) } : {}),
    kind,
    ...(LEVELS.includes(level as BotLevel) ? { level: level as BotLevel } : {}),
    ...(you === true ? { you: true } : {}),
  };
}

function sanitizeGame(value: unknown): PlayedGame | null {
  const v = (value ?? {}) as Record<string, unknown>;
  if (typeof v.id !== 'string' || !ID_PATTERN.test(v.id) || typeof v.gameId !== 'string' || !GAME_PATTERN.test(v.gameId)) return null;
  if (!MODES.includes(v.mode as Mode) || !OUTCOMES.includes(v.outcome as Outcome)) return null;
  const endedAt = natural(v.endedAt, MAX_TIME);
  if (endedAt === 0) return null;
  const seats = (Array.isArray(v.seats) ? v.seats : []).slice(0, MAX_SEATS).flatMap((seat) => sanitizeSeat(seat) ?? []);
  return {
    id: v.id,
    gameId: v.gameId,
    endedAt,
    durationMs: natural(v.durationMs, MAX_DURATION),
    mode: v.mode as Mode,
    seats,
    outcome: v.outcome as Outcome,
    ...(typeof v.place === 'number' && v.place >= 1 && v.place <= 100 ? { place: Math.floor(v.place) } : {}),
    ...(typeof v.score === 'number' && Number.isFinite(v.score) ? { score: v.score } : typeof v.score === 'string' ? { score: v.score.slice(0, 20) } : {}),
  };
}

/** Macht aus fremden Daten ein gültiges Buch. */
export function sanitizeBook(value: unknown): Book {
  const book = emptyBook();
  if (!value || typeof value !== 'object') return book;
  const { counts, recent } = value as { counts?: unknown; recent?: unknown };
  if (counts && typeof counts === 'object') {
    for (const [deviceId, games] of Object.entries(counts as Record<string, unknown>).slice(0, 20)) {
      if (!/^[\w-]{2,60}$/.test(deviceId) || !games || typeof games !== 'object') continue;
      for (const [gameId, buckets] of Object.entries(games as Record<string, unknown>).slice(0, 80)) {
        if (!GAME_PATTERN.test(gameId) || !buckets || typeof buckets !== 'object') continue;
        for (const [key, counter] of Object.entries(buckets as Record<string, unknown>).slice(0, 20)) {
          const [mode, level] = key.split('/');
          if (!MODES.includes(mode as Mode) || (level !== '-' && !LEVELS.includes(level as BotLevel))) continue;
          const c = (counter ?? {}) as Record<string, unknown>;
          const played = natural(c.played);
          const won = Math.min(natural(c.won), played);
          const drawn = Math.min(natural(c.drawn), played - won);
          const lost = Math.min(natural(c.lost), played - won - drawn);
          book.counts[deviceId] ??= {};
          book.counts[deviceId]![gameId] ??= {};
          book.counts[deviceId]![gameId]![key] = { played, won, drawn, lost };
        }
      }
    }
  }
  const games = (Array.isArray(recent) ? recent : []).flatMap((entry) => sanitizeGame(entry) ?? []);
  book.recent = dedupe(games).slice(0, MAX_RECENT);
  return book;
}

function dedupe(games: PlayedGame[]): PlayedGame[] {
  const seen = new Set<string>();
  return games
    .sort((a, b) => b.endedAt - a.endedAt)
    .filter((game) => (seen.has(game.id) ? false : (seen.add(game.id), true)));
}

/** Je Zahl der größere Wert (Zähler wachsen nur); Kopfzeilen vereinigt, die neuesten bleiben. */
export function mergeBooks(remote: Book, local: Book): Book {
  const counts: Counts = {};
  for (const source of [remote.counts, local.counts]) {
    for (const [deviceId, games] of Object.entries(source)) {
      for (const [gameId, buckets] of Object.entries(games)) {
        for (const [key, counter] of Object.entries(buckets)) {
          const target = ((counts[deviceId] ??= {})[gameId] ??= {});
          const old = target[key];
          target[key] = old
            ? { played: Math.max(old.played, counter.played), won: Math.max(old.won, counter.won), drawn: Math.max(old.drawn, counter.drawn), lost: Math.max(old.lost, counter.lost) }
            : { ...counter };
        }
      }
    }
  }
  return { counts, recent: dedupe([...local.recent, ...remote.recent]).slice(0, MAX_RECENT) };
}

/** Gleich, unabhängig von der Reihenfolge der Schlüssel. */
const canonical = (value: unknown): unknown =>
  Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)).map(([k, v]) => [k, canonical(v)])) : value;

export function sameBooks(a: Book, b: Book): boolean {
  return JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
}

/** Summe über alle Geräte eines Spiels (oder aller Spiele), optional nur ein Modus. */
export function totals(book: Book, gameId?: string, mode?: Mode): Counter {
  const sum: Counter = { played: 0, won: 0, drawn: 0, lost: 0 };
  for (const games of Object.values(book.counts)) {
    for (const [id, buckets] of Object.entries(games)) {
      if (gameId && id !== gameId) continue;
      for (const [key, counter] of Object.entries(buckets)) {
        if (mode && !key.startsWith(`${mode}/`)) continue;
        sum.played += counter.played;
        sum.won += counter.won;
        sum.drawn += counter.drawn;
        sum.lost += counter.lost;
      }
    }
  }
  return sum;
}
