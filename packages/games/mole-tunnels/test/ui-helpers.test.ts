import { describe, expect, it } from 'vitest';
import { E, N, S, W, pushIndices } from '../src';
import { arrowCenter, hareSlots, openingNames, pushRing } from '../src/ui/helpers';

describe('Hilfen der Oberfläche', () => {
  it('der Schiebe-Ring hat 12 (7 × 7) bzw. 8 (5 × 5) Stellen, jede einmal', () => {
    for (const [size, count] of [
      [7, 12],
      [5, 8],
    ] as const) {
      const ring = pushRing(size);
      expect(ring).toHaveLength(count);
      expect(new Set(ring.map((s) => `${s.side}:${s.index}`)).size).toBe(count);
      expect(ring.every((s) => pushIndices(size).includes(s.index))).toBe(true);
    }
  });

  it('Pfeile liegen im Randstreifen, mittig vor der Zeile bzw. Spalte', () => {
    const top = arrowCenter(7, 'top', 1);
    expect(top.x).toBeCloseTo(2 / 8);
    expect(top.y).toBeCloseTo(0.25 / 8);
    const right = arrowCenter(7, 'right', 3);
    expect(right.x).toBeCloseTo(1 - 0.25 / 8);
    expect(right.y).toBeCloseTo(4 / 8);
    // Die Mitte des Feldes (Teil 0 beginnt nach einem halben Teil) trifft die Mitte der Spalte.
    expect(arrowCenter(5, 'bottom', 3).x).toBeCloseTo((0.5 + 3.5) / 6);
  });

  it('openingNames benennt die Öffnungen', () => {
    expect(openingNames(N | S)).toBe('oben und unten');
    expect(openingNames(N | E | W)).toBe('oben, rechts und links');
    expect(openingNames(N)).toBe('oben');
  });

  it('hareSlots gibt je Anzahl genau so viele Plätze', () => {
    for (const count of [1, 2, 3, 4]) expect(hareSlots(count)).toHaveLength(count);
  });
});
