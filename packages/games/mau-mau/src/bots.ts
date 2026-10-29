import { cardRank, cardSuit, type BotDefinition, type CardId, type Suit } from '@brett-und-blatt/engine';
import { getNextPlayer } from './rules';
import type { MauMauMove, MauMauState } from './types';

function countSuits(hand: CardId[]): Record<Suit, number> {
  const counts: Record<Suit, number> = { C: 0, D: 0, H: 0, S: 0 };
  for (const card of hand) {
    if (cardRank(card) !== 11) counts[cardSuit(card)]++;
  }
  return counts;
}

function bestSuit(hand: CardId[]): Suit {
  const counts = countSuits(hand);
  let best: Suit = 'C';
  let bestCount = -1;
  for (const suit of ['C', 'D', 'H', 'S'] as const) {
    if (counts[suit] > bestCount) {
      best = suit;
      bestCount = counts[suit];
    }
  }
  return best;
}

function nextSeat(state: MauMauState, actor: number): number {
  return getNextPlayer(actor, state.direction, state.hands.length);
}

function scoreMove(
  move: Extract<MauMauMove, { type: 'play' }>,
  state: MauMauState,
  actor: number,
  level: 'medium' | 'hard',
): number {
  const hand = state.hands[actor] ?? [];
  const card = hand.find((c) => c === move.cardId);
  if (!card) return -1;

  const rank = cardRank(card);
  const suit = cardSuit(card);
  const topCard = state.discard[state.discard.length - 1];
  const topRank = topCard ? cardRank(topCard) : 0;
  const favourite = bestSuit(hand);
  const opponent = nextSeat(state, actor);
  const opponentCards = state.hands[opponent]?.length ?? 0;
  const isTwoPlayer = state.hands.length === 2;
  let score = 0;

  if (suit === favourite) score += 8;
  if (rank === topRank) score += 4;
  if (suit === state.activeSuit) score += 3;

  // Sonderkarten möglichst dann spielen, wenn sie wirklich stören.
  if (rank === 7) score += 7;
  if (rank === 8) score += opponentCards <= 2 ? 14 : 6;
  if (rank === 9 && state.options.nineReverse === 'on') score += isTwoPlayer ? 9 : 5;
  if (rank === 1 && state.options.aceExtraTurn === 'on') score += 7;

  // Buben sind stark, aber nicht als erstes Mittel verschwenden.
  if (rank === 11) {
    score -= 5;
    if (move.chosenSuit === favourite) score += 8;
    if (hand.length <= 2) score += 10;
    if (state.hands[actor]!.length === 1) score += 40;
  } else if (move.chosenSuit !== undefined) {
    score -= 20;
  }

  // Wer fast fertig ist, soll nicht mit einer nutzlosen Farbe weiterziehen.
  if (hand.length === 1) score += 100;
  if (hand.length === 2) score += 6;

  if (level === 'hard') {
    // Bei einem knappen Gegner sind Aussetzen und Strafkarten besonders wertvoll.
    if (opponentCards === 1 && (rank === 7 || rank === 8 || rank === 11)) score += 10;
    if (opponentCards === 1 && rank === 9 && isTwoPlayer) score += 8;

    // Eine Farbe mit vielen eigenen Karten hält den Anschluss offen.
    const counts = countSuits(hand);
    if (rank !== 11 && counts[suit] >= 2) score += 4;

    // Wenn die eigene Hand fast leer ist, lieber passende Karten loswerden.
    if (hand.length <= 3 && rank !== 11) score += 3;
  }

  return score;
}

/** Standard-Bot für Mau-Mau. */
export const mauMauBot: BotDefinition<MauMauState, MauMauMove> = {
  id: 'standard',
  name: 'Mau-Mau-Meister',
  levels: ['easy', 'medium', 'hard'],
  chooseMove(ctx) {
    const { view, seat: actor, level, rng, module } = ctx;
    const moves = module.legalMoves(view, actor);
    if (moves.length === 1) return moves[0]!;

    const catchMove = moves.find((move) => move.type === 'catchMau');
    if (catchMove) {
      const chance = level === 'hard' ? 1 : level === 'medium' ? 0.85 : 0.4;
      if (rng.next() < chance) return catchMove;
    }

    if (view.pendingDraw > 0) {
      const stack = moves.find((move) => move.type === 'play');
      return stack ?? moves.find((move) => move.type === 'draw') ?? moves[0]!;
    }

    const playMoves = moves.filter(
      (move): move is Extract<MauMauMove, { type: 'play' }> => move.type === 'play',
    );

    if (playMoves.length === 0) {
      return moves.find((move) => move.type === 'draw') ?? moves.find((move) => move.type === 'pass') ?? moves[0]!;
    }

    if (level === 'easy') return rng.pick(playMoves);

    const scored = playMoves
      .map((move) => ({ move, score: scoreMove(move, view, actor, level) }))
      .sort((a, b) => b.score - a.score);

    if (level === 'medium' && scored.length > 1 && rng.next() < 0.2) {
      return scored[1]!.move;
    }

    return scored[0]!.move;
  },
  delayMs(ctx) {
    return ctx.move.type === 'catchMau' ? 2000 : 0;
  },
};
