import { describe, expect, it } from 'vitest';
import { getActivePlayers, handToSeat, nextDealerIndex, seatToHand } from '../src/index.js';

describe('Serien-Rahmen', () => {
  it('rotiert den Geber im Uhrzeigersinn', () => {
    expect(nextDealerIndex(0, 3)).toBe(1);
    expect(nextDealerIndex(1, 3)).toBe(2);
    expect(nextDealerIndex(2, 3)).toBe(0);
  });

  it('ermittelt aktive Spieler am Dreiertisch (alle spielen)', () => {
    // Geber = 0 -> Vorhand = 1, Mittelhand = 2, Hinterhand = 0
    expect(getActivePlayers(0, 3, 3)).toEqual([1, 2, 0]);
    // Geber = 2 -> Vorhand = 0, Mittelhand = 1, Hinterhand = 2
    expect(getActivePlayers(2, 3, 3)).toEqual([0, 1, 2]);
  });

  it('ermittelt aktive Spieler am Vierertisch (Geber setzt aus)', () => {
    // Geber = 0 setzt aus -> 1, 2, 3 spielen
    expect(getActivePlayers(0, 4, 3)).toEqual([1, 2, 3]);
    // Geber = 2 setzt aus -> 3, 0, 1 spielen
    expect(getActivePlayers(2, 4, 3)).toEqual([3, 0, 1]);
  });

  it('konvertiert Handpositionen und Sitzplätze', () => {
    const active = [3, 0, 1]; // Geber 2 setzt aus
    expect(handToSeat(0, active)).toBe(3); // Vorhand sitzt auf Platz 3
    expect(handToSeat(1, active)).toBe(0); // Mittelhand sitzt auf Platz 0
    expect(seatToHand(3, active)).toBe(0);
    expect(seatToHand(2, active)).toBe(-1); // Geber setzt aus
  });
});
