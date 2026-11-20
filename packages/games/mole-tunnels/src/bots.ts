import type { BotDefinition, BotLevel, Rng, SeatId } from '@brett-und-blatt/engine';
import { isPushForbidden, legalMoves, pushTile, reachable, tileAt, type MoleMove, type MoleState, type Pos } from './rules';

/**
 * Bot „Wühlmaus“. Der Spielstand ist offen, deshalb genügt Aufzählen: Ein Zug hat höchstens
 * 48 Schübe und 49 Laufziele. Jeder Aufruf entscheidet nur einen Schritt; im Schritt „Schieben“
 * rechnet der Bot den anschließenden Lauf mit derselben Bewertung vor.
 *
 * - leicht: zufälliger Schub, danach zur Hälfte zufälliger Lauf, sonst zur nächsten Rübe,
 * - mittel: wählt den Schub, nach dem sich am meisten ernten oder annähern lässt, und wertet
 *   Schübe ab, nach denen ein Gegner von seinem Platz aus ernten könnte,
 * - schwer: prüft die besten Schübe zusätzlich gegen jeden Gegenschub der Gegner.
 */

type PushMove = Extract<MoleMove, { type: 'push' }>;

const manhattan = (a: Pos, b: Pos) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]);

/** Felder mit erntbarer Rübe (unter dem Maulwurf lässt sich nicht ernten). */
function turnipSpots(state: Pick<MoleState, 'size' | 'cells'>): Pos[] {
  const spots: Pos[] = [];
  state.cells.forEach((tile, index) => {
    if (tile.turnip && !tile.mole) spots.push([Math.floor(index / state.size), index % state.size]);
  });
  return spots;
}

/** Abstand (Manhattan) zur nächsten Rübe; die Rübe auf `from` selbst zählt nicht mit. */
function nearestTurnip(spots: Pos[], from: Pos): number {
  let best = Infinity;
  for (const spot of spots) {
    if (spot[0] === from[0] && spot[1] === from[1]) continue;
    best = Math.min(best, manhattan(spot, from));
  }
  return best === Infinity ? 0 : best;
}

interface Walk {
  to: Pos;
  harvest: boolean;
  /** Abstand des Ziels zur nächsten Rübe (nach einer Ernte: zur nächsten übrigen). */
  dist: number;
}

/** Bester Lauf des Platzes von seiner Stelle aus: Ernte vor Annäherung. */
function bestWalk(state: MoleState, seat: SeatId, rng: Rng): Walk {
  const reach = reachable(state, state.hares[seat]!);
  const spots = turnipSpots(state);
  let best: Walk | null = null;
  let bestScore = -Infinity;
  for (const to of reach) {
    const harvest = spots.some((s) => s[0] === to[0] && s[1] === to[1]);
    const dist = nearestTurnip(spots, to);
    const score = (harvest ? 1000 : 0) - dist + rng.next() * 0.5;
    if (score > bestScore) {
      bestScore = score;
      best = { to, harvest, dist };
    }
  }
  return best!;
}

/** Spielstand nach dem Schub mit anschließendem Lauf (ohne Nachwachsen: der Zufall fehlt in der Sicht). */
function afterPush(state: MoleState, move: PushMove, seat: SeatId, rng: Rng): { state: MoleState; walk: Walk } {
  const pushed = pushTile(state, move.side, move.index, move.rot);
  const pushedState: MoleState = {
    ...state,
    cells: pushed.cells,
    spare: pushed.spare,
    hares: pushed.hares,
    lastPush: { side: move.side, index: move.index },
    phase: 'walk',
  };
  const walk = bestWalk(pushedState, seat, rng);
  const hares = pushedState.hares.map((pos, i): Pos => (i === seat ? walk.to : pos));
  let cells = pushedState.cells;
  const harvested = [...state.harvested];
  if (walk.harvest) {
    const target = tileAt(pushedState, walk.to[0], walk.to[1]);
    cells = cells.map((tile) => (tile.id === target.id ? { ...tile, turnip: false } : tile));
    harvested[seat] = harvested[seat]! + 1;
  }
  return { state: { ...pushedState, cells, hares, harvested }, walk };
}

function canHarvest(state: MoleState, seat: SeatId): boolean {
  const spots = turnipSpots(state);
  return reachable(state, state.hares[seat]!).some(([r, c]) => spots.some((s) => s[0] === r && s[1] === c));
}

/** Die Gegner in Zugfolge nach dem eigenen Platz. */
function opponentsOf(state: MoleState, seat: SeatId): SeatId[] {
  const list: SeatId[] = [];
  for (let i = 1; i < state.hares.length; i++) list.push((seat + i) % state.hares.length);
  return list;
}

/** Wie viele Gegner können ohne eigenen Schub von ihrem Platz aus ernten? */
function shallowThreat(state: MoleState, seat: SeatId): number {
  return opponentsOf(state, seat).filter((opp) => canHarvest(state, opp)).length;
}

/**
 * Gefahr durch einen Gegner mit Vorausschau: Anteil seiner möglichen Schübe, nach denen er ernten
 * kann (0 = nie, 1 = nach jedem Schub). Er darf den eigenen Schub nicht sofort zurücknehmen.
 */
function deepThreat(state: MoleState, mine: PushMove, opp: SeatId): number {
  const probe: MoleState = { ...state, turn: opp, phase: 'push', lastPush: { side: mine.side, index: mine.index } };
  const pushes = legalMoves(probe, opp).filter((m): m is PushMove => m.type === 'push' && !isPushForbidden(probe, m.side, m.index));
  if (pushes.length === 0) return 0;
  let hits = 0;
  for (const move of pushes) {
    const pushed = pushTile(probe, move.side, move.index, move.rot);
    if (canHarvest({ ...probe, cells: pushed.cells, spare: pushed.spare, hares: pushed.hares }, opp)) hits++;
  }
  return hits / pushes.length;
}

const HARVEST = 1000;
const WIN = 100_000;
/** Wie viele Schübe die Vorausschau der Gegner prüft. */
const DEEP_CANDIDATES = 8;

function choosePush(view: MoleState, seat: SeatId, level: BotLevel, rng: Rng): MoleMove {
  const pushes = legalMoves(view, seat).filter((m): m is PushMove => m.type === 'push');
  if (level === 'easy') return rng.pick(pushes);

  const scored = pushes.map((move) => {
    const { state, walk } = afterPush(view, move, seat, rng);
    const won = state.harvested[seat]! >= view.options.goal;
    let score = -walk.dist * 10 + rng.next();
    if (walk.harvest) score += HARVEST;
    if (won) score += WIN;
    // Gegner, die danach sofort ernten könnten, kosten Punkte (weniger, wenn man selbst erntet).
    else score -= shallowThreat(state, seat) * (walk.harvest ? 60 : 150);
    return { move, score, state, won };
  });
  scored.sort((a, b) => b.score - a.score);
  if (level === 'medium') return scored[0]!.move;

  // Schwer: die besten Kandidaten gegen jeden Gegenschub der Gegner prüfen.
  let best = scored[0]!;
  let bestScore = -Infinity;
  for (const candidate of scored.slice(0, DEEP_CANDIDATES)) {
    let score = candidate.score;
    if (!candidate.won) {
      for (const opp of opponentsOf(view, seat)) {
        const share = deepThreat(candidate.state, candidate.move, opp);
        // Wer kurz vor dem Sieg steht, wiegt schwerer.
        const urgency = candidate.state.harvested[opp]! + 1 >= view.options.goal ? 3 : 1;
        score -= (share > 0 ? 120 : 0) * urgency + share * 120 * urgency;
      }
    }
    if (score > bestScore) {
      bestScore = score;
      best = candidate;
    }
  }
  return best.move;
}

function chooseWalk(view: MoleState, seat: SeatId, level: BotLevel, rng: Rng): MoleMove {
  if (level === 'easy' && rng.next() < 0.5) return rng.pick(legalMoves(view, seat));
  return { type: 'walk', to: bestWalk(view, seat, rng).to };
}

export const moleBot: BotDefinition<MoleState, MoleMove> = {
  id: 'mole-tunnels',
  name: 'Wühlmaus',
  levels: ['easy', 'medium', 'hard'],
  chooseMove({ view, seat, level, rng }) {
    return view.phase === 'push' ? choosePush(view, seat, level, rng) : chooseWalk(view, seat, level, rng);
  },
};
