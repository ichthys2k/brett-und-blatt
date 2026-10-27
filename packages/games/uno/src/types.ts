import type { BotLevel, RngState } from '@brett-und-blatt/engine';

/** Erlaubte Grundfarben (Klassisch / Helle Seite). */
export const LIGHT_COLORS = ['red', 'yellow', 'green', 'blue'] as const;
export type LightColor = (typeof LIGHT_COLORS)[number];

/** Dunkle Farben für die Wenden-Variante (Flip Dark Side). */
export const DARK_COLORS = ['orange', 'teal', 'purple', 'pink'] as const;
export type DarkColor = (typeof DARK_COLORS)[number];

export type UnoColor = LightColor | DarkColor | 'wild';

/** Alle Spielvarianten. */
export const UNO_VARIANTS = [
  'classic',
  'no-mercy',
  'flip',
  'all-wild',
  'flex',
  'junior',
] as const;
export type UnoVariantId = (typeof UNO_VARIANTS)[number];

/** Kartenwerte und Sonderfunktionen. */
export type UnoCardType =
  // Zahlen 0-9
  | '0'
  | '1'
  | '2'
  | '3'
  | '4'
  | '5'
  | '6'
  | '7'
  | '8'
  | '9'
  // Klassische Sonderkarten
  | 'skip'
  | 'reverse'
  | 'draw2'
  | 'wild'
  | 'wildDraw4'
  // Keine Gnade (No Mercy)
  | 'draw6'
  | 'draw10'
  | 'skipAll'
  | 'roulette'
  | 'wildDraw6'
  | 'wildDraw10'
  | 'wildReverseDraw4'
  // Wenden (Flip)
  | 'flip'
  | 'draw1'
  | 'flipDraw5'
  | 'wildDrawColor'
  // Nur Joker (All Wild)
  | 'wildSkip'
  | 'wildSkipAll'
  | 'wildTargetDraw2'
  | 'wildSwap';

export interface CardFace {
  color: UnoColor;
  type: UnoCardType;
  animal?: string; // Für Junior (z. B. '🦁', '🐻', '🐼', '🐵')
}

export interface UnoCard {
  id: string;
  front: CardFace;
  back?: CardFace; // Für Flip
}

export interface UnoOptions {
  variant: UnoVariantId;
  /** Strafkarten stapeln (+2 auf +2, +4 auf +4). */
  stacking: 'off' | 'same' | 'progressive';
  /** 7 = Handtausch mit Wunschspieler, 0 = alle Hände wandern in Spielrichtung. */
  sevenZero: 'off' | 'on';
  /** Identische Karte (Farbe + Wert) darf sofort reingeworfen werden. */
  jumpIn: 'off' | 'on';
  /** Nachzieh-Regel: eine Karte oder ziehen bis passend. */
  drawRule: 'one' | 'untilMatch' | 'upToThree';
  /** Muss vor der letzten Karte "Eins!" gerufen werden? */
  callUno: 'on' | 'off';
  /** Handkartenlimit bis K.O. (z. B. 25 bei No Mercy). 0 = deaktiviert. */
  mercyLimit: number;
  /** Mathe-Karten: Zahlenkarten (0–9) zeigen Rechenterme & Brüche statt der Ziffer. */
  mathLabels?: 'off' | 'on';
}

export interface UnoState {
  options: UnoOptions;
  hands: UnoCard[][];
  stock: UnoCard[];
  discard: UnoCard[];
  activeColor: UnoColor;
  activeSide: 'light' | 'dark';
  direction: 1 | -1;
  turn: number;
  /** Kumulierte Strafkarten im Stapel (+2, +4, +6...). */
  pendingDraw: number;
  /** Hat der Spieler in diesem Zug bereits gezogen? */
  hasDrawn: boolean;
  /** Wer hat aktuell nur 1 Karte und muss geschützt oder ertappt werden? */
  unoProtection: boolean[];
  /** Ausgeschiedene Spieler (Mercy-Regel). */
  eliminated: boolean[];
  /** Zufallsgenerator-Zustand für rezyklierte Nachziehstapel und Deterministik. */
  rng: RngState;
  /** Zuletzt gespielte Karte oder Aktion (für Animationen und Feedback). */
  lastAction?: {
    player: number;
    text: string;
    card?: UnoCard;
    target?: number;
  };
  winner: number | null;
}

export type UnoMove =
  | {
      type: 'play';
      cardId: string;
      chosenColor?: UnoColor;
      callUno?: boolean;
      targetPlayer?: number; // z. B. bei Handtausch (7) oder gezieltem Ziehen
    }
  | { type: 'draw' }
  | { type: 'pass' }
  | { type: 'catchUno'; target: number }
  | {
      type: 'jumpIn';
      cardId: string;
      chosenColor?: UnoColor;
      callUno?: boolean;
    };
