/*
 * Klassenkarte (Vorhaben #135, Schritt #151): ein Schnappschuss vom Spielstand eines Mitglieds, den die anderen Mitglieder sehen.
 * Nie der Pass selbst, keine Kennungen, keine Codes, keine Lernstände. Was hineingeht, legt die Leitung für die Klasse fest
 * (`sections`) und jedes Mitglied für sich (nur weglassen).
 */

export const CARD_STAMP_KINDS = ['first', 'win', 'win-easy', 'win-medium', 'win-hard', 'online', 'tournament'] as const;
export const CARD_SECTIONS = ['stamps', 'trophies', 'favorites'] as const;
export type CardSection = (typeof CARD_SECTIONS)[number];
export type CardSections = Record<CardSection, boolean>;
export const DEFAULT_CARD_SECTIONS: CardSections = { stamps: true, trophies: true, favorites: true };

export interface ClassCard {
  at: number;
  stamps?: { gameId: string; kinds: string[] }[];
  /** Pokale je Spiel (nur die Zahl). */
  trophies?: { gameId: string; count: number }[];
  favorites?: string[];
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
