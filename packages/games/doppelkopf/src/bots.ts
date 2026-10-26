import {
  cardEyePoints,
  cardRank,
  cardSuit,
  createDokoContract,
  type BotContext,
  type BotDefinition,
  type CardId,
} from '@brett-und-blatt/engine';
import {
  getContract,
  legalMoves,
  type DokoMove,
  type DokoState,
} from './rules.js';

export const dokoBot: BotDefinition<DokoState, DokoMove> = {
  id: 'doppelkopf',
  name: 'Doppelkopf-Bot',
  levels: ['easy', 'medium', 'hard'],
  chooseMove(ctx: BotContext<DokoState, DokoMove, DokoState>): DokoMove {
    const state = ctx.view;
    const player = ctx.seat;
    const moves = legalMoves(state, player);
    if (moves.length === 0) {
      throw new Error('Kein legaler Zug für Doppelkopf-Bot');
    }
    if (moves.length === 1) return moves[0];

    const hand = state.hands[player] || [];

    // 1. Vorbehaltsphase
    if (state.phase === 'reservations') {
      const queensOfClubs = hand.filter((c) => cardSuit(c) === 'C' && cardRank(c) === 12);
      if (queensOfClubs.length === 2) {
        const resMove = moves.find((m) => m.type === 'reservation');
        if (resMove) return resMove;
      }
      return { type: 'healthy' };
    }

    // 2. Solo / Hochzeit wählen
    if (state.phase === 'chooseSolo') {
      return moves[0];
    }

    // 3. Kartenspiel & Ansagen
    if (state.phase === 'play') {
      // Priorisiere das Kartenspielen, falls der Bot am Zug ist
      const cardMoves = moves.filter((m) => m.type === 'play') as { type: 'play'; card: CardId }[];
      if (cardMoves.length > 0) {
        const contract = getContract(state);
        // Einfache Stichheuristik
        if (state.currentTrick.length === 0) {
          // Trümpfe oder Asse spielen
          const trumps = cardMoves.filter((m) => contract.isTrump(m.card));
          if (trumps.length > 0) {
            trumps.sort((a, b) => contract.cardPower(b.card) - contract.cardPower(a.card));
            return trumps[0];
          }
          const aces = cardMoves.filter((m) => cardRank(m.card) === 1);
          if (aces.length > 0) return aces[0];

          cardMoves.sort((a, b) => contract.cardPower(a.card) - contract.cardPower(b.card));
          return cardMoves[0];
        }

        // Bedienen
        cardMoves.sort((a, b) => contract.cardPower(a.card) - contract.cardPower(b.card));
        return cardMoves[cardMoves.length - 1];
      }

      // Falls nur Ansage-Züge vorliegen
      return moves[0];
    }

    return moves[0];
  },
};
