import type { SeatId } from '@brett-und-blatt/engine';

export interface GomokuState {
  /** Brettgröße. Für den Start fest 15x15. */
  size: number;
  /** Felder zeilenweise: Platz 0 = schwarze Steine (Sitz 0), Platz 1 = weiße Steine (Sitz 1), leer. */
  board: (SeatId | null)[];
  /** Wer am Zug ist. */
  turn: SeatId;
  winner: SeatId | null;
  /** Die fünf Felder der Gewinnreihe – für die Hervorhebung in der Oberfläche. */
  winLine: number[] | null;
}

export interface GomokuMove {
  type: 'place';
  cell: number;
}
