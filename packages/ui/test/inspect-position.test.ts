import { describe, expect, it } from 'vitest';
import { INSPECT_EDGE, inspectPosition } from '../src';

// Platz der schwebenden Großansicht (#418).
const viewport = { width: 1440, height: 900 };
const panel = { width: 340, height: 500 };

describe('inspectPosition', () => {
  it('stellt die Ansicht rechts neben das Element, wenn sie dort passt', () => {
    const spot = inspectPosition({ left: 400, top: 600, right: 532, bottom: 777 }, panel, viewport);
    expect(spot.side).toBe('right');
    expect(spot.left).toBe(532 + 12);
    expect(spot.top + panel.height).toBeLessThanOrEqual(viewport.height - INSPECT_EDGE);
  });

  it('weicht nach links aus, wenn rechts kein Platz ist', () => {
    const spot = inspectPosition({ left: 1200, top: 300, right: 1330, bottom: 470 }, panel, viewport);
    expect(spot.side).toBe('left');
    expect(spot.left + panel.width).toBeLessThanOrEqual(1200);
  });

  it('nimmt oben oder unten, wenn es seitlich nicht passt', () => {
    const narrow = { width: 600, height: 900 };
    const above = inspectPosition({ left: 200, top: 700, right: 400, bottom: 800 }, { width: 340, height: 400 }, narrow);
    expect(above.side).toBe('above');
    expect(above.top + 400).toBeLessThanOrEqual(700);
    const below = inspectPosition({ left: 200, top: 50, right: 400, bottom: 150 }, { width: 340, height: 400 }, narrow);
    expect(below.side).toBe('below');
    expect(below.top).toBeGreaterThanOrEqual(150);
  });

  it('bleibt immer im Fenster und verdeckt das Element nicht, solange es irgendwo passt', () => {
    for (let x = 0; x < 1300; x += 97) {
      for (let y = 0; y < 800; y += 83) {
        const anchor = { left: x, top: y, right: x + 120, bottom: y + 160 };
        const spot = inspectPosition(anchor, panel, viewport);
        expect(spot.left).toBeGreaterThanOrEqual(INSPECT_EDGE);
        expect(spot.top).toBeGreaterThanOrEqual(INSPECT_EDGE);
        expect(spot.left + panel.width).toBeLessThanOrEqual(viewport.width - INSPECT_EDGE);
        expect(spot.top + panel.height).toBeLessThanOrEqual(viewport.height - INSPECT_EDGE);
        const overlaps = spot.left < anchor.right && spot.left + panel.width > anchor.left && spot.top < anchor.bottom && spot.top + panel.height > anchor.top;
        expect(overlaps).toBe(false);
      }
    }
  });
});
