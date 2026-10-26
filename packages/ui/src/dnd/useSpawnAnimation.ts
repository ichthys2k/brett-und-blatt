import { useEffect, useState, type CSSProperties } from 'react';
import type { Point } from './types';

export interface SpawnAnimationOptions {
  origin?: Point | null;
  target: Point;
  durationMs?: number;
  delayMs?: number;
}

/**
 * Erzeugt eine sanfte Reise-Animation von einem Startpunkt (z. B. Talon/Kartenstapel)
 * zu den Zielkoordinaten, anstatt instantan ins Bild zu springen ("Beamen").
 */
export function useSpawnAnimation({
  origin,
  target,
  durationMs = 220,
  delayMs = 0,
}: SpawnAnimationOptions): { style: CSSProperties; isAnimating: boolean } {
  const [animating, setAnimating] = useState(() => {
    if (!origin) return false;
    if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      return false;
    }
    return true;
  });

  const [activeOffset, setActiveOffset] = useState<Point | null>(() => {
    if (!origin) return null;
    if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      return null;
    }
    return { x: origin.x - target.x, y: origin.y - target.y };
  });

  useEffect(() => {
    if (!origin || !activeOffset) return;

    let rafId: number;
    let timerId: number;

    const startTransition = () => {
      rafId = window.requestAnimationFrame(() => {
        setActiveOffset({ x: 0, y: 0 });
        timerId = window.setTimeout(() => {
          setAnimating(false);
          setActiveOffset(null);
        }, durationMs + 20);
      });
    };

    if (delayMs > 0) {
      timerId = window.setTimeout(startTransition, delayMs);
    } else {
      startTransition();
    }

    return () => {
      if (rafId) window.cancelAnimationFrame(rafId);
      if (timerId) window.clearTimeout(timerId);
    };
  }, [origin, target.x, target.y, durationMs, delayMs]);

  if (!animating || !activeOffset) {
    return { style: {}, isAnimating: false };
  }

  return {
    style: {
      transform: `translate3d(${activeOffset.x}px, ${activeOffset.y}px, 0)`,
      transition: activeOffset.x === 0 && activeOffset.y === 0 ? `transform ${durationMs}ms cubic-bezier(0.2, 0.8, 0.25, 1)` : 'none',
      zIndex: 999,
      pointerEvents: 'none',
    },
    isAnimating: true,
  };
}
