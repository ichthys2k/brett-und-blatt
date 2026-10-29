/**
 * Die Regeln von „Fix gefunden!“ (Dobble-artig).
 *
 * Je zwei Karten haben genau ein gemeinsames Symbol (siehe `deck.ts`). Wer es zuerst antippt,
 * gewinnt die Karte. Drei Spielarten:
 *  - Turmbau: Jeder hat einen Turm mit einer offenen Karte. Passt die Mittelkarte zu deiner
 *    obersten Karte, legst du sie auf deinen Turm. Der höchste Turm gewinnt.
 *  - Brunnen: Alle Karten sind verteilt. Passt deine oberste Karte zur Mittelkarte, legst du sie
 *    in die Mitte. Wer zuerst keine Karte mehr hat, gewinnt.
 *  - Vergiftetes Geschenk: Passt die Mittelkarte zur obersten Karte eines Mitspielers, bekommt er
 *    sie. Wer am Ende die wenigsten Karten hat, gewinnt.
 *
 * Ein falsches Symbol ist ein erlaubter Zug und sperrt den Platz, bis eine neue Mittelkarte
 * liegt (so braucht der Zustand keine Uhr). Sind alle gesperrt, werden alle wieder frei und –
 * außer im Brunnen – die Mittelkarte wird verworfen.
 */
import { Rng, type Actor, type GameEvent, type MoveResult, type Options, type Result, type RngState, type SeatId } from '@brett-und-blatt/engine';
import { ORDERS, SYMBOL_SETS, buildCards, deckSize, shared, type Order, type SymbolSet } from './deck';

export type Mode = 'tower' | 'fountain' | 'gift';

export const MODES: { value: Mode; label: string }[] = [
  { value: 'tower', label: 'Turmbau' },
  { value: 'fountain', label: 'Brunnen' },
  { value: 'gift', label: 'Vergiftetes Geschenk' },
];

export interface SymbolMatchOptions {
  mode: Mode;
  order: Order;
  symbols: SymbolSet;
  /** Keine Drehung und gleich große Symbole – ruhiger für jüngere Kinder. */
  calm: boolean;
}

export interface LastClaim {
  seat: SeatId;
  target: SeatId;
  symbol: number;
  ok: boolean;
  /** Bei einem Fehlgriff: Die Mittelkarte wurde verworfen. */
  burned: boolean;
}

export interface SymbolMatchState {
  phase: 'play' | 'gameEnd';
  options: SymbolMatchOptions;
  /** Nachziehstapel (Kartennummern), die letzte Karte kommt als Nächste in die Mitte. */
  deck: number[];
  center: number | null;
  /** Karten je Platz; die letzte ist die oberste, offene. */
  stacks: number[][];
  /** Gesperrt, bis eine neue Mittelkarte liegt. */
  locked: boolean[];
  hits: number[];
  mistakes: number[];
  last: LastClaim | null;
  rng: RngState;
}

export type SymbolMatchMove = {
  type: 'claim';
  /** Das angetippte Symbol. */
  symbol: number;
  /** Mittelkarte, auf die sich der Zug bezieht – ist sie inzwischen weg, kommt der Zug „zu spät“. */
  center: number;
  /** Wessen oberste Karte gemeint ist … */
  target: SeatId;
  /** … und welche Karte das war. */
  top: number;
};

function parseOptions(options: Options): SymbolMatchOptions {
  const order = Number(options.order);
  return {
    mode: MODES.some((m) => m.value === options.mode) ? (options.mode as Mode) : 'tower',
    order: (ORDERS as number[]).includes(order) ? (order as Order) : 5,
    symbols: SYMBOL_SETS.some((s) => s.value === options.symbols) ? (options.symbols as SymbolSet) : 'emoji',
    calm: options.calm === 'on',
  };
}

export function setup(seats: number, options: Options, seed: string): SymbolMatchState {
  const opts = parseOptions(options);
  // Allein bleibt nur der Turmbau übrig (als Training).
  if (seats === 1) opts.mode = 'tower';
  const rng = Rng.fromSeed(seed, 'symbol-match');
  const deck = rng.shuffle(Array.from({ length: deckSize(opts.order) }, (_, i) => i));
  const stacks: number[][] = Array.from({ length: seats }, () => []);
  if (opts.mode === 'fountain') {
    const center = deck.pop()!;
    deck.forEach((card, i) => stacks[i % seats]!.push(card));
    return fresh(opts, [], center, stacks, rng);
  }
  for (const stack of stacks) stack.push(deck.pop()!);
  return fresh(opts, deck, deck.pop()!, stacks, rng);
}

function fresh(options: SymbolMatchOptions, deck: number[], center: number, stacks: number[][], rng: Rng): SymbolMatchState {
  return {
    phase: 'play',
    options,
    deck,
    center,
    stacks,
    locked: stacks.map(() => false),
    hits: stacks.map(() => 0),
    mistakes: stacks.map(() => 0),
    last: null,
    rng: rng.state,
  };
}

export function topCard(state: Pick<SymbolMatchState, 'stacks'>, seat: SeatId): number | undefined {
  const stack = state.stacks[seat];
  return stack?.[stack.length - 1];
}

/** Auf wessen Karten darf `seat` zielen? Im Geschenk auf die der anderen, sonst auf die eigene. */
export function targetsFor(state: Pick<SymbolMatchState, 'options' | 'stacks'>, seat: SeatId): SeatId[] {
  if (state.options.mode === 'gift') return state.stacks.flatMap((_, s) => (s === seat ? [] : [s]));
  return [seat];
}

export function currentPlayers(state: SymbolMatchState): Actor[] {
  if (state.phase !== 'play') return [];
  return state.locked.flatMap((locked, s) => (locked ? [] : [s]));
}

/** Die richtigen Züge: je Ziel das eine gemeinsame Symbol. */
export function legalMoves(state: SymbolMatchState, actor: Actor): SymbolMatchMove[] {
  if (actor === 'system' || state.phase !== 'play' || state.locked[actor] || state.center === null) return [];
  const moves: SymbolMatchMove[] = [];
  for (const target of targetsFor(state, actor)) {
    const top = topCard(state, target);
    if (top === undefined) continue;
    moves.push({ type: 'claim', symbol: shared(state.options.order, state.center, top), center: state.center, target, top });
  }
  return moves;
}

/** Auch ein falsches Symbol ist erlaubt (es kostet nur die Sperre) – aber nur auf die aktuellen Karten. */
export function isLegal(state: SymbolMatchState, actor: Actor, move: SymbolMatchMove): boolean {
  if (actor === 'system' || state.phase !== 'play' || state.locked[actor] || state.center === null) return false;
  if (move.type !== 'claim' || !Number.isInteger(move.symbol) || move.symbol < 0 || move.symbol >= deckSize(state.options.order)) return false;
  return move.center === state.center && targetsFor(state, actor).includes(move.target) && move.top === topCard(state, move.target);
}

function clone(state: SymbolMatchState): SymbolMatchState {
  return {
    ...state,
    deck: [...state.deck],
    stacks: state.stacks.map((s) => [...s]),
    locked: [...state.locked],
    hits: [...state.hits],
    mistakes: [...state.mistakes],
  };
}

export function applyMove(state: SymbolMatchState, actor: Actor, move: SymbolMatchMove): MoveResult<SymbolMatchState> {
  if (!isLegal(state, actor, move)) throw new Error('Dieser Zug ist gerade nicht erlaubt.');
  const seat = actor as SeatId;
  const next = clone(state);
  const events: GameEvent[] = [];
  const cards = buildCards(next.options.order);
  const ok = cards[move.center]!.includes(move.symbol) && cards[move.top]!.includes(move.symbol);

  if (!ok) {
    next.locked[seat] = true;
    next.mistakes[seat]!++;
    let burned = false;
    events.push({ type: 'mistake', seat, symbol: move.symbol });
    if (next.locked.every(Boolean)) {
      next.locked = next.locked.map(() => false);
      events.push({ type: 'unlocked' });
      if (next.options.mode !== 'fountain') {
        burned = true;
        events.push({ type: 'burned', card: next.center });
        newCenter(next, events);
      }
    }
    next.last = { seat, target: move.target, symbol: move.symbol, ok: false, burned };
    return { state: next, events };
  }

  next.hits[seat]!++;
  next.last = { seat, target: move.target, symbol: move.symbol, ok: true, burned: false };
  events.push({ type: 'claimed', seat, target: move.target, symbol: move.symbol, card: move.center });
  if (next.options.mode === 'fountain') {
    // Die eigene oberste Karte wandert in die Mitte.
    next.stacks[seat]!.pop();
    next.center = move.top;
    if (next.stacks[seat]!.length === 0) return { state: finish(next, events), events };
    unlockAll(next, events);
    return { state: next, events };
  }
  next.stacks[move.target]!.push(move.center);
  newCenter(next, events);
  return { state: next, events };
}

function unlockAll(state: SymbolMatchState, events: GameEvent[]): void {
  if (state.locked.some(Boolean)) events.push({ type: 'unlocked' });
  state.locked = state.locked.map(() => false);
}

/** Die nächste Karte kommt in die Mitte; ist der Stapel leer, ist die Partie vorbei. */
function newCenter(state: SymbolMatchState, events: GameEvent[]): void {
  state.center = state.deck.pop() ?? null;
  state.locked = state.locked.map(() => false);
  if (state.center === null) finish(state, events);
}

function finish(state: SymbolMatchState, events: GameEvent[]): SymbolMatchState {
  state.phase = 'gameEnd';
  events.push({ type: 'end' });
  return state;
}

export function result(state: SymbolMatchState): Result | null {
  if (state.phase !== 'gameEnd') return null;
  const sizes = state.stacks.map((s) => s.length);
  const best = state.options.mode === 'tower' ? Math.max(...sizes) : Math.min(...sizes);
  return { kind: 'win', winners: sizes.flatMap((n, s) => (n === best ? [s] : [])) };
}

// ── Sicht ────────────────────────────────────────────────────────────────────

/** Sichtbar sind nur die obersten Karten, die Mitte und die Zahlen – der Stapel nicht. */
export interface SymbolMatchView extends Omit<SymbolMatchState, 'deck' | 'stacks' | 'rng'> {
  deckCount: number;
  players: { top: number | null; count: number }[];
}

export function playerView(state: SymbolMatchState, _seat: SeatId | 'spectator'): SymbolMatchView {
  const { rng: _rng, deck, stacks, ...rest } = state;
  return {
    ...rest,
    locked: [...state.locked],
    hits: [...state.hits],
    mistakes: [...state.mistakes],
    deckCount: deck.length,
    players: stacks.map((s) => ({ top: s[s.length - 1] ?? null, count: s.length })),
  };
}

/** Verteilt die unbekannten Karten zufällig auf Stapel und verdeckte Karten der Türme. */
export function sampleHidden(view: SymbolMatchView, _seat: SeatId, rng: Rng): SymbolMatchState {
  const seen = new Set<number>(view.players.flatMap((p) => (p.top === null ? [] : [p.top])));
  if (view.center !== null) seen.add(view.center);
  const pool = rng.shuffle(Array.from({ length: deckSize(view.options.order) }, (_, i) => i).filter((c) => !seen.has(c)));
  const stacks = view.players.map((p) => {
    const below = Array.from({ length: Math.max(0, p.count - 1) }, () => pool.pop()!);
    return p.top === null ? below : [...below, p.top];
  });
  const { deckCount, players: _players, ...rest } = view;
  return { ...rest, locked: [...view.locked], hits: [...view.hits], mistakes: [...view.mistakes], deck: Array.from({ length: deckCount }, () => pool.pop()!), stacks, rng: [...rng.state] as RngState };
}
