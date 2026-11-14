import { stateFor, type BotDefinition, type Rng } from '@brett-und-blatt/engine';
import { boardMap, colorOf, COPIES, kindOf, placements, shapeOf, TILE_COUNT, type BoardMap, type ColorShapeMove, type ColorShapeState, type Placed, type TileId } from './rules';

const KINDS = TILE_COUNT / COPIES;

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

/** Wahrscheinlichkeit, dass unter `handSize` von `total` unbekannten Steinen mindestens eine der `copies` Kopien ist. */
function probHasKind(copies: number, handSize: number, total: number): number {
  if (copies <= 0 || handSize <= 0 || total <= 0) return 0;
  if (handSize > total - copies) return 1;
  let probNone = 1;
  for (let i = 0; i < copies; i++) {
    probNone *= (total - handSize - i) / (total - i);
  }
  return 1 - probNone;
}

/** Sammelt alle Steinarten in einer Reihe ab (sx, sy) in Richtung (dx, dy). */
function lineKinds(map: BoardMap, x: number, y: number, dx: number, dy: number): { sx: number; sy: number; kinds: number[] } {
  let sx = x;
  let sy = y;
  while (map.has(`${sx - dx},${sy - dy}`)) {
    sx -= dx;
    sy -= dy;
  }
  const kinds: number[] = [];
  let cx = sx;
  let cy = sy;
  while (map.has(`${cx},${cy}`)) {
    kinds.push(kindOf(map.get(`${cx},${cy}`)!));
    cx += dx;
    cy += dy;
  }
  return { sx, sy, kinds };
}

/** Prüft, ob die Steinart `kind` entlang einer Richtung zu den Nachbarn auf (x, y) passt (ohne Doppelte, max 6). */
function fitsAxis(map: BoardMap, x: number, y: number, dx: number, dy: number, kind: number): number {
  const kinds: number[] = [];
  for (const dir of [-1, 1]) {
    let cx = x + dx * dir;
    let cy = y + dy * dir;
    while (map.has(`${cx},${cy}`)) {
      kinds.push(kindOf(map.get(`${cx},${cy}`)!));
      cx += dx * dir;
      cy += dy * dir;
    }
  }
  if (kinds.length === 0) return 0;
  if (kinds.length >= 6 || kinds.includes(kind)) return -1;
  const c = Math.floor(kind / 6);
  const s = kind % 6;
  const sameColor = kinds.every((k) => Math.floor(k / 6) === c);
  const sameShape = kinds.every((k) => k % 6 === s);
  return sameColor || sameShape ? kinds.length : -1;
}

/** Prüft, ob eine Steinart `kind` legal auf das freie Feld (x, y) gelegt werden darf, und gibt die Punkte zurück (sonst -1). */
function pointsAt(map: BoardMap, x: number, y: number, kind: number): number {
  if (map.has(`${x},${y}`)) return -1;
  const h = fitsAxis(map, x, y, 1, 0, kind);
  if (h < 0) return -1;
  const v = fitsAxis(map, x, y, 0, 1, kind);
  if (v < 0) return -1;
  if (h === 0 && v === 0) return -1;
  let pts = 0;
  if (h > 0) pts += h + 1 + (h === 5 ? 6 : 0);
  if (v > 0) pts += v + 1 + (v === 5 ? 6 : 0);
  return pts;
}

/** Bestimmt die fehlenden Steinarten (0..35) einer Reihe aus 2–5 Steinen. */
function missingKindsForLine(kinds: readonly number[]): number[] {
  if (kinds.length < 2 || kinds.length >= 6) return [];
  const first = kinds[0]!;
  const fc = Math.floor(first / 6);
  const fs = first % 6;
  const sameColor = kinds.every((k) => Math.floor(k / 6) === fc);
  const missing: number[] = [];
  if (sameColor) {
    const used = new Set(kinds.map((k) => k % 6));
    for (let s = 0; s < 6; s++) if (!used.has(s)) missing.push(fc * 6 + s);
  } else {
    const used = new Set(kinds.map((k) => Math.floor(k / 6)));
    for (let c = 0; c < 6; c++) if (!used.has(c)) missing.push(c * 6 + fs);
  }
  return missing;
}

/**
 * Bewertet die Gefahr gegnerischer Anschlüsse nach einem Zug `tiles`:
 * - 5er-Reihen (Qwirkle-Vorlage): nach Wahrscheinlichkeit gewichtet, ob der fehlende 6. Stein noch im Spiel ist
 * - 4er-Reihen: Risiko, dass ein Gegner mit zwei Steinen abschließt
 * - Kreuzungspunkte: freie Nachbarfelder an den gelegten Steinen, an denen zwei Reihen zusammenlaufen
 */
function opponentThreat(
  board: readonly Placed[],
  tiles: readonly Placed[],
  unseen: readonly number[],
  totalUnseen: number,
  effectiveOppHand: number,
): number {
  if (totalUnseen <= 0 || effectiveOppHand <= 0) return 0;
  const map = boardMap(board);
  for (const p of tiles) map.set(`${p.x},${p.y}`, p.tile);

  let threat = 0;
  const seenLines = new Set<string>();
  const seenCross = new Set<string>();

  for (const p of tiles) {
    for (const [dx, dy] of [[1, 0], [0, 1]] as const) {
      const { sx, sy, kinds } = lineKinds(map, p.x, p.y, dx, dy);
      const id = `${dx}:${sx},${sy}`;
      if (!seenLines.has(id)) {
        seenLines.add(id);
        if (kinds.length === 5) {
          const [missing] = missingKindsForLine(kinds);
          if (missing !== undefined && unseen[missing]! > 0) {
            const pLeft = pointsAt(map, sx - dx, sy - dy, missing);
            const pRight = pointsAt(map, sx + 5 * dx, sy + 5 * dy, missing);
            const bestPts = Math.max(pLeft, pRight);
            if (bestPts > 0) {
              const prob = probHasKind(unseen[missing]!, effectiveOppHand, totalUnseen);
              threat += prob * bestPts * 0.85;
            }
          }
        } else if (kinds.length === 4) {
          const missing = missingKindsForLine(kinds);
          if (missing.length === 2) {
            const [m1, m2] = missing as [number, number];
            const c1 = unseen[m1]!;
            const c2 = unseen[m2]!;
            if (c1 > 0 && c2 > 0) {
              const openLeft = !map.has(`${sx - dx},${sy - dy}`) && !map.has(`${sx - 2 * dx},${sy - 2 * dy}`);
              const openRight = !map.has(`${sx + 4 * dx},${sy + 4 * dy}`) && !map.has(`${sx + 5 * dx},${sy + 5 * dy}`);
              const openBothEnds = !map.has(`${sx - dx},${sy - dy}`) && !map.has(`${sx + 4 * dx},${sy + 4 * dy}`);
              if (openLeft || openRight || openBothEnds) {
                const p1 = probHasKind(c1, effectiveOppHand, totalUnseen);
                const p2 = probHasKind(c2, Math.max(0, effectiveOppHand - 1), Math.max(1, totalUnseen - 1));
                threat += p1 * p2 * 12 * 0.7;
              }
            }
          }
        }
      }
    }

    // Kreuzungspunkte an den vier direkten Nachbarfeldern prüfen.
    for (const [nx, ny] of [[p.x + 1, p.y], [p.x - 1, p.y], [p.x, p.y + 1], [p.x, p.y - 1]] as const) {
      const ck = `${nx},${ny}`;
      if (seenCross.has(ck) || map.has(ck)) continue;
      seenCross.add(ck);
      const hasH = map.has(`${nx - 1},${ny}`) || map.has(`${nx + 1},${ny}`);
      const hasV = map.has(`${nx},${ny - 1}`) || map.has(`${nx},${ny + 1}`);
      if (!hasH || !hasV) continue;

      let matchingCopies = 0;
      let maxPts = 0;
      for (let k = 0; k < KINDS; k++) {
        if (unseen[k]! <= 0) continue;
        const pts = pointsAt(map, nx, ny, k);
        // Fälle mit 5er-Reihe (>= 12) sind oben schon voll bewertet; hier nur echte Kreuzungspunkte ab 5 Punkten.
        if (pts >= 5 && pts < 12) {
          matchingCopies += unseen[k]!;
          if (pts > maxPts) maxPts = pts;
        }
      }
      if (matchingCopies > 0) {
        const prob = probHasKind(Math.min(matchingCopies, totalUnseen), effectiveOppHand, totalUnseen);
        threat += prob * maxPts * 0.45;
      }
    }
  }

  return threat;
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
 * - schwer: Punkte plus ein gutes Bänkchen für später, bewertet gegnerische Anschlussgefahren
 *   (5er-, 4er-Reihen und Kreuzungspunkte anhand noch unbekannter Steine) und tauscht ein schlechtes Bänkchen
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

    const unseen = Array(KINDS).fill(COPIES) as number[];
    for (const p of state.board) unseen[kindOf(p.tile)]!--;
    for (const t of hand) unseen[kindOf(t)]!--;
    const totalUnseen = unseen.reduce((a, b) => a + b, 0);

    const nextSeat = (ctx.seat + 1) % state.seats;
    const nextOppHand = state.hands[nextSeat]?.length ?? 0;
    const otherOppHand = state.hands.reduce((sum, h, i) => (i === ctx.seat || i === nextSeat ? sum : sum + h.length), 0);
    const effectiveOppHand = Math.min(totalUnseen, Math.round(nextOppHand + otherOppHand * 0.5));

    const bagLeft = state.bag.length;
    const scored = options.map((o) => {
      const rest = hand.filter((t) => !o.tiles.some((p) => p.tile === t));
      // Gegen Ende zählt der Rest kaum noch, dafür das schnelle Leeren.
      const leave = bagLeft > 6 ? leaveValue(rest) * 0.8 : rest.length === 0 && bagLeft === 0 ? 6 : 0;
      const threat = opponentThreat(state.board, o.tiles, unseen, totalUnseen, effectiveOppHand);
      return { o, value: o.points + leave - threat };
    });
    const top = best(scored, (s) => s.value, ctx.rng);
    if (top.o.points <= 2 && bagLeft >= 6 && leaveValue(hand) < 2) {
      const swaps = ctx.module.legalMoves(state, ctx.seat).filter((m): m is Extract<ColorShapeMove, { type: 'swap' }> => m.type === 'swap' && m.tiles.length >= 4);
      if (swaps.length > 0) return best(swaps, (m) => leaveValue(hand.filter((t) => !m.tiles.includes(t))), ctx.rng);
    }
    return { type: 'place', tiles: top.o.tiles };
  },
};
