import { Rng, type Actor, type GameEvent, type MoveResult, type Options, type Result, type RngState, type SeatId } from '@brett-und-blatt/engine';

/** Ein Stein des Domino-Spiels (abhängig von der Satzgröße bis Doppel-12: 0 … 90). */
export type StoneId = number;

/** Alle 91 Steine [a|b] mit a ≤ b (0..27 = Doppel-6 in Originalreihenfolge, 28..54 = zusätzliche Doppel-9-Steine, 55..90 = zusätzliche Doppel-12-Steine). */
export const STONES: readonly (readonly [number, number])[] = (() => {
  const list: [number, number][] = [];
  const seen = new Set<string>();
  const addUpTo = (max: number) => {
    for (let a = 0; a <= max; a++) {
      for (let b = a; b <= max; b++) {
        const key = `${a}|${b}`;
        if (!seen.has(key)) {
          seen.add(key);
          list.push([a, b]);
        }
      }
    }
  };
  addUpTo(6);
  addUpTo(9);
  addUpTo(12);
  return list;
})();

/** Liefert die Anzahl der Steine für Doppel-6 (28), Doppel-9 (55) oder Doppel-12 (91). */
export function stoneCountForSet(maxPip: 6 | 9 | 12 = 6): number {
  return ((maxPip + 1) * (maxPip + 2)) / 2;
}

/** Findet die StoneId für das Augenpaar (a, b). */
export function stoneIdOf(a: number, b: number): StoneId {
  const lo = Math.min(a, b);
  const hi = Math.max(a, b);
  return STONES.findIndex(([x, y]) => x === lo && y === hi);
}

export const pipsOf = (stone: StoneId) => STONES[stone]![0] + STONES[stone]![1];
export const isDouble = (stone: StoneId) => STONES[stone]![0] === STONES[stone]![1];

export type DominoVariant = 'block' | 'draw' | 'fives' | 'mexican';
export type DominoDisplay = 'pips' | 'terms' | 'fractions';
export type TrainTarget = 'mexican' | `seat-${number}`;
export type DominoEnd = 'left' | 'right' | 'up' | 'down' | TrainTarget;

export const TERM_POOL: Record<number, readonly string[]> = {
  0: ['5 − 5', '0 · 9', '8 − 8', '6 − 6', '3 − 3', '0 : 7', '4 − 4'],
  1: ['7 : 7', '9 − 8', '5⁰', '12 − 11', '6 : 6', '4 − 3', '10 − 9'],
  2: ['10 : 5', '8 : 4', '6 − 4', '14 : 7', '9 − 7', '18 : 9', '11 − 9'],
  3: ['12 : 4', '15 : 5', '9 − 6', '21 : 7', '11 − 8', '27 : 9', '18 : 6'],
  4: ['2²', '12 : 3', '20 : 5', '11 − 7', '28 : 7', '16 : 4', '13 − 9'],
  5: ['15 : 3', '20 : 4', '12 − 7', '35 : 7', '14 − 9', '45 : 9', '25 : 5'],
  6: ['2 · 3', '18 : 3', '24 : 4', '15 − 9', '42 : 7', '30 : 5', '14 − 8'],
  7: ['14 : 2', '21 : 3', '15 − 8', '28 : 4', '16 − 9', '35 : 5', '49 : 7'],
  8: ['2³', '16 : 2', '24 : 3', '32 : 4', '17 − 9', '40 : 5', '15 − 7'],
  9: ['3²', '18 : 2', '27 : 3', '36 : 4', '45 : 5', '17 − 8', '3 · 3'],
  10: ['2 · 5', '20 : 2', '30 : 3', '40 : 4', '50 : 5', '18 − 8', '19 − 9'],
  11: ['22 : 2', '33 : 3', '44 : 4', '55 : 5', '20 − 9', '19 − 8', '18 − 7'],
  12: ['3 · 4', '2 · 6', '24 : 2', '36 : 3', '48 : 4', '60 : 5', '21 − 9'],
};

export const FRACTION_POOL: Record<number, readonly string[]> = {
  0: ['0/4', '0,0', '0 %', '0/8', '0/3', '0/5', '0/10'],
  1: ['2/2', '100 %', '4/4', '0,5 · 2', '3/3', '0,25 · 4', '5/5'],
  2: ['4/2', '6/3', '8/4', '1,5 + 0,5', '10/5', '2,5 − 0,5', '12/6'],
  3: ['6/2', '9/3', '12/4', '1,5 · 2', '15/5', '2,5 + 0,5', '18/6'],
  4: ['8/2', '12/3', '16/4', '2,5 + 1,5', '20/5', '0,5 · 8', '24/6'],
  5: ['10/2', '15/3', '20/4', '2,5 · 2', '25/5', '3,5 + 1,5', '30/6'],
  6: ['12/2', '18/3', '24/4', '1,5 · 4', '30/5', '4,5 + 1,5', '36/6'],
  7: ['14/2', '21/3', '28/4', '3,5 · 2', '35/5', '4,5 + 2,5', '42/6'],
  8: ['16/2', '24/3', '32/4', '2,5 + 5,5', '40/5', '0,5 · 16', '48/6'],
  9: ['18/2', '27/3', '36/4', '4,5 · 2', '45/5', '6,5 + 2,5', '54/6'],
  10: ['20/2', '30/3', '40/4', '2,5 · 4', '50/5', '7,5 + 2,5', '60/6'],
  11: ['22/2', '33/3', '44/4', '5,5 · 2', '55/5', '8,5 + 2,5', '66/6'],
  12: ['24/2', '36/3', '48/4', '1,5 · 8', '60/5', '9,5 + 2,5', '72/6'],
};

/** Liefert die Beschriftung einer Steinhälfte im gewählten Darstellungsmodus. */
export function halfLabel(value: number, display: DominoDisplay = 'pips', stone: StoneId = 0, side: 0 | 1 = 0): string {
  if (display === 'pips') return String(value);
  const pool = display === 'fractions' ? FRACTION_POOL[value] : TERM_POOL[value];
  if (!pool || pool.length === 0) return String(value);
  const index = (stone * 3 + side * 5 + value) % pool.length;
  return pool[index]!;
}

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
  display: DominoDisplay;
  target: number;
  spinner: boolean;
  /** Partnermodus zu viert: Sitz 0 & 2 gegen Sitz 1 & 3. */
  teams: boolean;
  /** Höchste Augenzahl im Dominosatz (6, 9 oder 12). */
  setSize: 6 | 9 | 12;
  round: number;
  chain: ChainStone[];
  /** Index des ersten gespielten Pasches in `chain` (Spinner beim Fünfer-Domino). */
  spinnerIndex: number | null;
  /** Am Spinner nach oben angelegte Steine (right = äußeres Ende). */
  upBranch: ChainStone[];
  /** Am Spinner nach unten angelegte Steine (right = äußeres Ende). */
  downBranch: ChainStone[];
  /** Mexican Train: zentraler Bahnhofswert (Engine). */
  engineValue?: number;
  /** Mexican Train: persönlicher Zug je Sitzplatz (right = äußeres Ende). */
  playerTrains?: ChainStone[][];
  /** Mexican Train: gemeinsamer Zug (right = äußeres Ende). */
  mexicanTrain?: ChainStone[];
  /** Mexican Train: ob der persönliche Zug eines Spielers öffentlich (mit Münze) freigegeben ist. */
  trainOpen?: boolean[];
  /** Ob im aktuellen Zug bereits vom Vorrat gezogen wurde (für Mexican Train). */
  drewThisTurn: boolean;
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
  lastPlayed: { seat: SeatId; stone: StoneId; end: DominoEnd; scored: number } | null;
  lastRound: RoundSummary | null;
  over: boolean;
  /** Zufall für das Mischen der nächsten Runden; in der Sicht genullt. */
  rng: RngState;
}

export type DominoMove = { type: 'play'; stone: StoneId; end: DominoEnd } | { type: 'draw' } | { type: 'pass' };

export function handSize(variant: DominoVariant, seats: number, setSize: 6 | 9 | 12 = 6): number {
  if (variant === 'mexican') {
    if (setSize === 12) return seats === 2 ? 15 : seats === 3 ? 13 : 12;
    if (setSize === 9) return seats === 2 ? 10 : seats === 3 ? 9 : 8;
    return seats === 2 ? 7 : 5;
  }
  if (setSize === 9) return seats === 2 ? 9 : 7;
  if (setSize === 12) return seats === 2 ? 12 : 9;
  return variant === 'block' || seats === 2 ? 7 : 5;
}

/** Mischt und teilt aus; es beginnt, wer den höchsten Pasch hat (sonst den höchsten Stein). Beim Mexican Train liegt der Bahnhof in der Mitte. */
function deal(state: Omit<DominoState, 'chain' | 'spinnerIndex' | 'upBranch' | 'downBranch' | 'hands' | 'boneyard' | 'turn' | 'opening' | 'passes' | 'lacks' | 'lastPlayed' | 'engineValue' | 'playerTrains' | 'mexicanTrain' | 'trainOpen' | 'drewThisTurn'>): DominoState {
  const rng = new Rng(state.rng);
  const count = stoneCountForSet(state.setSize);

  if (state.variant === 'mexican') {
    const engineVal = state.setSize - ((state.round - 1) % (state.setSize + 1));
    const engineStone = stoneIdOf(engineVal, engineVal);
    const poolIds: StoneId[] = [];
    for (let i = 0; i < count; i++) {
      if (i !== engineStone) poolIds.push(i);
    }
    const pile = rng.shuffle(poolIds);
    const size = handSize(state.variant, state.seats, state.setSize);
    const hands = Array.from({ length: state.seats }, () => pile.splice(pile.length - size, size).sort((a, b) => a - b));
    return {
      ...state,
      chain: [{ stone: engineStone, left: engineVal, right: engineVal }],
      spinnerIndex: null,
      upBranch: [],
      downBranch: [],
      engineValue: engineVal,
      playerTrains: Array.from({ length: state.seats }, () => []),
      mexicanTrain: [],
      trainOpen: Array(state.seats).fill(false),
      drewThisTurn: false,
      hands,
      boneyard: pile,
      turn: (state.round - 1) % state.seats,
      opening: null,
      passes: 0,
      lacks: Array.from({ length: state.seats }, () => []),
      lastPlayed: null,
      rng: rng.state,
    };
  }

  const pile = rng.shuffle(Array.from({ length: count }, (_, i) => i));
  const size = handSize(state.variant, state.seats, state.setSize);
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
    spinnerIndex: null,
    upBranch: [],
    downBranch: [],
    drewThisTurn: false,
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
  const variant: DominoVariant =
    options.variant === 'block'
      ? 'block'
      : options.variant === 'fives'
        ? 'fives'
        : options.variant === 'mexican'
          ? 'mexican'
          : 'draw';
  const display: DominoDisplay = options.display === 'terms' || options.display === 'fractions' ? options.display : 'pips';
  const spinner = variant === 'fives' && options.spinner === 'yes';
  const teams = seats === 4 && variant !== 'mexican' && options.teams === 'yes';
  const rawSet = Number(options.setSize ?? (variant === 'mexican' ? 9 : 6));
  const setSize: 6 | 9 | 12 = rawSet === 12 ? 12 : rawSet === 9 ? 9 : 6;
  return deal({
    seats,
    variant,
    display,
    target: Number(options.target ?? 100),
    spinner,
    teams,
    setSize,
    round: 1,
    scores: Array(seats).fill(0),
    lastRound: null,
    over: false,
    rng: Rng.fromSeed(seed, 'mischen').state,
  });
}

/** Prüft, ob der Spinner aktiv ist und Quer-Verzweigungen (up/down) erlaubt. */
export function isSpinnerOpen(state: Pick<DominoState, 'spinner' | 'spinnerIndex' | 'chain'>): boolean {
  return (
    state.spinner &&
    state.spinnerIndex !== null &&
    state.spinnerIndex > 0 &&
    state.spinnerIndex < state.chain.length - 1
  );
}

export interface OpenEnds {
  left: number;
  right: number;
  up?: number;
  down?: number;
}

/** Offene Enden und deren Augenzahlen (unter Berücksichtigung des Spinners). */
export function activeEnds(state: Pick<DominoState, 'chain' | 'spinner' | 'spinnerIndex' | 'upBranch' | 'downBranch'>): OpenEnds | null {
  if (state.chain.length === 0) return null;
  const left = state.chain[0]!.left;
  const right = state.chain[state.chain.length - 1]!.right;
  if (!isSpinnerOpen(state)) return { left, right };

  const sVal = state.chain[state.spinnerIndex!]!.left;
  const up = state.upBranch.length > 0 ? state.upBranch[state.upBranch.length - 1]!.right : sVal;
  const down = state.downBranch.length > 0 ? state.downBranch[state.downBranch.length - 1]!.right : sVal;
  return { left, right, up, down };
}

/** Offene Enden beim Mexican Train für den Spieler `seat`. */
export function mexicanOpenTargets(
  state: Pick<DominoState, 'seats' | 'engineValue' | 'playerTrains' | 'mexicanTrain' | 'trainOpen'>,
  seat: SeatId,
): { end: TrainTarget; value: number }[] {
  const eng = state.engineValue ?? 0;
  const pTrains = state.playerTrains ?? [];
  const mTrain = state.mexicanTrain ?? [];
  const open = state.trainOpen ?? [];
  const list: { end: TrainTarget; value: number }[] = [];

  for (let s = 0; s < state.seats; s++) {
    if (s === seat || open[s]) {
      const tr = pTrains[s] ?? [];
      const val = tr.length > 0 ? tr[tr.length - 1]!.right : eng;
      list.push({ end: `seat-${s}`, value: val });
    }
  }
  const mVal = mTrain.length > 0 ? mTrain[mTrain.length - 1]!.right : eng;
  list.push({ end: 'mexican', value: mVal });
  return list;
}

/** Offene Enden der linearen Kette (bei leerer Kette null) – für Rückwärtskompatibilität. */
export function ends(chain: readonly ChainStone[]): [number, number] | null {
  if (chain.length === 0) return null;
  return [chain[0]!.left, chain[chain.length - 1]!.right];
}

/** Fünfer-Domino: Summe der offenen Enden; ein Pasch am Ende zählt doppelt. */
export function endSum(chain: readonly ChainStone[]): number;
export function endSum(state: Pick<DominoState, 'chain' | 'spinner' | 'spinnerIndex' | 'upBranch' | 'downBranch'>): number;
export function endSum(input: readonly ChainStone[] | Pick<DominoState, 'chain' | 'spinner' | 'spinnerIndex' | 'upBranch' | 'downBranch'>): number {
  if (!('chain' in input)) {
    if (input.length === 0) return 0;
    if (input.length === 1) return pipsOf(input[0]!.stone);
    const first = input[0]!;
    const last = input[input.length - 1]!;
    return (isDouble(first.stone) ? 2 : 1) * first.left + (isDouble(last.stone) ? 2 : 1) * last.right;
  }
  const state = input;
  if (state.chain.length === 0) return 0;
  if (state.chain.length === 1) return pipsOf(state.chain[0]!.stone);

  const first = state.chain[0]!;
  const last = state.chain[state.chain.length - 1]!;
  let sum = (isDouble(first.stone) ? 2 : 1) * first.left + (isDouble(last.stone) ? 2 : 1) * last.right;

  if (isSpinnerOpen(state)) {
    const sVal = state.chain[state.spinnerIndex!]!.left;
    if (state.upBranch.length === 0) {
      sum += sVal;
    } else {
      const top = state.upBranch[state.upBranch.length - 1]!;
      sum += (isDouble(top.stone) ? 2 : 1) * top.right;
    }

    if (state.downBranch.length === 0) {
      sum += sVal;
    } else {
      const btm = state.downBranch[state.downBranch.length - 1]!;
      sum += (isDouble(btm.stone) ? 2 : 1) * btm.right;
    }
  }

  return sum;
}

export function playsFor(
  state: Pick<DominoState, 'chain' | 'opening' | 'spinner' | 'spinnerIndex' | 'upBranch' | 'downBranch'> &
    Partial<Pick<DominoState, 'variant' | 'seats' | 'turn' | 'engineValue' | 'playerTrains' | 'mexicanTrain' | 'trainOpen'>>,
  hand: readonly StoneId[],
  seat?: SeatId,
): DominoMove[] {
  if (state.variant === 'mexican') {
    const actor = seat ?? state.turn ?? 0;
    const targets = mexicanOpenTargets(
      {
        seats: state.seats ?? 2,
        engineValue: state.engineValue ?? 0,
        playerTrains: state.playerTrains ?? [],
        mexicanTrain: state.mexicanTrain ?? [],
        trainOpen: state.trainOpen ?? [],
      },
      actor,
    );
    const moves: DominoMove[] = [];
    for (const stone of hand) {
      const [a, b] = STONES[stone]!;
      for (const t of targets) {
        if (a === t.value || b === t.value) {
          moves.push({ type: 'play', stone, end: t.end });
        }
      }
    }
    return moves;
  }

  if (state.chain.length === 0) {
    const first = state.opening !== null && hand.includes(state.opening) ? [state.opening] : hand;
    return first.map((stone) => ({ type: 'play', stone, end: 'right' }));
  }
  const e = activeEnds(state)!;
  const moves: DominoMove[] = [];
  for (const stone of hand) {
    const [a, b] = STONES[stone]!;
    if (a === e.left || b === e.left) moves.push({ type: 'play', stone, end: 'left' });
    // Gleiche Enden: nur eine Seite anbieten, das Ergebnis ist dasselbe.
    if ((a === e.right || b === e.right) && !(e.left === e.right && state.chain.length > 0)) {
      moves.push({ type: 'play', stone, end: 'right' });
    }
    if (e.up !== undefined && (a === e.up || b === e.up)) {
      moves.push({ type: 'play', stone, end: 'up' });
    }
    if (e.down !== undefined && (a === e.down || b === e.down)) {
      moves.push({ type: 'play', stone, end: 'down' });
    }
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
  const plays = playsFor(state, ownHand(state, actor), actor);
  if (plays.length > 0) return plays;
  if (state.variant === 'mexican') {
    if (!state.drewThisTurn && state.boneyard.length > 0) return [{ type: 'draw' }];
    return [{ type: 'pass' }];
  }
  if (state.variant !== 'block' && state.boneyard.length > 0) return [{ type: 'draw' }];
  return [{ type: 'pass' }];
}

export function isLegal(state: DominoState, actor: Actor, move: DominoMove): boolean {
  return legalMoves(state, actor).some((m) => m.type === move.type && (m.type !== 'play' || (move.type === 'play' && m.stone === move.stone && m.end === move.end)));
}

/** Fünfer-Domino rundet die Restaugen auf das nächste Vielfache von 5. */
const roundToFive = (n: number) => Math.round(n / 5) * 5;

/** Liefert die Sitzplätze desselben Teams (bei `teams`: [0, 2] bzw. [1, 3]; sonst [seat]). */
export function teamSeats(state: Pick<DominoState, 'teams' | 'seats'>, seat: SeatId): SeatId[] {
  if (!state.teams || state.seats !== 4) return [seat];
  const partner = (seat + 2) % 4;
  return [Math.min(seat, partner), Math.max(seat, partner)];
}

function addScore(scores: number[], state: Pick<DominoState, 'teams' | 'seats'>, seat: SeatId, points: number): void {
  for (const s of teamSeats(state, seat)) {
    scores[s]! += points;
  }
}

function endRound(state: DominoState, winner: SeatId | null, blocked: boolean, events: GameEvent[]): DominoState {
  const hands = state.hands.map((h) => h.filter((s): s is StoneId => s !== null));
  const rest = hands.map((h) => h.reduce((sum, s) => sum + pipsOf(s), 0));
  let points = 0;
  if (winner !== null) {
    if (state.teams && state.seats === 4) {
      const winners = new Set(teamSeats(state, winner));
      points = rest.reduce((sum, p, seat) => (winners.has(seat) ? sum : sum + p), 0);
    } else {
      points = rest.reduce((sum, p, seat) => (seat === winner ? sum : sum + p), 0);
    }
    if (state.variant === 'fives') points = roundToFive(points);
  }
  const scores = [...state.scores];
  if (winner !== null) addScore(scores, state, winner, points);
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
    return {
      state: {
        ...state,
        hands,
        boneyard,
        lacks,
        drewThisTurn: state.variant === 'mexican' ? true : state.drewThisTurn,
      },
      events,
    };
  }

  if (move.type === 'pass') {
    events.push({ type: 'passed', seat });
    const next: DominoState = {
      ...state,
      turn: nextSeat,
      passes: state.passes + 1,
      lacks: noteLack(state, seat),
      drewThisTurn: false,
      ...(state.variant === 'mexican' && state.trainOpen
        ? { trainOpen: state.trainOpen.map((open, s) => (s === seat ? true : open)) }
        : {}),
    };
    if (next.passes >= state.seats) {
      const rest = state.hands.map((h) => h.reduce((sum: number, s) => sum + pipsOf(s as StoneId), 0));
      if (state.teams && state.seats === 4) {
        const team0 = rest[0]! + rest[2]!;
        const team1 = rest[1]! + rest[3]!;
        const winnerSeat = team0 < team1 ? 0 : team1 < team0 ? 1 : null;
        return { state: endRound(next, winnerSeat, true, events), events };
      }
      const low = Math.min(...rest);
      const lowest = rest.flatMap((r, s) => (r === low ? [s] : []));
      return { state: endRound(next, lowest.length === 1 ? lowest[0]! : null, true, events), events };
    }
    return { state: next, events };
  }

  const [a, b] = STONES[move.stone]!;

  if (state.variant === 'mexican') {
    const eng = state.engineValue ?? 0;
    const playerTrains = (state.playerTrains ?? []).map((tr) => [...tr]);
    const mexicanTrain = [...(state.mexicanTrain ?? [])];
    const trainOpen = [...(state.trainOpen ?? [])];

    if (move.end === 'mexican') {
      const openVal = mexicanTrain.length > 0 ? mexicanTrain[mexicanTrain.length - 1]!.right : eng;
      mexicanTrain.push({ stone: move.stone, left: openVal, right: a === openVal ? b : a });
    } else if (move.end.startsWith('seat-')) {
      const targetSeat = Number(move.end.slice(5));
      const tr = playerTrains[targetSeat]!;
      const openVal = tr.length > 0 ? tr[tr.length - 1]!.right : eng;
      tr.push({ stone: move.stone, left: openVal, right: a === openVal ? b : a });
      if (targetSeat === seat) {
        trainOpen[seat] = false;
      }
    }

    const hands = state.hands.map((h, s) => (s === seat ? h.filter((x) => x !== move.stone) : h));
    events.push({ type: 'played', seat, stone: move.stone, end: move.end, scored: 0 });
    // Wer beim Mexican Train einen Pasch legt und noch Steine hat, ist sofort noch einmal am Zug, um den Pasch zu bedienen.
    const extraTurn = isDouble(move.stone) && hands[seat]!.length > 0;
    let next: DominoState = {
      ...state,
      playerTrains,
      mexicanTrain,
      trainOpen,
      drewThisTurn: false,
      hands,
      turn: extraTurn ? seat : nextSeat,
      opening: null,
      passes: 0,
      lastPlayed: { seat, stone: move.stone, end: move.end, scored: 0 },
    };
    if (hands[seat]!.length === 0) next = endRound(next, seat, false, events);
    return { state: next, events };
  }

  const chain = [...state.chain];
  let upBranch = [...state.upBranch];
  let downBranch = [...state.downBranch];
  let spinnerIndex = state.spinnerIndex;

  if (move.end === 'up') {
    const sVal = chain[spinnerIndex!]!.left;
    if (upBranch.length === 0) {
      upBranch.push({ stone: move.stone, left: sVal, right: a === sVal ? b : a });
    } else {
      const top = upBranch[upBranch.length - 1]!.right;
      upBranch.push({ stone: move.stone, left: top, right: a === top ? b : a });
    }
  } else if (move.end === 'down') {
    const sVal = chain[spinnerIndex!]!.left;
    if (downBranch.length === 0) {
      downBranch.push({ stone: move.stone, left: sVal, right: a === sVal ? b : a });
    } else {
      const btm = downBranch[downBranch.length - 1]!.right;
      downBranch.push({ stone: move.stone, left: btm, right: a === btm ? b : a });
    }
  } else if (chain.length === 0) {
    chain.push({ stone: move.stone, left: a, right: b });
    if (state.spinner && isDouble(move.stone)) spinnerIndex = 0;
  } else if (move.end === 'left') {
    const l = chain[0]!.left;
    chain.unshift({ stone: move.stone, left: b === l ? a : b, right: l });
    if (spinnerIndex !== null) spinnerIndex++;
    else if (state.spinner && isDouble(move.stone)) spinnerIndex = 0;
  } else {
    const r = chain[chain.length - 1]!.right;
    chain.push({ stone: move.stone, left: r, right: a === r ? b : a });
    if (state.spinner && isDouble(move.stone) && spinnerIndex === null) {
      spinnerIndex = chain.length - 1;
    }
  }

  const hands = state.hands.map((h, s) => (s === seat ? h.filter((x) => x !== move.stone) : h));
  const scores = [...state.scores];
  let scored = 0;

  const nextStateDraft = { ...state, chain, spinnerIndex, upBranch, downBranch };
  if (state.variant === 'fives') {
    const sum = endSum(nextStateDraft);
    if (sum > 0 && sum % 5 === 0) scored = sum;
    addScore(scores, state, seat, scored);
  }

  events.push({ type: 'played', seat, stone: move.stone, end: move.end, scored });
  let next: DominoState = {
    ...nextStateDraft,
    hands,
    scores,
    turn: nextSeat,
    opening: null,
    passes: 0,
    lastPlayed: { seat, stone: move.stone, end: move.end, scored },
  };

  if (scores[seat]! >= state.target) {
    events.push({ type: 'over' });
    return { state: { ...next, over: true }, events };
  }
  if (hands[seat]!.length === 0) next = endRound(next, seat, false, events);
  return { state: next, events };
}

/** Wer ziehen oder passen muss, hat keine der offenen Endzahlen – das sehen alle. */
function noteLack(state: DominoState, seat: SeatId): number[][] {
  if (state.variant === 'mexican') {
    const values = mexicanOpenTargets(state, seat).map((t) => t.value);
    return state.lacks.map((l, s) => (s === seat ? [...new Set([...l, ...values])].sort((a, b) => a - b) : l));
  }
  const e = activeEnds(state);
  if (!e) return state.lacks;
  const values = [e.left, e.right];
  if (e.up !== undefined) values.push(e.up);
  if (e.down !== undefined) values.push(e.down);
  return state.lacks.map((l, s) => (s === seat ? [...new Set([...l, ...values])].sort((a, b) => a - b) : l));
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
  const trainStones = [
    ...(view.playerTrains ?? []).flatMap((tr) => tr.map((c) => c.stone)),
    ...(view.mexicanTrain ?? []).map((c) => c.stone),
  ];
  const known = new Set<StoneId>([
    ...view.chain.map((c) => c.stone),
    ...view.upBranch.map((c) => c.stone),
    ...view.downBranch.map((c) => c.stone),
    ...trainStones,
    ...ownHand(view, seat),
  ]);
  const count = stoneCountForSet(view.setSize ?? 6);
  const allStones = Array.from({ length: count }, (_, i) => i);
  const unknown = rng.shuffle(allStones.filter((s) => !known.has(s)));
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
