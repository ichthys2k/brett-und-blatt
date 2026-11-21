import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { pickInitialFocus } from '../src/console/consoleFocus';
import { CONSOLE_TABS, ROUTES_WITHOUT_PLACE, neighborTab, placeForRoute, tabForRoute } from '../src/console/consoleTabs';

describe('Navigation der Konsole (#614, #638)', () => {
  it('ordnet Routen Haupt- und Unterreitern zu', () => {
    expect(placeForRoute('menu')).toEqual({ tab: 'start', sub: null });
    expect(placeForRoute('home')).toEqual({ tab: 'library', sub: 'games' });
    expect(placeForRoute('setup')).toEqual({ tab: 'library', sub: 'games' });
    expect(placeForRoute('learning')).toEqual({ tab: 'library', sub: 'learn' });
    expect(placeForRoute('helpers')).toEqual({ tab: 'library', sub: 'helpers' });
    expect(placeForRoute('room')).toEqual({ tab: 'online', sub: 'play' });
    expect(placeForRoute('board')).toEqual({ tab: 'online', sub: 'board' });
    expect(placeForRoute('series')).toEqual({ tab: 'online', sub: 'tournaments' });
    expect(placeForRoute('class')).toEqual({ tab: 'online', sub: 'classes' });
    expect(placeForRoute('org')).toEqual({ tab: 'online', sub: 'orgs' });
    expect(placeForRoute('passView')).toEqual({ tab: 'pass', sub: 'pass' });
    expect(placeForRoute('account')).toEqual({ tab: 'pass', sub: 'account' });
    expect(placeForRoute('sound')).toEqual({ tab: 'options', sub: null });
    expect(placeForRoute('imprint')).toEqual({ tab: 'options', sub: null });
    expect(placeForRoute('play')).toBeNull();
    expect(tabForRoute('tournament')).toBe('online');
    expect(tabForRoute('display')).toBeNull();
  });

  it('jede Route hat einen Platz oder steht ausdrücklich ohne Rahmen da', () => {
    const source = readFileSync(new URL('../src/lib/router.ts', import.meta.url), 'utf8');
    const block = source.slice(source.indexOf('export type Route ='), source.indexOf('function parseQuery'));
    const names = [...block.matchAll(/\{ name: '(\w+)'/g)].map((match) => match[1]!);
    expect(names.length).toBeGreaterThan(30);
    for (const name of names) {
      const placed = placeForRoute(name) !== null;
      const without = ROUTES_WITHOUT_PLACE.includes(name);
      expect(placed !== without, `Route ${name}: ${placed ? 'Platz und ohne Rahmen zugleich' : 'weder Platz noch ohne Rahmen'}`).toBe(true);
    }
  });

  it('keine Route steht in zwei Unterreitern', () => {
    const all = CONSOLE_TABS.flatMap((tab) => [...tab.routes, ...tab.sub.flatMap((sub) => sub.routes)]);
    expect(new Set(all).size).toBe(all.length);
  });

  it('fünf Hauptreiter mit ihren Pfaden', () => {
    expect(CONSOLE_TABS.map((tab) => tab.id)).toEqual(['start', 'library', 'online', 'pass', 'options']);
    expect(CONSOLE_TABS.map((tab) => tab.path)).toEqual(['#/', '#/einzelspieler', '#/online', '#/pass', '#/ton']);
  });

  it('Nachbarn ohne Umlauf, von null aus Start', () => {
    expect(neighborTab('start', 1)).toBe('library');
    expect(neighborTab('library', -1)).toBe('start');
    expect(neighborTab('start', -1)).toBe('start');
    expect(neighborTab('online', 1)).toBe('pass');
    expect(neighborTab('pass', 1)).toBe('options');
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
