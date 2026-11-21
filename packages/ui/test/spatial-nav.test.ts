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

describe('findNextFocusTarget: Zeilen über die volle Breite in den Konsolen-Menüs (#636)', () => {
  const rect = (left: number, top: number, width: number, height: number) => ({ left, top, right: left + width, bottom: top + height, width, height });
  it('runter von einem rechtsbündigen Knopf geht in die nächste Zeile, nicht zum nächsten rechtsbündigen Knopf', () => {
    const current = rect(900, 100, 200, 48); // Knopfleiste rechts in Zeile 1
    const candidates = [
      { id: 'zeile2', rect: rect(430, 170, 690, 70) }, // ganze Zeile 2 ist ein Knopf
      { id: 'knopf3', rect: rect(950, 260, 120, 48) }, // rechtsbündiger Knopf in Zeile 3
    ];
    expect(findNextFocusTarget(current, candidates, 'down', { verticalAlignedWeight: 0.01 })).toBe('zeile2');
  });
  it('unter überlappenden Zielen gewinnt bei gleichem Abstand das näher an der Mitte', () => {
    const current = rect(400, 100, 600, 60);
    const candidates = [
      { id: 'links', rect: rect(400, 200, 100, 48) },
      { id: 'mitte', rect: rect(650, 200, 100, 48) },
    ];
    expect(findNextFocusTarget(current, candidates, 'down', { verticalAlignedWeight: 0.01 })).toBe('mitte');
  });
  it('ohne Option bleibt die bisherige Wertung', () => {
    const current = rect(900, 100, 200, 48);
    const candidates = [
      { id: 'zeile2', rect: rect(430, 170, 690, 70) },
      { id: 'knopf3', rect: rect(950, 260, 120, 48) },
    ];
    expect(findNextFocusTarget(current, candidates, 'down')).toBe('knopf3');
  });
});
