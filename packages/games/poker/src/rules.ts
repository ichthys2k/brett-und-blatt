import {
  createDeck,
  Rng,
  type Actor,
  type CardId,
  type GameEvent,
  type MoveResult,
  type Options,
  type OptionSpec,
  type Result,
  type RngState,
  type SeatId,
  type TimePresets,
} from '@brett-und-blatt/engine';
import { bestFive, describeValue } from './eval';
import { buildPots, settlePots, type Pot, type PotAward } from './pots';

export type BettingStructure = 'nl' | 'pl' | 'fl';
export type GameMode = 'tournament' | 'hands20' | 'hands50';
export type Street = 'preflop' | 'flop' | 'turn' | 'river' | 'complete';
export type SeatStatus = 'active' | 'waiting' | 'eliminated' | 'empty';
export type ChipTheme = 'chips' | 'beans' | 'matches';

export type PokerMove =
  | { type: 'fold' }
  | { type: 'check' }
  | { type: 'call' }
  | { type: 'bet'; amount: number }
  | { type: 'raise'; to: number }
  | { type: 'allIn' }
  | { type: 'joinSeat'; seat: SeatId }
  | { type: 'leaveSeat'; seat: SeatId };

export interface PokerSeat {
  seat: SeatId;
  status: SeatStatus;
  chips: number;
  handStartChips: number;
  inHand: boolean;
  folded: boolean;
  allIn: boolean;
  streetBet: number;
  totalCommitted: number;
  acted: boolean;
  holeCards: CardId[];
  holeCardCount: number;
  revealed: boolean;
  lastAction: string | null;
  place: number | null;
}

export interface PlayerStats {
  handsSeen: number;
  vpipCount: number;
  pfrCount: number;
  aggressiveActions: number;
  passiveActions: number;
}

export interface ShownHand {
  seat: SeatId;
  cards: CardId[];
  bestCards: CardId[];
  handName: string;
  value: number;
}

export interface HandSummary {
  handNumber: number;
  board: CardId[];
  pots: PotAward[];
  shownHands: ShownHand[];
  showdown: boolean;
}

export interface PokerState {
  structure: BettingStructure;
  mode: GameMode;
  maxHands: number;
  startChips: number;
  handsPerLevel: number;
  anteMode: 'none' | 'level4' | 'always';
  theme: ChipTheme;
  deckStyle: 'fourColor' | 'classic';
  aid: 'name' | 'none';
  seats: PokerSeat[];
  stats: PlayerStats[];
  handNumber: number;
  levelIndex: number;
  smallBlind: number;
  bigBlind: number;
  ante: number;
  button: SeatId;
  smallBlindSeat: SeatId;
  bigBlindSeat: SeatId;
  street: Street;
  board: CardId[];
  deck: CardId[];
  rngState: RngState;
  actor: SeatId | null;
  currentBet: number;
  minRaise: number;
  raisesInStreet: number;
  lastAggressor: SeatId | null;
  lastHand: HandSummary | null;
}

export type PokerView = PokerState;

export const MAX_RAISES_PER_STREET = 4;

export interface BlindLevel {
  sb: number;
  bb: number;
  ante: number;
}

export const BLIND_LEVELS: readonly BlindLevel[] = [
  { sb: 10, bb: 20, ante: 2 },
  { sb: 15, bb: 30, ante: 3 },
  { sb: 25, bb: 50, ante: 5 },
  { sb: 50, bb: 100, ante: 10 },
  { sb: 100, bb: 200, ante: 20 },
  { sb: 200, bb: 400, ante: 40 },
  { sb: 400, bb: 800, ante: 80 },
  { sb: 800, bb: 1600, ante: 160 },
  { sb: 1500, bb: 3000, ante: 300 },
  { sb: 3000, bb: 6000, ante: 600 },
  { sb: 6000, bb: 12000, ante: 1200 },
  { sb: 15000, bb: 30000, ante: 3000 },
];

export const options: OptionSpec[] = [
  {
    id: 'structure',
    label: 'Einsatzstruktur',
    choices: [
      { value: 'nl', label: 'No Limit' },
      { value: 'pl', label: 'Pot Limit' },
      { value: 'fl', label: 'Fixed Limit' },
    ],
    default: 'nl',
  },
  {
    id: 'mode',
    label: 'Partieform',
    choices: [
      { value: 'tournament', label: 'Turnier (steigende Blinds)' },
      { value: 'hands20', label: 'Offener Tisch (20 Hände)' },
      { value: 'hands50', label: 'Offener Tisch (50 Hände)' },
    ],
    default: 'tournament',
  },
  {
    id: 'stack',
    label: 'Startchips',
    choices: [
      { value: '50', label: '50 BB (1.000)' },
      { value: '100', label: '100 BB (2.000)' },
      { value: '200', label: '200 BB (4.000)' },
    ],
    default: '100',
  },
  {
    id: 'speed',
    label: 'Blind-Tempo',
    when: { mode: ['tournament'] },
    choices: [
      { value: 'relaxed', label: 'Gemütlich (alle 10 Hände)' },
      { value: 'normal', label: 'Normal (alle 6 Hände)' },
      { value: 'fast', label: 'Schnell (alle 4 Hände)' },
    ],
    default: 'normal',
  },
  {
    id: 'ante',
    label: 'Ante',
    choices: [
      { value: 'none', label: 'Aus' },
      { value: 'level4', label: 'Ab Stufe 4' },
      { value: 'always', label: 'Immer' },
    ],
    default: 'level4',
  },
  {
    id: 'theme',
    label: 'Spielmarken',
    choices: [
      { value: 'chips', label: 'Chips' },
      { value: 'beans', label: 'Bohnen' },
      { value: 'matches', label: 'Streichhölzer' },
    ],
    default: 'chips',
  },
  {
    id: 'deckStyle',
    label: 'Kartenbild',
    choices: [
      { value: 'fourColor', label: 'Vierfarbig' },
      { value: 'classic', label: 'Klassisch' },
    ],
    default: 'fourColor',
  },
  {
    id: 'aid',
    label: 'Lernhilfe',
    choices: [
      { value: 'name', label: 'Handname anzeigen' },
      { value: 'none', label: 'Aus' },
    ],
    default: 'name',
  },
  {
    id: 'emptySeats',
    label: 'Freie Plätze beim Start',
    hidden: true,
    pattern: '^[0-9,]*$',
    choices: [{ value: '', label: 'Keine' }],
    default: '',
  },
];

export const timePresets: TimePresets = {
  relaxed: { kind: 'none' },
  normal: { kind: 'perMove', moveMs: 20_000, bankMs: 60_000 },
  fast: { kind: 'perMove', moveMs: 10_000, bankMs: 30_000 },
};

function parseEmptySeats(raw: string | undefined, seatCount: number): Set<number> {
  const out = new Set<number>();
  if (!raw) return out;
  for (const part of raw.split(',')) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const idx = Number(trimmed);
    if (Number.isInteger(idx) && idx >= 0 && idx < seatCount) out.add(idx);
  }
  return out;
}

export function setup(seatCount: number, opts: Options, seed: string): PokerState {
  const structure: BettingStructure = opts.structure === 'pl' || opts.structure === 'fl' ? opts.structure : 'nl';
  const mode: GameMode = opts.mode === 'hands20' || opts.mode === 'hands50' ? opts.mode : 'tournament';
  const stackBb = opts.stack === '50' ? 50 : opts.stack === '200' ? 200 : 100;
  const startChips = stackBb * 20;
  const handsPerLevel = opts.speed === 'relaxed' ? 10 : opts.speed === 'fast' ? 4 : 6;
  const maxHands = mode === 'hands20' ? 20 : mode === 'hands50' ? 50 : 75;
  const anteMode = opts.ante === 'none' || opts.ante === 'always' ? opts.ante : 'level4';
  const theme: ChipTheme = opts.theme === 'beans' || opts.theme === 'matches' ? opts.theme : 'chips';
  const deckStyle = opts.deckStyle === 'classic' ? 'classic' : 'fourColor';
  const aid = opts.aid === 'none' ? 'none' : 'name';

  const emptySet = parseEmptySeats(opts.emptySeats, seatCount);
  // Mindestens 2 aktive Plätze sichern.
  if (seatCount - emptySet.size < 2) emptySet.clear();

  const rng = Rng.fromSeed(seed, 'poker');
  const seats: PokerSeat[] = Array.from({ length: seatCount }, (_, seat) => {
    const isEmpty = emptySet.has(seat);
    return {
      seat,
      status: isEmpty ? 'empty' : 'active',
      chips: isEmpty ? 0 : startChips,
      handStartChips: isEmpty ? 0 : startChips,
      inHand: false,
      folded: true,
      allIn: false,
      streetBet: 0,
      totalCommitted: 0,
      acted: false,
      holeCards: [],
      holeCardCount: 0,
      revealed: false,
      lastAction: null,
      place: null,
    };
  });

  const stats: PlayerStats[] = Array.from({ length: seatCount }, () => ({
    handsSeen: 0,
    vpipCount: 0,
    pfrCount: 0,
    aggressiveActions: 0,
    passiveActions: 0,
  }));

  const state: PokerState = {
    structure,
    mode,
    maxHands,
    startChips,
    handsPerLevel,
    anteMode,
    theme,
    deckStyle,
    aid,
    seats,
    stats,
    handNumber: 0,
    levelIndex: 0,
    smallBlind: 10,
    bigBlind: 20,
    ante: 0,
    button: seatCount - 1,
    smallBlindSeat: 0,
    bigBlindSeat: 1 % seatCount,
    street: 'preflop',
    board: [],
    deck: [],
    rngState: rng.state,
    actor: null,
    currentBet: 0,
    minRaise: 20,
    raisesInStreet: 0,
    lastAggressor: null,
    lastHand: null,
  };

  startHand(state, []);
  return state;
}

function cloneState(state: PokerState): PokerState {
  return {
    ...state,
    seats: state.seats.map((s) => ({ ...s, holeCards: [...s.holeCards] })),
    stats: state.stats.map((st) => ({ ...st })),
    board: [...state.board],
    deck: [...state.deck],
    rngState: [...state.rngState] as RngState,
    lastHand: state.lastHand
      ? {
          ...state.lastHand,
          board: [...state.lastHand.board],
          pots: state.lastHand.pots.map((p) => ({ ...p, winners: [...p.winners] })),
          shownHands: state.lastHand.shownHands.map((h) => ({ ...h, cards: [...h.cards], bestCards: [...h.bestCards] })),
        }
      : null,
  };
}

/** Nächster Platz im Uhrzeigersinn, der `predicate` erfüllt. */
function nextSeatFrom(seats: readonly PokerSeat[], startExclusive: SeatId, predicate: (s: PokerSeat) => boolean): SeatId | null {
  const n = seats.length;
  for (let offset = 1; offset <= n; offset++) {
    const idx = (startExclusive + offset) % n;
    if (predicate(seats[idx]!)) return idx;
  }
  return null;
}

function postChipAmount(seat: PokerSeat, amount: number, CountInStreetBet: boolean): number {
  const paid = Math.min(seat.chips, Math.max(0, amount));
  seat.chips -= paid;
  seat.totalCommitted += paid;
  if (CountInStreetBet) seat.streetBet += paid;
  if (seat.chips === 0) seat.allIn = true;
  return paid;
}

/** Startet die nächste Hand oder beendet die Partie, wenn keine weitere Hand möglich ist. */
function startHand(state: PokerState, events: GameEvent[]): void {
  // Wartende Spieler (im laufenden Betrieb dazugekommen) für diese Hand aktivieren.
  for (const s of state.seats) {
    if (s.status === 'waiting') {
      s.status = 'active';
      if (s.chips <= 0) s.chips = state.startChips;
    }
  }

  const playable = state.seats.filter((s) => s.status === 'active' && s.chips > 0);
  if (playable.length <= 1 || state.handNumber >= state.maxHands) {
    state.street = 'complete';
    state.actor = null;
    state.board = [];
    state.deck = [];
    for (const s of state.seats) {
      s.inHand = false;
      s.folded = true;
      s.allIn = false;
      s.streetBet = 0;
      s.totalCommitted = 0;
      s.holeCards = [];
      s.holeCardCount = 0;
    }
    return;
  }

  const prevLevel = state.levelIndex;
  state.handNumber += 1;
  state.levelIndex =
    state.mode === 'tournament'
      ? Math.min(BLIND_LEVELS.length - 1, Math.floor((state.handNumber - 1) / state.handsPerLevel))
      : 0;
  const blindSpec = BLIND_LEVELS[state.levelIndex]!;
  state.smallBlind = blindSpec.sb;
  state.bigBlind = blindSpec.bb;
  state.ante =
    state.anteMode === 'always' || (state.anteMode === 'level4' && state.levelIndex >= 3)
      ? blindSpec.ante
      : 0;
  if (state.handNumber > 1 && state.levelIndex > prevLevel) {
    events.push({
      type: 'blindLevelUp',
      level: state.levelIndex + 1,
      smallBlind: state.smallBlind,
      bigBlind: state.bigBlind,
    });
  }

  const button = nextSeatFrom(state.seats, state.button, (s) => s.status === 'active' && s.chips > 0) ?? playable[0]!.seat;
  state.button = button;

  // Reihenfolge der aktiven Plätze ab dem Dealer-Button.
  const ordered: SeatId[] = [button];
  let cursor = button;
  while (ordered.length < playable.length) {
    const next = nextSeatFrom(state.seats, cursor, (s) => s.status === 'active' && s.chips > 0)!;
    ordered.push(next);
    cursor = next;
  }

  if (ordered.length === 2) {
    // Heads-up: Dealer ist Small Blind.
    state.smallBlindSeat = ordered[0]!;
    state.bigBlindSeat = ordered[1]!;
  } else {
    state.smallBlindSeat = ordered[1]!;
    state.bigBlindSeat = ordered[2]!;
  }

  const rng = new Rng(state.rngState);
  const deck = rng.shuffle(createDeck());
  let deckPos = 0;

  for (const s of state.seats) {
    if (s.status === 'active' && s.chips > 0) {
      s.handStartChips = s.chips;
      s.inHand = true;
      s.folded = false;
      s.allIn = false;
      s.streetBet = 0;
      s.totalCommitted = 0;
      s.acted = false;
      s.holeCards = [deck[deckPos++]!, deck[deckPos++]!];
      s.holeCardCount = 2;
      s.revealed = false;
      s.lastAction = null;
      const st = state.stats[s.seat];
      if (st) st.handsSeen += 1;
    } else {
      s.handStartChips = s.chips;
      s.inHand = false;
      s.folded = true;
      s.allIn = false;
      s.streetBet = 0;
      s.totalCommitted = 0;
      s.acted = false;
      s.holeCards = [];
      s.holeCardCount = 0;
      s.revealed = false;
      s.lastAction = null;
    }
  }

  state.deck = deck.slice(deckPos);
  state.rngState = rng.state;
  state.board = [];
  state.street = 'preflop';

  if (state.ante > 0) {
    for (const seatId of ordered) {
      postChipAmount(state.seats[seatId]!, state.ante, false);
    }
  }

  const sbSeat = state.seats[state.smallBlindSeat]!;
  const bbSeat = state.seats[state.bigBlindSeat]!;
  postChipAmount(sbSeat, state.smallBlind, true);
  sbSeat.lastAction = sbSeat.allIn ? 'All-in (SB)' : 'SB';
  postChipAmount(bbSeat, state.bigBlind, true);
  bbSeat.lastAction = bbSeat.allIn ? 'All-in (BB)' : 'BB';

  state.currentBet = Math.max(sbSeat.streetBet, bbSeat.streetBet);
  state.minRaise = state.bigBlind;
  state.raisesInStreet = 0;
  state.lastAggressor = null;

  events.push({ type: 'deal', handNumber: state.handNumber, button: state.button });

  // Erster Spieler vor dem Flop sitzt links vom Big Blind.
  const firstActor = nextSeatFrom(
    state.seats,
    state.bigBlindSeat,
    (s) => s.inHand && !s.folded && !s.allIn,
  );
  state.actor = firstActor;
  advanceIfRoundComplete(state, state.bigBlindSeat, events);
}

/** Prüft, ob die aktuelle Setzrunde oder die Hand beendet ist, und schaltet entsprechend weiter. */
function advanceIfRoundComplete(state: PokerState, lastActor: SeatId, events: GameEvent[]): void {
  if (state.street === 'complete') return;

  const inHandNotFolded = state.seats.filter((s) => s.inHand && !s.folded);

  // Fall 1: Alle bis auf einen haben gepasst → sofortiger Gewinn ohne Showdown.
  if (inHandNotFolded.length <= 1) {
    const winner = inHandNotFolded[0]?.seat ?? state.button;
    const totalPot = state.seats.reduce((sum, s) => sum + s.totalCommitted, 0);
    if (state.seats[winner]) {
      state.seats[winner]!.chips += totalPot;
    }
    state.lastHand = {
      handNumber: state.handNumber,
      board: [...state.board],
      pots: totalPot > 0 ? [{ potIndex: 0, amount: totalPot, winners: [winner] }] : [],
      shownHands: [],
      showdown: false,
    };
    const eliminated = markEliminations(state);
    events.push({ type: 'handEnd', handNumber: state.handNumber, winners: [winner], showdown: false, eliminated });
    if (eliminated.length > 0) {
      events.push({ type: 'eliminated', seats: eliminated });
    }
    startHand(state, events);
    return;
  }

  const canAct = inHandNotFolded.filter((s) => !s.allIn);
  const needToAct = canAct.filter((s) => !s.acted || s.streetBet < state.currentBet);

  // Wenn höchstens ein Spieler noch Chips übrig hat und den Höchsteinsatz bereits hält, kann niemand mehr setzen.
  const noMoreBettingPossible = canAct.length <= 1 && canAct.every((s) => s.streetBet >= state.currentBet);

  if (needToAct.length > 0 && !noMoreBettingPossible) {
    state.actor = nextSeatFrom(
      state.seats,
      lastActor,
      (s) => s.inHand && !s.folded && !s.allIn && (!s.acted || s.streetBet < state.currentBet),
    );
    if (state.actor !== null) return;
  }

  // Wenn niemand mehr setzen kann (All-in-Runout), restliche Boardkarten aufdecken und Showdown.
  if (canAct.length <= 1) {
    runOutAndShowdown(state, events);
    return;
  }

  // Nächste Straße aufdecken.
  for (const s of state.seats) {
    s.streetBet = 0;
    s.acted = false;
    if (s.inHand && !s.folded && !s.allIn) s.lastAction = null;
  }
  state.currentBet = 0;
  state.minRaise = state.bigBlind;
  state.raisesInStreet = 0;
  state.lastAggressor = null;

  if (state.street === 'preflop') {
    state.street = 'flop';
    state.board.push(state.deck[0]!, state.deck[1]!, state.deck[2]!);
    state.deck = state.deck.slice(3);
    events.push({ type: 'street', street: 'flop' });
  } else if (state.street === 'flop') {
    state.street = 'turn';
    state.board.push(state.deck[0]!);
    state.deck = state.deck.slice(1);
    events.push({ type: 'street', street: 'turn' });
  } else if (state.street === 'turn') {
    state.street = 'river';
    state.board.push(state.deck[0]!);
    state.deck = state.deck.slice(1);
    events.push({ type: 'street', street: 'river' });
  } else {
    runOutAndShowdown(state, events);
    return;
  }

  state.actor = nextSeatFrom(state.seats, state.button, (s) => s.inHand && !s.folded && !s.allIn);
  if (state.actor === null) {
    runOutAndShowdown(state, events);
  }
}

function runOutAndShowdown(state: PokerState, events: GameEvent[]): void {
  let dealt = 0;
  while (state.board.length < 5 && state.deck.length > 0) {
    state.board.push(state.deck[0]!);
    state.deck = state.deck.slice(1);
    dealt += 1;
  }
  if (dealt > 0) {
    events.push({ type: 'street', street: 'runout', count: dealt });
  }

  const committed = state.seats.map((s) => s.totalCommitted);
  const eligibleMask = state.seats.map((s) => s.inHand && !s.folded);
  const handValues: (number | null)[] = state.seats.map(() => null);
  const shownHands: ShownHand[] = [];

  for (const s of state.seats) {
    if (s.inHand && !s.folded) {
      s.revealed = true;
      const allCards = [...s.holeCards, ...state.board];
      const best = bestFive(allCards);
      handValues[s.seat] = best.value;
      shownHands.push({
        seat: s.seat,
        cards: [...s.holeCards],
        bestCards: best.cards,
        handName: describeValue(best.value),
        value: best.value,
      });
    }
  }

  const pots = buildPots(committed, eligibleMask);
  const { winnings, awards } = settlePots(pots, handValues, state.button, state.seats.length);
  for (let i = 0; i < state.seats.length; i++) {
    state.seats[i]!.chips += winnings[i] ?? 0;
  }

  const allWinners = [...new Set(awards.flatMap((a) => a.winners))];
  state.lastHand = {
    handNumber: state.handNumber,
    board: [...state.board],
    pots: awards,
    shownHands,
    showdown: true,
  };

  const eliminated = markEliminations(state);
  events.push({ type: 'handEnd', handNumber: state.handNumber, winners: allWinners, showdown: true, eliminated });
  if (eliminated.length > 0) {
    events.push({ type: 'eliminated', seats: eliminated });
  }
  startHand(state, events);
}

function markEliminations(state: PokerState): SeatId[] {
  const busted = state.seats.filter((s) => s.status === 'active' && s.chips <= 0);
  if (busted.length === 0) return [];
  const remainingActive = state.seats.filter((s) => s.status === 'active' && s.chips > 0).length;
  // Wer mit mehr Chips in die Hand ging, erhält bei gleichzeitigem Ausscheiden den besseren Platz.
  const sortedBusted = [...busted].sort((a, b) => b.handStartChips - a.handStartChips);
  sortedBusted.forEach((s, idx) => {
    s.status = 'eliminated';
    s.place = remainingActive + idx + 1;
  });
  return sortedBusted.map((s) => s.seat);
}

/** Berechnet den aktuellen Gesamtpot (inklusive laufender Einsätze dieser Straße). */
export function totalPot(state: PokerState): number {
  return state.seats.reduce((sum, s) => sum + s.totalCommitted, 0);
}

/** Aktuelle Pots für die Anzeige auf dem Tisch. */
export function currentPots(state: PokerState): Pot[] {
  return buildPots(
    state.seats.map((s) => s.totalCommitted),
    state.seats.map((s) => s.inHand && !s.folded),
  );
}

/** Grenzen für einen Einsatz oder eine Erhöhung des Spielers am Zug (`to` = Gesamteinsatz auf dieser Straße). */
export function raiseBounds(state: PokerState, seat: SeatId): { canRaise: boolean; minTo: number; maxTo: number; maxByStack: number } {
  const me = state.seats[seat];
  if (!me || !me.inHand || me.folded || me.allIn || me.chips <= 0) {
    return { canRaise: false, minTo: 0, maxTo: 0, maxByStack: 0 };
  }
  const toCall = Math.max(0, state.currentBet - me.streetBet);
  const maxByStack = me.streetBet + me.chips;
  if (me.chips <= toCall || state.raisesInStreet >= MAX_RAISES_PER_STREET) {
    return { canRaise: false, minTo: maxByStack, maxTo: maxByStack, maxByStack };
  }
  const othersCanActOrCall = state.seats.some((s) => s.seat !== seat && s.inHand && !s.folded && !s.allIn);
  if (!othersCanActOrCall) {
    return { canRaise: false, minTo: maxByStack, maxTo: maxByStack, maxByStack };
  }

  if (state.structure === 'fl') {
    const inc = state.street === 'turn' || state.street === 'river' ? state.bigBlind * 2 : state.bigBlind;
    const target = state.currentBet + inc;
    const clamped = Math.min(maxByStack, target);
    return { canRaise: clamped > state.currentBet, minTo: clamped, maxTo: clamped, maxByStack };
  }

  const minTo = Math.min(maxByStack, state.currentBet === 0 ? state.bigBlind : state.currentBet + state.minRaise);
  if (state.structure === 'pl') {
    const potBefore = totalPot(state);
    const maxPotTo = state.currentBet + toCall + potBefore;
    const maxTo = Math.min(maxByStack, Math.max(minTo, maxPotTo));
    return { canRaise: maxTo > state.currentBet, minTo, maxTo, maxByStack };
  }

  return { canRaise: maxByStack > state.currentBet, minTo, maxTo: maxByStack, maxByStack };
}

export function currentPlayers(state: PokerState): Actor[] {
  if (state.street === 'complete' || state.actor === null) return [];
  return [state.actor];
}

export function legalMoves(state: PokerState, actor: Actor): PokerMove[] {
  if (typeof actor !== 'number' || state.street === 'complete' || state.actor !== actor) return [];
  const me = state.seats[actor];
  if (!me || !me.inHand || me.folded || me.allIn) return [];

  const moves: PokerMove[] = [];
  const toCall = Math.max(0, state.currentBet - me.streetBet);

  if (toCall === 0) {
    moves.push({ type: 'check' });
  } else {
    moves.push({ type: 'fold' });
    if (me.chips > toCall) {
      moves.push({ type: 'call' });
    } else {
      moves.push({ type: 'allIn' });
      return moves;
    }
  }

  const bounds = raiseBounds(state, actor);
  if (bounds.canRaise) {
    const potNow = totalPot(state) + toCall;
    const candidates =
      state.structure === 'fl'
        ? [bounds.minTo]
        : [
            bounds.minTo,
            state.currentBet + Math.round(potNow * 0.5),
            state.currentBet + Math.round(potNow * 0.75),
            state.currentBet + potNow,
          ];
    const seen = new Set<number>();
    for (const raw of candidates) {
      const target = Math.max(bounds.minTo, Math.min(bounds.maxTo, raw));
      if (target >= bounds.maxByStack) continue;
      if (target <= state.currentBet || seen.has(target)) continue;
      seen.add(target);
      if (state.currentBet === 0) {
        moves.push({ type: 'bet', amount: target });
      } else {
        moves.push({ type: 'raise', to: target });
      }
    }
    if (bounds.maxTo >= bounds.maxByStack) {
      moves.push({ type: 'allIn' });
    }
  }

  return moves;
}

export function isLegal(state: PokerState, actor: Actor, move: PokerMove): boolean {
  if (!move || typeof move !== 'object') return false;
  if (move.type === 'joinSeat') {
    return seatChangeMove(state, move.seat, true) !== null;
  }
  if (move.type === 'leaveSeat') {
    return seatChangeMove(state, move.seat, false) !== null;
  }
  if (typeof actor !== 'number' || state.street === 'complete' || state.actor !== actor) return false;
  const me = state.seats[actor];
  if (!me || !me.inHand || me.folded || me.allIn) return false;

  const toCall = Math.max(0, state.currentBet - me.streetBet);
  switch (move.type) {
    case 'fold':
      return true;
    case 'check':
      return toCall === 0;
    case 'call':
      return toCall > 0 && me.chips > toCall;
    case 'allIn': {
      if (me.chips <= 0) return false;
      if (me.chips <= toCall) return true;
      const bounds = raiseBounds(state, actor);
      return bounds.canRaise && bounds.maxTo >= bounds.maxByStack;
    }
    case 'bet': {
      if (state.currentBet !== 0) return false;
      if (!Number.isInteger(move.amount)) return false;
      const bounds = raiseBounds(state, actor);
      return bounds.canRaise && move.amount >= bounds.minTo && move.amount <= bounds.maxTo && move.amount < bounds.maxByStack;
    }
    case 'raise': {
      if (state.currentBet === 0) return false;
      if (!Number.isInteger(move.to)) return false;
      const bounds = raiseBounds(state, actor);
      return bounds.canRaise && move.to >= bounds.minTo && move.to <= bounds.maxTo && move.to < bounds.maxByStack;
    }
    default:
      return false;
  }
}

export function seatChangeMove(state: PokerState, seat: SeatId, active: boolean): PokerMove | null {
  if (state.street === 'complete' || !Number.isInteger(seat) || seat < 0 || seat >= 10) return null;
  if (active) {
    if (seat === state.seats.length) {
      return { type: 'joinSeat', seat };
    }
    const target = state.seats[seat];
    if (!target) return null;
    if (target.status === 'empty' || (state.mode !== 'tournament' && target.status === 'eliminated')) {
      return { type: 'joinSeat', seat };
    }
    return null;
  } else {
    const target = state.seats[seat];
    if (!target || (target.status !== 'active' && target.status !== 'waiting')) return null;
    return { type: 'leaveSeat', seat };
  }
}

export function resignMove(state: PokerState, seat: SeatId): PokerMove | null {
  return seatChangeMove(state, seat, false);
}

export function timeoutMove(state: PokerState, seat: SeatId): PokerMove {
  const me = state.seats[seat];
  const toCall = me ? Math.max(0, state.currentBet - me.streetBet) : 0;
  return toCall === 0 ? { type: 'check' } : { type: 'fold' };
}

export function applyMove(state: PokerState, actor: Actor, move: PokerMove): MoveResult<PokerState> {
  if (!isLegal(state, actor, move)) {
    throw new Error(`Unerlaubter Zug: ${JSON.stringify(move)}`);
  }

  const next = cloneState(state);
  const events: GameEvent[] = [];

  if (move.type === 'joinSeat') {
    const seat = move.seat;
    if (seat === next.seats.length) {
      next.seats.push({
        seat,
        status: 'waiting',
        chips: next.startChips,
        handStartChips: next.startChips,
        inHand: false,
        folded: true,
        allIn: false,
        streetBet: 0,
        totalCommitted: 0,
        acted: false,
        holeCards: [],
        holeCardCount: 0,
        revealed: false,
        lastAction: 'Ab nächster Hand',
        place: null,
      });
      next.stats.push({ handsSeen: 0, vpipCount: 0, pfrCount: 0, aggressiveActions: 0, passiveActions: 0 });
    } else {
      const target = next.seats[seat]!;
      target.status = 'waiting';
      target.chips = next.startChips;
      target.handStartChips = next.startChips;
      target.inHand = false;
      target.folded = true;
      target.allIn = false;
      target.streetBet = 0;
      target.totalCommitted = 0;
      target.acted = false;
      target.holeCards = [];
      target.holeCardCount = 0;
      target.revealed = false;
      target.lastAction = 'Ab nächster Hand';
      target.place = null;
    }
    events.push({ type: 'joined', seat });
    return { state: next, events };
  }

  if (move.type === 'leaveSeat') {
    const seat = move.seat;
    const target = next.seats[seat]!;
    const wasInHand = target.inHand && !target.folded;
    target.status = 'empty';
    target.chips = 0;
    target.folded = true;
    target.allIn = false;
    target.acted = true;
    target.holeCards = [];
    target.holeCardCount = 0;
    target.revealed = false;
    target.lastAction = 'Aufgestanden';
    events.push({ type: 'left', seat });

    const remainingSeated = next.seats.filter((s) => s.status === 'active' || s.status === 'waiting');
    if (remainingSeated.length <= 1) {
      // Nur noch ein Spieler am Tisch übrig: laufenden Pot an ihn auszahlen und Partie beenden.
      const sole = remainingSeated[0];
      if (sole) {
        const pot = totalPot(next);
        sole.chips += pot;
      }
      next.street = 'complete';
      next.actor = null;
      return { state: next, events };
    }

    if (wasInHand) {
      advanceIfRoundComplete(next, seat, events);
    }
    return { state: next, events };
  }

  const seat = actor as SeatId;
  const me = next.seats[seat]!;
  const stats = next.stats[seat]!;
  const toCall = Math.max(0, next.currentBet - me.streetBet);

  switch (move.type) {
    case 'fold': {
      me.folded = true;
      me.acted = true;
      me.lastAction = 'Passen';
      events.push({ type: 'fold', seat });
      break;
    }
    case 'check': {
      me.acted = true;
      me.lastAction = 'Schieben';
      stats.passiveActions += 1;
      events.push({ type: 'check', seat });
      break;
    }
    case 'call': {
      postChipAmount(me, toCall, true);
      me.acted = true;
      me.lastAction = me.allIn ? 'All-in' : 'Mitgehen';
      if (next.street === 'preflop') stats.vpipCount += 1;
      stats.passiveActions += 1;
      events.push({ type: 'call', seat, amount: toCall });
      break;
    }
    case 'bet': {
      const add = move.amount - me.streetBet;
      postChipAmount(me, add, true);
      me.acted = true;
      me.lastAction = `Setzen ${me.streetBet}`;
      next.currentBet = me.streetBet;
      next.minRaise = Math.max(next.bigBlind, me.streetBet);
      next.raisesInStreet += 1;
      next.lastAggressor = seat;
      for (const s of next.seats) {
        if (s.seat !== seat && s.inHand && !s.folded && !s.allIn) s.acted = false;
      }
      if (next.street === 'preflop') {
        stats.vpipCount += 1;
        stats.pfrCount += 1;
      }
      stats.aggressiveActions += 1;
      events.push({ type: 'bet', seat, amount: me.streetBet });
      break;
    }
    case 'raise': {
      const prevBet = next.currentBet;
      const add = move.to - me.streetBet;
      postChipAmount(me, add, true);
      me.acted = true;
      me.lastAction = `Erhöhen ${me.streetBet}`;
      const diff = me.streetBet - prevBet;
      next.currentBet = me.streetBet;
      if (diff >= next.minRaise) {
        next.minRaise = diff;
      }
      next.raisesInStreet += 1;
      next.lastAggressor = seat;
      for (const s of next.seats) {
        if (s.seat !== seat && s.inHand && !s.folded && !s.allIn) s.acted = false;
      }
      if (next.street === 'preflop') {
        stats.vpipCount += 1;
        stats.pfrCount += 1;
      }
      stats.aggressiveActions += 1;
      events.push({ type: 'raise', seat, to: me.streetBet });
      break;
    }
    case 'allIn': {
      const prevBet = next.currentBet;
      postChipAmount(me, me.chips, true);
      me.acted = true;
      me.allIn = true;
      me.lastAction = `All-in (${me.streetBet})`;
      if (me.streetBet > prevBet) {
        const diff = me.streetBet - prevBet;
        next.currentBet = me.streetBet;
        if (diff >= next.minRaise) {
          next.minRaise = diff;
          next.raisesInStreet += 1;
          next.lastAggressor = seat;
          for (const s of next.seats) {
            if (s.seat !== seat && s.inHand && !s.folded && !s.allIn) s.acted = false;
          }
        }
        if (next.street === 'preflop') {
          stats.vpipCount += 1;
          stats.pfrCount += 1;
        }
        stats.aggressiveActions += 1;
      } else {
        if (next.street === 'preflop') stats.vpipCount += 1;
        stats.passiveActions += 1;
      }
      events.push({ type: 'allIn', seat, to: me.streetBet });
      break;
    }
  }

  advanceIfRoundComplete(next, seat, events);
  return { state: next, events };
}

export function playerView(state: PokerState, viewer: SeatId | 'spectator'): PokerView {
  return {
    ...state,
    deck: [],
    rngState: [0, 0, 0, 0],
    seats: state.seats.map((s) => {
      const canSeeCards = s.seat === viewer || s.revealed;
      return {
        ...s,
        holeCards: canSeeCards ? [...s.holeCards] : [],
      };
    }),
  };
}

export function sampleHidden(view: PokerView, _seat: SeatId, rng: Rng): PokerState {
  const next = cloneState(view);
  const known = new Set<CardId>(next.board);
  for (const s of next.seats) {
    for (const c of s.holeCards) known.add(c);
  }
  const unseen = rng.shuffle(createDeck().filter((c) => !known.has(c)));
  let pos = 0;
  for (const s of next.seats) {
    if (s.holeCards.length === 0 && s.holeCardCount > 0) {
      s.holeCards = unseen.slice(pos, pos + s.holeCardCount);
      pos += s.holeCardCount;
    }
  }
  next.deck = unseen.slice(pos);
  next.rngState = rng.state;
  return next;
}

export function result(state: PokerState): Result | null {
  if (state.street !== 'complete') return null;
  const activeSeats = state.seats.filter((s) => s.status === 'active' && s.chips > 0);
  if (activeSeats.length === 0) {
    const bestPlace = state.seats.filter((s) => s.place !== null).sort((a, b) => (a.place ?? 99) - (b.place ?? 99))[0];
    return { kind: 'win', winners: [bestPlace?.seat ?? 0] };
  }
  const maxChips = Math.max(...activeSeats.map((s) => s.chips));
  const winners = activeSeats.filter((s) => s.chips === maxChips).map((s) => s.seat);
  return { kind: 'win', winners };
}

export function evaluate(state: PokerState, seat: SeatId): number {
  const total = state.seats.reduce((sum, s) => sum + s.chips + s.totalCommitted, 0);
  if (total <= 0) return 0;
  const mine = (state.seats[seat]?.chips ?? 0) + (state.seats[seat]?.totalCommitted ?? 0);
  return (mine / total) * 2 - 1;
}
