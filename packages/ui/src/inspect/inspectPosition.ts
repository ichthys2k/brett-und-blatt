export interface InspectRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface InspectPlacement {
  left: number;
  top: number;
  side: 'right' | 'left' | 'above' | 'below';
}

/** Mindestabstand der schwebenden Ansicht zum Fensterrand. */
export const INSPECT_EDGE = 8;

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(value, Math.max(min, max)));

/**
 * Wohin die schwebende Großansicht kommt (#418): rechts neben das Element, sonst links, sonst darüber,
 * sonst darunter. Sie verdeckt das Element nicht und hält mindestens `INSPECT_EDGE` Abstand zum
 * Fensterrand. Passt sie nirgends ganz, steht sie auf der Seite mit dem meisten Platz.
 */
export function inspectPosition(
  anchor: InspectRect,
  panel: { width: number; height: number },
  viewport: { width: number; height: number },
  gap = 12,
): InspectPlacement {
  const e = INSPECT_EDGE;
  const centeredTop = clamp(anchor.top + (anchor.bottom - anchor.top) / 2 - panel.height / 2, e, viewport.height - panel.height - e);
  const centeredLeft = clamp(anchor.left + (anchor.right - anchor.left) / 2 - panel.width / 2, e, viewport.width - panel.width - e);

  const room = {
    right: viewport.width - e - (anchor.right + gap),
    left: anchor.left - gap - e,
    above: anchor.top - gap - e,
    below: viewport.height - e - (anchor.bottom + gap),
  };
  const place = (side: InspectPlacement['side']): InspectPlacement => {
    switch (side) {
      case 'right':
        return { side, left: anchor.right + gap, top: centeredTop };
      case 'left':
        return { side, left: anchor.left - gap - panel.width, top: centeredTop };
      case 'above':
        return { side, left: centeredLeft, top: anchor.top - gap - panel.height };
      case 'below':
        return { side, left: centeredLeft, top: anchor.bottom + gap };
    }
  };

  if (room.right >= panel.width) return place('right');
  if (room.left >= panel.width) return place('left');
  if (room.above >= panel.height) return place('above');
  if (room.below >= panel.height) return place('below');

  // Nirgends ganz: die Seite mit dem meisten Platz, im Fenster gehalten.
  const sideways = Math.max(room.right, room.left) / panel.width;
  const upDown = Math.max(room.above, room.below) / panel.height;
  const side: InspectPlacement['side'] = sideways >= upDown ? (room.right >= room.left ? 'right' : 'left') : room.above >= room.below ? 'above' : 'below';
  const placed = place(side);
  return {
    side,
    left: clamp(placed.left, e, viewport.width - panel.width - e),
    top: clamp(placed.top, e, viewport.height - panel.height - e),
  };
}
