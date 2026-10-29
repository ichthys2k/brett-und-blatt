import {
  legalCards,
  Rng,
  trickGameEvents,
  trickWinner,
  type Actor,
  type CardId,
  type MoveResult,
  type Options,
  type PlayedCard,
  type Result,
  type RngState,
  type SeatId,
  type Suit,
  parseDeckStyle,
  type DeckStyle,
} from '@brett-und-blatt/engine';
import { binokelContract, createDeck, eyes, SUITS } from './cards';
import { findMelds, meldPoints, type Meld } from './melds';

export const SEATS = 3;

export type BinokelPhase = 'bidding' | 'discard' | 'declare' | 'play' | 'roundOver' | 'finished';

export interface RoundResult {
  gameNumber: number;
  declarer: number | null;
  bid: number | null;
  kind: 'normal' | 'durch' | 'fold' | 'passedOut';
  trump: Suit | null;
  /** Gemeldete Punkte je Platz (zählen nur mit Stich). */
  melds: number[];
  /** Erzielte Augen je Platz (beim Spielmacher samt gedrückter Karten). */
  eyes: number[];
  madeTrick: boolean[];
  /** Punkte dieser Runde je Platz. */
  points: number[];
  won: boolean | null;
}

export interface BinokelState {
  deckStyle: DeckStyle;
  deckSize: 40 | 48;
  minBid: number;
  target: number;
  allowDurch: boolean;
  foldBonus: 'fifty' | 'half' | 'none';
  dealRng: RngState;
  gameNumber: number;
  dealer: number;
  phase: BinokelPhase;
  /** Handkarten; fremde sind in der Sicht `null`. */
  hands: (CardId | null)[][];
  /** Der Dabb – verdeckt, bis das Reizen entschieden ist. */
  dabb: (CardId | null)[];
  dabbOpen: boolean;
  /** Gedrückte Karten – nur der Spielmacher kennt sie. */
  pressed: (CardId | null)[];
  bid: number | null;
  bidder: number | null;
  passed: boolean[];
  speaker: number;
  declarer: number | null;
  trump: Suit | null;
  durch: boolean;
  melds: Meld[][];
  leader: number;
  currentTrick: PlayedCard[];
  completedTricks: { winner: number; cards: PlayedCard[] }[];
  scores: number[];
  lastRound: RoundResult | null;
}

export type BinokelMove =
  | { type: 'bid'; value: number }
  | { type: 'pass' }
  | { type: 'discard'; cards: CardId[] }
  | { type: 'declareTrump'; suit: Suit }
  | { type: 'declareDurch' }
  | { type: 'fold' }
  | { type: 'play'; card: CardId }
  | { type: 'nextGame' };

export const DURCH_VALUE = 1000;
export const LAST_TRICK_BONUS = 10;
const MAX_BID = 2000;
/** Spätestens nach so vielen Spielen ist Schluss, auch wenn niemand das Ziel erreicht. */
export const MAX_GAMES = 24;

const vorhand = (dealer: number) => (dealer + 1) % SEATS;
export const dabbSize = (deckSize: 40 | 48) => (deckSize === 48 ? 3 : 4);
const own = (cards: readonly (CardId | null)[]) => cards.filter((c): c is CardId => c !== null);

function deal(base: Omit<BinokelState, 'hands' | 'dabb' | 'dealRng'>, dealRng: RngState): BinokelState {
  const rng = new Rng(dealRng);
  const deck = rng.shuffle(createDeck(base.deckSize));
  const d = dabbSize(base.deckSize);
  const dabb = deck.splice(0, d);
  const per = deck.length / SEATS;
  const hands = Array.from({ length: SEATS }, (_, s) => deck.slice(s * per, (s + 1) * per));
  return { ...base, hands, dabb, dealRng: rng.state };
}

function freshRound(state: Omit<BinokelState, 'hands' | 'dabb' | 'dealRng'> & { dealRng: RngState }, dealer: number, gameNumber: number): BinokelState {
  const { dealRng, ...rest } = state;
  return deal(
    {
      ...rest,
      gameNumber,
      dealer,
      phase: 'bidding',
      dabbOpen: false,
      pressed: [],
      bid: null,
      bidder: null,
      passed: [false, false, false],
      speaker: vorhand(dealer),
      declarer: null,
      trump: null,
      durch: false,
      melds: [[], [], []],
      leader: vorhand(dealer),
      currentTrick: [],
      completedTricks: [],
    },
    dealRng,
  );
}

export function setup(_seats: number, options: Options, seed: string): BinokelState {
  const deckSize = String(options.deckSize ?? '40') === '48' ? 48 : 40;
  const base = {
    deckStyle: parseDeckStyle(options.deckStyle),
    deckSize,
    minBid: Number(options.minBid ?? 150) || 150,
    target: Number(options.targetScore ?? 1500) || 1500,
    allowDurch: String(options.allowDurch ?? 'true') !== 'false',
    foldBonus: (['fifty', 'half', 'none'].includes(String(options.foldCompensation)) ? options.foldCompensation : 'fifty') as BinokelState['foldBonus'],
    dealRng: Rng.fromSeed(seed, 'geben').state,
    scores: [0, 0, 0],
    lastRound: null,
  } as const;
  return freshRound(base as unknown as BinokelState, 0, 1);
}

export function currentPlayers(state: BinokelState): Actor[] {
  switch (state.phase) {
    case 'bidding':
      return [state.speaker];
    case 'discard':
    case 'declare':
      return [state.declarer!];
    case 'play':
      return [(state.leader + state.currentTrick.length) % SEATS];
    case 'roundOver':
      return [vorhand(state.dealer)];
    default:
      return [];
  }
}

const nextBid = (state: BinokelState) => (state.bid === null ? state.minBid : state.bid + 10);

export function legalCardsFor(state: BinokelState, seat: number): CardId[] {
  return legalCards(own(state.hands[seat]!), state.currentTrick, binokelContract(state.trump));
}

/** Alle Möglichkeiten, k Karten aus der Hand zu wählen. */
function combinations(cards: CardId[], k: number): CardId[][] {
  const out: CardId[][] = [];
  const pick = (start: number, chosen: CardId[]) => {
    if (chosen.length === k) {
      out.push([...chosen]);
      return;
    }
    for (let i = start; i <= cards.length - (k - chosen.length); i++) {
      chosen.push(cards[i]!);
      pick(i + 1, chosen);
      chosen.pop();
    }
  };
  pick(0, []);
  return out;
}

export function legalMoves(state: BinokelState, actor: Actor): BinokelMove[] {
  if (!currentPlayers(state).includes(actor)) return [];
  const seat = actor as number;
  switch (state.phase) {
    case 'bidding': {
      const next = nextBid(state);
      return [{ type: 'pass' }, ...[0, 10, 20, 50].map((extra) => ({ type: 'bid' as const, value: next + extra })).filter((m) => m.value <= MAX_BID)];
    }
    case 'discard':
      return combinations(own(state.hands[seat]!), state.dabb.length).map((cards) => ({ type: 'discard', cards }));
    case 'declare':
      return [
        ...SUITS.map((suit) => ({ type: 'declareTrump' as const, suit })),
        ...(state.allowDurch ? [{ type: 'declareDurch' as const }] : []),
        { type: 'fold' },
      ];
    case 'play':
      return legalCardsFor(state, seat).map((card) => ({ type: 'play', card }));
    case 'roundOver':
      return [{ type: 'nextGame' }];
    default:
      return [];
  }
}

export function isLegal(state: BinokelState, actor: Actor, move: BinokelMove): boolean {
  if (!currentPlayers(state).includes(actor)) return false;
  const seat = actor as number;
  switch (move.type) {
    case 'bid':
      return state.phase === 'bidding' && Number.isInteger(move.value) && move.value % 10 === 0 && move.value >= nextBid(state) && move.value <= MAX_BID;
    case 'discard': {
      if (state.phase !== 'discard' || !Array.isArray(move.cards) || move.cards.length !== state.dabb.length) return false;
      const hand = own(state.hands[seat]!);
      return new Set(move.cards).size === move.cards.length && move.cards.every((c) => hand.includes(c));
    }
    case 'play':
      return state.phase === 'play' && legalCardsFor(state, seat).includes(move.card);
    default:
      return legalMoves(state, actor).some((m) => m.type === move.type && (m.type !== 'declareTrump' || (move.type === 'declareTrump' && m.suit === move.suit)));
  }
}

// ---------------------------------------------------------------------------
// Abrechnung
// ---------------------------------------------------------------------------

function finishRound(state: BinokelState, kind: RoundResult['kind']): BinokelState {
  const declarer = state.declarer;
  const melds = state.melds.map(meldPoints);
  const eyesBy = [0, 0, 0];
  const madeTrick = [false, false, false];
  for (const t of state.completedTricks) {
    madeTrick[t.winner] = true;
    eyesBy[t.winner] += t.cards.reduce((sum, p) => sum + eyes(p.card), 0);
  }
  const complete = state.hands.every((h) => h.length === 0);
  const last = state.completedTricks.at(-1);
  if (complete && last) eyesBy[last.winner] += LAST_TRICK_BONUS;
  if (declarer !== null) eyesBy[declarer] += own(state.pressed).reduce((sum, c) => sum + eyes(c), 0);

  const points = [0, 0, 0];
  let won: boolean | null = null;
  if (kind === 'passedOut' || declarer === null) {
    // niemand reizt: keine Punkte
  } else if (kind === 'fold') {
    const bonus = state.foldBonus === 'fifty' ? 50 : state.foldBonus === 'half' ? Math.round(state.bid! / 20) * 10 : 0;
    for (let s = 0; s < SEATS; s++) points[s] = s === declarer ? -state.bid! : melds[s]! + bonus;
    won = false;
  } else if (kind === 'durch') {
    won = state.completedTricks.every((t) => t.winner === declarer) && complete;
    points[declarer] = won ? DURCH_VALUE : -DURCH_VALUE;
  } else {
    for (let s = 0; s < SEATS; s++) if (s !== declarer && madeTrick[s]) points[s] = eyesBy[s]! + melds[s]!;
    const total = eyesBy[declarer]! + (madeTrick[declarer] ? melds[declarer]! : 0);
    won = total >= state.bid!;
    points[declarer] = won ? total : -2 * state.bid!;
  }

  const scores = state.scores.map((sc, s) => sc + points[s]!);
  const lastRound: RoundResult = { gameNumber: state.gameNumber, declarer, bid: state.bid, kind, trump: state.trump, melds, eyes: eyesBy, madeTrick, points, won };
  const finished = (kind !== 'passedOut' && scores.some((s) => s >= state.target)) || state.gameNumber >= MAX_GAMES;
  return { ...state, scores, lastRound, phase: finished ? 'finished' : 'roundOver' };
}

// ---------------------------------------------------------------------------
// Züge
// ---------------------------------------------------------------------------

export function applyMove(state: BinokelState, actor: Actor, move: BinokelMove): MoveResult<BinokelState> {
  if (!isLegal(state, actor, move)) throw new Error('Unerlaubter Zug.');
  const seat = actor as number;
  let next: BinokelState = state;

  switch (move.type) {
    case 'bid':
    case 'pass': {
      const passed = [...state.passed];
      let bid = state.bid;
      let bidder = state.bidder;
      if (move.type === 'pass') passed[seat] = true;
      else {
        bid = move.value;
        bidder = seat;
      }
      const active = passed.filter((p) => !p).length;
      if (active === 0) {
        // Alle haben gepasst: neu geben.
        next = finishRound({ ...state, passed, declarer: null }, 'passedOut');
      } else if (active === 1 && bidder !== null && !passed[bidder]) {
        const hands = state.hands.map((h, s) => (s === bidder ? [...h, ...state.dabb] : h));
        next = { ...state, passed, bid, bidder, declarer: bidder, hands, dabbOpen: true, phase: 'discard' };
      } else {
        let speaker = (seat + 1) % SEATS;
        while (passed[speaker]) speaker = (speaker + 1) % SEATS;
        next = { ...state, passed, bid, bidder, speaker };
      }
      break;
    }
    case 'discard': {
      const hand = own(state.hands[seat]!).filter((c) => !move.cards.includes(c));
      next = { ...state, hands: state.hands.map((h, s) => (s === seat ? hand : h)), pressed: [...move.cards], phase: 'declare' };
      break;
    }
    case 'declareTrump': {
      const melds = state.hands.map((h) => findMelds(own(h), move.suit));
      next = { ...state, trump: move.suit, melds, phase: 'play', leader: vorhand(state.dealer) };
      break;
    }
    case 'declareDurch':
      next = { ...state, durch: true, trump: null, phase: 'play', leader: state.declarer! };
      break;
    case 'fold': {
      const melds = state.hands.map((h, s) => (s === state.declarer ? [] : findMelds(own(h), null)));
      next = finishRound({ ...state, melds }, 'fold');
      break;
    }
    case 'play': {
      const hands = state.hands.map((h, s) => {
        if (s !== seat) return h;
        const i = h.indexOf(move.card);
        return [...h.slice(0, i), ...h.slice(i + 1)];
      });
      const trick = [...state.currentTrick, { player: seat, card: move.card }];
      next = { ...state, hands, currentTrick: trick };
      if (trick.length === SEATS) {
        const winner = trickWinner(trick, binokelContract(state.trump)).player;
        next = { ...next, currentTrick: [], completedTricks: [...state.completedTricks, { winner, cards: trick }], leader: winner };
        const done = hands.every((h) => h.length === 0);
        if (state.durch && winner !== state.declarer) next = finishRound(next, 'durch');
        else if (done) next = finishRound(next, state.durch ? 'durch' : 'normal');
      }
      break;
    }
    case 'nextGame': {
      const dealer = (state.dealer + 1) % SEATS;
      next = freshRound({ ...state, lastRound: state.lastRound }, dealer, state.gameNumber + 1);
      break;
    }
  }
  return { state: next, events: trickGameEvents(state, next, seat, move as { type: string; card?: CardId }) };
}

export function result(state: BinokelState): Result | null {
  if (state.phase !== 'finished') return null;
  const best = Math.max(...state.scores);
  const winners = state.scores.flatMap((s, seat) => (s === best ? [seat] : []));
  return winners.length === 1 ? { kind: 'win', winners } : { kind: 'draw' };
}

/** Fremde Hände, der Dabb bis zum Aufdecken und die gedrückten Karten bleiben verdeckt. */
export function playerView(state: BinokelState, seat: SeatId | 'spectator'): BinokelState {
  const roundDone = state.phase === 'roundOver' || state.phase === 'finished';
  return {
    ...state,
    hands: state.hands.map((h, s) => (s === seat ? h : h.map(() => null))),
    dabb: state.dabbOpen ? state.dabb : state.dabb.map(() => null),
    pressed: seat === state.declarer || roundDone ? state.pressed : state.pressed.map(() => null),
    dealRng: [0, 0, 0, 0],
  };
}

/**
 * Für Bots: unbekannte Karten zufällig verteilen. Gemeldete Karten bleiben bei ihrem Besitzer.
 * Abwürfe und Farbfreiheiten werden nicht berücksichtigt – die Sicht stimmt trotzdem genau.
 */
export function sampleHidden(view: BinokelState, seat: SeatId, rng: Rng): BinokelState {
  const known = new Set<CardId>();
  for (const c of own(view.hands[seat] ?? [])) known.add(c);
  for (const t of view.completedTricks) for (const p of t.cards) known.add(p.card);
  for (const p of view.currentTrick) known.add(p.card);
  for (const c of own(view.pressed)) known.add(c);
  const reserved = view.melds.map((ms, s) => (s === seat ? [] : [...new Set(ms.flatMap((m) => m.cards))].filter((c) => !known.has(c))));
  for (const r of reserved) for (const c of r) known.add(c);
  const pool = rng.shuffle(createDeck(view.deckSize).filter((c) => !known.has(c)));
  const hands = view.hands.map((h, s) => {
    if (s === seat) return h;
    const mine = [...reserved[s]!];
    return h.map(() => mine.pop() ?? pool.pop() ?? null);
  });
  const dabb = view.dabbOpen ? view.dabb : view.dabb.map(() => pool.pop() ?? null);
  const pressed = view.pressed.map((c) => c ?? pool.pop() ?? null);
  return { ...view, hands, dabb, pressed, dealRng: rng.state };
}
