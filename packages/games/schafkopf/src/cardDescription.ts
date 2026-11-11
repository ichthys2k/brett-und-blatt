import {
  cardEyePoints,
  cardRank,
  cardSuit,
  SUIT_NAMES,
  type CardId,
  type Suit,
} from '@brett-und-blatt/engine';
import type { SchafkopfContract, SchafkopfState } from './rules';

export type SchafkopfStateLike = {
  phase: string;
  contract?: SchafkopfContract | null;
};

const BAVARIAN_SUIT_NAMES: Record<Suit, string> = {
  C: 'Eichel',
  S: 'Gras',
  H: 'Herz',
  D: 'Schellen',
};

const OBER_NAMES: Record<Suit, string> = {
  C: 'Höchster Trumpf (Der Alte / Eichel-Ober)',
  S: 'Zweithöchster Trumpf (Der Blaue / Gras-Ober)',
  H: 'Dritthöchster Trumpf (Der Rote / Herz-Ober)',
  D: 'Vierthöchster Trumpf (Der Runde / Schellen-Ober)',
};

const UNTER_NAMES: Record<Suit, string> = {
  C: 'Eichel-Unter',
  S: 'Gras-Unter',
  H: 'Herz-Unter',
  D: 'Schellen-Unter',
};

/**
 * Liefert eine dynamische, aussagekräftige Spielbeschreibung für eine Karte im Schafkopf
 * je nach aktuellem Spielzustand und Spielansage (Sauspiel, Wenz, Solo etc.).
 */
export function schafkopfCardDescription(card: CardId, state?: SchafkopfStateLike): string {
  const suit = cardSuit(card);
  const rank = cardRank(card);
  const eyes = cardEyePoints(card);
  const eyeText = eyes === 0 ? '0 Augen' : `${eyes} ${eyes === 1 ? 'Auge' : 'Augen'}`;
  const suitName = BAVARIAN_SUIT_NAMES[suit] ?? SUIT_NAMES[suit];

  const contract = state?.contract ?? { gameType: 'sauspiel' as const };
  const { gameType } = contract;

  // Bettel
  if (gameType === 'bettel') {
    return `Bettel: Kein Trumpf · ${eyeText}`;
  }

  // Ramsch
  if (gameType === 'ramsch') {
    if (rank === 12) return `${OBER_NAMES[suit]} · ${eyeText} (Augen meiden!)`;
    if (rank === 11) return `Trumpf (${UNTER_NAMES[suit]}) · ${eyeText} (Augen meiden!)`;
    if (suit === 'H') return `Trumpf (Herz) · ${eyeText} (Augen meiden!)`;
    return `Fehlfarbe (${suitName}) · ${eyeText}`;
  }

  // Wenz: Nur Unter sind Trumpf!
  if (gameType === 'wenz') {
    if (rank === 11) {
      const pos =
        suit === 'C'
          ? 'Höchster Trumpf'
          : suit === 'S'
            ? 'Zweithöchster Trumpf'
            : suit === 'H'
              ? 'Dritthöchster Trumpf'
              : 'Vierthöchster Trumpf';
      return `${pos} (${UNTER_NAMES[suit]}) · 2 Augen`;
    }
    return `Fehlfarbe (${suitName}) · ${eyeText}`;
  }

  // Geier: Nur Ober sind Trumpf!
  if (gameType === 'geier') {
    if (rank === 12) {
      return `${OBER_NAMES[suit]} · 3 Augen`;
    }
    return `Fehlfarbe (${suitName}) · ${eyeText}`;
  }

  // Farbwenz: Unter + Trumpffarbe
  if (gameType === 'farbwenz') {
    const trumpSuit = contract.trumpSuit ?? 'H';
    if (rank === 11) return `Trumpf (${UNTER_NAMES[suit]}) · 2 Augen`;
    if (suit === trumpSuit) return `Trumpf (${suitName}) · ${eyeText}`;
    return `Fehlfarbe (${suitName}) · ${eyeText}`;
  }

  // Solo: Ober + Unter + Trumpffarbe
  if (gameType === 'solo') {
    const trumpSuit = contract.trumpSuit ?? 'H';
    if (rank === 12) return `${OBER_NAMES[suit]} · 3 Augen`;
    if (rank === 11) return `Trumpf (${UNTER_NAMES[suit]}) · 2 Augen`;
    if (suit === trumpSuit) {
      if (rank === 1) return `Höchster Farbtrumpf (${suitName}-Sau) · 11 Augen`;
      return `Trumpffarbe (${suitName}) · ${eyeText}`;
    }
    return `Fehlfarbe (${suitName}) · ${eyeText}`;
  }

  // Sauspiel (Normalspiel)
  if (gameType === 'sauspiel' || !contract) {
    if (rank === 12) return `${OBER_NAMES[suit]} · 3 Augen`;
    if (rank === 11) return `Trumpf (${UNTER_NAMES[suit]}) · 2 Augen`;
    if (suit === 'H') {
      if (rank === 1) return 'Höchster Farbtrumpf (Herz-Sau) · 11 Augen';
      if (rank === 10) return 'Zweithöchster Farbtrumpf (Herz 10) · 10 Augen';
      return `Trumpf (Herz) · ${eyeText}`;
    }

    // Gerufene Sau prüfen
    if (contract?.calledSuit && suit === contract.calledSuit && rank === 1) {
      return `Gerufene Sau (Partnerkarte / ${suitName}-Sau) · 11 Augen`;
    }

    return `Fehlfarbe (${suitName}) · ${eyeText}`;
  }

  return `${suitName} · ${eyeText}`;
}
