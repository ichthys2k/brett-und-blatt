import type { BotDefinition, SeatId } from '@brett-und-blatt/engine';
import {
  TURNIP,
  fenceBehind,
  hillField,
  legalMoves,
  remainingCards,
  targetOf,
  type TurnipMove,
  type TurnipState,
} from './rules';

/** Wahrscheinlichkeit, dass bis zum eigenen nächsten Zug mindestens ein Maulwurf kommt. */
function moleChance(state: TurnipState): number {
  const left = remainingCards(state);
  const pool = left.length > 0 ? left : remainingCards({ discard: [] });
  const p = pool.filter((c) => c === 'mole').length / pool.length;
  return 1 - (1 - p) ** state.seats;
}

/** Wert der eigenen Hasen nach einem Zug, abzüglich der Gefahr am Erdhügel. */
function valueOf(state: TurnipState, seat: SeatId, hares: number[]): number {
  const danger = moleChance(state);
  const hill = hillField(state);
  const nextHill = hillField(state, 1);
  let progress = state.goal === 'all' ? hares.reduce((a, b) => a + b, 0) : Math.max(...hares) * 2 + hares.reduce((a, b) => a + b, 0) * 0.3;
  for (const field of hares) {
    if (field === TURNIP) continue;
    const loss = field - (state.fall === 'start' ? 0 : fenceBehind(field));
    if (field === hill) progress -= danger * loss * 1.6;
    else if (field === nextHill) progress -= danger * danger * loss * 0.6;
  }
  return progress;
}

/**
 * Bot „Langohr“:
 * - leicht nimmt jedes zweite Mal irgendeinen Hasen, sonst wie mittel,
 * - mittel springt mit dem vordersten Hasen, aber nicht auf den Erdhügel,
 * - schwer rechnet mit den Maulwurfkarten, die noch im Stapel sind, holt Hasen vom Hügel und
 *   meidet auch den nächsten Hügel.
 */
export const turnipBot: BotDefinition<TurnipState, TurnipMove> = {
  id: 'turnip-patch',
  name: 'Langohr',
  levels: ['easy', 'medium', 'hard'],
  chooseMove({ view, seat, level, rng }) {
    const moves = legalMoves(view, seat);
    const hops = moves.filter((m): m is Extract<TurnipMove, { type: 'hop' }> => m.type === 'hop');
    if (hops.length === 0) return moves[0]!;
    // Leicht: jeder zweite Zug ganz zufällig, sonst wie „mittel“.
    if (level === 'easy' && rng.next() < 0.5) return rng.pick(hops);

    const own = view.hares[seat]!;
    const hill = hillField(view);
    let best = hops[0]!;
    let bestScore = -Infinity;
    for (const move of hops) {
      const to = targetOf(view, own[move.hare]!, view.card!);
      let score: number;
      if (level !== 'hard') {
        score = (to === TURNIP ? 100 : to) - (to === hill ? 50 : 0) + rng.next() * 0.1;
      } else {
        const after = own.map((f, h) => (h === move.hare ? to : f));
        score = (to === TURNIP && view.goal === 'first' ? 1000 : 0) + valueOf(view, seat, after) + rng.next() * 0.01;
      }
      if (score > bestScore) {
        bestScore = score;
        best = move;
      }
    }
    return best;
  },
};
