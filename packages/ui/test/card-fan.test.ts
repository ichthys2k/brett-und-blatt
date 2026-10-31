import { describe, expect, it } from 'vitest';
import { fanLayout } from '../src/cards/CardFan';

describe('fanLayout', () => {
  it('überlappt nicht, wenn der Platz reicht', () => {
    expect(fanLayout(5, 64, 400, 24)).toEqual({ rows: 1, perRow: 5, step: 64 });
  });

  it('überlappt in einer Reihe, solange genug von jeder Karte sichtbar bleibt', () => {
    const layout = fanLayout(10, 64, 344, 24);
    expect(layout.rows).toBe(1);
    expect(layout.step).toBeCloseTo(280 / 9);
    expect(64 + 9 * layout.step).toBeCloseTo(344);
  });

  it('bricht in weitere Reihen um, statt Karten zu verdecken', () => {
    const layout = fanLayout(20, 64, 344, 24);
    expect(layout.rows).toBe(2);
    expect(layout.perRow).toBe(10);
    expect(layout.step).toBeGreaterThanOrEqual(24);
    expect(64 + (layout.perRow - 1) * layout.step).toBeLessThanOrEqual(344 + 1e-9);
  });

  it('bleibt bei höchstens maxRows Reihen und rückt dann enger', () => {
    const layout = fanLayout(60, 64, 344, 24, 3);
    expect(layout.rows).toBe(3);
    expect(layout.perRow).toBe(20);
    expect(layout.step).toBeLessThan(24);
  });

  it('bleibt ohne minStep bei einer Reihe (bisheriges Verhalten)', () => {
    expect(fanLayout(30, 64, 344).rows).toBe(1);
  });
});
