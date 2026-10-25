import type { ClockReading } from './clock';
import type { SessionChange, SessionConfig } from './session';
import type { Result, SeatId } from './types';

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
  resign(seat: SeatId): void;
}
