import type { CardId, PlayedCard, Trick } from '@brett-und-blatt/engine';
import { useEffect, useRef, useState } from 'react';
import { useElementSize } from '../useElementSize';
import { type DeckStyle, PlayingCard } from './PlayingCard.js';

/** Seitenlänge der Kartenfläche (ohne Skalierung) samt etwas Rand für die Namen. */
const TABLE_SIZE = 192;
const TABLE_ROOM = 240;

/** Handkarte eines Stichspiels: passt zur Breite und lässt auf flachen Bildschirmen Platz für den Tisch. */
export function trickHandCardWidth(containerWidth: number): number {
  const byHeight = typeof window === 'undefined' ? 76 : window.innerHeight * 0.15;
  return Math.round(Math.min(76, Math.max(44, containerWidth * 0.16), Math.max(40, byHeight)));
}
/** So viel bleibt von jeder überlappten Handkarte sichtbar: die Ecke mit Farbe und Wert. */
export const TRICK_HAND_MIN_STEP = 26;

export interface TrickTableSlot {
  seat: number;
  name?: string;
  card?: CardId | null;
  isLeader?: boolean;
  isWinner?: boolean;
}

/**
 * Hilfs-Hook für Stichspiele: Hält einen fertigen Stich kurz sichtbar (mit Sieger-Hervorhebung)
 * und animiert danach das Einziehen der Karten zum Siegerplatz. Standard 1 s: rund 0,75 s
 * liegt der volle Stich mit hervorgehobenem Sieger, danach fliegt er zum Sieger.
 */
export function useTrickDisplay(
  currentTrick: Trick,
  completedTricks: { winner: number; cards: PlayedCard[] }[],
  durationMs = 1000,
) {
  const [display, setDisplay] = useState<{
    cards: PlayedCard[];
    winner: number | null;
    collecting: boolean;
  }>({ cards: currentTrick, winner: null, collecting: false });

  const prevCompletedCount = useRef(completedTricks.length);
  // Der Effekt hängt an dem, was im Stich liegt, nicht an der Identität der Listen: Eine neue Sicht
  // mit gleichem Inhalt würde sonst die Sammel-Uhr abbrechen und den Stich zu früh ausblenden.
  const trickKey = `${currentTrick.map((p) => `${p.player}:${p.card}`).join(',')}|${completedTricks.length}`;

  useEffect(() => {
    if (currentTrick.length > 0) {
      prevCompletedCount.current = completedTricks.length;
      setDisplay({ cards: currentTrick, winner: null, collecting: false });
      return;
    }

    if (completedTricks.length > prevCompletedCount.current) {
      prevCompletedCount.current = completedTricks.length;
      const last = completedTricks.at(-1)!;
      setDisplay({ cards: last.cards, winner: last.winner, collecting: false });

      const collectTimer = window.setTimeout(() => {
        setDisplay((d) => (d ? { ...d, collecting: true } : d));
      }, Math.max(durationMs - 220, 250));

      const clearTimer = window.setTimeout(() => {
        setDisplay({ cards: [], winner: null, collecting: false });
      }, durationMs);

      return () => {
        window.clearTimeout(collectTimer);
        window.clearTimeout(clearTimer);
      };
    }

    setDisplay({ cards: currentTrick, winner: null, collecting: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trickKey, durationMs]);

  return display;
}

export interface TrickTableProps {
  /** Die Plätze am Tisch mit ihren im Stich gelegten Karten. */
  slots: TrickTableSlot[];
  /** Eigener Sitzplatz, der unten dargestellt wird (Default 0). */
  bottomSeat?: number;
  deckStyle?: DeckStyle;
  cardWidth?: number;
  className?: string;
  /** Ob der fertige Stich gerade zum Sieger eingezogen wird. */
  collecting?: boolean;
}

/**
 * Universelle Stich-Ablage in der Tischmitte für 3 oder 4 Spieler.
 * Platziert die Karten räumlich passend zur Sitzordnung:
 * Eigener Sitzplatz unten, die Gegenspieler links, oben bzw. rechts.
 */
export function TrickTable({
  slots,
  bottomSeat = 0,
  deckStyle = 'four-color',
  cardWidth = 72,
  className = '',
  collecting = false,
}: TrickTableProps) {
  const [tableRef, { height: tableHeight }] = useElementSize<HTMLDivElement>();
  // Der Tisch nimmt den freien Platz ein; die Karten darauf wachsen und schrumpfen mit.
  const scale = tableHeight > 0 ? Math.min(1.25, Math.max(0.4, tableHeight / TABLE_ROOM)) : 1;
  const total = slots.length;
  const winnerSlot = slots.find((s) => s.isWinner);
  const winnerDir = winnerSlot ? getRelativePosition(winnerSlot.seat) : 'bottom';

  // Berechne relative Positionen bezogen auf bottomSeat:
  // 0 = unten (Süd), 1 = links/oben-links, 2 = oben/oben-rechts, 3 = rechts
  function getRelativePosition(seat: number): 'bottom' | 'left' | 'top' | 'right' | 'top-left' | 'top-right' {
    // Über die Reihenfolge im Stich: Am Vierertisch setzt ein Platz aus, die Sitznummern haben dann Lücken.
    const order = slots.map((slot) => slot.seat);
    const rel = (order.indexOf(seat) - order.indexOf(bottomSeat) + total) % total;
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
      ref={tableRef}
      className={`bub-trick-table relative flex-1 rounded-2xl bg-emerald-950/20 border border-emerald-900/30 min-h-[90px] max-h-[320px] ${className}`}
      role="region"
      aria-label="Aktueller Stich"
    >
      <div
        className="absolute top-1/2 left-1/2 flex items-center justify-center"
        style={{ width: TABLE_SIZE, height: TABLE_SIZE, transform: `translate(-50%, -50%) scale(${scale})` }}
      >
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

          const collectClass = collecting ? 'bub-trick-collect' : 'bub-trick-in';

          return (
            <div
              // Neue Karte = neues Element, damit sie vom Platz des Spielers hereinfliegt.
              key={`${slot.seat}-${slot.card}`}
              className={`absolute transition-all duration-200 ${posClasses} ${slot.isWinner ? 'z-20 ring-4 ring-amber-400 rounded-lg shadow-lg scale-105' : 'z-10 shadow'} ${collectClass}`}
              data-winner-dir={collecting ? winnerDir : undefined}
              data-from={pos}
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
