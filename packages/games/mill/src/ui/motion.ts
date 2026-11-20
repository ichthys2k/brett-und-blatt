/**
 * Bewegung der Steine (#590): leitet aus dem Spielstand vor und nach einem Zug ab, welche Steine
 * gleiten, fliegen, vom Vorrat kommen oder verschwinden. Rein optisch – der Spielstand bleibt
 * maßgeblich; passen die beiden Stände nicht zu einem einzelnen Zug (Neuladen, Zurückspulen,
 * mehrere Züge auf einmal), kommt eine leere Liste und das Brett springt einfach.
 */
import type { SeatId } from '@brett-und-blatt/engine';
import { NEIGHBORS } from '../board';
import type { MillState } from '../rules';

export type StoneMotion =
  /** Zug entlang einer Linie. */
  | { kind: 'slide'; seat: SeatId; from: number; to: number }
  /** Sprung in gerader Linie (Endphase). */
  | { kind: 'fly'; seat: SeatId; from: number; to: number }
  /** Stein kommt aus dem Vorrat aufs Feld. */
  | { kind: 'place'; seat: SeatId; to: number }
  /** Geschlagener Stein verschwindet. */
  | { kind: 'remove'; seat: SeatId; point: number };

export function motionsOf(prev: MillState | null, next: MillState): StoneMotion[] {
  const move = next.lastMove;
  if (!prev || !move || move === prev.lastMove) return [];
  const seat = next.cells[move.to];
  if (seat === null || seat === undefined || prev.cells[move.to] !== null) return [];
  const motions: StoneMotion[] = [];
  if (move.type === 'place') {
    if (prev.inHand[seat as 0 | 1] !== next.inHand[seat as 0 | 1] + 1) return [];
    motions.push({ kind: 'place', seat, to: move.to });
  } else {
    if (prev.cells[move.from] !== seat || next.cells[move.from] !== null) return [];
    const adjacent = (NEIGHBORS[move.from] ?? []).includes(move.to);
    motions.push({
      kind: adjacent ? 'slide' : 'fly',
      seat,
      from: move.from,
      to: move.to,
    });
  }
  const opponent = (1 - seat) as SeatId;
  for (const point of move.remove) {
    if (prev.cells[point] !== opponent || next.cells[point] !== null) return [];
    motions.push({ kind: 'remove', seat: opponent, point });
  }
  // Genau dieser eine Zug muss den Unterschied der Stände erklären (sonst: Zurückspulen, mehrere Züge).
  const changed = next.cells.filter((cell, point) => cell !== prev.cells[point]).length;
  const explained = (move.type === 'place' ? 1 : 2) + move.remove.length;
  if (changed !== explained || next.turn === prev.turn) return [];
  return motions;
}

export const SLIDE_MS = 320;
export const FLY_MS = 480;
export const PLACE_MS = 420;
export const REMOVE_MS = 380;

/** Dauer der Bewegung des ziehenden Steins (0 bei reinem Schlagen). */
export function moverMs(motions: readonly StoneMotion[]): number {
  return Math.max(0, ...motions.map((m) => (m.kind === 'slide' ? SLIDE_MS : m.kind === 'fly' ? FLY_MS : m.kind === 'place' ? PLACE_MS : 0)));
}
