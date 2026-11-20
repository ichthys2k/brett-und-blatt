import type { Book } from './partiebuch';

/*
 * Stempel im Pass (Vorhaben #135, Schritt #145). Ob ein Stempel gilt, ergibt sich aus den Zählern des Partiebuchs
 * (`counts`), das Datum des ersten Mals steht in `stamps` und ist die früheste Zeit. Alte Bücher ohne Datum zeigen
 * den Stempel trotzdem, nur ohne Datum.
 */

export const STAMP_KINDS = ['first', 'win', 'win-easy', 'win-medium', 'win-hard', 'online', 'tournament'] as const;
export type StampKind = (typeof STAMP_KINDS)[number];

export const STAMP_ICON: Readonly<Record<StampKind, string>> = {
  first: '🎲',
  win: '🏆',
  'win-easy': '🟢',
  'win-medium': '🟡',
  'win-hard': '🔴',
  online: '🌐',
  tournament: '🏅',
};
export const STAMP_LABEL: Readonly<Record<StampKind, string>> = {
  first: 'Erste Partie',
  win: 'Erster Sieg',
  'win-easy': 'Sieg gegen leicht',
  'win-medium': 'Sieg gegen mittel',
  'win-hard': 'Sieg gegen schwer',
  online: 'Online gespielt',
  tournament: 'Im Turnier gespielt',
};

/** Beschriftung eines Stempels für Tastatur und Bildschirmleser (#562): Name und Bedingung, dazu „offen“ oder das Datum. */
export function stampDescription(stamp: { kind: StampKind; earned: boolean }, dateText: string | null, openText: string): string {
  return `${STAMP_LABEL[stamp.kind]}${stamp.earned ? (dateText ? ` · ${dateText}` : '') : ` · ${openText}`}`;
}

export interface Stamp {
  kind: StampKind;
  earned: boolean;
  /** Zeitpunkt des ersten Mals, wenn bekannt. */
  at: number | null;
}

function earnedByCounts(book: Book, gameId: string, kind: StampKind): boolean {
  for (const games of Object.values(book.counts)) {
    for (const [key, counter] of Object.entries(games[gameId] ?? {})) {
      const [mode, level] = key.split('/');
      if (kind === 'first' && counter.played > 0) return true;
      if (kind === 'win' && counter.won > 0) return true;
      if (kind === 'win-easy' && mode === 'bots' && level === 'easy' && counter.won > 0) return true;
      if (kind === 'win-medium' && mode === 'bots' && level === 'medium' && counter.won > 0) return true;
      if (kind === 'win-hard' && mode === 'bots' && level === 'hard' && counter.won > 0) return true;
      if (kind === 'online' && mode === 'online' && counter.played > 0) return true;
      if (kind === 'tournament' && mode === 'tournament' && counter.played > 0) return true;
    }
  }
  return false;
}

/** Alle sieben Stempel eines Spiels. */
export function stampsFor(book: Book, gameId: string): Stamp[] {
  return STAMP_KINDS.map((kind) => {
    const at = book.stamps?.[`${gameId}/${kind}`] ?? null;
    return { kind, earned: at !== null || earnedByCounts(book, gameId, kind), at };
  });
}

export interface CategoryStamp {
  earned: boolean;
  /** Wann das letzte Spiel der Rubrik zum ersten Mal gespielt wurde, wenn bekannt. */
  at: number | null;
  played: number;
  total: number;
}

/** „Alle Spiele der Rubrik gespielt“: gilt, wenn jedes Spiel den Stempel „Erste Partie“ hat. */
export function categoryStamp(book: Book, gameIds: readonly string[]): CategoryStamp {
  const firsts = gameIds.map((id) => stampsFor(book, id)[0]!);
  const played = firsts.filter((stamp) => stamp.earned).length;
  const earned = gameIds.length > 0 && played === gameIds.length;
  const dates = firsts.map((stamp) => stamp.at);
  return { earned, at: earned && dates.every((d) => d !== null) ? Math.max(...(dates as number[])) : null, played, total: gameIds.length };
}

/** Stempel fürs Lernen (#581): längste Folge von Lerntagen im Karteikasten. */
export const LEARN_STAMP_DAYS = [1, 5, 10] as const;
export const LEARN_STAMP_ICON = ['📖', '🔥', '🎓'] as const;

export interface LearnStamp {
  days: number;
  icon: string;
  earned: boolean;
}

/** Längste Reihe aufeinanderfolgender Tage in `days` (Tagesnummern). */
export function longestStreak(days: readonly number[]): number {
  const sorted = [...new Set(days)].sort((a, b) => a - b);
  let best = 0;
  let run = 0;
  sorted.forEach((day, i) => {
    run = i > 0 && day === sorted[i - 1]! + 1 ? run + 1 : 1;
    best = Math.max(best, run);
  });
  return best;
}

export function learnStamps(days: readonly number[]): LearnStamp[] {
  const best = longestStreak(days);
  return LEARN_STAMP_DAYS.map((n, i) => ({ days: n, icon: LEARN_STAMP_ICON[i]!, earned: best >= n }));
}

/** Beschriftung eines Lern-Stempels für Tastatur und Screenreader. */
export function learnStampDescription(stamp: LearnStamp): string {
  const name = stamp.days === 1 ? '1 Lerntag' : `${stamp.days} Lerntage in Folge`;
  return `${name}: ${stamp.earned ? 'erreicht' : 'offen'}`;
}

export function stampCount(book: Book, gameIds: readonly string[]): number {
  return gameIds.reduce((sum, id) => sum + stampsFor(book, id).filter((stamp) => stamp.earned).length, 0);
}
