import { Clocks, type ClockReading, type ClocksState } from './clock';
import type { GameSession } from './game-session';
import { isLegalMove, replay, resolveOptions, seatActors } from './module-helpers';
import { Rng } from './random';
import type { Actor, BotLevel, GameEvent, GameModule, Options, Result, SeatId, TimeControl } from './types';

export type SeatKind = 'human' | 'bot';

export interface SeatConfig {
  kind: SeatKind;
  name: string;
  /** Nur bei Bots: Stärke und welcher Bot (sonst der Standard-Bot des Spiels). */
  level?: BotLevel;
  botId?: string;
}

export interface SessionConfig {
  gameId: string;
  seats: SeatConfig[];
  options: Options;
  seed: string;
  time: TimeControl;
  /** Nur Schachuhr: Bei Zeitablauf verliert man (klassisch) oder der Bot zieht. */
  onTimeout?: 'bot' | 'lose';
}

export type MoveCause = 'player' | 'bot' | 'timeout' | 'system';

export interface LogEntry<M = unknown> {
  actor: Actor;
  move: M;
  cause: MoveCause;
}

export interface Forfeit {
  seat: SeatId;
  reason: 'time' | 'resign';
}

export interface SessionSnapshot<M = unknown> {
  version: 1;
  config: SessionConfig;
  log: LogEntry<M>[];
  forfeit: Forfeit | null;
  /** Uhren und Abwesenheit – nur für einen Server, der die Partie nahtlos weiterführt. */
  runtime?: SessionRuntime;
}

export interface SessionRuntime {
  clocks: ClocksState;
  away: SeatId[];
  timeouts: number[];
}

export interface BotRequest<V = unknown> {
  gameId: string;
  botId: string;
  level: BotLevel;
  seat: SeatId;
  view: V;
  seed: string;
  timeBudgetMs: number;
}

/** Rechnet Bot-Züge aus – im Browser in einem Web Worker, in Tests direkt. */
export interface BotRunner {
  requestMove(request: BotRequest): Promise<unknown>;
}

export interface SessionChange {
  events: GameEvent[];
  entry: LogEntry | null;
}

export interface SessionDeps {
  botRunner: BotRunner;
  now?: () => number;
  /**
   * Kulanz bei Zeitablauf: Die Zeit gilt erst so viel später als abgelaufen. Online
   * gleicht das die Netzverzögerung aus; ein Zug, der knapp zu spät eintrifft, zählt noch.
   */
  graceMs?: number;
  /** Bedenkzeit der Bots je Stufe, z. B. knapper auf einem Server mit wenig Rechenzeit. */
  botBudgetMs?: Partial<Record<BotLevel, number>>;
  /**
   * Ein Bot hat einen Zug mit Bedenkpause geparkt (`BotDefinition.delayMs`), `nextDeadline()`
   * hat sich also geändert. Ein Server stellt daraufhin seinen Wecker neu.
   */
  deadlineChanged?: () => void;
}

/** Ein Bot-Zug, der erst nach seiner Bedenkpause ausgeführt wird. */
interface ParkedMove<M> {
  move: M;
  cause: 'bot' | 'timeout';
  due: number;
  token: number;
}

/** Nach so vielen Zeitüberschreitungen in Folge übernimmt der Bot den Platz. */
export const AWAY_AFTER_TIMEOUTS = 3;

const BOT_BUDGET_MS: Record<BotLevel, number> = { easy: 150, medium: 600, hard: 1500 };

/**
 * Die lokale Spielleitung: nimmt Züge entgegen, prüft sie mit dem Regelwerk,
 * lässt Bots ziehen, führt die Uhren und merkt sich die Zugliste.
 */
export class LocalSession<S = unknown, M = unknown, V = unknown> implements GameSession<M, V> {
  readonly config: SessionConfig;
  private _state: S;
  private _log: LogEntry<M>[] = [];
  private _forfeit: Forfeit | null = null;
  private _version = 0;
  private _paused = false;
  private _disposed = false;
  private clocks: Clocks;
  private now: () => number;
  private graceMs: number;
  private botBudgets: Record<BotLevel, number>;
  private botRunner: BotRunner;
  private listeners = new Set<(change: SessionChange) => void>();
  private pendingBots = new Map<SeatId, number>();
  private parked = new Map<SeatId, ParkedMove<M>>();
  private parkTimer: ReturnType<typeof setTimeout> | null = null;
  private deadlineChanged: (() => void) | undefined;
  private consecutiveTimeouts: number[];
  private away = new Set<SeatId>();

  constructor(
    readonly module: GameModule<S, M, V>,
    config: SessionConfig,
    deps: SessionDeps,
    log: LogEntry<M>[] = [],
    forfeit: Forfeit | null = null,
    runtime?: SessionRuntime,
  ) {
    if (config.seats.length < module.info.players.min || config.seats.length > module.info.players.max) {
      throw new Error(`${module.info.name} braucht ${module.info.players.min}–${module.info.players.max} Spieler.`);
    }
    this.config = { ...config, options: resolveOptions(module, config.options) };
    this.now = deps.now ?? (() => Date.now());
    this.graceMs = deps.graceMs ?? 0;
    this.botBudgets = { ...BOT_BUDGET_MS, ...deps.botBudgetMs };
    this.botRunner = deps.botRunner;
    this.deadlineChanged = deps.deadlineChanged;
    this.clocks = new Clocks(config.time, config.seats.length);
    this.consecutiveTimeouts = config.seats.map(() => 0);
    this._log = [...log];
    this._forfeit = forfeit;
    this._state = replay<S, M>(module, config.seats.length, this.config.options, config.seed, this._log);
    if (runtime) {
      this.clocks.load(runtime.clocks);
      runtime.away.forEach((seat) => this.away.add(seat));
      runtime.timeouts.forEach((count, seat) => (this.consecutiveTimeouts[seat] = count));
    }
    this.advance();
  }

  /**
   * Stellt eine Partie aus einem Schnappschuss wieder her. Im Browser beginnen die Uhren
   * dabei von vorn (wer eine Partie Stunden später fortsetzt, soll nicht sofort verlieren);
   * ein Server übernimmt mit `resumeClocks` auch Uhren und Abwesenheit.
   */
  static restore<S, M, V>(module: GameModule<S, M, V>, snapshot: SessionSnapshot<M>, deps: SessionDeps, options: { resumeClocks?: boolean } = {}): LocalSession<S, M, V> {
    return new LocalSession(module, snapshot.config, deps, snapshot.log, snapshot.forfeit, options.resumeClocks ? snapshot.runtime : undefined);
  }

  get id(): string {
    return this.config.seed;
  }

  get state(): S {
    return this._state;
  }

  get log(): readonly LogEntry<M>[] {
    return this._log;
  }

  /** Steigt bei jeder Änderung – praktisch für React (`useSyncExternalStore`). */
  get version(): number {
    return this._version;
  }

  get paused(): boolean {
    return this._paused;
  }

  get result(): Result | null {
    const result = this.module.result(this._state);
    if (result) return result;
    if (!this._forfeit) return null;
    const winners = this.config.seats.map((_, seat) => seat).filter((seat) => seat !== this._forfeit?.seat);
    if (winners.length === 0) return { kind: 'loss', reason: this._forfeit.reason };
    return { kind: 'win', winners, reason: this._forfeit.reason };
  }

  get forfeit(): Forfeit | null {
    return this._forfeit;
  }

  view(seat: SeatId | 'spectator'): V {
    return this.module.playerView(this._state, seat);
  }

  currentSeats(): SeatId[] {
    if (this.result) return [];
    return seatActors(this.module.currentPlayers(this._state));
  }

  isHuman(seat: SeatId): boolean {
    return this.config.seats[seat]?.kind === 'human';
  }

  isAway(seat: SeatId): boolean {
    return this.away.has(seat);
  }

  isThinking(seat: SeatId): boolean {
    return this.pendingBots.has(seat);
  }

  /** Plätze, an denen gerade ein Mensch ziehen kann. */
  humanSeatsToAct(): SeatId[] {
    if (this._paused) return [];
    return this.currentSeats().filter((seat) => this.isHuman(seat) && !this.away.has(seat));
  }

  legalMoves(seat: SeatId): M[] {
    if (this.result || !this.currentSeats().includes(seat)) return [];
    return this.module.legalMoves(this._state, seat);
  }

  clock(seat: SeatId): ClockReading {
    return this.clocks.read(seat, this.now());
  }

  get timed(): boolean {
    return this.clocks.enabled;
  }

  subscribe(listener: (change: SessionChange) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Ein Mensch macht einen Zug. Gibt false zurück, wenn der Zug gerade nicht erlaubt ist. */
  submit(seat: SeatId, move: M): boolean {
    if (this._disposed || this._paused || this.result) return false;
    if (!this.isHuman(seat) || !this.currentSeats().includes(seat)) return false;
    if (!isLegalMove(this.module, this._state, seat, move)) return false;
    this.away.delete(seat);
    this.consecutiveTimeouts[seat] = 0;
    this.dropBot(seat);
    this.commit(seat, move, 'player');
    return true;
  }

  /** Prüft die Uhren und geparkte Bot-Züge. Die Oberfläche ruft das regelmäßig auf (etwa alle 200 ms). */
  tick(): void {
    if (this._disposed || this._paused || this.result) return;
    this.runParked();
    if (this.result || !this.clocks.enabled) return;
    const now = this.now();
    for (const seat of this.currentSeats()) {
      if (!this.isHuman(seat) || this.away.has(seat) || this.pendingBots.has(seat)) continue;
      if (this.clocks.isExpired(seat, now - this.graceMs)) this.handleTimeout(seat);
      if (this.result) return;
    }
  }

  /**
   * Wann läuft die nächste Uhr eines Menschen ab (einschließlich Kulanz)? Ein Server
   * stellt danach seinen Wecker, statt ständig nachzusehen. null: keine Uhr läuft.
   */
  nextDeadline(): number | null {
    if (this._disposed || this._paused || this.result) return null;
    const now = this.now();
    let next: number | null = null;
    for (const parked of this.parked.values()) if (next === null || parked.due < next) next = parked.due;
    if (!this.clocks.enabled) return next;
    for (const seat of this.currentSeats()) {
      if (!this.isHuman(seat) || this.away.has(seat) || this.pendingBots.has(seat) || !this.clocks.isRunning(seat)) continue;
      const reading = this.clocks.read(seat, now);
      // Zugzeit: erst die Zugzeit, dann die Zeitbank; Schachuhr: die Gesamtzeit.
      const left = reading.usingBank ? (reading.bankLeftMs ?? 0) : (reading.leftMs ?? 0) + (reading.bankLeftMs ?? 0);
      // +1: Abgelaufen ist die Zeit erst, wenn mehr als die volle Zeit verstrichen ist.
      const at = now + left + this.graceMs + 1;
      if (next === null || at < next) next = at;
    }
    return next;
  }

  /** Ein Mensch ist nicht mehr da (z. B. Verbindung weg): Der Bot übernimmt, bis er zurückkommt. */
  markAway(seat: SeatId): void {
    if (!this.isHuman(seat) || this.away.has(seat) || this.result) return;
    this.away.add(seat);
    this.bump();
    this.advance();
    this.notify([{ type: 'away', seat }], null);
  }

  pause(): void {
    if (this._paused || this.result) return;
    this._paused = true;
    this.clocks.pause(this.now());
    this.dropAllBots();
    this.bump();
    this.notify([{ type: 'paused' }], null);
  }

  resume(): void {
    if (!this._paused) return;
    this._paused = false;
    this.clocks.resume(this.now());
    this.bump();
    this.advance();
    this.notify([{ type: 'resumed' }], null);
  }

  /** Ein abwesender Mensch übernimmt seinen Platz wieder vom Bot. */
  returnSeat(seat: SeatId): void {
    if (!this.away.delete(seat)) return;
    this.consecutiveTimeouts[seat] = 0;
    this.dropBot(seat);
    this.bump();
    this.advance();
    this.notify([{ type: 'returned', seat }], null);
  }

  /** Gibt es einen Zug eines Menschen, den man zurücknehmen kann? */
  canUndo(): boolean {
    return this._log.some((entry) => entry.cause === 'player');
  }

  /** Nimmt den letzten Zug eines Menschen zurück – und alles, was danach kam. */
  undo(): boolean {
    let index = -1;
    for (let i = this._log.length - 1; i >= 0; i--) {
      if (this._log[i]?.cause === 'player') {
        index = i;
        break;
      }
    }
    if (index < 0) return false;
    this._log = this._log.slice(0, index);
    this._state = replay<S, M>(this.module, this.config.seats.length, this.config.options, this.config.seed, this._log);
    this._forfeit = null;
    this.dropAllBots();
    this.config.seats.forEach((_, seat) => this.clocks.cancel(seat));
    this.bump();
    this.advance();
    this.notify([{ type: 'undo' }], null);
    return true;
  }

  /** Ein Zugvorschlag des Standard-Bots für einen Menschen („Tipp“). Wird nicht ausgeführt. */
  async hint(seat: SeatId): Promise<M | null> {
    if (this.result || !this.currentSeats().includes(seat)) return null;
    const token = this._version;
    const bot = this.module.bots[0];
    if (!bot) return null;
    const move = (await this.botRunner.requestMove({
      gameId: this.module.info.id,
      botId: bot.id,
      level: 'hard',
      seat,
      view: this.module.playerView(this._state, seat),
      seed: `${this.config.seed}/tipp/${this._log.length}`,
      timeBudgetMs: this.botBudgets.hard,
    })) as M;
    if (token !== this._version || !isLegalMove(this.module, this._state, seat, move)) return null;
    return move;
  }

  resign(seat: SeatId): void {
    if (this.result || !this.isHuman(seat)) return;
    this.endByForfeit({ seat, reason: 'resign' });
  }

  snapshot(): SessionSnapshot<M> {
    return {
      version: 1,
      config: this.config,
      log: [...this._log],
      forfeit: this._forfeit,
      runtime: { clocks: this.clocks.state(), away: [...this.away], timeouts: [...this.consecutiveTimeouts] },
    };
  }

  dispose(): void {
    this._disposed = true;
    this.dropAllBots();
    this.listeners.clear();
  }

  private handleTimeout(seat: SeatId): void {
    this.consecutiveTimeouts[seat] = (this.consecutiveTimeouts[seat] ?? 0) + 1;
    if (this.config.time.kind === 'chessClock' && (this.config.onTimeout ?? 'lose') === 'lose') {
      this.endByForfeit({ seat, reason: 'time' });
      return;
    }
    if ((this.consecutiveTimeouts[seat] ?? 0) >= AWAY_AFTER_TIMEOUTS) this.away.add(seat);
    const fallback = this.module.timeoutMove?.(this._state, seat) as M | undefined;
    if (fallback !== undefined && isLegalMove(this.module, this._state, seat, fallback)) {
      this.commit(seat, fallback, 'timeout');
    } else {
      this.requestBot(seat, 'timeout');
    }
  }

  private endByForfeit(forfeit: Forfeit): void {
    this._forfeit = forfeit;
    this.clocks.stopAll(this.now());
    this.dropAllBots();
    this.bump();
    this.notify([{ type: 'forfeit', ...forfeit }], null);
  }

  private commit(actor: Actor, move: M, cause: MoveCause): void {
    const { state, events } = this.module.applyMove(this._state, actor, move);
    this._state = state;
    const entry: LogEntry<M> = { actor, move, cause };
    this._log.push(entry);
    if (actor !== 'system') this.clocks.stop(actor, this.now());
    this.bump();
    const systemEvents = this.advance();
    this.notify([...events, ...systemEvents], entry as LogEntry);
  }

  /** Nach jeder Änderung: Systemzüge ausführen, Uhren starten, Bots anstoßen. */
  private advance(): GameEvent[] {
    const events: GameEvent[] = [];
    if (this._disposed) return events;
    for (let guard = 0; !this.module.result(this._state) && this.module.currentPlayers(this._state).includes('system'); guard++) {
      if (guard > 10_000) throw new Error('Zu viele Systemzüge hintereinander.');
      const move = this.module.legalMoves(this._state, 'system')[0] as M | undefined;
      if (move === undefined) throw new Error('Die Spielleitung ist am Zug, hat aber keinen Systemzug.');
      const step = this.module.applyMove(this._state, 'system', move);
      this._state = step.state;
      events.push(...step.events);
      this._log.push({ actor: 'system', move, cause: 'system' });
    }

    const now = this.now();
    if (this.result) {
      this.clocks.stopAll(now);
      return events;
    }
    const current = this.currentSeats();
    this.config.seats.forEach((_, seat) => {
      if (!current.includes(seat) && this.clocks.isRunning(seat)) this.clocks.cancel(seat);
    });
    for (const seat of current) this.clocks.start(seat, now);
    if (this._paused) return events;
    for (const seat of current) {
      if (!this.isHuman(seat) || this.away.has(seat)) this.requestBot(seat, 'bot');
    }
    return events;
  }

  private requestBot(seat: SeatId, cause: 'bot' | 'timeout'): void {
    if (this.pendingBots.has(seat)) return;
    const token = this._version;
    this.pendingBots.set(seat, token);
    const seatConfig = this.config.seats[seat];
    const level: BotLevel = seatConfig?.kind === 'bot' ? (seatConfig.level ?? 'medium') : 'medium';
    const bot = this.module.bots.find((b) => b.id === seatConfig?.botId) ?? this.module.bots[0];
    if (!bot) throw new Error(`${this.module.info.name} hat keinen Bot.`);

    const request: BotRequest = {
      gameId: this.module.info.id,
      botId: bot.id,
      level,
      seat,
      view: this.module.playerView(this._state, seat),
      seed: `${this.config.seed}/bot/${seat}/${this._log.length}`,
      timeBudgetMs: this.botBudget(seat, level),
    };

    const finish = (move: M | undefined) => {
      if (this._disposed || this.pendingBots.get(seat) !== token) return;
      // Mit Bedenkpause: Der Zug wird geparkt und erst bei Fälligkeit geprüft – auch wenn
      // inzwischen andere gezogen haben (bei gleichzeitigen Spielen wie Bingo der Normalfall).
      const wait = cause === 'bot' && move !== undefined && bot.delayMs ? bot.delayMs({ view: request.view as V, seat, level, move, rng: Rng.fromSeed(request.seed, 'pause') }) : 0;
      if (wait > 0) {
        this.park(seat, { move: move as M, cause, due: this.now() + wait, token });
        return;
      }
      this.pendingBots.delete(seat);
      if (token !== this._version || this.result || !this.currentSeats().includes(seat)) {
        this.advance();
        return;
      }
      const chosen = move !== undefined && isLegalMove(this.module, this._state, seat, move) ? move : this.fallbackMove(seat);
      this.commit(seat, chosen, cause);
    };
    this.botRunner.requestMove(request).then(
      (move) => finish(move as M),
      () => finish(undefined),
    );
  }

  private park(seat: SeatId, parked: ParkedMove<M>): void {
    this.parked.set(seat, parked);
    this.armParkTimer();
    this.deadlineChanged?.();
  }

  /** Führt fällige geparkte Bot-Züge aus, sofern sie noch erlaubt sind; sonst rechnet der Bot neu. */
  private runParked(): void {
    const now = this.now();
    for (const [seat, parked] of [...this.parked]) {
      if (parked.due > now || this._disposed || this._paused || this.result) continue;
      this.parked.delete(seat);
      if (this.pendingBots.get(seat) !== parked.token) continue;
      this.pendingBots.delete(seat);
      const botSeat = !this.isHuman(seat) || this.away.has(seat) || parked.cause === 'timeout';
      if (botSeat && this.currentSeats().includes(seat) && isLegalMove(this.module, this._state, seat, parked.move)) this.commit(seat, parked.move, parked.cause);
      else this.advance();
    }
    this.armParkTimer();
  }

  /** Ein Wecker für den nächsten geparkten Zug. Ein Server weckt zusätzlich über `nextDeadline()`. */
  private armParkTimer(): void {
    if (this.parkTimer !== null) clearTimeout(this.parkTimer);
    this.parkTimer = null;
    if (this._disposed || this.parked.size === 0) return;
    const due = Math.min(...[...this.parked.values()].map((p) => p.due));
    this.parkTimer = setTimeout(() => this.runParked(), Math.max(0, due - this.now()));
  }

  private dropBot(seat: SeatId): void {
    this.pendingBots.delete(seat);
    if (this.parked.delete(seat)) this.armParkTimer();
  }

  private dropAllBots(): void {
    this.pendingBots.clear();
    this.parked.clear();
    this.armParkTimer();
  }

  /** Notlösung, falls ein Bot ausfällt: ein zufälliger erlaubter Zug. */
  private fallbackMove(seat: SeatId): M {
    const moves = this.module.legalMoves(this._state, seat) as M[];
    return Rng.fromSeed(this.config.seed, `fallback/${this._log.length}`).pick(moves);
  }

  private botBudget(seat: SeatId, level: BotLevel): number {
    const base = this.botBudgets[level];
    const reading = this.clocks.read(seat, this.now());
    if (reading.kind === 'none' || reading.leftMs === null) return base;
    // Nie mehr als ein Drittel der verbleibenden Zeit verbrauchen.
    const available = reading.leftMs + (reading.bankLeftMs ?? 0);
    return Math.max(50, Math.min(base, Math.floor(available / 3)));
  }

  private bump(): void {
    this._version++;
  }

  private notify(events: GameEvent[], entry: LogEntry | null): void {
    for (const listener of this.listeners) listener({ events, entry });
  }
}
