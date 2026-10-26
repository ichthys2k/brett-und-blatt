import {
  cardEyePoints,
  cardId,
  cardRank,
  cardSuit,
  createSkatContract,
  getActivePlayers,
  handToSeat,
  legalCards,
  nextDealerIndex,
  seatToHand,
  trickPoints,
  trickWinner,
  Rng,
  type Actor,
  type CardId,
  type MoveResult,
  type Options,
  type PlayedCard,
  type Rank,
  type Result,
  type SeatId,
  type Suit,
  type Trick,
  SUITS,
} from '@brett-und-blatt/engine';

export type SkatPhase =
  | 'bidding'
  | 'skatDecision'
  | 'discard'
  | 'declare'
  | 'play'
  | 'roundOver'
  | 'passedOut';

export type SkatGameType = 'C' | 'S' | 'H' | 'D' | 'grand' | 'null';

export interface SkatDeclaration {
  gameType: SkatGameType;
  hand?: boolean;
  schneider?: boolean;
  schwarz?: boolean;
  ouvert?: boolean;
}

export type SkatMove =
  | { type: 'bid'; value: number }
  | { type: 'hold' }
  | { type: 'pass' }
  | { type: 'takeSkat' }
  | { type: 'playHand' }
  | { type: 'discard'; cards: [CardId, CardId] }
  | { type: 'declare'; declaration: SkatDeclaration }
  | { type: 'play'; card: CardId }
  | { type: 'concede' }
  | { type: 'claimRest' }
  | { type: 'nextGame' };

export interface GameSummary {
  dealerSeat: number;
  declarerSeat: number;
  declaration?: SkatDeclaration;
  highestBid: number;
  gameValue: number;
  declarerEyes: number;
  won: boolean;
  overbid: boolean;
  declarerScoreDiff: number;
  opponentScoreDiff: number;
}

export interface SkatState {
  playerCount: number; // 3 oder 4
  totalGames: number; // z. B. 12
  gameNumber: number; // 1-basiert
  dealerSeat: number;
  activeSeats: number[]; // 3 aktive Sitze: [Vorhand, Mittelhand, Hinterhand]
  deckStyle: 'four-color' | 'french' | 'german';
  countEyes: boolean;

  // Runden-Zustand
  phase: SkatPhase;
  hands: Record<number, CardId[]>; // seat -> Karten
  skat: CardId[]; // die 2 Skat-Karten
  discardedCards: CardId[]; // vom Alleinspieler gedrückt
  declarerSeat: number | null; // Sitzplatz des Alleinspielers
  highestBid: number;

  // Reiz-Details
  biddingStage: 'mh_vh' | 'hh_winner' | 'done';
  biddingSpeaker: number; // seat der aktuell handeln muss
  biddingListener: number; // seat des Partners im Reiz-Dialog
  biddingAwaitingAnswer: boolean; // true wenn Listener gefragt ist ("Ja" oder "Passe")
  currentBidValue: number; // bisher gebotener Wert
  passedSeats: number[]; // Sitze, die gepasst haben

  // Ansage
  declaration: SkatDeclaration | null;

  // Stichspiel
  currentTrick: Trick;
  completedTricks: { winner: number; cards: PlayedCard[]; points: number }[];
  declarerTricksCount: number;
  declarerEyes: number;
  opponentEyes: number;
  leaderSeat: number;

  // Historie und Gesamtpunkte
  scores: Record<number, number>; // seat -> Punkte
  history: GameSummary[];
}

export const SKAT_BASE_VALUES: Record<SkatGameType, number> = {
  D: 9,
  H: 10,
  S: 11,
  C: 12,
  grand: 24,
  null: 23,
};

export const SKAT_RANKS: Rank[] = [7, 8, 9, 10, 11, 12, 13, 1];

export function createSkatDeck(): CardId[] {
  const deck: CardId[] = [];
  for (const suit of SUITS) {
    for (const rank of SKAT_RANKS) {
      deck.push(cardId(suit, rank, 1));
    }
  }
  return deck;
}

/** Alle gültigen Reizwerte nach ISkO berechnen */
export function getAllBidValues(): number[] {
  const values = new Set<number>();
  values.add(23); // Null
  values.add(35); // Null Hand
  values.add(46); // Null ouvert
  values.add(59); // Null ouvert Hand

  const baseValues = [9, 10, 11, 12, 24];
  for (const base of baseValues) {
    for (let multiplier = 2; multiplier <= 18; multiplier++) {
      values.add(base * multiplier);
    }
  }
  return Array.from(values).sort((a, b) => a - b);
}

export const ALL_BID_VALUES = getAllBidValues();

export function nextPossibleBid(currentBid: number): number {
  for (const val of ALL_BID_VALUES) {
    if (val > currentBid) return val;
  }
  return currentBid + 1;
}

export function countSpitzen(cards: CardId[], gameType: SkatGameType): { mit: boolean; count: number } {
  if (gameType === 'null') {
    return { mit: false, count: 0 };
  }

  const trumpOrder: CardId[] = [
    cardId('C', 11),
    cardId('S', 11),
    cardId('H', 11),
    cardId('D', 11),
  ];

  if (gameType !== 'grand') {
    const suit = gameType as Suit;
    trumpOrder.push(cardId(suit, 1)); // Ass
    trumpOrder.push(cardId(suit, 10)); // 10
    trumpOrder.push(cardId(suit, 13)); // König
    trumpOrder.push(cardId(suit, 12)); // Dame
    trumpOrder.push(cardId(suit, 9)); // 9
    trumpOrder.push(cardId(suit, 8)); // 8
    trumpOrder.push(cardId(suit, 7)); // 7
  }

  const cardSet = new Set(cards);
  const mit = cardSet.has(trumpOrder[0]);

  let count = 0;
  for (const trump of trumpOrder) {
    if (cardSet.has(trump) === mit) {
      count++;
    } else {
      break;
    }
  }

  return { mit, count };
}

export function calculateGameValue(
  declaration: SkatDeclaration,
  allCards: CardId[],
  options: {
    schneiderMade?: boolean;
    schwarzMade?: boolean;
  } = {},
): number {
  const { gameType, hand, schneider, schwarz, ouvert } = declaration;

  if (gameType === 'null') {
    if (ouvert && hand) return 59;
    if (ouvert) return 46;
    if (hand) return 35;
    return 23;
  }

  const { count: spitzen } = countSpitzen(allCards, gameType);
  let multiplier = 1 + spitzen;

  if (hand) multiplier += 1;
  if (schneider || options.schneiderMade) multiplier += 1;
  if (schneider) multiplier += 1;
  if (schwarz || options.schwarzMade) multiplier += 1;
  if (schwarz) multiplier += 1;
  if (ouvert) multiplier += 1;

  const base = SKAT_BASE_VALUES[gameType];
  return base * multiplier;
}

// =============================================================================
// Setup & Lifecycle
// =============================================================================

export function setup(
  seats: number,
  options: Options = {},
  seed: string = 'skat',
): SkatState {
  const tablePlayers = seats;
  const totalGames = Number(options.rounds || '12');
  const deckStyle = (options.deckStyle as SkatState['deckStyle']) || 'four-color';
  const countEyes = options.countEyes === 'true';

  const dealerSeat = 0;
  const activeSeats = getActivePlayers(dealerSeat, tablePlayers, 3);

  const rng = Rng.fromSeed(seed);
  const deck = rng.shuffle(createSkatDeck());
  const hands: Record<number, CardId[]> = {};
  for (const s of activeSeats) hands[s] = [];

  let idx = 0;
  for (const s of activeSeats) {
    hands[s].push(...deck.slice(idx, idx + 3));
    idx += 3;
  }
  const skat = deck.slice(idx, idx + 2);
  idx += 2;
  for (const s of activeSeats) {
    hands[s].push(...deck.slice(idx, idx + 4));
    idx += 4;
  }
  for (const s of activeSeats) {
    hands[s].push(...deck.slice(idx, idx + 3));
    idx += 3;
  }

  const scores: Record<number, number> = {};
  for (let i = 0; i < tablePlayers; i++) scores[i] = 0;

  return {
    playerCount: tablePlayers,
    totalGames,
    gameNumber: 1,
    dealerSeat,
    activeSeats,
    deckStyle,
    countEyes,

    phase: 'bidding',
    hands,
    skat,
    discardedCards: [],
    declarerSeat: null,
    highestBid: 0,

    biddingStage: 'mh_vh',
    biddingSpeaker: activeSeats[1], // Mittelhand sagt an
    biddingListener: activeSeats[0], // Vorhand hört
    biddingAwaitingAnswer: false,
    currentBidValue: 0,
    passedSeats: [],

    declaration: null,

    currentTrick: [],
    completedTricks: [],
    declarerTricksCount: 0,
    declarerEyes: 0,
    opponentEyes: 0,
    leaderSeat: activeSeats[0],

    scores,
    history: [],
  };
}

export function currentPlayers(state: SkatState): Actor[] {
  if (state.phase === 'roundOver' || state.phase === 'passedOut') {
    return [state.activeSeats[0]];
  }

  if (state.phase === 'bidding') {
    return [state.biddingSpeaker];
  }

  if (state.phase === 'skatDecision' || state.phase === 'discard' || state.phase === 'declare') {
    return state.declarerSeat !== null ? [state.declarerSeat] : [];
  }

  if (state.phase === 'play') {
    if (state.currentTrick.length === 0) {
      return [state.leaderSeat];
    }
    const lastPlayer = state.currentTrick[state.currentTrick.length - 1].player;
    const handIdx = seatToHand(lastPlayer, state.activeSeats);
    const nextHandIdx = (handIdx + 1) % 3;
    return [handToSeat(nextHandIdx, state.activeSeats)];
  }

  return [];
}

export function legalMoves(state: SkatState, actor: Actor): SkatMove[] {
  if (actor === 'system') return [];
  const player = Number(actor);

  if (state.phase === 'roundOver' || state.phase === 'passedOut') {
    return [{ type: 'nextGame' }];
  }

  if (state.phase === 'bidding') {
    if (player !== state.biddingSpeaker) return [];

    if (state.biddingAwaitingAnswer) {
      // Hörer muss antworten: Ja (halten) oder Passe
      return [{ type: 'hold' }, { type: 'pass' }];
    }

    // Sprecher muss bieten oder passen
    const moves: SkatMove[] = [{ type: 'pass' }];
    const minBid = state.currentBidValue === 0 ? 18 : nextPossibleBid(state.currentBidValue);
    for (const val of ALL_BID_VALUES) {
      if (val >= minBid) {
        moves.push({ type: 'bid', value: val });
      }
    }
    return moves;
  }

  if (state.phase === 'skatDecision' && player === state.declarerSeat) {
    return [{ type: 'takeSkat' }, { type: 'playHand' }];
  }

  if (state.phase === 'discard' && player === state.declarerSeat) {
    const hand = state.hands[player] || [];
    if (hand.length !== 12) return [];
    const moves: SkatMove[] = [];
    for (let i = 0; i < hand.length; i++) {
      for (let j = i + 1; j < hand.length; j++) {
        moves.push({ type: 'discard', cards: [hand[i], hand[j]] });
      }
    }
    return moves;
  }

  if (state.phase === 'declare' && player === state.declarerSeat) {
    const moves: SkatMove[] = [];
    const isHand = state.skat.length === 2 && state.discardedCards.length === 0;

    const gameTypes: SkatGameType[] = ['C', 'S', 'H', 'D', 'grand', 'null'];
    for (const g of gameTypes) {
      moves.push({ type: 'declare', declaration: { gameType: g, hand: isHand } });
      if (isHand) {
        if (g === 'null') {
          moves.push({ type: 'declare', declaration: { gameType: g, hand: true, ouvert: true } });
        } else {
          moves.push({ type: 'declare', declaration: { gameType: g, hand: true, schneider: true } });
          moves.push({
            type: 'declare',
            declaration: { gameType: g, hand: true, schneider: true, schwarz: true },
          });
          moves.push({
            type: 'declare',
            declaration: { gameType: g, hand: true, schneider: true, schwarz: true, ouvert: true },
          });
        }
      } else if (g === 'null') {
        moves.push({ type: 'declare', declaration: { gameType: g, hand: false, ouvert: true } });
      }
    }
    return moves;
  }

  if (state.phase === 'play') {
    const activeCurrent = currentPlayers(state);
    if (!activeCurrent.includes(player)) return [];

    const moves: SkatMove[] = [];
    const hand = state.hands[player] || [];
    const contract = getContract(state);
    const validCards = legalCards(hand, state.currentTrick, contract);

    for (const c of validCards) {
      moves.push({ type: 'play', card: c });
    }
    return moves;
  }

  return [];
}

export function getContract(state: SkatState) {
  const decl = state.declaration || { gameType: 'grand' as const };
  if (decl.gameType === 'null') {
    return createSkatContract('null');
  }
  if (decl.gameType === 'grand') {
    return createSkatContract('grand');
  }
  return createSkatContract('suit', decl.gameType as Suit);
}

export function applyMove(state: SkatState, actor: Actor, move: SkatMove): MoveResult<SkatState> {
  const player = Number(actor);
  const nextState = applySkatMove(state, move, player);
  return { state: nextState, events: [] };
}

function applySkatMove(state: SkatState, move: SkatMove, player: number): SkatState {
  if (move.type === 'nextGame') {
    return advanceToNextGame(state);
  }

  if (state.phase === 'bidding') {
    return handleBiddingMove(state, move, player);
  }

  if (move.type === 'takeSkat' && state.phase === 'skatDecision' && player === state.declarerSeat) {
    const newHand = [...(state.hands[player] || []), ...state.skat];
    return {
      ...state,
      hands: { ...state.hands, [player]: newHand },
      phase: 'discard',
    };
  }

  if (move.type === 'playHand' && state.phase === 'skatDecision' && player === state.declarerSeat) {
    return {
      ...state,
      phase: 'declare',
    };
  }

  if (move.type === 'discard' && state.phase === 'discard' && player === state.declarerSeat) {
    const [c1, c2] = move.cards;
    const hand = state.hands[player] || [];
    const filteredHand = hand.filter((c) => c !== c1 && c !== c2);
    return {
      ...state,
      hands: { ...state.hands, [player]: filteredHand },
      skat: [c1, c2],
      discardedCards: [c1, c2],
      phase: 'declare',
    };
  }

  if (move.type === 'declare' && state.phase === 'declare' && player === state.declarerSeat) {
    return {
      ...state,
      declaration: move.declaration,
      phase: 'play',
      leaderSeat: state.activeSeats[0],
    };
  }

  if (move.type === 'concede' && state.phase === 'play' && player === state.declarerSeat) {
    return finishGame(state, { conceded: true });
  }

  if (move.type === 'claimRest' && state.phase === 'play' && player === state.declarerSeat) {
    return finishGame(state, { claimed: true });
  }

  if (move.type === 'play' && state.phase === 'play') {
    return handlePlayCard(state, move.card, player);
  }

  return state;
}

function handleBiddingMove(state: SkatState, move: SkatMove, player: number): SkatState {
  const vh = state.activeSeats[0];
  const mh = state.activeSeats[1];
  const hh = state.activeSeats[2];

  if (state.biddingStage === 'mh_vh') {
    if (move.type === 'pass') {
      if (!state.biddingAwaitingAnswer) {
        // MH passt sofort (oder später als Sprecher)
        // Nun sagt HH an VH!
        return {
          ...state,
          passedSeats: [...state.passedSeats, player],
          biddingStage: 'hh_winner',
          biddingSpeaker: hh,
          biddingListener: vh,
          biddingAwaitingAnswer: false,
        };
      }
      // VH passt als Hörer auf ein Gebot von MH
      // MH hat gegen VH gewonnen! Nun sagt HH an MH!
      return {
        ...state,
        passedSeats: [...state.passedSeats, player],
        biddingStage: 'hh_winner',
        biddingSpeaker: hh,
        biddingListener: mh,
        biddingAwaitingAnswer: false,
      };
    }

    if (move.type === 'bid') {
      // MH bietet einen Wert an
      return {
        ...state,
        currentBidValue: move.value,
        highestBid: move.value,
        biddingSpeaker: state.biddingListener, // VH muss antworten
        biddingAwaitingAnswer: true,
      };
    }

    if (move.type === 'hold') {
      // VH hält ("Ja")
      return {
        ...state,
        biddingSpeaker: mh, // MH muss weiter erhöhen oder passen
        biddingAwaitingAnswer: false,
      };
    }
  }

  if (state.biddingStage === 'hh_winner') {
    if (move.type === 'pass') {
      const passed = [...state.passedSeats, player];
      // Wenn der Sprecher (HH) passt: Der Listener ist der Sieger!
      // Wenn der Listener (der frühere Sieger) passt: Der Sprecher (HH) ist der Sieger!
      const winner = state.biddingAwaitingAnswer ? state.biddingListener : state.biddingListener;

      // Haben alle drei gepasst? (Eingepasst)
      if (passed.length >= 3 || (passed.includes(mh) && passed.includes(hh) && state.highestBid === 0)) {
        return {
          ...state,
          phase: 'passedOut',
          passedSeats: passed,
        };
      }

      return {
        ...state,
        phase: 'skatDecision',
        declarerSeat: winner,
        highestBid: Math.max(18, state.highestBid),
        biddingStage: 'done',
      };
    }

    if (move.type === 'bid') {
      return {
        ...state,
        currentBidValue: move.value,
        highestBid: move.value,
        biddingSpeaker: state.biddingListener,
        biddingAwaitingAnswer: true,
      };
    }

    if (move.type === 'hold') {
      return {
        ...state,
        biddingSpeaker: hh,
        biddingAwaitingAnswer: false,
      };
    }
  }

  return state;
}

function handlePlayCard(state: SkatState, card: CardId, player: number): SkatState {
  const hand = state.hands[player] || [];
  const nextHand = hand.filter((c) => c !== card);
  const nextTrick: Trick = [...state.currentTrick, { player, card }];
  const nextHands = { ...state.hands, [player]: nextHand };

  if (nextTrick.length < 3) {
    return {
      ...state,
      hands: nextHands,
      currentTrick: nextTrick,
    };
  }

  const contract = getContract(state);
  const winnerSlot = trickWinner(nextTrick, contract);
  const winnerSeat = winnerSlot.player;
  const points = trickPoints(nextTrick);

  const isDeclarerWinner = winnerSeat === state.declarerSeat;
  const nextDeclarerTricks = state.declarerTricksCount + (isDeclarerWinner ? 1 : 0);
  const nextDeclarerEyes = state.declarerEyes + (isDeclarerWinner ? points : 0);
  const nextOpponentEyes = state.opponentEyes + (!isDeclarerWinner ? points : 0);

  const nextCompleted = [
    ...state.completedTricks,
    { winner: winnerSeat, cards: nextTrick, points },
  ];

  if (state.declaration?.gameType === 'null' && isDeclarerWinner) {
    return finishGame(
      {
        ...state,
        hands: nextHands,
        currentTrick: [],
        completedTricks: nextCompleted,
        declarerTricksCount: nextDeclarerTricks,
        declarerEyes: nextDeclarerEyes,
        opponentEyes: nextOpponentEyes,
      },
      { nullLost: true },
    );
  }

  if (nextCompleted.length === 10) {
    return finishGame({
      ...state,
      hands: nextHands,
      currentTrick: [],
      completedTricks: nextCompleted,
      declarerTricksCount: nextDeclarerTricks,
      declarerEyes: nextDeclarerEyes,
      opponentEyes: nextOpponentEyes,
    });
  }

  return {
    ...state,
    hands: nextHands,
    currentTrick: [],
    completedTricks: nextCompleted,
    declarerTricksCount: nextDeclarerTricks,
    declarerEyes: nextDeclarerEyes,
    opponentEyes: nextOpponentEyes,
    leaderSeat: winnerSeat,
  };
}

function finishGame(
  state: SkatState,
  shortcut?: { conceded?: boolean; claimed?: boolean; nullLost?: boolean },
): SkatState {
  const declarer = state.declarerSeat ?? state.activeSeats[0];
  const decl = state.declaration || { gameType: 'grand' as const };
  const allCards = [
    ...(state.hands[declarer] || []),
    ...state.skat,
    ...state.discardedCards,
    ...state.completedTricks
      .flatMap((t) => t.cards)
      .filter((c) => c.player === declarer)
      .map((c) => c.card),
  ];

  let declarerEyes = state.declarerEyes + trickPoints(state.skat);
  const opponentEyes = 120 - declarerEyes;

  let won = false;
  let overbid = false;

  if (shortcut?.conceded || shortcut?.nullLost) {
    won = false;
  } else if (shortcut?.claimed) {
    won = true;
    declarerEyes = 120;
  } else if (decl.gameType === 'null') {
    won = state.declarerTricksCount === 0;
  } else {
    const neededEyes = decl.schneider ? 90 : 61;
    won = declarerEyes >= neededEyes;
    if (decl.schwarz && state.completedTricks.some((t) => t.winner !== declarer)) {
      won = false;
    }
  }

  const schneiderMade = opponentEyes <= 30;
  const schwarzMade = state.completedTricks.every((t) => t.winner === declarer);

  const gameValue = calculateGameValue(decl, allCards, { schneiderMade, schwarzMade });

  if (gameValue < state.highestBid) {
    won = false;
    overbid = true;
  }

  let declarerScoreDiff = 0;
  let opponentScoreDiff = 0;

  if (won) {
    declarerScoreDiff = gameValue + 50;
  } else {
    const base = SKAT_BASE_VALUES[decl.gameType];
    const lossValue = overbid ? Math.ceil(state.highestBid / base) * base : gameValue;
    declarerScoreDiff = -(2 * lossValue + 50);
    opponentScoreDiff = state.playerCount === 4 ? 30 : 40;
  }

  const nextScores = { ...state.scores };
  nextScores[declarer] = (nextScores[declarer] || 0) + declarerScoreDiff;
  for (const s of state.activeSeats) {
    if (s !== declarer) {
      nextScores[s] = (nextScores[s] || 0) + opponentScoreDiff;
    }
  }

  const summary: GameSummary = {
    dealerSeat: state.dealerSeat,
    declarerSeat: declarer,
    declaration: decl,
    highestBid: state.highestBid,
    gameValue,
    declarerEyes,
    won,
    overbid,
    declarerScoreDiff,
    opponentScoreDiff,
  };

  return {
    ...state,
    phase: 'roundOver',
    declarerEyes,
    opponentEyes,
    scores: nextScores,
    history: [...state.history, summary],
  };
}

function advanceToNextGame(state: SkatState): SkatState {
  const nextGameNum = state.gameNumber + 1;
  const nextDealer = nextDealerIndex(state.dealerSeat, state.playerCount);
  const activeSeats = getActivePlayers(nextDealer, state.playerCount, 3);

  const deck = createSkatDeck();
  const seed = (state.gameNumber * 997 + nextDealer * 31) % 100000;
  for (let i = deck.length - 1; i > 0; i--) {
    const j = (seed + i * 37) % (i + 1);
    const tmp = deck[i];
    deck[i] = deck[j];
    deck[j] = tmp;
  }

  const hands: Record<number, CardId[]> = {};
  for (const s of activeSeats) hands[s] = [];

  let idx = 0;
  for (const s of activeSeats) {
    hands[s].push(...deck.slice(idx, idx + 3));
    idx += 3;
  }
  const skat = deck.slice(idx, idx + 2);
  idx += 2;
  for (const s of activeSeats) {
    hands[s].push(...deck.slice(idx, idx + 4));
    idx += 4;
  }
  for (const s of activeSeats) {
    hands[s].push(...deck.slice(idx, idx + 3));
    idx += 3;
  }

  return {
    ...state,
    gameNumber: nextGameNum,
    dealerSeat: nextDealer,
    activeSeats,
    phase: 'bidding',
    hands,
    skat,
    discardedCards: [],
    declarerSeat: null,
    highestBid: 0,
    biddingStage: 'mh_vh',
    biddingSpeaker: activeSeats[1],
    biddingListener: activeSeats[0],
    biddingAwaitingAnswer: false,
    currentBidValue: 0,
    passedSeats: [],
    declaration: null,
    currentTrick: [],
    completedTricks: [],
    declarerTricksCount: 0,
    declarerEyes: 0,
    opponentEyes: 0,
    leaderSeat: activeSeats[0],
  };
}

// =============================================================================
// PlayerView & SampleHidden
// =============================================================================

export function playerView(state: SkatState, seat: SeatId | 'spectator'): SkatState {
  const player = typeof seat === 'number' ? seat : -1;
  const isDeclarer = player === state.declarerSeat;
  const isOuvert = state.declaration?.ouvert;

  const maskedHands: Record<number, CardId[]> = {};
  for (const s of state.activeSeats) {
    if (s === player) {
      maskedHands[s] = state.hands[s] || [];
    } else if (isOuvert && s === state.declarerSeat && state.phase === 'play') {
      maskedHands[s] = state.hands[s] || [];
    } else {
      const count = (state.hands[s] || []).length;
      maskedHands[s] = Array.from({ length: count }, () => 'back');
    }
  }

  let visibleSkat = state.skat;
  if (state.phase !== 'roundOver' && state.phase !== 'passedOut') {
    if (!isDeclarer || state.phase === 'bidding' || (state.phase === 'declare' && state.declaration?.hand)) {
      visibleSkat = ['back', 'back'];
    }
  }

  const declarerEyes = state.countEyes || state.phase === 'roundOver' ? state.declarerEyes : 0;
  const opponentEyes = state.countEyes || state.phase === 'roundOver' ? state.opponentEyes : 0;

  return {
    ...state,
    hands: maskedHands,
    skat: visibleSkat,
    discardedCards: isDeclarer || state.phase === 'roundOver' ? state.discardedCards : [],
    declarerEyes,
    opponentEyes,
  };
}

export function sampleHidden(view: SkatState, seat: SeatId, rng: Rng): SkatState {
  const knownCards = new Set<CardId>();
  for (const c of view.hands[seat] || []) {
    if (c !== 'back') knownCards.add(c);
  }
  for (const c of view.skat) {
    if (c !== 'back') knownCards.add(c);
  }
  for (const c of view.discardedCards) {
    if (c !== 'back') knownCards.add(c);
  }
  for (const t of view.completedTricks) {
    for (const pc of t.cards) knownCards.add(pc.card);
  }
  for (const pc of view.currentTrick) {
    knownCards.add(pc.card);
  }

  const allCards = createSkatDeck();
  const unknownPool = rng.shuffle(allCards.filter((c) => !knownCards.has(c)));

  let poolIdx = 0;
  const sampledHands: Record<number, CardId[]> = {};
  for (const s of view.activeSeats) {
    if (s === seat) {
      sampledHands[s] = [...(view.hands[s] || [])];
    } else {
      const origHand = view.hands[s] || [];
      sampledHands[s] = origHand.map((c) => {
        if (c === 'back') {
          return unknownPool[poolIdx++];
        }
        return c;
      });
    }
  }

  let sampledSkat = [...view.skat];
  if (sampledSkat.includes('back')) {
    sampledSkat = sampledSkat.map((c) => (c === 'back' ? unknownPool[poolIdx++] : c));
  }

  return {
    ...view,
    hands: sampledHands,
    skat: sampledSkat,
  };
}

export function result(state: SkatState): Result | null {
  if (state.gameNumber > state.totalGames) {
    const playerScores = Object.entries(state.scores).map(([p, s]) => ({
      player: Number(p),
      score: s,
    }));
    playerScores.sort((a, b) => b.score - a.score);
    const topScore = playerScores[0].score;
    const winners = playerScores.filter((p) => p.score === topScore).map((p) => p.player);

    if (winners.length === 1) {
      return { kind: 'win', winners: [winners[0]] };
    }
    return { kind: 'draw' };
  }
  return null;
}
