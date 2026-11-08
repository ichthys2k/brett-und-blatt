import { describe, expect, it } from 'vitest';
import { STAGE_HEIGHT, STAGE_MAX_SCALE, STAGE_WIDTH, stageScale } from '../apps/web/src/lib/stage';

describe('Tisch-Bildschirm: Skalierung der Bühne (#100)', () => {
  it('zieht einen Full-HD-Fernseher auf das Anderthalbfache', () => {
    expect(stageScale(1920, 1080)).toBeCloseTo(1.5);
  });

  it('richtet sich nach der knapperen Seite', () => {
    expect(stageScale(1920, 800)).toBeCloseTo(800 / STAGE_HEIGHT);
    expect(stageScale(1400, 1080)).toBeCloseTo(1400 / STAGE_WIDTH);
  });

  it('vergrößert nie über die Obergrenze und verkleinert nie', () => {
    expect(stageScale(7680, 4320)).toBe(STAGE_MAX_SCALE);
    expect(stageScale(800, 600)).toBe(1);
    expect(stageScale(1280, 720)).toBe(1);
  });
});
