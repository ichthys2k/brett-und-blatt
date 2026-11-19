import { useEffect, useMemo, useState } from 'react';
import { useInputContext, useInputIntent } from './InputContext';
import { stepCarousel, type MoveCarouselItem } from './moveCarousel';

export interface MoveCarouselBarProps {
  /** Liste der aktuell erlaubten Züge mit deutschen Zugtexten (aus describeMove). */
  items: readonly MoveCarouselItem[];
  onExecuteMove: (id: string) => void;
  className?: string;
}

/**
 * Barrierefreies Zug-Karussell (C5): lässt Spieler direkt durch alle erlaubten Züge
 * springen und liest den aktuellen Zugtext über aria-live vor.
 */
export function MoveCarouselBar({ items, onExecuteMove, className = '' }: MoveCarouselBarProps) {
  const ctx = useInputContext();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const activeItem = useMemo(() => {
    if (items.length === 0) return null;
    return items.find((i) => i.id === selectedId) ?? items[0];
  }, [items, selectedId]);

  useEffect(() => {
    if (ctx?.settings.mode === 'legalMoves' && activeItem) {
      ctx.announce(activeItem.label);
    }
  }, [ctx, activeItem]);

  useInputIntent((intent) => {
    if (ctx?.settings.mode !== 'legalMoves' || items.length === 0) return false;
    if (intent === 'left' || intent === 'zonePrev') {
      const next = stepCarousel(items, activeItem?.id ?? null, -1);
      if (next) setSelectedId(next.id);
      return true;
    }
    if (intent === 'right' || intent === 'zoneNext') {
      const next = stepCarousel(items, activeItem?.id ?? null, 1);
      if (next) setSelectedId(next.id);
      return true;
    }
    if (intent === 'confirm' && activeItem) {
      onExecuteMove(activeItem.id);
      return true;
    }
    return false;
  }, 15);

  if (ctx?.settings.mode !== 'legalMoves' || items.length === 0 || !activeItem) return null;

  return (
    <div className={`bub-carousel-bar ${className}`} role="region" aria-label="Erlaubte Züge">
      <button
        type="button"
        className="bub-carousel-btn"
        aria-label="Vorheriger Zug"
        onClick={() => {
          const prev = stepCarousel(items, activeItem.id, -1);
          if (prev) setSelectedId(prev.id);
        }}
      >
        ◀
      </button>
      <button
        type="button"
        className="bub-carousel-execute"
        onClick={() => onExecuteMove(activeItem.id)}
        aria-label={`Zug ausführen: ${activeItem.label}`}
      >
        <span className="bub-carousel-label">{activeItem.label}</span>
        <span className="bub-carousel-count">
          ({items.findIndex((i) => i.id === activeItem.id) + 1}/{items.length})
        </span>
      </button>
      <button
        type="button"
        className="bub-carousel-btn"
        aria-label="Nächster Zug"
        onClick={() => {
          const next = stepCarousel(items, activeItem.id, 1);
          if (next) setSelectedId(next.id);
        }}
      >
        ▶
      </button>
    </div>
  );
}
