import type { BotLevel } from '@brett-und-blatt/engine';
import type { Book, Counter } from './partiebuch';

/*
 * Bot-Wertung des Spielerpasses (Vorhaben #135, Schritt #144): je Spiel eine **Leistungszahl gegen die Bots** und eine
 * **Form**, dazu der Vorschlag einer passenden Stufe in der Einrichtung. Alles entsteht allein aus den Zählern des
 * Partiebuchs (#142) – darum ist es verlustfrei zusammenführbar. Gegen Menschen gibt es keine Wertung.
 *
 * Die Leistungszahl folgt der Elo-Rechnung: Jede Stufe hat einen festen Bezugswert; wer dort die Hälfte der Punkte holt,
 * hat genau diese Zahl. Für Spiele mit mehr als zwei Plätzen ist ein Sieg gegen mehrere Gegner nicht mit einem Sieg
 * zu zweit vergleichbar; dort gibt es keine Leistungszahl, nur die Siegquote.
 */

export const LEVEL_REF: Readonly<Record<BotLevel, number>> = { easy: 800, medium: 1200, hard: 1600 };
export const LEVELS: readonly BotLevel[] = ['easy', 'medium', 'hard'];
/** Ab so vielen Partien gegen eine Stufe gilt die Quote als aussagekräftig. */
export const MIN_GAMES = 5;
/** Ab so vielen Partien insgesamt zeigt der Pass eine Leistungszahl. */
export const MIN_RATED = 5;
const MIN_RATING = 400;
const MAX_RATING = 2000;
/** Siegquote, ab der „schwerer“ vorgeschlagen wird, und Quote, unter der „leichter“ vorgeschlagen wird. */
export const UP_AT = 0.7;
export const DOWN_AT = 0.25;

const none = (): Counter => ({ played: 0, won: 0, drawn: 0, lost: 0 });

/** Zähler gegen Bots je Stufe, über alle Geräte (Spielart „gegen Bots“). */
export function levelStats(book: Book, gameId: string): Record<BotLevel, Counter> {
  const out: Record<BotLevel, Counter> = { easy: none(), medium: none(), hard: none() };
  for (const games of Object.values(book.counts)) {
    for (const [key, counter] of Object.entries(games[gameId] ?? {})) {
      const [mode, level] = key.split('/');
      if (mode !== 'bots' || !LEVELS.includes(level as BotLevel)) continue;
      const target = out[level as BotLevel];
      target.played += counter.played;
      target.won += counter.won;
      target.drawn += counter.drawn;
      target.lost += counter.lost;
    }
  }
  return out;
}

/** Punkte je Partie (Sieg 1, Remis ½) als Anteil, oder null ohne Partien. */
export function winRate(counter: Counter): number | null {
  return counter.played === 0 ? null : (counter.won + counter.drawn / 2) / counter.played;
}

/** Elo-Leistung gegen einen Gegner mit Bezugswert `ref`; die Glättung (½ Sieg und ½ Niederlage dazu) hält Ausreißer bei wenigen Partien im Rahmen. */
function performance(counter: Counter, ref: number): number {
  const score = (counter.won + counter.drawn / 2 + 0.5) / (counter.played + 1);
  return ref + 400 * Math.log10(score / (1 - score));
}

export interface Rating {
  /** Leistungszahl oder null (zu wenige Partien). */
  rating: number | null;
  games: number;
}

/** Leistungszahl aus allen Stufen, gewichtet nach der Zahl der Partien. */
export function ratingOf(stats: Record<BotLevel, Counter>): Rating {
  let games = 0;
  let sum = 0;
  for (const level of LEVELS) {
    const counter = stats[level];
    if (counter.played === 0) continue;
    games += counter.played;
    sum += counter.played * performance(counter, LEVEL_REF[level]);
  }
  if (games < MIN_RATED) return { rating: null, games };
  return { rating: Math.round(Math.min(MAX_RATING, Math.max(MIN_RATING, sum / games))), games };
}

export interface Form {
  games: number;
  /** Punkte (Sieg 1, Remis ½). */
  points: number;
}

/** Form: die letzten (höchstens) 20 Partien gegen Bots in diesem Spiel. */
export function formOf(book: Book, gameId: string, last = 20): Form {
  const recent = book.recent.filter((game) => game.gameId === gameId && game.mode === 'bots').slice(0, last);
  return { games: recent.length, points: recent.reduce((sum, game) => sum + (game.outcome === 'win' ? 1 : game.outcome === 'draw' ? 0.5 : 0), 0) };
}

export interface Suggestion {
  kind: 'up' | 'down';
  to: BotLevel;
  /** Siegquote auf der bisherigen Stufe (0 bis 1) und die Zahl der Partien dahinter. */
  rate: number;
  games: number;
  from: BotLevel;
}

/** Vorschlag zur Stufe, auf der gerade gespielt wird: Wer klar gewinnt, soll höher; wer kaum gewinnt, niedriger. Nur für Spiele zu zweit. */
export function suggest(stats: Record<BotLevel, Counter>, current: BotLevel, twoPlayer: boolean): Suggestion | null {
  if (!twoPlayer) return null;
  const counter = stats[current];
  const rate = winRate(counter);
  if (rate === null || counter.played < MIN_GAMES) return null;
  const index = LEVELS.indexOf(current);
  if (rate >= UP_AT && index < LEVELS.length - 1) return { kind: 'up', to: LEVELS[index + 1]!, rate, games: counter.played, from: current };
  if (rate <= DOWN_AT && index > 0) return { kind: 'down', to: LEVELS[index - 1]!, rate, games: counter.played, from: current };
  return null;
}
