/** Reine Hilfen der Oberfläche (ohne React), damit sie sich testen lassen. */
import { N, E, S, W, pushIndices, type Side } from '../rules';

export interface PushSpot {
  side: Side;
  index: number;
}

/** Alle Schiebestellen im Uhrzeigersinn (oben von links nach rechts, rechts nach unten, unten nach links, links nach oben). */
export function pushRing(size: number): PushSpot[] {
  const indices = pushIndices(size);
  const reversed = [...indices].reverse();
  return [
    ...indices.map((index): PushSpot => ({ side: 'top', index })),
    ...indices.map((index): PushSpot => ({ side: 'right', index })),
    ...reversed.map((index): PushSpot => ({ side: 'bottom', index })),
    ...reversed.map((index): PushSpot => ({ side: 'left', index })),
  ];
}

/**
 * Mitte einer Schiebestelle als Anteil (0–1) der Brettfläche, die aus n × n Teilen plus einem
 * Randstreifen von einem halben Teil rundum besteht.
 */
export function arrowCenter(n: number, side: Side, index: number): { x: number; y: number } {
  const along = (index + 1) / (n + 1);
  const edge = 0.25 / (n + 1);
  switch (side) {
    case 'top':
      return { x: along, y: edge };
    case 'bottom':
      return { x: along, y: 1 - edge };
    case 'left':
      return { x: edge, y: along };
    case 'right':
      return { x: 1 - edge, y: along };
  }
}

const OPENING_NAMES: [bit: number, name: string][] = [
  [N, 'oben'],
  [E, 'rechts'],
  [S, 'unten'],
  [W, 'links'],
];

/** „oben und unten“ – für Bildschirmleser und Hinweise. */
export function openingNames(mask: number): string {
  const names = OPENING_NAMES.filter(([bit]) => mask & bit).map(([, name]) => name);
  if (names.length <= 1) return names.join('');
  return `${names.slice(0, -1).join(', ')} und ${names[names.length - 1]}`;
}

/** Mittelpunkte (in Teil-Koordinaten 0–100) für mehrere Hasen auf einem Teil, jeweils mit Maßstab. */
export function hareSlots(count: number): { x: number; y: number; scale: number }[] {
  if (count <= 1) return [{ x: 50, y: 62, scale: 1.35 }];
  if (count === 2)
    return [
      { x: 31, y: 64, scale: 1 },
      { x: 69, y: 64, scale: 1 },
    ];
  return [
    { x: 29, y: 38, scale: 0.78 },
    { x: 71, y: 38, scale: 0.78 },
    { x: 29, y: 80, scale: 0.78 },
    { x: 71, y: 80, scale: 0.78 },
  ].slice(0, count);
}
