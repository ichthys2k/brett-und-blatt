import { describe, expect, it } from 'vitest';
import { seatRingFits, seatRingPosition } from '../src/SeatRing';

describe('seatRingPosition', () => {
  it('setzt den eigenen Platz unten und die anderen im Uhrzeigersinn', () => {
    expect(seatRingPosition(2, 4, 2).y).toBeGreaterThan(90);
    expect(seatRingPosition(3, 4, 2).x).toBeLessThan(50);
    expect(seatRingPosition(0, 4, 2).y).toBeLessThan(10);
    expect(seatRingPosition(1, 4, 2).x).toBeGreaterThan(50);
  });

  it('bleibt für jede Platzzahl auf der Fläche', () => {
    for (let seats = 3; seats <= 8; seats++) {
      for (let seat = 0; seat < seats; seat++) {
        const { x, y } = seatRingPosition(seat, seats, 0);
        expect(Math.min(x, y)).toBeGreaterThanOrEqual(0);
        expect(Math.max(x, y)).toBeLessThanOrEqual(100);
      }
    }
  });
});

describe('seatRingFits', () => {
  it('gilt nur bei genug Platz und drei bis acht Plätzen', () => {
    expect(seatRingFits(3, 960, 760)).toBe(true);
    expect(seatRingFits(8, 960, 760)).toBe(true);
    expect(seatRingFits(2, 960, 760)).toBe(false);
    expect(seatRingFits(9, 960, 760)).toBe(false);
    expect(seatRingFits(4, 390, 600)).toBe(false);
    expect(seatRingFits(4, 700, 400)).toBe(false);
  });
});
