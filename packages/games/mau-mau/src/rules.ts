import {
  cardRank,
  cardSuit,
  Rng,
  SUITS,
  type Actor,
  type CardId,
  type GameEvent,
  type MoveResult,
  type Suit,
} from '@brett-und-blatt/engine';
import { buildMauMauDeck } from './deck';
import type { MauMauMove, MauMauOptions, MauMauState } from './types';

/** Standard-Optionen für Mau-Mau. */
export const defaultOptions: MauMauOptions = {
  deckStyle: 'four-color',
  sevenStack: 'on',
  nineReverse: 'on',
  aceExtraTurn: 'off',
  jackOnEverything: 'on',
  jackOnJack: 'forbidden',
  mauCall: 'on',
  drawRule: 'one',
};

/** Anzahl der Handkarten zu Beginn. */
export const HAND_SIZE = 5;

const JACK = 11;
const SEVEN = 7;
const EIGHT = 8;
const NINE = 9;
const ACE = 1;

function isJack(card: CardId): boolean {
  return cardRank(card) === JACK;
}

function isSeven(card: CardId): boolean {
  return cardRank(card) === SEVEN;
}

/** Nächster Platz in Spielrichtung. */
export function getNextPlayer(current: number, direction: 1 | -1, total: number, steps = 1): number {
  return (((current + direction * steps) % total) + total) % total;
}

/** Prüft, ob eine Karte auf die oberste Ablagekarte passt. */
export function canPlayCard(
  card: CardId,
  topCard: CardId,
  activeSuit: Suit,
  options: MauMauOptions,
): boolean {
  const cardSuitValue = cardSuit(card);
  const cardRankValue = cardRank(card);
  const topRank = cardRank(topCard);
  const topIsJack = topRank === JACK;

  if (cardRankValue === JACK) {
    if (topIsJack && options.jackOnJack === 'forbidden') return false;
    if (options.jackOnEverything === 'on') return true;
    return cardSuitValue === activeSuit || topIsJack;
  }

  return cardSuitValue === activeSuit || cardRankValue === topRank;
}

/** Mischt die Ablage bis auf die oberste Karte zurück in den Nachziehstapel. */
function recycleDiscards(state: MauMauState, rng: Rng): void {
  if (state.discard.length <= 1) return;
  const top = state.discard[state.discard.length - 1]!;
  const rest = state.discard.slice(0, -1);
  state.discard = [top];
  state.stock.push(...rng.shuffle(rest));
}

/** Zieht eine Karte. Ist der Stapel leer, wird vorher die Ablage neu gemischt. */
function drawCard(state: MauMauState, rng: Rng): CardId | undefined {
  if (state.stock.length === 0) recycleDiscards(state, rng);
  return state.stock.pop();
}

/** Initialisiert eine Partie Mau-Mau. */
export function setup(seats: number, rng: Rng, optionsPartial: Partial<MauMauOptions> = {}): MauMauState {
  const options: MauMauOptions = { ...defaultOptions, ...optionsPartial };
  const deck = rng.shuffle(buildMauMauDeck());

  const hands: CardId[][] = Array.from({ length: seats }, () => []);
  for (let round = 0; round < HAND_SIZE; round++) {
    for (let seat = 0; seat < seats; seat++) {
      const card = deck.pop();
      if (card) hands[seat]!.push(card);
    }
  }

  const startCard = deck.pop();
  if (!startCard) throw new Error('Das Mau-Mau-Blatt ist zu klein für diese Spielerzahl.');

  return {
    options,
    hands,
    stock: deck,
    discard: [startCard],
    activeSuit: cardSuit(startCard),
    direction: 1,
    turn: 0,
    pendingDraw: 0,
    hasDrawn: false,
    mauProtection: Array.from({ length: seats }, () => false),
    rng: rng.state,
    winner: null,
  };
}

/** Am Zug ist immer genau ein Platz. */
export function currentPlayers(state: MauMauState): number[] {
  return state.winner === null ? [state.turn] : [];
}

/** Prüft, ob ein Zug erlaubt ist. */
export function isLegal(state: MauMauState, actor: Actor, move: MauMauMove): boolean {
  if (typeof actor !== 'number' || state.winner !== null) return false;
  const hand = state.hands[actor];
  if (!hand) return false;
  const isTurn = actor === state.turn;

  if (move.type === 'draw') {
    if (!isTurn) return false;
    return state.pendingDraw > 0 || !state.hasDrawn;
  }

  if (move.type === 'pass') {
    if (!isTurn) return false;
    return state.hasDrawn && state.pendingDraw === 0;
  }

  if (move.type === 'catchMau') {
    if (state.options.mauCall !== 'on') return false;
    const target = move.target;
    return (
      typeof target === 'number' &&
      target >= 0 &&
      target < state.hands.length &&
      target !== actor &&
      state.hands[target]!.length === 1 &&
      !state.mauProtection[target]
    );
  }

  if (move.type === 'play') {
    if (!isTurn) return false;
    const card = hand.find((c) => c === move.cardId);
    if (!card) return false;

    const topCard = state.discard[state.discard.length - 1];
    if (!topCard) return false;

    if (state.pendingDraw > 0) {
      if (state.options.sevenStack === 'off' || !isSeven(card)) return false;
    } else if (!canPlayCard(card, topCard, state.activeSuit, state.options)) {
      return false;
    }

    if (isJack(card)) {
      const validSuit =
        move.chosenSuit !== undefined && (SUITS as readonly string[]).includes(move.chosenSuit);
      // Die letzte Karte gewinnt sofort; eine Wunschfarbe wäre dann ohne Bedeutung.
      if (hand.length > 1 && !validSuit) return false;
      if (move.chosenSuit !== undefined && !validSuit) return false;
    } else if (move.chosenSuit !== undefined) {
      return false;
    }

    return true;
  }

  return false;
}

/** Alle erlaubten Züge eines Platzes. */
export function legalMoves(state: MauMauState, actor: number): MauMauMove[] {
  if (state.winner !== null) return [];
  if (actor !== state.turn) return [];
  const hand = state.hands[actor];
  if (!hand) return [];

  const moves: MauMauMove[] = [];
  const topCard = state.discard[state.discard.length - 1];
  if (!topCard) return [];

  const willHaveOne = hand.length === 2;
  const pushPlay = (cardId: CardId, chosenSuit?: Suit) => {
    if (willHaveOne) {
      moves.push({ type: 'play', cardId, ...(chosenSuit ? { chosenSuit } : {}), callMau: true });
    } else {
      moves.push({ type: 'play', cardId, ...(chosenSuit ? { chosenSuit } : {}) });
    }
  };

  // Anprangern: Der Nächste darf einen vergessenen „Mau!“-Ruf melden.
  if (state.options.mauCall === 'on') {
    for (let seat = 0; seat < state.hands.length; seat++) {
      if (seat !== actor && state.hands[seat]!.length === 1 && !state.mauProtection[seat]) {
        moves.push({ type: 'catchMau', target: seat });
      }
    }
  }

  // Ausstehende 7er-Strafe: Nur eine weitere 7 weiterschieben oder ziehen.
  if (state.pendingDraw > 0) {
    if (state.options.sevenStack === 'on') {
      for (const card of hand) {
        if (isSeven(card)) pushPlay(card);
      }
    }
    moves.push({ type: 'draw' });
    return moves;
  }

  for (const card of hand) {
    if (!canPlayCard(card, topCard, state.activeSuit, state.options)) continue;

    if (isJack(card)) {
      if (hand.length === 1) {
        // Letzte Karte: Die Farbwahl ist nur noch Formsache.
        moves.push({ type: 'play', cardId: card });
      } else {
        for (const suit of SUITS) pushPlay(card, suit);
      }
    } else {
      pushPlay(card);
    }
  }

  if (!state.hasDrawn) {
    moves.push({ type: 'draw' });
  } else {
    moves.push({ type: 'pass' });
  }

  return moves;
}

/** Führt einen Zug aus. */
export function applyMove(state: MauMauState, actor: number, move: MauMauMove): MoveResult<MauMauState> {
  if (!isLegal(state, actor, move)) throw new Error('Dieser Zug ist nicht erlaubt.');

  const next = JSON.parse(JSON.stringify(state)) as MauMauState;
  const rng = new Rng(next.rng);
  const events: GameEvent[] = [];
  const total = next.hands.length;

  const finish = () => {
    next.rng = rng.state;
    return { state: next, events };
  };

  const giveCards = (target: number, count: number) => {
    const drawn: CardId[] = [];
    for (let i = 0; i < count; i++) {
      const card = drawCard(next, rng);
      if (!card) break;
      next.hands[target]!.push(card);
      drawn.push(card);
    }
    // Wer wieder mehrere Karten hat, ist nicht mehr durch einen alten Mau-Ruf geschützt.
    if (next.hands[target]!.length !== 1) next.mauProtection[target] = false;
    return drawn;
  };

  // 1. „Mau!“ vergessen und ertappt.
  if (move.type === 'catchMau') {
    const target = move.target;
    if (next.hands[target]!.length === 1 && !next.mauProtection[target]) {
      giveCards(target, 1);
      next.mauProtection[target] = true;
      events.push({ type: 'caughtMau', actor, target });
      next.lastAction = {
        player: actor,
        text: `Mau vergessen! ${target + 1}. Platz zieht 1 Strafkarte.`,
        target,
      };
    }
    return finish();
  }

  // 2. Ziehen – entweder Strafkarten oder eine neue Karte.
  if (move.type === 'draw') {
    if (next.pendingDraw > 0) {
      const count = next.pendingDraw;
      const drawn = giveCards(actor, count);
      events.push({ type: 'drewPenalty', player: actor, count: drawn.length });
      next.lastAction = { player: actor, text: `+${drawn.length} Strafkarten gezogen` };
      next.pendingDraw = 0;
      next.hasDrawn = false;
      next.turn = getNextPlayer(actor, next.direction, total);
      return finish();
    }

    let drawnCount = 0;
    let playable = false;
    const topCard = next.discard[next.discard.length - 1]!;

    // Bei „bis passend“ höchstens einmal durch den Talon, damit der Zug sicher endet.
    const maxDraws = next.options.drawRule === 'one' ? 1 : 32;
    for (let i = 0; i < maxDraws; i++) {
      const card = drawCard(next, rng);
      if (!card) break;
      next.hands[actor]!.push(card);
      drawnCount++;
      if (canPlayCard(card, topCard, next.activeSuit, next.options)) {
        playable = true;
        break;
      }
    }

    events.push({ type: 'drewCard', player: actor, count: drawnCount });
    if (drawnCount > 0) next.mauProtection[actor] = false;
    next.lastAction = {
      player: actor,
      text: drawnCount === 1 ? 'Karte gezogen' : `${drawnCount} Karten gezogen`,
    };

    if (!playable) {
      next.hasDrawn = false;
      next.turn = getNextPlayer(actor, next.direction, total);
    } else {
      next.hasDrawn = true;
    }
    return finish();
  }

  // 3. Passen nach dem Ziehen.
  if (move.type === 'pass') {
    next.hasDrawn = false;
    next.turn = getNextPlayer(actor, next.direction, total);
    next.lastAction = { player: actor, text: 'Gepasst' };
    return finish();
  }

  // 4. Karte legen.
  const cardIndex = next.hands[actor]!.findIndex((c) => c === move.cardId);
  if (cardIndex === -1) return finish();
  const [card] = next.hands[actor]!.splice(cardIndex, 1);
  if (!card) return finish();
  next.discard.push(card);

  const rank = cardRank(card);
  const suit = cardSuit(card);

  events.push({ type: 'cardPlayed', player: actor, card });

  next.hasDrawn = false;
  next.activeSuit = rank === JACK ? (move.chosenSuit ?? suit) : suit;

  // „Mau!“-Schutz: Wer die vorletzte Karte legt, muss rufen.
  if (next.hands[actor]!.length === 1) {
    next.mauProtection[actor] = !!move.callMau;
    if (move.callMau) events.push({ type: 'calledMau', player: actor });
  } else {
    next.mauProtection[actor] = false;
  }

  next.lastAction = {
    player: actor,
    text: rank === JACK ? `Bube – ${suitName(next.activeSuit)} gewünscht` : 'Karte gelegt',
    card,
    suit: next.activeSuit,
  };

  // Gewonnen, bevor Sonderfunktionen noch jemanden bestrafen.
  if (next.hands[actor]!.length === 0) {
    next.winner = actor;
    events.push({ type: 'win', winner: actor });
    return finish();
  }

  let steps = 1;

  if (rank === SEVEN) {
    if (next.options.sevenStack === 'on') {
      next.pendingDraw += 2;
      events.push({ type: 'penaltyPending', player: actor, count: next.pendingDraw });
    } else {
      const victim = getNextPlayer(actor, next.direction, total);
      const drawn = giveCards(victim, 2);
      events.push({ type: 'drewPenalty', player: victim, count: drawn.length });
      steps = 2;
    }
  } else if (rank === EIGHT) {
    const victim = getNextPlayer(actor, next.direction, total);
    events.push({ type: 'skip', player: victim });
    steps = 2;
  } else if (rank === NINE && next.options.nineReverse === 'on') {
    if (total === 2) {
      steps = 2;
    } else {
      next.direction = (next.direction * -1) as 1 | -1;
      steps = 1;
    }
    events.push({ type: 'reverse', direction: next.direction });
  } else if (rank === ACE && next.options.aceExtraTurn === 'on') {
    events.push({ type: 'extraTurn', player: actor });
    steps = 0;
  } else if (rank === JACK) {
    events.push({ type: 'wishSuit', player: actor, suit: next.activeSuit });
  }

  next.turn = steps === 0 ? actor : getNextPlayer(actor, next.direction, total, steps);
  return finish();
}

/** Füllt unbekannte Hände und den Talon für Bot-Simulationen auf. */
export function sampleHidden(view: MauMauState, seat: number | 'spectator', rng: Rng): MauMauState {
  const next = JSON.parse(JSON.stringify(view)) as MauMauState;
  const targetSeat = typeof seat === 'number' ? seat : -1;

  const known = new Set<CardId>();
  for (const hand of next.hands) {
    for (const card of hand) {
      if (card !== HIDDEN_CARD) known.add(card);
    }
  }
  for (const card of next.discard) known.add(card);

  const pool = rng.shuffle(buildMauMauDeck().filter((card) => !known.has(card)));

  for (let s = 0; s < next.hands.length; s++) {
    if (s === targetSeat) continue;
    const count = next.hands[s]!.length;
    next.hands[s] = [];
    for (let i = 0; i < count; i++) {
      const card = pool.pop();
      if (card) next.hands[s]!.push(card);
    }
  }

  next.stock = pool;
  next.rng = rng.state;
  return next;
}

/** Platzhalter für verdeckte Karten in der Sicht. */
export const HIDDEN_CARD = 'hidden';

/** Sicht eines Spielers: fremde Hände und der Talon sind verdeckt. */
export function playerView(state: MauMauState, seat: number | 'spectator'): MauMauState {
  const isOver = state.winner !== null;
  const revealAll = isOver;

  return {
    ...state,
    rng: [0, 0, 0, 0],
    hands: state.hands.map((hand, index) => {
      if (revealAll || index === seat) return hand;
      return Array.from({ length: hand.length }, () => HIDDEN_CARD);
    }),
    stock: Array.from({ length: state.stock.length }, () => HIDDEN_CARD),
  };
}

/** Ergebnis der Partie. */
export function result(state: MauMauState): { kind: 'win'; winners: [number] } | null {
  return state.winner !== null ? { kind: 'win', winners: [state.winner] } : null;
}

export function suitName(suit: Suit): string {
  return { C: 'Kreuz', D: 'Karo', H: 'Herz', S: 'Pik' }[suit];
}
