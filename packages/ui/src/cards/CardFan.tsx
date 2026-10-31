import type { Key, ReactNode } from 'react';
import { useElementSize } from '../useElementSize';

export interface CardFanProps {
  count: number;
  /** Zeichnet die Karte an Position `index` (z. B. ein PlayingCard). */
  renderCard: (index: number) => ReactNode;
  /** Kartenbreite in Pixeln – fest oder abhängig von der verfügbaren Breite. */
  cardWidth: number | ((containerWidth: number) => number);
  label: string;
  className?: string;
  /** Löst einen haptischen Misch-Wischeffekt auf den Karten aus. */
  shuffling?: boolean;
  /** Eingangsanimation für die Karten (z. B. 'deal' beim Austeilen). */
  anim?: 'deal' | null;
  /** Schlüssel je Karte (Standard: Position), damit React Karten beim Legen nicht verwechselt. */
  keyOf?: (index: number) => Key;
  /**
   * Wie viele Pixel jeder Karte mindestens sichtbar bleiben (die Ecke mit dem Kartenwert).
   * Reicht der Platz dafür nicht, bricht der Fächer in weitere Reihen um (höchstens `maxRows`).
   * Ohne Angabe bleibt es bei einer Reihe, die sich beliebig eng überlappt.
   */
  minStep?: number | ((cardWidth: number) => number);
  /** Höchstzahl der Reihen beim Umbrechen (Standard 3); danach rücken die Karten enger zusammen. */
  maxRows?: number;
  /** Höhe je Breite der Karten für das Überlappen der Reihen (Standard 7/5). */
  cardAspect?: number;
  /** Anteil der Kartenhöhe, den die nächste Reihe verdeckt (Standard 0,5 – die obere Hälfte bleibt sichtbar). */
  rowOverlap?: number;
  /** Gesamtwinkel in Grad, um den die Karten einer Reihe aufgefächert werden (Standard 0). */
  arc?: number;
}

export interface FanLayout {
  rows: number;
  perRow: number;
  /** Abstand von Kartenanfang zu Kartenanfang innerhalb einer Reihe. */
  step: number;
}

/** Verteilt `count` Karten der Breite `cardWidth` auf `width` Pixel, notfalls auf mehrere Reihen. */
export function fanLayout(count: number, cardWidth: number, width: number, minStep?: number, maxRows = 3): FanLayout {
  const stepFor = (perRow: number) =>
    perRow <= 1 || width <= 0 || perRow * cardWidth <= width ? cardWidth : Math.max(0, (width - cardWidth) / (perRow - 1));
  let rows = 1;
  let perRow = count;
  let step = stepFor(perRow);
  if (minStep === undefined) return { rows, perRow, step };
  while (step < minStep && rows < maxRows && perRow > 1) {
    rows++;
    perRow = Math.ceil(count / rows);
    step = stepFor(perRow);
  }
  return { rows, perRow, step };
}

/**
 * Eine Kartenreihe, die sich überlappt, sobald der Platz nicht reicht – für die
 * eigene Hand genauso wie für die verdeckte Hand eines Mitspielers. Mit `minStep`
 * bricht sie in weitere Reihen um, sodass jede Karte erkennbar bleibt.
 */
export function CardFan({
  count,
  renderCard,
  cardWidth: cardWidthProp,
  label,
  className = '',
  shuffling,
  anim,
  keyOf,
  minStep: minStepProp,
  maxRows = 3,
  cardAspect = 7 / 5,
  rowOverlap = 0.5,
  arc = 0,
}: CardFanProps) {
  const [ref, { width }] = useElementSize<HTMLDivElement>();
  const cardWidth = typeof cardWidthProp === 'function' ? cardWidthProp(width) : cardWidthProp;
  const minStep = typeof minStepProp === 'function' ? minStepProp(cardWidth) : minStepProp;
  const { rows, perRow, step } = fanLayout(count, cardWidth, width, minStep, maxRows);
  const overlap = cardWidth - step;
  const height = cardWidth * cardAspect;

  const slot = (index: number, inRow: number, rowSize: number) => {
    const slotClasses = `bub-fan-slot ${shuffling ? 'bub-animate-shuffle' : ''} ${anim === 'deal' ? 'bub-animate-deal' : ''}`;
    const delay = shuffling ? `${(index % 6) * 40}ms` : anim === 'deal' ? `${Math.min(index * 35, 300)}ms` : undefined;
    const angle = arc && rowSize > 1 ? (inRow / (rowSize - 1) - 0.5) * arc : 0;
    return (
      <div
        key={keyOf ? keyOf(index) : index}
        className={slotClasses}
        style={{
          width: cardWidth,
          marginLeft: inRow === 0 ? 0 : -overlap,
          animationDelay: delay,
          ...(angle ? { rotate: `${angle}deg`, transformOrigin: '50% 100%' } : {}),
        }}
      >
        {renderCard(index)}
      </div>
    );
  };

  if (rows <= 1) {
    return (
      <div ref={ref} className={`bub-fan ${className}`} role="group" aria-label={label}>
        {Array.from({ length: count }, (_, index) => slot(index, index, count))}
      </div>
    );
  }

  return (
    <div ref={ref} className={`bub-fan bub-fan-rows ${className}`} role="group" aria-label={label}>
      {Array.from({ length: rows }, (_, row) => {
        const start = row * perRow;
        const size = Math.max(0, Math.min(perRow, count - start));
        return (
          <div key={row} className="bub-fan-row" style={row === 0 ? undefined : { marginTop: -height * rowOverlap }}>
            {Array.from({ length: size }, (_, inRow) => slot(start + inRow, inRow, size))}
          </div>
        );
      })}
    </div>
  );
}
