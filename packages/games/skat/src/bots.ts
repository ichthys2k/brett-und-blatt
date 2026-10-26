import {
  cardEyePoints,
  cardRank,
  cardSuit,
  createSkatContract,
  type BotContext,
  type BotDefinition,
  type CardId,
  type SeatId,
  type Suit,
} from '@brett-und-blatt/engine';
import {
  calculateGameValue,
  countSpitzen,
  legalMoves,
  type SkatDeclaration,
  type SkatGameType,
  type SkatMove,
  type SkatState,
} from './rules.js';

export const skatBot: BotDefinition<SkatState, SkatMove> = {
  id: 'skat',
  name: 'Skat-Bot',
  levels: ['easy', 'medium', 'hard'],
  chooseMove(ctx: BotContext<SkatState, SkatMove, SkatState>): SkatMove {
    const state = ctx.view;
    const player = ctx.seat;
    const moves = legalMoves(state, player);
    if (moves.length === 0) {
      throw new Error('Kein legaler Zug für Skat-Bot verfügbar');
    }
    if (moves.length === 1) return moves[0];

    const hand = state.hands[player] || [];

    // 1. Reizphase
    if (state.phase === 'bidding') {
      if (state.biddingAwaitingAnswer) {
        // Hörer muss antworten: Ja (hold) oder Passe
        const best = evaluateBestGame(hand);
        const maxBid = best.viable ? Math.max(18, best.estimatedValue) : 0;
        if (state.currentBidValue <= maxBid) {
          const holdMove = moves.find((m) => m.type === 'hold');
          if (holdMove) return holdMove;
        }
        return { type: 'pass' };
      }

      // Sprecher muss bieten oder passen
      const best = evaluateBestGame(hand);
      const maxBid = best.viable ? Math.max(18, best.estimatedValue) : 0;

      for (const m of moves) {
        if (m.type === 'bid' && m.value <= maxBid) {
          return m;
        }
      }
      return { type: 'pass' };
    }

    // 2. Skat-Entscheidung
    if (state.phase === 'skatDecision') {
      return { type: 'takeSkat' };
    }

    // 3. Drücken
    if (state.phase === 'discard') {
      const nonJacks = hand.filter((c) => cardRank(c) !== 11);
      const sorted = [...nonJacks].sort((a, b) => cardEyePoints(b) - cardEyePoints(a));

      if (sorted.length >= 2) {
        const c1 = sorted[0];
        const c2 = sorted[1];
        const matching = moves.find(
          (m) =>
            m.type === 'discard' &&
            ((m.cards[0] === c1 && m.cards[1] === c2) || (m.cards[0] === c2 && m.cards[1] === c1)),
        );
        if (matching) return matching;
      }
      return moves[0];
    }

    // 4. Ansage
    if (state.phase === 'declare') {
      const best = evaluateBestGame(hand);
      const decl: SkatDeclaration = {
        gameType: best.gameType,
        hand: false,
      };
      return { type: 'declare', declaration: decl };
    }

    // 5. Kartenspiel
    if (state.phase === 'play') {
      const cardMoves = moves.filter((m) => m.type === 'play') as { type: 'play'; card: CardId }[];
      if (cardMoves.length === 0) return moves[0];

      const isDeclarer = player === state.declarerSeat;
      const decl = state.declaration || { gameType: 'grand' as const };
      const contract =
        decl.gameType === 'null'
          ? createSkatContract('null')
          : decl.gameType === 'grand'
            ? createSkatContract('grand')
            : createSkatContract('suit', decl.gameType);

      if (state.currentTrick.length === 0) {
        if (isDeclarer) {
          const trumps = cardMoves.filter((m) => contract.isTrump(m.card));
          if (trumps.length > 0) {
            trumps.sort((a, b) => contract.cardPower(b.card) - contract.cardPower(a.card));
            return trumps[0];
          }
          const aces = cardMoves.filter((m) => cardRank(m.card) === 1);
          if (aces.length > 0) return aces[0];
        }
        cardMoves.sort((a, b) => contract.cardPower(a.card) - contract.cardPower(b.card));
        return cardMoves[0];
      }

      cardMoves.sort((a, b) => contract.cardPower(a.card) - contract.cardPower(b.card));
      return cardMoves[cardMoves.length - 1];
    }

    return moves[0];
  },
};

function evaluateBestGame(hand: CardId[]): { gameType: SkatGameType; estimatedValue: number; viable: boolean } {
  const jacks = hand.filter((c) => cardRank(c) === 11);
  const suits: Suit[] = ['C', 'S', 'H', 'D'];

  let bestType: SkatGameType = 'grand';
  let bestScore = 0;

  if (jacks.length >= 2) {
    const val = calculateGameValue({ gameType: 'grand' }, hand);
    if (val > bestScore) {
      bestScore = val;
      bestType = 'grand';
    }
  }

  for (const s of suits) {
    const suitCards = hand.filter((c) => cardSuit(c) === s && cardRank(c) !== 11);
    const trumpCount = jacks.length + suitCards.length;
    if (trumpCount >= 5) {
      const val = calculateGameValue({ gameType: s }, hand);
      if (val > bestScore) {
        bestScore = val;
        bestType = s;
      }
    }
  }

  return {
    gameType: bestType,
    estimatedValue: bestScore,
    viable: bestScore >= 18,
  };
}
