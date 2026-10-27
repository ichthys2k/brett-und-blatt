import { cardRank, cardSuit, SUITS, type CardId } from '@brett-und-blatt/engine';

/**
 * Handbewertung für Poker (hohe Hand, 5 bis 7 Karten).
 *
 * Intern ist eine Karte eine kleine Zahl: Rang (2–14, Ass = 14) mal 4 plus Farbe (0–3).
 * Der Wert einer Hand ist eine Zahl: Je größer, desto besser. Gleiche Zahl heißt Teilung.
 * Aufbau: Kategorie · 2^20 + fünf Ränge zu je 4 Bit (wichtigster zuerst).
 */

export type Category = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

export const HIGH_CARD = 0;
export const PAIR = 1;
export const TWO_PAIR = 2;
export const TRIPS = 3;
export const STRAIGHT = 4;
export const FLUSH = 5;
export const FULL_HOUSE = 6;
export const QUADS = 7;
export const STRAIGHT_FLUSH = 8;

export const CATEGORY_NAMES: readonly string[] = ['Höchste Karte', 'Paar', 'Zwei Paare', 'Drilling', 'Straße', 'Flush', 'Full House', 'Vierling', 'Straight Flush'];

/** Karte als Zahl: Rang (2–14) · 4 + Farbe. */
export function cardCode(card: CardId): number {
  const rank = cardRank(card);
  return (rank === 1 ? 14 : rank) * 4 + SUITS.indexOf(cardSuit(card));
}

export function codeRank(code: number): number {
  return code >> 2;
}

function encode(category: number, ranks: readonly number[]): number {
  let value = category * 1_048_576;
  for (let i = 0; i < 5; i++) value += (ranks[i] ?? 0) * 16 ** (4 - i);
  return value;
}

export function categoryOf(value: number): Category {
  return Math.floor(value / 1_048_576) as Category;
}

/** Höchste Karte einer Straße in der Rang-Maske (Bit r = Rang r vorhanden), sonst 0. Ass zählt auch als 1. */
function straightHigh(mask: number): number {
  const m = mask & (1 << 14) ? mask | 2 : mask;
  for (let high = 14; high >= 5; high--) {
    if (((m >> (high - 4)) & 31) === 31) return high;
  }
  return 0;
}

/** Die höchsten `count` Ränge einer Maske, absteigend. */
function topRanks(mask: number, count: number, exclude: readonly number[] = []): number[] {
  const out: number[] = [];
  for (let r = 14; r >= 2 && out.length < count; r--) {
    if (mask & (1 << r) && !exclude.includes(r)) out.push(r);
  }
  return out;
}

/** Wert der besten 5-Karten-Hand aus 5 bis 7 Karten (als Zahlen-Codes). */
export function evaluateCodes(codes: readonly number[]): number {
  const counts = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  const suitMask = [0, 0, 0, 0];
  const suitCount = [0, 0, 0, 0];
  let rankMask = 0;
  for (const code of codes) {
    const rank = code >> 2;
    const suit = code & 3;
    counts[rank]!++;
    suitMask[suit]! |= 1 << rank;
    suitCount[suit]!++;
    rankMask |= 1 << rank;
  }

  let flush = 0;
  for (let s = 0; s < 4; s++) {
    if (suitCount[s]! >= 5) {
      const high = straightHigh(suitMask[s]!);
      if (high) return encode(STRAIGHT_FLUSH, [high]);
      flush = encode(FLUSH, topRanks(suitMask[s]!, 5));
    }
  }

  let quad = 0;
  const trips: number[] = [];
  const pairs: number[] = [];
  for (let r = 14; r >= 2; r--) {
    const c = counts[r]!;
    if (c === 4) quad = quad || r;
    else if (c === 3) trips.push(r);
    else if (c === 2) pairs.push(r);
  }

  if (quad) return encode(QUADS, [quad, ...topRanks(rankMask, 1, [quad])]);
  if (trips.length > 0 && (trips.length > 1 || pairs.length > 0)) {
    return encode(FULL_HOUSE, [trips[0]!, Math.max(trips[1] ?? 0, pairs[0] ?? 0)]);
  }
  if (flush) return flush;
  const straight = straightHigh(rankMask);
  if (straight) return encode(STRAIGHT, [straight]);
  if (trips.length > 0) return encode(TRIPS, [trips[0]!, ...topRanks(rankMask, 2, [trips[0]!])]);
  if (pairs.length >= 2) return encode(TWO_PAIR, [pairs[0]!, pairs[1]!, ...topRanks(rankMask, 1, [pairs[0]!, pairs[1]!])]);
  if (pairs.length === 1) return encode(PAIR, [pairs[0]!, ...topRanks(rankMask, 3, [pairs[0]!])]);
  return encode(HIGH_CARD, topRanks(rankMask, 5));
}

/** Wert der besten 5-Karten-Hand aus 5 bis 7 Karten. */
export function evaluate(cards: readonly CardId[]): number {
  return evaluateCodes(cards.map(cardCode));
}

/** Die beste Hand: Wert und die fünf gewerteten Karten (für die Anzeige). */
export function bestFive(cards: readonly CardId[]): { value: number; cards: CardId[] } {
  if (cards.length <= 5) return { value: evaluate(cards), cards: [...cards] };
  let best = { value: -1, cards: [] as CardId[] };
  const n = cards.length;
  for (let a = 0; a < n; a++)
    for (let b = a + 1; b < n; b++)
      for (let c = b + 1; c < n; c++)
        for (let d = c + 1; d < n; d++)
          for (let e = d + 1; e < n; e++) {
            const hand = [cards[a]!, cards[b]!, cards[c]!, cards[d]!, cards[e]!];
            const value = evaluate(hand);
            if (value > best.value) best = { value, cards: hand };
          }
  return best;
}

const SINGULAR = ['', '', 'Zwei', 'Drei', 'Vier', 'Fünf', 'Sechs', 'Sieben', 'Acht', 'Neun', 'Zehn', 'Bube', 'Dame', 'König', 'Ass'];
const PLURAL = ['', '', 'Zweien', 'Dreien', 'Vieren', 'Fünfen', 'Sechsen', 'Siebenen', 'Achten', 'Neunen', 'Zehnen', 'Buben', 'Damen', 'Könige', 'Asse'];

/** Ränge eines Werts (wichtigster zuerst). */
function ranksOf(value: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < 5; i++) out.push(Math.floor(value / 16 ** (4 - i)) % 16);
  return out;
}

/** Name einer Hand, z. B. „Zwei Paare, Damen und Siebenen“ oder „Straße bis zum König“. */
export function describeValue(value: number): string {
  const [a = 0, b = 0] = ranksOf(value);
  switch (categoryOf(value)) {
    case STRAIGHT_FLUSH:
      return a === 14 ? 'Royal Flush' : `Straight Flush bis ${upTo(a)}`;
    case QUADS:
      return `Vierling ${PLURAL[a]}`;
    case FULL_HOUSE:
      return `Full House, ${PLURAL[a]} und ${PLURAL[b]}`;
    case FLUSH:
      return `Flush mit ${SINGULAR[a]} hoch`;
    case STRAIGHT:
      return `Straße bis ${upTo(a)}`;
    case TRIPS:
      return `Drilling ${PLURAL[a]}`;
    case TWO_PAIR:
      return `Zwei Paare, ${PLURAL[a]} und ${PLURAL[b]}`;
    case PAIR:
      return `Paar ${PLURAL[a]}`;
    default:
      return `${SINGULAR[a]} hoch`;
  }
}

function upTo(rank: number): string {
  if (rank === 14) return 'zum Ass';
  if (rank === 11) return 'zum Buben';
  if (rank === 13) return 'zum König';
  if (rank === 12) return 'zur Dame';
  return `zur ${SINGULAR[rank]}`;
}
