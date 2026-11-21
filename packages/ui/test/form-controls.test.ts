import { describe, expect, it } from 'vitest';
import { nextOptionIndex, nextRangeValue } from '../src/input/formControls';

describe('Regler und Listen per Controller (#613)', () => {
  it('nextRangeValue: Schritt hoch und runter, Anschläge', () => {
    expect(nextRangeValue({ value: 5, min: 0, max: 10, step: 1 }, 1)).toBe(6);
    expect(nextRangeValue({ value: 5, min: 0, max: 10, step: 1 }, -1)).toBe(4);
    expect(nextRangeValue({ value: 10, min: 0, max: 10, step: 1 }, 1)).toBe(10);
    expect(nextRangeValue({ value: 0, min: 0, max: 10, step: 1 }, -1)).toBe(0);
  });

  it('nextRangeValue: Raster ab min ohne Rundungsrest', () => {
    expect(nextRangeValue({ value: 0.25, min: 0.1, max: 0.6, step: 0.05 }, 1)).toBe(0.3);
    expect(nextRangeValue({ value: 0.3, min: 0.1, max: 0.6, step: 0.05 }, -1)).toBe(0.25);
    expect(nextRangeValue({ value: 400, min: 400, max: 3000, step: 100 }, 1)).toBe(500);
  });

  it('nextRangeValue: step 0 zählt als 1', () => {
    expect(nextRangeValue({ value: 3, min: 0, max: 10, step: 0 }, 1)).toBe(4);
  });

  it('nextOptionIndex: weiter, Umlauf, gesperrte überspringen, sonst bleiben', () => {
    expect(nextOptionIndex(0, [false, false, false])).toBe(1);
    expect(nextOptionIndex(2, [false, false, false])).toBe(0);
    expect(nextOptionIndex(0, [false, true, false])).toBe(2);
    expect(nextOptionIndex(1, [true, false, true])).toBe(1);
  });
});
