import type { CardId, DeckStyle } from '@brett-und-blatt/engine';

/** Ein Stapel mit verdeckten Karten unten und offenen darüber. In der Sicht sind verdeckte Karten null. */
export interface Pile {
  down: (CardId | null)[];
  up: CardId[];
}

interface Base {
  deckStyle?: DeckStyle;
  moveCount: number;
  lastMove: SolitaireMove | null;
}

export interface KlondikeState extends Base {
  variant: 'klondike';
  draw: 1 | 3;
  tableau: Pile[];
  /** Ablagen je Farbe (Reihenfolge wie SUITS), aufsteigend vom Ass. */
  foundations: CardId[][];
  /** Talon; die oberste Karte ist das letzte Element. In der Sicht null. */
  stock: (CardId | null)[];
  waste: CardId[];
}

export interface FreeCellState extends Base {
  variant: 'freecell';
  tableau: CardId[][];
  cells: (CardId | null)[];
  foundations: CardId[][];
}

export interface SpiderState extends Base {
  variant: 'spider';
  suits: 1 | 2 | 4;
  tableau: Pile[];
  stock: (CardId | null)[];
  /** Abgelegte vollständige Folgen (je die Farbe des Königs). */
  completed: CardId[];
}

export interface PyramidState extends Base {
  variant: 'pyramid';
  /** 28 Plätze, Reihe r hat r+1 Karten: Index = r(r+1)/2 + i. Entfernte Karten sind null. */
  pyramid: (CardId | null)[];
  stock: (CardId | null)[];
  waste: CardId[];
  /** Wie oft die Ablage schon wieder zum Talon wurde (höchstens zweimal). */
  recycles: number;
}

export type SolitaireState = KlondikeState | FreeCellState | SpiderState | PyramidState;

export type Loc = { kind: 'tableau'; index: number } | { kind: 'foundation'; index: number } | { kind: 'waste' } | { kind: 'cell'; index: number };

export type PyramidLoc = { kind: 'pyramid'; index: number } | { kind: 'waste' };

export type SolitaireMove =
  /** Karte bzw. Folge verschieben. */
  | { type: 'move'; from: Loc; to: Loc; count: number }
  /** Talon: Klondike zieht 1 oder 3 Karten, Spider teilt eine Reihe aus, Pyramide zieht eine Karte. */
  | { type: 'draw' }
  /** Ablage zurück in den Talon. */
  | { type: 'recycle' }
  /** Pyramide: zwei Karten mit zusammen 13 – oder ein König allein. */
  | { type: 'pair'; cards: PyramidLoc[] };

export function sameLoc(a: Loc | PyramidLoc, b: Loc | PyramidLoc): boolean {
  return a.kind === b.kind && ('index' in a ? a.index : -1) === ('index' in b ? b.index : -1);
}
