import { describe, expect, it } from 'vitest';
import { rankSeats, type CeremonySeat } from '../apps/web/src/components/Ceremony';

const seat = (n: number, score: number | string | null): CeremonySeat => ({ seat: n, name: `P${n}`, avatar: null, symbol: null, score, you: false });

describe('Siegerehrung: Rangfolge', () => {
  it('ordnet nach Punkten, wenn die Sieger am meisten haben', () => {
    const ranked = rankSeats({ kind: 'win', winners: [2] }, [seat(0, 120), seat(1, 180), seat(2, 250), seat(3, 120)]);
    expect(ranked.map((r) => [r.seat.seat, r.place])).toEqual([
      [2, 1],
      [1, 2],
      [0, 3],
      [3, 3],
    ]);
  });

  it('dreht die Richtung um, wenn wenig Punkte gewinnen (Tiefflug)', () => {
    const ranked = rankSeats({ kind: 'win', winners: [1] }, [seat(0, 40), seat(1, 12), seat(2, 90)]);
    expect(ranked.map((r) => r.seat.seat)).toEqual([1, 0, 2]);
    expect(ranked.map((r) => r.place)).toEqual([1, 2, 3]);
  });

  it('lässt die übrigen ohne Platz, wenn Punkte fehlen oder nicht passen', () => {
    expect(rankSeats({ kind: 'win', winners: [0] }, [seat(0, null), seat(1, null)]).map((r) => r.place)).toEqual([1, null]);
    expect(rankSeats({ kind: 'win', winners: [0] }, [seat(0, 5), seat(1, 9), seat(2, 1)]).map((r) => r.place)).toEqual([1, null, null]);
  });

  it('teilt Platz 1 bei mehreren Siegern', () => {
    expect(rankSeats({ kind: 'win', winners: [0, 2] }, [seat(0, 3), seat(1, 1), seat(2, 3)]).map((r) => [r.seat.seat, r.place])).toEqual([
      [0, 1],
      [2, 1],
      [1, 3],
    ]);
  });
});
