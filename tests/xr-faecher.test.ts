import { describe, expect, it } from 'vitest';
import { fanAttached, fanYaw } from '../apps/xr/src/hand-fan';

describe('Kartenfächer an der Hand (#384)', () => {
  it('hängt nur an der Hand, wenn gewählt, Controller da und Hand angehoben', () => {
    expect(fanAttached('hand', true, 1.2, 0.74)).toBe(true);
    expect(fanAttached('hand', true, 0.8, 0.74)).toBe(false);
    expect(fanAttached('hand', false, 1.2, 0.74)).toBe(false);
    expect(fanAttached('table', true, 1.2, 0.74)).toBe(false);
  });
  it('dreht die Karten zum Kopf', () => {
    expect(fanYaw([0, 0], [0, 1])).toBeCloseTo(0);
    expect(fanYaw([0, 0], [1, 0])).toBeCloseTo(Math.PI / 2);
    expect(fanYaw([0, 0], [0, -1])).toBeCloseTo(Math.PI);
  });
});
