import type { ClockReading } from './clock';
import type { BotLevel, SeatId, Result } from './types';
import type { SeatKind, SessionChange, SessionConfig } from './session';

/**
 * Was die Oberfläche über eine Partie wissen darf. Der Seed fehlt absichtlich:
 * Wer ihn kennt, kann bei Spielen mit Geheimnissen alle verdeckten Karten ausrechnen.
 */
export type PublicSessionConfig = Omit<SessionConfig, 'seed'>;

/**
 * Die gemeinsame Schnittstelle der Spielleitungen, mit der die Oberfläche spricht:
 * die lokale Spielleitung im Browser genauso wie später eine Online-Partie.
 */
export interface GameSession<M = unknown, V = unknown> {
  /** Eindeutig je Partie – z. B. als React-Schlüssel. */
  readonly id: string;
  readonly config: PublicSessionConfig;
  /** Steigt bei jeder Änderung – praktisch für React (`useSyncExternalStore`). */
  readonly version: number;
  readonly paused: boolean;
  readonly result: Result | null;
  readonly timed: boolean;

  view(seat: SeatId | 'spectator'): V;
  currentSeats(): SeatId[];
  isHuman(seat: SeatId): boolean;
  isAway(seat: SeatId): boolean;
  isThinking(seat: SeatId): boolean;
  /** Plätze, an denen gerade ein Mensch an diesem Gerät ziehen kann. */
  humanSeatsToAct(): SeatId[];
  legalMoves(seat: SeatId): M[];
  clock(seat: SeatId): ClockReading;
  subscribe(listener: (change: SessionChange) => void): () => void;

  submit(seat: SeatId, move: M): boolean;
  /** Prüft bzw. aktualisiert die Uhren; die Oberfläche ruft das regelmäßig auf. */
  tick(): void;
  pause(): void;
  resume(): void;
  returnSeat(seat: SeatId): void;
  canUndo(): boolean;
  undo(): boolean;
  hint(seat: SeatId): Promise<M | null>;
  /** Kann dieser Platz gerade aufgeben? (Nicht, wenn er schon ausgeschieden ist.) */
  canResign(seat: SeatId): boolean;
  resign(seat: SeatId): void;
  /** Kann dieser Platz im laufenden Betrieb eingenommen werden (Spiele mit `joinMidGame`)? */
  canJoinSeat?(seat: SeatId): boolean;
  /** Nimmt einen freien Platz für die nächste Runde ein. */
  joinSeat?(seat: SeatId, kind?: SeatKind, name?: string, level?: BotLevel): boolean;
  /** Kann dieser Platz den Tisch im laufenden Betrieb verlassen? */
  canLeaveSeat?(seat: SeatId): boolean;
  /** Verlässt den Platz im laufenden Betrieb (laufende Hand wird gepasst, Platz ab nächster Runde frei). */
  leaveSeat?(seat: SeatId, nextName?: string): boolean;
}
