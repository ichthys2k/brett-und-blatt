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
      remainingMs: control.kind === 'chessClock' ? control.baseMs : 0,
      bankMs: control.kind === 'perMove' ? (control.bankMs ?? 0) : 0,
      startedAt: null,
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
      clock.bankMs = Math.max(0, clock.bankMs - Math.max(0, elapsed - this.control.moveMs));
    } else if (this.control.kind === 'chessClock') {
      clock.remainingMs = Math.max(0, clock.remainingMs - elapsed) + this.control.incrementMs;
    }
    clock.startedAt = null;
  }

  /** Bricht einen Zug ab, ohne Zeit zu verbuchen (z. B. nach „Zug zurück“). */
  cancel(seat: SeatId): void {
    this.clock(seat).startedAt = null;
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
      const moveLeft = control.moveMs - elapsed;
      if (moveLeft >= 0) {
        return { kind: control.kind, running, leftMs: moveLeft, bankLeftMs: total > 0 ? clock.bankMs : null, fraction: moveLeft / control.moveMs, usingBank: false, expired: false };
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

    return { kind: 'none', running, leftMs: null, bankLeftMs: null, fraction: 1, usingBank: false, expired: false };
  }

  isExpired(seat: SeatId, now: number): boolean {
    return this.isRunning(seat) && this.read(seat, now).expired;
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
