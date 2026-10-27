import {
  BOT_LEVELS,
  cardRank,
  cardSuit,
  createDeck,
  type BotContext,
  type BotDefinition,
  type CardId,
  type Rng,
  type SeatId,
} from '@brett-und-blatt/engine';
import { cardCode, categoryOf, evaluateCodes } from './eval';
import { isLegal, legalMoves, raiseBounds, totalPot, type PokerMove, type PokerState, type PokerView } from './rules';

const ALL_CODES = createDeck().map(cardCode);

/** Bill-Chen-Starthandwert für 2 Hold'em-Karten (ca. -1 bis 20). */
export function chenScore(c1: CardId, c2: CardId): number {
  const r1Raw = cardRank(c1);
  const r2Raw = cardRank(c2);
  const r1 = r1Raw === 1 ? 14 : r1Raw;
  const r2 = r2Raw === 1 ? 14 : r2Raw;
  const high = Math.max(r1, r2);
  const low = Math.min(r1, r2);
  const suited = cardSuit(c1) === cardSuit(c2);

  let base = high === 14 ? 10 : high === 13 ? 8 : high === 12 ? 7 : high === 11 ? 6 : high / 2;
  if (high === low) {
    return Math.max(5, base * 2);
  }
  if (suited) base += 2;
  const gap = high - low - 1;
  if (gap === 1) base -= 1;
  else if (gap === 2) base -= 2;
  else if (gap === 3) base -= 4;
  else if (gap >= 4) base -= 5;
  if (gap <= 1 && high < 12) base += 1;
  return base;
}

/** Schnelle Chen-Schätzung direkt auf Karten-Codes. */
function chenFromCodes(a: number, b: number): number {
  const r1 = a >> 2;
  const r2 = b >> 2;
  const high = Math.max(r1, r2);
  const low = Math.min(r1, r2);
  let score = high === 14 ? 10 : high === 13 ? 8 : high === 12 ? 7 : high === 11 ? 6 : high * 0.5;
  if (high === low) return Math.max(5, score * 2);
  if ((a & 3) === (b & 3)) score += 2;
  const gap = high - low - 1;
  if (gap === 1) score -= 1;
  else if (gap === 2) score -= 2;
  else if (gap === 3) score -= 4;
  else if (gap >= 4) score -= 5;
  return score;
}

/**
 * Monte-Carlo-Gewinnchance der eigenen Hand gegen `opponents` aktive Gegner.
 * Bei `tightness > 0` erhalten Gegner bevorzugt stärkere Starthände (Range-Schätzung).
 */
function estimateEquity(
  holeCards: readonly CardId[],
  boardCards: readonly CardId[],
  opponents: number,
  samples: number,
  tightness: number,
  rng: Rng,
): number {
  if (holeCards.length < 2) return 0.5;
  if (opponents <= 0) return 1;

  const myCodes = holeCards.map(cardCode);
  const boardCodes = boardCards.map(cardCode);
  const used = new Set<number>([...myCodes, ...boardCodes]);
  const pool = ALL_CODES.filter((c) => !used.has(c));
  const missingBoard = Math.max(0, 5 - boardCodes.length);

  let equitySum = 0;
  for (let s = 0; s < samples; s++) {
    // Fisher-Yates nur für so viele Karten, wie wir in diesem Durchlauf brauchen.
    const needed = missingBoard + opponents * 2 + (tightness > 0 ? opponents * 2 : 0);
    const limit = Math.min(pool.length, needed);
    for (let i = 0; i < limit; i++) {
      const j = i + rng.int(pool.length - i);
      const tmp = pool[i]!;
      pool[i] = pool[j]!;
      pool[j] = tmp;
    }

    let pos = 0;
    const simBoard = [...boardCodes];
    for (let b = 0; b < missingBoard; b++) simBoard.push(pool[pos++]!);

    const myVal = evaluateCodes([...myCodes, ...simBoard]);
    let bestOpp = -1;
    let ties = 0;

    for (let o = 0; o < opponents; o++) {
      let c1 = pool[pos++]!;
      let c2 = pool[pos++]!;
      // Range-Filter: Wenn der Gegner erhöht hat, verwirft er schwache Starthände mit hoher Wahrscheinlichkeit.
      if (tightness > 0 && pos + 2 <= pool.length && chenFromCodes(c1, c2) < tightness && rng.chance(0.7)) {
        c1 = pool[pos++]!;
        c2 = pool[pos++]!;
      }
      const oppVal = evaluateCodes([c1, c2, ...simBoard]);
      if (oppVal > bestOpp) {
        bestOpp = oppVal;
      }
      if (oppVal === myVal) {
        ties += 1;
      }
    }

    if (myVal > bestOpp) equitySum += 1;
    else if (myVal === bestOpp) equitySum += 1 / (ties + 1);
  }

  return equitySum / samples;
}

function chooseRaiseMove(view: PokerView, seat: SeatId, fractionOfPot: number): PokerMove | null {
  const bounds = raiseBounds(view, seat);
  if (!bounds.canRaise) return null;
  const me = view.seats[seat]!;
  const toCall = Math.max(0, view.currentBet - me.streetBet);
  const potNow = totalPot(view) + toCall;
  const rawTarget = view.currentBet + Math.max(view.bigBlind, Math.round(potNow * fractionOfPot));
  const target = Math.max(bounds.minTo, Math.min(bounds.maxTo, rawTarget));
  if (target >= bounds.maxByStack * 0.88 && bounds.maxTo >= bounds.maxByStack) {
    return { type: 'allIn' };
  }
  if (target >= bounds.maxByStack) {
    return bounds.maxTo >= bounds.maxByStack ? { type: 'allIn' } : null;
  }
  return view.currentBet === 0 ? { type: 'bet', amount: target } : { type: 'raise', to: target };
}

function choosePokerMove(ctx: BotContext<PokerState, PokerMove, PokerView>): PokerMove {
  const { view, seat, level, rng } = ctx;
  const moves = legalMoves(view, seat);
  if (moves.length === 0) return { type: 'check' };
  if (moves.length === 1) return moves[0]!;

  const me = view.seats[seat];
  if (!me || me.holeCards.length < 2) return moves[0]!;

  const toCall = Math.max(0, view.currentBet - me.streetBet);
  const potNow = totalPot(view);
  const potOdds = toCall > 0 ? toCall / (potNow + toCall) : 0;
  const activeOpponents = view.seats.filter((s) => s.seat !== seat && s.inHand && !s.folded).length;
  const bbStack = me.chips / Math.max(1, view.bigBlind);
  const chen = chenScore(me.holeCards[0]!, me.holeCards[1]!);

  // Stufe „leicht“: einfache Schwellenwerte auf Starthand bzw. Handkategorie, wenig Positionsgefühl.
  if (level === 'easy') {
    const strength =
      view.street === 'preflop'
        ? Math.min(1, Math.max(0.1, (chen + 2) / 18))
        : 0.25 + categoryOf(evaluateCodes([...me.holeCards, ...view.board].map(cardCode))) * 0.12;

    if (toCall === 0) {
      if (strength > 0.62 && rng.chance(0.55)) {
        const bet = chooseRaiseMove(view, seat, 0.5);
        if (bet && isLegal(view, seat, bet)) return bet;
      }
      return { type: 'check' };
    }
    if (strength >= potOdds + 0.08 || (toCall <= view.bigBlind && strength >= 0.32)) {
      if (strength > 0.78 && rng.chance(0.4)) {
        const raise = chooseRaiseMove(view, seat, 0.5);
        if (raise && isLegal(view, seat, raise)) return raise;
      }
      return me.chips > toCall ? { type: 'call' } : { type: 'allIn' };
    }
    return { type: 'fold' };
  }

  // Push-or-Fold im Turnier bei kleinem Stack (< 12 BB) vor dem Flop.
  if (view.street === 'preflop' && bbStack <= 12) {
    const pushThreshold = 5 + activeOpponents * 0.9 + (toCall > view.bigBlind ? 2 : 0);
    if (chen >= pushThreshold) {
      const allInMove: PokerMove = { type: 'allIn' };
      if (isLegal(view, seat, allInMove)) return allInMove;
      const raise = chooseRaiseMove(view, seat, 1);
      if (raise && isLegal(view, seat, raise)) return raise;
      return me.chips > toCall ? { type: 'call' } : { type: 'allIn' };
    }
    if (toCall === 0) return { type: 'check' };
    if (toCall <= view.bigBlind * 0.5 && chen >= 4) {
      return me.chips > toCall ? { type: 'call' } : { type: 'allIn' };
    }
    return { type: 'fold' };
  }

  // Range-Enge der Gegner schätzen (Stufe „schwer“ nutzt Gegner-Statistiken und Aggression).
  let tightness = 0;
  if (level === 'hard') {
    if (view.currentBet > view.bigBlind) tightness = 6;
    if (view.raisesInStreet >= 2) tightness = 8.5;
    if (view.lastAggressor !== null) {
      const aggStats = view.stats[view.lastAggressor];
      if (aggStats && aggStats.handsSeen >= 3) {
        const vpip = aggStats.vpipCount / aggStats.handsSeen;
        if (vpip < 0.3) tightness += 1.5;
        else if (vpip > 0.65) tightness = Math.max(0, tightness - 2);
      }
    }
  }

  const samples = level === 'hard' ? 180 : 90;
  const equity = estimateEquity(me.holeCards, view.board, activeOpponents, samples, tightness, rng);

  // Positionsbonus: Späte Position (nahe am Button) erlaubt etwas weiteres Spiel.
  const seatCount = view.seats.length;
  const distFromButton = (seat - view.button + seatCount) % seatCount;
  const latePosition = distFromButton === 0 || distFromButton >= seatCount - 2;
  const posBonus = latePosition ? 0.04 : 0;
  const effectiveEquity = equity + posBonus;

  if (toCall === 0) {
    // Wert-Einsatz oder kontrollierter (Semi-)Bluff.
    const valueThreshold = 1 / (activeOpponents + 1) + 0.14;
    const bluffChance = level === 'hard' && latePosition && activeOpponents <= 2 ? 0.18 : 0.08;
    if (effectiveEquity >= valueThreshold || rng.chance(bluffChance)) {
      const sizing = effectiveEquity > 0.72 ? 0.75 : 0.5;
      const bet = chooseRaiseMove(view, seat, sizing);
      if (bet && isLegal(view, seat, bet)) return bet;
    }
    return { type: 'check' };
  }

  // Gegen einen Einsatz: Erhöhen mit sehr starker Hand, Mitgehen wenn Equity >= Pot Odds.
  const raiseThreshold = Math.max(0.62, potOdds + 0.25);
  if (effectiveEquity >= raiseThreshold && rng.chance(0.75)) {
    const sizing = effectiveEquity > 0.8 ? 0.85 : 0.6;
    const raise = chooseRaiseMove(view, seat, sizing);
    if (raise && isLegal(view, seat, raise)) return raise;
  }

  const callMargin = view.street === 'preflop' && toCall <= view.bigBlind ? -0.05 : 0.02;
  if (effectiveEquity >= potOdds + callMargin) {
    const callMove: PokerMove = me.chips > toCall ? { type: 'call' } : { type: 'allIn' };
    if (isLegal(view, seat, callMove)) return callMove;
  }

  return { type: 'fold' };
}

export const pokerBot: BotDefinition<PokerState, PokerMove, PokerView> = {
  id: 'pokerface',
  name: 'Pokerface',
  levels: BOT_LEVELS,
  chooseMove: choosePokerMove,
};
