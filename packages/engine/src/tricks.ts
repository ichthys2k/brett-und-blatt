import { cardRank, cardSuit, type CardId, type Rank, type Suit } from './cards.js';

export type EffectiveSuit = Suit | 'TRUMP';

export interface TrickContract {
  /** Prüft, ob eine Karte in diesem Vertrag ein Trumpf ist. */
  isTrump: (card: CardId) => boolean;
  /**
   * Effektive Farbe der Karte:
   * Für Trümpfe 'TRUMP' (Bedienpflicht für Trümpfe).
   * Für Fehlfarben die Originalfarbe (C, D, H, S).
   */
  effectiveSuit: (card: CardId) => EffectiveSuit;
  /**
   * Stärke der Karte im direkten Vergleich innerhalb ihrer effektiven Farbe.
   * Höhere Zahl sticht niedrigere Zahl.
   */
  cardPower: (card: CardId) => number;
}

export interface PlayedCard {
  player: number;
  card: CardId;
}

export type Trick = PlayedCard[];

/**
 * Standard-Augenwerte für deutsche und französische Blätter (Skat, Schafkopf, Doppelkopf):
 * Ass/Sau (1): 11
 * 10: 10
 * König (13): 4
 * Dame/Ober (12): 3
 * Bube/Unter (11): 2
 * 7, 8, 9: 0
 */
export function cardEyePoints(card: CardId): number {
  const rank = cardRank(card);
  switch (rank) {
    case 1:
      return 11;
    case 10:
      return 10;
    case 13:
      return 4;
    case 12:
      return 3;
    case 11:
      return 2;
    default:
      return 0;
  }
}

/** Berechnet die Summe aller Augen eines Stichs oder einer Kartengruppe. */
export function trickPoints(cards: (CardId | PlayedCard)[]): number {
  let sum = 0;
  for (const item of cards) {
    const cid = typeof item === 'string' ? item : item.card;
    sum += cardEyePoints(cid);
  }
  return sum;
}

/**
 * Ermittelt alle legal spielbaren Karten aus der Hand für den aktuellen Stich nach Bedienpflicht.
 * - Ist der Stich leer (Ausspiel), darf jede Karte der Hand gespielt werden (sofern keine Spezialregel widerspricht).
 * - Liegt bereits mindestens eine Karte, muss die effektive Farbe der ersten Karte (Lead Suit) bedient werden,
 *   falls der Spieler mindestens eine Karte dieser effektiven Farbe auf der Hand hat.
 * - Hat der Spieler keine passende Karte, darf er jede beliebige Karte spielen (abwerfen oder stechen).
 */
export function legalCards(
  hand: CardId[],
  currentTrick: Trick,
  contract: TrickContract,
  customFilter?: (card: CardId, hand: CardId[], currentTrick: Trick) => boolean,
): CardId[] {
  if (hand.length === 0) return [];
  if (currentTrick.length === 0) {
    if (customFilter) {
      const filtered = hand.filter((c) => customFilter(c, hand, currentTrick));
      return filtered.length > 0 ? filtered : [...hand];
    }
    return [...hand];
  }

  const leadCard = currentTrick[0].card;
  const leadSuit = contract.effectiveSuit(leadCard);
  const matchingCards = hand.filter((c) => contract.effectiveSuit(c) === leadSuit);

  const candidateCards = matchingCards.length > 0 ? matchingCards : hand;
  if (customFilter) {
    const filtered = candidateCards.filter((c) => customFilter(c, hand, currentTrick));
    if (filtered.length > 0) return filtered;
  }
  return candidateCards;
}

/**
 * Ermittelt den Gewinner eines vollständigen oder teilweisen Stichs.
 * - Falls mindestens ein Trumpf im Stich liegt: Der höchste Trumpf gewinnt.
 * - Falls kein Trumpf liegt: Die höchste Karte der angespielten Erstfarbe gewinnt.
 * - Bei gleicher Stärke zweier Karten (z. B. Doppelkopf): Es gewinnt die zuerst gespielte Karte.
 */
export function trickWinner(trick: Trick, contract: TrickContract): PlayedCard {
  if (trick.length === 0) {
    throw new Error('Ein leerer Stich hat keinen Gewinner.');
  }

  const leadSuit = contract.effectiveSuit(trick[0].card);
  let best = trick[0];
  let bestIsTrump = contract.isTrump(best.card);
  let bestPower = contract.cardPower(best.card);

  for (let i = 1; i < trick.length; i++) {
    const current = trick[i];
    const currentIsTrump = contract.isTrump(current.card);
    const currentPower = contract.cardPower(current.card);

    if (currentIsTrump) {
      if (!bestIsTrump) {
        // Erster Trumpf schlägt jede Fehlkarte
        best = current;
        bestIsTrump = true;
        bestPower = currentPower;
      } else if (currentPower > bestPower) {
        // Höherer Trumpf schlägt niedrigeren Trumpf (bei Gleichstand gewinnt die frühere Karte)
        best = current;
        bestPower = currentPower;
      }
    } else if (!bestIsTrump) {
      // Beide sind keine Trümpfe: Nur Karten der angespielten Erstfarbe können stechen
      const currentSuit = contract.effectiveSuit(current.card);
      if (currentSuit === leadSuit && currentPower > bestPower) {
        best = current;
        bestPower = currentPower;
      }
    }
  }

  return best;
}

// =============================================================================
// Vertragsersteller für Skat, Schafkopf und Doppelkopf
// =============================================================================

const SKAT_JACK_POWERS: Record<Suit, number> = {
  C: 104, // Kreuz-Bube
  S: 103, // Pik-Bube
  H: 102, // Herz-Bube
  D: 101, // Karo-Bube
};

/** Fehlfarben-Rangfolge im Standardspiel: Ass(14) > 10(13) > K(12) > D(11) > 9(10) > 8(9) > 7(8). */
function standardSuitPower(rank: Rank): number {
  switch (rank) {
    case 1:
      return 14;
    case 10:
      return 13;
    case 13:
      return 12;
    case 12:
      return 11;
    case 9:
      return 10;
    case 8:
      return 9;
    case 7:
      return 8;
    default:
      return rank;
  }
}

/** Null-Rangfolge: 7(1) < 8(2) < 9(3) < 10(4) < Bube(5) < Dame(6) < König(7) < Ass(8). */
function nullSuitPower(rank: Rank): number {
  switch (rank) {
    case 7:
      return 1;
    case 8:
      return 2;
    case 9:
      return 3;
    case 10:
      return 4;
    case 11:
      return 5;
    case 12:
      return 6;
    case 13:
      return 7;
    case 1:
      return 8;
    default:
      return rank;
  }
}

/**
 * Erstellt einen TrickContract für Skat:
 * - Farbspiel: Buben (Kreuz > Pik > Herz > Karo) + Trumpffarbe (Ass > 10 > K > D > 9 > 8 > 7).
 * - Grand: Nur die vier Buben sind Trumpf.
 * - Null: Kein Trumpf, Rang 7..Ass.
 */
export function createSkatContract(type: 'suit' | 'grand' | 'null', trumpSuit?: Suit): TrickContract {
  if (type === 'null') {
    return {
      isTrump: () => false,
      effectiveSuit: (card) => cardSuit(card),
      cardPower: (card) => nullSuitPower(cardRank(card)),
    };
  }

  const isGrand = type === 'grand';

  return {
    isTrump: (card) => {
      const rank = cardRank(card);
      if (rank === 11) return true; // Buben sind immer Trumpf
      return !isGrand && cardSuit(card) === trumpSuit;
    },
    effectiveSuit: (card) => {
      const rank = cardRank(card);
      if (rank === 11) return 'TRUMP';
      if (!isGrand && cardSuit(card) === trumpSuit) return 'TRUMP';
      return cardSuit(card);
    },
    cardPower: (card) => {
      const rank = cardRank(card);
      const suit = cardSuit(card);
      if (rank === 11) {
        return SKAT_JACK_POWERS[suit];
      }
      if (!isGrand && suit === trumpSuit) {
        // Trumpffarbe unterhalb der Buben
        return 20 + standardSuitPower(rank);
      }
      return standardSuitPower(rank);
    },
  };
}

const SCHAFKOPF_OBER_POWERS: Record<Suit, number> = {
  C: 204, // Eichel-Ober
  S: 203, // Gras-Ober
  H: 202, // Herz-Ober
  D: 201, // Schellen-Ober
};

const SCHAFKOPF_UNTER_POWERS: Record<Suit, number> = {
  C: 104, // Eichel-Unter
  S: 103, // Gras-Unter
  H: 102, // Herz-Unter
  D: 101, // Schellen-Unter
};

/**
 * Erstellt einen TrickContract für Schafkopf:
 * - Sauspiel / Farbsolo: Ober > Unter > Trumpffarbe (im Sauspiel immer Herz)
 * - Wenz: Nur Unter sind Trumpf
 * - Geier: Nur Ober sind Trumpf
 * - Farbwenz: Unter + Trumpffarbe
 * - Bettel: Kein Trumpf, 7..Sau
 * - Ramsch: Ober > Unter > Herz
 */
export function createSchafkopfContract(
  type: 'sauspiel' | 'solo' | 'wenz' | 'geier' | 'farbwenz' | 'bettel' | 'ramsch',
  trumpSuit: Suit = 'H',
): TrickContract {
  if (type === 'bettel') {
    return {
      isTrump: () => false,
      effectiveSuit: (card) => cardSuit(card),
      cardPower: (card) => nullSuitPower(cardRank(card)),
    };
  }

  const effectiveTrumpSuit = type === 'sauspiel' || type === 'ramsch' ? 'H' : trumpSuit;
  const hasOber = type === 'sauspiel' || type === 'solo' || type === 'geier' || type === 'ramsch';
  const hasUnter = type === 'sauspiel' || type === 'solo' || type === 'wenz' || type === 'farbwenz' || type === 'ramsch';
  const hasSuitTrump = type === 'sauspiel' || type === 'solo' || type === 'farbwenz' || type === 'ramsch';

  return {
    isTrump: (card) => {
      const rank = cardRank(card);
      if (hasOber && rank === 12) return true;
      if (hasUnter && rank === 11) return true;
      return hasSuitTrump && cardSuit(card) === effectiveTrumpSuit;
    },
    effectiveSuit: (card) => {
      const rank = cardRank(card);
      if (hasOber && rank === 12) return 'TRUMP';
      if (hasUnter && rank === 11) return 'TRUMP';
      if (hasSuitTrump && cardSuit(card) === effectiveTrumpSuit) return 'TRUMP';
      return cardSuit(card);
    },
    cardPower: (card) => {
      const rank = cardRank(card);
      const suit = cardSuit(card);
      if (hasOber && rank === 12) return SCHAFKOPF_OBER_POWERS[suit];
      if (hasUnter && rank === 11) return SCHAFKOPF_UNTER_POWERS[suit];
      if (hasSuitTrump && suit === effectiveTrumpSuit) {
        return 20 + standardSuitPower(rank);
      }
      return standardSuitPower(rank);
    },
  };
}

const DOKO_QUEEN_POWERS: Record<Suit, number> = {
  C: 204, // Kreuz-Dame
  S: 203, // Pik-Dame
  H: 202, // Herz-Dame
  D: 201, // Karo-Dame
};

const DOKO_JACK_POWERS: Record<Suit, number> = {
  C: 104, // Kreuz-Bube
  S: 103, // Pik-Bube
  H: 102, // Herz-Bube
  D: 101, // Karo-Bube
};

/**
 * Erstellt einen TrickContract für Doppelkopf:
 * - Normalspiel: Herz-10 (Dulle) > Damen > Buben > Karo (Ass, 10, K, 9)
 * - Damensolo: Nur Damen sind Trumpf
 * - Bubensolo: Nur Buben sind Trumpf
 * - Farbsolo: Dulle > Damen > Buben > gewählte Trumpffarbe
 * - Fleischloser: Kein Trumpf, Rang Ass > 10 > König > Dame > Bube > 9
 */
export function createDokoContract(
  type: 'normal' | 'damensolo' | 'bubensolo' | 'farbsolo' | 'fleischlos',
  trumpSuit: Suit = 'D',
): TrickContract {
  if (type === 'fleischlos') {
    return {
      isTrump: () => false,
      effectiveSuit: (card) => cardSuit(card),
      cardPower: (card) => standardSuitPower(cardRank(card)),
    };
  }

  if (type === 'damensolo') {
    return {
      isTrump: (card) => cardRank(card) === 12,
      effectiveSuit: (card) => (cardRank(card) === 12 ? 'TRUMP' : cardSuit(card)),
      cardPower: (card) => (cardRank(card) === 12 ? DOKO_QUEEN_POWERS[cardSuit(card)] : standardSuitPower(cardRank(card))),
    };
  }

  if (type === 'bubensolo') {
    return {
      isTrump: (card) => cardRank(card) === 11,
      effectiveSuit: (card) => (cardRank(card) === 11 ? 'TRUMP' : cardSuit(card)),
      cardPower: (card) => (cardRank(card) === 11 ? DOKO_JACK_POWERS[cardSuit(card)] : standardSuitPower(cardRank(card))),
    };
  }

  const effectiveTrumpSuit = type === 'normal' ? 'D' : trumpSuit;

  return {
    isTrump: (card) => {
      const rank = cardRank(card);
      const suit = cardSuit(card);
      if (suit === 'H' && rank === 10) return true; // Dulle
      if (rank === 12 || rank === 11) return true; // Damen und Buben
      return suit === effectiveTrumpSuit;
    },
    effectiveSuit: (card) => {
      const rank = cardRank(card);
      const suit = cardSuit(card);
      if (suit === 'H' && rank === 10) return 'TRUMP';
      if (rank === 12 || rank === 11) return 'TRUMP';
      if (suit === effectiveTrumpSuit) return 'TRUMP';
      return suit;
    },
    cardPower: (card) => {
      const rank = cardRank(card);
      const suit = cardSuit(card);
      if (suit === 'H' && rank === 10) return 300; // Dulle ist höchster Trumpf
      if (rank === 12) return DOKO_QUEEN_POWERS[suit];
      if (rank === 11) return DOKO_JACK_POWERS[suit];
      if (suit === effectiveTrumpSuit) {
        return 20 + standardSuitPower(rank);
      }
      return standardSuitPower(rank);
    },
  };
}
