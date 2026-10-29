import {
  cardEyePoints,
  cardRank,
  cardSuit,
  createSkatContract,
  nullDangerSuits,
  nullTrickCard,
  trickWinner,
  type BotContext,
  type BotDefinition,
  type BotLevel,
  type CardId,
  type Suit,
  type TrickContract,
} from '@brett-und-blatt/engine';
import { calculateGameValue, createSkatDeck, getContract, legalMoves, type SkatGameType, type SkatMove, type SkatState } from './rules.js';

const SUITS: Suit[] = ['C', 'S', 'H', 'D'];

/**
 * Skat-Bot: bewertet die Hand nach Trümpfen, Assen und blanken Farben, reizt nur so weit,
 * wie das gewählte Spiel tatsächlich wert ist, drückt die Karten, die das Spiel am meisten
 * stärken, und spielt im Stich nach einfachen Faustregeln (Trumpf ziehen, Asse holen,
 * dem Partner schmieren, billig stechen). Mit lauter niedrigen, gedeckten Karten spielt er
 * Null (bis 23 gereizt); dort drückt er die gefährlichen hohen Karten und duckt sich im Stich.
 * Ist das Blatt schon ohne Skat sehr stark, spielt er Hand (und reizt bis zum Handwert), mit
 * einem noch stärkeren Blatt sagt er im Handspiel Schneider an.
 *
 * Stufen: „leicht“ reizt waghalsig und spielt jede dritte Karte zufällig, „mittel“ spielt
 * nach den Faustregeln, „schwer“ reizt vorsichtiger und zählt die gefallenen Trümpfe.
 */
export const skatBot: BotDefinition<SkatState, SkatMove> = {
  id: 'skat',
  name: 'Skat-Bot',
  levels: ['easy', 'medium', 'hard'],
  chooseMove(ctx: BotContext<SkatState, SkatMove, SkatState>): SkatMove {
    const state = ctx.view;
    const seat = ctx.seat;
    const moves = legalMoves(state, seat);
    if (moves.length === 0) throw new Error('Kein legaler Zug für Skat-Bot verfügbar');
    if (moves.length === 1) return moves[0]!;
    const hand = (state.hands[seat] || []).filter((c) => c !== 'back');

    switch (state.phase) {
      case 'bidding': {
        const limit = biddingLimit(hand, ctx.level);
        if (state.biddingAwaitingAnswer) {
          return state.currentBidValue <= limit ? { type: 'hold' } : { type: 'pass' };
        }
        const bid = moves.find((m) => m.type === 'bid' && m.value <= limit);
        return bid ?? { type: 'pass' };
      }
      case 'skatDecision':
        return handGame(hand, ctx.level) ? { type: 'playHand' } : { type: 'takeSkat' };
      case 'discard':
        return chooseDiscard(hand, moves, state.currentBidValue);
      case 'declare':
        return chooseDeclaration(hand, state.discardedCards, state.currentBidValue, moves, ctx.level);
      case 'play':
        return choosePlay(ctx, state, seat, moves);
      default:
        return moves[0]!;
    }
  },
};

// ---------------------------------------------------------------------------
// Handbewertung
// ---------------------------------------------------------------------------

const isJack = (c: CardId) => cardRank(c) === 11;

/** Wie stark ist die Hand für dieses Spiel? Grob: erwartete sichere Stiche plus Länge. */
export function handStrength(hand: CardId[], gameType: Exclude<SkatGameType, 'null'>): number {
  const jacks = hand.filter(isJack);
  const jackWeight = jacks.reduce((sum, c) => sum + ({ C: 1.5, S: 1.25, H: 1, D: 0.9 } as Record<Suit, number>)[cardSuit(c)], 0);
  let score = 0;
  let trumps = jacks.length;
  if (gameType === 'grand') {
    score += jackWeight * 1.3;
  } else {
    const trumpSuitCards = hand.filter((c) => !isJack(c) && cardSuit(c) === gameType);
    trumps += trumpSuitCards.length;
    score += jackWeight + trumpSuitCards.length * 0.8;
    if (trumpSuitCards.some((c) => cardRank(c) === 1)) score += 0.4;
  }
  for (const suit of SUITS) {
    if (gameType !== 'grand' && suit === gameType) continue;
    const cards = hand.filter((c) => !isJack(c) && cardSuit(c) === suit);
    const hasAce = cards.some((c) => cardRank(c) === 1);
    const hasTen = cards.some((c) => cardRank(c) === 10);
    if (hasAce) score += 1;
    if (hasTen && hasAce) score += 0.8;
    else if (hasTen && cards.length >= 2) score += 0.4;
    if (gameType === 'grand' && cards.length >= 4 && hasAce) score += 0.5 * (cards.length - 3);
    if (cards.length === 0 && gameType !== 'grand' && trumps >= 5) score += 0.6;
    if (cards.length > 0 && !hasAce) score -= 0.25 * Math.min(cards.length, 3);
  }
  if (gameType !== 'grand' && trumps < 5) score -= 3;
  if (gameType === 'grand' && jacks.length < 2) score -= 3;
  return score;
}

/** Wie stark muss die Hand sein, damit sich das Spiel lohnt (je Stufe)? */
const THRESHOLD: Record<BotLevel, number> = { easy: 5, medium: 6, hard: 6.5 };
/** Ab dieser Stärke ohne Skat spielt der Bot Hand … */
const HAND_THRESHOLD: Record<BotLevel, number> = { easy: 7, medium: 8, hard: 8.5 };
/** … und ab dieser sagt er im Handspiel Schneider an. */
const SCHNEIDER_THRESHOLD: Record<BotLevel, number> = { easy: 9, medium: 9, hard: 9.5 };

/** Hand spielen? Hängt nur vom eigenen Blatt ab – so passen Reizen und Spielen zusammen. */
function handGame(hand: CardId[], level: BotLevel): boolean {
  const game = bestGame(hand, level);
  return game !== null && game.strength >= HAND_THRESHOLD[level];
}

function bestGame(hand: CardId[], level: BotLevel): { gameType: Exclude<SkatGameType, 'null'>; strength: number } | null {
  let best: { gameType: Exclude<SkatGameType, 'null'>; strength: number } | null = null;
  for (const gameType of ['grand', ...SUITS] as Exclude<SkatGameType, 'null'>[]) {
    const strength = handStrength(hand, gameType) + (gameType === 'grand' ? -0.5 : 0);
    if (strength < THRESHOLD[level]) continue;
    if (!best || strength > best.strength) best = { gameType, strength };
  }
  return best;
}

const NULL_CONTRACT = createSkatContract('null');
const DECK = createSkatDeck();
const NULL_VALUE = 23;

/** Gefährliche Farben für ein Null-Spiel (siehe `nullDangerSuits`). */
const nullDanger = (hand: CardId[]) => nullDangerSuits(hand, DECK, NULL_CONTRACT);

/** Wie gut passt die Hand zu Null? Auf derselben Skala wie `handStrength`. */
const nullScore = (hand: CardId[]) => 8 - 4 * nullDanger(hand);

/** Bis zu welchem Wert reizt der Bot? Das beste spielbare Spiel mit seinen Spitzen (ohne Skat). */
function biddingLimit(hand: CardId[], level: BotLevel): number {
  const game = bestGame(hand, level);
  // Mit dem Skat kann ein weiterer Spitzen-Faktor dazukommen oder verloren gehen – nicht darauf bauen.
  const suitLimit = game ? calculateGameValue({ gameType: game.gameType, hand: handGame(hand, level) }, hand) : 0;
  return Math.max(suitLimit, nullPlayable(hand, level) ? NULL_VALUE : 0);
}

/**
 * Null mit Skat: ohne gefährliche Farbe, oder mit einer, die höchstens zwei Karten hat –
 * die drückt der Bot nach dem Aufnehmen weg. „Leicht“ wagt jede einzelne gefährliche Farbe.
 */
function nullPlayable(hand: CardId[], level: BotLevel): boolean {
  const danger = nullDanger(hand);
  if (danger === 0) return true;
  if (danger > 1) return false;
  if (level === 'easy') return true;
  return SUITS.some((suit) => {
    const rest = hand.filter((c) => cardSuit(c) !== suit);
    return hand.length - rest.length <= 2 && nullDanger(rest) === 0;
  });
}

function chooseDiscard(hand: CardId[], moves: SkatMove[], bid: number): SkatMove {
  let best: { move: SkatMove; score: number } | null = null;
  for (const move of moves) {
    if (move.type !== 'discard') continue;
    const rest = hand.filter((c) => !move.cards.includes(c));
    let score = bid <= NULL_VALUE ? nullScore(rest) : -Infinity;
    if (!move.cards.some(isJack)) {
      // Buben drückt man nur für Null.
      for (const gameType of ['grand', ...SUITS] as Exclude<SkatGameType, 'null'>[]) {
        const value = calculateGameValue({ gameType }, hand);
        if (value < bid) continue; // Spiel würde überreizt
        // Gedrückte Augen zählen für den Alleinspieler.
        score = Math.max(score, handStrength(rest, gameType) + (cardEyePoints(move.cards[0]) + cardEyePoints(move.cards[1])) / 20);
      }
    }
    if (!best || score > best.score) best = { move, score };
  }
  return best?.move ?? moves[0]!;
}

function chooseDeclaration(hand: CardId[], discarded: CardId[], bid: number, moves: SkatMove[], level: BotLevel): SkatMove {
  const all = [...hand, ...discarded];
  let best: { move: SkatMove; score: number } | null = null;
  for (const move of moves) {
    if (move.type !== 'declare') continue;
    const d = move.declaration;
    if (d.schwarz || d.ouvert) continue;
    const strength = d.gameType === 'null' ? nullScore(hand) : handStrength(hand, d.gameType);
    // Schneider ansagen (nur im Handspiel möglich) erst mit sehr starkem Blatt.
    if (d.schneider && strength < SCHNEIDER_THRESHOLD[level]) continue;
    const value = calculateGameValue(d, all);
    const overbid = value < bid;
    const score = strength - (overbid ? 100 : 0) + value / 100 + (d.schneider ? 0.5 : 0);
    if (!best || score > best.score) best = { move, score };
  }
  return best?.move ?? moves[0]!;
}

// ---------------------------------------------------------------------------
// Kartenspiel
// ---------------------------------------------------------------------------

const play = (card: CardId): SkatMove => ({ type: 'play', card });

function choosePlay(ctx: BotContext<SkatState, SkatMove, SkatState>, state: SkatState, seat: number, moves: SkatMove[]): SkatMove {
  const cards = moves.flatMap((m) => (m.type === 'play' ? [m.card] : []));
  if (cards.length === 0) return moves[0]!;
  if (ctx.level === 'easy' && ctx.rng.chance(0.33)) return { type: 'play', card: ctx.rng.pick(cards) };

  const contract = getContract(state);
  const isDeclarer = seat === state.declarerSeat;
  const trick = state.currentTrick;
  if (state.declaration?.gameType === 'null') return play(nullTrickCard(cards, trick, seat, state.declarerSeat, contract));
  const power = (c: CardId) => contract.cardPower(c) + (contract.isTrump(c) ? 1000 : 0);
  const cheapest = (list: CardId[]) => [...list].sort((a, b) => cardEyePoints(a) - cardEyePoints(b) || power(a) - power(b))[0]!;
  const richest = (list: CardId[]) => [...list].sort((a, b) => cardEyePoints(b) - cardEyePoints(a) || power(a) - power(b))[0]!;

  // Ausspielen
  if (trick.length === 0) {
    const trumps = cards.filter((c) => contract.isTrump(c)).sort((a, b) => power(b) - power(a));
    const aces = cards.filter((c) => !contract.isTrump(c) && cardRank(c) === 1);
    if (isDeclarer) {
      const trumpsOut = ctx.level === 'hard' ? trumpsStillOut(state, seat, contract) : 1;
      if (trumps.length > 0 && trumpsOut > 0) return play(trumps[0]!);
      if (aces.length > 0) return play(aces[0]!);
      return play(cheapest(cards));
    }
    if (aces.length > 0) return play(aces[0]!);
    const side = cards.filter((c) => !contract.isTrump(c));
    return play(cheapest(side.length > 0 ? side : cards));
  }

  // Bedienen oder abwerfen
  const current = trickWinner(trick, contract);
  const partnerWins = !isDeclarer && current.player !== state.declarerSeat;
  const lastToPlay = trick.length === 2;
  const winners = cards.filter((c) => trickWinner([...trick, { player: seat, card: c }], contract).player === seat);

  if (partnerWins && (lastToPlay || !contract.isTrump(trick[0]!.card))) {
    // Schmieren: dem Partner Augen geben – aber kein Trumpf-Ass verschwenden, wenn es noch stechen kann.
    const side = cards.filter((c) => !contract.isTrump(c));
    return play(richest(side.length > 0 ? side : cards));
  }
  const trickEyes = trick.reduce((sum, p) => sum + cardEyePoints(p.card), 0);
  if (winners.length > 0 && (lastToPlay || trickEyes >= 10 || isDeclarer)) {
    const sorted = [...winners].sort((a, b) => power(a) - power(b));
    return play(lastToPlay ? sorted[0]! : sorted[sorted.length - 1]!);
  }
  return play(cheapest(cards));
}

/** Wie viele Trümpfe haben die Gegner noch (aus Sicht des Alleinspielers)? */
function trumpsStillOut(state: SkatState, seat: number, contract: TrickContract): number {
  const total = state.declaration?.gameType === 'grand' ? 4 : 11;
  const seen = new Set<CardId>();
  for (const c of state.hands[seat] || []) if (contract.isTrump(c)) seen.add(c);
  for (const c of state.discardedCards) if (contract.isTrump(c)) seen.add(c);
  for (const t of state.completedTricks) for (const p of t.cards) if (contract.isTrump(p.card)) seen.add(p.card);
  for (const p of state.currentTrick) if (contract.isTrump(p.card)) seen.add(p.card);
  return total - seen.size;
}
