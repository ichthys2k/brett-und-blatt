import { describe, expect, it } from 'vitest';
import { clampOffset, dragOffset, inEdgeZone, pinchScale } from '../apps/xr/src/table-grab';

const center: [number, number, number] = [0, 0.74, -0.55];

describe('Tisch greifen (#387)', () => {
  it('greift nur an der Kante, nicht in der Tischmitte oder weit weg', () => {
    expect(inEdgeZone([0, 0.8, -0.55 + 0.6], center)).toBe(true);
    expect(inEdgeZone([0, 0.8, -0.55 + 0.1], center)).toBe(false);
    expect(inEdgeZone([0, 0.8, -0.55 + 1.5], center)).toBe(false);
    expect(inEdgeZone([0, 1.6, -0.55 + 0.6], center)).toBe(false);
  });
  it('der Tisch folgt der Hand: hoch, zu mir, zur Seite', () => {
    const start = { x: 0, y: 0, z: 0 };
    // Hand 10 cm nach oben: Tisch 10 cm höher (wie „höher“, y wächst).
    expect(dragOffset(start, [0, 1, 0], [0, 1.1, 0]).y).toBeCloseTo(0.1);
    // Hand 10 cm zu mir (+z): Tisch näher (wie „näher“, z sinkt).
    expect(dragOffset(start, [0, 1, 0], [0, 1, 0.1]).z).toBeCloseTo(-0.1);
    expect(dragOffset(start, [0, 1, 0], [0.1, 1, 0]).x).toBeCloseTo(-0.1);
  });
  it('bleibt in den Grenzen', () => {
    expect(clampOffset({ x: 5, y: -5, z: 5 })).toEqual({ x: 0.6, y: -0.5, z: 0.6 });
  });
  it('skaliert mit dem Handabstand in den Grenzen von #370', () => {
    expect(pinchScale(0.5, 0.4, 0.2)).toBe(0.3);
    expect(pinchScale(0.5, 0.4, 0.6)).toBe(0.75);
    expect(pinchScale(0.8, 0.4, 1)).toBe(1);
    expect(pinchScale(0.5, 0.01, 1)).toBe(0.5);
  });
});
