import { Rng, type Actor, type GameEvent, type MoveResult, type Options, type Result, type SeatId } from '@brett-und-blatt/engine';

/** Ein Stein: 0 … 107. Farbe = ⌊id / 18⌋, Form = ⌊id / 3⌋ mod 6, dazu drei gleiche Exemplare. */
export type TileId = number;

export const COLORS = 6;
export const SHAPES = 6;
export const COPIES = 3;
export const TILE_COUNT = COLORS * SHAPES * COPIES;
export const HAND_SIZE = 6;
/** Punkte für eine volle Sechserreihe und fürs Leeren des Bänkchens am Ende. */
export const FULL_LINE_BONUS = 6;
export const FINISH_BONUS = 6;

export const colorOf = (tile: TileId) => Math.floor(tile / (SHAPES * COPIES));
export const shapeOf = (tile: TileId) => Math.floor(tile / COPIES) % SHAPES;
/** Art eines Steins (Farbe und Form, ohne Exemplar): 0 … 35. */
export const kindOf = (tile: TileId) => Math.floor(tile / COPIES);

export interface Placed {
  x: number;
  y: number;
  tile: TileId;
}

export interface ColorShapeState {
  seats: number;
  /** Gelegte Steine; der erste liegt bei (0, 0), y wächst nach unten. */
  board: Placed[];
  /** Bänkchen je Platz. In der Sicht fremder Plätze steht null statt der Steine. */
  hands: (TileId | null)[][];
  /** Beutel, gezogen wird vom Ende. In der Sicht null. */
  bag: (TileId | null)[];
  scores: number[];
  turn: SeatId;
  /** Züge in Folge ohne Legen oder Tauschen (alle stecken fest: Ende). */
  passes: number;
  /** Steine des letzten Legezugs (für die Hervorhebung). */
  lastPlaced: Placed[];
  over: boolean;
  /** Wer das Bänkchen zuerst geleert hat (Bonus). */
  finisher: SeatId | null;
}

export type ColorShapeMove =
  | { type: 'place'; tiles: Placed[] }
  | { type: 'swap'; tiles: TileId[] }
  | { type: 'pass' };

const key = (x: number, y: number) => `${x},${y}`;

export type BoardMap = Map<string, TileId>;

export function boardMap(board: readonly Placed[]): BoardMap {
  const map: BoardMap = new Map();
  for (const p of board) map.set(key(p.x, p.y), p.tile);
  return map;
}

/** Größte Gruppe ohne Doppelte, die alle dieselbe Farbe oder dieselbe Form hat (für den Startspieler). */
export function largestGroup(hand: readonly TileId[]): number {
  let best = 0;
  for (let i = 0; i < COLORS; i++) {
    best = Math.max(best, new Set(hand.filter((t) => colorOf(t) === i).map(shapeOf)).size);
    best = Math.max(best, new Set(hand.filter((t) => shapeOf(t) === i).map(colorOf)).size);
  }
  return best;
}

export function setup(seats: number, _options: Options, seed: string): ColorShapeState {
  const rng = Rng.fromSeed(seed, 'beutel');
  const bag: TileId[] = rng.shuffle(Array.from({ length: TILE_COUNT }, (_, i) => i));
  const hands = Array.from({ length: seats }, () => bag.splice(bag.length - HAND_SIZE, HAND_SIZE).sort((a, b) => a - b));
  // Es beginnt, wer die größte passende Gruppe hat; bei Gleichstand der frühere Platz.
  let turn = 0;
  hands.forEach((hand, seat) => {
    if (largestGroup(hand) > largestGroup(hands[turn]!)) turn = seat;
  });
  return { seats, board: [], hands, bag, scores: Array(seats).fill(0), turn, passes: 0, lastPlaced: [], over: false, finisher: null };
}

/** Bilden diese Steine eine gültige Reihe? Alle gleiche Farbe und verschiedene Formen oder umgekehrt, höchstens sechs. */
export function validLine(tiles: readonly TileId[]): boolean {
  if (tiles.length <= 1) return true;
  if (tiles.length > 6) return false;
  const kinds = new Set(tiles.map(kindOf));
  if (kinds.size !== tiles.length) return false;
  const sameColor = tiles.every((t) => colorOf(t) === colorOf(tiles[0]!));
  const sameShape = tiles.every((t) => shapeOf(t) === shapeOf(tiles[0]!));
  return sameColor || sameShape;
}

/** Die zusammenhängende Reihe durch (x, y) in Richtung (dx, dy), mit dem Startpunkt der Reihe. */
function lineThrough(map: BoardMap, x: number, y: number, dx: number, dy: number): { tiles: TileId[]; start: string } {
  let sx = x;
  let sy = y;
  while (map.has(key(sx - dx, sy - dy))) {
    sx -= dx;
    sy -= dy;
  }
  const tiles: TileId[] = [];
  let cx = sx;
  let cy = sy;
  while (map.has(key(cx, cy))) {
    tiles.push(map.get(key(cx, cy))!);
    cx += dx;
    cy += dy;
  }
  return { tiles, start: `${dx}:${key(sx, sy)}` };
}

export type PlacementCheck = { ok: true; points: number; fullLines: number } | { ok: false; reason: string };

/**
 * Prüft einen Legezug und rechnet die Punkte: jede berührte Reihe (ab zwei Steinen) zählt ihre Länge,
 * eine volle Sechserreihe 6 Punkte extra. Ein einzelner Stein auf leerem Brett zählt 1.
 */
export function checkPlacement(board: readonly Placed[], hand: readonly (TileId | null)[], tiles: readonly Placed[], map: BoardMap = boardMap(board)): PlacementCheck {
  if (tiles.length === 0) return { ok: false, reason: 'Lege mindestens einen Stein.' };
  const available = hand.filter((t): t is TileId => t !== null);
  const used = new Set<TileId>();
  const cells = new Set<string>();
  for (const p of tiles) {
    if (!Number.isInteger(p.x) || !Number.isInteger(p.y) || !available.includes(p.tile) || used.has(p.tile)) return { ok: false, reason: 'Diesen Stein hast du nicht.' };
    used.add(p.tile);
    const k = key(p.x, p.y);
    if (map.has(k) || cells.has(k)) return { ok: false, reason: 'Das Feld ist schon belegt.' };
    cells.add(k);
  }
  const sameRow = tiles.every((p) => p.y === tiles[0]!.y);
  const sameCol = tiles.every((p) => p.x === tiles[0]!.x);
  if (!sameRow && !sameCol) return { ok: false, reason: 'Alle Steine müssen in einer Reihe liegen.' };

  const next = new Map(map);
  for (const p of tiles) next.set(key(p.x, p.y), p.tile);
  // Lückenlos: zwischen den neuen Steinen darf kein Feld frei bleiben.
  if (tiles.length > 1) {
    const along = (p: Placed) => (sameRow ? p.x : p.y);
    const min = Math.min(...tiles.map(along));
    const max = Math.max(...tiles.map(along));
    for (let i = min; i <= max; i++) {
      const x = sameRow ? i : tiles[0]!.x;
      const y = sameRow ? tiles[0]!.y : i;
      if (!next.has(key(x, y))) return { ok: false, reason: 'Die Reihe darf keine Lücke haben.' };
    }
  }
  if (map.size > 0 && !tiles.some((p) => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => map.has(key(p.x + dx!, p.y + dy!))))) {
    return { ok: false, reason: 'Lege an die Steine auf dem Tisch an.' };
  }

  const lines = new Map<string, TileId[]>();
  for (const p of tiles) {
    for (const [dx, dy] of [[1, 0], [0, 1]] as const) {
      const line = lineThrough(next, p.x, p.y, dx, dy);
      if (line.tiles.length >= 2) lines.set(line.start, line.tiles);
    }
  }
  let points = 0;
  let fullLines = 0;
  for (const line of lines.values()) {
    if (!validLine(line)) return { ok: false, reason: 'Eine Reihe braucht dieselbe Farbe oder dieselbe Form, ohne Doppelte.' };
    points += line.length;
    if (line.length === 6) {
      points += FULL_LINE_BONUS;
      fullLines++;
    }
  }
  return { ok: true, points: Math.max(points, 1), fullLines };
}

/**
 * Alle erlaubten Legezüge. Gleiche Steine (zwei gleiche Exemplare) gelten als derselbe Zug.
 * Von jedem freien Nachbarfeld aus wird in beide Richtungen Stein für Stein verlängert.
 */
export function placements(state: Pick<ColorShapeState, 'board'>, hand: readonly TileId[]): { tiles: Placed[]; points: number }[] {
  const map = boardMap(state.board);
  const anchors: [number, number][] = [];
  if (map.size === 0) anchors.push([0, 0]);
  else {
    const seen = new Set<string>();
    for (const p of state.board) {
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const k = key(p.x + dx, p.y + dy);
        if (!map.has(k) && !seen.has(k)) {
          seen.add(k);
          anchors.push([p.x + dx, p.y + dy]);
        }
      }
    }
  }
  // Eine Hand mit doppelten Arten: je Art nur einen Vertreter betrachten.
  const byKind = new Map<number, TileId>();
  for (const t of hand) if (!byKind.has(kindOf(t))) byKind.set(kindOf(t), t);
  const unique = [...byKind.values()];

  const found = new Map<string, { tiles: Placed[]; points: number }>();
  const signature = (tiles: Placed[]) =>
    tiles
      .map((p) => `${p.x},${p.y},${kindOf(p.tile)}`)
      .sort()
      .join(';');

  const extend = (tiles: Placed[], dir: [number, number] | null, rest: TileId[]) => {
    const check = checkPlacement(state.board, hand, tiles, map);
    if (!check.ok) return;
    const sig = signature(tiles);
    if (found.has(sig)) return;
    found.set(sig, { tiles, points: check.points });
    if (rest.length === 0) return;
    const dirs: [number, number][] = dir ? [dir] : [[1, 0], [0, 1]];
    for (const [dx, dy] of dirs) {
      // Freie Felder an beiden Enden der Reihe, über liegende Steine hinweg.
      const occupied = (x: number, y: number) => map.has(key(x, y)) || tiles.some((p) => p.x === x && p.y === y);
      const ends: [number, number][] = [];
      for (const sign of [1, -1]) {
        let x = tiles[0]!.x;
        let y = tiles[0]!.y;
        while (occupied(x, y)) {
          x += dx * sign;
          y += dy * sign;
        }
        ends.push([x, y]);
      }
      for (const [x, y] of ends) {
        for (let i = 0; i < rest.length; i++) {
          extend([...tiles, { x, y, tile: rest[i]! }], [dx, dy], [...rest.slice(0, i), ...rest.slice(i + 1)]);
        }
      }
    }
  };

  for (const [x, y] of anchors) {
    for (let i = 0; i < unique.length; i++) {
      extend([{ x, y, tile: unique[i]! }], null, [...unique.slice(0, i), ...unique.slice(i + 1)]);
    }
  }
  return [...found.values()];
}

export function currentPlayers(state: ColorShapeState): Actor[] {
  return state.over ? [] : [state.turn];
}

function ownHand(state: ColorShapeState, seat: SeatId): TileId[] {
  return (state.hands[seat] ?? []).filter((t): t is TileId => t !== null);
}

/** Tauschen geht nur, wenn der Beutel noch so viele Steine hat. */
function canSwap(state: ColorShapeState, count: number): boolean {
  return count > 0 && state.bag.length >= count;
}

export function legalMoves(state: ColorShapeState, actor: Actor): ColorShapeMove[] {
  if (actor !== state.turn || state.over) return [];
  const hand = ownHand(state, actor);
  const moves: ColorShapeMove[] = placements(state, hand).map((p) => ({ type: 'place', tiles: p.tiles }));
  // Tauschen: alle Teilmengen des Bänkchens (höchstens 63), soweit der Beutel reicht.
  for (let mask = 1; mask < 1 << hand.length; mask++) {
    const tiles = hand.filter((_, i) => mask & (1 << i));
    if (canSwap(state, tiles.length)) moves.push({ type: 'swap', tiles });
  }
  if (moves.length === 0) moves.push({ type: 'pass' });
  return moves;
}

export function isLegal(state: ColorShapeState, actor: Actor, move: ColorShapeMove): boolean {
  if (actor !== state.turn || state.over) return false;
  const hand = ownHand(state, actor);
  switch (move.type) {
    case 'place':
      return Array.isArray(move.tiles) && checkPlacement(state.board, hand, move.tiles).ok;
    case 'swap':
      return Array.isArray(move.tiles) && new Set(move.tiles).size === move.tiles.length && move.tiles.every((t) => hand.includes(t)) && canSwap(state, move.tiles.length);
    case 'pass':
      return legalMoves(state, actor).some((m) => m.type === 'pass');
    default:
      return false;
  }
}

function endTurn(state: ColorShapeState, seat: SeatId): ColorShapeState {
  return { ...state, turn: (seat + 1) % state.seats };
}

export function applyMove(state: ColorShapeState, actor: Actor, move: ColorShapeMove): MoveResult<ColorShapeState> {
  if (!isLegal(state, actor, move)) throw new Error('Dieser Zug ist nicht erlaubt.');
  const seat = actor as SeatId;
  const events: GameEvent[] = [];
  const hands = state.hands.map((h) => [...h]);
  const bag = [...state.bag];
  const scores = [...state.scores];

  if (move.type === 'pass') {
    events.push({ type: 'passed', seat });
    const next = endTurn({ ...state, passes: state.passes + 1 }, seat);
    if (next.passes >= state.seats) {
      events.push({ type: 'over' });
      return { state: { ...next, over: true }, events };
    }
    return { state: next, events };
  }

  if (move.type === 'swap') {
    const hand = hands[seat]!.filter((t) => !move.tiles.includes(t as TileId));
    const drawn = bag.splice(bag.length - move.tiles.length, move.tiles.length);
    hand.push(...drawn);
    // Die getauschten Steine kommen unten in den Beutel.
    bag.unshift(...move.tiles);
    hands[seat] = (hand as TileId[]).sort((a, b) => a - b);
    events.push({ type: 'swapped', seat, count: move.tiles.length });
    events.push({ type: 'drew', seat, tiles: drawn });
    return { state: endTurn({ ...state, hands, bag, passes: 0, lastPlaced: [] }, seat), events };
  }

  const check = checkPlacement(state.board, ownHand(state, seat), move.tiles) as Extract<PlacementCheck, { ok: true }>;
  const placed = move.tiles.map((p) => ({ x: p.x, y: p.y, tile: p.tile }));
  let hand = hands[seat]!.filter((t) => !placed.some((p) => p.tile === t));
  const drawn = bag.splice(Math.max(0, bag.length - placed.length), placed.length);
  hand = [...hand, ...drawn].sort((a, b) => (a as number) - (b as number));
  hands[seat] = hand;
  scores[seat]! += check.points;
  events.push({ type: 'placed', seat, tiles: placed, points: check.points, fullLines: check.fullLines });
  if (drawn.length > 0) events.push({ type: 'drew', seat, tiles: drawn });

  let next: ColorShapeState = { ...state, board: [...state.board, ...placed], hands, bag, scores, passes: 0, lastPlaced: placed };
  if (hand.length === 0) {
    // Beutel leer und Bänkchen leer: Bonus, Ende.
    scores[seat]! += FINISH_BONUS;
    events.push({ type: 'finished', seat, bonus: FINISH_BONUS });
    events.push({ type: 'over' });
    next = { ...next, scores, over: true, finisher: seat };
    return { state: next, events };
  }
  return { state: endTurn(next, seat), events };
}

export function result(state: ColorShapeState): Result | null {
  if (!state.over) return null;
  const best = Math.max(...state.scores);
  const winners = state.scores.flatMap((s, seat) => (s === best ? [seat] : []));
  return winners.length === state.seats ? { kind: 'draw' } : { kind: 'win', winners };
}

/** Jeder sieht sein eigenes Bänkchen; von den anderen und vom Beutel nur die Anzahl. */
export function playerView(state: ColorShapeState, seat: SeatId | 'spectator'): ColorShapeState {
  return { ...state, hands: state.hands.map((hand, s) => (s === seat ? hand : hand.map(() => null))), bag: state.bag.map(() => null) };
}

/** Gezogene Steine erfährt nur, wer sie gezogen hat. */
export function eventView(event: GameEvent, seat: SeatId | 'spectator'): GameEvent | null {
  if (event.type === 'drew' && event.seat !== seat) return { type: 'drew', seat: event.seat, count: (event.tiles as TileId[]).length };
  return event;
}

/** Für Bots: Die unbekannten Steine zufällig auf fremde Bänkchen und den Beutel verteilen. */
export function sampleHidden(view: ColorShapeState, seat: SeatId, rng: Rng): ColorShapeState {
  const known = new Set<TileId>([...view.board.map((p) => p.tile), ...ownHand(view, seat)]);
  const unknown = rng.shuffle(Array.from({ length: TILE_COUNT }, (_, i) => i).filter((t) => !known.has(t)));
  const hands = view.hands.map((hand, s) => (s === seat ? hand : hand.map(() => unknown.pop()!)));
  return { ...view, hands, bag: unknown };
}
