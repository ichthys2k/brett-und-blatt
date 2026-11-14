import { describe, expect, it } from 'vitest';
import { movesFor, nearestTarget } from '../apps/xr/src/scene/grab';

describe('Greifen und Ablegen (#382)', () => {
  const targets = [
    { id: 'e4', x: 0, z: 0 },
    { id: 'e5', x: 0.05, z: 0 },
  ];
  it('rastet am nächsten Ziel im Umkreis ein', () => {
    expect(nearestTarget([0.04, 0.005], targets, 0.03)?.id).toBe('e5');
    expect(nearestTarget([0.01, 0], targets, 0.03)?.id).toBe('e4');
  });
  it('Loslassen im Leeren findet kein Ziel', () => {
    expect(nearestTarget([0.3, 0.3], targets, 0.03)).toBeNull();
    expect(nearestTarget([0, 0], [], 0.03)).toBeNull();
  });
  it('ordnet gegriffene Figur und Ziel dem Zug zu, auch bei Umwandlung mit mehreren Zügen', () => {
    const moves = [
      { from: 'e7', to: 'e8', promo: 'q' },
      { from: 'e7', to: 'e8', promo: 'n' },
      { from: 'e7', to: 'd8', promo: 'q' },
      { from: 'a2', to: 'a3', promo: undefined },
    ];
    const fromTo = (from: string, to: string) => movesFor(moves, (m) => m.from, (m) => m.to, from, to);
    expect(fromTo('e7', 'e8')).toHaveLength(2);
    expect(fromTo('a2', 'a3')).toEqual([moves[3]]);
    expect(fromTo('a2', 'a4')).toEqual([]);
  });
});
