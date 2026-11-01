import { Rng, type GameEvent, type MoveResult, type Options, type Result, type RngState, type SeatId } from '@brett-und-blatt/engine';

/**
 * Rübenacker – Laufspiel für Kinder im Königsgarten unter der Narrenhof-Burg.
 *
 * Jeder Spieler hat Hasen auf der Wiese vor dem Beet. Wer dran ist, zieht eine Karte: 1, 2 oder 3
 * Felder vorwärts für einen Hasen seiner Wahl, oder „Maulwurf“. Der Maulwurf gräbt unter dem Beet
 * und taucht dort auf, wo der Erdhügel liegt: Ein Hase auf diesem Feld purzelt ins Loch und muss
 * zurück zum letzten Zaunpfahl. Danach wandert der Maulwurf auf seiner sichtbaren Spur zum
 * nächsten Hügel. Wer zuerst einen Hasen an der Riesenrübe hat, gewinnt.
 */

/** Felder 1 … 24 auf dem Weg; 0 ist die Wiese am Start, 25 die Rübe. */
export const TRACK_LENGTH = 24;
export const MEADOW = 0;
export const TURNIP = TRACK_LENGTH + 1;
/** Zaunpfähle: Dorthin kehrt ein Hase zurück, der ins Loch fällt (die Wiese zählt als erster). */
export const FENCE_POSTS = [MEADOW, 7, 13, 19] as const;
/** Die Spur des Maulwurfs: Hügel in dieser Reihenfolge, danach von vorn. */
export const MOLE_ROUTE = [8, 3, 14, 20, 5, 16, 10, 22, 12, 18] as const;

export type Card = 1 | 2 | 3 | 'mole';
/** Verdeckte Karte im Stapel (nur in Sichten). */
export const HIDDEN = '?';
export type DeckCard = Card | typeof HIDDEN;

/** Kartensatz: 10 × 1, 7 × 2, 5 × 3, 6 × Maulwurf. */
export const CARD_COUNTS: Record<string, number> = { '1': 10, '2': 7, '3': 5, mole: 6 };

export function fullDeck(): Card[] {
  const deck: Card[] = [];
  for (const [card, count] of Object.entries(CARD_COUNTS)) {
    for (let i = 0; i < count; i++) deck.push(card === 'mole' ? 'mole' : (Number(card) as 1 | 2 | 3));
  }
  return deck;
}

export interface TurnipState {
  seats: number;
  /** Feld je Hase und Platz. */
  hares: number[][];
  deck: DeckCard[];
  /** Gezogene Karten seit dem letzten Mischen, offen. */
  discard: Card[];
  /** Stelle auf der Maulwurfspur, an der der Erdhügel gerade liegt. */
  hill: number;
  turn: SeatId;
  /** Gezogene Zahlenkarte, die noch gesetzt werden muss, sonst null. */
  card: 1 | 2 | 3 | null;
  /** Wer fällt, kommt zurück zum letzten Zaunpfahl oder ganz an den Start. */
  fall: 'fence' | 'start';
  /** Gewinnt der erste Hase an der Rübe oder erst, wer alle Hasen dort hat? */
  goal: 'first' | 'all';
  winner: SeatId | null;
  rng: RngState;
}

export type TurnipMove = { type: 'draw' } | { type: 'hop'; hare: number };

export function hillField(state: Pick<TurnipState, 'hill'>, ahead = 0): number {
  return MOLE_ROUTE[(state.hill + ahead) % MOLE_ROUTE.length]!;
}

export function parseHares(value: unknown): number {
  return value === '2' ? 2 : value === '1' ? 1 : 3;
}

export function setup(seats: number, options: Options, seed: string): TurnipState {
  const count = Math.max(2, Math.min(6, Number(seats) || 2));
  const rng = Rng.fromSeed(seed);
  const deck = rng.shuffle(fullDeck());
  const perSeat = parseHares(options.hares);
  return {
    seats: count,
    hares: Array.from({ length: count }, () => Array.from({ length: perSeat }, () => MEADOW)),
    deck,
    discard: [],
    hill: 0,
    turn: 0,
    card: null,
    fall: options.fall === 'start' ? 'start' : 'fence',
    goal: options.goal === 'all' ? 'all' : 'first',
    winner: null,
    rng: rng.state,
  };
}

/** Ist das Feld schon von einem Hasen besetzt? Wiese und Rübe haben Platz für alle. */
function occupied(state: TurnipState, field: number): boolean {
  if (field === MEADOW || field === TURNIP) return false;
  return state.hares.some((hares) => hares.includes(field));
}

/**
 * Wohin ein Hase mit dieser Karte springt: Besetzte Felder werden übersprungen und nicht
 * mitgezählt. Wer über das letzte Feld hinauskommt, ist an der Rübe.
 */
export function targetOf(state: TurnipState, from: number, steps: number): number {
  let field = from;
  let left = steps;
  while (left > 0 && field < TURNIP) {
    field++;
    if (!occupied(state, field)) left--;
  }
  return Math.min(field, TURNIP);
}

/** Zaunpfahl hinter einem Feld (oder die Wiese). */
export function fenceBehind(field: number): number {
  let post: number = MEADOW;
  for (const p of FENCE_POSTS) if (p < field) post = p;
  return post;
}

export function currentPlayers(state: TurnipState): SeatId[] {
  return state.winner === null ? [state.turn] : [];
}

export function legalMoves(state: TurnipState, seat: SeatId): TurnipMove[] {
  if (state.winner !== null || seat !== state.turn) return [];
  if (state.card === null) return [{ type: 'draw' }];
  const moves: TurnipMove[] = [];
  state.hares[seat]!.forEach((field, hare) => {
    if (field !== TURNIP) moves.push({ type: 'hop', hare });
  });
  return moves;
}

function hasWon(state: TurnipState, seat: SeatId): boolean {
  const hares = state.hares[seat]!;
  return state.goal === 'all' ? hares.every((f) => f === TURNIP) : hares.some((f) => f === TURNIP);
}

function nextTurn(state: TurnipState): TurnipState {
  return { ...state, turn: (state.turn + 1) % state.seats, card: null };
}

export function applyMove(state: TurnipState, seat: SeatId, move: TurnipMove): MoveResult<TurnipState> {
  const legal = legalMoves(state, seat);
  if (!legal.some((m) => m.type === move.type && (m.type !== 'hop' || (move.type === 'hop' && m.hare === move.hare)))) {
    throw new Error('Unzulässiger Zug');
  }
  const events: GameEvent[] = [];

  if (move.type === 'draw') {
    const rng = new Rng(state.rng);
    let deck = state.deck;
    let discard = state.discard;
    if (deck.length === 0) {
      deck = rng.shuffle(discard);
      discard = [];
      events.push({ type: 'shuffled' });
    }
    const [card, ...rest] = deck as Card[];
    let next: TurnipState = { ...state, deck: rest, discard: [...discard, card!], rng: rng.state };
    events.push({ type: 'drawn', seat, card });
    if (card !== 'mole') return { state: { ...next, card: card! }, events };

    // Der Maulwurf taucht am Hügel auf.
    const hole = hillField(state);
    const fallen: { seat: SeatId; hare: number; to: number }[] = [];
    const hares = next.hares.map((list, s) =>
      list.map((field, hare) => {
        if (field !== hole) return field;
        const to = state.fall === 'start' ? MEADOW : fenceBehind(hole);
        fallen.push({ seat: s, hare, to });
        return to;
      }),
    );
    next = { ...next, hares, hill: (state.hill + 1) % MOLE_ROUTE.length };
    events.push({ type: 'mole', seat, hole, fallen, next: hillField(next) });
    if (fallen.length > 0) events.push({ type: 'fell', count: fallen.length });
    return { state: nextTurn(next), events };
  }

  const from = state.hares[seat]![move.hare]!;
  const to = targetOf(state, from, state.card!);
  const hares = state.hares.map((list, s) => (s === seat ? list.map((f, h) => (h === move.hare ? to : f)) : list));
  let next: TurnipState = { ...state, hares };
  events.push({ type: 'hopped', seat, hare: move.hare, from, to });
  if (to === TURNIP) events.push({ type: 'arrived', seat, hare: move.hare });
  if (hasWon(next, seat)) {
    events.push({ type: 'win', seat });
    return { state: { ...next, winner: seat, card: null }, events };
  }
  next = nextTurn(next);
  return { state: next, events };
}

export function timeoutMove(state: TurnipState, seat: SeatId): TurnipMove {
  const moves = legalMoves(state, seat);
  // Bei Zeitablauf: den vordersten Hasen ziehen, der nicht auf den Hügel springt.
  if (moves[0]?.type !== 'hop') return moves[0]!;
  const hill = hillField(state);
  let best = moves[0]!;
  let bestTo = -1;
  for (const move of moves) {
    if (move.type !== 'hop') continue;
    const to = targetOf(state, state.hares[seat]![move.hare]!, state.card!);
    const score = to === hill ? -1 : to;
    if (score > bestTo) {
      bestTo = score;
      best = move;
    }
  }
  return best;
}

export function playerView(state: TurnipState): TurnipState {
  return { ...state, deck: state.deck.map(() => HIDDEN), rng: [0, 0, 0, 0] };
}

/** Der Stapel enthält genau die Karten, die noch nicht gezogen wurden; nur die Reihenfolge ist offen. */
export function sampleHidden(view: TurnipState, _seat: SeatId, rng: Rng): TurnipState {
  return { ...view, deck: rng.shuffle(remainingCards(view)), rng: rng.state };
}

/** Karten im Stapel als Liste (aus dem Kartensatz ohne die gezogenen). */
export function remainingCards(state: Pick<TurnipState, 'discard'>): Card[] {
  const left = fullDeck();
  for (const card of state.discard) {
    const i = left.indexOf(card);
    if (i >= 0) left.splice(i, 1);
  }
  return left;
}

export function result(state: TurnipState): Result | null {
  return state.winner === null ? null : { kind: 'win', winners: [state.winner] };
}
