import { stateFor, type BotDefinition, type Rng } from '@brett-und-blatt/engine';
import { boardMap, colorOf, kindOf, placements, shapeOf, type ColorShapeMove, type ColorShapeState, type Placed, type TileId } from './rules';

/** Wie gut ist ein Bänkchen für spätere Züge? Gruppen gleicher Farbe oder Form ohne Doppelte sind wertvoll. */
function leaveValue(hand: readonly TileId[]): number {
  let value = 0;
  const kinds = new Set<number>();
  for (const t of hand) {
    if (kinds.has(kindOf(t))) value -= 2;
    kinds.add(kindOf(t));
  }
  for (let i = 0; i < 6; i++) {
    const byColor = new Set(hand.filter((t) => colorOf(t) === i).map(shapeOf)).size;
    const byShape = new Set(hand.filter((t) => shapeOf(t) === i).map(colorOf)).size;
    value += Math.max(0, byColor - 1) + Math.max(0, byShape - 1);
  }
  return value;
}

/** Gefahr: Reihen mit fünf Steinen, die der Gegner zur Sechserreihe ergänzen könnte. */
function fiveLines(board: readonly Placed[], tiles: readonly Placed[]): number {
  const map = boardMap([...board, ...tiles]);
  let count = 0;
  const seen = new Set<string>();
  for (const p of tiles) {
    for (const [dx, dy] of [[1, 0], [0, 1]] as const) {
      let sx = p.x;
      let sy = p.y;
      while (map.has(`${sx - dx},${sy - dy}`)) {
        sx -= dx;
        sy -= dy;
      }
      const id = `${dx}:${sx},${sy}`;
      if (seen.has(id)) continue;
      seen.add(id);
      let len = 0;
      while (map.has(`${sx + dx * len},${sy + dy * len}`)) len++;
      if (len === 5) count++;
    }
  }
  return count;
}

function best<T>(items: T[], score: (item: T) => number, rng: Rng): T {
  let top = items[0] as T;
  let topScore = -Infinity;
  for (const item of items) {
    const s = score(item) + rng.next() * 0.01;
    if (s > topScore) {
      top = item;
      topScore = s;
    }
  }
  return top;
}

/**
 * Der Bot für Farbe & Form.
 * - leicht: oft ein zufälliger Legezug, sonst der mit den meisten Punkten
 * - mittel: gierig – die meisten Punkte
 * - schwer: Punkte plus ein gutes Bänkchen für später, vermeidet Fünferreihen für den Gegner
 *   und tauscht ein schlechtes Bänkchen, wenn kein Zug viel bringt
 */
export const colorShapeBot: BotDefinition<ColorShapeState, ColorShapeMove> = {
  id: 'color-and-shape',
  name: 'Legebot',
  levels: ['easy', 'medium', 'hard'],
  chooseMove(ctx) {
    const state = stateFor(ctx);
    const hand = (state.hands[ctx.seat] ?? []).filter((t): t is TileId => t !== null);
    const options = placements(state, hand);
    if (options.length === 0) {
      const swaps = ctx.module.legalMoves(state, ctx.seat).filter((m) => m.type === 'swap');
      if (swaps.length === 0) return { type: 'pass' };
      // Das ganze Bänkchen tauschen, außer den besten Teil zu behalten lohnt sich.
      return best(swaps, (m) => leaveValue(hand.filter((t) => !(m as { tiles: TileId[] }).tiles.includes(t))) + m.tiles.length * 0.1, ctx.rng);
    }
    if (ctx.level === 'easy' && ctx.rng.chance(0.4)) return { type: 'place', tiles: ctx.rng.pick(options).tiles };
    if (ctx.level !== 'hard') return { type: 'place', tiles: best(options, (o) => o.points, ctx.rng).tiles };

    const bagLeft = state.bag.length;
    const scored = options.map((o) => {
      const rest = hand.filter((t) => !o.tiles.some((p) => p.tile === t));
      // Gegen Ende zählt der Rest kaum noch, dafür das schnelle Leeren.
      const leave = bagLeft > 6 ? leaveValue(rest) * 0.8 : rest.length === 0 && bagLeft === 0 ? 6 : 0;
      return { o, value: o.points + leave - fiveLines(state.board, o.tiles) * 5 };
    });
    const top = best(scored, (s) => s.value, ctx.rng);
    if (top.o.points <= 2 && bagLeft >= 6 && leaveValue(hand) < 2) {
      const swaps = ctx.module.legalMoves(state, ctx.seat).filter((m): m is Extract<ColorShapeMove, { type: 'swap' }> => m.type === 'swap' && m.tiles.length >= 4);
      if (swaps.length > 0) return best(swaps, (m) => leaveValue(hand.filter((t) => !m.tiles.includes(t))), ctx.rng);
    }
    return { type: 'place', tiles: top.o.tiles };
  },
};
