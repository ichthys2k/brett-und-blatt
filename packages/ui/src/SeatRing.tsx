import type { SeatId } from '@brett-und-blatt/engine';
import type { CSSProperties, ReactNode } from 'react';
import { SeatRingScaleContext, ownSeatScale, seatRingScale, type SeatRingScale } from './SeatRingScale';
import { useElementSize } from './useElementSize';

/** Ab dieser freien Spielfläche (px) und in diesem Platzbereich sitzen die Spieler um den Tisch. */
export const SEAT_RING_MIN_WIDTH = 680;
export const SEAT_RING_MIN_HEIGHT = 560;
export const SEAT_RING_MIN_SEATS = 3;
export const SEAT_RING_MAX_SEATS = 8;
/** Poker setzt bis zu zehn Spieler um den Tisch (`seatRingFits` mit `maxSeats`). */
export const SEAT_RING_WIDE_MAX_SEATS = 10;
/** Poker braucht weniger Breite: Seine Sitzschilder sind schmaler als die allgemeinen Chips (siehe `.poker-ring`). */
export const SEAT_RING_POKER_MIN_WIDTH = 640;
/** Bis zu dieser Entfernung vom Rand (in %) sitzt ein Platz neben der Mitte, nicht darüber oder darunter. */
const SIDE_LIMIT = 22;
/** Halbe Breite eines Platzes (siehe `.bub-seat-ring-seat`): So weit bleibt seine Mitte vom Rand weg. */
const SEAT_HALF_WIDTH = 'calc(var(--bub-seat-w) / 2)';
/** Hält die Mitte eines Platzes (y in %) um seine halbe Höhe vom oberen und unteren Rand weg (bei `compact` ist die Höhe 0, es ändert sich nichts). */
function seatY(y: number): string {
  return `clamp(var(--bub-seat-h) / 2, ${y.toFixed(1)}%, 100% - var(--bub-seat-h) / 2)`;
}

export interface SeatRingFitOptions {
  /** Kleinste Platzzahl (Standard 3; Poker auch zu zweit). */
  minSeats?: number;
  /** Größte Platzzahl (Standard 8; Poker bis 10). */
  maxSeats?: number;
  /** Kleinste Breite in px (Standard 680). */
  minWidth?: number;
}

/** Passt der Tisch in diese Fläche? Kleine Bildschirme behalten ihre Spielerleiste. Mit `options` weitet ein Spiel den Bereich (Poker: 2 bis 10 Plätze, ab 640 px). */
export function seatRingFits(seats: number, width: number, height: number, options: SeatRingFitOptions = {}): boolean {
  const { minSeats = SEAT_RING_MIN_SEATS, maxSeats = SEAT_RING_MAX_SEATS, minWidth = SEAT_RING_MIN_WIDTH } = options;
  return seats >= minSeats && seats <= maxSeats && width >= minWidth && height >= SEAT_RING_MIN_HEIGHT;
}

/**
 * Position eines Platzes (in %) auf dem Oval. `bottomSeat` sitzt unten, die anderen folgen im
 * Uhrzeigersinn, also in derselben Lage wie die Karten auf dem `TrickTable`.
 */
export function seatRingPosition(seat: SeatId, seats: number, bottomSeat: SeatId): { x: number; y: number } {
  const rel = (seat - bottomSeat + seats) % seats;
  const angle = Math.PI / 2 + (rel / seats) * Math.PI * 2;
  return { x: 50 + Math.cos(angle) * 42, y: 50 + Math.sin(angle) * 41 };
}

export interface SeatRingProps {
  seats: number;
  /** Der Platz unten: der eigene, bei Zuschauern Platz 0. */
  bottomSeat: SeatId;
  /** Inhalt eines Platzes, meist der Chip aus `BoardProps.table` und die Karten des Mitspielers. */
  renderSeat: (seat: SeatId) => ReactNode;
  /** Das Spielgeschehen in der Tischmitte. */
  children: ReactNode;
  /** Neben dem eigenen Platz, meist `status` aus `BoardProps.table`: Wer dran ist, steht dort, wo man hinschaut. */
  status?: ReactNode;
  /** Unter dem Tisch beim eigenen Platz, etwa die Handkarten. */
  bottom?: ReactNode;
  /** Feste Stufe der Sitzschilder statt der Wahl nach Bühnengröße (Poker: `compact`, es hat eigene schmale Schilder). */
  scale?: SeatRingScale;
}

/** Die Spieler rund um einen Tisch, das Spielgeschehen in der Mitte (nur bei genug Platz, siehe `seatRingFits`). */
export function SeatRing({ seats, bottomSeat, renderSeat, children, status, bottom, scale: fixedScale }: SeatRingProps) {
  const [ref, { width, height }] = useElementSize<HTMLDivElement>();
  const scale = fixedScale ?? seatRingScale(seats, width, height);
  const others = Array.from({ length: seats }, (_, seat) => seat).filter((seat) => seat !== bottomSeat);
  // Seitliche Plätze begrenzen die Breite der Mitte; wer darüber oder darunter sitzt, ihre Höhe.
  const places = others.map((seat) => seatRingPosition(seat, seats, bottomSeat));
  const beside = places.filter(({ x }) => x <= SIDE_LIMIT || x >= 100 - SIDE_LIMIT);
  const inner = places.filter((place) => !beside.includes(place));
  const inset = beside.length > 0 ? Math.max(...beside.map(({ x }) => Math.min(x, 100 - x))) : 0;
  const above = inner.filter(({ y }) => y < 50);
  const below = inner.filter(({ y }) => y >= 50);
  const centerStyle: CSSProperties = {
    left: `calc(max(${inset.toFixed(1)}%, ${SEAT_HALF_WIDTH}) + var(--bub-seat-gap-x))`,
    right: `calc(max(${inset.toFixed(1)}%, ${SEAT_HALF_WIDTH}) + var(--bub-seat-gap-x))`,
    top: above.length > 0 ? `calc(${seatY(Math.max(...above.map(({ y }) => y)))} + var(--bub-seat-gap-y))` : undefined,
    bottom: below.length > 0 ? `calc(100% - ${seatY(Math.min(...below.map(({ y }) => y)))} + var(--bub-seat-gap-y))` : undefined,
  };
  return (
    <SeatRingScaleContext.Provider value={scale}>
    <div ref={ref} className="bub-seat-ring" data-seat-ring="" data-scale={scale}>
      <div className="bub-seat-ring-stage">
        <div className="bub-seat-ring-felt" aria-hidden="true" />
        {others.map((seat) => {
          const { x, y } = seatRingPosition(seat, seats, bottomSeat);
          return (
            <div key={seat} className="bub-seat-ring-seat" style={{ left: `clamp(${SEAT_HALF_WIDTH}, ${x.toFixed(1)}%, calc(100% - ${SEAT_HALF_WIDTH}))`, top: seatY(y) } as CSSProperties}>
              {renderSeat(seat)}
            </div>
          );
        })}
        <div className="bub-seat-ring-center" style={centerStyle}>
          {children}
        </div>
      </div>
      <div className="bub-seat-ring-bottom">
        <div className="bub-seat-ring-self">
          <div className="bub-seat-ring-own">
            <SeatRingScaleContext.Provider value={ownSeatScale(scale)}>{renderSeat(bottomSeat)}</SeatRingScaleContext.Provider>
          </div>
          {status !== undefined && (
            <p className="bub-seat-ring-status" aria-live="polite">
              {status}
            </p>
          )}
        </div>
        {bottom}
      </div>
    </div>
    </SeatRingScaleContext.Provider>
  );
}
