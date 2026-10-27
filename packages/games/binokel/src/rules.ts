import type { Actor, CardId, MoveResult, Options, SeatId, Suit } from '@brett-und-blatt/engine';
import { Rng } from '@brett-und-blatt/engine';
import { cardRank, cardSuit, legalCards as baseLegalCards } from '@brett-und-blatt/engine';
import { createBinokelDeck } from './cards.js';
import type { BinokelMove, BinokelOptions, BinokelPhase, BinokelState } from './types.js';
export type { BinokelMove, BinokelPhase, BinokelState } from './types.js';

export const DEFAULT_OPTIONS: Required<BinokelOptions> = {
  tableSize: '3',
  deckSize: 40,
  cardStyle: 'swabian',
  minBid: 150,
  targetScore: 1500,
  allowDurch: true,
  foldCompensation: 'fifty',
  helpMeld: true,
  helpLegals: true,
  countEyes: true,
};

export function setup(seats: number, options: Options = {}, seed: string = 'binokel'): BinokelState {
  const rng = Rng.fromSeed(seed);
  const opts = { ...DEFAULT_OPTIONS, ...(options as BinokelOptions) } as Required<BinokelOptions>;
  if (typeof opts.allowDurch === 'string') opts.allowDurch = opts.allowDurch === 'true';
  if (typeof opts.deckSize === 'string') opts.deckSize = Number(opts.deckSize) as 40 | 48;
  if (typeof opts.minBid === 'string') opts.minBid = Number(opts.minBid) as any;
  if (typeof opts.targetScore === 'string') opts.targetScore = Number(opts.targetScore) as any;

  const seatIds: SeatId[] = Array.from({ length: seats }, (_, i) => i as SeatId);
  const hands: Record<SeatId, CardId[]> = {};
  for (const s of seatIds) hands[s] = [];
  const deck = rng.shuffle(createBinokelDeck(opts.deckSize));
  const dabbCount = opts.deckSize === 48 ? 3 : 4;
  const active = seatIds.slice(0, 3);
  let idx = 0;
  const dealRounds = opts.deckSize === 48 ? 5 : 4;
  for (let r = 0; r < dealRounds; r++) {
    for (const p of active) {
      if (idx < deck.length - dabbCount) hands[p].push(deck[idx++]);
    }
  }
  const dabb: CardId[] = deck.slice(deck.length - dabbCount);
  const pressedCards: Record<SeatId, CardId[]> = {};
  for (const s of seatIds) pressedCards[s] = [];
  const passed = new Set<SeatId>();
  const meldPointsDeclared: Record<SeatId, number> = {};
  const meldPointsScored: Record<SeatId, number> = {};
  const stichMade: Record<SeatId, boolean> = {};
  const tricksWon: Record<SeatId, CardId[][]> = {};
  const trickPoints: Record<SeatId, number> = {};
  const scores: Record<SeatId, number> = {};
  const roundScores: Record<SeatId, number> = {};
  for (const s of seatIds) {
    meldPointsDeclared[s] = 0;
    meldPointsScored[s] = 0;
    stichMade[s] = false;
    tricksWon[s] = [];
    trickPoints[s] = 0;
    scores[s] = 0;
    roundScores[s] = 0;
  }
  return {
    phase: 'bidding',
    options: opts,
    seats: seatIds,
    dealerSeat: 0 as SeatId,
    hands,
    dabb,
    dabbRevealed: false,
    declarer: null,
    highestBid: null,
    bidHistory: [],
    passed,
    trumpSuit: null,
    isDurch: false,
    pressedCards,
    melds: [],
    meldPointsDeclared,
    meldPointsScored,
    stichMade,
    trickCards: [],
    tricksWon,
    trickPoints,
    lastTrick: null,
    lastTrickWinner: null,
    scores,
    roundScores,
    gameEnded: false,
    winner: null,
    log: [],
  };
}

export function currentPlayers(state: BinokelState): SeatId[] {
  if (state.phase === 'bidding') {
    return state.seats.filter((p) => !state.passed.has(p));
  }
  if (state.phase === 'dabbDecision') return state.declarer !== null ? [state.declarer] : [];
  if (state.phase === 'trumpChoice') return state.declarer !== null && !state.isDurch ? [state.declarer] : [];
  if (state.phase === 'meld') return state.seats.slice(0, 3);
  if (state.phase === 'play') {
    if (state.trickCards.length === 0) {
      if (state.isDurch && state.declarer !== null) return [state.declarer];
      return [state.seats[0]];
    }
    const last = state.trickCards[state.trickCards.length - 1].player;
    const idx = state.seats.indexOf(last);
    return [state.seats[(idx + 1) % state.seats.length]];
  }
  return [];
}

export function legalMoves(state: BinokelState, actor: Actor): BinokelMove[] {
  const player = actor as SeatId;
  if (state.phase === 'bidding') {
    if (state.passed.has(player)) return [];
    const moves: BinokelMove[] = [{ type: 'pass' }];
    const min = state.options.minBid;
    const start = state.highestBid === null ? min : state.highestBid + 10;
    for (let v = start; v <= 300; v += 10) moves.push({ type: 'bid', value: v });
    return moves;
  }
  if (state.phase === 'dabbDecision' && state.declarer === player) {
    const moves: BinokelMove[] = [{ type: 'takeDabb' }];
    if (state.options.allowDurch) {
      moves.push({ type: 'declareDurch', variant: 'simple' });
      moves.push({ type: 'declareDurch', variant: 'open' });
      moves.push({ type: 'declareDurch', variant: 'hand' });
    }
    moves.push({ type: 'fold' });
    return moves;
  }
  if (state.phase === 'trumpChoice' && state.declarer === player && !state.isDurch) {
    return [
      { type: 'declareTrump', suit: 'C' },
      { type: 'declareTrump', suit: 'S' },
      { type: 'declareTrump', suit: 'H' },
      { type: 'declareTrump', suit: 'D' },
    ];
  }
  if (state.phase === 'meld') {
    const already = state.melds.some((m) => m.owner === player);
    if (!already) return [{ type: 'confirmMelds', melds: [] }];
    return [];
  }
  if (state.phase === 'play') {
    const hand = state.hands[player] || [];
    if (state.trickCards.length === 0) {
      return hand.map((card) => ({ type: 'play', card }));
    }
    const leadCard = state.trickCards[0].card;
    const isTrumpCard = (c: CardId) => (state.trumpSuit && !state.isDurch ? cardSuit(c) === state.trumpSuit : false);
    const effectiveSuit = (c: CardId) => (isTrumpCard(c) ? ('TRUMP' as const) : cardSuit(c));
    const contract: any = {
      isTrump: isTrumpCard,
      effectiveSuit,
      cardPower: (c: CardId) => {
        const r = cardRank(c);
        if (state.isDurch) {
          return r === 1 ? 14 : r === 10 ? 13 : r === 13 ? 12 : r === 12 ? 11 : r === 11 ? 10 : r;
        }
        const t = isTrumpCard(c);
        const base = r === 1 ? 14 : r === 10 ? 13 : r === 13 ? 12 : r === 12 ? 11 : r === 11 ? 10 : r;
        return t ? 100 + base : base;
      },
      rules: state.isDurch
        ? { hasTrumps: false, mustFollowSuit: true, mustOvertake: true }
        : { hasTrumps: true, mustFollowSuit: true, mustOvertake: true, mustTrump: true, overtakeTrump: true },
    };
    return baseLegalCards(hand, state.trickCards as any, contract).map((card) => ({ type: 'play', card }));
  }
  return [];
}

export function applyMove(state: BinokelState, actor: Actor, move: BinokelMove): MoveResult<BinokelState> {
  const clone: BinokelState = structuredClone(state);
  const res = applyMoveInner(clone, actor, move);
  return { state: res, events: [] };
}

function applyMoveInner(state: BinokelState, actor: Actor, move: BinokelMove): BinokelState {
  const player = actor as SeatId;
  if (move.type === 'pass' && state.phase === 'bidding') {
    state.passed.add(player);
    state.bidHistory.push({ player, value: 'pass' });
    const active = state.seats.filter((p) => !state.passed.has(p));
    if (active.length === 1) {
      state.declarer = active[0] as SeatId;
      state.highestBid = state.highestBid ?? state.options.minBid;
      state.phase = 'dabbDecision';
      state.dabbRevealed = false;
    } else if (active.length === 0) {
      state.passed.clear();
      state.highestBid = null;
      state.bidHistory = [];
    }
    return state;
  }
  if (move.type === 'bid' && state.phase === 'bidding') {
    state.highestBid = move.value;
    state.bidHistory.push({ player, value: move.value });
    return state;
  }
  if (move.type === 'takeDabb' && state.phase === 'dabbDecision' && state.declarer === player) {
    state.hands[player] = [...(state.hands[player] || []), ...state.dabb];
    state.dabbRevealed = true;
    state.phase = 'trumpChoice';
    return state;
  }
  if (move.type === 'declareDurch' && state.phase === 'dabbDecision' && state.declarer === player) {
    state.isDurch = { variant: move.variant, from: player };
    state.dabbRevealed = true;
    state.phase = 'meld';
    return state;
  }
  if (move.type === 'fold' && state.phase === 'dabbDecision' && state.declarer === player) {
    const bid = state.highestBid ?? state.options.minBid;
    const penalty = state.options.foldCompensation === 'half' ? Math.floor(bid / 2) : bid;
    state.scores[player] = (state.scores[player] || 0) - penalty;
    for (const p of state.seats) {
      if (p !== player) state.scores[p] = (state.scores[p] || 0) + (state.options.foldCompensation === 'fifty' ? 50 : 0);
    }
    state.phase = 'scoring';
    return state;
  }
  if (move.type === 'declareTrump' && state.phase === 'trumpChoice' && state.declarer === player) {
    state.trumpSuit = move.suit;
    state.phase = 'meld';
    return state;
  }
  if (move.type === 'confirmMelds' && state.phase === 'meld') {
    for (const m of move.melds) {
      if (m.owner === player) {
        state.melds.push(m);
        state.meldPointsDeclared[player] = (state.meldPointsDeclared[player] || 0) + m.points;
      }
    }
    state.phase = 'play';
    state.trickCards = [];
    return state;
  }
  if (move.type === 'play' && state.phase === 'play') {
    const hand = state.hands[player] || [];
    if (!hand.includes(move.card)) return state;
    state.hands[player] = hand.filter((c) => c !== move.card);
    state.trickCards.push({ player, card: move.card });
    if (state.trickCards.length === 3) {
      const leadCard = state.trickCards[0].card;
      const isTrumpCard = (c: CardId) => (state.trumpSuit && !state.isDurch ? cardSuit(c) === state.trumpSuit : false);
      const leadSuit = cardSuit(leadCard);
      let winner = state.trickCards[0];
      let winnerPower = 0;
      const power = (c: CardId) => {
        if (state.isDurch) {
          const r = cardRank(c);
          return r === 1 ? 14 : r === 10 ? 13 : r === 13 ? 12 : r === 12 ? 11 : r === 11 ? 10 : r;
        }
        const t = isTrumpCard(c);
        const r = cardRank(c);
        const base = r === 1 ? 14 : r === 10 ? 13 : r === 13 ? 12 : r === 12 ? 11 : r === 11 ? 10 : r;
        return t ? 100 + base : base;
      };
      winnerPower = power(winner.card);
      for (let i = 1; i < state.trickCards.length; i++) {
        const tc = state.trickCards[i];
        const p = power(tc.card);
        const tcTrump = isTrumpCard(tc.card);
        const wTrump = isTrumpCard(winner.card);
        if (tcTrump && !wTrump) {
          winner = tc;
          winnerPower = p;
        } else if (tcTrump && wTrump && p > winnerPower) {
          winner = tc;
          winnerPower = p;
        } else if (!tcTrump && !wTrump) {
          if (cardSuit(tc.card) === leadSuit && p > winnerPower) {
            winner = tc;
            winnerPower = p;
          }
        }
      }
      state.lastTrick = [...state.trickCards];
      state.lastTrickWinner = winner.player;
      state.stichMade[winner.player as SeatId] = true;
      const wp = winner.player as SeatId;
      if (!state.tricksWon[wp]) state.tricksWon[wp] = [];
      state.tricksWon[wp].push(state.trickCards.map((x) => x.card));
      let pts = 0;
      for (const tc of state.trickCards) pts += eyePoints(tc.card);
      if (state.trickCards.length === 3) pts += 10;
      state.trickPoints[wp] = (state.trickPoints[wp] || 0) + pts;
      if (state.isDurch && wp !== state.declarer) {
        state.phase = 'scoring';
        state.trickCards = [];
        return state;
      }
      state.trickCards = [];
      const totalStiche = state.seats.reduce((sum: number, p: SeatId) => sum + ((state.tricksWon[p] as any[])?.length || 0), 0);
      if (totalStiche === 12 || (Object.values(state.hands) as CardId[][]).every((h) => h.length === 0)) {
        state.phase = 'scoring';
      }
    }
    return state;
  }
  return state;
}

function eyePoints(card: CardId): number {
  const r = cardRank(card);
  if (r === 1) return 11;
  if (r === 10) return 10;
  if (r === 13) return 4;
  if (r === 12) return 3;
  if (r === 11) return 2;
  return 0;
}

export function playerView(state: BinokelState, seat: SeatId | 'spectator'): BinokelState {
  return state;
}

export function result(state: BinokelState) {
  if (state.phase !== 'scoring' && !state.gameEnded) return null;
  const scores = state.scores;
  const entries = Object.entries(scores)
    .map(([p, s]) => ({ player: p, score: s as number }))
    .sort((a, b) => (b.score as number) - (a.score as number));
  const max = entries[0]?.score ?? 0;
  const winners = entries.filter((e) => e.score === max).map((e) => Number(e.player));
  return { kind: 'win' as const, winners };
}

export function sampleHidden(state: BinokelState, seat: SeatId, rng: Rng): BinokelState {
  return state;
}
