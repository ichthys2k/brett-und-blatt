import type { BotDefinition } from '@brett-und-blatt/engine';
import {
  applyMove,
  freeChainNeighbors,
  freeProperDivisors,
  legalMoves,
  type FactorGridMove,
  type FactorGridState,
} from './rules';

function evaluateTaxmanMove(state: FactorGridState, n: number, seat: 0 | 1): number {
  const divs = freeProperDivisors(n, state.owners);
  const taxSum = divs.reduce((acc, d) => acc + d, 0);
  // Bonus, wenn nur ein einziger Teiler abgegeben wird (z. B. Primzahlquadrat oder Primzahl-Vielfaches)
  const singleDivBonus = divs.length === 1 ? 6 : 0;
  const rawNet = n - taxSum + singleDivBonus;

  const next = applyMove(state, seat, { type: 'pick', number: n }).state;
  if (next.phase === 'done') {
    const myScore = next.scores[seat];
    const oppScore = next.scores[seat === 0 ? 1 : 0];
    return (myScore - oppScore) * 10;
  }
  return rawNet;
}

function evaluateChainMove(state: FactorGridState, n: number): number {
  const nextOwners = [...state.owners];
  nextOwners[n - 1] = state.turn;
  const replies = freeChainNeighbors(n, state.size, nextOwners);
  // Sofortiger Gewinnzug, wenn der Gegner keine Antwort mehr hat!
  if (replies.length === 0) return 1_000;
  // Prüfe, ob der Gegner uns im nächsten Zug sofort mattsetzen könnte
  let opponentCanWinImmediately = false;
  for (const r of replies) {
    const afterReply = [...nextOwners];
    afterReply[r - 1] = state.turn === 0 ? 1 : 0;
    if (freeChainNeighbors(r, state.size, afterReply).length === 0) {
      opponentCanWinImmediately = true;
      break;
    }
  }
  if (opponentCanWinImmediately) return -500 - replies.length;
  // Je weniger Antworten der Gegner hat, desto besser
  return 100 - replies.length * 5;
}

export const factorGridBot: BotDefinition<FactorGridState, FactorGridMove> = {
  id: 'factor-grid',
  name: 'Zahlengenie',
  levels: ['easy', 'medium', 'hard'],
  chooseMove(ctx) {
    const { view, level, rng } = ctx;
    const moves = legalMoves(view, view.turn);
    if (moves.length <= 1) return moves[0]!;

    if (level === 'easy') {
      return rng.pick(moves);
    }

    const scored = moves.map((m) => {
      const baseScore =
        view.variant === 'chain'
          ? evaluateChainMove(view, m.number)
          : evaluateTaxmanMove(view, m.number, view.turn);

      if (level === 'hard' && view.variant === 'taxman') {
        const next = applyMove(view, view.turn, m).state;
        if (next.phase !== 'done') {
          const nextMoves = legalMoves(next, next.turn);
          let bestReply = -Infinity;
          for (const rm of nextMoves) {
            const replyVal = evaluateTaxmanMove(next, rm.number, next.turn);
            if (replyVal > bestReply) bestReply = replyVal;
          }
          if (Number.isFinite(bestReply)) {
            return { move: m, score: baseScore - bestReply * 0.5 };
          }
        }
      }
      return { move: m, score: baseScore };
    });

    scored.sort((a, b) => b.score - a.score);

    if (level === 'medium') {
      const topPool = scored.slice(0, Math.min(2, scored.length));
      return rng.pick(topPool).move;
    }

    return scored[0]!.move;
  },
};
