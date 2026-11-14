import { describe, expect, it } from 'vitest';
import { MAX_SINGLE_ROW, fanSlot, isThrow } from '../apps/xr/src/scene/fan-layout';

describe('Fächer in zwei Reihen und Wurf (#384)', () => {
  it('bis zehn Karten eine Reihe, darüber zwei', () => {
    expect(Array.from({ length: MAX_SINGLE_ROW }, (_, i) => fanSlot(i, MAX_SINGLE_ROW).row).every((r) => r === 0)).toBe(true);
    const rows = Array.from({ length: 13 }, (_, i) => fanSlot(i, 13).row);
    expect(rows.filter((r) => r === 1)).toHaveLength(6);
    expect(rows.filter((r) => r === 0)).toHaveLength(7);
  });
  it('keine zwei Karten liegen an derselben Stelle, die untere Reihe liegt tiefer und vorn', () => {
    const slots = Array.from({ length: 16 }, (_, i) => fanSlot(i, 16));
    const keys = new Set(slots.map((s) => `${s.row}:${s.x.toFixed(4)}`));
    expect(keys.size).toBe(16);
    expect(slots.find((s) => s.row === 1)!.dy).toBeLessThan(slots.find((s) => s.row === 0)!.dy);
    expect(slots.find((s) => s.row === 1)!.dz).toBeGreaterThan(slots.find((s) => s.row === 0)!.dz - 0.1);
  });
  it('erkennt einen schnellen Wurf Richtung Mitte, nicht langsames oder seitliches Bewegen', () => {
    const toward = [{ x: 0, z: 0.5, t: 0 }, { x: 0, z: 0.4, t: 50 }, { x: 0, z: 0.3, t: 100 }, { x: 0, z: 0.2, t: 150 }];
    expect(isThrow(toward, [0, 0])).toBe(true);
    const slow = toward.map((s, i) => ({ ...s, t: i * 1000 }));
    expect(isThrow(slow, [0, 0])).toBe(false);
    const sideways = [{ x: 0, z: 0.5, t: 0 }, { x: 0.1, z: 0.5, t: 50 }, { x: 0.2, z: 0.5, t: 100 }, { x: 0.3, z: 0.5, t: 150 }];
    expect(isThrow(sideways, [0, 0])).toBe(false);
    expect(isThrow([], [0, 0])).toBe(false);
  });
});
