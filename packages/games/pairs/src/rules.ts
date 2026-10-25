import { Rng, type Actor, type GameEvent, type MoveResult, type Options, type Result, type SeatId } from '@brett-und-blatt/engine';
import { pairSet } from './content';

export interface Face {
  pair: number;
  side: 'a' | 'b';
}

/** Verdeckt, gerade offen oder von einem Platz genommen. */
export type CardStatus = 'down' | 'up' | { takenBy: SeatId };

export interface PairsState {
  set: string;
  cols: number;
  rows: number;
  /** Inhalt je Karte. In der Sicht sind verdeckte Karten null. */
  faces: (Face | null)[];
  status: CardStatus[];
  /** Offene Karten des laufenden Zugs (eine) oder ein Fehlgriff, der noch liegen bleibt (zwei). */
  open: number[];
  turn: SeatId;
  scores: number[];
  /** Anzahl der Züge (zwei Karten = ein Zug) – das Ergebnis im Einzelspiel. */
  turns: number;
  continueOnPair: boolean;
  /** Öffentliches Protokoll: welche Karte wann mit welchem Inhalt aufgedeckt wurde. */
  log: { card: number; face: Face; step: number }[];
  step: number;
}

export interface PairsMove {
  type: 'flip';
  card: number;
}

/** So viele Aufdeck-Schritte bleiben im öffentlichen Protokoll. */
export const LOG_LENGTH = 80;

export const LAYOUTS: Record<string, [cols: number, rows: number]> = {
  '12': [3, 4],
  '16': [4, 4],
  '20': [4, 5],
  '24': [4, 6],
  '30': [5, 6],
  '36': [6, 6],
};

export function setup(seats: number, options: Options, seed: string): PairsState {
  const [cols, rows] = LAYOUTS[options.size ?? '16'] ?? [4, 4];
  const set = pairSet(options.set ?? 'tiere');
  const pairCount = (cols * rows) / 2;
  const rng = Rng.fromSeed(seed, 'karten');
  const chosen = rng.shuffle(set.pairs.map((_, i) => i)).slice(0, pairCount);
  const faces = rng.shuffle(chosen.flatMap((pair): Face[] => [{ pair, side: 'a' }, { pair, side: 'b' }]));
  return {
    set: set.id,
    cols,
    rows,
    faces,
    status: faces.map(() => 'down'),
    open: [],
    turn: 0,
    scores: Array(seats).fill(0),
    turns: 0,
    continueOnPair: options.continueOnPair !== 'off',
    log: [],
    step: 0,
  };
}

const isTaken = (status: CardStatus): status is { takenBy: SeatId } => typeof status === 'object';

export function currentPlayers(state: PairsState): Actor[] {
  return result(state) ? [] : [state.turn];
}

export function legalMoves(state: PairsState, actor: Actor): PairsMove[] {
  if (actor !== state.turn || result(state)) return [];
  const mismatch = state.open.length === 2;
  const moves: PairsMove[] = [];
  state.status.forEach((status, card) => {
    // Nach einem Fehlgriff liegen zwei Karten noch offen; sie werden beim nächsten Aufdecken umgedreht.
    if (status === 'down' || (mismatch && state.open.includes(card))) moves.push({ type: 'flip', card });
  });
  return moves;
}

export function applyMove(state: PairsState, actor: Actor, move: PairsMove): MoveResult<PairsState> {
  if (!legalMoves(state, actor).some((m) => m.card === move.card)) throw new Error('Diese Karte kannst du nicht aufdecken.');
  const status = [...state.status];
  let open = state.open;
  const events: GameEvent[] = [];
  if (open.length === 2) {
    for (const card of open) status[card] = 'down';
    events.push({ type: 'hidden', cards: open });
    open = [];
  }

  const face = state.faces[move.card];
  if (!face) throw new Error('Unbekannte Karte.');
  status[move.card] = 'up';
  open = [...open, move.card];
  // Das Protokoll behält die letzten Einträge – länger merkt sich auch der beste Bot nichts.
  const log = [...state.log, { card: move.card, face, step: state.step }].slice(-LOG_LENGTH);
  events.push({ type: 'flipped', card: move.card, face });

  const next: PairsState = { ...state, status, open, log, step: state.step + 1 };
  if (open.length < 2) return { state: next, events };

  const [a, b] = open as [number, number];
  next.turns = state.turns + 1;
  if (state.faces[a]?.pair === state.faces[b]?.pair) {
    status[a] = { takenBy: actor as SeatId };
    status[b] = { takenBy: actor as SeatId };
    next.open = [];
    next.scores = state.scores.map((s, seat) => (seat === actor ? s + 1 : s));
    events.push({ type: 'pair', cards: [a, b], seat: actor });
    if (!state.continueOnPair) next.turn = (state.turn + 1) % state.scores.length;
  } else {
    events.push({ type: 'mismatch', cards: [a, b] });
    next.turn = (state.turn + 1) % state.scores.length;
  }
  return { state: next, events };
}

export function result(state: PairsState): Result | null {
  if (!state.status.every(isTaken)) return null;
  const best = Math.max(...state.scores);
  const winners = state.scores.flatMap((score, seat) => (score === best ? [seat] : []));
  if (winners.length > 1 && winners.length === state.scores.length) return { kind: 'draw' };
  return { kind: 'win', winners };
}

/** Verdeckte Karten sind in der Sicht leer – sonst verriete ein Blick in die Entwicklertools alles. */
export function playerView(state: PairsState): PairsState {
  return { ...state, faces: state.faces.map((face, card) => (state.status[card] === 'down' ? null : face)) };
}

/** Für Bots: unbekannte Karten zufällig auf die verdeckten Plätze verteilen. */
export function sampleHidden(view: PairsState, _seat: SeatId, rng: Rng): PairsState {
  const known = new Set(view.faces.flatMap((f) => (f ? [`${f.pair}${f.side}`] : [])));
  const pairs = new Set<number>();
  for (const f of view.faces) if (f) pairs.add(f.pair);
  for (const entry of view.log) pairs.add(entry.face.pair);
  // Paare, von denen noch nichts zu sehen war, werden erfunden – nur ihre Anzahl zählt.
  const total = view.faces.length / 2;
  for (let p = 0; pairs.size < total; p++) if (!pairs.has(-1 - p)) pairs.add(-1 - p);
  const unknown = rng.shuffle([...pairs].flatMap((pair): Face[] => [{ pair, side: 'a' }, { pair, side: 'b' }]).filter((f) => !known.has(`${f.pair}${f.side}`)));
  let next = 0;
  return { ...view, faces: view.faces.map((face) => face ?? unknown[next++] ?? null) };
}
