import { cardRank, cardSuit, pimcMove, trickWinner, winsAllTricks, type BotContext, type BotDefinition, type BotLevel, type CardId, type Suit } from '@brett-und-blatt/engine';
import { binokelContract, createDeck, eyes, power, SUITS } from '../cards';
import { findMelds, meldPoints } from '../melds';
import { legalCardsFor, legalMoves, type BinokelMove, type BinokelState } from '../rules';

/**
 * Bot „Schwaben-Ass“: schätzt Meldungen und Stichaugen je Trumpffarbe, reizt bis zu dieser
 * Schätzung, drückt Karten aus kurzen Farben, geht bei hoffnungslosem Blatt ab und spielt im
 * Stich nach Faustregeln (Gegenspieler sichern zuerst einen Stich für ihre Meldungen). Kann er
 * nach dem Drücken jeden Stich sicher machen, spielt er Durch.
 *
 * Stufen: „leicht“ reizt waghalsig und spielt manchmal zufällig, „mittel“ reizt bis knapp
 * unter die Schätzung, „schwer“ reizt vorsichtiger und zählt die gefallenen Trümpfe.
 */
export const binokelHeuristicBot: BotDefinition<BinokelState, BinokelMove> = {
  id: 'binokel',
  name: 'Schwaben-Ass',
  levels: ['easy', 'medium', 'hard'],
  chooseMove(ctx: BotContext<BinokelState, BinokelMove, BinokelState>): BinokelMove {
    const { view, seat, level, rng } = ctx;
    const moves = legalMoves(view, seat);
    if (moves.length === 0) throw new Error('Kein Zug');
    if (moves.length === 1) return moves[0]!;
    const hand = view.hands[seat]!.filter((c): c is CardId => c !== null);

    switch (view.phase) {
      case 'bidding': {
        const limit = biddingLimit(hand, level);
        const next = view.bid === null ? view.minBid : view.bid + 10;
        return next <= limit ? { type: 'bid', value: next } : { type: 'pass' };
      }
      case 'discard': {
        const durch = view.allowDurch && level !== 'easy' ? durchDiscard(hand, view.dabb.length, view.deckSize) : null;
        return { type: 'discard', cards: durch ?? chooseDiscard(hand, view.dabb.length) };
      }
      case 'declare': {
        const pressedCards = view.pressed.filter((c): c is CardId => c !== null);
        if (view.allowDurch && level !== 'easy' && sureDurch(hand, pressedCards, view.deckSize)) return { type: 'declareDurch' };
        const best = bestTrump(hand);
        const pressed = view.pressed.filter((c): c is CardId => c !== null).reduce((s, c) => s + eyes(c), 0);
        const expected = best.value + pressed;
        // Abgehen kostet das einfache Gebot, Verlieren das doppelte.
        if (level !== 'easy' && expected < view.bid! * (level === 'hard' ? 0.8 : 0.72)) return { type: 'fold' };
        return { type: 'declareTrump', suit: best.trump };
      }
      case 'play':
        return { type: 'play', card: choosePlay(ctx, hand) };
      default:
        return moves[0]!;
    }
  },
};

// ---------------------------------------------------------------------------
// Handbewertung
// ---------------------------------------------------------------------------

/** Grobe Stichstärke: hohe Trümpfe und Sauen bringen Stiche, lange Trumpffarbe Kontrolle. */
function trickStrength(hand: readonly CardId[], trump: Suit): number {
  let strength = 0;
  const trumps = hand.filter((c) => cardSuit(c) === trump);
  for (const c of trumps) strength += [0, 3, 4, 5, 6, 8, 10][power(c)]!;
  strength += Math.max(0, trumps.length - 3) * 4;
  for (const suit of SUITS) {
    if (suit === trump) continue;
    const cards = hand.filter((c) => cardSuit(c) === suit);
    const aces = cards.filter((c) => cardRank(c) === 1).length;
    strength += aces * 9;
    if (aces > 0) strength += cards.filter((c) => cardRank(c) === 10).length * 4;
    if (cards.length === 0 && trumps.length >= 4) strength += 4;
  }
  return strength;
}

export function handValue(hand: readonly CardId[], trump: Suit): number {
  const eyesEstimate = Math.min(240, Math.max(30, 40 + 1.1 * trickStrength(hand, trump)));
  return meldPoints(findMelds(hand, trump)) + eyesEstimate;
}

function bestTrump(hand: readonly CardId[]): { trump: Suit; value: number } {
  let best = { trump: SUITS[0]!, value: -Infinity };
  for (const trump of SUITS) {
    const value = handValue(hand, trump);
    if (value > best.value) best = { trump, value };
  }
  return best;
}

const FACTOR: Record<BotLevel, number> = { easy: 1.1, medium: 0.95, hard: 0.9 };

function biddingLimit(hand: readonly CardId[], level: BotLevel): number {
  // Der Dabb bringt im Schnitt etwas dazu.
  const value = (bestTrump(hand).value + 15) * FACTOR[level];
  return Math.floor(value / 10) * 10;
}

const DURCH_CONTRACT = binokelContract(null);

/** Macht die Hand ohne Trumpf sicher jeden Stich? Gedrückte Karten sind aus dem Spiel. */
function sureDurch(hand: readonly CardId[], pressed: readonly CardId[], deckSize: 40 | 48): boolean {
  const deck = createDeck(deckSize).filter((c) => !pressed.includes(c));
  return winsAllTricks(hand, deck, DURCH_CONTRACT);
}

/**
 * Drücken für Durch: alle Karten weg, die ein fremder Stich überbieten könnte, aufgefüllt mit
 * den augenärmsten. Null, wenn danach nicht jeder Stich sicher ist.
 */
function durchDiscard(hand: readonly CardId[], count: number, deckSize: 40 | 48): CardId[] | null {
  const others = createDeck(deckSize).filter((c) => !hand.includes(c));
  const weak = hand.filter((c) => others.some((o) => cardSuit(o) === cardSuit(c) && power(o) > power(c)));
  if (weak.length > count) return null;
  const fill = hand.filter((c) => !weak.includes(c)).sort((a, b) => eyes(a) - eyes(b));
  const pressed = [...weak, ...fill.slice(0, count - weak.length)];
  return sureDurch(hand.filter((c) => !pressed.includes(c)), pressed, deckSize) ? pressed : null;
}

/** Drücken: Meldekarten, Trümpfe und Sauen behalten; kurze Farben frei machen, Zehnen sichern. */
export function chooseDiscard(hand: readonly CardId[], count: number): CardId[] {
  let best: { cards: CardId[]; value: number } | null = null;
  for (const trump of SUITS) {
    const meldCards = new Set(findMelds(hand, trump).flatMap((m) => m.cards));
    const suitLen = (s: Suit) => hand.filter((c) => cardSuit(c) === s).length;
    const keep = (c: CardId) =>
      (cardSuit(c) === trump ? 100 : 0) + (meldCards.has(c) ? 60 : 0) + (cardRank(c) === 1 ? 40 : 0) + suitLen(cardSuit(c)) * 3 - eyes(c);
    const cards = [...hand].sort((a, b) => keep(a) - keep(b)).slice(0, count);
    const rest = hand.filter((c) => !cards.includes(c));
    const value = handValue(rest, trump) + cards.reduce((s, c) => s + eyes(c), 0);
    if (!best || value > best.value) best = { cards, value };
  }
  return best!.cards;
}

// ---------------------------------------------------------------------------
// Stichspiel
// ---------------------------------------------------------------------------

function choosePlay(ctx: BotContext<BinokelState, BinokelMove, BinokelState>, hand: CardId[]): CardId {
  const { view, seat, level, rng } = ctx;
  const legal = legalCardsFor(view, seat);
  if (legal.length === 1) return legal[0]!;
  if (level === 'easy' && rng.chance(0.3)) return rng.pick(legal);

  const contract = binokelContract(view.trump);
  const isTrump = (c: CardId) => contract.isTrump(c);
  const strength = (c: CardId) => power(c) + (isTrump(c) ? 10 : 0);
  const cheapest = (list: CardId[]) => [...list].sort((a, b) => eyes(a) - eyes(b) || strength(a) - strength(b))[0]!;
  const richest = (list: CardId[]) => [...list].sort((a, b) => eyes(b) - eyes(a) || strength(a) - strength(b))[0]!;
  const declarer = view.declarer!;
  const isDeclarer = seat === declarer;
  const madeTrick = view.completedTricks.some((t) => t.winner === seat);
  const needTrick = !isDeclarer && !madeTrick && view.melds[seat]!.length > 0;
  const trick = view.currentTrick;

  if (trick.length === 0) {
    const sideAces = legal.filter((c) => !isTrump(c) && cardRank(c) === 1);
    if (isDeclarer) {
      const trumps = legal.filter(isTrump).sort((a, b) => power(b) - power(a));
      const out = level === 'hard' ? trumpsOut(view, seat) : 1;
      if (trumps.length > 0 && out > 0 && power(trumps[0]!) >= 5) return trumps[0]!;
      if (sideAces.length > 0) return sideAces[0]!;
      return cheapest(legal.filter((c) => !isTrump(c)).length > 0 ? legal.filter((c) => !isTrump(c)) : legal);
    }
    if (sideAces.length > 0) return sideAces[0]!;
    const side = legal.filter((c) => !isTrump(c));
    return cheapest(side.length > 0 ? side : legal);
  }

  const current = trickWinner(trick, contract);
  const lastToPlay = trick.length === 2;
  const winners = legal.filter((c) => trickWinner([...trick, { player: seat, card: c }], contract).player === seat);
  const partnerWins = !isDeclarer && current.player !== declarer;

  if (partnerWins && (lastToPlay || isTrump(current.card) || power(current.card) >= 6)) {
    const side = legal.filter((c) => !isTrump(c));
    return richest(side.length > 0 ? side : legal);
  }
  const trickEyes = trick.reduce((s, p) => s + eyes(p.card), 0);
  if (winners.length > 0 && (needTrick || lastToPlay || isDeclarer || trickEyes >= 10)) {
    const sorted = [...winners].sort((a, b) => strength(a) - strength(b) || eyes(a) - eyes(b));
    return lastToPlay ? sorted[0]! : sorted[sorted.length - 1]!;
  }
  return cheapest(legal);
}

/** Wie viele Trümpfe haben die anderen noch (aus Sicht dieses Platzes)? */
function trumpsOut(view: BinokelState, seat: number): number {
  if (!view.trump) return 0;
  const total = view.deckSize === 48 ? 12 : 10;
  let seen = 0;
  for (const c of view.hands[seat]!) if (c && cardSuit(c) === view.trump) seen++;
  for (const c of view.pressed) if (c && cardSuit(c) === view.trump) seen++;
  for (const t of view.completedTricks) for (const p of t.cards) if (cardSuit(p.card) === view.trump) seen++;
  for (const p of view.currentTrick) if (cardSuit(p.card) === view.trump) seen++;
  return total - seen;
}

/**
 * Der Binokel-Bot der Spielliste: Reizen, Drücken, Trumpf und Durch nach den Faustregeln oben; beim Kartenspielen
 * rechnet „schwer“ per Stichproben-Suche (`pimcMove`) mehrere mögliche Verteilungen der verdeckten Karten durch
 * (die Meldungen anderer Spieler werden dabei berücksichtigt) und spielt die beste Karte.
 */
export const binokelBot: BotDefinition<BinokelState, BinokelMove> = {
  ...binokelHeuristicBot,
  chooseMove(ctx) {
    if (ctx.level !== 'hard' || ctx.view.phase !== 'play') return binokelHeuristicBot.chooseMove(ctx);
    return pimcMove(ctx, {
      heuristic: binokelHeuristicBot,
      isPlaying: (state) => state.phase === 'play',
      score: (state, seat) => state.scores[seat] ?? 0,
      candidates: (moves) => moves.filter((m) => m.type === 'play'),
      samples: 30,
    });
  },
};
