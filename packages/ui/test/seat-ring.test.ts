import { describe, expect, it } from 'vitest';
import { seatRingFits, seatRingPosition } from '../src/SeatRing';
import { ownSeatScale, seatRingScale } from '../src/SeatRingScale';

describe('seatRingPosition', () => {
  it('setzt den eigenen Platz unten und die anderen im Uhrzeigersinn', () => {
    expect(seatRingPosition(2, 4, 2).y).toBeGreaterThan(90);
    expect(seatRingPosition(3, 4, 2).x).toBeLessThan(50);
    expect(seatRingPosition(0, 4, 2).y).toBeLessThan(10);
    expect(seatRingPosition(1, 4, 2).x).toBeGreaterThan(50);
  });

  it('bleibt für jede Platzzahl auf der Fläche', () => {
    for (let seats = 3; seats <= 10; seats++) {
      for (let seat = 0; seat < seats; seat++) {
        const { x, y } = seatRingPosition(seat, seats, 0);
        expect(Math.min(x, y)).toBeGreaterThanOrEqual(0);
        expect(Math.max(x, y)).toBeLessThanOrEqual(100);
      }
    }
  });
});

describe('seatRingFits', () => {
  it('gilt nur bei genug Platz und drei bis acht Plätzen (Poker weitet auf zwei bis zehn)', () => {
    expect(seatRingFits(3, 960, 760)).toBe(true);
    expect(seatRingFits(8, 960, 760)).toBe(true);
    expect(seatRingFits(9, 960, 760)).toBe(false);
    expect(seatRingFits(10, 960, 760, { minSeats: 2, maxSeats: 10 })).toBe(true);
    expect(seatRingFits(2, 960, 760)).toBe(false);
    expect(seatRingFits(2, 960, 760, { minSeats: 2 })).toBe(true);
    expect(seatRingFits(11, 960, 760, { minSeats: 2, maxSeats: 10 })).toBe(false);
    expect(seatRingFits(4, 390, 600)).toBe(false);
    expect(seatRingFits(4, 672, 700)).toBe(false);
    expect(seatRingFits(4, 672, 700, { minWidth: 640 })).toBe(true);
    expect(seatRingFits(4, 700, 400)).toBe(false);
  });
});

describe('seatRingScale (#494)', () => {
  it('bleibt auf kleinen Tischen kompakt', () => {
    expect(seatRingScale(4, 976, 624)).toBe('compact'); // Fenster 1024 × 768
    expect(seatRingScale(8, 1131, 800)).toBe('compact');
    expect(seatRingScale(4, 1400, 575)).toBe('compact');
  });
  it('wählt medium und large nach Bühne und Platzzahl', () => {
    expect(seatRingScale(4, 1132, 576)).toBe('medium');
    expect(seatRingScale(3, 1392, 756)).toBe('large'); // Fenster 1440 × 900
    expect(seatRingScale(5, 1363, 771)).toBe('medium');
    expect(seatRingScale(5, 1872, 936)).toBe('large');
    expect(seatRingScale(6, 1203, 671)).toBe('compact'); // Fenster 1280 × 800
    expect(seatRingScale(6, 1392, 756)).toBe('medium');
    expect(seatRingScale(8, 1392, 756)).toBe('compact');
    expect(seatRingScale(8, 1872, 936)).toBe('medium');
    expect(seatRingScale(9, 1872, 936)).toBe('compact');
  });
  it('der eigene Platz sitzt eine Stufe kleiner', () => {
    expect(ownSeatScale('large')).toBe('medium');
    expect(ownSeatScale('medium')).toBe('compact');
    expect(ownSeatScale('compact')).toBe('compact');
  });
});
