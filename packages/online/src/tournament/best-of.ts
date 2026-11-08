import type { MatchScore, TournamentSnapshot } from './types';

/**
 * Begegnungen als „Best of N“ (W-058 Stufe 3 Teil 5, #131): Eine Begegnung besteht aus bis zu
 * N Partien; wer zuerst mehr als die Hälfte gewinnt, gewinnt die Begegnung. Online spielt der
 * Spielraum die Serie selbst (Farbwechsel nach jeder Partie), vor Ort trägt man den Stand ein.
 * Einstellbar für alle Formen, getrennt für die K.-o.-Phase.
 */

export const BEST_OF_CHOICES = [1, 3, 5, 7] as const;
/** So oft wird ein Remis nachgespielt; danach zählt es einen halben Punkt für beide. */
export const SERIES_DRAW_REPLAYS = 2;
/** Pause zwischen zwei Partien einer Serie, damit beide das Ergebnis sehen. */
export const SERIES_PAUSE_MS = 8_000;

export function isBestOf(value: unknown): value is (typeof BEST_OF_CHOICES)[number] {
  return BEST_OF_CHOICES.includes(value as 1);
}

/** Partien je Begegnung in einer Phase: K.-o. kann eigens eingestellt sein. Tischrunden: immer 1. */
export function bestOfStage(s: Pick<TournamentSnapshot, 'stages' | 'settings'>, stage: number): number {
  const kind = s.stages[stage]?.kind;
  if (kind === 'tables') return 1;
  if ((kind === 'ko' || kind === 'double') && s.settings.bestOfKo) return s.settings.bestOfKo;
  return s.settings.bestOf ?? 1;
}

/** Gewonnene Partien, die eine Begegnung entscheiden. */
export function seriesTarget(bestOf: number): number {
  return Math.floor(bestOf / 2) + 1;
}

/** Stand einer Serie im Spielraum, je Kennung in der Reihenfolge des Auftrags. */
export interface SeriesState {
  bestOf: number;
  /** Punkte je Seite; ein Remis nach den Wiederholungen zählt 0,5. */
  score: MatchScore;
  /** Gewertete Partien (ohne nachgespielte Remis). */
  games: number;
  /** Schon nachgespielte Remis. */
  replays: number;
  /** Wann die nächste Partie beginnt; null, solange keine ansteht. */
  nextAt: number | null;
  /** Entschieden: Sieger (Seite) oder null bei Gleichstand; undefined, solange offen. */
  winner?: 0 | 1 | null;
  /** Entschieden, weil jemand weggeblieben ist: zählt kampflos. */
  forfeit?: boolean;
}

export function newSeries(bestOf: number): SeriesState {
  return { bestOf, score: [0, 0], games: 0, replays: 0, nextAt: null };
}

/**
 * Eine Partie der Serie ist zu Ende: `winner` als Seite, null bei Remis. Gibt zurück, ob die
 * Serie entschieden ist. Ein Remis wird bis zu `SERIES_DRAW_REPLAYS`-mal nachgespielt.
 */
export function recordSeriesGame(series: SeriesState, winner: 0 | 1 | null): boolean {
  if (winner === null && series.replays < SERIES_DRAW_REPLAYS) {
    series.replays++;
  } else {
    series.games++;
    if (winner === null) series.score = [series.score[0] + 0.5, series.score[1] + 0.5];
    else series.score[winner]++;
  }
  const half = series.bestOf / 2;
  const [a, b] = series.score;
  if (a > half || b > half || series.games >= series.bestOf) {
    series.winner = a === b ? null : a > b ? 0 : 1;
    return true;
  }
  return false;
}

/** Wer aufgibt oder wegbleibt, verliert die ganze Begegnung. */
export function forfeitSeries(series: SeriesState, loser: 0 | 1): void {
  series.winner = (1 - loser) as 0 | 1;
  series.forfeit = true;
}

/**
 * Stand einer Begegnung vor Ort prüfen: ganze Zahlen, der Sieger hat genau die nötigen Siege,
 * der andere weniger. Ein Text bedeutet: ungültig.
 */
export function checkSeriesScore(score: MatchScore, bestOf: number): string | null {
  const need = seriesTarget(bestOf);
  const [a, b] = score;
  if (!Number.isInteger(a) || !Number.isInteger(b) || a < 0 || b < 0) return 'Bitte gewonnene Partien eintragen.';
  if (Math.max(a, b) !== need || Math.min(a, b) >= need) return `Bei „Best of ${bestOf}“ gewinnt, wer ${need} Partien gewinnt.`;
  return null;
}
