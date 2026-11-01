import { useCallback, useEffect, useRef, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent } from 'react';

const PRESS_MS = 450;
const MOVE_TOLERANCE_PX = 8;

/**
 * Langes Drücken (Finger) oder Rechtsklick (Maus) löst `onPress` aus, ohne dass danach
 * noch ein Klick durchkommt und die Karte versehentlich ausspielt.
 */
export function useLongPress<T>(onPress: (item: T) => void) {
  const stopRef = useRef<(() => void) | null>(null);
  useEffect(() => () => stopRef.current?.(), []);

  const start = useCallback(
    (event: ReactPointerEvent<HTMLElement>, item: T) => {
      if (event.button !== 0) return;
      stopRef.current?.();
      const { clientX, clientY, pointerId } = event;
      const mine = (e: PointerEvent) => e.pointerId === pointerId;
      const stop = () => {
        window.clearTimeout(timer);
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onEnd);
        window.removeEventListener('pointercancel', onEnd);
        stopRef.current = null;
      };
      const onMove = (e: PointerEvent) => {
        if (mine(e) && Math.hypot(e.clientX - clientX, e.clientY - clientY) > MOVE_TOLERANCE_PX) stop();
      };
      const onEnd = (e: PointerEvent) => {
        if (mine(e)) stop();
      };
      const timer = window.setTimeout(() => {
        stop();
        const swallow = (click: MouseEvent) => {
          click.stopPropagation();
          click.preventDefault();
        };
        window.addEventListener('click', swallow, true);
        const release = (e: PointerEvent) => {
          if (!mine(e)) return;
          window.removeEventListener('pointerup', release);
          window.removeEventListener('pointercancel', release);
          window.setTimeout(() => window.removeEventListener('click', swallow, true), 50);
        };
        window.addEventListener('pointerup', release);
        window.addEventListener('pointercancel', release);
        onPress(item);
      }, PRESS_MS);
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onEnd);
      window.addEventListener('pointercancel', onEnd);
      stopRef.current = stop;
    },
    [onPress],
  );

  const contextMenu = useCallback(
    (event: ReactMouseEvent<HTMLElement>, item: T) => {
      event.preventDefault();
      onPress(item);
    },
    [onPress],
  );

  return { start, contextMenu };
}
