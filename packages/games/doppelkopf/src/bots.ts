import {
  cardEyePoints,
  cardRank,
  cardSuit,
  createDokoContract,
  trickWinner,
  type BotContext,
  type BotDefinition,
  type BotLevel,
  type CardId,
  type Suit,
  type TrickContract,
} from '@brett-und-blatt/engine';
import { getContract, legalMoves, owingSolo, type DokoContract, type DokoMove, type DokoState } from './rules.js';

/**
 * Doppelkopf-Bot: meldet Solo oder Hochzeit nur mit passendem Blatt, sagt mit starker Hand
 * „Re“ bzw. „Kontra“ an und spielt im Stich nach Faustregeln (Asse zuerst, dem eigenen
 * Team schmieren, billig stechen). Mitspieler gelten als Gegner, bis sie sich zeigen.
 *
 * Stufen: „leicht“ spielt nie Solo, sagt nichts an und legt manchmal zufällige Karten,
 * „mittel“ und „schwer“ nach den Faustregeln; „schwer“ sagt etwas mutiger an.
 */
export const dokoBot: BotDefinition<DokoState, DokoMove> = {
  id: 'doppelkopf',
  name: 'Doppelkopf-Bot',
  levels: ['easy', 'medium', 'hard'],
  chooseMove(ctx: BotContext<DokoState, DokoMove, DokoState>): DokoMove {
    const { view: state, seat, level } = ctx;
    const moves = legalMoves(state, seat);
    if (moves.length === 0) throw new Error('Kein legaler Zug für Doppelkopf-Bot');
    if (moves.length === 1) return moves[0]!;
    const hand = (state.hands[seat] || []).filter((c) => c !== 'back');

    switch (state.phase) {
      case 'reservations': {
        // Wer noch ein Pflichtsolo schuldet, „zieht“ es mit einer brauchbaren Hand lieber selbst,
        // statt am Ende der Serie mit irgendeinem Blatt vorgeführt zu werden.
        const owes = owingSolo(state).includes(seat);
        const solo = level === 'easy' && !owes ? null : bestSolo(hand, level, owes);
        const bothQueens = hand.filter((c) => cardSuit(c) === 'C' && cardRank(c) === 12).length === 2;
        return solo || bothQueens ? { type: 'reservation' } : { type: 'healthy' };
      }
      case 'chooseSolo': {
        // Bei der Vorführung muss ein Solo her: dann das beste, auch wenn es schwach ist.
        const forced = state.forcedSeat === seat;
        const solo = bestSolo(hand, level, owingSolo(state).includes(seat), forced);
        const wanted = solo ?? { type: 'hochzeit' };
        const match = moves.find(
          (m) => m.type === 'chooseContract' && m.contract.type === wanted.type && (wanted.trumpSuit === undefined || m.contract.trumpSuit === wanted.trumpSuit),
        );
        return match ?? moves.find((m) => m.type === 'chooseContract' && m.contract.type === 'hochzeit') ?? moves[0]!;
      }
      case 'play': {
        const announce = moves.find((m) => m.type === 'announce' && (m.call === 're' || m.call === 'kontra'));
        if (announce && level !== 'easy' && hand.length >= 11) {
          const s = strength(hand, getContract(state));
          if (s.score >= (level === 'hard' ? 9 : 10)) return announce;
        }
        return { type: 'play', card: choosePlay(ctx, moves) };
      }
      default:
        return moves[0]!;
    }
  },
};

// ---------------------------------------------------------------------------
// Handbewertung
// ---------------------------------------------------------------------------

/** Trumpfstärke: Dulle, Damen und Buben zählen mehr; Fehl-Asse helfen auch. */
function strength(hand: readonly CardId[], contract: TrickContract): { score: number; trumps: number } {
  const trumps = hand.filter((c) => contract.isTrump(c));
  let score = 0;
  for (const c of trumps) {
    const rank = cardRank(c);
    if (rank === 10 && cardSuit(c) === 'H') score += 1.6;
    else if (rank === 12) score += cardSuit(c) === 'C' || cardSuit(c) === 'S' ? 1.4 : 1.1;
    else if (rank === 11) score += 0.9;
    else score += 0.6;
  }
  for (const c of hand) if (!contract.isTrump(c) && cardRank(c) === 1) score += 0.8;
  return { score, trumps: trumps.length };
}

type SoloChoice = Pick<DokoContract, 'type' | 'trumpSuit'>;

const SOLO_THRESHOLD: Record<BotLevel, number> = { easy: Infinity, medium: 11.5, hard: 11 };

/** Abschlag auf die Solo-Schwelle, solange das Pflichtsolo noch aussteht. */
const OWING_DISCOUNT = 2;

function bestSolo(hand: readonly CardId[], level: BotLevel, owes = false, forced = false): SoloChoice | null {
  const options: SoloChoice[] = [
    { type: 'damensolo' },
    { type: 'bubensolo' },
    ...(['C', 'S', 'H', 'D'] as Suit[]).map((s) => ({ type: 'farbsolo' as const, trumpSuit: s })),
  ];
  let best: { choice: SoloChoice; score: number } | null = null;
  for (const choice of options) {
    const contract = createDokoContract(choice.type as 'farbsolo', choice.trumpSuit ?? 'D');
    const s = strength(hand, contract);
    // Ein Solo braucht viele Trümpfe; jede fehlende Farbe ohne Ass ist gefährlich.
    const weakSuits = (['C', 'S', 'H', 'D'] as Suit[]).filter((suit) => {
      const side = hand.filter((c) => !contract.isTrump(c) && cardSuit(c) === suit);
      return side.length > 0 && !side.some((c) => cardRank(c) === 1);
    }).length;
    const score = s.trumps >= (owes ? 7 : 8) || forced ? s.score - weakSuits * 1.2 + s.trumps * (forced ? 0.5 : 0) : 0;
    if (!best || score > best.score) best = { choice, score };
  }
  if (forced) return best!.choice;
  const threshold = owes ? Math.min(SOLO_THRESHOLD.hard, SOLO_THRESHOLD[level]) - OWING_DISCOUNT : SOLO_THRESHOLD[level];
  return best && best.score >= threshold ? best.choice : null;
}

// ---------------------------------------------------------------------------
// Kartenspiel
// ---------------------------------------------------------------------------

function choosePlay(ctx: BotContext<DokoState, DokoMove, DokoState>, moves: DokoMove[]): CardId {
  const { view: state, seat, level, rng } = ctx;
  const cards = moves.flatMap((m) => (m.type === 'play' ? [m.card] : []));
  if (cards.length === 1) return cards[0]!;
  if (level === 'easy' && rng.chance(0.3)) return rng.pick(cards);

  const contract = getContract(state);
  const isTrump = (c: CardId) => contract.isTrump(c);
  const power = (c: CardId) => contract.cardPower(c) + (isTrump(c) ? 1000 : 0);
  const cheapest = (list: CardId[]) => [...list].sort((a, b) => cardEyePoints(a) - cardEyePoints(b) || power(a) - power(b))[0]!;
  const richest = (list: CardId[]) => [...list].sort((a, b) => cardEyePoints(b) - cardEyePoints(a) || power(a) - power(b))[0]!;

  // Teams: Re kennt man, sobald es sich zeigt; ein Solist spielt allein.
  const solo = state.contract.type !== 'normal' && state.contract.type !== 'hochzeit';
  const reCount = solo ? 1 : 2;
  const iAmRe = state.reTeam.includes(seat);
  const reKnown = state.reTeam.length >= reCount;
  const friend = (s: number) => {
    if (s === seat) return true;
    if (iAmRe) return state.reTeam.includes(s);
    return reKnown && !state.reTeam.includes(s);
  };

  const trick = state.currentTrick;
  if (trick.length === 0) {
    const played = new Set(state.completedTricks.flatMap((t) => t.cards.map((p) => (isTrump(p.card) ? 'T' : cardSuit(p.card)))));
    const freshAces = cards.filter((c) => !isTrump(c) && cardRank(c) === 1 && !played.has(cardSuit(c)));
    if (freshAces.length > 0) return freshAces[0]!;
    const trumps = cards.filter(isTrump).sort((a, b) => power(b) - power(a));
    if (solo && iAmRe && trumps.length > 0) return trumps[0]!;
    const side = cards.filter((c) => !isTrump(c));
    if (side.length > 0) return cheapest(side);
    // Nur noch Trümpfe: einen kleinen spielen, die hohen später.
    return trumps[trumps.length - 1]!;
  }

  const current = trickWinner(trick, contract);
  const lastToPlay = trick.length === 3;
  const winners = cards.filter((c) => trickWinner([...trick, { player: seat, card: c }], contract).player === seat);
  const friendWins = friend(current.player);
  const highTrump = isTrump(current.card) && contract.cardPower(current.card) >= contract.cardPower('S12.1');

  if (friendWins && (lastToPlay || highTrump)) {
    const side = cards.filter((c) => !isTrump(c));
    // Schmieren – aber die Dulle nicht verschenken.
    const pool = side.length > 0 ? side : cards.filter((c) => !(cardSuit(c) === 'H' && cardRank(c) === 10));
    return richest(pool.length > 0 ? pool : cards);
  }
  const trickEyes = trick.reduce((s, p) => s + cardEyePoints(p.card), 0);
  if (winners.length > 0 && (lastToPlay || trickEyes >= 10)) {
    const sorted = [...winners].sort((a, b) => power(a) - power(b));
    return lastToPlay ? sorted[0]! : sorted[Math.min(sorted.length - 1, 1)]!;
  }
  return cheapest(cards);
}
