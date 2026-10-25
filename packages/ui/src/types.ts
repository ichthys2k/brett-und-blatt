import type { GameEvent, SeatId } from '@brett-und-blatt/engine';
import type { ComponentType } from 'react';

export interface BoardProps<V, M> {
  view: V;
  /** Erlaubte Züge des Menschen, der gerade am Gerät dran ist – leer, wenn niemand eingreifen darf. */
  legalMoves: M[];
  onMove: (move: M) => void;
  /** Ereignisse des letzten Zugs, z. B. für Animationen. */
  events: GameEvent[];
  /** Wer gerade am Zug ist (für Vorschau-Steine), oder null. */
  activeSeat: SeatId | null;
}

/** Was ein Spiel der Oberfläche liefert. Die Plattform findet es über den Export `gameUi`. */
export interface GameUi<V = unknown, M = unknown> {
  Board: ComponentType<BoardProps<V, M>>;
  /** Kleines Zeichen für einen Platz, z. B. Kreuz oder roter Stein. */
  SeatSymbol: ComponentType<{ seat: SeatId; className?: string }>;
  /** Name der Farbe bzw. des Zeichens eines Platzes, z. B. „Rot“. */
  seatLabel: (seat: SeatId) => string;
}
