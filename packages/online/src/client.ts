import {
  sameValue,
  type AnyGameModule,
  type BotRunner,
  type ClockReading,
  type GameSession,
  type PublicSessionConfig,
  type Result,
  type SeatId,
  type SessionChange,
  type TimeControl,
} from '@brett-und-blatt/engine';
import type { ClientMessage, GameMessage } from './protocol';

/**
 * Zählt eine Uhr seit der letzten Nachricht des Servers selbst weiter, damit die
 * Anzeige flüssig läuft. Maßgeblich bleibt der Server: Er entscheidet über Zeitablauf.
 */
export function extrapolateClock(reading: ClockReading, control: TimeControl, elapsedMs: number): ClockReading {
  if (!reading.running || elapsedMs <= 0) return reading;
  if (control.kind === 'perMove') {
    const total = control.bankMs ?? 0;
    if (reading.usingBank) {
      const bankLeft = Math.max(0, (reading.bankLeftMs ?? 0) - elapsedMs);
      return { ...reading, bankLeftMs: bankLeft, fraction: total > 0 ? bankLeft / total : 0, expired: bankLeft <= 0 };
    }
    const moveLeft = (reading.leftMs ?? 0) - elapsedMs;
    if (moveLeft >= 0) return { ...reading, leftMs: moveLeft, fraction: moveLeft / control.moveMs };
    const bankLeft = Math.max(0, (reading.bankLeftMs ?? 0) + moveLeft);
    return {
      ...reading,
      leftMs: 0,
      bankLeftMs: total > 0 ? bankLeft : null,
      fraction: total > 0 ? bankLeft / total : 0,
      usingBank: total > 0,
      expired: bankLeft <= 0,
    };
  }
  if (control.kind === 'chessClock') {
    const left = Math.max(0, (reading.leftMs ?? 0) - elapsedMs);
    return { ...reading, leftMs: left, fraction: Math.min(1, left / control.baseMs), expired: left <= 0 };
  }
  return reading;
}

export interface OnlineSessionDeps {
  module: AnyGameModule;
  roomCode: string;
  send(message: ClientMessage): void;
  /** Rechnet Tipps im eigenen Browser – nur mit der eigenen Sicht. */
  botRunner: BotRunner;
  now?: () => number;
}

/**
 * Die Online-Partie aus Sicht eines Browsers. Sie erfüllt dieselbe Schnittstelle
 * wie die lokale Spielleitung, rechnet aber selbst nichts aus: Alles kommt als
 * Nachricht vom Server, Züge gehen als Nachricht zurück.
 */
export class OnlineSession<M = unknown, V = unknown> implements GameSession<M, V> {
  readonly id: string;
  readonly config: PublicSessionConfig;
  private message: GameMessage;
  private receivedAt: number;
  private control: TimeControl;
  private _version = 0;
  /** Nach dem Abschicken eines Zuges: keine weiteren, bis der Server antwortet. */
  private waiting = false;
  private listeners = new Set<(change: SessionChange) => void>();
  private now: () => number;

  constructor(
    first: GameMessage,
    private deps: OnlineSessionDeps,
  ) {
    this.now = deps.now ?? (() => Date.now());
    this.message = first;
    this.receivedAt = this.now();
    this.id = `${deps.roomCode}/${first.round}`;
    this.control = deps.module.timePresets[first.time];
    this.config = {
      gameId: first.gameId,
      seats: first.seats.map((seat) => (seat.kind === 'bot' ? { kind: 'bot', name: seat.name, level: seat.level } : { kind: 'human', name: seat.name })),
      options: first.options,
      time: this.control,
    };
  }

  /** Neuer Stand vom Server. */
  update(message: GameMessage): void {
    this.message = message;
    this.receivedAt = this.now();
    this.waiting = false;
    this._version++;
    for (const listener of this.listeners) listener({ events: message.events, entry: null });
  }

  /** Der eigene Platz (null für Zuschauer). */
  get yourSeat(): SeatId | null {
    return this.message.yourSeat;
  }

  get version(): number {
    return this._version;
  }

  get paused(): boolean {
    return false;
  }

  get result(): Result | null {
    return this.message.result;
  }

  get timed(): boolean {
    return this.control.kind !== 'none';
  }

  /** Online gibt es nur die eigene Sicht – der Server schickt nichts anderes. */
  view(): V {
    return this.message.view as V;
  }

  currentSeats(): SeatId[] {
    return this.message.result ? [] : this.message.current;
  }

  isHuman(seat: SeatId): boolean {
    return this.message.seats[seat]?.kind === 'human';
  }

  isAway(seat: SeatId): boolean {
    return this.message.away.includes(seat);
  }

  isThinking(seat: SeatId): boolean {
    return this.message.thinking.includes(seat);
  }

  humanSeatsToAct(): SeatId[] {
    const seat = this.message.yourSeat;
    return seat !== null && !this.waiting && this.legalMoves(seat).length > 0 ? [seat] : [];
  }

  legalMoves(seat: SeatId): M[] {
    return seat === this.message.yourSeat && !this.waiting ? (this.message.legalMoves as M[]) : [];
  }

  clock(seat: SeatId): ClockReading {
    const reading = this.message.clocks[seat] ?? { kind: 'none', running: false, leftMs: null, bankLeftMs: null, fraction: 1, usingBank: false, expired: false };
    return extrapolateClock(reading, this.control, this.now() - this.receivedAt);
  }

  subscribe(listener: (change: SessionChange) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  submit(seat: SeatId, move: M): boolean {
    if (!this.legalMoves(seat).some((m) => sameValue(m, move))) return false;
    this.deps.send({ type: 'move', version: this.message.version, move });
    this.waiting = true;
    this._version++;
    for (const listener of this.listeners) listener({ events: [], entry: null });
    return true;
  }

  /** Der Server führt die Uhr; hier gibt es nichts zu prüfen. */
  tick(): void {}

  pause(): void {}

  resume(): void {}

  returnSeat(seat: SeatId): void {
    if (seat === this.message.yourSeat) this.deps.send({ type: 'returnSeat' });
  }

  canUndo(): boolean {
    return false;
  }

  undo(): boolean {
    return false;
  }

  async hint(seat: SeatId): Promise<M | null> {
    const bot = this.deps.module.bots[0];
    if (!bot || this.legalMoves(seat).length === 0) return null;
    const token = this._version;
    const move = (await this.deps.botRunner.requestMove({
      gameId: this.config.gameId,
      botId: bot.id,
      level: 'hard',
      seat,
      view: this.message.view,
      seed: `tipp/${this.message.version}/${Math.random()}`,
      timeBudgetMs: 1500,
    })) as M;
    if (token !== this._version || !this.legalMoves(seat).some((m) => sameValue(m, move))) return null;
    return move;
  }

  resign(seat: SeatId): void {
    if (seat === this.message.yourSeat) this.deps.send({ type: 'resign' });
  }
}
