import type { ReactNode } from 'react';
import { useElementSize } from '../useElementSize';

export interface CardFanProps {
  count: number;
  /** Zeichnet die Karte an Position `index` (z. B. ein PlayingCard). */
  renderCard: (index: number) => ReactNode;
  /** Kartenbreite in Pixeln. */
  cardWidth: number;
  label: string;
  className?: string;
}

/**
 * Eine Kartenreihe, die sich überlappt, sobald der Platz nicht reicht – für die
 * eigene Hand genauso wie für die verdeckte Hand eines Mitspielers.
 */
export function CardFan({ count, renderCard, cardWidth, label, className = '' }: CardFanProps) {
  const [ref, { width }] = useElementSize<HTMLDivElement>();
  const needed = count * cardWidth;
  const overlap = count > 1 && width > 0 && needed > width ? (needed - width) / (count - 1) : 0;
  return (
    <div ref={ref} className={`bub-fan ${className}`} role="group" aria-label={label}>
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="bub-fan-slot" style={{ width: cardWidth, marginLeft: index === 0 ? 0 : -overlap }}>
          {renderCard(index)}
        </div>
      ))}
    </div>
  );
}
