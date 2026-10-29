import {
  cardEyePoints,
  cardId,
  cardRank,
  cardSuit,
  createDokoContract,
  dealUnknown,
  knownVoids,
  getActivePlayers,
  handToSeat,
  legalCards,
  nextDealerIndex,
  seatToHand,
  trickPoints,
  trickWinner,
  Rng,
  type EffectiveSuit,
  type RngState,
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
  trickGameEvents,
} from '@brett-und-blatt/engine';

export type DokoPhase =
  | 'reservations'
  | 'chooseSolo'
  | 'play'
  | 'roundOver';

export type DokoContractType =
  | 'normal'
  | 'hochzeit'
  | 'damensolo'
  | 'bubensolo'
  | 'farbsolo'
  | 'fleischlos';

export interface DokoContract {
  type: DokoContractType;
  trumpSuit?: Suit; // Für Farbsolo
  soloist?: number;
}

export type DokoAnnouncement = 're' | 'kontra' | 'no90' | 'no60' | 'no30' | 'schwarz';

export type DokoMove =
  | { type: 'healthy' }
  | { type: 'reservation' }
  | { type: 'chooseContract'; contract: DokoContract }
  | { type: 'announce'; call: DokoAnnouncement }
  | { type: 'play'; card: CardId }
  | { type: 'nextGame' };

export interface DokoSummary {
  dealerSeat: number;
  contract: DokoContract;
  reTeam: number[];
  reEyes: number;
  kontraEyes: number;
  won: boolean; // Hat Re gewonnen?
  points: number;
  scorePerPlayer: Record<number, number>;
}

export interface DokoState {
  playerCount: number; // 4 oder 5
  totalGames: number;
  gameNumber: number;
  dealerSeat: number;
  activeSeats: number[]; // 4 aktive Plätze
  deckStyle: 'four-color' | 'french' | 'german';
  mandatorySolo: boolean;

  phase: DokoPhase;
  hands: Record<number, CardId[]>;

  // Vorbehalte
  reservationTurn: number; // 0..3
  reservations: { seat: number; isSolo: boolean }[];
  contract: DokoContract;

  // Teams & Hochzeit
  reTeam: number[]; // Wer ist Re?
  revealedRe: number[]; // Wer ist öffentlich als Re bekannt?
  hochzeitSeat: number | null; // Sitzplatz des Hochzeiters
  hochzeitTrickCount: number;

  // Ansagen je Team
  announcements: { seat: number; team: 're' | 'kontra'; call: DokoAnnouncement }[];

  // Stichspiel
  currentTrick: Trick;
  completedTricks: { winner: number; cards: PlayedCard[]; points: number }[];
  reEyes: number;
  kontraEyes: number;
  leaderSeat: number;

  // Sonderpunkte im Normalspiel
  reExtraPoints: number;
  kontraExtraPoints: number;

  // Gesamtstände
  scores: Record<number, number>;
  history: DokoSummary[];
  /** Zufallsstrom zum Geben der nächsten Spiele (aus dem Seed; in Sichten genullt). */
  dealRng: RngState;
}

export const DOKO_RANKS: Rank[] = [9, 10, 11, 12, 13, 1];

export function createDokoDeck(): CardId[] {
  const deck: CardId[] = [];
  for (let copy = 1; copy <= 2; copy++) {
    for (const suit of SUITS) {
      for (const rank of DOKO_RANKS) {
        deck.push(cardId(suit, rank, copy));
      }
    }
  }
  return deck;
}

// =============================================================================
// Setup & Lifecycle
// =============================================================================

export function setup(
  seats: number,
  options: Options = {},
  seed: string = 'doppelkopf',
): DokoState {
  const tablePlayers = seats;
  const totalGames = Number(options.rounds || '12');
  const deckStyle = (options.deckStyle as DokoState['deckStyle']) || 'four-color';
  const mandatorySolo = options.mandatorySolo === 'true';

  const dealerSeat = 0;
  const activeSeats = getActivePlayers(dealerSeat, tablePlayers, 4);

  const rng = Rng.fromSeed(seed);
  const deck = rng.shuffle(createDokoDeck());

  const hands: Record<number, CardId[]> = {};
  for (let i = 0; i < 4; i++) {
    const seat = activeSeats[i];
    hands[seat] = deck.slice(i * 12, (i + 1) * 12);
  }

  // Re-Team ermitteln (wer die Kreuz-Damen hält)
  const reTeam: number[] = [];
  for (const s of activeSeats) {
    const h = hands[s] || [];
    if (h.some((c) => cardSuit(c) === 'C' && cardRank(c) === 12)) {
      reTeam.push(s);
    }
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
    mandatorySolo,

    phase: 'reservations',
    hands,

    reservationTurn: 0,
    reservations: [],
    contract: { type: 'normal' },

    reTeam,
    revealedRe: [],
    hochzeitSeat: null,
    hochzeitTrickCount: 0,

    announcements: [],

    currentTrick: [],
    completedTricks: [],
    reEyes: 0,
    kontraEyes: 0,
    leaderSeat: activeSeats[0],

    reExtraPoints: 0,
    kontraExtraPoints: 0,

    scores,
    history: [],
    dealRng: rng.state,
  };
}

export function currentPlayers(state: DokoState): Actor[] {
  if (state.phase === 'roundOver') {
    return [state.activeSeats[0]];
  }

  if (state.phase === 'reservations') {
    const seat = state.activeSeats[state.reservationTurn];
    return [seat];
  }

  if (state.phase === 'chooseSolo') {
    return state.reservations.length > 0 ? [state.reservations[0].seat] : [];
  }

  if (state.phase === 'play') {
    // Der Spieler am Zug für 'play'
    const playSeat =
      state.currentTrick.length === 0
        ? state.leaderSeat
        : state.activeSeats[(seatToHand(state.currentTrick[state.currentTrick.length - 1].player, state.activeSeats) + 1) % 4];

    return [playSeat];
  }

  return [];
}

export function legalMoves(state: DokoState, actor: Actor): DokoMove[] {
  if (actor === 'system') return [];
  const player = Number(actor);

  if (state.phase === 'roundOver') {
    return [{ type: 'nextGame' }];
  }

  if (state.phase === 'reservations') {
    const currentSeat = state.activeSeats[state.reservationTurn];
    if (player !== currentSeat) return [];

    const moves: DokoMove[] = [{ type: 'healthy' }];
    moves.push({ type: 'reservation' });
    return moves;
  }

  if (state.phase === 'chooseSolo' && state.reservations[0]?.seat === player) {
    const moves: DokoMove[] = [];
    const hand = state.hands[player] || [];
    const hasBothQueens = hand.filter((c) => cardSuit(c) === 'C' && cardRank(c) === 12).length === 2;

    if (hasBothQueens) {
      moves.push({ type: 'chooseContract', contract: { type: 'hochzeit', soloist: player } });
    }
    moves.push({ type: 'chooseContract', contract: { type: 'damensolo', soloist: player } });
    moves.push({ type: 'chooseContract', contract: { type: 'bubensolo', soloist: player } });
    moves.push({ type: 'chooseContract', contract: { type: 'fleischlos', soloist: player } });
    for (const s of SUITS) {
      moves.push({ type: 'chooseContract', contract: { type: 'farbsolo', trumpSuit: s, soloist: player } });
    }
    return moves;
  }

  if (state.phase === 'play') {
    const playSeat =
      state.currentTrick.length === 0
        ? state.leaderSeat
        : state.activeSeats[(seatToHand(state.currentTrick[state.currentTrick.length - 1].player, state.activeSeats) + 1) % 4];

    if (player !== playSeat) return [];

    const moves: DokoMove[] = [];
    const hand = state.hands[player] || [];
    const handCount = hand.length;

    // 1. Ansagen prüfen
    const isRe = state.reTeam.includes(player);
    const myTeam: 're' | 'kontra' = isRe ? 're' : 'kontra';
    const hasAnnouncedTeam = state.announcements.some((a) => a.team === myTeam);

    if (handCount >= 11 && !hasAnnouncedTeam) {
      moves.push({ type: 'announce', call: isRe ? 're' : 'kontra' });
    }
    if (handCount >= 10 && hasAnnouncedTeam && !state.announcements.some((a) => a.team === myTeam && a.call === 'no90')) {
      moves.push({ type: 'announce', call: 'no90' });
    }
    if (
      handCount >= 9 &&
      state.announcements.some((a) => a.team === myTeam && a.call === 'no90') &&
      !state.announcements.some((a) => a.team === myTeam && a.call === 'no60')
    ) {
      moves.push({ type: 'announce', call: 'no60' });
    }

    // 2. Karte spielen
    const contract = getContract(state);
    const validCards = legalCards(hand, state.currentTrick, contract);
    for (const card of validCards) {
      moves.push({ type: 'play', card });
    }

    return moves;
  }

  return [];
}

export function getContract(state: DokoState): TrickContract {
  const c = state.contract;
  const contractType = c.type === 'hochzeit' ? 'normal' : c.type;
  return createDokoContract(contractType, c.trumpSuit ?? 'D');
}

export function applyMove(state: DokoState, actor: Actor, move: DokoMove): MoveResult<DokoState> {
  const player = Number(actor);
  const nextState = applyDokoMove(state, move, player);
  return { state: nextState, events: trickGameEvents(state, nextState, player, move as { type: string; card?: CardId }) };
}

function applyDokoMove(state: DokoState, move: DokoMove, player: number): DokoState {
  if (move.type === 'nextGame') {
    return advanceToNextGame(state);
  }

  if (state.phase === 'reservations') {
    const nextReservations = move.type === 'reservation' ? [...state.reservations, { seat: player, isSolo: true }] : state.reservations;
    const nextTurn = state.reservationTurn + 1;

    if (nextTurn < 4) {
      return {
        ...state,
        reservationTurn: nextTurn,
        reservations: nextReservations,
      };
    }

    // Vorbehaltsabfrage beendet
    if (nextReservations.length === 0) {
      // Normalspiel!
      return {
        ...state,
        phase: 'play',
        contract: { type: 'normal' },
        leaderSeat: state.activeSeats[0],
      };
    }

    // Ein Spieler hat einen Vorbehalt angemeldet
    return {
      ...state,
      reservationTurn: nextTurn,
      reservations: nextReservations,
      phase: 'chooseSolo',
    };
  }

  if (move.type === 'chooseContract' && state.phase === 'chooseSolo') {
    const isHochzeit = move.contract.type === 'hochzeit';
    const soloist = move.contract.soloist;
    return {
      ...state,
      contract: move.contract,
      phase: 'play',
      hochzeitSeat: isHochzeit ? player : null,
      reTeam: isHochzeit ? [player] : soloist !== undefined ? [soloist] : state.reTeam,
      revealedRe: isHochzeit ? [player] : soloist !== undefined ? [soloist] : state.revealedRe,
      leaderSeat: state.activeSeats[0],
    };
  }

  if (move.type === 'announce' && state.phase === 'play') {
    const isRe = state.reTeam.includes(player);
    const myTeam: 're' | 'kontra' = isRe ? 're' : 'kontra';
    return {
      ...state,
      announcements: [...state.announcements, { seat: player, team: myTeam, call: move.call }],
      revealedRe: isRe ? Array.from(new Set([...state.revealedRe, player])) : state.revealedRe,
    };
  }

  if (move.type === 'play' && state.phase === 'play') {
    return handlePlayCard(state, move.card, player);
  }

  return state;
}

function handlePlayCard(state: DokoState, card: CardId, player: number): DokoState {
  const hand = state.hands[player] || [];
  const nextHand = hand.filter((c) => c !== card);
  const nextTrick: Trick = [...state.currentTrick, { player, card }];
  const nextHands = { ...state.hands, [player]: nextHand };

  // Wenn Kreuz-Dame im Normalspiel gespielt wird, wird der Spieler öffentlich als Re bekannt
  const revealedRe =
    state.contract.type === 'normal' && cardSuit(card) === 'C' && cardRank(card) === 12
      ? Array.from(new Set([...state.revealedRe, player]))
      : state.revealedRe;

  if (nextTrick.length < 4) {
    return {
      ...state,
      hands: nextHands,
      currentTrick: nextTrick,
      revealedRe,
    };
  }

  // 4 Karten im Stich: Stich auswerten
  const contract = getContract(state);
  const winnerSlot = trickWinner(nextTrick, contract);
  const winnerSeat = winnerSlot.player;
  const points = trickPoints(nextTrick);

  // Hochzeit-Klärung: Wer in den ersten 3 Stichen einen Stich macht, wird Partner
  let reTeam = [...state.reTeam];
  let hochzeitTrickCount = state.hochzeitTrickCount;
  if (state.contract.type === 'hochzeit' && state.hochzeitSeat !== null && reTeam.length === 1) {
    hochzeitTrickCount++;
    if (winnerSeat !== state.hochzeitSeat) {
      reTeam.push(winnerSeat);
    } else if (hochzeitTrickCount === 3) {
      // Hochzeiter spielt allein gegen 3
    }
  }

  const isReWinner = reTeam.includes(winnerSeat);
  const nextReEyes = state.reEyes + (isReWinner ? points : 0);
  const nextKontraEyes = state.kontraEyes + (!isReWinner ? points : 0);

  // Sonderpunkte prüfen (nur im Normalspiel)
  let reExtra = state.reExtraPoints;
  let kontraExtra = state.kontraExtraPoints;

  if (state.contract.type === 'normal') {
    // 1. Fuchs gefangen (Karo-Ass eines Gegners)
    for (const pc of nextTrick) {
      if (cardSuit(pc.card) === 'D' && cardRank(pc.card) === 1) {
        const isFuchsRe = state.reTeam.includes(pc.player);
        if (isFuchsRe && !isReWinner) kontraExtra++;
        if (!isFuchsRe && isReWinner) reExtra++;
      }
    }
    // 2. Doppelkopf (Stich mit mindestens 40 Augen)
    if (points >= 40) {
      if (isReWinner) reExtra++;
      else kontraExtra++;
    }
    // 3. Karlchen (Kreuz-Bube macht den letzten Stich = 12. Stich)
    if (state.completedTricks.length === 11 && cardSuit(winnerSlot.card) === 'C' && cardRank(winnerSlot.card) === 11) {
      if (isReWinner) reExtra++;
      else kontraExtra++;
    }
  }

  const nextCompleted = [
    ...state.completedTricks,
    { winner: winnerSeat, cards: nextTrick, points },
  ];

  if (nextCompleted.length === 12) {
    return finishGame({
      ...state,
      hands: nextHands,
      currentTrick: [],
      completedTricks: nextCompleted,
      reEyes: nextReEyes,
      kontraEyes: nextKontraEyes,
      reTeam,
      revealedRe,
      reExtraPoints: reExtra,
      kontraExtraPoints: kontraExtra,
    });
  }

  return {
    ...state,
    hands: nextHands,
    currentTrick: [],
    completedTricks: nextCompleted,
    reEyes: nextReEyes,
    kontraEyes: nextKontraEyes,
    leaderSeat: winnerSeat,
    reTeam,
    revealedRe,
    hochzeitTrickCount,
    reExtraPoints: reExtra,
    kontraExtraPoints: kontraExtra,
  };
}

function finishGame(state: DokoState): DokoState {
  const isSolo = state.contract.type !== 'normal' && state.contract.type !== 'hochzeit';
  const soloist = state.contract.soloist;

  // Hat Re gewonnen?
  // Basis: Re braucht 121, Kontra 120
  const won = state.reEyes >= 121;
  const scoreDiffs: Record<number, number> = {};
  for (const s of state.activeSeats) scoreDiffs[s] = 0;

  let points = 1; // Basisgewinn
  if (won && state.announcements.some((a) => a.team === 're')) points += 2;
  if (!won && state.announcements.some((a) => a.team === 'kontra')) points += 2;
  if (!won && state.contract.type === 'normal') points += 1; // Gegen die Alten

  if (!isSolo) {
    points += won ? state.reExtraPoints : state.kontraExtraPoints;
  }

  if (isSolo && soloist !== undefined) {
    for (const s of state.activeSeats) {
      scoreDiffs[s] = s === soloist ? (won ? 3 * points : -3 * points) : won ? -points : points;
    }
  } else {
    for (const s of state.activeSeats) {
      const isRe = state.reTeam.includes(s);
      scoreDiffs[s] = (won && isRe) || (!won && !isRe) ? points : -points;
    }
  }

  const nextScores = { ...state.scores };
  for (const s of state.activeSeats) {
    nextScores[s] += scoreDiffs[s];
  }

  const summary: DokoSummary = {
    dealerSeat: state.dealerSeat,
    contract: state.contract,
    reTeam: state.reTeam,
    reEyes: state.reEyes,
    kontraEyes: state.kontraEyes,
    won,
    points,
    scorePerPlayer: scoreDiffs,
  };

  return {
    ...state,
    phase: 'roundOver',
    scores: nextScores,
    history: [...state.history, summary],
  };
}

function advanceToNextGame(state: DokoState): DokoState {
  const nextGameNum = state.gameNumber + 1;
  const nextDealer = nextDealerIndex(state.dealerSeat, state.playerCount);
  const activeSeats = getActivePlayers(nextDealer, state.playerCount, 4);

  const rng = new Rng(state.dealRng);
  const deck = rng.shuffle(createDokoDeck());

  const hands: Record<number, CardId[]> = {};
  for (let i = 0; i < 4; i++) {
    const s = activeSeats[i];
    hands[s] = deck.slice(i * 12, (i + 1) * 12);
  }

  const reTeam: number[] = [];
  for (const s of activeSeats) {
    const h = hands[s] || [];
    if (h.some((c) => cardSuit(c) === 'C' && cardRank(c) === 12)) {
      reTeam.push(s);
    }
  }

  return {
    ...state,
    dealRng: rng.state,
    gameNumber: nextGameNum,
    dealerSeat: nextDealer,
    activeSeats,
    phase: 'reservations',
    hands,
    reservationTurn: 0,
    reservations: [],
    contract: { type: 'normal' },
    reTeam,
    revealedRe: [],
    hochzeitSeat: null,
    hochzeitTrickCount: 0,
    announcements: [],
    currentTrick: [],
    completedTricks: [],
    reEyes: 0,
    kontraEyes: 0,
    leaderSeat: activeSeats[0],
    reExtraPoints: 0,
    kontraExtraPoints: 0,
  };
}

// =============================================================================
// PlayerView & SampleHidden
// =============================================================================

export function playerView(state: DokoState, seat: SeatId | 'spectator'): DokoState {
  const player = typeof seat === 'number' ? seat : -1;

  const maskedHands: Record<number, CardId[]> = {};
  for (const s of state.activeSeats) {
    if (s === player) {
      maskedHands[s] = state.hands[s] || [];
    } else {
      const count = (state.hands[s] || []).length;
      maskedHands[s] = Array.from({ length: count }, () => 'back');
    }
  }

  // Teaminformation verbergen:
  // Wer sieht das Re-Team?
  // Das eigene Team kennt man nur, wenn man selbst eine Kreuz-Dame hat (dann Re)
  // oder wenn das Spiel beendet ist. Fremde Re-Zugehörigkeiten werden nur gezeigt,
  // wenn sie in `revealedRe` sind!
  const isGameOver = state.phase === 'roundOver';
  const visibleReTeam = isGameOver
    ? state.reTeam
    : Array.from(new Set([...state.revealedRe, ...(state.reTeam.includes(player) ? [player] : [])]));

  return {
    ...state,
    hands: maskedHands,
    reTeam: visibleReTeam,
    dealRng: [0, 0, 0, 0],
  };
}

export function sampleHidden(view: DokoState, seat: SeatId, rng: Rng): DokoState {
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

  const allCards = createDokoDeck();
  const unknown = allCards.filter((c) => !knownCards.has(c));
  const others = view.activeSeats.filter((s) => s !== seat);
  const needs = new Map<number, number>();
  for (const s of others) needs.set(s, (view.hands[s] || []).filter((c) => c === 'back').length);
  // Wer eine Farbe nicht bedient hat, besitzt von ihr keine Karte mehr.
  const contract = getContract(view);
  const voids = view.phase === 'play' ? knownVoids(view.completedTricks, view.currentTrick, contract) : new Map<number, Set<EffectiveSuit>>();
  const dealt = dealUnknown(unknown, needs, voids, contract, rng);

  const sampledHands: Record<number, CardId[]> = {};
  for (const s of view.activeSeats) {
    if (s === seat) {
      sampledHands[s] = [...(view.hands[s] || [])];
    } else {
      const fill = [...(dealt.get(s) ?? [])];
      sampledHands[s] = (view.hands[s] || []).map((c) => (c === 'back' ? fill.pop()! : c));
    }
  }

  // Im Normalspiel gehören die Kreuz-Damen zum Re-Team: Das Team der Stichprobe richtet sich nach den
  // gezogenen Karten (die Sicht kennt nur die offen gezeigten Re-Spieler).
  let reTeam = view.reTeam;
  if (view.contract.type === 'normal') {
    const played = [...view.completedTricks.flatMap((t) => t.cards), ...view.currentTrick];
    const holdsQueen = (s: number) =>
      sampledHands[s]!.some((c) => cardSuit(c) === 'C' && cardRank(c) === 12) || played.some((p) => p.player === s && cardSuit(p.card) === 'C' && cardRank(p.card) === 12);
    reTeam = view.activeSeats.filter(holdsQueen);
  } else if (view.contract.soloist !== undefined) {
    reTeam = Array.from(new Set([view.contract.soloist, ...view.reTeam]));
  }

  return {
    ...view,
    hands: sampledHands,
    reTeam,
  };
}

export function result(state: DokoState): Result | null {
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
