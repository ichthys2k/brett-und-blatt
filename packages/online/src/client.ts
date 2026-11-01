import {
  sameValue,
  timePresetsOf,
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
    // Die volle Zugzeit ergibt sich aus der Anzeige (beim ersten Zug kann sie `firstMoveMs` sein).
    const limit = reading.fraction > 0 ? (reading.leftMs ?? 0) / reading.fraction : control.moveMs;
    if (moveLeft >= 0) return { ...reading, leftMs: moveLeft, fraction: moveLeft / limit };
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
  if (control.kind === 'byoyomi') {
    const leftMs = reading.leftMs ?? 0;
    if (!reading.usingBank && elapsedMs <= leftMs) {
      const left = leftMs - elapsedMs;
      return { ...reading, leftMs: left, fraction: Math.min(1, left / control.mainMs) };
    }
    // In den Perioden: wie weit ist die laufende Periode schon verbraucht?
    const over = reading.usingBank ? control.periodMs - leftMs + elapsedMs : elapsedMs - leftMs;
    const periodsLeft = (reading.periodsLeft ?? 0) - Math.floor(over / control.periodMs);
    if (periodsLeft <= 0) return { ...reading, leftMs: 0, fraction: 0, usingBank: true, periodsLeft: 0, expired: true };
    const left = control.periodMs - (over % control.periodMs);
    return { ...reading, leftMs: left, fraction: left / control.periodMs, usingBank: true, periodsLeft };
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
    this.control = timePresetsOf(deps.module, first.options)[first.time];
    this.config = {
      gameId: first.gameId,
      seats: first.seats.map((seat) => (seat.kind === 'bot' ? { kind: 'bot', name: seat.name, level: seat.level } : { kind: 'human', name: seat.name, avatar: seat.avatar })),
      options: first.options,
      time: this.control,
    };
  }

  /** Neuer Stand vom Server. */
  update(message: GameMessage): void {
    this.message = message;
    this.config.seats = message.seats.map((seat) => (seat.kind === 'bot' ? { kind: 'bot', name: seat.name, level: seat.level } : { kind: 'human', name: seat.name, avatar: seat.avatar }));
    this.receivedAt = this.now();
    this.waiting = false;
    this._version++;
    for (const listener of this.listeners) listener({ events: message.events, entry: null });
  }

  /** Welches Mitglied an einem Platz sitzt (null: frei oder Bot). */
  seatMember(seat: SeatId): string | null {
    return this.message.seats[seat]?.memberId ?? null;
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
    if (!this.allows(seat, move)) return false;
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
    if (token !== this._version || !this.allows(seat, move)) return null;
    return move;
  }

  /** Darf der eigene Platz diesen Zug machen? Spiele mit `isLegal` prüfen ihn an der eigenen Sicht. */
  private allows(seat: SeatId, move: M): boolean {
    if (seat !== this.message.yourSeat) return false;
    const { module } = this.deps;
    const moves = this.legalMoves(seat);
    const moveType = (move as { type?: unknown })?.type;
    const isSelfCall = moveType === 'callMau' || moveType === 'callUno' || moveType === 'buzz';
    if (moves.length === 0 && !isSelfCall) return false;
    if (module.isLegal) return module.isLegal(this.message.view, seat, move);
    return moves.some((m) => sameValue(m, move));
  }

  canResign(seat: SeatId): boolean {
    return seat === this.message.yourSeat && !this.message.result && this.message.canResign;
  }

  resign(seat: SeatId): void {
    if (this.canResign(seat)) this.deps.send({ type: 'resign' });
  }

  canJoinSeat(seat: SeatId): boolean {
    if (this.message.yourSeat !== null || this.message.result) return false;
    const publicSeat = this.message.seats[seat];
    if (publicSeat && (publicSeat.kind !== 'human' || publicSeat.memberId !== null)) return false;
    return Boolean(this.deps.module.seatChangeMove && this.deps.module.seatChangeMove(this.message.view, seat, true) !== null);
  }

  joinSeat(seat: SeatId): boolean {
    if (!this.canJoinSeat(seat)) return false;
    this.deps.send({ type: 'takeSeat', index: seat });
    return true;
  }

  canLeaveSeat(seat: SeatId): boolean {
    if (seat !== this.message.yourSeat || this.message.result) return false;
    return Boolean(this.deps.module.seatChangeMove && this.deps.module.seatChangeMove(this.message.view, seat, false) !== null);
  }

  leaveSeat(seat: SeatId): boolean {
    if (!this.canLeaveSeat(seat)) return false;
    this.deps.send({ type: 'leaveSeat' });
    return true;
  }
}
