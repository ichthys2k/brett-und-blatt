import type { CardId, SeatId, Suit } from '@brett-und-blatt/engine';

export type BinokelPhase =
  | 'deal'
  | 'bidding'
  | 'dabbDecision'
  | 'trumpChoice'
  | 'meld'
  | 'play'
  | 'scoring';

export type MeldType =
  | 'pair'
  | 'trumpPair'
  | 'family'
  | 'trumpFamily'
  | 'round'
  | 'doubleTrumpFamily'
  | 'fourAces'
  | 'fourKings'
  | 'fourQueens'
  | 'fourJacks'
  | 'eightOfRank'
  | 'binokel'
  | 'doubleBinokel'
  | 'dissle';

export interface DeclaredMeld {
  type: MeldType;
  cards: CardId[];
  points: number;
  owner: SeatId;
}

export interface BidEntry {
  player: SeatId;
  value: number | 'pass';
}

export interface DurchInfo {
  variant: 'simple' | 'open' | 'hand';
  from: SeatId;
}

export interface BinokelOptions {
  tableSize?: '3' | '4' | '4-partner';
  deckSize?: 40 | 48;
  cardStyle?: 'swabian' | 'french-four-color';
  minBid?: 150 | 200 | 250 | 300;
  targetScore?: 1000 | 1500;
  allowDurch?: boolean | string;
  foldCompensation?: 'fifty' | 'half' | 'none';
  helpMeld?: boolean;
  helpLegals?: boolean;
  countEyes?: boolean;
}

export type BinokelMove =
  | { type: 'bid'; value: number }
  | { type: 'pass' }
  | { type: 'takeDabb' }
  | { type: 'discard'; cards: CardId[] }
  | { type: 'declareTrump'; suit: Suit }
  | { type: 'declareDurch'; variant: 'simple' | 'open' | 'hand' }
  | { type: 'fold' }
  | { type: 'confirmMelds'; melds: DeclaredMeld[] }
  | { type: 'play'; card: CardId };

export interface BinokelState {
  phase: BinokelPhase;
  options: Required<BinokelOptions>;
  seats: SeatId[];
  dealerSeat: SeatId;
  hands: Record<SeatId, CardId[]>;
  dabb: CardId[];
  dabbRevealed: boolean;
  declarer: SeatId | null;
  highestBid: number | null;
  bidHistory: BidEntry[];
  passed: Set<SeatId>;
  trumpSuit: Suit | null;
  isDurch: DurchInfo | false;
  pressedCards: Record<SeatId, CardId[]>;
  melds: DeclaredMeld[];
  meldPointsDeclared: Record<SeatId, number>;
  meldPointsScored: Record<SeatId, number>;
  stichMade: Record<SeatId, boolean>;
  trickCards: { player: SeatId; card: CardId }[];
  tricksWon: Record<SeatId, CardId[][]>;
  trickPoints: Record<SeatId, number>;
  lastTrick: { player: SeatId; card: CardId }[] | null;
  lastTrickWinner: SeatId | null;
  scores: Record<SeatId, number>;
  roundScores: Record<SeatId, number>;
  gameEnded: boolean;
  winner: SeatId | null;
  log: string[];
}

export type { CardId, SeatId, Suit };
