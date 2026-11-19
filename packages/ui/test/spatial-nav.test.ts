import { describe, expect, it } from 'vitest';
import { findNextFocusTarget, pickZoneEntryTarget, type FocusCandidate, type NavRect } from '../src/input/spatialNav';

function rect(x: number, y: number, w = 80, h = 40): NavRect {
  return { left: x, top: y, right: x + w, bottom: y + h, width: w, height: h };
}

describe('spatialNav', () => {
  const candidates: FocusCandidate[] = [
    { id: 'top-left', rect: rect(0, 0) },
    { id: 'top-right', rect: rect(120, 0) },
    { id: 'mid-left', rect: rect(0, 80) },
    { id: 'mid-right', rect: rect(120, 80) },
    { id: 'bottom', rect: rect(60, 160) },
    { id: 'hidden', rect: rect(240, 80, 0, 0) },
    { id: 'disabled', rect: rect(240, 0), disabled: true },
  ];

  it('findet den nächsten Nachbarn in alle vier Richtungen', () => {
    expect(findNextFocusTarget(candidates[0].rect, candidates, 'right')).toBe('top-right');
    expect(findNextFocusTarget(candidates[0].rect, candidates, 'down')).toBe('mid-left');
    expect(findNextFocusTarget(candidates[3].rect, candidates, 'left')).toBe('mid-left');
    expect(findNextFocusTarget(candidates[3].rect, candidates, 'up')).toBe('top-right');
    expect(findNextFocusTarget(candidates[2].rect, candidates, 'down')).toBe('bottom');
  });

  it('ignoriert unsichtbare und deaktivierte Elemente', () => {
    expect(findNextFocusTarget(candidates[1].rect, candidates, 'right')).toBeNull();
    expect(findNextFocusTarget(candidates[3].rect, candidates, 'right')).toBeNull();
  });

  it('wählt das zuletzt fokussierte Element oder das erste gültige beim Zonen-Einstieg', () => {
    expect(pickZoneEntryTarget(candidates, 'mid-right')).toBe('mid-right');
    expect(pickZoneEntryTarget(candidates, 'hidden')).toBe('top-left');
    expect(pickZoneEntryTarget(candidates, null)).toBe('top-left');
  });
});
