import { describe, expect, it } from 'vitest';
import { parseFavorites, pickFavorites, toggleFavorite } from '../apps/web/src/lib/favorites';
import { games } from '../apps/web/src/lib/registry';

describe('Lieblingsspiele (#111)', () => {
  it('markiert und nimmt die Markierung zurück, Reihenfolge des Markierens', () => {
    let list = toggleFavorite([], 'chess');
    list = toggleFavorite(list, 'skat');
    expect(list).toEqual(['chess', 'skat']);
    expect(toggleFavorite(list, 'chess')).toEqual(['skat']);
  });

  it('liest nur brauchbare Listen', () => {
    expect(parseFavorites(null)).toEqual([]);
    expect(parseFavorites('kaputt')).toEqual([]);
    expect(parseFavorites('{"a":1}')).toEqual([]);
    expect(parseFavorites('["chess", 3, "chess", "<b>", "go"]')).toEqual(['chess', 'go']);
  });

  it('lässt unbekannte Spiele weg und behält die Reihenfolge', () => {
    const all = [{ id: 'chess' }, { id: 'go' }, { id: 'skat' }];
    expect(pickFavorites(['skat', 'entfernt', 'chess'], all).map((g) => g.id)).toEqual(['skat', 'chess']);
  });

  it('jede Spiel-id lässt sich speichern', () => {
    const ids = games.map((g) => g.id);
    expect(ids.length).toBeGreaterThan(20);
    expect(parseFavorites(JSON.stringify(ids))).toEqual(ids);
  });
});
