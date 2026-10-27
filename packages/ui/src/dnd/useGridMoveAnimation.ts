import { useEffect, useRef, useState, type CSSProperties } from 'react';

export interface MoveAnimationItem {
  from: number | string;
  to: number | string;
}

export interface UseGridMoveAnimationOptions {
  /** Letzter Zug mit Start- und Zielkoordinaten */
  lastMove?: MoveAnimationItem | null;
  /** Rechnet eine Position (Zellen-Index oder Notation z. B. 'e4') in Bildschirmkoordinaten { col, row } um */
  toDisplayCoord: (pos: number | string) => { col: number; row: number } | null;
  /** Zusätzliche Züge beim selben Schritt (z. B. Turm bei Rochade) */
  extraMoves?: MoveAnimationItem[];
  /** Dauer der Animation in ms (Standard: 180ms) */
  durationMs?: number;
  /** Wurde der letzte Zug bereits per Pointer-Drag bewegt? Dann keine doppelte Animation */
  wasDragged?: boolean;
  /** Eindeutiger Schlüssel für den Zug (z. B. FEN, moveCount oder history-Länge) */
  moveKey?: string | number;
}

export interface CellSlideProps {
  isSliding: boolean;
  style?: CSSProperties;
  cellClassName?: string;
  pieceClassName?: string;
}

export interface ActiveSlide {
  dx: number;
  dy: number;
}

/**
 * Erzeugt eine flüssige Gleit-Animation für Figuren auf einem GridBoard (Schach, Vierer-Schach, Dame etc.)
 * nach dem FLIP-Prinzip (First, Last, Invert, Play).
 */
export function useGridMoveAnimation({
  lastMove,
  toDisplayCoord,
  extraMoves,
  durationMs = 180,
  wasDragged = false,
  moveKey,
}: UseGridMoveAnimationOptions) {
  const [slidingMap, setSlidingMap] = useState<Map<string | number, ActiveSlide>>(() => new Map());
  const lastProcessedKeyRef = useRef<string | number | null>(null);
  const timerRef = useRef<number | null>(null);

  // Eindeutiger Schlüssel des aktuellen Zugs
  const currentKey = moveKey !== undefined ? moveKey : lastMove ? `${lastMove.from}->${lastMove.to}` : null;

  useEffect(() => {
    if (!lastMove || currentKey === null || currentKey === lastProcessedKeyRef.current) {
      return;
    }
    lastProcessedKeyRef.current = currentKey;

    // Wurde der Zug bereits mit dem Pointer gezogen, entfällt das Zurückspringen
    if (wasDragged) {
      setSlidingMap(new Map());
      return;
    }

    // Bei Barrierefreiheits-Einstellung prefers-reduced-motion nicht animieren
    if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      setSlidingMap(new Map());
      return;
    }

    const allMoves = [lastMove, ...(extraMoves ?? [])];
    const newMap = new Map<string | number, ActiveSlide>();

    for (const m of allMoves) {
      const fromCoord = toDisplayCoord(m.from);
      const toCoord = toDisplayCoord(m.to);
      if (!fromCoord || !toCoord) continue;

      const dx = fromCoord.col - toCoord.col;
      const dy = fromCoord.row - toCoord.row;
      if (dx === 0 && dy === 0) continue;

      newMap.set(m.to, { dx, dy });
    }

    if (newMap.size === 0) {
      setSlidingMap(new Map());
      return;
    }

    setSlidingMap(newMap);

    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
    }

    timerRef.current = window.setTimeout(() => {
      setSlidingMap(new Map());
      timerRef.current = null;
    }, durationMs + 20);

    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [currentKey, lastMove, extraMoves, wasDragged, toDisplayCoord, durationMs]);

  const getSlideProps = (pos: number | string): CellSlideProps => {
    const slide = slidingMap.get(pos);
    if (!slide) {
      return { isSliding: false };
    }
    return {
      isSliding: true,
      style: {
        '--slide-dx': `${slide.dx * 100}%`,
        '--slide-dy': `${slide.dy * 100}%`,
      } as CSSProperties,
      cellClassName: 'bub-cell-sliding',
      pieceClassName: 'bub-piece-slide',
    };
  };

  return {
    getSlideProps,
    hasSlidingPieces: slidingMap.size > 0,
  };
}
