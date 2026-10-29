import type { BotDefinition, BotLevel, Rng, SeatId } from '@brett-und-blatt/engine';
import { hiddenSlots, legalMoves, unknownValues, type LowFlightMove, type LowFlightState, type LowFlightView } from './rules';

type Grid = LowFlightView['players'][number]['grid'];

/** Erwarteter Wert einer verdeckten Karte aus den Karten, die noch niemand gesehen hat. */
function expected(view: LowFlightView): number {
  const pool = unknownValues(view);
  return pool.length ? pool.reduce((a, b) => a + b, 0) / pool.length : 0;
}

function columnOf(view: LowFlightView, slot: number): number[] {
  const col = slot % view.cols;
  return Array.from({ length: view.rows }, (_, r) => r * view.cols + col);
}

/** Geschätzte Summe eines Rasters: offene Karten genau, verdeckte mit dem Erwartungswert. */
function estimate(grid: Grid, e: number): number {
  return grid.reduce((s, c) => s + (c ? (c.open ? c.value! : e) : 0), 0);
}

/** Um wie viel sinkt die geschätzte Summe, wenn Karte `card` auf `slot` kommt (mit Spalte abräumen)? */
function benefit(view: LowFlightView, grid: Grid, slot: number, card: number, e: number, level: BotLevel): number {
  const col = columnOf(view, slot);
  // Verdeckte Karten etwas günstiger ansetzen: Hohe offene Karten zu ersetzen lohnt mehr (in Probepartien gemessen).
  const value = (i: number) => (grid[i] ? (grid[i]!.open ? grid[i]!.value! : e - 1.5) : 0);
  const before = col.reduce((s, i) => s + value(i), 0);
  const others = col.filter((i) => i !== slot);
  const completes = others.every((i) => grid[i]?.open && grid[i]!.value === card);
  const after = completes ? 0 : before - value(slot) + card;
  let gain = before - after;
  // Aufbau: gleiche offene Karten in der Spalte sind ein Schritt zum Abräumen.
  if (level !== 'easy' && !completes && card > 0) {
    const same = others.filter((i) => grid[i]?.open && grid[i]!.value === card).length;
    const spoils = grid[slot]?.open && others.some((i) => grid[i]?.open && grid[i]!.value === grid[slot]!.value);
    gain += same * Math.min(card, 5) * 0.4 - (spoils ? Math.min(grid[slot]!.value!, 5) * 0.4 : 0);
  }
  return gain;
}

/** Würde dieser Zug die Runde beenden, obwohl die eigene Summe nicht klar die niedrigste ist? */
function riskyEnd(view: LowFlightView, seat: SeatId, move: LowFlightMove, card: number, e: number): number {
  if (view.ender !== null || (move.type !== 'swap' && move.type !== 'flip')) return 0;
  const grid = view.players[seat]!.grid;
  const hidden = hiddenSlots(grid);
  if (hidden.length !== 1 || hidden[0] !== move.slot) return 0;
  const mine = estimate(grid, e) - e + (move.type === 'swap' ? card : e);
  const others = view.players.flatMap((p, s) => (s === seat ? [] : [estimate(p.grid, e)]));
  const margin = Math.min(...others) - mine;
  // Mit Verdopplung droht die doppelte Summe – dann lieber weiterspielen.
  if (margin > 3) return 2;
  return view.options.doubling ? -Math.max(6, mine) : -4;
}

function scoreMove(view: LowFlightView, seat: SeatId, move: LowFlightMove, card: number, e: number, level: BotLevel): number {
  const grid = view.players[seat]!.grid;
  let score = move.type === 'swap' ? benefit(view, grid, move.slot, card, e, level) : move.type === 'flip' ? 0.4 : 0;
  if (level === 'hard') score += riskyEnd(view, seat, move, card, e);
  return score;
}

function bestPlacement(view: LowFlightView, seat: SeatId, moves: LowFlightMove[], card: number, e: number, level: BotLevel, rng: Rng) {
  let best: LowFlightMove[] = [];
  let bestScore = -Infinity;
  for (const m of moves) {
    const s = scoreMove(view, seat, m, card, e, level);
    if (s > bestScore + 1e-9) {
      best = [m];
      bestScore = s;
    } else if (Math.abs(s - bestScore) <= 1e-9) best.push(m);
  }
  return { move: rng.pick(best), score: bestScore };
}

/** Leicht: einfache Faustregeln ohne Rechnen. */
function easyMove(view: LowFlightView, seat: SeatId, moves: LowFlightMove[], rng: Rng): LowFlightMove {
  const grid = view.players[seat]!.grid;
  const top = view.discard[view.discard.length - 1]!;
  if (!view.drawn) return top <= 2 ? { type: 'takeDiscard' } : { type: 'draw' };
  const card = view.drawn.value;
  const highest = grid.reduce<number | null>((b, c, i) => (c?.open && (b === null || c.value! > grid[b]!.value!) ? i : b), null);
  if (highest !== null && grid[highest]!.value! > card) return { type: 'swap', slot: highest };
  const hidden = moves.filter((m) => m.type === (view.drawn!.from === 'deck' && card > 4 ? 'flip' : 'swap') && grid[(m as { slot: number }).slot]?.open === false);
  return hidden.length ? rng.pick(hidden) : rng.pick(moves);
}

export const lowFlightBot: BotDefinition<LowFlightState, LowFlightMove, LowFlightView> = {
  id: 'wolkenspringer',
  name: 'Wolkenspringer',
  levels: ['easy', 'medium', 'hard'],
  chooseMove({ view, seat, level, rng }) {
    const moves = legalMoves(view as unknown as LowFlightState, seat);
    if (view.phase === 'roundEnd') return { type: 'ready' };
    if (view.phase === 'reveal') {
      if (level === 'easy') return rng.pick(moves);
      // In verschiedenen Spalten aufdecken: mehr Möglichkeiten zum Abräumen.
      const grid = view.players[seat]!.grid;
      const fresh = moves.filter((m) => m.type === 'reveal' && columnOf(view, m.slot).every((i) => !grid[i]?.open));
      return rng.pick(fresh.length ? fresh : moves);
    }
    if (level === 'easy') return easyMove(view, seat, moves, rng);
    const e = expected(view);
    if (!view.drawn) {
      // Ablagekarte nehmen, wenn sie deutlich hilft – sonst lieber das Glück am Stapel.
      const top = view.discard[view.discard.length - 1]!;
      const placements = view.players[seat]!.grid.flatMap((c, slot) => (c ? [{ type: 'swap' as const, slot }] : []));
      const { score } = bestPlacement(view, seat, placements, top, e, level, rng);
      return score >= 2.5 ? { type: 'takeDiscard' } : { type: 'draw' };
    }
    return bestPlacement(view, seat, moves, view.drawn.value, e, level, rng).move;
  },
};
