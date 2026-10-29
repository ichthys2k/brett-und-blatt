/**
 * Die Regeln von Tiefflug (Skyjo-artig).
 *
 * Jeder hat ein Raster verdeckter Zahlenkarten (3 Zeilen × 4 Spalten, Junior 3 × 3). Zu Beginn
 * deckt reihum jeder zwei Karten auf (Junior eine). Im Zug nimmt man die oberste Ablagekarte und
 * tauscht sie gegen eine eigene – oder zieht vom Stapel und tauscht oder wirft ab und deckt dafür
 * eine eigene Karte auf. Drei gleiche offene Karten in einer Spalte werden abgeräumt. Wer alle
 * Karten offen hat, beendet die Runde; die anderen sind noch einmal dran. Niedrigste Summe gewinnt.
 */
import { Rng, type Actor, type GameEvent, type MoveResult, type Options, type Result, type RngState, type SeatId } from '@brett-und-blatt/engine';

export type Variant = 'classic' | 'junior';
export type Goal = 'p100' | 'p50' | 'r3' | 'r1';

export interface LowFlightOptions {
  variant: Variant;
  goal: Goal;
  /** Wer die Runde beendet, ohne allein die niedrigste Summe zu haben, zahlt doppelt. */
  doubling: boolean;
  /** Auch gleiche Karten über eine ganze Zeile werden abgeräumt. */
  rows: boolean;
}

/** Ein Feld im Raster: offene oder verdeckte Karte, `null` = abgeräumt. */
export interface Cell {
  value: number;
  open: boolean;
}

export interface PlayerState {
  grid: (Cell | null)[];
  total: number;
  ready: boolean;
}

export interface RoundSummary {
  round: number;
  /** Summe der Runde je Platz (nach Verdopplung). */
  points: number[];
  ender: SeatId;
  doubled: boolean;
}

export interface LowFlightState {
  phase: 'reveal' | 'turn' | 'roundEnd' | 'gameEnd';
  options: LowFlightOptions;
  rows: number;
  cols: number;
  players: PlayerState[];
  /** Nachziehstapel, verdeckt; die letzte Karte wird als Nächstes gezogen. */
  deck: number[];
  /** Ablage, offen; die letzte Karte liegt oben. */
  discard: number[];
  turn: SeatId;
  /** Gezogene Karte, die noch abgelegt werden muss, und woher sie kam. */
  drawn: { value: number; from: 'deck' | 'discard' } | null;
  /** Wer die Runde beendet hat (alle Karten offen) – danach ist jeder andere noch einmal dran. */
  ender: SeatId | null;
  /** Wer in der letzten Runde schon dran war. */
  finalTurns: boolean[];
  round: number;
  lastRound: RoundSummary | null;
  rng: RngState;
}

export type LowFlightMove =
  /** Zu Rundenbeginn eine eigene Karte aufdecken. */
  | { type: 'reveal'; slot: number }
  | { type: 'takeDiscard' }
  | { type: 'draw' }
  /** Die gezogene Karte gegen ein Feld tauschen. */
  | { type: 'swap'; slot: number }
  /** Die vom Stapel gezogene Karte abwerfen und dafür ein verdecktes Feld aufdecken. */
  | { type: 'flip'; slot: number }
  /** Abwerfen, wenn kein verdecktes Feld mehr da ist. */
  | { type: 'discardDrawn' }
  | { type: 'ready' };

export const GOALS: { value: Goal; label: string }[] = [
  { value: 'p100', label: 'Bis 100 Punkte' },
  { value: 'p50', label: 'Bis 50 Punkte' },
  { value: 'r3', label: '3 Runden' },
  { value: 'r1', label: 'Eine Runde' },
];

/** Das Blatt: klassisch 150 Karten von −2 bis 12, Junior Obstkarten 1–5. */
export function buildDeck(variant: Variant): number[] {
  const deck: number[] = [];
  const add = (value: number, n: number) => {
    for (let i = 0; i < n; i++) deck.push(value);
  };
  if (variant === 'junior') {
    for (let v = 1; v <= 5; v++) add(v, 18);
    return deck;
  }
  add(-2, 5);
  add(-1, 10);
  add(0, 15);
  for (let v = 1; v <= 12; v++) add(v, 10);
  return deck;
}

/** Wie viele Karten jeder zu Rundenbeginn aufdeckt. */
export function startReveals(state: Pick<LowFlightState, 'options'>): number {
  return state.options.variant === 'junior' ? 1 : 2;
}

function parseOptions(options: Options): LowFlightOptions {
  const variant: Variant = options.variant === 'junior' ? 'junior' : 'classic';
  const goal: Goal =
    variant === 'junior' ? (options.juniorGoal === 'r1' ? 'r1' : 'r3') : GOALS.some((g) => g.value === options.goal) ? (options.goal as Goal) : 'p100';
  return {
    variant,
    goal,
    doubling: variant === 'classic' && options.doubling !== 'off',
    rows: options.rows === 'on',
  };
}

export function setup(seats: number, options: Options, seed: string): LowFlightState {
  const opts = parseOptions(options);
  const junior = opts.variant === 'junior';
  const state: LowFlightState = {
    phase: 'reveal',
    options: opts,
    rows: 3,
    cols: junior ? 3 : 4,
    players: Array.from({ length: seats }, () => ({ grid: [], total: 0, ready: false })),
    deck: [],
    discard: [],
    turn: 0,
    drawn: null,
    ender: null,
    finalTurns: Array.from({ length: seats }, () => false),
    round: 1,
    lastRound: null,
    rng: Rng.fromSeed(seed, 'low-flight').state,
  };
  deal(state);
  return state;
}

function deal(state: LowFlightState): void {
  const rng = new Rng(state.rng);
  const deck = rng.shuffle(buildDeck(state.options.variant));
  state.rng = rng.state;
  const size = state.rows * state.cols;
  for (const p of state.players) {
    p.grid = deck.splice(0, size).map((value) => ({ value, open: false }));
    p.ready = false;
  }
  state.discard = [deck.pop()!];
  state.deck = deck;
  state.drawn = null;
  state.ender = null;
  state.finalTurns = state.players.map(() => false);
  state.phase = 'reveal';
}

// ── Hilfen ───────────────────────────────────────────────────────────────────

/** Ein Raster aus Spielstand oder Sicht (in der Sicht sind verdeckte Werte `null`). */
type AnyGrid = readonly ({ value: number | null; open: boolean } | null)[];

export function openCount(grid: AnyGrid): number {
  return grid.filter((c) => c?.open).length;
}

export function hiddenSlots(grid: AnyGrid): number[] {
  return grid.flatMap((c, i) => (c && !c.open ? [i] : []));
}

/** Summe der offenen Karten. */
export function openSum(grid: AnyGrid): number {
  return grid.reduce((s, c) => s + (c?.open ? c.value! : 0), 0);
}

/** Wer in der Aufdeckphase als Nächstes dran ist. */
function nextRevealer(state: LowFlightState): SeatId | null {
  const need = startReveals(state);
  const n = state.players.length;
  for (let step = 0; step < n; step++) {
    const seat = (state.turn + step) % n;
    if (openCount(state.players[seat]!.grid) < need) return seat;
  }
  return null;
}

export function currentPlayers(state: LowFlightState): Actor[] {
  if (state.phase === 'reveal' || state.phase === 'turn') return [state.turn];
  if (state.phase === 'roundEnd') return state.players.flatMap((p, s) => (p.ready ? [] : [s]));
  return [];
}

export function legalMoves(state: LowFlightState, actor: Actor): LowFlightMove[] {
  if (actor === 'system' || !currentPlayers(state).includes(actor)) return [];
  if (state.phase === 'roundEnd') return [{ type: 'ready' }];
  const grid = state.players[actor]!.grid;
  const hidden = hiddenSlots(grid);
  if (state.phase === 'reveal') return hidden.map((slot) => ({ type: 'reveal', slot }));
  if (!state.drawn) return [{ type: 'draw' }, { type: 'takeDiscard' }];
  const moves: LowFlightMove[] = grid.flatMap((c, slot) => (c ? [{ type: 'swap' as const, slot }] : []));
  if (state.drawn.from === 'deck') {
    for (const slot of hidden) moves.push({ type: 'flip', slot });
    if (hidden.length === 0) moves.push({ type: 'discardDrawn' });
  }
  return moves;
}

export function isLegal(state: LowFlightState, actor: Actor, move: LowFlightMove): boolean {
  return legalMoves(state, actor).some((m) => m.type === move.type && ('slot' in m ? 'slot' in move && m.slot === move.slot : true));
}

// ── Züge ─────────────────────────────────────────────────────────────────────

function clone(state: LowFlightState): LowFlightState {
  return {
    ...state,
    players: state.players.map((p) => ({ ...p, grid: p.grid.map((c) => (c ? { ...c } : null)) })),
    deck: [...state.deck],
    discard: [...state.discard],
    drawn: state.drawn ? { ...state.drawn } : null,
    finalTurns: [...state.finalTurns],
  };
}

/** Zieht vom Stapel; ist er leer, wird die Ablage (ohne oberste Karte) neu gemischt. */
function drawCard(state: LowFlightState, events: GameEvent[]): number {
  if (state.deck.length === 0) {
    const rng = new Rng(state.rng);
    const top = state.discard.pop()!;
    state.deck = rng.shuffle(state.discard);
    state.discard = [top];
    state.rng = rng.state;
    events.push({ type: 'reshuffled' });
  }
  return state.deck.pop()!;
}

/** Räumt Spalten (und mit Option Zeilen) mit lauter gleichen offenen Karten ab. */
function clearLines(state: LowFlightState, seat: SeatId, events: GameEvent[]): void {
  const { rows, cols } = state;
  const grid = state.players[seat]!.grid;
  const lines: number[][] = [];
  for (let c = 0; c < cols; c++) lines.push(Array.from({ length: rows }, (_, r) => r * cols + c));
  if (state.options.rows) for (let r = 0; r < rows; r++) lines.push(Array.from({ length: cols }, (_, c) => r * cols + c));
  const cleared = new Set<number>();
  for (const line of lines) {
    const cells = line.map((i) => grid[i]);
    if (cells.every((c) => c?.open) && cells.every((c) => c!.value === cells[0]!.value)) for (const i of line) cleared.add(i);
  }
  if (cleared.size === 0) return;
  const slots = [...cleared].sort((a, b) => a - b);
  const value = grid[slots[0]!]!.value;
  for (const i of slots) {
    state.discard.push(grid[i]!.value);
    grid[i] = null;
  }
  events.push({ type: 'cleared', seat, slots, value });
}

export function applyMove(state: LowFlightState, actor: Actor, move: LowFlightMove): MoveResult<LowFlightState> {
  if (!isLegal(state, actor, move)) throw new Error('Dieser Zug ist gerade nicht erlaubt.');
  const seat = actor as SeatId;
  const next = clone(state);
  const events: GameEvent[] = [];
  const player = next.players[seat]!;

  switch (move.type) {
    case 'ready':
      player.ready = true;
      if (next.players.every((p) => p.ready)) startRound(next, events);
      return { state: next, events };

    case 'reveal': {
      player.grid[move.slot]!.open = true;
      events.push({ type: 'revealed', seat, slot: move.slot, value: player.grid[move.slot]!.value });
      const need = startReveals(next);
      if (openCount(player.grid) < need) return { state: next, events };
      next.turn = (seat + 1) % next.players.length;
      const who = nextRevealer(next);
      if (who !== null) {
        next.turn = who;
        return { state: next, events };
      }
      // Alle haben aufgedeckt: Runde 1 beginnt, wer die höchste Summe zeigt; später der letzte Beender.
      next.phase = 'turn';
      if (next.lastRound) next.turn = next.lastRound.ender;
      else {
        const sums = next.players.map((p) => openSum(p.grid));
        next.turn = sums.indexOf(Math.max(...sums));
      }
      events.push({ type: 'start', seat: next.turn });
      return { state: next, events };
    }

    case 'draw':
      next.drawn = { value: drawCard(next, events), from: 'deck' };
      events.push({ type: 'drew', seat, value: next.drawn.value });
      return { state: next, events };

    case 'takeDiscard':
      next.drawn = { value: next.discard.pop()!, from: 'discard' };
      events.push({ type: 'tookDiscard', seat, value: next.drawn.value });
      return { state: next, events };

    case 'swap': {
      const old = player.grid[move.slot]!;
      player.grid[move.slot] = { value: next.drawn!.value, open: true };
      next.discard.push(old.value);
      events.push({ type: 'swapped', seat, slot: move.slot, value: next.drawn!.value, old: old.value, wasOpen: old.open });
      break;
    }

    case 'flip':
      next.discard.push(next.drawn!.value);
      player.grid[move.slot]!.open = true;
      events.push({ type: 'flipped', seat, slot: move.slot, value: player.grid[move.slot]!.value, discarded: next.drawn!.value });
      break;

    case 'discardDrawn':
      next.discard.push(next.drawn!.value);
      events.push({ type: 'discarded', seat, value: next.drawn!.value });
      break;
  }

  next.drawn = null;
  clearLines(next, seat, events);
  endTurn(next, seat, events);
  return { state: next, events };
}

function endTurn(state: LowFlightState, seat: SeatId, events: GameEvent[]): void {
  if (state.ender !== null) state.finalTurns[seat] = true;
  else if (hiddenSlots(state.players[seat]!.grid).length === 0) {
    state.ender = seat;
    state.finalTurns[seat] = true;
    events.push({ type: 'lastRound', seat });
  }
  if (state.ender !== null && state.finalTurns.every(Boolean)) {
    endRound(state, events);
    return;
  }
  state.turn = (seat + 1) % state.players.length;
}

function endRound(state: LowFlightState, events: GameEvent[]): void {
  for (let s = 0; s < state.players.length; s++) {
    for (const c of state.players[s]!.grid) if (c) c.open = true;
    clearLines(state, s, events);
  }
  const points = state.players.map((p) => openSum(p.grid));
  const ender = state.ender!;
  const lowest = Math.min(...points);
  const aloneLowest = points[ender] === lowest && points.filter((p) => p === lowest).length === 1;
  const doubled = state.options.doubling && !aloneLowest && points[ender]! > 0;
  if (doubled) points[ender] = points[ender]! * 2;
  state.players.forEach((p, s) => {
    p.total += points[s]!;
    p.ready = false;
  });
  state.lastRound = { round: state.round, points, ender, doubled };
  const goal = state.options.goal;
  const over =
    goal === 'p100' ? state.players.some((p) => p.total >= 100) : goal === 'p50' ? state.players.some((p) => p.total >= 50) : state.round >= (goal === 'r3' ? 3 : 1);
  state.phase = over ? 'gameEnd' : 'roundEnd';
  events.push({ type: 'roundEnd', points, doubled });
}

function startRound(state: LowFlightState, events: GameEvent[]): void {
  state.round++;
  deal(state);
  state.turn = state.lastRound!.ender;
  events.push({ type: 'roundStarted', round: state.round });
}

export function result(state: LowFlightState): Result | null {
  if (state.phase !== 'gameEnd') return null;
  const best = Math.min(...state.players.map((p) => p.total));
  return { kind: 'win', winners: state.players.flatMap((p, s) => (p.total === best ? [s] : [])) };
}

// ── Sicht ────────────────────────────────────────────────────────────────────

/** Verdeckte Karten sind für alle verdeckt – auch für den Besitzer. */
export interface LowFlightView extends Omit<LowFlightState, 'players' | 'deck' | 'rng'> {
  players: { grid: ({ value: number | null; open: boolean } | null)[]; total: number; ready: boolean }[];
  deckCount: number;
}

export function playerView(state: LowFlightState, _seat: SeatId | 'spectator'): LowFlightView {
  const { rng: _rng, deck, players, ...rest } = state;
  return {
    ...rest,
    discard: [...state.discard],
    drawn: state.drawn ? { ...state.drawn } : null,
    finalTurns: [...state.finalTurns],
    players: players.map((p) => ({
      ...p,
      grid: p.grid.map((c) => (c ? { value: c.open ? c.value : null, open: c.open } : null)),
    })),
    deckCount: deck.length,
  };
}

/** Karten, deren Wert niemand kennt (Stapel und verdeckte Rasterkarten). */
export function unknownValues(view: LowFlightView): number[] {
  const pool = buildDeck(view.options.variant);
  const remove = (v: number) => {
    const i = pool.indexOf(v);
    if (i >= 0) pool.splice(i, 1);
  };
  for (const v of view.discard) remove(v);
  if (view.drawn) remove(view.drawn.value);
  for (const p of view.players) for (const c of p.grid) if (c?.open) remove(c.value!);
  return pool;
}

/**
 * Verteilt die unbekannten Werte zufällig. Abgeräumte Karten liegen in der Ablage und sind darum
 * schon abgezogen – die Mengen gehen genau auf.
 */
export function sampleHidden(view: LowFlightView, _seat: SeatId, rng: Rng): LowFlightState {
  const pool = rng.shuffle(unknownValues(view));
  const players = view.players.map((p) => ({
    ...p,
    grid: p.grid.map((c) => (c ? { value: c.open ? c.value! : pool.pop()!, open: c.open } : null)),
  }));
  const { deckCount: _count, players: _players, ...rest } = view;
  return {
    ...rest,
    discard: [...view.discard],
    drawn: view.drawn ? { ...view.drawn } : null,
    finalTurns: [...view.finalTurns],
    players,
    deck: pool,
    rng: [...rng.state] as RngState,
  };
}
