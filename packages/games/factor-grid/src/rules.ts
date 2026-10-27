import type { Actor, GameEvent, MoveResult, Options, Result, SeatId } from '@brett-und-blatt/engine';

export type FactorVariant = 'taxman' | 'chain';

export interface LastAction {
  actor: number;
  picked: number;
  taxed: number[];
  swept: number[];
}

export interface FactorGridState {
  seats: number;
  variant: FactorVariant;
  size: number;
  /** Besitzer jeder Zahl 1..size (Index = n - 1): 0 = Platz 1, 1 = Platz 2 bzw. Steuereintreiber, null = frei. */
  owners: (0 | 1 | null)[];
  /** Punktestand: [Platz 1, Platz 2 bzw. Steuereintreiber]. */
  scores: [number, number];
  turn: 0 | 1;
  lastPick: number | null;
  history: number[];
  lastAction: LastAction | null;
  phase: 'play' | 'done';
  winner: 0 | 1 | 'draw' | null;
}

export type FactorGridMove = {
  type: 'pick';
  number: number;
};

/** Liefert alle noch freien echten Teiler von `n` (d. h. 1 <= d < n mit n % d === 0). */
export function freeProperDivisors(n: number, owners: readonly (0 | 1 | null)[]): number[] {
  const divs: number[] = [];
  for (let d = 1; d * 2 <= n; d++) {
    if (n % d === 0 && owners[d - 1] === null) {
      divs.push(d);
    }
  }
  return divs;
}

/** Liefert für den Kettenmodus alle freien Nachbarzahlen (Teiler oder Vielfache von `lastPick`). */
export function freeChainNeighbors(lastPick: number | null, size: number, owners: readonly (0 | 1 | null)[]): number[] {
  const res: number[] = [];
  for (let n = 1; n <= size; n++) {
    if (owners[n - 1] !== null) continue;
    if (lastPick === null) {
      if (n % 2 === 0) res.push(n);
    } else if (n % lastPick === 0 || lastPick % n === 0) {
      res.push(n);
    }
  }
  return res;
}

/** Liefert alle erlaubten Zahlen für den aktuellen Zustand. */
export function validNumbers(state: FactorGridState): number[] {
  if (state.phase === 'done') return [];
  if (state.variant === 'chain') {
    return freeChainNeighbors(state.lastPick, state.size, state.owners);
  }
  const res: number[] = [];
  for (let n = 2; n <= state.size; n++) {
    if (state.owners[n - 1] !== null) continue;
    if (freeProperDivisors(n, state.owners).length > 0) {
      res.push(n);
    }
  }
  return res;
}

export function setup(seats: number, options: Options): FactorGridState {
  const variant: FactorVariant = options.variant === 'chain' ? 'chain' : 'taxman';
  const parsedSize = Number(options.gridSize);
  const size = parsedSize === 20 || parsedSize === 50 ? parsedSize : 30;

  return {
    seats,
    variant,
    size,
    owners: Array.from({ length: size }, () => null),
    scores: [0, 0],
    turn: 0,
    lastPick: null,
    history: [],
    lastAction: null,
    phase: 'play',
    winner: null,
  };
}

export function currentPlayers(state: FactorGridState): Actor[] {
  if (state.phase === 'done') return [];
  return [state.turn];
}

export function isLegal(state: FactorGridState, actor: Actor, move: FactorGridMove): boolean {
  if (state.phase === 'done' || actor !== state.turn) return false;
  if (!move || move.type !== 'pick' || !Number.isInteger(move.number)) return false;
  const n = move.number;
  if (n < 1 || n > state.size || state.owners[n - 1] !== null) return false;
  if (state.variant === 'chain') {
    if (state.lastPick === null) return n % 2 === 0;
    return n % state.lastPick === 0 || state.lastPick % n === 0;
  }
  return freeProperDivisors(n, state.owners).length > 0;
}

export function legalMoves(state: FactorGridState, actor: Actor): FactorGridMove[] {
  if (state.phase === 'done' || actor !== state.turn) return [];
  return validNumbers(state).map((number) => ({ type: 'pick', number }));
}

export function applyMove(state: FactorGridState, actor: Actor, move: FactorGridMove): MoveResult<FactorGridState> {
  if (!isLegal(state, actor, move) || typeof actor !== 'number') {
    return { state, events: [] };
  }

  const n = move.number;
  const owners = [...state.owners];
  const scores: [number, number] = [state.scores[0], state.scores[1]];
  const pickOwner = actor as 0 | 1;
  const otherOwner: 0 | 1 = pickOwner === 0 ? 1 : 0;

  const events: GameEvent[] = [];

  if (state.variant === 'chain') {
    owners[n - 1] = pickOwner;
    scores[pickOwner] += 1;
    const nextTurn: 0 | 1 = state.seats === 1 ? 0 : otherOwner;
    const history = [...state.history, n];
    const remaining = freeChainNeighbors(n, state.size, owners);
    const isDone = remaining.length === 0;
    let winner: FactorGridState['winner'] = null;
    if (isDone) {
      if (state.seats === 1) {
        // Solo-Kette: Ziel ist mindestens die Hälfte aller Zahlen (z. B. 10 bei 20, 15 bei 30)
        winner = history.length >= Math.floor(state.size / 2) ? 0 : 1;
      } else {
        winner = pickOwner;
      }
    }
    events.push({ type: 'picked', seat: actor, number: n });
    if (isDone) events.push({ type: 'gameOver', winner });

    return {
      state: {
        ...state,
        owners,
        scores,
        turn: nextTurn,
        lastPick: n,
        history,
        lastAction: { actor, picked: n, taxed: [], swept: [] },
        phase: isDone ? 'done' : 'play',
        winner,
      },
      events,
    };
  }

  // Variante 'taxman' (Steuereintreiber)
  const taxed = freeProperDivisors(n, owners);
  owners[n - 1] = pickOwner;
  scores[pickOwner] += n;
  for (const d of taxed) {
    owners[d - 1] = otherOwner;
    scores[otherOwner] += d;
  }

  const nextTurn: 0 | 1 = state.seats === 1 ? 0 : otherOwner;
  const history = [...state.history, n];

  // Prüfen, ob noch irgendeine freie Zahl echte freie Teiler hat
  let hasMoreMoves = false;
  for (let k = 2; k <= state.size; k++) {
    if (owners[k - 1] === null && freeProperDivisors(k, owners).length > 0) {
      hasMoreMoves = true;
      break;
    }
  }

  const swept: number[] = [];
  let winner: FactorGridState['winner'] = null;
  if (!hasMoreMoves) {
    // Im Solo-Modus kassiert der Steuereintreiber (Index 1) alle restlichen Zahlen
    if (state.seats === 1) {
      for (let k = 1; k <= state.size; k++) {
        if (owners[k - 1] === null) {
          owners[k - 1] = 1;
          scores[1] += k;
          swept.push(k);
        }
      }
    }
    if (scores[0] > scores[1]) winner = 0;
    else if (scores[1] > scores[0]) winner = 1;
    else winner = 'draw';
  }

  events.push({ type: 'picked', seat: actor, number: n, taxedCount: taxed.length });
  if (!hasMoreMoves) events.push({ type: 'gameOver', winner });

  return {
    state: {
      ...state,
      owners,
      scores,
      turn: nextTurn,
      lastPick: n,
      history,
      lastAction: { actor, picked: n, taxed, swept },
      phase: hasMoreMoves ? 'play' : 'done',
      winner,
    },
    events,
  };
}

export function playerView(state: FactorGridState, _viewer: SeatId): FactorGridState {
  return state;
}

export function result(state: FactorGridState): Result | null {
  if (state.phase !== 'done') return null;
  if (state.seats === 1) {
    if (state.winner === 0) return { kind: 'win', winners: [0] };
    if (state.winner === 'draw') return { kind: 'draw' };
    return { kind: 'loss' };
  }
  if (state.winner === 'draw') {
    return { kind: 'draw' };
  }
  return {
    kind: 'win',
    winners: [state.winner ?? 0],
  };
}
