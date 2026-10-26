import { Rng, type Actor, type GameEvent, type MoveResult, type Options, type Result, type RngState, type SeatId } from '@brett-und-blatt/engine';

/** Ein Stein des Doppel-6-Spiels: 0 … 27. */
export type StoneId = number;

/** Die 28 Steine [a|b] mit a ≤ b. */
export const STONES: readonly (readonly [number, number])[] = (() => {
  const list: [number, number][] = [];
  for (let a = 0; a <= 6; a++) for (let b = a; b <= 6; b++) list.push([a, b]);
  return list;
})();

export const pipsOf = (stone: StoneId) => STONES[stone]![0] + STONES[stone]![1];
export const isDouble = (stone: StoneId) => STONES[stone]![0] === STONES[stone]![1];

export type DominoVariant = 'block' | 'draw' | 'fives';

/** Ein Stein in der Kette, mit der Augenzahl links und rechts so, wie er liegt. */
export interface ChainStone {
  stone: StoneId;
  left: number;
  right: number;
}

export interface RoundSummary {
  round: number;
  /** Wer die Runde gewonnen hat (null: gesperrt und Gleichstand). */
  winner: SeatId | null;
  points: number;
  /** Gesperrt: niemand konnte mehr legen. */
  blocked: boolean;
  /** Die Steine, die am Ende noch auf den Händen lagen (werden aufgedeckt). */
  hands: StoneId[][];
}

export interface DominoState {
  seats: number;
  variant: DominoVariant;
  target: number;
  round: number;
  chain: ChainStone[];
  /** Hände; in fremden Sichten null je Stein. */
  hands: (StoneId | null)[][];
  /** Vorrat zum Ziehen; in der Sicht null je Stein. */
  boneyard: (StoneId | null)[];
  scores: number[];
  turn: SeatId;
  /** Erster Zug einer Runde: nur dieser Stein (höchster Pasch) darf gelegt werden. */
  opening: StoneId | null;
  passes: number;
  /** Öffentlich bekannt: Augenzahlen, die ein Platz in dieser Runde nicht bedienen konnte. */
  lacks: number[][];
  lastPlayed: { seat: SeatId; stone: StoneId; end: 'left' | 'right'; scored: number } | null;
  lastRound: RoundSummary | null;
  over: boolean;
  /** Zufall für das Mischen der nächsten Runden; in der Sicht genullt. */
  rng: RngState;
}

export type DominoMove = { type: 'play'; stone: StoneId; end: 'left' | 'right' } | { type: 'draw' } | { type: 'pass' };

export function handSize(variant: DominoVariant, seats: number): number {
  return variant === 'block' || seats === 2 ? 7 : 5;
}

/** Mischt und teilt aus; es beginnt, wer den höchsten Pasch hat (sonst den höchsten Stein). */
function deal(state: Omit<DominoState, 'chain' | 'hands' | 'boneyard' | 'turn' | 'opening' | 'passes' | 'lacks' | 'lastPlayed'>): DominoState {
  const rng = new Rng(state.rng);
  const pile = rng.shuffle(STONES.map((_, i) => i));
  const size = handSize(state.variant, state.seats);
  const hands = Array.from({ length: state.seats }, () => pile.splice(pile.length - size, size).sort((a, b) => a - b));
  const rank = (s: StoneId) => (isDouble(s) ? 100 : 0) + pipsOf(s) * 2 + STONES[s]![1] / 10;
  let opening = hands[0]![0]!;
  let turn = 0;
  hands.forEach((hand, seat) => {
    for (const s of hand) {
      if (rank(s) > rank(opening)) {
        opening = s;
        turn = seat;
      }
    }
  });
  return {
    ...state,
    chain: [],
    hands,
    boneyard: pile,
    turn,
    opening,
    passes: 0,
    lacks: Array.from({ length: state.seats }, () => []),
    lastPlayed: null,
    rng: rng.state,
  };
}

export function setup(seats: number, options: Options, seed: string): DominoState {
  const variant: DominoVariant = options.variant === 'block' ? 'block' : options.variant === 'fives' ? 'fives' : 'draw';
  return deal({
    seats,
    variant,
    target: Number(options.target ?? 100),
    round: 1,
    scores: Array(seats).fill(0),
    lastRound: null,
    over: false,
    rng: Rng.fromSeed(seed, 'mischen').state,
  });
}

/** Offene Enden der Kette (bei leerer Kette null). */
export function ends(chain: readonly ChainStone[]): [number, number] | null {
  if (chain.length === 0) return null;
  return [chain[0]!.left, chain[chain.length - 1]!.right];
}

/** Fünfer-Domino: Summe der offenen Enden; ein Pasch am Ende zählt doppelt. */
export function endSum(chain: readonly ChainStone[]): number {
  if (chain.length === 0) return 0;
  if (chain.length === 1) return pipsOf(chain[0]!.stone);
  const first = chain[0]!;
  const last = chain[chain.length - 1]!;
  return (isDouble(first.stone) ? 2 : 1) * first.left + (isDouble(last.stone) ? 2 : 1) * last.right;
}

export function playsFor(state: Pick<DominoState, 'chain' | 'opening'>, hand: readonly StoneId[]): DominoMove[] {
  if (state.chain.length === 0) {
    const first = state.opening !== null && hand.includes(state.opening) ? [state.opening] : hand;
    return first.map((stone) => ({ type: 'play', stone, end: 'right' }));
  }
  const [l, r] = ends(state.chain)!;
  const moves: DominoMove[] = [];
  for (const stone of hand) {
    const [a, b] = STONES[stone]!;
    if (a === l || b === l) moves.push({ type: 'play', stone, end: 'left' });
    // Gleiche Enden: nur eine Seite anbieten, das Ergebnis ist dasselbe.
    if ((a === r || b === r) && !(l === r && state.chain.length > 0)) moves.push({ type: 'play', stone, end: 'right' });
  }
  return moves;
}

function ownHand(state: DominoState, seat: SeatId): StoneId[] {
  return (state.hands[seat] ?? []).filter((s): s is StoneId => s !== null);
}

export function currentPlayers(state: DominoState): Actor[] {
  return state.over ? [] : [state.turn];
}

export function legalMoves(state: DominoState, actor: Actor): DominoMove[] {
  if (actor !== state.turn || state.over) return [];
  const plays = playsFor(state, ownHand(state, actor));
  if (plays.length > 0) return plays;
  if (state.variant !== 'block' && state.boneyard.length > 0) return [{ type: 'draw' }];
  return [{ type: 'pass' }];
}

export function isLegal(state: DominoState, actor: Actor, move: DominoMove): boolean {
  return legalMoves(state, actor).some((m) => m.type === move.type && (m.type !== 'play' || (move.type === 'play' && m.stone === move.stone && m.end === move.end)));
}

/** Fünfer-Domino rundet die Restaugen auf das nächste Vielfache von 5. */
const roundToFive = (n: number) => Math.round(n / 5) * 5;

function endRound(state: DominoState, winner: SeatId | null, blocked: boolean, events: GameEvent[]): DominoState {
  const hands = state.hands.map((h) => h.filter((s): s is StoneId => s !== null));
  const rest = hands.map((h) => h.reduce((sum, s) => sum + pipsOf(s), 0));
  let points = 0;
  if (winner !== null) {
    points = rest.reduce((sum, p, seat) => (seat === winner ? sum : sum + p), 0);
    if (state.variant === 'fives') points = roundToFive(points);
  }
  const scores = [...state.scores];
  if (winner !== null) scores[winner]! += points;
  const summary: RoundSummary = { round: state.round, winner, points, blocked, hands };
  events.push({ type: 'roundOver', winner, points, blocked, hands });
  const next = { ...state, scores, lastRound: summary };
  if (scores.some((s) => s >= state.target)) {
    events.push({ type: 'over' });
    return { ...next, over: true };
  }
  return deal({ ...next, round: state.round + 1 });
}

export function applyMove(state: DominoState, actor: Actor, move: DominoMove): MoveResult<DominoState> {
  if (!isLegal(state, actor, move)) throw new Error('Dieser Zug ist nicht erlaubt.');
  const seat = actor as SeatId;
  const events: GameEvent[] = [];
  const nextSeat = (seat + 1) % state.seats;

  if (move.type === 'draw') {
    const boneyard = [...state.boneyard];
    const stone = boneyard.pop()!;
    const hands = state.hands.map((h, s) => (s === seat ? [...h, stone].sort((a, b) => (a as number) - (b as number)) : h));
    const lacks = noteLack(state, seat);
    events.push({ type: 'drew', seat, stone });
    return { state: { ...state, hands, boneyard, lacks }, events };
  }

  if (move.type === 'pass') {
    events.push({ type: 'passed', seat });
    const next = { ...state, turn: nextSeat, passes: state.passes + 1, lacks: noteLack(state, seat) };
    if (next.passes >= state.seats) {
      // Gesperrt: Es gewinnt, wer die wenigsten Augen hat (bei Gleichstand niemand).
      const rest = state.hands.map((h) => h.reduce((sum: number, s) => sum + pipsOf(s as StoneId), 0));
      const low = Math.min(...rest);
      const lowest = rest.flatMap((r, s) => (r === low ? [s] : []));
      return { state: endRound(next, lowest.length === 1 ? lowest[0]! : null, true, events), events };
    }
    return { state: next, events };
  }

  const [a, b] = STONES[move.stone]!;
  const chain = [...state.chain];
  if (chain.length === 0) chain.push({ stone: move.stone, left: a, right: b });
  else if (move.end === 'left') {
    const l = chain[0]!.left;
    chain.unshift({ stone: move.stone, left: b === l ? a : b, right: l });
  } else {
    const r = chain[chain.length - 1]!.right;
    chain.push({ stone: move.stone, left: r, right: a === r ? b : a });
  }
  const hands = state.hands.map((h, s) => (s === seat ? h.filter((x) => x !== move.stone) : h));
  const scores = [...state.scores];
  let scored = 0;
  if (state.variant === 'fives') {
    const sum = endSum(chain);
    if (sum > 0 && sum % 5 === 0) scored = sum;
    scores[seat]! += scored;
  }
  events.push({ type: 'played', seat, stone: move.stone, end: move.end, scored });
  let next: DominoState = { ...state, chain, hands, scores, turn: nextSeat, opening: null, passes: 0, lastPlayed: { seat, stone: move.stone, end: move.end, scored } };
  if (scores[seat]! >= state.target) {
    events.push({ type: 'over' });
    return { state: { ...next, over: true }, events };
  }
  if (hands[seat]!.length === 0) next = endRound(next, seat, false, events);
  return { state: next, events };
}

/** Wer ziehen oder passen muss, hat keine der beiden Endzahlen – das sehen alle. */
function noteLack(state: DominoState, seat: SeatId): number[][] {
  const e = ends(state.chain);
  if (!e) return state.lacks;
  return state.lacks.map((l, s) => (s === seat ? [...new Set([...l, ...e])].sort() : l));
}

export function result(state: DominoState): Result | null {
  if (!state.over) return null;
  const best = Math.max(...state.scores);
  const winners = state.scores.flatMap((s, seat) => (s === best ? [seat] : []));
  return winners.length === state.seats ? { kind: 'draw' } : { kind: 'win', winners };
}

export function playerView(state: DominoState, seat: SeatId | 'spectator'): DominoState {
  return {
    ...state,
    hands: state.hands.map((h, s) => (s === seat ? h : h.map(() => null))),
    boneyard: state.boneyard.map(() => null),
    rng: [0, 0, 0, 0],
  };
}

/** Den gezogenen Stein sieht nur, wer zieht. */
export function eventView(event: GameEvent, seat: SeatId | 'spectator'): GameEvent | null {
  if (event.type === 'drew' && event.seat !== seat) return { type: 'drew', seat: event.seat };
  return event;
}

/** Für Bots: unbekannte Steine verteilen und dabei beachten, welche Zahlen ein Platz sicher nicht hat. */
export function sampleHidden(view: DominoState, seat: SeatId, rng: Rng): DominoState {
  const known = new Set<StoneId>([...view.chain.map((c) => c.stone), ...ownHand(view, seat)]);
  const unknown = rng.shuffle(STONES.map((_, i) => i).filter((s) => !known.has(s)));
  const fits = (s: StoneId, other: SeatId) => !(view.lacks[other] ?? []).some((n) => STONES[s]![0] === n || STONES[s]![1] === n);
  const hands = view.hands.map((h) => [...h]);
  const pool = [...unknown];
  for (let other = 0; other < view.seats; other++) {
    if (other === seat) continue;
    hands[other] = hands[other]!.map(() => {
      const i = pool.findIndex((s) => fits(s, other));
      return pool.splice(i >= 0 ? i : 0, 1)[0]!;
    });
  }
  return { ...view, hands, boneyard: pool, rng: rng.state };
}
