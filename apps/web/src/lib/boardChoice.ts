import { SEEK_MAX_GAMES, SEEK_MOODS, SEEK_SEATS, type SeekMood, type SeekSeats } from '@brett-und-blatt/online';

/*
 * Was man zuletzt auf einen Zettel geschrieben hat (Spiele, Spielerzahl, Stimmung), je Gerät in `localStorage`, damit
 * der nächste Zettel schon so vorbelegt ist. Gibt es noch nichts, sind es die Lieblingsspiele.
 */
export const BOARD_CHOICE_KEY = 'brett-und-blatt:zettel';

export interface BoardChoice {
  games: string[];
  seats: SeekSeats;
  mood: SeekMood;
}

export const DEFAULT_CHOICE: BoardChoice = { games: [], seats: 'any', mood: 'relaxed' };

/** Macht aus gespeicherten Daten eine gültige Wahl; `known` nennt die Spiele, die es noch gibt. */
export function sanitizeChoice(value: unknown, known: readonly string[]): BoardChoice | null {
  if (typeof value !== 'object' || value === null) return null;
  const v = value as Record<string, unknown>;
  const games = Array.isArray(v.games) ? [...new Set(v.games.filter((g): g is string => typeof g === 'string' && known.includes(g)))].slice(0, SEEK_MAX_GAMES) : [];
  const seats = (SEEK_SEATS as readonly unknown[]).includes(v.seats) ? (v.seats as SeekSeats) : DEFAULT_CHOICE.seats;
  const mood = (SEEK_MOODS as readonly unknown[]).includes(v.mood) ? (v.mood as SeekMood) : DEFAULT_CHOICE.mood;
  return { games, seats, mood };
}

export function loadChoice(known: readonly string[]): BoardChoice | null {
  try {
    const raw = window.localStorage.getItem(BOARD_CHOICE_KEY);
    return raw ? sanitizeChoice(JSON.parse(raw), known) : null;
  } catch {
    return null;
  }
}

export function saveChoice(choice: BoardChoice): void {
  try {
    window.localStorage.setItem(BOARD_CHOICE_KEY, JSON.stringify(choice));
  } catch {
    // Ohne Speicher gilt die Wahl nur bis zum Neuladen.
  }
}

/** Die Vorbelegung: zuletzt gewählt, sonst die Lieblingsspiele (nur solche, die aufs Brett dürfen). */
export function startingChoice(stored: BoardChoice | null, favorites: readonly string[], known: readonly string[]): BoardChoice {
  if (stored) return stored;
  return { ...DEFAULT_CHOICE, games: favorites.filter((id) => known.includes(id)).slice(0, SEEK_MAX_GAMES) };
}
