import { describe, expect, it } from 'vitest';
import { ROLL_MS, rollProgress, shaken } from '../apps/xr/src/scene/dice-shake';

describe('Würfeln per Becher (#389)', () => {
  it('erkennt Schütteln an mehreren Richtungswechseln', () => {
    const shake: [number, number][] = [[0, 0], [0.06, 0], [0, 0], [0.06, 0], [0, 0], [0.06, 0]];
    expect(shaken(shake)).toBe(true);
  });
  it('ein ruhiges Hochheben oder Zittern zählt nicht', () => {
    expect(shaken([[0, 0], [0, 0.1], [0, 0.2]])).toBe(false);
    expect(shaken([[0, 0], [0.005, 0], [0, 0], [0.005, 0]])).toBe(false);
    expect(shaken([])).toBe(false);
  });
  it('die Rollanimation endet auf null', () => {
    expect(rollProgress(0)).toBe(1);
    expect(rollProgress(ROLL_MS)).toBe(0);
    expect(rollProgress(ROLL_MS * 3)).toBe(0);
  });
});
