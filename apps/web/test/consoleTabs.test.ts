import { describe, expect, it } from 'vitest';
import { pickInitialFocus } from '../src/console/consoleFocus';
import { CONSOLE_TABS, neighborTab, tabForRoute } from '../src/console/consoleTabs';

describe('Reiter der Konsole (#614)', () => {
  it('ordnet Routen den Reitern zu', () => {
    expect(tabForRoute('menu')).toBe('start');
    expect(tabForRoute('home')).toBe('library');
    expect(tabForRoute('setup')).toBe('library');
    expect(tabForRoute('online')).toBe('online');
    expect(tabForRoute('room')).toBe('online');
    expect(tabForRoute('board')).toBe('online');
    expect(tabForRoute('sound')).toBe('options');
    expect(tabForRoute('play')).toBeNull();
    expect(tabForRoute('pass')).toBeNull();
  });

  it('Pfade der Reiter', () => {
    expect(CONSOLE_TABS.map((tab) => tab.path)).toEqual(['#/', '#/einzelspieler', '#/online', '#/ton']);
  });

  it('Nachbarn ohne Umlauf, von null aus Start', () => {
    expect(neighborTab('start', 1)).toBe('library');
    expect(neighborTab('library', -1)).toBe('start');
    expect(neighborTab('start', -1)).toBe('start');
    expect(neighborTab('options', 1)).toBe('options');
    expect(neighborTab(null, 1)).toBe('start');
    expect(neighborTab(null, -1)).toBe('start');
  });
});

describe('Anfangsfokus (#614)', () => {
  it('gemerkt vor Hauptaktion vor erstem', () => {
    expect(pickInitialFocus(['a', 'b', 'c'], 'c', 'b')).toBe('c');
    expect(pickInitialFocus(['a', 'b', 'c'], 'x', 'b')).toBe('b');
    expect(pickInitialFocus(['a', 'b', 'c'], null, null)).toBe('a');
    expect(pickInitialFocus([], null, null)).toBeNull();
    expect(pickInitialFocus(['a', 'b', 'c'], 'c', 'b', true)).toBe('b');
    expect(pickInitialFocus(['a', 'c'], 'c', 'b', true)).toBe('c');
  });
});
