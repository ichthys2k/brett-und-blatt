import type { OptionSpec } from './types';
/**
 * Französisches Blatt für die Regeln: Karten sind kurze Texte wie „H7.1“
 * (Herz 7 aus dem ersten Kartenspiel). So bleiben Spielstände reines JSON,
 * und Spiele mit mehreren Kartenspielen (Spider) haben trotzdem eindeutige Karten.
 */
export type Suit = 'C' | 'D' | 'H' | 'S';

/** Kreuz, Karo, Herz, Pik. */
export const SUITS: Suit[] = ['C', 'D', 'H', 'S'];

export const SUIT_NAMES: Record<Suit, string> = { C: 'Kreuz', D: 'Karo', H: 'Herz', S: 'Pik' };

/** Ass = 1, Bube = 11, Dame = 12, König = 13. */
export type Rank = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13;

export type CardId = string;

export function cardId(suit: Suit, rank: number, copy = 1): CardId {
  return `${suit}${rank}.${copy}`;
}

export function cardSuit(card: CardId): Suit {
  return card[0] as Suit;
}

export function cardRank(card: CardId): Rank {
  return Number(card.slice(1, card.indexOf('.'))) as Rank;
}

export function isRed(card: CardId): boolean {
  const suit = cardSuit(card);
  return suit === 'H' || suit === 'D';
}

export const RANK_LABELS: Record<number, string> = { 1: 'A', 11: 'B', 12: 'D', 13: 'K' };

export function rankLabel(rank: number): string {
  return RANK_LABELS[rank] ?? String(rank);
}

const RANK_NAMES: Record<number, string> = { 1: 'Ass', 11: 'Bube', 12: 'Dame', 13: 'König' };

/** Name für Screenreader, z. B. „Herz Dame“. */
export function cardName(card: CardId): string {
  const rank = cardRank(card);
  return `${SUIT_NAMES[cardSuit(card)]} ${RANK_NAMES[rank] ?? rank}`;
}

/** Ein oder mehrere Kartenspiele zu 52 Karten, optional nur mit bestimmten Farben (Spider). */
export function createDeck(copies = 1, suits: Suit[] = SUITS): CardId[] {
  const deck: CardId[] = [];
  for (let copy = 1; copy <= copies; copy++) {
    for (const suit of suits) {
      for (let rank = 1; rank <= 13; rank++) deck.push(cardId(suit, rank, copy));
    }
  }
  return deck;
}

/** Kartenbild: Turnierblatt (vierfarbig), französisch, deutsch, einfache Farben (wie Uno) – `bavarian` nur für Altbestand. */
export type DeckStyle = 'french' | 'four-color' | 'bavarian' | 'german' | 'simple';

/** Gemeinsame Auswahl „Kartenbild“ für alle Spiele mit Kartenblatt. */
export const DECK_STYLE_CHOICES: { value: DeckStyle; label: string }[] = [
  { value: 'four-color', label: 'Turnierblatt (vierfarbig)' },
  { value: 'french', label: 'Französisches Blatt (rot/schwarz)' },
  { value: 'german', label: 'Deutsches Blatt (Eichel/Gras/Herz/Schellen)' },
  { value: 'simple', label: 'Einfache Farben (blau/gelb/rot/grün)' },
];

/** Standard in allen Spielen: das Turnierblatt. */
export const DEFAULT_DECK_STYLE: DeckStyle = 'four-color';

/** Liest einen Optionswert als Kartenbild; Unbekanntes ergibt das Turnierblatt, „bayerisch“ das deutsche Blatt. */
export function parseDeckStyle(value: unknown): DeckStyle {
  if (value === 'bavarian') return 'german';
  return DECK_STYLE_CHOICES.some((c) => c.value === value) ? (value as DeckStyle) : DEFAULT_DECK_STYLE;
}

/** Fertige Option „Kartenbild“ für `GameModule.options`. */
export function deckStyleOption(id = 'deckStyle'): OptionSpec {
  return { id, label: 'Kartenbild', choices: DECK_STYLE_CHOICES, default: DEFAULT_DECK_STYLE };
}
