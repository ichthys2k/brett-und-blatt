import { createContext, useContext } from 'react';

/** Größe der Sitzschilder am Tisch: `compact` wie bisher, `medium` und `large` auf großen Bildschirmen (#494). */
export type SeatRingScale = 'compact' | 'medium' | 'large';

/** Breite des Wappenschilds in px je Stufe (`compact` zeigt kein Schild). */
export const SEAT_SHIELD_SIZE: Record<SeatRingScale, number> = { compact: 0, medium: 56, large: 80 };

/** Stufe der Sitzschilder; `PlayerChip` liest sie. Außerhalb eines `SeatRing` gilt `compact`, also was die Eigenschaften sagen. */
export const SeatRingScaleContext = createContext<SeatRingScale>('compact');

export function useSeatRingScale(): SeatRingScale {
  return useContext(SeatRingScaleContext);
}

/** Der eigene Platz unten sitzt eine Stufe kleiner, damit die eigene Hand nicht schrumpft. */
export function ownSeatScale(scale: SeatRingScale): SeatRingScale {
  return scale === 'large' ? 'medium' : 'compact';
}

/**
 * Größe der Sitzschilder: 'compact' wie bisher, 'medium' oder 'large' je nach Bühne und Platzzahl.
 * Gemessen wird die Fläche des Rings selbst, sie ist etwa 48 px schmaler und 144 px niedriger als das Fenster.
 * Die Plätze liegen fest auf dem Oval (`seatRingPosition`); bei 5 und mehr Plätzen rücken Nachbarn so nah,
 * dass breitere Schilder erst bei mehr Platz passen (Abstände gemessen mit dem Rauchtest).
 *  - bis 4 Plätze: `large` ab 1312 × 716 (Fenster 1360 × 860), `medium` ab 1132 × 576 (Fenster 1180 × 720)
 *  - 5 Plätze: `large` ab 1580 breit, `medium` ab 1312 × 716
 *  - 6 Plätze: `medium` ab 1312 × 716
 *  - 7 und 8 Plätze: `medium` ab 1800 × 900
 */
export function seatRingScale(seats: number, width: number, height: number): SeatRingScale {
  const wide = width >= 1312 && height >= 716;
  if (seats <= 4) {
    if (wide) return 'large';
    return width >= 1132 && height >= 576 ? 'medium' : 'compact';
  }
  if (seats === 5) {
    if (wide && width >= 1580) return 'large';
    return wide ? 'medium' : 'compact';
  }
  if (seats === 6) return wide ? 'medium' : 'compact';
  return seats <= 8 && width >= 1800 && height >= 900 ? 'medium' : 'compact';
}
