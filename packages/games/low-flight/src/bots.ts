import type { BotDefinition, BotLevel, Rng, SeatId } from '@brett-und-blatt/engine';
import { hiddenSlots, legalMoves, unknownValues, type LowFlightMove, type LowFlightState, type LowFlightView } from './rules';

type Grid = LowFlightView['players'][number]['grid'];

/** Erwarteter Wert einer verdeckten Karte aus den Karten, die noch niemand gesehen hat. */
function expected(view: LowFlightView): number {
  const pool = unknownValues(view);
  return pool.length ? pool.reduce((a, b) => a + b, 0) / pool.length : 0;
}

function linesForSlot(view: LowFlightView, slot: number): number[][] {
  const { rows, cols } = view;
  const col = slot % cols;
  const r = Math.floor(slot / cols);
  const lines: number[][] = [];
  // Spalte
  lines.push(Array.from({ length: rows }, (_, row) => row * cols + col));
  // Zeile
  if (view.options.rows) {
    lines.push(Array.from({ length: cols }, (_, c) => r * cols + c));
  }
  // Diagonale(n)
  if (view.options.diagonals) {
    for (let startCol = 0; startCol <= cols - rows; startCol++) {
      const downRight = Array.from({ length: rows }, (_, row) => row * cols + (startCol + row));
      if (downRight.includes(slot)) lines.push(downRight);
      const downLeft = Array.from({ length: rows }, (_, row) => row * cols + (cols - 1 - startCol - row));
      if (downLeft.includes(slot)) lines.push(downLeft);
    }
  }
  return lines;
}

/** Geschätzte Summe eines Rasters: offene Karten genau, verdeckte mit dem Erwartungswert. */
function estimate(grid: Grid, e: number): number {
  return grid.reduce((s, c) => s + (c ? (c.open ? c.value! : e) : 0), 0);
}

/** Um wie viel sinkt die geschätzte Summe, wenn Karte `card` auf `slot` kommt (mit Linien abräumen)? */
function benefit(view: LowFlightView, grid: Grid, slot: number, card: number, e: number, level: BotLevel): number {
  const lines = linesForSlot(view, slot);
  const value = (i: number) => {
    if (!grid[i]) return 0;
    if (grid[i]!.open) return grid[i]!.value!;
    const known = view.knownCards?.find((k) => k.targetSeat === (view.turn as number) && k.slot === i);
    return known ? known.value : e - 1.5;
  };
  let bestLineGain = -Infinity;
  for (const line of lines) {
    const before = line.reduce((s, i) => s + value(i), 0);
    const others = line.filter((i) => i !== slot);
    const completes = others.every((i) => grid[i]?.open && grid[i]!.value === card);
    const after = completes ? 0 : before - value(slot) + card;
    let gain = before - after;
    // Aufbau: gleiche offene Karten in der Linie sind ein Schritt zum Abräumen.
    if (level !== 'easy' && !completes && card > 0) {
      const same = others.filter((i) => grid[i]?.open && grid[i]!.value === card).length;
      const spoils = grid[slot]?.open && others.some((i) => grid[i]?.open && grid[i]!.value === grid[slot]!.value);
      gain += same * Math.min(card, 5) * 0.4 - (spoils ? Math.min(grid[slot]!.value!, 5) * 0.4 : 0);
    }
    if (gain > bestLineGain) bestLineGain = gain;
  }
  return bestLineGain === -Infinity ? 0 : bestLineGain;
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
  let score = 0;
  if (move.type === 'swap') {
    score = benefit(view, grid, move.slot, card, e, level);
  } else if (move.type === 'flip') {
    score = 0.4;
  } else if (move.type === 'actionExtraTurn') {
    score = 3.0;
  } else if (move.type === 'actionDoubleFlip') {
    score = 1.0;
  } else if (move.type === 'actionPeek') {
    const isOwn = move.targetSeat === seat;
    const isAlreadyKnown = view.knownCards?.some((k) => k.targetSeat === move.targetSeat && k.slot === move.slot);
    score = isAlreadyKnown ? 0.1 : isOwn ? 1.5 : 0.8;
  } else if (move.type === 'actionSwap') {
    const myCell = grid[move.mySlot];
    const oppCell = view.players[move.targetSeat]!.grid[move.targetSlot];
    if (myCell && oppCell) {
      const myVal = myCell.open ? myCell.value! : e;
      const oppVal = oppCell.open ? oppCell.value! : e;
      score = myVal - oppVal;
    }
  }
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
  if (view.drawn.from === 'deck' && view.options.actionCards) {
    const action = moves.find((m) => m.type.startsWith('action'));
    if (action && rng.chance(0.6)) return action;
  }
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
      // In verschiedenen Spalten/Linien aufdecken: mehr Möglichkeiten zum Abräumen.
      const grid = view.players[seat]!.grid;
      const fresh = moves.filter((m) => m.type === 'reveal' && linesForSlot(view, m.slot).every((line) => line.every((i) => !grid[i]?.open)));
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
