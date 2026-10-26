import type { CardId } from '@brett-und-blatt/engine';
import { type DeckStyle, PlayingCard } from './PlayingCard.js';

export interface TrickTableSlot {
  seat: number;
  name?: string;
  card?: CardId | null;
  isLeader?: boolean;
  isWinner?: boolean;
}

export interface TrickTableProps {
  /** Die Plätze am Tisch mit ihren im Stich gelegten Karten. */
  slots: TrickTableSlot[];
  /** Eigener Sitzplatz, der unten dargestellt wird (Default 0). */
  bottomSeat?: number;
  deckStyle?: DeckStyle;
  cardWidth?: number;
  className?: string;
}

/**
 * Universelle Stich-Ablage in der Tischmitte für 3 oder 4 Spieler.
 * Platziert die Karten räumlich passend zur Sitzordnung:
 * Eigener Sitzplatz unten, die Gegenspieler links, oben bzw. rechts.
 */
export function TrickTable({
  slots,
  bottomSeat = 0,
  deckStyle = 'french',
  cardWidth = 72,
  className = '',
}: TrickTableProps) {
  const total = slots.length;

  // Berechne relative Positionen bezogen auf bottomSeat:
  // 0 = unten (Süd), 1 = links/oben-links, 2 = oben/oben-rechts, 3 = rechts
  function getRelativePosition(seat: number): 'bottom' | 'left' | 'top' | 'right' | 'top-left' | 'top-right' {
    const rel = (seat - bottomSeat + total) % total;
    if (total === 3) {
      if (rel === 0) return 'bottom';
      if (rel === 1) return 'top-left';
      return 'top-right';
    }
    // 4 Spieler
    if (rel === 0) return 'bottom';
    if (rel === 1) return 'left';
    if (rel === 2) return 'top';
    return 'right';
  }

  return (
    <div
      className={`bub-trick-table relative flex items-center justify-center rounded-2xl bg-emerald-950/20 border border-emerald-900/30 p-4 min-h-[220px] sm:min-h-[260px] ${className}`}
      role="region"
      aria-label="Aktueller Stich"
    >
      <div className="relative w-48 h-48 sm:w-56 sm:h-56 flex items-center justify-center">
        {slots.map((slot) => {
          if (!slot.card) return null;
          const pos = getRelativePosition(slot.seat);
          let posClasses = '';
          switch (pos) {
            case 'bottom':
              posClasses = 'bottom-0 left-1/2 -translate-x-1/2 translate-y-2';
              break;
            case 'top':
              posClasses = 'top-0 left-1/2 -translate-x-1/2 -translate-y-2';
              break;
            case 'left':
              posClasses = 'left-0 top-1/2 -translate-y-1/2 -translate-x-2';
              break;
            case 'right':
              posClasses = 'right-0 top-1/2 -translate-y-1/2 translate-x-2';
              break;
            case 'top-left':
              posClasses = 'top-2 left-4 -rotate-6';
              break;
            case 'top-right':
              posClasses = 'top-2 right-4 rotate-6';
              break;
          }

          return (
            <div
              key={slot.seat}
              className={`absolute transition-all duration-200 ${posClasses} ${slot.isWinner ? 'z-20 ring-4 ring-amber-400 rounded-lg shadow-lg scale-105' : 'z-10 shadow'}`}
              style={{ width: cardWidth }}
            >
              <PlayingCard card={slot.card} deckStyle={deckStyle} />
              {slot.name && (
                <div className="text-center text-[11px] font-medium text-stone-700 dark:text-stone-300 truncate max-w-[80px] mt-0.5 mx-auto">
                  {slot.name}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
