import type { SeatId } from '@brett-und-blatt/engine';
import type { CSSProperties, ReactNode } from 'react';

/** Ab dieser freien Spielfläche (px) und in diesem Platzbereich sitzen die Spieler um den Tisch. */
export const SEAT_RING_MIN_WIDTH = 680;
export const SEAT_RING_MIN_HEIGHT = 560;
export const SEAT_RING_MIN_SEATS = 3;
export const SEAT_RING_MAX_SEATS = 8;
/** Bis zu dieser Entfernung vom Rand (in %) sitzt ein Platz neben der Mitte, nicht darüber oder darunter. */
const SIDE_LIMIT = 22;

/** Passt der Tisch in diese Fläche? Kleine Bildschirme behalten ihre Spielerleiste. */
export function seatRingFits(seats: number, width: number, height: number): boolean {
  return seats >= SEAT_RING_MIN_SEATS && seats <= SEAT_RING_MAX_SEATS && width >= SEAT_RING_MIN_WIDTH && height >= SEAT_RING_MIN_HEIGHT;
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
}

/** Die Spieler rund um einen Tisch, das Spielgeschehen in der Mitte (nur bei genug Platz, siehe `seatRingFits`). */
export function SeatRing({ seats, bottomSeat, renderSeat, children, status, bottom }: SeatRingProps) {
  const others = Array.from({ length: seats }, (_, seat) => seat).filter((seat) => seat !== bottomSeat);
  // Seitliche Plätze begrenzen die Breite der Mitte; wer darüber oder darunter sitzt, ihre Höhe.
  const places = others.map((seat) => seatRingPosition(seat, seats, bottomSeat));
  const beside = places.filter(({ x }) => x <= SIDE_LIMIT || x >= 100 - SIDE_LIMIT);
  const inner = places.filter((place) => !beside.includes(place));
  const inset = beside.length > 0 ? Math.max(...beside.map(({ x }) => Math.min(x, 100 - x))) : 0;
  const above = inner.filter(({ y }) => y < 50);
  const below = inner.filter(({ y }) => y >= 50);
  const centerStyle: CSSProperties = {
    left: `calc(${inset.toFixed(1)}% + 5.5rem)`,
    right: `calc(${inset.toFixed(1)}% + 5.5rem)`,
    top: above.length > 0 ? `calc(${Math.max(...above.map(({ y }) => y)).toFixed(1)}% + 3.6rem)` : undefined,
    bottom: below.length > 0 ? `calc(${(100 - Math.min(...below.map(({ y }) => y))).toFixed(1)}% + 3.6rem)` : undefined,
  };
  return (
    <div className="bub-seat-ring" data-seat-ring="">
      <div className="bub-seat-ring-stage">
        <div className="bub-seat-ring-felt" aria-hidden="true" />
        {others.map((seat) => {
          const { x, y } = seatRingPosition(seat, seats, bottomSeat);
          return (
            <div key={seat} className="bub-seat-ring-seat" style={{ left: `${x.toFixed(1)}%`, top: `${y.toFixed(1)}%` } as CSSProperties}>
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
          <div className="bub-seat-ring-own">{renderSeat(bottomSeat)}</div>
          {status !== undefined && (
            <p className="bub-seat-ring-status" aria-live="polite">
              {status}
            </p>
          )}
        </div>
        {bottom}
      </div>
    </div>
  );
}
