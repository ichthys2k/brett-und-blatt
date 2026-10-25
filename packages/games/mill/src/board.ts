/**
 * Das Mühlebrett als Netz: 24 Punkte auf drei Quadraten (außen, Mitte, innen).
 * Punkt = Ring * 8 + j, j läuft im Uhrzeigersinn ab der linken oberen Ecke.
 * Ungerade j sind Seitenmitten; nur dort verbinden Linien die Ringe.
 */

/** Lage auf dem Raster 0–6 für j = 0 … 7 (Ecke, Mitte, Ecke, …). */
const STEPS: readonly [number, number][] = [
  [0, 0],
  [1, 0],
  [2, 0],
  [2, 1],
  [2, 2],
  [1, 2],
  [0, 2],
  [0, 1],
];

export const POINT_COUNT = 24;

export const POINTS: readonly { x: number; y: number }[] = Array.from({ length: POINT_COUNT }, (_, point) => {
  const ring = Math.floor(point / 8);
  const [px, py] = STEPS[point % 8]!;
  const step = 3 - ring;
  return { x: (ring + px * step) / 6, y: (ring + py * step) / 6 };
});

export const NEIGHBORS: readonly number[][] = Array.from({ length: POINT_COUNT }, (_, point) => {
  const ring = Math.floor(point / 8);
  const j = point % 8;
  const result = [ring * 8 + ((j + 1) % 8), ring * 8 + ((j + 7) % 8)];
  if (j % 2 === 1) {
    if (ring > 0) result.push(point - 8);
    if (ring < 2) result.push(point + 8);
  }
  return result;
});

export const LINES: readonly (readonly [number, number])[] = (() => {
  const lines: [number, number][] = [];
  NEIGHBORS.forEach((neighbors, point) => {
    for (const other of neighbors) if (other > point) lines.push([point, other]);
  });
  return lines;
})();

/** Alle 16 möglichen Mühlen. */
export const MILLS: readonly (readonly [number, number, number])[] = (() => {
  const mills: [number, number, number][] = [];
  for (let ring = 0; ring < 3; ring++) {
    for (const j of [0, 2, 4, 6]) mills.push([ring * 8 + j, ring * 8 + j + 1, ring * 8 + ((j + 2) % 8)]);
  }
  for (const j of [1, 3, 5, 7]) mills.push([j, 8 + j, 16 + j]);
  return mills;
})();

/** Die Mühlen, zu denen ein Punkt gehört (immer zwei). */
export const MILLS_OF: readonly (readonly (readonly [number, number, number])[])[] = Array.from({ length: POINT_COUNT }, (_, point) =>
  MILLS.filter((mill) => mill.includes(point)),
);

/** Feldname wie auf einem gedruckten Brett: a–g von links, 1–7 von unten. */
export function pointName(point: number): string {
  const { x, y } = POINTS[point]!;
  return `${'abcdefg'[Math.round(x * 6)]}${7 - Math.round(y * 6)}`;
}
