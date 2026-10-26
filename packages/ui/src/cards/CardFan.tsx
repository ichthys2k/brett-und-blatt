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
  /** Löst einen haptischen Misch-Wischeffekt auf den Karten aus. */
  shuffling?: boolean;
  /** Eingangsanimation für die Karten (z. B. 'deal' beim Austeilen). */
  anim?: 'deal' | null;
}

/**
 * Eine Kartenreihe, die sich überlappt, sobald der Platz nicht reicht – für die
 * eigene Hand genauso wie für die verdeckte Hand eines Mitspielers.
 */
export function CardFan({ count, renderCard, cardWidth, label, className = '', shuffling, anim }: CardFanProps) {
  const [ref, { width }] = useElementSize<HTMLDivElement>();
  const needed = count * cardWidth;
  const overlap = count > 1 && width > 0 && needed > width ? (needed - width) / (count - 1) : 0;
  return (
    <div ref={ref} className={`bub-fan ${className}`} role="group" aria-label={label}>
      {Array.from({ length: count }, (_, index) => {
        const slotClasses = `bub-fan-slot ${shuffling ? 'bub-animate-shuffle' : ''} ${anim === 'deal' ? 'bub-animate-deal' : ''}`;
        const delay = shuffling ? `${(index % 6) * 40}ms` : anim === 'deal' ? `${Math.min(index * 35, 300)}ms` : undefined;
        return (
          <div
            key={index}
            className={slotClasses}
            style={{ width: cardWidth, marginLeft: index === 0 ? 0 : -overlap, animationDelay: delay }}
          >
            {renderCard(index)}
          </div>
        );
      })}
    </div>
  );
}
