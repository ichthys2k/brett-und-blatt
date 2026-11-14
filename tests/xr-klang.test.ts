import { describe, expect, it } from 'vitest';
import { eventSpot, seatEdge, seatHead, toWorld } from '../apps/xr/src/sound-spot';

describe('Räumlicher Klang (#381)', () => {
  it('Ereignis mit Platz klingt vom Tischrand dieses Platzes', () => {
    const spot = eventSpot({ type: 'placed', seat: 1 }, (seat) => (seat === 1 ? Math.PI / 2 : null));
    expect(spot).toEqual(seatEdge(Math.PI / 2));
    expect(spot[0]).toBeGreaterThan(0.3);
  });
  it('ohne Platz oder unbekannter Platz klingt es aus der Tischmitte', () => {
    expect(eventSpot({ type: 'moved' }, () => 0)).toEqual([0, 0.8, -0.55]);
    expect(eventSpot({ type: 'placed', seat: 3 }, () => null)).toEqual([0, 0.8, -0.55]);
  });
  it('Stimme sitzt in Kopfhöhe am Platz', () => {
    const [, y, z] = seatHead(0);
    expect(y).toBe(1.2);
    expect(z).toBeCloseTo(0.45);
  });
  it('ein verkleinerter Tisch rückt die Quelle zur Tischmitte', () => {
    const [x] = toWorld([0.4, 0.74, -0.55], 0.5);
    expect(x).toBeCloseTo(0.2);
    expect(toWorld([0.4, 0.74, -0.55], 1)).toEqual([0.4, 0.74, -0.55]);
  });
});
