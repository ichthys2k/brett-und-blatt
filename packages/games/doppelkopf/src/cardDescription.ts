import {
  cardEyePoints,
  cardRank,
  cardSuit,
  SUIT_NAMES,
  type CardId,
  type Suit,
} from '@brett-und-blatt/engine';
import type { DokoContract, DokoState } from './rules';

export type DoppelkopfStateLike = {
  phase: string;
  contract?: DokoContract | null;
};

const QUEEN_NAMES: Record<Suit, { name: string; title: string }> = {
  C: { name: 'Kreuz-Dame', title: 'Spitzentrumpf (Die Alte / Re-Partei)' },
  S: { name: 'Pik-Dame', title: 'Trumpf (Die Blaue / Pik-Dame)' },
  H: { name: 'Herz-Dame', title: 'Trumpf (Herz-Dame)' },
  D: { name: 'Karo-Dame', title: 'Trumpf (Karo-Dame)' },
};

const JACK_NAMES: Record<Suit, string> = {
  C: 'Trumpf (Karlchen / Kreuz-Bube)',
  S: 'Trumpf (Pik-Bube)',
  H: 'Trumpf (Herz-Bube)',
  D: 'Trumpf (Karo-Bube)',
};

/**
 * Liefert eine dynamische, aussagekräftige Spielbeschreibung für eine Karte im Doppelkopf
 * je nach aktuellem Spielzustand und Kontrakt (Normalspiel, Damensolo, Bubensolo etc.).
 */
export function doppelkopfCardDescription(card: CardId, state?: DoppelkopfStateLike): string {
  const suit = cardSuit(card);
  const rank = cardRank(card);
  const eyes = cardEyePoints(card);
  const eyeText = eyes === 0 ? '0 Augen' : `${eyes} ${eyes === 1 ? 'Auge' : 'Augen'}`;
  const suitName = SUIT_NAMES[suit];

  const contract = state?.contract ?? { type: 'normal' as const };
  const { type: contractType } = contract;

  // 1. Fleischlos (kein Trumpf)
  if (contractType === 'fleischlos') {
    return `Fleischlos: Kein Trumpf · ${eyeText}`;
  }

  // 2. Damensolo (nur Damen sind Trumpf)
  if (contractType === 'damensolo') {
    if (rank === 12) {
      const q = QUEEN_NAMES[suit];
      return `Trumpf (${q?.name ?? 'Dame'}) · 3 Augen`;
    }
    return `Fehlfarbe (${suitName}) · ${eyeText}`;
  }

  // 3. Bubensolo (nur Buben sind Trumpf)
  if (contractType === 'bubensolo') {
    if (rank === 11) {
      const j = JACK_NAMES[suit];
      return `${j ?? 'Trumpf-Bube'} · 2 Augen`;
    }
    return `Fehlfarbe (${suitName}) · ${eyeText}`;
  }

  // 4. Farbsolo (Dulle + Damen + Buben + gewählte Trumpffarbe)
  if (contractType === 'farbsolo') {
    const trumpSuit = contract.trumpSuit ?? 'D';
    if (suit === 'H' && rank === 10) return 'Höchster Trumpf (Dulle / Herz 10) · 10 Augen';
    if (rank === 12) return `${QUEEN_NAMES[suit]?.title ?? 'Trumpf-Dame'} · 3 Augen`;
    if (rank === 11) return `${JACK_NAMES[suit] ?? 'Trumpf-Bube'} · 2 Augen`;
    if (suit === trumpSuit) {
      if (rank === 1) return `Höchster Farbtrumpf (${suitName}-Ass) · 11 Augen`;
      return `Trumpffarbe (${suitName}) · ${eyeText}`;
    }
    return `Fehlfarbe (${suitName}) · ${eyeText}`;
  }

  // 5. Normalspiel (Dulle + Damen + Buben + Karo)
  if (suit === 'H' && rank === 10) {
    return 'Höchster Trumpf (Dulle / Herz 10) · 10 Augen';
  }
  if (rank === 12) {
    return `${QUEEN_NAMES[suit]?.title ?? 'Trumpf-Dame'} · 3 Augen`;
  }
  if (rank === 11) {
    return `${JACK_NAMES[suit] ?? 'Trumpf-Bube'} · 2 Augen`;
  }
  if (suit === 'D') {
    if (rank === 1) return 'Höchster Farbtrumpf (Karo-Ass) · 11 Augen';
    if (rank === 10) return 'Farbtrumpf (Karo 10) · 10 Augen';
    if (rank === 13) return 'Farbtrumpf (Karo-König) · 4 Augen';
    return `Trumpf (Karo) · ${eyeText}`;
  }

  return `Fehlfarbe (${suitName}) · ${eyeText}`;
}
