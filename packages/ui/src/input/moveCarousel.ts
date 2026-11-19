export interface MoveCarouselItem {
  id: string;
  label: string;
}

/**
 * Schaltet im „Erlaubte Züge“-Karussell einen Schritt vor oder zurück (mit Wrap-around).
 */
export function stepCarousel(
  items: readonly MoveCarouselItem[],
  currentId: string | null,
  delta: 1 | -1,
): MoveCarouselItem | null {
  if (items.length === 0) return null;
  if (!currentId) {
    return delta > 0 ? items[0] : items[items.length - 1];
  }
  const idx = items.findIndex((item) => item.id === currentId);
  if (idx === -1) {
    return delta > 0 ? items[0] : items[items.length - 1];
  }
  const nextIdx = (idx + delta + items.length) % items.length;
  return items[nextIdx];
}
