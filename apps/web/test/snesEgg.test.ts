import { describe, expect, it } from 'vitest';
import { createTapCounter } from '../src/lib/snesEgg';

describe('Easter Egg: Tipps aufs Logo (#596)', () => {
  it('öffnet erst beim siebten schnellen Tipp', () => {
    const tap = createTapCounter(7, 1200);
    const results = [0, 200, 400, 600, 800, 1000, 1200].map((t) => tap(t));
    expect(results).toEqual([false, false, false, false, false, false, true]);
  });

  it('zählt nach einer Pause von vorn', () => {
    const tap = createTapCounter(3, 1000);
    expect(tap(0)).toBe(false);
    expect(tap(500)).toBe(false);
    expect(tap(2000)).toBe(false);
    expect(tap(2300)).toBe(false);
    expect(tap(2600)).toBe(true);
  });

  it('beginnt nach dem Öffnen neu', () => {
    const tap = createTapCounter(2, 1000);
    expect(tap(0)).toBe(false);
    expect(tap(100)).toBe(true);
    expect(tap(200)).toBe(false);
    expect(tap(300)).toBe(true);
  });
});
