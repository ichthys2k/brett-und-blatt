import {
  cardEyePoints,
  cardRank,
  cardSuit,
  SUIT_NAMES,
  type CardId,
  type Suit,
} from '@brett-und-blatt/engine';
import type { SkatDeclaration, SkatState } from './rules';

export type SkatStateLike = {
  phase: string;
  declaration?: SkatDeclaration | null;
};

const JACK_RANKS: Record<Suit, { name: string; pos: string }> = {
  C: { name: 'Kreuz-Bube', pos: 'Höchster Trumpf (Der Alte)' },
  S: { name: 'Pik-Bube', pos: 'Zweithöchster Trumpf' },
  H: { name: 'Herz-Bube', pos: 'Dritthöchster Trumpf' },
  D: { name: 'Karo-Bube', pos: 'Vierthöchster Trumpf' },
};

/**
 * Liefert eine dynamische, aussagekräftige Spielbeschreibung für eine Karte im Skat
 * je nach aktuellem Spielzustand und Deklaration (Farbspiel, Grand, Null).
 */
export function skatCardDescription(card: CardId, state?: SkatStateLike): string {
  const suit = cardSuit(card);
  const rank = cardRank(card);
  const eyes = cardEyePoints(card);
  const eyeText = eyes === 0 ? '0 Augen (Lusche)' : `${eyes} ${eyes === 1 ? 'Auge' : 'Augen'}`;
  const suitName = SUIT_NAMES[suit];

  const decl = state?.declaration;

  // 1. Nullspiel: kein Trumpf, Augen zählen nicht (nur Stechen zählt)
  if (decl?.gameType === 'null') {
    return `Nullspiel: Kein Trumpf · ${eyes} Augen`;
  }

  // 2. Grand: nur die 4 Buben sind Trümpfe
  if (decl?.gameType === 'grand') {
    if (rank === 11) {
      const jackInfo = JACK_RANKS[suit];
      return `${jackInfo?.pos ?? 'Trumpf-Bube'} · 2 Augen`;
    }
    return `Fehlfarbe (${suitName}) · ${eyeText}`;
  }

  // 3. Farbspiel (Kreuz, Pik, Herz oder Karo ist Trumpf)
  if (decl?.gameType) {
    const trumpSuit = decl.gameType as Suit;
    if (rank === 11) {
      const jackInfo = JACK_RANKS[suit];
      return `${jackInfo?.pos ?? 'Trumpf-Bube'} · 2 Augen`;
    }
    if (suit === trumpSuit) {
      if (rank === 1) return `Höchste Farbkarte im Trumpf (Ass) · 11 Augen`;
      if (rank === 10) return `Zweithöchste Farbkarte im Trumpf (10) · 10 Augen`;
      return `Trumpffarbe (${suitName}) · ${eyeText}`;
    }
    return `Fehlfarbe (${suitName}) · ${eyeText}`;
  }

  // 4. Vor der Deklaration (z. B. Reizphase): Standard-Info mit Buben-Hinweis
  if (rank === 11) {
    const jackInfo = JACK_RANKS[suit];
    return `${jackInfo?.name ?? 'Bube'} (möglicher Spitzentrumpf) · 2 Augen`;
  }
  return `${suitName} · ${eyeText}`;
}
