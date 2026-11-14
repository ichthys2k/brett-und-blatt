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

export type Mode = 'tower' | 'fountain' | 'gift' | 'hotPotato' | 'duel';

export const MODES: { value: Mode; label: string }[] = [
  { value: 'tower', label: 'Turmbau' },
  { value: 'fountain', label: 'Brunnen' },
  { value: 'gift', label: 'Vergiftetes Geschenk' },
  { value: 'hotPotato', label: 'Heiße Kartoffel' },
  { value: 'duel', label: 'Zeit-Duell (60 s)' },
];

export const ROUNDS = [3, 5, 7] as const;

export const DUEL_MS = 60_000;

export interface SymbolMatchOptions {
  mode: Mode;
  order: Order;
  symbols: SymbolSet;
  /** Keine Drehung und gleich große Symbole – ruhiger für jüngere Kinder. */
  calm: boolean;
  /** Rundenzahl bei „Heiße Kartoffel“. */
  rounds: number;
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
  /** Gesperrt, bis eine neue Mittelkarte (bzw. bei Heißer Kartoffel ein Treffer) liegt. */
  locked: boolean[];
  hits: number[];
  mistakes: number[];
  /** Aktuelle Runde (1-basiert, für „Heiße Kartoffel“). */
  round: number;
  /** Verlorene Runden je Platz (für „Heiße Kartoffel“). */
  losses: number[];
  /** Wer die letzte Runde bei „Heiße Kartoffel“ verloren hat. */
  roundLoser: SeatId | null;
  last: LastClaim | null;
  rng: RngState;
}

export type SymbolMatchMove =
  | {
      type: 'claim';
      /** Das angetippte Symbol. */
      symbol: number;
      /** Mittelkarte (bei „Heiße Kartoffel“: die eigene oberste Karte) – ist sie weg, kommt der Zug „zu spät“. */
      center: number;
      /** Wessen oberste Karte gemeint ist … */
      target: SeatId;
      /** … und welche Karte das war. */
      top: number;
    }
  | { type: 'timeout' };

function parseOptions(options: Options): SymbolMatchOptions {
  const order = Number(options.order);
  const rounds = Number(options.rounds);
  return {
    mode: MODES.some((m) => m.value === options.mode) ? (options.mode as Mode) : 'tower',
    order: (ORDERS as number[]).includes(order) ? (order as Order) : 5,
    symbols: SYMBOL_SETS.some((s) => s.value === options.symbols) ? (options.symbols as SymbolSet) : 'emoji',
    calm: options.calm === 'on',
    rounds: (ROUNDS as readonly number[]).includes(rounds) ? rounds : 5,
  };
}

function shuffledDeck(order: Order, rng: Rng, exclude: Set<number> = new Set()): number[] {
  const cards = Array.from({ length: deckSize(order) }, (_, i) => i).filter((c) => !exclude.has(c));
  return rng.shuffle(cards);
}

export function setup(seats: number, options: Options, seed: string): SymbolMatchState {
  const opts = parseOptions(options);
  // Allein sind nur Turmbau und Zeit-Duell spielbar.
  if (seats === 1 && opts.mode !== 'duel') opts.mode = 'tower';
  const rng = Rng.fromSeed(seed, 'symbol-match');
  const deck = shuffledDeck(opts.order, rng);
  const stacks: number[][] = Array.from({ length: seats }, () => []);
  if (opts.mode === 'fountain') {
    const center = deck.pop()!;
    deck.forEach((card, i) => stacks[i % seats]!.push(card));
    return fresh(opts, [], center, stacks, rng);
  }
  for (const stack of stacks) stack.push(deck.pop()!);
  if (opts.mode === 'hotPotato') {
    return fresh(opts, deck, null, stacks, rng);
  }
  return fresh(opts, deck, deck.pop()!, stacks, rng);
}

function fresh(options: SymbolMatchOptions, deck: number[], center: number | null, stacks: number[][], rng: Rng): SymbolMatchState {
  return {
    phase: 'play',
    options,
    deck,
    center,
    stacks,
    locked: stacks.map(() => false),
    hits: stacks.map(() => 0),
    mistakes: stacks.map(() => 0),
    round: 1,
    losses: stacks.map(() => 0),
    roundLoser: null,
    last: null,
    rng: rng.state,
  };
}

export function topCard(state: Pick<SymbolMatchState, 'stacks'>, seat: SeatId): number | undefined {
  const stack = state.stacks[seat];
  return stack?.[stack.length - 1];
}

/** Auf wessen Karten darf `seat` zielen? Im Geschenk & bei Heißer Kartoffel auf die der anderen, sonst auf die eigene. */
export function targetsFor(state: { options: Pick<SymbolMatchOptions, 'mode'>; stacks: { length: number }[] }, seat: SeatId): SeatId[] {
  if (state.options.mode === 'hotPotato') {
    if ((state.stacks[seat]?.length ?? 0) === 0) return [];
    return state.stacks.flatMap((st, s) => (s !== seat && st.length > 0 ? [s] : []));
  }
  if (state.options.mode === 'gift') return state.stacks.flatMap((st, s) => (s !== seat && st.length > 0 ? [s] : []));
  return (state.stacks[seat]?.length ?? 0) > 0 ? [seat] : [];
}

export function currentPlayers(state: SymbolMatchState): Actor[] {
  if (state.phase !== 'play') return [];
  const actors: Actor[] = state.locked.flatMap((locked, s) => (!locked && state.stacks[s]!.length > 0 ? [s] : []));
  if (state.options.mode === 'duel') actors.push('system');
  return actors;
}

export function systemDelayMs(state: SymbolMatchState): number {
  return state.phase === 'play' && state.options.mode === 'duel' ? DUEL_MS : 0;
}

export function systemTimerKey(_state: SymbolMatchState): string {
  return 'duel';
}

/** Die richtigen Züge: je Ziel das eine gemeinsame Symbol. */
export function legalMoves(state: SymbolMatchState, actor: Actor): SymbolMatchMove[] {
  if (state.phase !== 'play') return [];
  if (actor === 'system') return state.options.mode === 'duel' ? [{ type: 'timeout' }] : [];
  if (state.locked[actor]) return [];
  const source = state.options.mode === 'hotPotato' ? topCard(state, actor) : state.center;
  if (source === null || source === undefined) return [];
  const moves: SymbolMatchMove[] = [];
  for (const target of targetsFor(state, actor)) {
    const top = topCard(state, target);
    if (top === undefined) continue;
    moves.push({ type: 'claim', symbol: shared(state.options.order, source, top), center: source, target, top });
  }
  return moves;
}

/** Auch ein falsches Symbol ist erlaubt (es kostet nur die Sperre) – aber nur auf die aktuellen Karten. */
export function isLegal(state: SymbolMatchState, actor: Actor, move: SymbolMatchMove): boolean {
  if (state.phase !== 'play') return false;
  if (actor === 'system') return move.type === 'timeout' && state.options.mode === 'duel';
  if (state.locked[actor] || move.type !== 'claim') return false;
  if (!Number.isInteger(move.symbol) || move.symbol < 0 || move.symbol >= deckSize(state.options.order)) return false;
  const source = state.options.mode === 'hotPotato' ? topCard(state, actor) : state.center;
  if (source === null || source === undefined) return false;
  return move.center === source && targetsFor(state, actor).includes(move.target) && move.top === topCard(state, move.target);
}

function clone(state: SymbolMatchState): SymbolMatchState {
  return {
    ...state,
    deck: [...state.deck],
    stacks: state.stacks.map((s) => [...s]),
    locked: [...state.locked],
    hits: [...state.hits],
    mistakes: [...state.mistakes],
    losses: [...state.losses],
  };
}

export function applyMove(state: SymbolMatchState, actor: Actor, move: SymbolMatchMove): MoveResult<SymbolMatchState> {
  if (!isLegal(state, actor, move)) throw new Error('Dieser Zug ist gerade nicht erlaubt.');
  const next = clone(state);
  const events: GameEvent[] = [];

  if (actor === 'system') {
    return { state: finish(next, events), events };
  }

  const seat = actor as SeatId;
  const claimMove = move as Extract<SymbolMatchMove, { type: 'claim' }>;
  const cards = buildCards(next.options.order);
  const ok = cards[claimMove.center]!.includes(claimMove.symbol) && cards[claimMove.top]!.includes(claimMove.symbol);

  if (!ok) {
    next.locked[seat] = true;
    next.mistakes[seat]!++;
    let burned = false;
    events.push({ type: 'mistake', seat, symbol: claimMove.symbol });
    const allActiveLocked = next.stacks.every((st, s) => st.length === 0 || next.locked[s]);
    if (allActiveLocked) {
      next.locked = next.locked.map(() => false);
      events.push({ type: 'unlocked' });
      if (next.options.mode !== 'fountain' && next.options.mode !== 'hotPotato') {
        burned = true;
        events.push({ type: 'burned', card: next.center });
        newCenter(next, events);
      }
    }
    next.last = { seat, target: claimMove.target, symbol: claimMove.symbol, ok: false, burned };
    return { state: next, events };
  }

  next.hits[seat]!++;
  next.last = { seat, target: claimMove.target, symbol: claimMove.symbol, ok: true, burned: false };
  events.push({ type: 'claimed', seat, target: claimMove.target, symbol: claimMove.symbol, card: claimMove.center });

  if (next.options.mode === 'fountain') {
    // Die eigene oberste Karte wandert in die Mitte.
    next.stacks[seat]!.pop();
    next.center = claimMove.top;
    if (next.stacks[seat]!.length === 0) return { state: finish(next, events), events };
    unlockAll(next, events);
    return { state: next, events };
  }

  if (next.options.mode === 'hotPotato') {
    // Der eigene Stapel wandert auf die Karte des Ziels – damit ist man für diese Runde sicher.
    next.stacks[claimMove.target]!.push(...next.stacks[seat]!);
    next.stacks[seat] = [];
    unlockAll(next, events);
    const active = next.stacks.flatMap((st, s) => (st.length > 0 ? [s] : []));
    if (active.length <= 1) {
      if (active.length === 1) {
        const loser = active[0]!;
        next.losses[loser]!++;
        next.roundLoser = loser;
        events.push({ type: 'roundEnd', loser });
      }
      if (next.round >= next.options.rounds) {
        return { state: finish(next, events), events };
      }
      next.round++;
      startHotPotatoRound(next);
    }
    return { state: next, events };
  }

  if (next.options.mode === 'duel') {
    // Die Mittelkarte wird die neue Karte des Spielers (alte Karte geht zurück in den Pool).
    next.stacks[seat] = [claimMove.center];
    newCenter(next, events);
    return { state: next, events };
  }

  next.stacks[claimMove.target]!.push(claimMove.center);
  newCenter(next, events);
  return { state: next, events };
}

function startHotPotatoRound(state: SymbolMatchState): void {
  if (state.deck.length < state.stacks.length) {
    const rng = new Rng(state.rng);
    state.deck = shuffledDeck(state.options.order, rng);
    state.rng = rng.state;
  }
  state.stacks = state.stacks.map(() => [state.deck.pop()!]);
  state.locked = state.stacks.map(() => false);
}

function unlockAll(state: SymbolMatchState, events: GameEvent[]): void {
  if (state.locked.some(Boolean)) events.push({ type: 'unlocked' });
  state.locked = state.locked.map(() => false);
}

/** Die nächste Karte kommt in die Mitte; im Zeit-Duell wird bei leerem Stapel neu gemischt, sonst endet die Partie. */
function newCenter(state: SymbolMatchState, events: GameEvent[]): void {
  if (state.deck.length === 0 && state.options.mode === 'duel') {
    const rng = new Rng(state.rng);
    const inUse = new Set<number>();
    if (state.center !== null) inUse.add(state.center);
    for (const st of state.stacks) for (const c of st) inUse.add(c);
    state.deck = shuffledDeck(state.options.order, rng, inUse);
    state.rng = rng.state;
  }
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
  if (state.options.mode === 'duel') {
    const best = Math.max(...state.hits);
    return { kind: 'win', winners: state.hits.flatMap((n, s) => (n === best ? [s] : [])) };
  }
  if (state.options.mode === 'hotPotato') {
    const best = Math.min(...state.losses);
    return { kind: 'win', winners: state.losses.flatMap((n, s) => (n === best ? [s] : [])) };
  }
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
    losses: [...state.losses],
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
  return {
    ...rest,
    locked: [...view.locked],
    hits: [...view.hits],
    mistakes: [...view.mistakes],
    losses: [...view.losses],
    deck: Array.from({ length: deckCount }, () => pool.pop()!),
    stacks,
    rng: [...rng.state] as RngState,
  };
}
