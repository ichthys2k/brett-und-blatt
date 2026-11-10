import {
  cardEyePoints,
  cardId,
  cardRank,
  cardSuit,
  createSkatContract,
  nullDangerSuits,
  nullTrickCard,
  trickWinner,
  Rng,
  type BotContext,
  type BotDefinition,
  type BotLevel,
  type CardId,
  type Rank,
  type Suit,
  type TrickContract,
  pimcMove,
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
export const skatHeuristicBot: BotDefinition<SkatState, SkatMove> = {
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
      case 'skatDecision': {
        const isVorhand = state.declarerSeat === state.activeSeats?.[0];
        return handGame(hand, ctx.level, isVorhand) ? { type: 'playHand' } : { type: 'takeSkat' };
      }
      case 'discard':
        return chooseDiscard(hand, moves, state.currentBidValue);
      case 'declare': {
        const isVorhand = state.declarerSeat === state.activeSeats?.[0];
        return chooseDeclaration(hand, state.discardedCards, state.currentBidValue, moves, ctx.level, isVorhand);
      }
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

const SKAT_SUIT_RANKS_DESC: Rank[] = [1, 10, 13, 12, 9, 8, 7];
const NULL_RANKS_ASC: Rank[] = [7, 8, 9, 10, 11, 12, 13, 1];

/**
 * Ist das Blatt ein sicheres Null Ouvert (oder Null Ouvert Hand)?
 * Ein Null Ouvert ist unverlierbar, wenn in jeder gehaltenen Farbe die Karten
 * lückenlos von der 7 aufwärts liegen (also blanke 7, 7-8, 7-8-9 usw.), oder die Farbe
 * ganz fehlt (0 Karten).
 */
export function isSureNullOuvert(hand: CardId[]): boolean {
  for (const suit of SUITS) {
    const cards = hand.filter((c) => cardSuit(c) === suit);
    if (cards.length === 0) continue;
    const ranks = cards.map(cardRank).sort((a, b) => NULL_RANKS_ASC.indexOf(a) - NULL_RANKS_ASC.indexOf(b));
    for (let i = 0; i < ranks.length; i++) {
      if (ranks[i] !== NULL_RANKS_ASC[i]) return false;
    }
  }
  return true;
}

/**
 * Gibt das Blatt sicher Schwarz (und damit auch Ouvert) her?
 * Alle 10 Stiche müssen garantiert an den Alleinspieler gehen:
 * - Grand: Alle 4 Buben vorhanden; in jeder gehaltenen Fehlfarbe liegen die Karten
 *   lückenlos von oben ab dem Ass (blankes Ass, Ass-10, Ass-10-König usw.).
 * - Farbspiel: Trümpfe lückenlos ab Kreuz-Bube (mindestens 6 Trümpfe, um alle 5 gegnerischen
 *   Trümpfe sicher ziehen zu können). Ist der Alleinspieler nicht Vorhand, darf er keine Fehlfarben
 *   halten (Gegner könnten auf Ausspiel stechen). Ist er Vorhand, müssen alle gehaltenen Fehlfarben
 *   lückenlos ab Ass liegen.
 */
export function isSureSchwarz(
  hand: CardId[],
  gameType: Exclude<SkatGameType, 'null'>,
  isVorhand: boolean = false,
): boolean {
  if (hand.length !== 10) return false;

  if (gameType === 'grand') {
    const jacks = hand.filter(isJack);
    if (jacks.length !== 4) return false;

    for (const suit of SUITS) {
      const cards = hand.filter((c) => !isJack(c) && cardSuit(c) === suit);
      if (cards.length === 0) continue;
      const ranks = cards.map(cardRank).sort((a, b) => SKAT_SUIT_RANKS_DESC.indexOf(a) - SKAT_SUIT_RANKS_DESC.indexOf(b));
      for (let i = 0; i < ranks.length; i++) {
        if (ranks[i] !== SKAT_SUIT_RANKS_DESC[i]) return false;
      }
    }
    return true;
  }

  const trumpSuit = gameType as Suit;
  const trumpOrder: CardId[] = [
    cardId('C', 11),
    cardId('S', 11),
    cardId('H', 11),
    cardId('D', 11),
    cardId(trumpSuit, 1),
    cardId(trumpSuit, 10),
    cardId(trumpSuit, 13),
    cardId(trumpSuit, 12),
    cardId(trumpSuit, 9),
    cardId(trumpSuit, 8),
    cardId(trumpSuit, 7),
  ];

  const trumps = hand.filter((c) => isJack(c) || cardSuit(c) === trumpSuit);
  const trumpCount = trumps.length;
  if (trumpCount < 6) return false;

  for (let i = 0; i < trumpCount; i++) {
    if (!hand.includes(trumpOrder[i]!)) return false;
  }

  const sideCards = hand.filter((c) => !isJack(c) && cardSuit(c) !== trumpSuit);
  if (!isVorhand && sideCards.length > 0) return false;

  for (const suit of SUITS) {
    if (suit === trumpSuit) continue;
    const cards = hand.filter((c) => !isJack(c) && cardSuit(c) === suit);
    if (cards.length === 0) continue;
    const ranks = cards.map(cardRank).sort((a, b) => SKAT_SUIT_RANKS_DESC.indexOf(a) - SKAT_SUIT_RANKS_DESC.indexOf(b));
    for (let i = 0; i < ranks.length; i++) {
      if (ranks[i] !== SKAT_SUIT_RANKS_DESC[i]) return false;
    }
  }

  return true;
}

/** Hand spielen? Hängt vom Blatt ab – bei sicherem Schwarz/Ouvert immer Hand. */
function handGame(hand: CardId[], level: BotLevel, isVorhand: boolean = false): boolean {
  if (isSureNullOuvert(hand)) return true;
  for (const gameType of ['grand', ...SUITS] as Exclude<SkatGameType, 'null'>[]) {
    if (isSureSchwarz(hand, gameType, isVorhand)) return true;
  }
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
    let score = -Infinity;
    if (isSureNullOuvert(rest) && bid <= 46) {
      score = 10;
    } else if (bid <= NULL_VALUE) {
      score = nullScore(rest);
    }
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

function chooseDeclaration(
  hand: CardId[],
  discarded: CardId[],
  bid: number,
  moves: SkatMove[],
  level: BotLevel,
  isVorhand: boolean = false,
): SkatMove {
  const all = [...hand, ...discarded];
  let best: { move: SkatMove; score: number } | null = null;
  for (const move of moves) {
    if (move.type !== 'declare') continue;
    const d = move.declaration;

    if (d.ouvert) {
      if (d.gameType === 'null') {
        if (!isSureNullOuvert(hand)) continue;
      } else {
        if (!isSureSchwarz(hand, d.gameType, isVorhand)) continue;
      }
    } else if (d.schwarz) {
      if (d.gameType === 'null' || !isSureSchwarz(hand, d.gameType, isVorhand)) continue;
    }

    const strength = d.gameType === 'null' ? nullScore(hand) : handStrength(hand, d.gameType);
    // Schneider ansagen (nur im Handspiel möglich) erst mit sehr starkem Blatt.
    if (d.schneider && !d.schwarz && !d.ouvert && strength < SCHNEIDER_THRESHOLD[level]) continue;

    const value = calculateGameValue(d, all);
    const overbid = value < bid;
    let bonus = 0;
    if (d.schneider) bonus += 0.5;
    if (d.schwarz) bonus += 1.0;
    if (d.ouvert) bonus += 2.0;

    const score = strength - (overbid ? 100 : 0) + value / 100 + bonus;
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

// ---------------------------------------------------------------------------
// Stichproben-Simulation fürs Reizen auf „schwer“
// ---------------------------------------------------------------------------

function quickDiscard(twelveCards: CardId[], gameType: SkatGameType): { kept: CardId[]; discarded: [CardId, CardId] } {
  if (gameType === 'null') {
    const sorted = [...twelveCards].sort((a, b) => {
      const rA = cardRank(a);
      const rB = cardRank(b);
      const isLowA = rA === 7 || rA === 8 ? 0 : 1;
      const isLowB = rB === 7 || rB === 8 ? 0 : 1;
      if (isLowA !== isLowB) return isLowB - isLowA;
      return NULL_RANKS_ASC.indexOf(rB) - NULL_RANKS_ASC.indexOf(rA);
    });
    return {
      discarded: [sorted[0]!, sorted[1]!],
      kept: sorted.slice(2),
    };
  }

  const isTrump = (c: CardId) => isJack(c) || (gameType !== 'grand' && cardSuit(c) === gameType);
  const trumps = twelveCards.filter(isTrump);
  const side = twelveCards.filter((c) => !isTrump(c));
  side.sort((a, b) => cardEyePoints(b) - cardEyePoints(a));

  if (side.length >= 2) {
    const discarded: [CardId, CardId] = [side[0]!, side[1]!];
    const kept = [...trumps, ...side.slice(2)];
    return { kept, discarded };
  } else if (side.length === 1) {
    const discarded: [CardId, CardId] = [side[0]!, trumps[trumps.length - 1]!];
    const kept = trumps.slice(0, trumps.length - 1);
    return { kept, discarded };
  } else {
    const discarded: [CardId, CardId] = [trumps[trumps.length - 1]!, trumps[trumps.length - 2]!];
    const kept = trumps.slice(0, trumps.length - 2);
    return { kept, discarded };
  }
}

function simulateGame(
  gameType: SkatGameType,
  hand: CardId[],
  isHand: boolean,
  seat: number,
  activeSeats: number[],
  seed: string,
  samples: number = 20,
): { winRate: number } {
  const contract = createSkatContract(
    gameType === 'null' ? 'null' : gameType === 'grand' ? 'grand' : 'suit',
    gameType === 'null' || gameType === 'grand' ? undefined : (gameType as Suit),
  );
  const remaining = DECK.filter((c) => !hand.includes(c));
  const myIdx = Math.max(0, activeSeats.indexOf(seat));
  let wins = 0;

  for (let s = 0; s < samples; s++) {
    const rng = Rng.fromSeed(`${seed}/${s}`);
    const shuffled = rng.shuffle(remaining);
    const skat = shuffled.slice(0, 2);
    const oppCards1 = shuffled.slice(2, 12);
    const oppCards2 = shuffled.slice(12, 22);

    const simHands: CardId[][] = [[], [], []];
    let declarerEyes = 0;

    if (isHand) {
      simHands[myIdx] = [...hand];
      declarerEyes += cardEyePoints(skat[0]!) + cardEyePoints(skat[1]!);
    } else {
      const { kept, discarded } = quickDiscard([...hand, ...skat], gameType);
      simHands[myIdx] = kept;
      declarerEyes += cardEyePoints(discarded[0]) + cardEyePoints(discarded[1]);
    }

    simHands[(myIdx + 1) % 3] = [...oppCards1];
    simHands[(myIdx + 2) % 3] = [...oppCards2];

    let leader = 0; // Vorhand führt ersten Stich
    let declarerTricks = 0;

    for (let trickIdx = 0; trickIdx < 10; trickIdx++) {
      const trickCards: { player: number; card: CardId }[] = [];

      for (let turn = 0; turn < 3; turn++) {
        const curPlayer = (leader + turn) % 3;
        const currentHand = simHands[curPlayer]!;
        let legal: CardId[];

        if (turn === 0) {
          legal = currentHand;
        } else {
          const leadSuit = contract.effectiveSuit(trickCards[0]!.card);
          const follow = currentHand.filter((c) => contract.effectiveSuit(c) === leadSuit);
          legal = follow.length > 0 ? follow : currentHand;
        }

        let chosen: CardId;
        if (gameType === 'null') {
          chosen = nullTrickCard(legal, trickCards, curPlayer, myIdx, contract);
        } else {
          const power = (c: CardId) => contract.cardPower(c) + (contract.isTrump(c) ? 1000 : 0);
          if (turn === 0) {
            if (curPlayer === myIdx) {
              const oppTrumps =
                simHands[(myIdx + 1) % 3]!.filter((c) => contract.isTrump(c)).length +
                simHands[(myIdx + 2) % 3]!.filter((c) => contract.isTrump(c)).length;
              const trumps = legal.filter((c) => contract.isTrump(c)).sort((a, b) => power(b) - power(a));
              const aces = legal.filter((c) => !contract.isTrump(c) && cardRank(c) === 1);
              if (trumps.length > 0 && oppTrumps > 0) chosen = trumps[0]!;
              else if (aces.length > 0) chosen = aces[0]!;
              else chosen = [...legal].sort((a, b) => cardEyePoints(a) - cardEyePoints(b))[0]!;
            } else {
              const aces = legal.filter((c) => !contract.isTrump(c) && cardRank(c) === 1);
              if (aces.length > 0) chosen = aces[0]!;
              else {
                const side = legal.filter((c) => !contract.isTrump(c));
                chosen = [...(side.length > 0 ? side : legal)].sort((a, b) => cardEyePoints(a) - cardEyePoints(b))[0]!;
              }
            }
          } else {
            const curWin = trickWinner(trickCards, contract).player;
            const winning = legal.filter((c) => trickWinner([...trickCards, { player: curPlayer, card: c }], contract).player === curPlayer);

            if (curPlayer === myIdx) {
              if (winning.length > 0) {
                const sorted = [...winning].sort((a, b) => power(a) - power(b));
                chosen = turn === 2 ? sorted[0]! : sorted[sorted.length - 1]!;
              } else {
                chosen = [...legal].sort((a, b) => cardEyePoints(a) - cardEyePoints(b))[0]!;
              }
            } else {
              const partnerWins = curWin !== myIdx;
              if (partnerWins) {
                const side = legal.filter((c) => !contract.isTrump(c));
                chosen = [...(side.length > 0 ? side : legal)].sort((a, b) => cardEyePoints(b) - cardEyePoints(a))[0]!;
              } else if (winning.length > 0) {
                chosen = [...winning].sort((a, b) => power(a) - power(b))[0]!;
              } else {
                chosen = [...legal].sort((a, b) => cardEyePoints(a) - cardEyePoints(b))[0]!;
              }
            }
          }
        }

        const cardIdx = currentHand.indexOf(chosen);
        currentHand.splice(cardIdx, 1);
        trickCards.push({ player: curPlayer, card: chosen });
      }

      const winner = trickWinner(trickCards, contract).player;
      const trickPoints = trickCards.reduce((sum, tc) => sum + cardEyePoints(tc.card), 0);
      if (winner === myIdx) {
        declarerEyes += trickPoints;
        declarerTricks++;
      }
      leader = winner;
    }

    if (gameType === 'null') {
      if (declarerTricks === 0) wins++;
    } else {
      if (declarerEyes >= 61) wins++;
    }
  }

  return { winRate: wins / samples };
}

const BIDDING_LIMIT_CACHE = new Map<string, number>();

export function simulatedBiddingLimit(
  hand: CardId[],
  seat: number,
  activeSeats: number[],
  rngOrSeed: Rng | string = 'bidding',
): number {
  const safeActive = activeSeats && activeSeats.length >= 3 ? activeSeats : [0, 1, 2];
  const cacheKey = `${[...hand].sort().join(',')}:${seat}:${safeActive.join(',')}`;
  const cached = BIDDING_LIMIT_CACHE.get(cacheKey);
  if (cached !== undefined) return cached;

  const seed = typeof rngOrSeed === 'string' ? rngOrSeed : rngOrSeed.state.join('-');
  let maxLimit = 0;
  const isVorhand = safeActive[0] === seat;

  // 1. Sichere Ansagen (Schwarz / Ouvert) vorab prüfen
  if (isSureNullOuvert(hand)) {
    maxLimit = Math.max(maxLimit, 59);
  }
  for (const gameType of ['grand', ...SUITS] as Exclude<SkatGameType, 'null'>[]) {
    if (isSureSchwarz(hand, gameType, isVorhand)) {
      const val = calculateGameValue({ gameType, hand: true, schneider: true, schwarz: true, ouvert: true }, hand);
      maxLimit = Math.max(maxLimit, val);
    }
  }

  // 2. Kandidatenspiele filtern
  const candidates: { gameType: SkatGameType; priority: number }[] = [];

  if (nullPlayable(hand, 'hard') || nullDanger(hand) <= 1) {
    candidates.push({ gameType: 'null', priority: 6 });
  }

  const jacks = hand.filter(isJack);
  if (jacks.length >= 2) {
    const grandScore = handStrength(hand, 'grand');
    if (grandScore >= 5.0) {
      candidates.push({ gameType: 'grand', priority: grandScore });
    }
  }

  for (const suit of SUITS) {
    const trumps = hand.filter((c) => isJack(c) || cardSuit(c) === suit);
    if (trumps.length >= 5 || (trumps.length >= 4 && jacks.length >= 2)) {
      const str = handStrength(hand, suit);
      if (str >= 4.5) {
        candidates.push({ gameType: suit, priority: str });
      }
    }
  }

  candidates.sort((a, b) => b.priority - a.priority);
  const toTest = candidates.slice(0, 3);

  for (const cand of toTest) {
    const gt = cand.gameType;

    // Handspiel simulieren
    const simHand = simulateGame(gt, hand, true, seat, safeActive, `${seed}/${gt}/h`, 20);
    if (simHand.winRate >= 0.65) {
      const val = gt === 'null' ? 35 : calculateGameValue({ gameType: gt, hand: true }, hand);
      maxLimit = Math.max(maxLimit, val);
      continue;
    }

    // Spiel mit Skat simulieren
    const simSkat = simulateGame(gt, hand, false, seat, safeActive, `${seed}/${gt}/s`, 20);
    if (simSkat.winRate >= 0.60) {
      const val = gt === 'null' ? 23 : calculateGameValue({ gameType: gt, hand: false }, hand);
      maxLimit = Math.max(maxLimit, val);
    }
  }

  if (BIDDING_LIMIT_CACHE.size > 500) BIDDING_LIMIT_CACHE.clear();
  BIDDING_LIMIT_CACHE.set(cacheKey, maxLimit);
  return maxLimit;
}

/**
 * Der Skat-Bot der Spielliste: Reizen auf „schwer“ per Simulation (`simulatedBiddingLimit`),
 * Drücken und Ansagen nach den Regeln oben; beim Kartenspielen rechnet „schwer“ per
 * Stichproben-Suche (`pimcMove`) mehrere mögliche Verteilungen der verdeckten Karten durch.
 */
export const skatBot: BotDefinition<SkatState, SkatMove> = {
  ...skatHeuristicBot,
  chooseMove(ctx) {
    const state = ctx.view;
    const seat = ctx.seat;

    if (ctx.level === 'hard' && state.phase === 'bidding') {
      const moves = legalMoves(state, seat);
      if (moves.length === 0) throw new Error('Kein legaler Zug für Skat-Bot verfügbar');
      if (moves.length === 1) return moves[0]!;
      const hand = (state.hands[seat] || []).filter((c) => c !== 'back');

      const limit = simulatedBiddingLimit(hand, seat, state.activeSeats ?? [0, 1, 2], ctx.rng);
      if (state.biddingAwaitingAnswer) {
        return state.currentBidValue <= limit ? { type: 'hold' } : { type: 'pass' };
      }
      const bid = moves.find((m) => m.type === 'bid' && m.value <= limit);
      return bid ?? { type: 'pass' };
    }

    if (ctx.level !== 'hard' || state.phase !== 'play') return skatHeuristicBot.chooseMove(ctx);
    return pimcMove(ctx, {
      heuristic: skatHeuristicBot,
      isPlaying: (s) => s.phase === 'play',
      // Der Spielausgang zählt vor allem; die Augen der eigenen Seite entscheiden bei Gleichstand und
      // zeigen früh, ob Schneider oder Schwarz in Reichweite ist.
      score: (s, st) => (s.scores[st] ?? 0) + 0.3 * (st === s.declarerSeat ? s.declarerEyes : 120 - s.declarerEyes),
      candidates: (moves) => moves.filter((m) => m.type === 'play'),
      samples: 30,
    });
  },
};
