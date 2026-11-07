import { useEffect, type RefObject } from 'react';

/** Schließt ein aufgeklapptes Menü bei Escape oder einem Tipp außerhalb von `box`. */
export function useDismiss(open: boolean, close: () => void, box: RefObject<HTMLElement | null>) {
  useEffect(() => {
    if (!open) return;
    const onEvent = (event: PointerEvent | KeyboardEvent) => {
      if (event instanceof KeyboardEvent ? event.key === 'Escape' : !box.current?.contains(event.target as Node)) close();
    };
    window.addEventListener('pointerdown', onEvent);
    window.addEventListener('keydown', onEvent);
    return () => {
      window.removeEventListener('pointerdown', onEvent);
      window.removeEventListener('keydown', onEvent);
    };
  }, [open, close, box]);
}
