import {
  cardEyePoints,
  cardId,
  cardRank,
  cardSuit,
  createSchafkopfContract,
  trickWinner,
  type BotContext,
  type BotDefinition,
  type BotLevel,
  type CardId,
  type Suit,
  type TrickContract,
} from '@brett-und-blatt/engine';
import { getContract, legalMoves, type SchafkopfContract, type SchafkopfGameType, type SchafkopfMove, type SchafkopfState } from './rules.js';

/**
 * Schafkopf-Bot: bewertet die Hand für Sauspiel, Wenz und Solo, spielt nur, wenn das Blatt
 * reicht, ruft die Sau einer kurzen Farbe und spielt im Stich nach Faustregeln
 * (Trumpf ziehen, Ruffarbe suchen, dem Mitspieler schmieren, billig stechen).
 *
 * Stufen: „leicht“ spielt waghalsig und legt manchmal zufällige Karten, „mittel“ nach den
 * Faustregeln, „schwer“ ist beim Ansagen vorsichtiger und stößt mit starkem Blatt.
 */
export const schafkopfBot: BotDefinition<SchafkopfState, SchafkopfMove> = {
  id: 'schafkopf',
  name: 'Schafkopf-Bot',
  levels: ['easy', 'medium', 'hard'],
  chooseMove(ctx: BotContext<SchafkopfState, SchafkopfMove, SchafkopfState>): SchafkopfMove {
    const { view: state, seat, level } = ctx;
    const moves = legalMoves(state, seat);
    if (moves.length === 0) throw new Error('Kein legaler Zug für Schafkopf-Bot');
    if (moves.length === 1) return moves[0]!;
    const hand = (state.hands[seat] || []).filter((c) => c !== 'back');

    switch (state.phase) {
      case 'bidding': {
        const wish = chooseGame(hand, level);
        const move = wish && moves.find((m) => m.type === 'wantToPlay' && m.contractType === wish);
        return move || { type: 'pass' };
      }
      case 'declare':
        return chooseDeclaration(hand, moves);
      case 'doubling': {
        if (level === 'easy' || seat === state.declarerSeat) return { type: 'skipDoubling' };
        const contract = getContract(state);
        const trumps = hand.filter((c) => contract.isTrump(c));
        const obers = hand.filter((c) => cardRank(c) === 12).length;
        const strong = trumps.length >= (level === 'hard' ? 5 : 6) && obers >= 2;
        return strong && moves.some((m) => m.type === 'double') ? { type: 'double' } : { type: 'skipDoubling' };
      }
      case 'play':
        return { type: 'play', card: choosePlay(ctx, moves) };
      default:
        return moves[0]!;
    }
  },
};

// ---------------------------------------------------------------------------
// Spielwahl
// ---------------------------------------------------------------------------

const SIDE_SUITS: Suit[] = ['C', 'S', 'D'];

/** Grobe Stärke für ein Spiel mit diesem Vertrag: Trümpfe nach Höhe, Säue, Länge. */
export function strength(hand: readonly CardId[], contract: TrickContract): { score: number; trumps: number } {
  const trumps = hand.filter((c) => contract.isTrump(c));
  let score = 0;
  for (const c of trumps) {
    const rank = cardRank(c);
    score += rank === 12 ? 1.5 : rank === 11 ? 1 : rank === 1 || rank === 10 ? 0.8 : 0.5;
  }
  for (const c of hand) if (!contract.isTrump(c) && cardRank(c) === 1) score += 0.9;
  return { score, trumps: trumps.length };
}

const THRESHOLDS: Record<BotLevel, { sauspiel: number; solo: number; wenz: number }> = {
  easy: { sauspiel: 3.5, solo: 6.5, wenz: 4.5 },
  medium: { sauspiel: 4.2, solo: 7.2, wenz: 5 },
  hard: { sauspiel: 4.5, solo: 7.6, wenz: 5.5 },
};

function canCall(hand: readonly CardId[]): boolean {
  return SIDE_SUITS.some((s) => !hand.includes(cardId(s, 1)) && hand.some((c) => cardSuit(c) === s && cardRank(c) !== 1));
}

function chooseGame(hand: readonly CardId[], level: BotLevel): SchafkopfGameType | null {
  const t = THRESHOLDS[level];
  const solo = Math.max(...(['C', 'S', 'H', 'D'] as Suit[]).map((s) => {
    const r = strength(hand, createSchafkopfContract('solo', s));
    return r.trumps >= 6 ? r.score : 0;
  }));
  if (solo >= t.solo) return 'solo';
  const wenzContract = createSchafkopfContract('wenz');
  const wenz = strength(hand, wenzContract);
  const unters = hand.filter((c) => cardRank(c) === 11).length;
  if (unters >= 3 && wenz.score + hand.filter((c) => cardRank(c) === 10).length * 0.3 >= t.wenz) return 'wenz';
  const sau = strength(hand, createSchafkopfContract('sauspiel'));
  if (sau.trumps >= 4 && sau.score >= t.sauspiel && canCall(hand)) return 'sauspiel';
  return null;
}

function chooseDeclaration(hand: readonly CardId[], moves: SchafkopfMove[]): SchafkopfMove {
  let best: { move: SchafkopfMove; score: number } | null = null;
  for (const move of moves) {
    if (move.type !== 'declare') continue;
    const c: SchafkopfContract = move.contract;
    if (c.tout) continue;
    let score = 0;
    if (c.gameType === 'sauspiel' && c.calledSuit) {
      // Lieber eine kurze Farbe rufen: dann ist man darin bald frei.
      const count = hand.filter((x) => cardSuit(x) === c.calledSuit && cardRank(x) !== 12 && cardRank(x) !== 11).length;
      score = 10 - count + (hand.some((x) => cardSuit(x) === c.calledSuit && cardRank(x) === 10) ? 0.5 : 0);
    } else {
      score = strength(hand, createSchafkopfContract(c.gameType as 'solo', c.trumpSuit ?? 'H')).score;
    }
    if (!best || score > best.score) best = { move, score };
  }
  return best?.move ?? moves[0]!;
}

// ---------------------------------------------------------------------------
// Kartenspiel
// ---------------------------------------------------------------------------

function choosePlay(ctx: BotContext<SchafkopfState, SchafkopfMove, SchafkopfState>, moves: SchafkopfMove[]): CardId {
  const { view: state, seat, level, rng } = ctx;
  const cards = moves.flatMap((m) => (m.type === 'play' ? [m.card] : []));
  if (cards.length === 1) return cards[0]!;
  if (level === 'easy' && rng.chance(0.3)) return rng.pick(cards);

  const contract = getContract(state);
  const isTrump = (c: CardId) => contract.isTrump(c);
  const power = (c: CardId) => contract.cardPower(c) + (isTrump(c) ? 1000 : 0);
  const cheapest = (list: CardId[]) => [...list].sort((a, b) => cardEyePoints(a) - cardEyePoints(b) || power(a) - power(b))[0]!;
  const richest = (list: CardId[]) => [...list].sort((a, b) => cardEyePoints(b) - cardEyePoints(a) || power(a) - power(b))[0]!;
  const gameType = state.contract?.gameType ?? 'sauspiel';
  const ramsch = gameType === 'ramsch';
  const bettel = gameType === 'bettel';

  // Wer gehört zu mir? Unbekannt (Partner noch verdeckt) gilt als Gegner.
  const declarerSide = (s: number) => s === state.declarerSeat || (state.partnerSeat !== null && s === state.partnerSeat);
  const iAmDeclarerSide = declarerSide(seat);
  const partnerKnown = state.partnerSeat !== null || gameType !== 'sauspiel';
  const teammate = (s: number) => {
    if (ramsch || s === seat) return s === seat;
    if (iAmDeclarerSide) return declarerSide(s);
    return partnerKnown ? !declarerSide(s) : false;
  };

  const trick = state.currentTrick;
  if (bettel) {
    // Bettel: niemals stechen, wenn es sich vermeiden lässt.
    const losing = trick.length === 0 ? cards : cards.filter((c) => trickWinner([...trick, { player: seat, card: c }], contract).player !== seat);
    const pool = losing.length > 0 ? losing : cards;
    return [...pool].sort((a, b) => power(b) - power(a))[0]!;
  }
  if (ramsch) {
    // Ramsch: möglichst wenig Augen einsammeln.
    const losing = trick.length === 0 ? cards : cards.filter((c) => trickWinner([...trick, { player: seat, card: c }], contract).player !== seat);
    if (losing.length > 0) return richest(losing);
    return cheapest(cards);
  }

  if (trick.length === 0) {
    const trumps = cards.filter(isTrump).sort((a, b) => power(b) - power(a));
    const sideAces = cards.filter((c) => !isTrump(c) && cardRank(c) === 1);
    const called = state.contract?.calledSuit;
    if (iAmDeclarerSide) {
      if (seat === state.declarerSeat && called && !state.calledSuitPlayed) {
        const inCalled = cards.filter((c) => !isTrump(c) && cardSuit(c) === called);
        if (inCalled.length > 0 && trumps.length < 5) return cheapest(inCalled);
      }
      if (trumps.length >= 3 || (seat === state.declarerSeat && trumps.length > 0 && gameType !== 'sauspiel')) return trumps[0]!;
      if (sideAces.length > 0) return sideAces[0]!;
      if (trumps.length > 0 && seat !== state.declarerSeat) return trumps[trumps.length - 1]!;
      const side = cards.filter((c) => !isTrump(c));
      return cheapest(side.length > 0 ? side : cards);
    }
    // Gegenspieler: Ruffarbe anspielen, damit der Partner sich zeigen muss; sonst Säue.
    if (called && !state.calledSuitPlayed) {
      const inCalled = cards.filter((c) => !isTrump(c) && cardSuit(c) === called);
      if (inCalled.length > 0) return richest(inCalled.filter((c) => cardRank(c) !== 1).length > 0 ? inCalled.filter((c) => cardRank(c) !== 1) : inCalled);
    }
    if (sideAces.length > 0) return sideAces[0]!;
    const side = cards.filter((c) => !isTrump(c));
    return cheapest(side.length > 0 ? side : cards);
  }

  const current = trickWinner(trick, contract);
  const lastToPlay = trick.length === 3;
  const winners = cards.filter((c) => trickWinner([...trick, { player: seat, card: c }], contract).player === seat);
  const friendWins = teammate(current.player);
  // Ein Ober des Mitspielers steht meistens.
  const safeFriend = friendWins && isTrump(current.card) && cardRank(current.card) === 12;

  if (friendWins && (lastToPlay || safeFriend || (!isTrump(trick[0]!.card) && cardRank(current.card) === 1 && trick.length >= 2))) {
    const side = cards.filter((c) => !isTrump(c));
    return richest(side.length > 0 ? side : cards);
  }
  const trickEyes = trick.reduce((s, p) => s + cardEyePoints(p.card), 0);
  if (winners.length > 0 && (lastToPlay || trickEyes >= 10 || (seat === state.declarerSeat && gameType !== 'sauspiel'))) {
    const sorted = [...winners].sort((a, b) => power(a) - power(b));
    return lastToPlay ? sorted[0]! : sorted[sorted.length - 1]!;
  }
  return cheapest(cards);
}
