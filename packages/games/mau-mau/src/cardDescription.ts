import {
  cardRank,
  cardSuit,
  SUIT_NAMES,
  type CardId,
  type Suit,
} from '@brett-und-blatt/engine';
import type { MauMauOptions, MauMauState } from './types';

export type MauMauStateLike = {
  options?: Partial<MauMauOptions>;
  pendingDraw?: number;
  activeSuit?: Suit;
};

/**
 * Liefert eine dynamische Funktionsbeschreibung für eine Karte im Mau-Mau
 * unter Berücksichtigung der aktiven Tisch-Optionen und Spielsituation.
 */
export function mauMauCardDescription(card: CardId, state?: MauMauStateLike): string {
  const suit = cardSuit(card);
  const rank = cardRank(card);
  const suitName = SUIT_NAMES[suit];
  const options = state?.options ?? {};
  const pending = state?.pendingDraw ?? 0;

  // 7er-Regel
  if (rank === 7) {
    if (pending > 0) {
      return `+${pending + 2} ziehen (oder mit 7 weitergeben)`;
    }
    const canStack = options.sevenStack !== 'off';
    return `7: Nächster Spieler zieht 2 Karten${canStack ? ' (kann mit 7 weitergeben)' : ''}`;
  }

  // 8er-Regel
  if (rank === 8) {
    return '8: Nächster Spieler setzt aus';
  }

  // 9er-Regel
  if (rank === 9) {
    if (options.nineReverse !== 'off') {
      return '9: Richtungswechsel (Spielrichtung dreht um)';
    }
    return `Farbe (${suitName}) oder Rang bedienen`;
  }

  // Ass-Regel
  if (rank === 1) {
    if (options.aceExtraTurn === 'on') {
      return 'Ass: Nochmal am Zug (eine weitere Karte legen)';
    }
    return `Farbe (${suitName}) oder Rang bedienen`;
  }

  // Bube
  if (rank === 11) {
    const onAll = options.jackOnEverything !== 'off';
    return `Bube: Farbe wünschen${onAll ? ' (auf jede Karte legbar)' : ''}`;
  }

  return `Farbe (${suitName}) oder Rang bedienen`;
}
