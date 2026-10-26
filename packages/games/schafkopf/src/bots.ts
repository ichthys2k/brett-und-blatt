import {
  cardEyePoints,
  cardId,
  cardRank,
  cardSuit,
  createSchafkopfContract,
  type BotContext,
  type BotDefinition,
  type CardId,
  type Suit,
} from '@brett-und-blatt/engine';
import {
  getContract,
  legalMoves,
  type SchafkopfMove,
  type SchafkopfState,
} from './rules.js';

export const schafkopfBot: BotDefinition<SchafkopfState, SchafkopfMove> = {
  id: 'schafkopf',
  name: 'Schafkopf-Bot',
  levels: ['easy', 'medium', 'hard'],
  chooseMove(ctx: BotContext<SchafkopfState, SchafkopfMove, SchafkopfState>): SchafkopfMove {
    const state = ctx.view;
    const player = ctx.seat;
    const moves = legalMoves(state, player);
    if (moves.length === 0) {
      throw new Error('Kein legaler Zug für Schafkopf-Bot');
    }
    if (moves.length === 1) return moves[0];

    const hand = state.hands[player] || [];

    // 1. Reizphase
    if (state.phase === 'bidding') {
      const obers = hand.filter((c) => cardRank(c) === 12);
      const unters = hand.filter((c) => cardRank(c) === 11);
      const herzCards = hand.filter((c) => cardSuit(c) === 'H' && cardRank(c) !== 11 && cardRank(c) !== 12);
      const sauspielTrumps = obers.length + unters.length + herzCards.length;

      // Prüfe, ob eine Sau gerufen werden kann
      const canCallSau = ['C', 'S', 'D'].some((s) => {
        const hasSau = hand.includes(cardId(s as Suit, 1));
        const hasOther = hand.some((c) => cardSuit(c) === s && cardRank(c) !== 1);
        return !hasSau && hasOther;
      });

      if (sauspielTrumps >= 5 && canCallSau) {
        const sauspielMove = moves.find((m) => m.type === 'wantToPlay' && m.contractType === 'sauspiel');
        if (sauspielMove) return sauspielMove;
      }

      if (unters.length >= 3) {
        const wenzMove = moves.find((m) => m.type === 'wantToPlay' && m.contractType === 'wenz');
        if (wenzMove) return wenzMove;
      }

      return { type: 'pass' };
    }

    // 2. Ansage
    if (state.phase === 'declare') {
      return moves[0];
    }

    // 3. Verdopplung
    if (state.phase === 'doubling') {
      return { type: 'skipDoubling' };
    }

    // 4. Kartenspiel
    if (state.phase === 'play') {
      const cardMoves = moves.filter((m) => m.type === 'play') as { type: 'play'; card: CardId }[];
      if (cardMoves.length === 0) return moves[0];

      const contract = getContract(state);
      const isDeclarerParty = player === state.declarerSeat || player === state.partnerSeat;

      if (state.currentTrick.length === 0) {
        if (isDeclarerParty) {
          // Trümpfe ziehen
          const trumps = cardMoves.filter((m) => contract.isTrump(m.card));
          if (trumps.length > 0) {
            trumps.sort((a, b) => contract.cardPower(b.card) - contract.cardPower(a.card));
            return trumps[0];
          }
          // Säue anspielen
          const saeue = cardMoves.filter((m) => cardRank(m.card) === 1);
          if (saeue.length > 0) return saeue[0];
        }
        cardMoves.sort((a, b) => contract.cardPower(a.card) - contract.cardPower(b.card));
        return cardMoves[0];
      }

      // Zugeben
      cardMoves.sort((a, b) => contract.cardPower(a.card) - contract.cardPower(b.card));
      return cardMoves[cardMoves.length - 1];
    }

    return moves[0];
  },
};
