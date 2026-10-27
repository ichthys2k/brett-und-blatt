import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';

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
  /** Dauer der Animation in ms (Standard: 280ms) */
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
  onAnimationEnd?: () => void;
}

export interface ActiveSlide {
  dx: number;
  dy: number;
  durationMs: number;
}

/**
 * Erzeugt eine flüssige Gleit-Animation für Figuren auf einem GridBoard (Schach, Vierer-Schach, Dame etc.)
 * nach dem FLIP-Prinzip (First, Last, Invert, Play).
 */
export function useGridMoveAnimation({
  lastMove,
  toDisplayCoord,
  extraMoves,
  durationMs = 280,
  wasDragged = false,
  moveKey,
}: UseGridMoveAnimationOptions) {
  const [slidingMap, setSlidingMap] = useState<Map<string | number, ActiveSlide>>(() => new Map());
  const lastProcessedKeyRef = useRef<string | number | null>(null);
  const timerRef = useRef<number | null>(null);

  // Instabile Callback-/Objekt-Referenzen in Ref halten, damit Re-Renders (z. B. durch Hover, Drag, Uhren) den Timer nicht abbrechen
  const paramsRef = useRef({ lastMove, toDisplayCoord, extraMoves, wasDragged, durationMs });
  paramsRef.current = { lastMove, toDisplayCoord, extraMoves, wasDragged, durationMs };

  // Eindeutiger Schlüssel des aktuellen Zugs
  const currentKey = moveKey !== undefined ? moveKey : lastMove ? `${lastMove.from}->${lastMove.to}` : null;

  const clearAnimation = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setSlidingMap(new Map());
  }, []);

  useEffect(() => {
    // Nur bei echtem Zugwechsel ausführen
    if (currentKey === null || currentKey === lastProcessedKeyRef.current) {
      return;
    }
    lastProcessedKeyRef.current = currentKey;

    const {
      lastMove: currentMove,
      toDisplayCoord: getCoord,
      extraMoves: extras,
      wasDragged: dragged,
      durationMs: duration,
    } = paramsRef.current;

    if (!currentMove || dragged) {
      clearAnimation();
      return;
    }

    // Bei Barrierefreiheits-Einstellung prefers-reduced-motion nicht animieren
    if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      clearAnimation();
      return;
    }

    const allMoves = [currentMove, ...(extras ?? [])];
    const newMap = new Map<string | number, ActiveSlide>();

    for (const m of allMoves) {
      const fromCoord = getCoord(m.from);
      const toCoord = getCoord(m.to);
      if (!fromCoord || !toCoord) continue;

      const dx = fromCoord.col - toCoord.col;
      const dy = fromCoord.row - toCoord.row;
      if (dx === 0 && dy === 0) continue;

      newMap.set(m.to, { dx, dy, durationMs: duration });
    }

    if (newMap.size === 0) {
      clearAnimation();
      return;
    }

    setSlidingMap(newMap);

    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
    }

    // Sicherheits-Timer: spätestens nach Animationsdauer + 30ms wird aufgeräumt
    timerRef.current = window.setTimeout(() => {
      setSlidingMap(new Map());
      timerRef.current = null;
    }, duration + 30);

    return () => {
      // Nur wenn ein neuer Zug ansteht oder die Komponente unmountet wird
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [currentKey, clearAnimation]);

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
        '--slide-duration': `${slide.durationMs}ms`,
      } as CSSProperties,
      cellClassName: 'bub-cell-sliding',
      pieceClassName: 'bub-piece-slide',
      onAnimationEnd: clearAnimation,
    };
  };

  return {
    getSlideProps,
    hasSlidingPieces: slidingMap.size > 0,
    clearAnimation,
  };
}
