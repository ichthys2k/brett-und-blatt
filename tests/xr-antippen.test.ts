import { describe, expect, it } from 'vitest';
import { TAP_MAX_MS, TAP_MAX_TRAVEL, isTap } from '../apps/xr/src/hand-assist';
import { KNIFFEL_DIE_STEP, KNIFFEL_DIE_WIDTH, KNIFFEL_ROLL_BUTTON, KNIFFEL_ROLL_BUTTON_WIDTH } from '../apps/xr/src/scene/dice-shake';
import { REACTION_BAR, fanRowExtent } from '../apps/xr/src/scene/fan-layout';
import { nextGrabMode } from '../apps/xr/src/table-grab';

describe('Antippen statt Greifen (#585)', () => {
  it('ein kurzer Druck ohne Bewegung ist ein Antippen', () => {
    expect(isTap(120, 0)).toBe(true);
    expect(isTap(TAP_MAX_MS, TAP_MAX_TRAVEL)).toBe(true);
  });
  it('langes Halten oder deutliches Bewegen ist ein Greifen', () => {
    expect(isTap(TAP_MAX_MS + 1, 0)).toBe(false);
    expect(isTap(100, TAP_MAX_TRAVEL + 0.01)).toBe(false);
  });
});

describe('Zweihand-Tischgriff (#585)', () => {
  it('eine Hand verschiebt, zwei Hände drehen und skalieren', () => {
    expect(nextGrabMode('none', 0)).toBe('none');
    expect(nextGrabMode('none', 1)).toBe('move');
    expect(nextGrabMode('none', 2)).toBe('scale');
  });
  it('greift die zweite Hand später zu, wechselt das Verschieben auf Zweihand', () => {
    expect(nextGrabMode('move', 1)).toBe('move');
    expect(nextGrabMode('move', 2)).toBe('scale');
    expect(nextGrabMode('move', 0)).toBe('none');
  });
  it('der Zweihandgriff endet erst, wenn weniger als zwei Hände greifen', () => {
    expect(nextGrabMode('scale', 2)).toBe('scale');
    expect(nextGrabMode('scale', 1)).toBe('none');
    expect(nextGrabMode('scale', 0)).toBe('none');
  });
});

describe('Reaktionsleiste und Fächer (#585)', () => {
  // Fächer: fanZ = Tischradius 0,62 - 0,2 vor der Tischmitte, Höhe über der Tischplatte 0,11.
  const fanZ = 0.42;
  const fanY = 0.11;
  it('die Leiste überdeckt auch bei elf bis sechzehn Karten (zwei Reihen) keine Karte der unteren Reihe', () => {
    const lower = fanRowExtent(1, fanZ, fanY);
    // Leiste: Kante, die dem Fächer am nächsten liegt (kleinstes z)
    const barZMin = REACTION_BAR.z - (REACTION_BAR.height / 2) * Math.sin(REACTION_BAR.tilt);
    expect(barZMin).toBeGreaterThan(lower.zMax + 0.02);
  });
  it('die Leiste liegt noch auf der Tischplatte', () => {
    expect(REACTION_BAR.z).toBeLessThan(0.62 - 0.03);
  });
});

describe('Würfeln-Knopf im Würfelblock (#585)', () => {
  it('liegt rechts vom fünften Würfel, ohne ihn zu überdecken', () => {
    const lastDieRight = 2 * KNIFFEL_DIE_STEP + KNIFFEL_DIE_WIDTH / 2;
    const buttonLeft = KNIFFEL_ROLL_BUTTON[0] - KNIFFEL_ROLL_BUTTON_WIDTH / 2;
    expect(buttonLeft).toBeGreaterThan(lastDieRight);
  });
});
