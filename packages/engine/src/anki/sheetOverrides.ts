import { cardRank, cardSuit, isJoker, type CardId, type DeckStyle, type Suit } from '../cards';
import { BUB_PLAYING_CARD_NOTETYPE_ID } from './gameNotetypes';
import type { AnkiCollection, AnkiNote } from './types';

/**
 * Benutzerdefinierte Kartengestaltung aus einem Anki-Spielblatt-Paket.
 */
export interface PlayingCardOverride {
  kennung: string;
  name?: string;
  image?: string;
  frame?: string;
  description?: string;
  points?: string;
  rank?: string;
  suit?: string;
  ankiFront?: {
    html: string;
    scopedCss?: string;
  };
}

const FRENCH_SUIT_KEYS: Record<Suit, string> = {
  H: 'hearts',
  D: 'diamonds',
  C: 'clubs',
  S: 'spades',
};

const BAVARIAN_SUIT_KEYS: Record<Suit, string> = {
  H: 'herz',
  D: 'schellen',
  C: 'eichel',
  S: 'gras',
};

const FRENCH_RANK_KEYS: Record<number, string> = {
  1: 'A',
  13: 'K',
  12: 'D',
  11: 'B',
};

const BAVARIAN_RANK_KEYS: Record<number, string> = {
  1: 'A',
  13: 'K',
  12: 'O',
  11: 'U',
};

/**
 * Erzeugt die offizielle Anki-Kennung (z. B. "fr:hearts-A" oder "by:schellen-O")
 * für eine CardId und einen DeckStyle.
 */
export function cardToKennung(card: CardId, deckStyle: DeckStyle = 'four-color'): string {
  const isGermanic = deckStyle === 'bavarian' || deckStyle === 'german';

  if (isJoker(card)) {
    return isGermanic ? 'by:joker' : 'fr:joker';
  }

  const suit = cardSuit(card);
  const rank = cardRank(card);

  if (isGermanic) {
    const suitKey = BAVARIAN_SUIT_KEYS[suit] ?? 'herz';
    const rankKey = BAVARIAN_RANK_KEYS[rank] ?? String(rank);
    return `by:${suitKey}-${rankKey}`;
  }

  const suitKey = FRENCH_SUIT_KEYS[suit] ?? 'hearts';
  const rankKey = FRENCH_RANK_KEYS[rank] ?? String(rank);
  return `fr:${suitKey}-${rankKey}`;
}

/**
 * Liefert eine geordnete Liste von Kennungs-Kandidaten (primäre Kennung zuerst,
 * dann das Gegenstück des anderen Blatt-Typs als Fallback).
 */
export function cardKennungCandidates(card: CardId, deckStyle: DeckStyle = 'four-color'): string[] {
  const primary = cardToKennung(card, deckStyle);
  const isGermanic = deckStyle === 'bavarian' || deckStyle === 'german';
  const alternate = cardToKennung(card, isGermanic ? 'french' : 'bavarian');
  return primary === alternate ? [primary] : [primary, alternate];
}

/**
 * Extrahiert den Bildpfad oder Bildnamen aus einem HTML-Bildfeld oder Text.
 */
export function extractImageRef(fieldValue: string): string {
  const trimmed = fieldValue.trim();
  if (!trimmed) return '';
  const match = trimmed.match(/<img[^>]+src=["']([^"']+)["']/i);
  if (match && match[1]) {
    return match[1].trim();
  }
  return trimmed;
}

/**
 * Extrahiert aus einer AnkiCollection alle benutzerdefinierten Spielblatt-Notizen
 * als Map von Kennung auf PlayingCardOverride.
 */
export function extractPlayingCardOverrides(
  collection: AnkiCollection,
  options: {
    mediaResolver?: (filename: string) => string | null;
  } = {},
): Record<string, PlayingCardOverride> {
  const overrides: Record<string, PlayingCardOverride> = {};
  const { mediaResolver } = options;

  for (const note of collection.notes) {
    const isPlayingCardNote =
      note.mid === BUB_PLAYING_CARD_NOTETYPE_ID ||
      note.tags.includes('spielblatt') ||
      (typeof note.fields[0] === 'string' && (note.fields[0].startsWith('fr:') || note.fields[0].startsWith('by:')));

    if (!isPlayingCardNote || !note.fields[0]) continue;

    const kennung = note.fields[0].trim();
    if (!kennung) continue;

    const rawName = note.fields[4]?.trim();
    const rawImage = note.fields[7]?.trim();
    const rawFrame = note.fields[8]?.trim();
    const rawDesc = note.fields[10]?.trim();
    const rawPoints = note.fields[9]?.trim();

    let resolvedImage: string | undefined;
    if (rawImage) {
      const imgRef = extractImageRef(rawImage);
      if (mediaResolver) {
        resolvedImage = mediaResolver(imgRef) ?? imgRef;
      } else {
        resolvedImage = imgRef;
      }
    }

    overrides[kennung] = {
      kennung,
      name: rawName || undefined,
      image: resolvedImage || undefined,
      frame: rawFrame || undefined,
      description: rawDesc || undefined,
      points: rawPoints || undefined,
    };
  }

  return overrides;
}
