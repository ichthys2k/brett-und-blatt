import { describe, expect, it } from 'vitest';
import { trickCounts } from '../apps/xr/src/scene/card-views';
import { fourChessLost, millCaptured } from '../apps/xr/src/scene/captured';

const game = (gameId: string, view: unknown, seats = 3) => ({ gameId, view, seats: Array.from({ length: seats }, () => ({})) }) as unknown as Parameters<typeof trickCounts>[0];

describe('Geschlagenes und gewonnene Stiche (#390)', () => {
  it('zählt Stiche je Gewinner und nennt keine Karten', () => {
    const view = { completedTricks: [{ winner: 1, cards: ['x'] }, { winner: 1, cards: ['y'] }, { winner: 2, cards: ['z'] }] };
    expect(trickCounts(game('skat', view))).toEqual([0, 2, 1]);
  });
  it('kein Stapel, wo die Sicht keine Stiche nennt oder noch keiner gewonnen ist', () => {
    expect(trickCounts(game('skat', { completedTricks: [] }))).toBeNull();
    expect(trickCounts(game('mau-mau', { completedTricks: [{ winner: 0 }] }))).toBeNull();
    expect(trickCounts(game('skat', {}))).toBeNull();
    expect(trickCounts(game('skat', { completedTricks: [{ winner: 9 }, { winner: 'x' }] }))).toBeNull();
  });
  it('Mühle: fehlende Steine aus Brett und Vorrat', () => {
    const cells = [0, 0, 1, null, 1, 1, null];
    expect(millCaptured(cells, [5, 4])).toEqual([2, 2]);
    expect(millCaptured([], [9, 9])).toEqual([0, 0]);
    expect(millCaptured([], [0, 0])).toEqual([9, 9]);
  });
  it('Vierer-Schach: fehlende Figuren je Farbe, nie negativ', () => {
    const full = [...'QRRBBNN'].map((t) => ({ c: 'r', t })).concat(Array.from({ length: 8 }, () => ({ c: 'r', t: 'P' })));
    expect(fourChessLost(full).r).toEqual([]);
    const lostQ = full.filter((p) => p.t !== 'Q');
    expect(fourChessLost(lostQ).r).toEqual(['Q']);
    const extra = [...full, { c: 'r', t: 'Q' }];
    expect(fourChessLost(extra).r).toEqual([]);
  });
});
