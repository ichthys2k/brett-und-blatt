import type { BotDefinition, SeatId } from '@brett-und-blatt/engine';
import {
  destinations,
  distanceToGoal,
  legalMoves,
  targetCells,
  type ChineseCheckersMove,
  type ChineseCheckersState,
} from './rules';

type Step = Extract<ChineseCheckersMove, { type: 'move' }>;

/** Wie viel näher ein Zug den Stein der Zielspitze bringt. */
function gainOf(state: ChineseCheckersState, seat: SeatId, move: Step): number {
  return distanceToGoal(state, seat, move.from) - distanceToGoal(state, seat, move.to);
}

function applyLocal(state: ChineseCheckersState, seat: SeatId, move: Step): ChineseCheckersState {
  const board = [...state.board];
  board[move.from] = null;
  board[move.to] = seat;
  return { ...state, board };
}

/**
 * Stellungswert für einen Platz: kleine Summe der Abstände ist gut, Nachzügler kosten extra
 * (sonst bleibt ein Stein hinten stehen und fehlt am Ende). Fehlende Ziellöcher kosten auch.
 */
function score(state: ChineseCheckersState, seat: SeatId): number {
  let sum = 0;
  let worst = 0;
  state.board.forEach((owner, cell) => {
    if (owner !== seat) return;
    const d = distanceToGoal(state, seat, cell);
    sum += d;
    worst = Math.max(worst, d);
  });
  const emptyTargets = targetCells(state, seat).filter((c) => state.board[c] === null).length;
  return -sum - 0.6 * worst - 0.5 * emptyTargets;
}

/** Bester Folgezug auf dem unveränderten Brett (die anderen ziehen in Gedanken nicht). */
function bestFollowUp(state: ChineseCheckersState, seat: SeatId): number {
  let best = score(state, seat);
  state.board.forEach((owner, from) => {
    if (owner !== seat) return;
    for (const to of destinations(state, seat, from).keys()) {
      best = Math.max(best, score(applyLocal(state, seat, { type: 'move', from, to }), seat));
    }
  });
  return best;
}

/**
 * Bot „Sternspringer“:
 * - leicht zieht meist irgendwie vorwärts, gern auch nur einen Schritt,
 * - mittel nimmt den Zug mit dem größten Raumgewinn und zieht bei Gleichstand den hintersten Stein,
 * - schwer bewertet die Stellung (Abstände, Nachzügler, freie Ziellöcher) und schaut einen
 *   eigenen Zug weiter, um Sprungketten vorzubereiten.
 */
export const chineseCheckersBot: BotDefinition<ChineseCheckersState, ChineseCheckersMove> = {
  id: 'chinese-checkers',
  name: 'Sternspringer',
  levels: ['easy', 'medium', 'hard'],
  chooseMove({ view, seat, level, rng }) {
    const moves = legalMoves(view, seat);
    const steps = moves.filter((m): m is Step => m.type === 'move');
    if (steps.length === 0) return moves[0]!;

    if (level === 'easy') {
      const forward = steps.filter((m) => gainOf(view, seat, m) > 0);
      const pool = forward.length > 0 ? forward : steps;
      if (rng.next() < 0.4) {
        // Manchmal den weitesten Sprung, sonst irgendeinen Vorwärtszug.
        return pool.reduce((a, b) => (gainOf(view, seat, b) > gainOf(view, seat, a) ? b : a));
      }
      return rng.pick(pool);
    }

    if (level === 'medium') {
      let best = steps[0]!;
      let bestKey = -Infinity;
      for (const move of steps) {
        const key = gainOf(view, seat, move) * 100 + distanceToGoal(view, seat, move.from) + rng.next() * 0.5;
        if (key > bestKey) {
          bestKey = key;
          best = move;
        }
      }
      return best;
    }

    // Schwer: Zug plus bester eigener Folgezug. Kandidaten vorab nach unmittelbarem Wert begrenzen.
    const ranked = steps
      .map((move) => {
        const after = applyLocal(view, seat, move);
        return { move, after, now: score(after, seat) };
      })
      .sort((a, b) => b.now - a.now)
      .slice(0, 24);
    let best = ranked[0]!;
    let bestValue = -Infinity;
    for (const candidate of ranked) {
      const value = candidate.now + 0.7 * bestFollowUp(candidate.after, seat) + rng.next() * 0.01;
      if (value > bestValue) {
        bestValue = value;
        best = candidate;
      }
    }
    return best.move;
  },
};
