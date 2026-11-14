import { describe, expect, it } from 'vitest';
import { diffFlights, type CardView, type Face } from '../apps/xr/src/scene/card-views';

const face = (n: string): Face => ({ center: n, corner: n, color: '#000', background: '#fff' });
const view = (over: Partial<CardView>): CardView => ({ hand: [], piles: [], trick: [], rows: [], stock: 10, others: [], ...over });
const hand = (...ids: string[]) => ids.map((id) => ({ id, face: face(id) }));

describe('Kartenflug (#366)', () => {
  it('ohne vorige Sicht fliegt nichts', () => {
    const f = diffFlights(null, view({ hand: hand('a'), piles: [face('7')] }), { mySeat: 0, deal: false });
    expect(f.piles).toEqual([]);
    expect(f.handDraws).toEqual({});
  });

  it('eigene Karte fliegt von ihrem Platz im Fächer auf die Ablage', () => {
    const prev = view({ hand: hand('a', 'b', 'c'), piles: [face('5')], others: [{ seat: 1, count: 4 }] });
    const next = view({ hand: hand('a', 'c'), piles: [face('b')], others: [{ seat: 1, count: 4 }] });
    const f = diffFlights(prev, next, { mySeat: 0, deal: false });
    expect(f.piles[0]).toEqual({ kind: 'hand', index: 1, count: 3 });
  });

  it('Karte eines Gegners fliegt von seinem Platz, wenn seine Hand kleiner wurde', () => {
    const prev = view({ hand: hand('a'), piles: [face('5')], others: [{ seat: 1, count: 4 }, { seat: 2, count: 4 }] });
    const next = view({ hand: hand('a'), piles: [face('9')], others: [{ seat: 1, count: 4 }, { seat: 2, count: 3 }] });
    expect(diffFlights(prev, next, { mySeat: 0, deal: false }).piles[0]).toEqual({ kind: 'seat', seat: 2 });
  });

  it('mehrere gleichzeitige Spieler: Herkunft unbekannt, kein Flug', () => {
    const prev = view({ piles: [face('5')], others: [{ seat: 1, count: 4 }, { seat: 2, count: 4 }] });
    const next = view({ piles: [face('9')], others: [{ seat: 1, count: 3 }, { seat: 2, count: 3 }] });
    expect(diffFlights(prev, next, { mySeat: 0, deal: false }).piles[0]).toBeNull();
  });

  it('Ziehen: neue eigene Karte vom Stapel, Gegner bekommt Karten dazu', () => {
    const prev = view({ hand: hand('a'), others: [{ seat: 1, count: 3 }] });
    const next = view({ hand: hand('a', 'z'), others: [{ seat: 1, count: 5 }] });
    const f = diffFlights(prev, next, { mySeat: 0, deal: false });
    expect(f.handDraws).toEqual({ z: { kind: 'stock' } });
    expect(f.otherDraws).toEqual({ 1: 2 });
  });

  it('Stich: neue Karte kommt von dem Platz, der sie gespielt hat', () => {
    const prev = view({ trick: [{ seat: 1, faces: [face('x')] }] });
    const next = view({ trick: [{ seat: 1, faces: [face('x')] }, { seat: 2, faces: [face('y')] }] });
    expect(diffFlights(prev, next, { mySeat: 0, deal: false }).trick).toEqual([null, { kind: 'seat', seat: 2 }]);
  });

  it('neue Runde teilt vom Stapel aus', () => {
    const f = diffFlights(null, view({ hand: hand('a', 'b'), others: [{ seat: 1, count: 2 }] }), { mySeat: 0, deal: true });
    expect(f.deal).toBe(true);
    expect(Object.keys(f.handDraws)).toEqual(['a', 'b']);
    expect(f.otherDraws).toEqual({ 1: 2 });
  });
});
