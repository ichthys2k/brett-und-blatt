import type { GameEvent, Options, SeatId } from '@brett-und-blatt/engine';
import type { ComponentType } from 'react';
import type { SoundMap } from './audio/sound';

export interface BoardProps<V, M> {
  view: V;
  /** Erlaubte Züge des Menschen, der gerade am Gerät dran ist – leer, wenn niemand eingreifen darf. */
  legalMoves: M[];
  onMove: (move: M) => void;
  /** Ereignisse des letzten Zugs, z. B. für Animationen. */
  events: GameEvent[];
  /** Wer gerade am Zug ist (für Vorschau-Steine), oder null. */
  activeSeat: SeatId | null;
  /** Vorgeschlagener Zug nach Druck auf „Tipp“ – die Oberfläche hebt ihn hervor. */
  hint: M | null;
  /** Aus wessen Sicht gezeigt wird (bei Handkarten: wessen Hand offen liegt). */
  viewer: SeatId | 'spectator';
  /** Namen der Plätze, z. B. für Spielfelder mit mehreren Mitspielern. */
  seatNames: string[];
  /**
   * Nur lokal mit mehreren Menschen ohne Geheimnisse: alle Menschen am Gerät mit ihren Zügen.
   * Für Spiele, in denen alle gleichzeitig handeln (Bingo: mehrere Karten nebeneinander).
   */
  humanSeats?: { seat: SeatId; legalMoves: M[]; onMove: (move: M) => void }[];
  /**
   * Lautstärken aus den Ton-Einstellungen (0–1) für Spiele mit eigener Musik (`GameInfo.ownMusic`).
   * `music` ist 0, wenn auf diesem Gerät keine Musik laufen soll (online nur bei der Raumleitung).
   */
  audio?: { muted: boolean; music: number; effects: number };
  /** Nur online: Raumcode und Einladungslink, z. B. für eine Tafel mit QR-Code am Beamer. */
  invite?: { code: string; link: string };
  /** Für Spiele mit laufendem Ein- und Ausstieg (`joinMidGame`): freie Plätze einnehmen oder den eigenen Platz verlassen. */
  canJoinSeat?: (seat: SeatId) => boolean;
  onJoinSeat?: (seat: SeatId, kind?: 'human' | 'bot', name?: string) => void;
  canLeaveSeat?: (seat: SeatId) => boolean;
  onLeaveSeat?: (seat: SeatId) => void;
}

/** Was ein Spiel der Oberfläche liefert. Die Plattform findet es über den Export `gameUi`. */
export interface GameUi<V = unknown, M = unknown> {
  Board: ComponentType<BoardProps<V, M>>;
  /** Kleines Zeichen für einen Platz, z. B. Kreuz oder roter Stein. */
  /** `seats` = Zahl der Plätze am Tisch, falls die Farbe davon abhängt (z. B. Gegenüber bei zwei Spielern). */
  SeatSymbol: ComponentType<{ seat: SeatId; seats?: number; className?: string }>;
  /** Name der Farbe bzw. des Zeichens eines Platzes, z. B. „Rot“. */
  seatLabel: (seat: SeatId, seats?: number) => string;
  /** Zusatz in der Spielerleiste aus der öffentlichen Sicht, z. B. „12 Punkte“ oder „5 Karten“. */
  seatDetail?: (view: V, seat: SeatId) => string | null;
  /** Punktestand eines Platzes, der in der Spielerleiste immer sichtbar bleibt (auch bei laufender Uhr). */
  seatScore?: (view: V, seat: SeatId) => number | string | null;
  /** Klänge zu den Ereignissen, z. B. `{ placed: 'stein-setzen' }`. Sieg, Niederlage und Zeit vertont die Plattform selbst. */
  sounds?: SoundMap;
  /**
   * Vor dem Start einer Partie auf diesem Gerät: Optionen ergänzen, etwa verborgene Optionen mit
   * Freischaltungen füllen. Online wird das nicht aufgerufen.
   */
  prepareOptions?: (options: Options) => Options;
  /** Zusätzlicher Abschnitt in der Einrichtung, z. B. Atelier und Album eines Spiels. */
  SetupExtra?: ComponentType<{ options: Options; seats: number }>;
}
