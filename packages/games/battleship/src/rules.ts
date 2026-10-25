import { Rng, hashSeed, type Actor, type GameEvent, type MoveResult, type Options, type Result, type RngState, type SeatId } from '@brett-und-blatt/engine';

/** Das Meer ist 10×10 Felder groß; ein Feld ist `reihe * 10 + spalte`. */
export const SIZE = 10;
export const CELLS = SIZE * SIZE;

export type FleetKind = 'classic' | 'small';

/** Schiffsgrößen je Flotte, groß zuerst. */
export const FLEETS: Record<FleetKind, readonly number[]> = {
  classic: [5, 4, 4, 3, 3, 3, 2, 2, 2, 2],
  small: [5, 4, 3, 3, 2],
};

export interface Ship {
  /** Felder in Reihenfolge, waagerecht oder senkrecht. */
  cells: number[];
  sunk: boolean;
}

export type ShotResult = 'water' | 'hit' | 'sunk';

export interface Shot {
  cell: number;
  result: ShotResult;
}

export interface BattleshipState {
  fleetKind: FleetKind;
  /** Schiffe dürfen sich nicht berühren, auch nicht über Eck (Papierversion). */
  noTouch: boolean;
  /** Nach einem Treffer noch einmal schießen. */
  again: boolean;
  /** Salve: so viele Schüsse pro Runde wie eigene Schiffe übrig. */
  salvo: boolean;
  /** Wasser um versenkte Schiffe automatisch markieren (nur mit Berührverbot). */
  autoWater: boolean;
  phase: 'place' | 'shoot';
  placed: boolean[];
  /** Flotten je Platz. In der Sicht stehen von fremden Flotten nur versenkte Schiffe. */
  fleets: Ship[][];
  /** Schüsse je Platz auf das Meer des Gegners. */
  shots: Shot[][];
  /** Salvenmodus: Felder, die in dieser Runde schon anvisiert sind; aufgelöst wird am Ende. */
  aim: number[];
  turn: SeatId;
  winner: SeatId | null;
  /** Zufallsstrom für Beispiel-Aufstellungen; in jeder Sicht genullt. */
  rng: RngState;
}

export type BattleshipMove = { type: 'placeFleet'; ships: number[][] } | { type: 'shoot'; cell: number };

export const rowOf = (cell: number) => Math.floor(cell / SIZE);
export const colOf = (cell: number) => cell % SIZE;

/** Die bis zu acht Nachbarfelder (mit Ecken). */
export function neighbors8(cell: number): number[] {
  const result: number[] = [];
  const r = rowOf(cell);
  const c = colOf(cell);
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if ((dr || dc) && r + dr >= 0 && r + dr < SIZE && c + dc >= 0 && c + dc < SIZE) result.push((r + dr) * SIZE + c + dc);
    }
  }
  return result;
}

/** Die bis zu vier direkten Nachbarfelder. */
export function neighbors4(cell: number): number[] {
  const r = rowOf(cell);
  const c = colOf(cell);
  const result: number[] = [];
  if (r > 0) result.push(cell - SIZE);
  if (r < SIZE - 1) result.push(cell + SIZE);
  if (c > 0) result.push(cell - 1);
  if (c < SIZE - 1) result.push(cell + 1);
  return result;
}

/** Felder eines Schiffs ab `start`, waagerecht oder senkrecht; null, wenn es übers Meer hinausragt. */
export function shipCells(start: number, length: number, vertical: boolean): number[] | null {
  if (start < 0 || start >= CELLS) return null;
  if (vertical ? rowOf(start) + length > SIZE : colOf(start) + length > SIZE) return null;
  return Array.from({ length }, (_, i) => start + i * (vertical ? SIZE : 1));
}

/** Liegt ein Schiff gerade und lückenlos im Meer? */
function isStraight(cells: readonly number[]): boolean {
  if (cells.length === 0 || cells.some((c) => !Number.isInteger(c) || c < 0 || c >= CELLS)) return false;
  const sorted = [...cells].sort((a, b) => a - b);
  const vertical = sorted.length > 1 && sorted[1]! - sorted[0]! === SIZE;
  const expected = shipCells(sorted[0]!, sorted.length, vertical);
  return expected !== null && expected.every((c, i) => c === sorted[i]);
}

/** Prüft eine Aufstellung; gibt eine Fehlermeldung oder null zurück. */
export function fleetProblem(ships: unknown, kind: FleetKind, noTouch: boolean): string | null {
  if (!Array.isArray(ships) || !ships.every((s) => Array.isArray(s))) return 'Die Flotte fehlt.';
  const lists = ships as number[][];
  const sizes = lists.map((s) => s.length).sort((a, b) => b - a);
  if (sizes.join() !== FLEETS[kind].join()) return 'Die Flotte hat nicht die richtigen Schiffe.';
  if (!lists.every(isStraight)) return 'Schiffe müssen gerade im Meer liegen.';
  const owner = new Map<number, number>();
  for (const [i, cells] of lists.entries()) {
    for (const cell of cells) {
      if (owner.has(cell)) return 'Schiffe dürfen sich nicht überlappen.';
      owner.set(cell, i);
    }
  }
  if (noTouch) {
    for (const [cell, i] of owner) if (neighbors8(cell).some((n) => owner.has(n) && owner.get(n) !== i)) return 'Schiffe dürfen sich nicht berühren.';
  }
  return null;
}

/** Eine zufällige gültige Aufstellung. */
export function randomFleet(kind: FleetKind, noTouch: boolean, rng: Rng): number[][] {
  for (;;) {
    const blocked = new Set<number>();
    const ships: number[][] = [];
    for (const length of FLEETS[kind]) {
      let placed: number[] | null = null;
      for (let attempt = 0; attempt < 200 && !placed; attempt++) {
        const cells = shipCells(rng.int(CELLS), length, rng.chance(0.5));
        if (cells && cells.every((c) => !blocked.has(c))) placed = cells;
      }
      if (!placed) break;
      ships.push(placed);
      for (const cell of placed) {
        blocked.add(cell);
        if (noTouch) neighbors8(cell).forEach((n) => blocked.add(n));
      }
    }
    if (ships.length === FLEETS[kind].length) return ships;
  }
}

export function setup(seats: number, options: Options, seed: string): BattleshipState {
  const fleetKind: FleetKind = options.fleet === 'small' ? 'small' : 'classic';
  const noTouch = fleetKind === 'classic';
  return {
    fleetKind,
    noTouch,
    again: options.again !== 'off',
    salvo: options.salvo === 'on',
    autoWater: noTouch && options.autoWater !== 'off',
    phase: 'place',
    placed: Array.from({ length: seats }, () => false),
    fleets: Array.from({ length: seats }, () => []),
    shots: Array.from({ length: seats }, () => []),
    aim: [],
    turn: 0,
    winner: null,
    rng: hashSeed(`${seed}/flotten`),
  };
}

export const opponentOf = (seat: SeatId): SeatId => (seat === 0 ? 1 : 0);

/** Felder, die nach dem Berührverbot sicher Wasser sind: rund um versenkte Schiffe. */
export function knownWater(state: Pick<BattleshipState, 'noTouch' | 'fleets'>, target: SeatId): Set<number> {
  const water = new Set<number>();
  if (!state.noTouch) return water;
  for (const ship of state.fleets[target] ?? []) {
    if (!ship.sunk) continue;
    for (const cell of ship.cells) for (const n of neighbors8(cell)) if (!ship.cells.includes(n)) water.add(n);
  }
  return water;
}

/** Felder, auf die `seat` noch schießen kann. */
export function openCells(state: BattleshipState, seat: SeatId): number[] {
  const taken = new Set([...(state.shots[seat] ?? []).map((s) => s.cell), ...state.aim]);
  const water = state.autoWater ? knownWater(state, opponentOf(seat)) : new Set<number>();
  const cells: number[] = [];
  for (let cell = 0; cell < CELLS; cell++) if (!taken.has(cell) && !water.has(cell)) cells.push(cell);
  return cells;
}

/** Schüsse pro Runde im Salvenmodus: eigene Schiffe, die noch schwimmen. */
export function salvoSize(state: BattleshipState, seat: SeatId): number {
  return state.fleets[seat]?.filter((s) => !s.sunk).length ?? 0;
}

export function currentPlayers(state: BattleshipState): Actor[] {
  if (state.winner !== null) return [];
  if (state.phase === 'place') return state.placed.flatMap((done, seat) => (done ? [] : [seat]));
  return [state.turn];
}

export function legalMoves(state: BattleshipState, actor: Actor): BattleshipMove[] {
  if (!currentPlayers(state).includes(actor)) return [];
  const seat = actor as SeatId;
  if (state.phase === 'place') {
    // Aufstellungen gibt es unzählige: Hier steht nur ein Beispiel, geprüft wird mit `isLegal`.
    const rng = new Rng(hashSeed(`${state.rng.join()}/${seat}`));
    return [{ type: 'placeFleet', ships: randomFleet(state.fleetKind, state.noTouch, rng) }];
  }
  return openCells(state, seat).map((cell) => ({ type: 'shoot', cell }));
}

export function isLegal(state: BattleshipState, actor: Actor, move: BattleshipMove): boolean {
  if (!currentPlayers(state).includes(actor) || typeof move !== 'object' || move === null) return false;
  if (state.phase === 'place') return move.type === 'placeFleet' && fleetProblem(move.ships, state.fleetKind, state.noTouch) === null;
  return move.type === 'shoot' && openCells(state, actor as SeatId).includes(move.cell);
}

/** Schießt auf die Felder und markiert versenkte Schiffe. */
function fire(state: BattleshipState, seat: SeatId, cells: number[], events: GameEvent[]): { state: BattleshipState; hit: boolean } {
  const target = opponentOf(seat);
  const shotCells = new Set([...(state.shots[seat] ?? []).map((s) => s.cell), ...cells]);
  const fleet = (state.fleets[target] ?? []).map((ship) => ({ ...ship, sunk: ship.sunk || ship.cells.every((c) => shotCells.has(c)) }));
  const newShots: Shot[] = cells.map((cell) => {
    const ship = fleet.find((s) => s.cells.includes(cell));
    return { cell, result: !ship ? 'water' : ship.sunk ? 'sunk' : 'hit' };
  });
  for (const shot of newShots) events.push({ type: 'shot', seat, cell: shot.cell, result: shot.result });
  fleet.forEach((ship, i) => {
    if (ship.sunk && !state.fleets[target]![i]!.sunk) events.push({ type: 'sunk', seat: target, cells: ship.cells });
  });
  const fleets = state.fleets.map((f, s) => (s === target ? fleet : f));
  const shots = state.shots.map((list, s) => (s === seat ? [...list, ...newShots] : list));
  const winner = fleet.every((s) => s.sunk) ? seat : null;
  if (winner !== null) events.push({ type: 'won', seat });
  return { state: { ...state, fleets, shots, aim: [], winner }, hit: newShots.some((s) => s.result !== 'water') };
}

export function applyMove(state: BattleshipState, actor: Actor, move: BattleshipMove): MoveResult<BattleshipState> {
  if (!isLegal(state, actor, move)) throw new Error('Dieser Zug ist nicht erlaubt.');
  const seat = actor as SeatId;
  const events: GameEvent[] = [];

  if (move.type === 'placeFleet') {
    const fleets = state.fleets.map((f, s) => (s === seat ? move.ships.map((cells) => ({ cells: [...cells].sort((a, b) => a - b), sunk: false })) : f));
    const placed = state.placed.map((done, s) => done || s === seat);
    events.push({ type: 'placed', seat });
    const ready = placed.every(Boolean);
    if (ready) events.push({ type: 'battle' });
    return { state: { ...state, fleets, placed, phase: ready ? 'shoot' : 'place', turn: 0 }, events };
  }

  if (state.salvo) {
    const aim = [...state.aim, move.cell];
    const remaining = openCells({ ...state, aim }, seat).length;
    if (aim.length < salvoSize(state, seat) && remaining > 0) {
      events.push({ type: 'aimed', seat, cell: move.cell });
      return { state: { ...state, aim }, events };
    }
    const fired = fire(state, seat, aim, events);
    return { state: { ...fired.state, turn: opponentOf(seat) }, events };
  }

  const fired = fire(state, seat, [move.cell], events);
  return { state: { ...fired.state, turn: fired.hit && state.again ? seat : opponentOf(seat) }, events };
}

export function result(state: BattleshipState): Result | null {
  return state.winner === null ? null : { kind: 'win', winners: [state.winner] };
}

/** Die eigene Flotte ganz, von der fremden nur versenkte Schiffe. */
export function playerView(state: BattleshipState, seat: SeatId | 'spectator'): BattleshipState {
  return { ...state, fleets: state.fleets.map((fleet, owner) => (owner === seat ? fleet : fleet.filter((ship) => ship.sunk))), rng: [0, 0, 0, 0] };
}

/** Alle Lagen eines Schiffs dieser Länge, die kein gesperrtes Feld berühren. */
export function possiblePlacements(length: number, blocked: Set<number>): number[][] {
  const list: number[][] = [];
  for (let start = 0; start < CELLS; start++) {
    for (const vertical of length === 1 ? [false] : [false, true]) {
      const cells = shipCells(start, length, vertical);
      if (cells && cells.every((c) => !blocked.has(c))) list.push(cells);
    }
  }
  return list;
}

/** Was über das Meer von `target` bekannt ist, aus Sicht des Schützen. */
export function targetKnowledge(view: BattleshipState, target: SeatId) {
  const shooter = opponentOf(target);
  const sunkShips = (view.fleets[target] ?? []).filter((s) => s.sunk);
  const sunkCells = new Set(sunkShips.flatMap((s) => s.cells));
  const shots = view.shots[shooter] ?? [];
  const hits = shots.filter((s) => s.result !== 'water' && !sunkCells.has(s.cell)).map((s) => s.cell);
  // Gesperrt für weitere Schiffe: Wasser, versenkte Schiffe und (Berührverbot) ihr Rand.
  const blocked = new Set<number>([...shots.filter((s) => s.result === 'water').map((s) => s.cell), ...sunkCells]);
  if (view.noTouch) knownWater(view, target).forEach((c) => blocked.add(c));
  const remaining = [...FLEETS[view.fleetKind]];
  for (const ship of sunkShips) remaining.splice(remaining.indexOf(ship.cells.length), 1);
  return { sunkShips, hits, blocked, remaining, shots };
}

/**
 * Für Bots: eine gegnerische Flotte, die zu allem Bekannten passt – versenkte Schiffe bleiben,
 * die übrigen decken alle Treffer ab und meiden Wasser. Gelingt das nicht, wird die Bedingung
 * „alle Treffer“ aufgegeben.
 */
export function sampleHidden(view: BattleshipState, seat: SeatId, rng: Rng): BattleshipState {
  const target = opponentOf(seat);
  if (!view.placed[target]) return { ...view, rng: rng.state };
  const { sunkShips, hits, blocked, remaining } = targetKnowledge(view, target);
  for (let attempt = 0; attempt < 300; attempt++) {
    const taken = new Set(blocked);
    if (view.noTouch) for (const ship of sunkShips) ship.cells.forEach((c) => neighbors8(c).forEach((n) => taken.add(n)));
    const uncovered = new Set(hits);
    const ships: Ship[] = [];
    for (const length of remaining) {
      const options = possiblePlacements(length, taken);
      const covering = options.filter((cells) => cells.some((c) => uncovered.has(c)));
      const pool = covering.length > 0 && (attempt < 250 || rng.chance(0.5)) ? covering : options;
      if (pool.length === 0) break;
      const cells = rng.pick(pool);
      ships.push({ cells, sunk: false });
      for (const cell of cells) {
        uncovered.delete(cell);
        taken.add(cell);
        if (view.noTouch) neighbors8(cell).forEach((n) => taken.add(n));
      }
    }
    if (ships.length === remaining.length && (uncovered.size === 0 || attempt >= 250)) {
      return { ...view, fleets: view.fleets.map((f, s) => (s === target ? [...sunkShips, ...ships] : f)), rng: rng.state };
    }
  }
  // Notlösung: irgendeine gültige Flotte, damit der Bot weiterrechnen kann.
  const fleet = randomFleet(view.fleetKind, view.noTouch, rng).map((cells) => ({ cells, sunk: false }));
  return { ...view, fleets: view.fleets.map((f, s) => (s === target ? fleet : f)), rng: rng.state };
}
