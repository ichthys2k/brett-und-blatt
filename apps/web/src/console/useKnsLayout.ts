import { knsLayout, useViewportSize, type KnsLayout } from '@brett-und-blatt/ui';
import { useLayoutEffect } from 'react';

/**
 * Hoch- oder Querformat der Konsole (#637, U2): rechnet aus der Fenstergröße und setzt `data-kns-layout` an
 * <html>, damit die Maße in `konsole.css` umschalten. Drehen baut ohne Neuladen um.
 */
export function useKnsLayout(): KnsLayout {
  const { width, height } = useViewportSize();
  const layout = knsLayout(width, height);
  useLayoutEffect(() => {
    document.documentElement.dataset.knsLayout = layout;
  }, [layout]);
  useLayoutEffect(
    () => () => {
      delete document.documentElement.dataset.knsLayout;
    },
    [],
  );
  return layout;
}
