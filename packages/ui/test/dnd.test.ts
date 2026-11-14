import { describe, expect, it } from 'vitest';
import { useGridMoveAnimation, usePointerDrag, useSpawnAnimation } from '../src';

describe('DnD Utilities', () => {
  it('exportiert die Hooks usePointerDrag, useSpawnAnimation und useGridMoveAnimation', () => {
    expect(typeof usePointerDrag).toBe('function');
    expect(typeof useSpawnAnimation).toBe('function');
    expect(typeof useGridMoveAnimation).toBe('function');
  });
});

import { dragTilt } from '../src';

// Neigung beim Ziehen (#421).
describe('dragTilt', () => {
  it('ist im Stillstand 0', () => {
    expect(dragTilt({ x: 0, y: 0 }, 10, false)).toBe(0);
    expect(dragTilt({ x: 0, y: 3 }, 10, false)).toBe(0);
  });

  it('neigt in Zugrichtung', () => {
    expect(dragTilt({ x: 0.3, y: 0 }, 10, false)).toBeCloseTo(4.2);
    expect(dragTilt({ x: -0.3, y: 0 }, 10, false)).toBeCloseTo(-4.2);
  });

  it('bleibt in den Grenzen', () => {
    expect(dragTilt({ x: 5, y: 0 }, 10, false)).toBe(10);
    expect(dragTilt({ x: -5, y: 0 }, 8, false)).toBe(-8);
  });

  it('rundet auf eine Nachkommastelle und neigt bei „Bewegung reduzieren“ nicht', () => {
    expect(dragTilt({ x: 0.123, y: 0 }, 10, false)).toBe(1.7);
    expect(dragTilt({ x: 2, y: 0 }, 10, true)).toBe(0);
  });
});
