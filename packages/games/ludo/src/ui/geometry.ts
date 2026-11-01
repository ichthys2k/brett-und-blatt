import type { SeatId } from '@brett-und-blatt/engine';
import { SIX_ARM_LENGTH, armOf, colorIndex, type Board } from '../rules';

export interface Point {
  x: number;
  y: number;
}

/** Hintergrundfläche eines Wartehäuschens. */
export type HomePanel =
  | { kind: 'rect'; x: number; y: number; size: number }
  | { kind: 'circle'; cx: number; cy: number; r: number };

/**
 * Alles, was die Oberfläche über ein Brett wissen muss. „Ecke“ meint die Stelle am Brett
 * (beim Kreuzbrett eine der vier Ecken, beim Sechser-Brett einer der sechs Arme), nicht die Farbe.
 */
export interface BoardGeometry {
  /** Breite und Höhe der viewBox. */
  size: number;
  /** Streckenfelder nach absolutem Index. */
  track: readonly Point[];
  /** Absoluter Index des Startfelds je Ecke. */
  starts: readonly number[];
  /** Zielfelder a..d je Ecke. */
  goals: readonly (readonly Point[])[];
  /** Warteplätze je Ecke. */
  homes: readonly (readonly Point[])[];
  panels: readonly HomePanel[];
}

/** Die 40 Streckenfelder des Kreuzbretts auf dem 11×11-Gitter (col, row 0..10). */
const CLASSIC_TRACK: readonly [number, number][] = [
  // 0..4 (Gelber Arm runter)
  [6, 0], [6, 1], [6, 2], [6, 3], [6, 4],
  // 5..8 (Grüner Arm rechts)
  [7, 4], [8, 4], [9, 4], [10, 4],
  // 9..10 (Grüner Arm Spitze & Start Grün)
  [10, 5], [10, 6],
  // 11..14 (Grüner Arm links)
  [9, 6], [8, 6], [7, 6], [6, 6],
  // 15..18 (Roter Arm runter)
  [6, 7], [6, 8], [6, 9], [6, 10],
  // 19..20 (Roter Arm Spitze & Start Rot)
  [5, 10], [4, 10],
  // 21..24 (Roter Arm rauf)
  [4, 9], [4, 8], [4, 7], [4, 6],
  // 25..28 (Blauer Arm links)
  [3, 6], [2, 6], [1, 6], [0, 6],
  // 29..30 (Blauer Arm Spitze & Start Blau)
  [0, 5], [0, 4],
  // 31..34 (Blauer Arm rechts)
  [1, 4], [2, 4], [3, 4], [4, 4],
  // 35..38 (Gelber Arm rauf)
  [4, 3], [4, 2], [4, 1], [4, 0],
  // 39 (Letztes Feld vor Gelb-Ziel)
  [5, 0],
];

/** Die 4 Zielfelder je Ecke (Gelb, Grün, Rot, Blau). */
const CLASSIC_GOALS: readonly (readonly [number, number][])[] = [
  [[5, 1], [5, 2], [5, 3], [5, 4]],
  [[9, 5], [8, 5], [7, 5], [6, 5]],
  [[5, 9], [5, 8], [5, 7], [5, 6]],
  [[1, 5], [2, 5], [3, 5], [4, 5]],
];

/** Linke obere Ecke der Häuschen-Felder (2×2) je Ecke. */
const CLASSIC_HOME_ORIGIN: readonly [number, number][] = [
  [0.8, 0.8],
  [7.8, 0.8],
  [7.8, 7.8],
  [0.8, 7.8],
];

function cell([col, row]: readonly [number, number]): Point {
  return { x: col * 100 + 50, y: row * 100 + 50 };
}

export const CLASSIC_GEOMETRY: BoardGeometry = {
  size: 1100,
  track: CLASSIC_TRACK.map(cell),
  starts: [0, 10, 20, 30],
  goals: CLASSIC_GOALS.map((goal) => goal.map(cell)),
  homes: CLASSIC_HOME_ORIGIN.map(([col, row]) => [
    cell([col, row]),
    cell([col + 1.4, row]),
    cell([col, row + 1.4]),
    cell([col + 1.4, row + 1.4]),
  ]),
  panels: [
    { kind: 'rect', x: 25, y: 25, size: 350 },
    { kind: 'rect', x: 725, y: 25, size: 350 },
    { kind: 'rect', x: 725, y: 725, size: 350 },
    { kind: 'rect', x: 25, y: 725, size: 350 },
  ],
};

/** Feldabstand auf dem Sechser-Brett. */
const STEP = 100;
const SIX_SIZE = 1360;

/**
 * Sechsarmiger Stern: Arm 0 zeigt nach oben, die weiteren folgen im Uhrzeigersinn. Jeder Arm hat
 * drei Spuren: außen hinaus (zum vorigen Arm hin), in der Mitte die Zielfelder und innen zurück
 * (zum nächsten Arm hin). Die Strecke läuft wie beim Kreuzbrett im Uhrzeigersinn.
 */
function buildSixGeometry(): BoardGeometry {
  const half = SIX_SIZE / 2;
  const at = (arm: number, radius: number, offset: number, angleShift = 0): Point => {
    const angle = ((-90 + 60 * arm + angleShift) * Math.PI) / 180;
    const ux = Math.cos(angle);
    const uy = Math.sin(angle);
    // Querrichtung: um 90° im Uhrzeigersinn gedreht, zeigt zum nächsten Arm.
    const vx = -uy;
    const vy = ux;
    return { x: half + (radius * ux + offset * vx) * STEP, y: half + (radius * uy + offset * vy) * STEP };
  };

  const track: Point[] = [];
  const starts: number[] = [];
  const goals: Point[][] = [];
  const homes: Point[][] = [];
  const panels: HomePanel[] = [];
  for (let arm = 0; arm < 6; arm++) {
    for (const radius of [3, 4, 5, 6]) track.push(at(arm, radius, -1));
    track.push(at(arm, 6, 0));
    for (const radius of [6, 5, 4, 3]) track.push(at(arm, radius, 1));
    // Startfeld: außen auf der Rückspur, gleich hinter der Spitze.
    starts.push(arm * SIX_ARM_LENGTH + 5);
    goals.push([5, 4, 3, 2].map((radius) => at(arm, radius, 0)));
    // Häuschen in der Lücke zum nächsten Arm, neben dem Startfeld.
    const center = at(arm, 5.4, 0, 30);
    const d = 0.5 * STEP;
    homes.push([
      { x: center.x - d, y: center.y - d },
      { x: center.x + d, y: center.y - d },
      { x: center.x - d, y: center.y + d },
      { x: center.x + d, y: center.y + d },
    ]);
    panels.push({ kind: 'circle', cx: center.x, cy: center.y, r: 1.15 * STEP });
  }
  return { size: SIX_SIZE, track, starts, goals, homes, panels };
}

export const SIX_GEOMETRY: BoardGeometry = buildSixGeometry();

export function geometryOf(board: Board = 'classic'): BoardGeometry {
  return board === 'six' ? SIX_GEOMETRY : CLASSIC_GEOMETRY;
}

/** An welcher Ecke des Bretts ein Platz sitzt. */
export function cornerOf(seat: SeatId, seats: number, board: Board = 'classic'): number {
  return board === 'six' ? armOf(seat, seats) : colorIndex(seat, seats);
}

/**
 * Farbe je Ecke: Beim Kreuzbrett gehört jede Ecke fest zu einer Farbe, beim Sechser-Brett
 * zur Farbe des Platzes, der dort sitzt; freie Arme bleiben grau (null).
 */
export function cornerColors(seats: number, board: Board = 'classic'): (number | null)[] {
  if (board !== 'six') return [0, 1, 2, 3];
  const colors: (number | null)[] = [null, null, null, null, null, null];
  for (let seat = 0; seat < seats; seat++) colors[armOf(seat, seats)] = colorIndex(seat, seats);
  return colors;
}
