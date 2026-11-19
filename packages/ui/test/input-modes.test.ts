import { describe, expect, it } from 'vitest';
import { stepCarousel } from '../src/input/moveCarousel';
import {
  INITIAL_SCAN_STATE,
  stepScanAdvance,
  stepScanBack,
  stepScanSelect,
} from '../src/input/scanEngine';

describe('moveCarousel (C5)', () => {
  const items = [
    { id: 'm1', label: 'Bauer e2 nach e4' },
    { id: 'm2', label: 'Springer g1 nach f3' },
    { id: 'm3', label: 'Dame d1 nach h5' },
  ];

  it('wandert vorwärts und rückwärts mit Wrap-around', () => {
    expect(stepCarousel(items, null, 1)?.id).toBe('m1');
    expect(stepCarousel(items, null, -1)?.id).toBe('m3');
    expect(stepCarousel(items, 'm1', 1)?.id).toBe('m2');
    expect(stepCarousel(items, 'm3', 1)?.id).toBe('m1');
    expect(stepCarousel(items, 'm1', -1)?.id).toBe('m3');
    expect(stepCarousel([], 'm1', 1)).toBeNull();
  });
});

describe('scanEngine (C6)', () => {
  it('durchläuft Zonen und Elemente im 1-/2-Taster-Scan', () => {
    let s = INITIAL_SCAN_STATE;
    s = stepScanAdvance(s, 3, 0);
    expect(s).toEqual({ phase: 'zone', zoneIndex: 1, itemIndex: 0 });

    // Zone auswählen -> wechselt in Element-Phase
    const sel1 = stepScanSelect(s, 3, 4);
    expect(sel1.nextState).toEqual({ phase: 'item', zoneIndex: 1, itemIndex: 0 });

    s = stepScanAdvance(sel1.nextState, 3, 4);
    expect(s).toEqual({ phase: 'item', zoneIndex: 1, itemIndex: 1 });

    // Element auswählen -> löst Element aus und kehrt zur Zonen-Phase zurück
    const sel2 = stepScanSelect(s, 3, 4);
    expect(sel2.triggerZoneIndex).toBe(1);
    expect(sel2.triggerItemIndex).toBe(1);
    expect(sel2.nextState.phase).toBe('zone');

    // Abbrechen springt zurück zur Zonen-Phase
    expect(stepScanBack({ phase: 'item', zoneIndex: 2, itemIndex: 3 })).toEqual({
      phase: 'zone',
      zoneIndex: 2,
      itemIndex: 0,
    });
  });

  it('löst eine Zone mit nur einem Element direkt aus', () => {
    const sel = stepScanSelect({ phase: 'zone', zoneIndex: 0, itemIndex: 0 }, 2, 1);
    expect(sel.triggerZoneIndex).toBe(0);
    expect(sel.triggerItemIndex).toBe(0);
    expect(sel.nextState.phase).toBe('zone');
  });
});
