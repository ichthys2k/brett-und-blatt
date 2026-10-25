import type { BotDefinition, BotLevel, Rng, SeatId } from '@brett-und-blatt/engine';
import {
  SIZE,
  colOf,
  neighbors4,
  neighbors8,
  openCells,
  opponentOf,
  possiblePlacements,
  randomFleet,
  rowOf,
  targetKnowledge,
  type BattleshipMove,
  type BattleshipState,
} from './rules';

/** Wie viele Felder einer Aufstellung am Rand liegen – typische Muster, die der schwere Bot meidet. */
function edgeCells(ships: number[][]): number {
  return ships.flat().filter((c) => rowOf(c) === 0 || rowOf(c) === SIZE - 1 || colOf(c) === 0 || colOf(c) === SIZE - 1).length;
}

/** Wie ungleich die Schiffe auf die vier Viertel verteilt sind. */
function clumping(ships: number[][]): number {
  const quarters = [0, 0, 0, 0];
  for (const cell of ships.flat()) quarters[(rowOf(cell) < SIZE / 2 ? 0 : 2) + (colOf(cell) < SIZE / 2 ? 0 : 1)]!++;
  return Math.max(...quarters) - Math.min(...quarters);
}

function placeFleet(view: BattleshipState, rng: Rng, level: BotLevel): BattleshipMove {
  if (level !== 'hard') return { type: 'placeFleet', ships: randomFleet(view.fleetKind, view.noTouch, rng) };
  // Mehrere Aufstellungen würfeln und eine gut gestreute nehmen – zufällig unter den besten.
  const candidates = Array.from({ length: 16 }, () => randomFleet(view.fleetKind, view.noTouch, rng));
  const scored = candidates.map((ships) => ({ ships, score: edgeCells(ships) + clumping(ships) * 0.7 + rng.next() * 2 })).sort((a, b) => a.score - b.score);
  return { type: 'placeFleet', ships: scored[rng.int(4)]!.ships };
}

/** Wahrscheinlichkeitskarte: Wie viele mögliche Lagen der übrigen Schiffe decken jedes Feld ab? */
export function probabilityMap(view: BattleshipState, seat: SeatId): number[] {
  const target = opponentOf(seat);
  const { hits, blocked, remaining } = targetKnowledge(view, target);
  const hitSet = new Set(hits);
  const counts = new Array<number>(SIZE * SIZE).fill(0);
  for (const length of new Set(remaining)) {
    const copies = remaining.filter((l) => l === length).length;
    for (const cells of possiblePlacements(length, blocked)) {
      const covered = cells.filter((c) => hitSet.has(c)).length;
      // Berührverbot: Ein Schiff neben einem Treffer, den es nicht selbst enthält, ist unmöglich.
      if (view.noTouch && hits.some((h) => !cells.includes(h) && neighbors8(h).some((n) => cells.includes(n)))) continue;
      // Gibt es offene Treffer, zählen vor allem Lagen, die sie fortsetzen.
      const weight = hits.length > 0 ? (covered > 0 ? 1 + covered * 40 : 0.02) : 1;
      for (const cell of cells) counts[cell]! += weight * copies;
    }
  }
  return counts;
}

/** Jagen und Zielen: nach Treffern der Linie folgen, sonst Schachbrettmuster. */
function huntAndTarget(view: BattleshipState, seat: SeatId, free: Set<number>, rng: Rng): number {
  const { hits, remaining } = targetKnowledge(view, opponentOf(seat));
  if (hits.length > 0) {
    // Liegen zwei Treffer in einer Linie, werden ihre Enden verlängert.
    const lines: number[] = [];
    for (const hit of hits) {
      for (const step of [1, SIZE]) {
        if (!hits.includes(hit + step) || (step === 1 && colOf(hit) === SIZE - 1)) continue;
        let a = hit;
        while (hits.includes(a - step) && !(step === 1 && colOf(a) === 0)) a -= step;
        let b = hit + step;
        while (hits.includes(b + step) && !(step === 1 && colOf(b) === SIZE - 1)) b += step;
        if (!(step === 1 && colOf(a) === 0)) lines.push(a - step);
        if (!(step === 1 && colOf(b) === SIZE - 1)) lines.push(b + step);
      }
    }
    const lineTargets = lines.filter((c) => free.has(c));
    if (lineTargets.length > 0) return rng.pick(lineTargets);
    const around = hits.flatMap(neighbors4).filter((c) => free.has(c));
    if (around.length > 0) return rng.pick(around);
  }
  const smallest = Math.min(...remaining);
  const parity = rng.int(smallest);
  const pattern = [...free].filter((c) => (rowOf(c) + colOf(c)) % smallest === parity);
  return rng.pick(pattern.length > 0 ? pattern : [...free]);
}

function shoot(view: BattleshipState, seat: SeatId, rng: Rng, level: BotLevel): BattleshipMove {
  const free = new Set(openCells(view, seat));
  // Auch ohne Komfort-Markierung weiß der Bot, wo nach dem Berührverbot nur Wasser sein kann.
  const { blocked, hits } = targetKnowledge(view, opponentOf(seat));
  const sensible = [...free].filter((c) => !blocked.has(c));
  const options = new Set(sensible.length > 0 ? sensible : free);

  if (level === 'easy') {
    const around = hits.flatMap(neighbors4).filter((c) => options.has(c));
    if (around.length > 0 && rng.chance(0.5)) return { type: 'shoot', cell: rng.pick(around) };
    return { type: 'shoot', cell: rng.pick([...free]) };
  }
  if (level === 'medium') return { type: 'shoot', cell: huntAndTarget(view, seat, options, rng) };

  const map = probabilityMap(view, seat);
  let best = -1;
  let cells: number[] = [];
  for (const cell of options) {
    const score = map[cell]!;
    if (score > best + 1e-9) {
      best = score;
      cells = [cell];
    } else if (Math.abs(score - best) <= 1e-9) cells.push(cell);
  }
  return { type: 'shoot', cell: rng.pick(cells) };
}

/**
 * Der Standard-Bot.
 * - leicht: zufällige freie Felder, nach einem Treffer manchmal die Nachbarn
 * - mittel: Jagen und Zielen (Schachbrettmuster, nach Treffern der Linie folgen)
 * - schwer: Wahrscheinlichkeitskarte über alle passenden Lagen; stellt gestreut auf
 */
export const battleshipBot: BotDefinition<BattleshipState, BattleshipMove> = {
  id: 'battleship',
  name: 'Admiral',
  levels: ['easy', 'medium', 'hard'],
  chooseMove(ctx) {
    const { view, seat, rng, level } = ctx;
    return view.phase === 'place' ? placeFleet(view, rng, level) : shoot(view, seat, rng, level);
  },
};
