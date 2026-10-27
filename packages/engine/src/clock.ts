import type { SeatId, TimeControl } from './types';

/** Was die Oberfläche über die Uhr eines Platzes wissen muss. */
export interface ClockReading {
  kind: TimeControl['kind'];
  running: boolean;
  /** Restzeit für den aktuellen Zug (Zugzeit) bzw. Gesamtzeit (Schachuhr). */
  leftMs: number | null;
  /** Rest der Zeitbank (nur Zugzeit mit Zeitbank). */
  bankLeftMs: number | null;
  /** Füllstand für den Uhr-Ring, 0 bis 1. */
  fraction: number;
  /** true, wenn gerade die Zeitbank angebrochen wird. */
  usingBank: boolean;
  /** Byo-yomi: verbleibende Perioden (einschließlich der laufenden). */
  periodsLeft?: number;
  expired: boolean;
}

/** Stand aller Uhren als JSON – zum Speichern auf dem Server. Zeiten sind echte Zeitpunkte in ms. */
export interface ClocksState {
  seats: SeatClock[];
  pausedAt: number | null;
}

interface SeatClock {
  /** Schachuhr: verbleibende Gesamtzeit. */
  remainingMs: number;
  /** Zugzeit: verbleibende Zeitbank. */
  bankMs: number;
  startedAt: number | null;
  /** Abgeschlossene Züge (für `firstMoveMs`); fehlt in älteren Spielständen. */
  moves?: number;
  /** Byo-yomi: verbleibende Perioden. */
  periods?: number;
}

/**
 * Die Uhren aller Plätze. Die Uhr gehört zur Spielleitung, nicht zum Regelwerk:
 * Die Regeln wissen nichts von Zeit, Zeitablauf wird zu einem normalen Zug.
 */
export class Clocks {
  private seats: SeatClock[];
  private pausedAt: number | null = null;

  constructor(
    readonly control: TimeControl,
    seatCount: number,
  ) {
    this.seats = Array.from({ length: seatCount }, () => ({
      remainingMs: control.kind === 'chessClock' ? control.baseMs : control.kind === 'byoyomi' ? control.mainMs : 0,
      bankMs: control.kind === 'perMove' ? (control.bankMs ?? 0) : 0,
      startedAt: null,
      moves: 0,
      ...(control.kind === 'byoyomi' ? { periods: control.periods } : {}),
    }));
  }

  get enabled(): boolean {
    return this.control.kind !== 'none';
  }

  state(): ClocksState {
    return { seats: this.seats.map((clock) => ({ ...clock })), pausedAt: this.pausedAt };
  }

  /** Übernimmt einen gespeicherten Stand – laufende Züge laufen ab ihrem echten Beginn weiter. */
  load(state: ClocksState): void {
    if (state.seats.length !== this.seats.length) return;
    this.seats = state.seats.map((clock) => ({ ...clock }));
    this.pausedAt = state.pausedAt;
  }

  get paused(): boolean {
    return this.pausedAt !== null;
  }

  isRunning(seat: SeatId): boolean {
    return this.clock(seat).startedAt !== null;
  }

  /** Der Zug eines Platzes beginnt. */
  start(seat: SeatId, now: number): void {
    const clock = this.clock(seat);
    if (clock.startedAt === null) clock.startedAt = this.pausedAt ?? now;
  }

  /** Der Zug eines Platzes endet: Verbrauchte Zeit wird verbucht. */
  stop(seat: SeatId, now: number): void {
    const clock = this.clock(seat);
    if (clock.startedAt === null) return;
    const elapsed = this.elapsed(clock, now);
    if (this.control.kind === 'perMove') {
      clock.bankMs = Math.max(0, clock.bankMs - Math.max(0, elapsed - this.moveLimit(clock)));
    } else if (this.control.kind === 'chessClock') {
      clock.remainingMs = Math.max(0, clock.remainingMs - elapsed) + this.control.incrementMs;
    } else if (this.control.kind === 'byoyomi') {
      // Erst die Hauptzeit; jede ganz überschrittene Periode ist verbraucht, die laufende beginnt neu.
      const over = elapsed - clock.remainingMs;
      clock.remainingMs = Math.max(0, clock.remainingMs - elapsed);
      if (over > 0) clock.periods = Math.max(0, (clock.periods ?? 0) - Math.floor(over / this.control.periodMs));
    }
    clock.moves = (clock.moves ?? 0) + 1;
    clock.startedAt = null;
  }

  /** Bricht einen Zug ab, ohne Zeit zu verbuchen (z. B. nach „Zug zurück“). */
  cancel(seat: SeatId): void {
    const clock = this.seats[seat];
    if (clock) clock.startedAt = null;
  }

  /** Setzt die Uhr eines Platzes auf den Startzustand zurück (oder legt sie an, falls der Tisch wächst). */
  resetSeat(seat: SeatId): void {
    const control = this.control;
    while (this.seats.length <= seat) {
      this.seats.push({
        remainingMs: control.kind === 'chessClock' ? control.baseMs : control.kind === 'byoyomi' ? control.mainMs : 0,
        bankMs: control.kind === 'perMove' ? (control.bankMs ?? 0) : 0,
        startedAt: null,
        moves: 0,
        ...(control.kind === 'byoyomi' ? { periods: control.periods } : {}),
      });
    }
    this.seats[seat] = {
      remainingMs: control.kind === 'chessClock' ? control.baseMs : control.kind === 'byoyomi' ? control.mainMs : 0,
      bankMs: control.kind === 'perMove' ? (control.bankMs ?? 0) : 0,
      startedAt: null,
      moves: 0,
      ...(control.kind === 'byoyomi' ? { periods: control.periods } : {}),
    };
  }

  stopAll(now: number): void {
    this.seats.forEach((_, seat) => this.stop(seat, now));
  }

  pause(now: number): void {
    if (this.pausedAt === null) this.pausedAt = now;
  }

  resume(now: number): void {
    if (this.pausedAt === null) return;
    const pausedFor = now - this.pausedAt;
    for (const clock of this.seats) {
      if (clock.startedAt !== null) clock.startedAt += pausedFor;
    }
    this.pausedAt = null;
  }

  read(seat: SeatId, now: number): ClockReading {
    const clock = this.clock(seat);
    const running = clock.startedAt !== null;
    const elapsed = running ? this.elapsed(clock, now) : 0;
    const control = this.control;

    if (control.kind === 'perMove') {
      const total = control.bankMs ?? 0;
      const limit = this.moveLimit(clock);
      const moveLeft = limit - elapsed;
      if (moveLeft >= 0) {
        return { kind: control.kind, running, leftMs: moveLeft, bankLeftMs: total > 0 ? clock.bankMs : null, fraction: moveLeft / limit, usingBank: false, expired: false };
      }
      const bankLeft = Math.max(0, clock.bankMs + moveLeft);
      return {
        kind: control.kind,
        running,
        leftMs: 0,
        bankLeftMs: total > 0 ? bankLeft : null,
        fraction: total > 0 ? bankLeft / total : 0,
        usingBank: total > 0,
        expired: bankLeft <= 0,
      };
    }

    if (control.kind === 'chessClock') {
      const left = Math.max(0, clock.remainingMs - elapsed);
      return { kind: control.kind, running, leftMs: left, bankLeftMs: null, fraction: Math.min(1, left / control.baseMs), usingBank: false, expired: running && left <= 0 };
    }

    if (control.kind === 'byoyomi') {
      if (elapsed <= clock.remainingMs) {
        const left = clock.remainingMs - elapsed;
        return { kind: control.kind, running, leftMs: left, bankLeftMs: null, fraction: Math.min(1, left / control.mainMs), usingBank: false, periodsLeft: clock.periods ?? 0, expired: false };
      }
      const over = elapsed - clock.remainingMs;
      const periodsLeft = (clock.periods ?? 0) - Math.floor(over / control.periodMs);
      if (periodsLeft <= 0) return { kind: control.kind, running, leftMs: 0, bankLeftMs: null, fraction: 0, usingBank: true, periodsLeft: 0, expired: true };
      const left = control.periodMs - (over % control.periodMs);
      return { kind: control.kind, running, leftMs: left, bankLeftMs: null, fraction: left / control.periodMs, usingBank: true, periodsLeft, expired: false };
    }

    return { kind: 'none', running, leftMs: null, bankLeftMs: null, fraction: 1, usingBank: false, expired: false };
  }

  isExpired(seat: SeatId, now: number): boolean {
    return this.isRunning(seat) && this.read(seat, now).expired;
  }

  /** Zugzeit für den nächsten Zug: beim ersten Zug ggf. `firstMoveMs`. */
  private moveLimit(clock: SeatClock): number {
    if (this.control.kind !== 'perMove') return 0;
    return (clock.moves ?? 0) === 0 && this.control.firstMoveMs !== undefined ? this.control.firstMoveMs : this.control.moveMs;
  }

  private elapsed(clock: SeatClock, now: number): number {
    if (clock.startedAt === null) return 0;
    const until = this.pausedAt ?? now;
    return Math.max(0, until - clock.startedAt);
  }

  private clock(seat: SeatId): SeatClock {
    const clock = this.seats[seat];
    if (!clock) throw new Error(`Unbekannter Platz: ${seat}`);
    return clock;
  }
}
