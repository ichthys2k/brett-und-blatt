import {
  cardEyePoints,
  cardId,
  cardRank,
  cardSuit,
  createSchafkopfContract,
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
  type TrickContract,
  SUITS,
} from '@brett-und-blatt/engine';

export type SchafkopfPhase =
  | 'bidding'
  | 'declare'
  | 'doubling'
  | 'play'
  | 'roundOver'
  | 'passedOut';

export type SchafkopfGameType =
  | 'sauspiel'
  | 'wenz'
  | 'solo'
  | 'geier'
  | 'farbwenz'
  | 'bettel'
  | 'ramsch';

export interface SchafkopfContract {
  gameType: SchafkopfGameType;
  calledSuit?: Suit; // Für Sauspiel (C, S, D)
  trumpSuit?: Suit; // Für Farbsolo / Farbwenz
  tout?: boolean;
}

export type SchafkopfMove =
  | { type: 'pass' }
  | { type: 'wantToPlay'; contractType: SchafkopfGameType }
  | { type: 'declare'; contract: SchafkopfContract }
  | { type: 'double' } // Stoßen
  | { type: 'skipDoubling' }
  | { type: 'play'; card: CardId }
  | { type: 'nextGame' };

export interface SchafkopfSummary {
  dealerSeat: number;
  declarerSeat: number | null;
  partnerSeat: number | null;
  contract: SchafkopfContract;
  declarerEyes: number;
  opponentEyes: number;
  won: boolean;
  scorePerPlayer: Record<number, number>;
}

export interface SchafkopfState {
  playerCount: number; // 4
  totalGames: number;
  gameNumber: number;
  dealerSeat: number;
  activeSeats: number[]; // [0, 1, 2, 3]
  deckStyle: 'bavarian' | 'four-color' | 'french';
  sheet: 'long' | 'short';
  allowExtras: boolean;
  doublingEnabled: boolean;
  ifAllPass: 'redeal' | 'ramsch';

  phase: SchafkopfPhase;
  hands: Record<number, CardId[]>;
  initialHands: Record<number, CardId[]>;

  // Bidding
  biddingTurn: number; // 0..3 (Vorhand bis Geber)
  bids: { seat: number; contractType: SchafkopfGameType }[];

  // Spielansage
  declarerSeat: number | null;
  partnerSeat: number | null; // Geheimer Partner im Sauspiel
  partnerRevealed: boolean; // Wird true, wenn Rufsau fällt
  contract: SchafkopfContract | null;

  // Stoß / Verdopplung
  multiplier: number; // 1, 2 oder 4
  doublers: number[];

  // Kartenspiel
  currentTrick: Trick;
  completedTricks: { winner: number; cards: PlayedCard[]; points: number }[];
  declarerEyes: number;
  opponentEyes: number;
  leaderSeat: number;
  calledSuitPlayed: boolean; // Wurde die Ruffarbe schon angespielt?

  // Gesamtwertung
  scores: Record<number, number>;
  history: SchafkopfSummary[];
}

export const SCHAFKOPF_RANKS_LONG: Rank[] = [7, 8, 9, 10, 11, 12, 13, 1];
export const SCHAFKOPF_RANKS_SHORT: Rank[] = [9, 10, 11, 12, 13, 1];

export function createSchafkopfDeck(sheet: 'long' | 'short' = 'long'): CardId[] {
  const ranks = sheet === 'short' ? SCHAFKOPF_RANKS_SHORT : SCHAFKOPF_RANKS_LONG;
  const deck: CardId[] = [];
  for (const suit of SUITS) {
    for (const rank of ranks) {
      deck.push(cardId(suit, rank, 1));
    }
  }
  return deck;
}

export const CONTRACT_RANKS: Record<SchafkopfGameType, number> = {
  sauspiel: 1,
  ramsch: 1,
  bettel: 2,
  geier: 3,
  wenz: 3,
  farbwenz: 4,
  solo: 5,
};

// =============================================================================
// Setup & Lifecycle
// =============================================================================

export function setup(
  seats: number,
  options: Options = {},
  seed: string = 'schafkopf',
): SchafkopfState {
  const totalGames = Number(options.rounds || '12');
  const sheet = options.sheet === 'short' ? 'short' : 'long';
  const deckStyle = (options.deckStyle as SchafkopfState['deckStyle']) || 'bavarian';
  const allowExtras = options.extras === 'all';
  const doublingEnabled = options.doubling !== 'false';
  const ifAllPass = options.ifAllPass === 'ramsch' ? 'ramsch' : 'redeal';

  const dealerSeat = 0;
  const activeSeats = [0, 1, 2, 3];

  const rng = Rng.fromSeed(seed);
  const deck = rng.shuffle(createSchafkopfDeck(sheet));
  const cardsPerPlayer = sheet === 'short' ? 6 : 8;

  const hands: Record<number, CardId[]> = {};
  const initialHands: Record<number, CardId[]> = {};
  for (let i = 0; i < 4; i++) {
    const h = deck.slice(i * cardsPerPlayer, (i + 1) * cardsPerPlayer);
    hands[i] = [...h];
    initialHands[i] = [...h];
  }

  const scores: Record<number, number> = {};
  for (let i = 0; i < 4; i++) scores[i] = 0;

  return {
    playerCount: 4,
    totalGames,
    gameNumber: 1,
    dealerSeat,
    activeSeats,
    deckStyle,
    sheet,
    allowExtras,
    doublingEnabled,
    ifAllPass,

    phase: 'bidding',
    hands,
    initialHands,

    biddingTurn: 0,
    bids: [],

    declarerSeat: null,
    partnerSeat: null,
    partnerRevealed: false,
    contract: null,

    multiplier: 1,
    doublers: [],

    currentTrick: [],
    completedTricks: [],
    declarerEyes: 0,
    opponentEyes: 0,
    leaderSeat: 1, // Vorhand (links vom Geber 0) spielt aus
    calledSuitPlayed: false,

    scores,
    history: [],
  };
}

export function currentPlayers(state: SchafkopfState): Actor[] {
  if (state.phase === 'roundOver' || state.phase === 'passedOut') {
    return [state.activeSeats[0]];
  }

  if (state.phase === 'bidding') {
    // Reihum ab Vorhand
    const seat = (state.dealerSeat + 1 + state.biddingTurn) % 4;
    return [seat];
  }

  if (state.phase === 'declare') {
    return state.declarerSeat !== null ? [state.declarerSeat] : [];
  }

  if (state.phase === 'doubling') {
    // Gegenspieler können stoßen
    return state.activeSeats;
  }

  if (state.phase === 'play') {
    if (state.currentTrick.length === 0) {
      return [state.leaderSeat];
    }
    const lastPlayer = state.currentTrick[state.currentTrick.length - 1].player;
    return [(lastPlayer + 1) % 4];
  }

  return [];
}

export function legalMoves(state: SchafkopfState, actor: Actor): SchafkopfMove[] {
  if (actor === 'system') return [];
  const player = Number(actor);

  if (state.phase === 'roundOver' || state.phase === 'passedOut') {
    return [{ type: 'nextGame' }];
  }

  if (state.phase === 'bidding') {
    const currentSeat = (state.dealerSeat + 1 + state.biddingTurn) % 4;
    if (player !== currentSeat) return [];

    const moves: SchafkopfMove[] = [{ type: 'pass' }];
    moves.push({ type: 'wantToPlay', contractType: 'sauspiel' });
    moves.push({ type: 'wantToPlay', contractType: 'wenz' });
    moves.push({ type: 'wantToPlay', contractType: 'solo' });
    if (state.allowExtras) {
      moves.push({ type: 'wantToPlay', contractType: 'geier' });
      moves.push({ type: 'wantToPlay', contractType: 'farbwenz' });
      moves.push({ type: 'wantToPlay', contractType: 'bettel' });
    }
    return moves;
  }

  if (state.phase === 'declare' && player === state.declarerSeat) {
    const moves: SchafkopfMove[] = [];
    const highestBid = state.bids.reduce(
      (max, b) => (CONTRACT_RANKS[b.contractType] > CONTRACT_RANKS[max] ? b.contractType : max),
      'sauspiel' as SchafkopfGameType,
    );

    const hand = state.hands[player] || [];

    if (highestBid === 'sauspiel') {
      // Rufbare Säue ermitteln: C, S, D (nicht H).
      // Regel: Spieler muss mindestens eine Karte dieser Farbe haben, darf die Sau aber nicht selbst haben!
      for (const s of ['C', 'S', 'D'] as Suit[]) {
        const hasSau = hand.includes(cardId(s, 1));
        const hasOtherOfSuit = hand.some((c) => cardSuit(c) === s && cardRank(c) !== 1);
        if (!hasSau && hasOtherOfSuit) {
          moves.push({ type: 'declare', contract: { gameType: 'sauspiel', calledSuit: s } });
        }
      }
      // Falls keine Sau gerufen werden kann, Solo erlauben
      if (moves.length === 0) {
        for (const s of SUITS) {
          moves.push({ type: 'declare', contract: { gameType: 'solo', trumpSuit: s } });
        }
      }
    } else if (highestBid === 'wenz') {
      moves.push({ type: 'declare', contract: { gameType: 'wenz' } });
      moves.push({ type: 'declare', contract: { gameType: 'wenz', tout: true } });
    } else {
      // Solo
      for (const s of SUITS) {
        moves.push({ type: 'declare', contract: { gameType: 'solo', trumpSuit: s } });
        moves.push({ type: 'declare', contract: { gameType: 'solo', trumpSuit: s, tout: true } });
      }
    }
    return moves;
  }

  if (state.phase === 'doubling') {
    return [{ type: 'double' }, { type: 'skipDoubling' }];
  }

  if (state.phase === 'play') {
    const current = currentPlayers(state);
    if (!current.includes(player)) return [];

    const hand = state.hands[player] || [];
    const contract = getContract(state);

    // Spezialfilter für Rufsau:
    // 1. Wenn die Ruffarbe angespielt wird, muss der Partner die Rufsau zugeben
    //    (Ausnahme Davonlaufen: >= 4 Karten der Farbe beim 1. Anspiel der Farbe).
    // 2. Schmierverbot: Die Rufsau darf nicht abgeworfen werden, solange die Ruffarbe noch nicht angespielt wurde.
    const isPartner = player === state.partnerSeat;
    const calledSau = state.contract?.calledSuit ? cardId(state.contract.calledSuit, 1) : null;

    const customFilter = (c: CardId, myHand: CardId[], trick: Trick): boolean => {
      if (!isPartner || !calledSau || state.contract?.gameType !== 'sauspiel') return true;

      // Schmierverbot:
      if (!state.calledSuitPlayed && c === calledSau && trick.length > 0) {
        const leadSuit = contract.effectiveSuit(trick[0].card);
        if (leadSuit !== state.contract.calledSuit) {
          // Die Rufsau darf nicht in eine andere Farbe geschmiert werden!
          return false;
        }
      }

      // Rufsau-Pflicht bei Anspiel der Ruffarbe:
      if (trick.length > 0) {
        const leadSuit = contract.effectiveSuit(trick[0].card);
        if (leadSuit === state.contract.calledSuit && myHand.includes(calledSau)) {
          // Prüfe Davonlaufen:
          const cardsOfCalledSuit = myHand.filter((card) => contract.effectiveSuit(card) === state.contract?.calledSuit);
          const minRun = state.sheet === 'short' ? 3 : 4;
          if (!state.calledSuitPlayed && cardsOfCalledSuit.length >= minRun) {
            // Davonlaufen erlaubt: beliebige Karte der Farbe
            return true;
          }
          // Sonst MUSS die Rufsau fallen!
          return c === calledSau;
        }
      }

      return true;
    };

    const validCards = legalCards(hand, state.currentTrick, contract, customFilter);
    return validCards.map((card) => ({ type: 'play', card }));
  }

  return [];
}

export function getContract(state: SchafkopfState): TrickContract {
  const c = state.contract || { gameType: 'sauspiel' as const };
  return createSchafkopfContract(c.gameType, c.trumpSuit ?? 'H');
}

export function applyMove(state: SchafkopfState, actor: Actor, move: SchafkopfMove): MoveResult<SchafkopfState> {
  const player = Number(actor);
  const nextState = applySchafkopfMove(state, move, player);
  return { state: nextState, events: [] };
}

function applySchafkopfMove(state: SchafkopfState, move: SchafkopfMove, player: number): SchafkopfState {
  if (move.type === 'nextGame') {
    return advanceToNextGame(state);
  }

  if (state.phase === 'bidding') {
    const nextBids = move.type === 'wantToPlay' ? [...state.bids, { seat: player, contractType: move.contractType }] : state.bids;
    const nextTurn = state.biddingTurn + 1;

    if (nextTurn < 4) {
      return {
        ...state,
        biddingTurn: nextTurn,
        bids: nextBids,
      };
    }

    // Reizen beendet!
    if (nextBids.length === 0) {
      // Niemand will spielen
      if (state.ifAllPass === 'ramsch') {
        return {
          ...state,
          phase: 'play',
          contract: { gameType: 'ramsch' },
          declarerSeat: null,
          partnerSeat: null,
          leaderSeat: (state.dealerSeat + 1) % 4,
        };
      }
      return {
        ...state,
        phase: 'passedOut',
      };
    }

    // Höchstes Gebot ermitteln
    let bestBid = nextBids[0];
    for (let i = 1; i < nextBids.length; i++) {
      const b = nextBids[i];
      if (CONTRACT_RANKS[b.contractType] > CONTRACT_RANKS[bestBid.contractType]) {
        bestBid = b;
      }
    }

    return {
      ...state,
      biddingTurn: nextTurn,
      bids: nextBids,
      declarerSeat: bestBid.seat,
      phase: 'declare',
    };
  }

  if (move.type === 'declare' && state.phase === 'declare' && player === state.declarerSeat) {
    let partnerSeat: number | null = null;
    if (move.contract.gameType === 'sauspiel' && move.contract.calledSuit) {
      const calledSau = cardId(move.contract.calledSuit, 1);
      for (let s = 0; s < 4; s++) {
        if ((state.hands[s] || []).includes(calledSau)) {
          partnerSeat = s;
          break;
        }
      }
    }

    return {
      ...state,
      contract: move.contract,
      partnerSeat,
      phase: state.doublingEnabled ? 'doubling' : 'play',
      leaderSeat: (state.dealerSeat + 1) % 4,
    };
  }

  if (state.phase === 'doubling') {
    if (move.type === 'double' && !state.doublers.includes(player)) {
      return {
        ...state,
        multiplier: state.multiplier * 2,
        doublers: [...state.doublers, player],
        phase: 'play',
      };
    }
    return {
      ...state,
      phase: 'play',
    };
  }

  if (move.type === 'play' && state.phase === 'play') {
    return handlePlayCard(state, move.card, player);
  }

  return state;
}

function handlePlayCard(state: SchafkopfState, card: CardId, player: number): SchafkopfState {
  const hand = state.hands[player] || [];
  const nextHand = hand.filter((c) => c !== card);
  const nextTrick: Trick = [...state.currentTrick, { player, card }];
  const nextHands = { ...state.hands, [player]: nextHand };

  const contract = getContract(state);
  let calledSuitPlayed = state.calledSuitPlayed;
  let partnerRevealed = state.partnerRevealed;

  if (state.contract?.gameType === 'sauspiel' && state.contract.calledSuit) {
    const calledSau = cardId(state.contract.calledSuit, 1);
    if (card === calledSau) {
      partnerRevealed = true;
    }
    if (nextTrick.length === 1 && contract.effectiveSuit(card) === state.contract.calledSuit) {
      calledSuitPlayed = true;
    }
  }

  if (nextTrick.length < 4) {
    return {
      ...state,
      hands: nextHands,
      currentTrick: nextTrick,
      calledSuitPlayed,
      partnerRevealed,
    };
  }

  // Stich vollständig
  const winnerSlot = trickWinner(nextTrick, contract);
  const winnerSeat = winnerSlot.player;
  const points = trickPoints(nextTrick);

  const isDeclarerParty =
    state.contract?.gameType === 'ramsch'
      ? false
      : winnerSeat === state.declarerSeat || winnerSeat === state.partnerSeat;

  const nextDeclarerEyes = state.declarerEyes + (isDeclarerParty ? points : 0);
  const nextOpponentEyes = state.opponentEyes + (!isDeclarerParty ? points : 0);

  const nextCompleted = [
    ...state.completedTricks,
    { winner: winnerSeat, cards: nextTrick, points },
  ];

  const totalTricksNeeded = state.sheet === 'short' ? 6 : 8;

  if (nextCompleted.length === totalTricksNeeded) {
    return finishGame({
      ...state,
      hands: nextHands,
      currentTrick: [],
      completedTricks: nextCompleted,
      declarerEyes: nextDeclarerEyes,
      opponentEyes: nextOpponentEyes,
      calledSuitPlayed,
      partnerRevealed: true,
    });
  }

  return {
    ...state,
    hands: nextHands,
    currentTrick: [],
    completedTricks: nextCompleted,
    declarerEyes: nextDeclarerEyes,
    opponentEyes: nextOpponentEyes,
    leaderSeat: winnerSeat,
    calledSuitPlayed,
    partnerRevealed,
  };
}

function finishGame(state: SchafkopfState): SchafkopfState {
  const isRamsch = state.contract?.gameType === 'ramsch';
  const declarer = state.declarerSeat ?? 0;
  const partner = state.partnerSeat;
  const isSauspiel = state.contract?.gameType === 'sauspiel';

  let won = false;
  const scoreDiffs: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0 };

  if (isRamsch) {
    // Wer die meisten Augen hat, verliert und zahlt an die 3 anderen
    const playerEyes: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0 };
    for (const t of state.completedTricks) {
      playerEyes[t.winner] += t.points;
    }
    let loser = 0;
    for (let s = 1; s < 4; s++) {
      if (playerEyes[s] > playerEyes[loser]) loser = s;
    }
    for (let s = 0; s < 4; s++) {
      scoreDiffs[s] = s === loser ? -30 : 10;
    }
  } else {
    won = state.declarerEyes >= 61;
    const baseVal = isSauspiel ? 10 : 50;

    // Laufende ab 3 im Sauspiel/Solo, ab 2 bei Wenz
    const laufendeBonus = 0; // Standard 0 für Basistarif
    const schneiderBonus = state.opponentEyes <= 30 || state.declarerEyes <= 30 ? 10 : 0;
    const gamePoints = (baseVal + laufendeBonus + schneiderBonus) * state.multiplier;

    if (isSauspiel) {
      for (let s = 0; s < 4; s++) {
        if (s === declarer || s === partner) {
          scoreDiffs[s] = won ? gamePoints : -gamePoints;
        } else {
          scoreDiffs[s] = won ? -gamePoints : gamePoints;
        }
      }
    } else {
      // Solo: Solist gegen 3
      for (let s = 0; s < 4; s++) {
        if (s === declarer) {
          scoreDiffs[s] = won ? 3 * gamePoints : -3 * gamePoints;
        } else {
          scoreDiffs[s] = won ? -gamePoints : gamePoints;
        }
      }
    }
  }

  const nextScores = { ...state.scores };
  for (let s = 0; s < 4; s++) {
    nextScores[s] += scoreDiffs[s];
  }

  const summary: SchafkopfSummary = {
    dealerSeat: state.dealerSeat,
    declarerSeat: state.declarerSeat,
    partnerSeat: state.partnerSeat,
    contract: state.contract || { gameType: 'sauspiel' },
    declarerEyes: state.declarerEyes,
    opponentEyes: state.opponentEyes,
    won,
    scorePerPlayer: scoreDiffs,
  };

  return {
    ...state,
    phase: 'roundOver',
    scores: nextScores,
    history: [...state.history, summary],
  };
}

function advanceToNextGame(state: SchafkopfState): SchafkopfState {
  const nextGameNum = state.gameNumber + 1;
  const nextDealer = nextDealerIndex(state.dealerSeat, 4);

  const deck = createSchafkopfDeck(state.sheet);
  const seed = (state.gameNumber * 997 + nextDealer * 31) % 100000;
  for (let i = deck.length - 1; i > 0; i--) {
    const j = (seed + i * 37) % (i + 1);
    const tmp = deck[i];
    deck[i] = deck[j];
    deck[j] = tmp;
  }

  const cardsPerPlayer = state.sheet === 'short' ? 6 : 8;
  const hands: Record<number, CardId[]> = {};
  const initialHands: Record<number, CardId[]> = {};
  for (let i = 0; i < 4; i++) {
    const h = deck.slice(i * cardsPerPlayer, (i + 1) * cardsPerPlayer);
    hands[i] = [...h];
    initialHands[i] = [...h];
  }

  return {
    ...state,
    gameNumber: nextGameNum,
    dealerSeat: nextDealer,
    phase: 'bidding',
    hands,
    initialHands,
    biddingTurn: 0,
    bids: [],
    declarerSeat: null,
    partnerSeat: null,
    partnerRevealed: false,
    contract: null,
    multiplier: 1,
    doublers: [],
    currentTrick: [],
    completedTricks: [],
    declarerEyes: 0,
    opponentEyes: 0,
    leaderSeat: (nextDealer + 1) % 4,
    calledSuitPlayed: false,
  };
}

// =============================================================================
// PlayerView & SampleHidden
// =============================================================================

export function playerView(state: SchafkopfState, seat: SeatId | 'spectator'): SchafkopfState {
  const player = typeof seat === 'number' ? seat : -1;

  const maskedHands: Record<number, CardId[]> = {};
  for (let s = 0; s < 4; s++) {
    if (s === player) {
      maskedHands[s] = state.hands[s] || [];
    } else {
      const count = (state.hands[s] || []).length;
      maskedHands[s] = Array.from({ length: count }, () => 'back');
    }
  }

  // Den Partner kennt nur der Partner selbst, bis die Rufsau fällt!
  // Auch der Rufer kennt ihn nicht!
  const partnerVisible = state.partnerRevealed || player === state.partnerSeat || state.phase === 'roundOver';

  return {
    ...state,
    hands: maskedHands,
    partnerSeat: partnerVisible ? state.partnerSeat : null,
  };
}

export function sampleHidden(view: SchafkopfState, seat: SeatId, rng: Rng): SchafkopfState {
  const knownCards = new Set<CardId>();
  for (const c of view.hands[seat] || []) {
    if (c !== 'back') knownCards.add(c);
  }
  for (const t of view.completedTricks) {
    for (const pc of t.cards) knownCards.add(pc.card);
  }
  for (const pc of view.currentTrick) {
    knownCards.add(pc.card);
  }

  const allCards = createSchafkopfDeck(view.sheet);
  const unknownPool = rng.shuffle(allCards.filter((c) => !knownCards.has(c)));

  let poolIdx = 0;
  const sampledHands: Record<number, CardId[]> = {};
  for (let s = 0; s < 4; s++) {
    if (s === seat) {
      sampledHands[s] = [...(view.hands[s] || [])];
    } else {
      const origHand = view.hands[s] || [];
      sampledHands[s] = origHand.map((c) => (c === 'back' ? unknownPool[poolIdx++] : c));
    }
  }

  return {
    ...view,
    hands: sampledHands,
  };
}

export function result(state: SchafkopfState): Result | null {
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
