import type { Actor, GameEvent, MoveResult, Options, Result, SeatId } from '@brett-und-blatt/engine';
import { MILLS, MILLS_OF, NEIGHBORS, POINT_COUNT } from './board';

export interface MillState {
  /** Belegung der 24 Punkte: Platz 0 (Weiß), Platz 1 (Schwarz) oder leer. */
  cells: (SeatId | null)[];
  /** Steine, die jeder noch setzen muss. */
  inHand: [number, number];
  turn: SeatId;
  /** Halbzüge seit der letzten Mühle (für die Remis-Regel). */
  sinceMill: number;
  /** Wie oft jede Stellung in der Zugphase schon vorkam. */
  seen: Record<string, number>;
  winner: SeatId | null;
  draw: 'repetition' | 'moveLimit' | null;
  lastMove: MillMove | null;
  rules: {
    flying: boolean;
    /** Schlagen aus Mühlen: nur wenn nichts anderes geht oder immer. */
    removeFromMills: 'fallback' | 'always';
    /** Wer zwei Mühlen auf einmal schließt, nimmt zwei Steine. */
    doubleRemove: boolean;
    /** Halbzüge ohne Mühle bis zum Remis, 0 = aus. */
    drawAfter: number;
  };
}

export type MillMove =
  | { type: 'place'; to: number; remove: number[] }
  | { type: 'move'; from: number; to: number; remove: number[] };

export function setup(_seats: number, options: Options): MillState {
  return {
    cells: Array(POINT_COUNT).fill(null),
    inHand: [9, 9],
    turn: 0,
    sinceMill: 0,
    seen: {},
    winner: null,
    draw: null,
    lastMove: null,
    rules: {
      flying: options.flying !== 'off',
      removeFromMills: options.removeFromMills === 'always' ? 'always' : 'fallback',
      doubleRemove: options.doubleMill === 'two',
      drawAfter: options.drawRule === 'off' ? 0 : Number(options.drawRule ?? 50) * 2,
    },
  };
}

export function stonesOnBoard(cells: readonly (SeatId | null)[], seat: SeatId): number {
  let count = 0;
  for (const cell of cells) if (cell === seat) count++;
  return count;
}

export function isInMill(cells: readonly (SeatId | null)[], point: number): boolean {
  const owner = cells[point];
  if (owner === null || owner === undefined) return false;
  return (MILLS_OF[point] ?? []).some((mill) => mill.every((p) => cells[p] === owner));
}

/** Wie viele Mühlen schließt ein Stein von `seat` auf `point`? */
function millsClosed(cells: readonly (SeatId | null)[], point: number, seat: SeatId): number {
  return (MILLS_OF[point] ?? []).filter((mill) => mill.every((p) => cells[p] === seat)).length;
}

/** Gegnerische Steine, die man nach einer Mühle wegnehmen darf. */
export function removable(state: Pick<MillState, 'rules'>, cells: readonly (SeatId | null)[], opponent: SeatId): number[] {
  const stones = cells.flatMap((cell, point) => (cell === opponent ? [point] : []));
  if (state.rules.removeFromMills === 'always') return stones;
  const free = stones.filter((point) => !isInMill(cells, point));
  return free.length > 0 ? free : stones;
}

export type Phase = 'place' | 'move' | 'fly';

export function phaseOf(state: MillState, seat: SeatId): Phase {
  if (state.inHand[seat as 0 | 1] > 0) return 'place';
  if (state.rules.flying && stonesOnBoard(state.cells, seat) === 3) return 'fly';
  return 'move';
}

export function currentPlayers(state: MillState): Actor[] {
  return result(state) ? [] : [state.turn];
}

/** Alle Ziehbewegungen ohne das Wegnehmen: [von, nach], beim Setzen von = -1. */
function steps(state: MillState, seat: SeatId): [number, number][] {
  const phase = phaseOf(state, seat);
  const empty = state.cells.flatMap((cell, point) => (cell === null ? [point] : []));
  if (phase === 'place') return empty.map((to) => [-1, to]);
  const result: [number, number][] = [];
  state.cells.forEach((cell, from) => {
    if (cell !== seat) return;
    const targets = phase === 'fly' ? empty : (NEIGHBORS[from] ?? []).filter((to) => state.cells[to] === null);
    for (const to of targets) result.push([from, to]);
  });
  return result;
}

/** Alle erlaubten Züge – mit allen Möglichkeiten, was danach weggenommen wird. */
export function legalMoves(state: MillState, actor: Actor): MillMove[] {
  if (actor !== state.turn || result(state)) return [];
  const opponent = 1 - actor;
  const moves: MillMove[] = [];
  for (const [from, to] of steps(state, actor)) {
    const cells = [...state.cells];
    if (from >= 0) cells[from] = null;
    cells[to] = actor;
    const closed = millsClosed(cells, to, actor);
    const base = from < 0 ? { type: 'place' as const, to } : { type: 'move' as const, from, to };
    if (closed === 0) {
      moves.push({ ...base, remove: [] });
      continue;
    }
    const first = removable(state, cells, opponent);
    if (first.length === 0) {
      moves.push({ ...base, remove: [] });
      continue;
    }
    const seen = new Set<string>();
    for (const a of first) {
      if (closed >= 2 && state.rules.doubleRemove) {
        const after = [...cells];
        after[a] = null;
        const second = removable(state, after, opponent);
        if (second.length === 0) moves.push({ ...base, remove: [a] });
        for (const b of second) {
          // {a, b} und {b, a} sind derselbe Zug.
          const pair = [a, b].sort((x, y) => x - y) as [number, number];
          if (seen.has(pair.join())) continue;
          seen.add(pair.join());
          moves.push({ ...base, remove: pair });
        }
      } else {
        moves.push({ ...base, remove: [a] });
      }
    }
  }
  return moves;
}

export function applyMove(state: MillState, actor: Actor, move: MillMove): MoveResult<MillState> {
  if (actor !== state.turn || result(state)) throw new Error('Du bist nicht am Zug.');
  const legal = legalMoves(state, actor).some(
    (m) => m.type === move.type && m.to === move.to && (m.type !== 'move' || (move.type === 'move' && m.from === move.from)) && sameRemoval(m.remove, move.remove),
  );
  if (!legal) throw new Error('Dieser Zug ist nicht erlaubt.');

  const opponent = 1 - actor;
  const cells = [...state.cells];
  const inHand: [number, number] = [...state.inHand];
  const events: GameEvent[] = [];
  if (move.type === 'place') {
    inHand[actor as 0 | 1]--;
    events.push({ type: 'placed', to: move.to, seat: actor });
  } else {
    cells[move.from] = null;
    events.push({ type: 'moved', from: move.from, to: move.to, seat: actor });
  }
  cells[move.to] = actor;
  if (move.remove.length > 0) events.push({ type: 'mill', seat: actor, mills: MILLS.filter((m) => m.includes(move.to) && m.every((p) => cells[p] === actor)) });
  for (const point of move.remove) {
    cells[point] = null;
    events.push({ type: 'removed', point, seat: opponent });
  }

  const next: MillState = {
    ...state,
    cells,
    inHand,
    turn: opponent,
    sinceMill: move.remove.length > 0 ? 0 : state.sinceMill + 1,
    lastMove: move,
  };

  // Verloren hat, wer weniger als drei Steine hat oder nicht mehr ziehen kann.
  const opponentStones = stonesOnBoard(cells, opponent) + inHand[opponent as 0 | 1];
  if (opponentStones < 3 || legalMoves(next, opponent).length === 0) {
    next.winner = actor;
    events.push({ type: 'win', seat: actor });
    return { state: next, events };
  }

  if (inHand[0] === 0 && inHand[1] === 0) {
    const key = `${opponent}:${cells.map((c) => (c === null ? '.' : c)).join('')}`;
    next.seen = { ...state.seen, [key]: (state.seen[key] ?? 0) + 1 };
    if ((next.seen[key] ?? 0) >= 3) next.draw = 'repetition';
    else if (state.rules.drawAfter > 0 && next.sinceMill >= state.rules.drawAfter) next.draw = 'moveLimit';
    if (next.draw) events.push({ type: 'draw', reason: next.draw });
  }
  return { state: next, events };
}

function sameRemoval(a: number[], b: number[]): boolean {
  return a.length === b.length && [...a].sort((x, y) => x - y).every((v, i) => v === [...b].sort((x, y) => x - y)[i]);
}

export function result(state: MillState): Result | null {
  if (state.winner !== null) return { kind: 'win', winners: [state.winner] };
  if (state.draw) return { kind: 'draw', reason: state.draw };
  return null;
}

/** Stellungsbewertung aus Sicht von `seat`: Steine, Mühlen, offene Zweier, Beweglichkeit. */
export function evaluate(state: MillState, seat: SeatId): number {
  const opponent = 1 - seat;
  const material = (s: SeatId) => stonesOnBoard(state.cells, s) + state.inHand[s as 0 | 1];
  let score = (material(seat) - material(opponent)) * 100;
  for (const mill of MILLS) {
    const own = mill.filter((p) => state.cells[p] === seat).length;
    const theirs = mill.filter((p) => state.cells[p] === opponent).length;
    if (own === 3) score += 12;
    else if (own === 2 && theirs === 0) score += 8;
    if (theirs === 3) score -= 12;
    else if (theirs === 2 && own === 0) score -= 8;
  }
  const mobility = (s: SeatId) => {
    if (phaseOf(state, s) !== 'move') return 0;
    let free = 0;
    state.cells.forEach((cell, point) => {
      if (cell === s) free += (NEIGHBORS[point] ?? []).filter((n) => state.cells[n] === null).length;
    });
    return free;
  };
  score += (mobility(seat) - mobility(opponent)) * 3;
  return score;
}
