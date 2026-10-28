import type { CardId, RngState, Suit } from '@brett-und-blatt/engine';

/** Darstellung des Blattes. Die Regeln arbeiten immer mit den französischen Farben C/D/H/S. */
export type MauMauDeckStyle = 'french' | 'four-color' | 'german';

export interface MauMauOptions {
  deckStyle: MauMauDeckStyle;
  /** 7 auf 7 legen und die Strafkarten weiterreichen. */
  sevenStack: 'on' | 'off';
  /** 9 kehrt die Spielrichtung um (bei zwei Spielern: aussetzen). */
  nineReverse: 'on' | 'off';
  /** Ass: Der Spieler darf noch eine Karte legen. */
  aceExtraTurn: 'on' | 'off';
  /** Bube darf auf jede Karte gelegt werden und wünscht eine Farbe. */
  jackOnEverything: 'on' | 'off';
  /** Darf ein Bube auf einen Buben gelegt werden? */
  jackOnJack: 'forbidden' | 'allowed';
  /** Muss vor der letzten Karte „Mau!“ gerufen werden? */
  mauCall: 'on' | 'off';
  /** Nachziehen: genau eine Karte oder so lange, bis eine passende kommt. */
  drawRule: 'one' | 'untilMatch';
}

export interface MauMauState {
  options: MauMauOptions;
  hands: CardId[][];
  stock: CardId[];
  discard: CardId[];
  /** Farbe, die nach einem Buben gilt (oder die Farbe der obersten Karte). */
  activeSuit: Suit;
  direction: 1 | -1;
  turn: number;
  /** Kumulierte Strafkarten aus 7ern. */
  pendingDraw: number;
  /** Wurde in diesem Zug bereits gezogen? */
  hasDrawn: boolean;
  /** Wer nach seiner vorletzten Karte „Mau!“ gerufen hat. */
  mauProtection: boolean[];
  rng: RngState;
  /** Zuletzt gespielte Karte oder Aktion – für Animationen und Hinweise. */
  lastAction?: {
    player: number;
    text: string;
    card?: CardId;
    target?: number;
    suit?: Suit;
  };
  winner: number | null;
}

export type MauMauMove =
  | {
      type: 'play';
      cardId: CardId;
      /** Pflicht bei einem Buben, außer er ist die letzte Karte. */
      chosenSuit?: Suit;
      callMau?: boolean;
    }
  | { type: 'draw' }
  | { type: 'pass' }
  | { type: 'catchMau'; target: number };
