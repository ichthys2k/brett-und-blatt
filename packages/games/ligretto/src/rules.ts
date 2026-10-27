/**
 * Die Regeln von Ligretto.
 */
import { Rng, hashSeed, type Actor, type GameEvent, type MoveResult, type Result, type SeatId } from '@brett-und-blatt/engine';

export type Suit = 'red' | 'yellow' | 'green' | 'blue';

export const SUITS: readonly Suit[] = ['red', 'yellow', 'green', 'blue'];

export interface Card {
  id: string;
  suit: Suit;
  value: number;
}

export interface PlayerState {
  stock: Card[];
  pile: Card[];
  hand: Card[];
}

export interface CenterPile {
  suit: Suit | null;
  top: number;
  count: number;
}

export interface LigrettoState {
  phase: 'play' | 'roundEnd' | 'gameEnd';
  players: PlayerState[];
  centerPiles: CenterPile[];
  round: number;
  endedBy: SeatId | null;
  scores: number[][];
  targetScore: number;
  winner: SeatId | null;
  rng: [number, number, number, number];
}

export type LigrettoMove =
  | { type: 'playFromHand'; cardId: string; centerIndex: number }
  | { type: 'playFromPile'; centerIndex: number }
  | { type: 'flip' }
  | { type: 'callLigretto' };

function makeDeck(seed: string): Card[] {
  const rng = new Rng(hashSeed(seed));
  const cards: Card[] = [];
  for (const suit of SUITS) {
    for (let v = 1; v <= 10; v++) {
      cards.push({ id: `${suit}-${v}-${rng.int(1000000)}`, suit, value: v });
    }
  }
  for (let i = cards.length - 1; i > 0; i--) {
    const j = rng.int(i + 1);
    [cards[i], cards[j]] = [cards[j], cards[i]];
  }
  return cards;
}

function dealDeck(deck: Card[]): PlayerState {
  const stock = deck.slice(0, 10);
  const rest = deck.slice(10);
  const hand: Card[] = rest.slice(0, 3);
  return { stock, pile: [], hand };
}

export function setup(seats: number): LigrettoState {
  const players: PlayerState[] = [];
  for (let i = 0; i < seats; i++) {
    const deck = makeDeck(`ligretto-${i}`);
    players.push(dealDeck(deck));
  }
  const rng = new Rng(hashSeed('ligretto-center'));
  return {
    phase: 'play',
    players,
    centerPiles: [],
    round: 1,
    endedBy: null,
    scores: Array(seats).fill(0).map(() => []),
    targetScore: 99,
    winner: null,
    rng: rng.state,
  };
}

export function currentPlayers(state: LigrettoState): Actor[] {
  if (state.phase !== 'play') return [];
  return state.players.map((_, i) => i as Actor);
}

function canPlayToCenter(state: LigrettoState, card: Card): number | null {
  for (let i = 0; i < state.centerPiles.length; i++) {
    const pile = state.centerPiles[i];
    if (pile.suit === card.suit && pile.top + 1 === card.value) {
      return i;
    }
  }
  if (card.value === 1) {
    for (let i = 0; i < state.centerPiles.length; i++) {
      if (state.centerPiles[i].suit === null) return i;
    }
    return -1;
  }
  return null;
}

export function legalMoves(state: LigrettoState, actor: Actor): LigrettoMove[] {
  if (state.phase !== 'play') return [];
  const seat = actor as SeatId;
  const p = state.players[seat];
  const moves: LigrettoMove[] = [];

  for (const card of p.hand) {
    const idx = canPlayToCenter(state, card);
    if (idx !== null) {
      moves.push({ type: 'playFromHand', cardId: card.id, centerIndex: idx === -1 ? state.centerPiles.length : idx });
    }
  }
  if (p.pile.length > 0) {
    const top = p.pile[p.pile.length - 1];
    const idx = canPlayToCenter(state, top);
    if (idx !== null) {
      moves.push({ type: 'playFromPile', centerIndex: idx === -1 ? state.centerPiles.length : idx });
    }
  }
  if (p.stock.length > 0 && p.hand.length < 3) {
    moves.push({ type: 'flip' });
  }
  if (p.stock.length === 0 && p.pile.length === 0 && p.hand.length === 0) {
    moves.push({ type: 'callLigretto' });
  }

  return moves;
}

export function applyMove(state: LigrettoState, actor: Actor, move: LigrettoMove): MoveResult<LigrettoState> {
  if (state.phase !== 'play') throw new Error('Kein Zug möglich.');
  const seat = actor as SeatId;
  const events: GameEvent[] = [];
  const newState: LigrettoState = {
    ...state,
    players: state.players.map((pl, i) => (i === seat ? { stock: [...pl.stock], pile: [...pl.pile], hand: [...pl.hand] } : pl)),
    centerPiles: state.centerPiles.map((cp) => ({ ...cp })),
    scores: state.scores.map((s) => [...s]),
  };
  const p = newState.players[seat];

  if (move.type === 'playFromHand') {
    const cardIdx = p.hand.findIndex((c) => c.id === move.cardId);
    if (cardIdx < 0) throw new Error('Karte nicht in der Hand.');
    const card = p.hand[cardIdx];
    let cIdx = move.centerIndex;
    if (cIdx === -1 || cIdx >= newState.centerPiles.length || newState.centerPiles[cIdx].suit === null) {
      if (card.value !== 1) throw new Error('Nur 1 auf leeren Stapel.');
      newState.centerPiles.push({ suit: card.suit, top: card.value, count: 1 });
      cIdx = newState.centerPiles.length - 1;
    } else {
      const cp = newState.centerPiles[cIdx];
      if (cp.suit !== card.suit || cp.top + 1 !== card.value) throw new Error('Nicht passend.');
      cp.top = card.value;
      cp.count++;
    }
    p.hand.splice(cardIdx, 1);
    events.push({ type: 'played', seat, card: card.id, centerIndex: cIdx });
  } else if (move.type === 'playFromPile') {
    if (p.pile.length === 0) throw new Error('Kein Stapel.');
    const card = p.pile[p.pile.length - 1];
    let cIdx = move.centerIndex;
    if (cIdx === -1 || cIdx >= newState.centerPiles.length || newState.centerPiles[cIdx].suit === null) {
      if (card.value !== 1) throw new Error('Nur 1 auf leeren Stapel.');
      newState.centerPiles.push({ suit: card.suit, top: card.value, count: 1 });
      cIdx = newState.centerPiles.length - 1;
    } else {
      const cp = newState.centerPiles[cIdx];
      if (cp.suit !== card.suit || cp.top + 1 !== card.value) throw new Error('Nicht passend.');
      cp.top = card.value;
      cp.count++;
    }
    p.pile.pop();
    events.push({ type: 'played', seat, card: card.id, centerIndex: cIdx, fromPile: true });
  } else if (move.type === 'flip') {
    if (p.stock.length === 0) throw new Error('Nichts mehr umzudrehen.');
    if (p.hand.length >= 3) throw new Error('Hand ist voll.');
    const card = p.stock.shift()!;
    p.hand.push(card);
    events.push({ type: 'flipped', seat, card: card.id });
  } else if (move.type === 'callLigretto') {
    if (p.stock.length > 0 || p.pile.length > 0 || p.hand.length > 0) {
      throw new Error('Du hast noch Karten.');
    }
    newState.phase = 'roundEnd';
    newState.endedBy = seat;
    events.push({ type: 'ligretto', seat });
  } else {
    throw new Error('Unbekannter Zug.');
  }

  if (newState.phase === 'play' && p.stock.length === 0 && p.pile.length === 0 && p.hand.length === 0 && newState.endedBy === null) {
    newState.phase = 'roundEnd';
    newState.endedBy = seat;
    events.push({ type: 'ligretto', seat });
  }

  if (newState.phase === 'roundEnd' && newState.endedBy !== null) {
    const endedSeat = newState.endedBy;
    const roundScores: number[] = Array(newState.players.length).fill(0);
    let otherCards = 0;
    for (let j = 0; j < newState.players.length; j++) {
      if (j !== endedSeat) {
        otherCards += newState.players[j].stock.length + newState.players[j].pile.length + newState.players[j].hand.length;
      }
    }
    roundScores[endedSeat] = otherCards * 10;
    newState.scores[endedSeat] = [...(newState.scores[endedSeat] || []), roundScores[endedSeat]];
    for (let i = 0; i < newState.players.length; i++) {
      if (i !== endedSeat) {
        newState.scores[i] = [...(newState.scores[i] || []), roundScores[i]];
      }
    }
    const totals = newState.scores.map((s) => s.reduce((a, b) => a + b, 0));
    if (totals.some((t) => t >= newState.targetScore)) {
      newState.phase = 'gameEnd';
      const maxScore = Math.max(...totals);
      const winners = totals.map((t, i) => (t === maxScore ? i : -1)).filter((i) => i >= 0);
      newState.winner = winners[0] ?? null;
    } else {
      newState.round++;
      newState.phase = 'play';
      newState.endedBy = null;
      newState.centerPiles = [];
      for (let i = 0; i < newState.players.length; i++) {
        const deck = makeDeck(`ligretto-${i}-r${newState.round}`);
        newState.players[i] = dealDeck(deck);
      }
    }
  }

  return { state: newState, events };
}

export function playerView(state: LigrettoState, seat: SeatId | 'spectator'): LigrettoState {
  if (seat === 'spectator') {
    return state;
  }
  const s = seat as number;
  return {
    ...state,
    players: state.players.map((p, i) => {
      if (i === s) {
        return p;
      }
      return {
        stock: [],
        pile: p.pile.length > 0 ? [p.pile[p.pile.length - 1]] : [],
        hand: [],
      };
    }),
    rng: [0, 0, 0, 0],
  };
}

export function result(state: LigrettoState): Result | null {
  if (state.phase === 'gameEnd') {
    if (state.winner !== null) {
      const totals = state.scores.map((s) => s.reduce((a, b) => a + b, 0));
      const maxScore = Math.max(...totals);
      const winners = totals.map((t, i) => (t === maxScore ? i : -1)).filter((i) => i >= 0);
      if (winners.length === 1) return { kind: 'win', winners };
      return { kind: 'draw' };
    }
    return { kind: 'draw' };
  }
  return null;
}

export function sampleHidden(view: LigrettoState, seat: SeatId, rng: Rng): LigrettoState {
  const s = seat as number;
  const newView: LigrettoState = JSON.parse(JSON.stringify(view));
  for (let i = 0; i < newView.players.length; i++) {
    if (i !== s) {
      newView.players[i].stock = Array(10).fill(0).map((_, idx) => ({
        id: `unknown-${i}-${idx}`,
        suit: rng.pick(SUITS) as Suit,
        value: rng.int(10) + 1,
      }));
      if (newView.players[i].pile.length === 0 && rng.chance(0.5)) {
        newView.players[i].pile = [{
          id: `unknown-pile-${i}`,
          suit: rng.pick(SUITS) as Suit,
          value: rng.int(10) + 1,
        }];
      }
    }
  }
  return newView;
}
