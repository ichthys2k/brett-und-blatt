/*
 * Klassenkarte (Vorhaben #135, Schritt #151): ein Schnappschuss vom Spielstand eines Mitglieds, den die anderen Mitglieder sehen.
 * Nie der Pass selbst, keine Kennungen, keine Codes, keine Lernstände. Was hineingeht, legt die Leitung für die Klasse fest
 * (`sections`) und jedes Mitglied für sich (nur weglassen).
 */

export const CARD_STAMP_KINDS = ['first', 'win', 'win-easy', 'win-medium', 'win-hard', 'online', 'tournament'] as const;
export const CARD_SECTIONS = ['stamps', 'trophies', 'favorites', 'album', 'botRating'] as const;
export type CardSection = (typeof CARD_SECTIONS)[number];
export type CardSections = Record<CardSection, boolean>;
export const DEFAULT_CARD_SECTIONS: CardSections = { stamps: true, trophies: true, favorites: true, album: true, botRating: true };

export interface ClassCard {
  at: number;
  stamps?: { gameId: string; kinds: string[] }[];
  /** Pokale je Spiel (nur die Zahl). */
  trophies?: { gameId: string; count: number }[];
  favorites?: string[];
  /** Album-Fortschritt je Spiel (nur die Fundzahl). */
  album?: { gameId: string; count: number }[];
  /** Bot-Wertung je Spiel (nur aggregierte Zahlen). */
  botRating?: { gameId: string; rating?: number; games: number; wins?: number }[];
}

const GAME_ID = /^[a-z0-9-]{1,40}$/;
export const CARD_MAX_GAMES = 80;

/** Prüft eine empfangene Karte und lässt weg, was die Klasse nicht zeigen will. */
export function sanitizeCard(value: unknown, sections: CardSections, now: number): ClassCard | null {
  if (!value || typeof value !== 'object') return null;
  const v = value as Record<string, unknown>;
  const card: ClassCard = { at: now };
  if (sections.stamps && Array.isArray(v.stamps)) {
    card.stamps = v.stamps.slice(0, CARD_MAX_GAMES).flatMap((item) => {
      const gameId = (item as { gameId?: unknown })?.gameId;
      const kinds = (item as { kinds?: unknown })?.kinds;
      if (typeof gameId !== 'string' || !GAME_ID.test(gameId) || !Array.isArray(kinds)) return [];
      const clean = [...new Set(kinds.filter((k): k is string => typeof k === 'string' && (CARD_STAMP_KINDS as readonly string[]).includes(k)))];
      return clean.length ? [{ gameId, kinds: clean }] : [];
    });
  }
  if (sections.trophies && Array.isArray(v.trophies)) {
    card.trophies = v.trophies.slice(0, CARD_MAX_GAMES).flatMap((item) => {
      const gameId = (item as { gameId?: unknown })?.gameId;
      const count = (item as { count?: unknown })?.count;
      return typeof gameId === 'string' && GAME_ID.test(gameId) && typeof count === 'number' && Number.isInteger(count) && count > 0 && count < 100000 ? [{ gameId, count }] : [];
    });
  }
  if (sections.favorites && Array.isArray(v.favorites)) card.favorites = v.favorites.filter((id): id is string => typeof id === 'string' && GAME_ID.test(id)).slice(0, 60);
  if (sections.album && Array.isArray(v.album)) {
    card.album = v.album.slice(0, CARD_MAX_GAMES).flatMap((item) => {
      const gameId = (item as { gameId?: unknown })?.gameId;
      const count = (item as { count?: unknown })?.count;
      return typeof gameId === 'string' && GAME_ID.test(gameId) && typeof count === 'number' && Number.isInteger(count) && count >= 0 && count < 100000 ? [{ gameId, count }] : [];
    });
  }
  if (sections.botRating && Array.isArray(v.botRating)) {
    card.botRating = v.botRating.slice(0, CARD_MAX_GAMES).flatMap((item) => {
      const gameId = (item as { gameId?: unknown })?.gameId;
      const games = (item as { games?: unknown })?.games;
      const rating = (item as { rating?: unknown })?.rating;
      const wins = (item as { wins?: unknown })?.wins;
      if (typeof gameId !== 'string' || !GAME_ID.test(gameId) || typeof games !== 'number' || !Number.isInteger(games) || games < 0 || games > 100000) return [];
      const entry: { gameId: string; games: number; rating?: number; wins?: number } = { gameId, games };
      if (typeof rating === 'number' && Number.isFinite(rating) && rating >= 0 && rating <= 5000) entry.rating = Math.round(rating);
      if (typeof wins === 'number' && Number.isInteger(wins) && wins >= 0 && wins <= games) entry.wins = wins;
      return [entry];
    });
  }
  return card;
}

export function parseSections(value: unknown): Partial<CardSections> | null {
  if (!value || typeof value !== 'object') return null;
  const out: Partial<CardSections> = {};
  for (const key of CARD_SECTIONS) {
    const entry = (value as Record<string, unknown>)[key];
    if (typeof entry === 'boolean') out[key] = entry;
  }
  return out;
}

/**
 * Ermittelt Klassen-Stempel (#151): Spiele, für die alle aktuellen Mitglieder den Stempel 'first' besitzen.
 * Bedingung: mindestens zwei Mitglieder, und alle Mitglieder in der Liste müssen den Stempel 'first' im Spiel besitzen.
 */
export function classStamps(cards: readonly (ClassCard | undefined)[]): string[] {
  if (cards.length < 2) return [];
  if (cards.some((c) => !c || !Array.isArray(c.stamps))) return [];

  const candidateGames = new Set<string>();
  for (const s of cards[0]!.stamps ?? []) {
    if (s.kinds.includes('first')) candidateGames.add(s.gameId);
  }

  for (let i = 1; i < cards.length; i++) {
    const memberFirsts = new Set(
      (cards[i]!.stamps ?? []).filter((s) => s.kinds.includes('first')).map((s) => s.gameId),
    );
    for (const g of [...candidateGames]) {
      if (!memberFirsts.has(g)) candidateGames.delete(g);
    }
  }

  return [...candidateGames].sort();
}

