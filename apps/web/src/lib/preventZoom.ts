/**
 * Unterbindet das Zoomen mit zwei Fingern („Pinch to zoom“) in der PWA und im mobilen Browser (#267).
 *
 * Hintergrund:
 * - Das Viewport-Metatag (`user-scalable=no`) und CSS (`touch-action: manipulation`) reichen unter iOS Safari
 *   nicht allein aus, weil Safari `user-scalable=no` seit iOS 10 absichtlich ignoriert.
 * - Durch `preventDefault()` bei Safari-Gesten (`gesturestart`, `gesturechange`), bei `touchmove` mit mehr als
 *   einem Finger sowie bei `wheel`-Ereignissen mit gesetztem `ctrlKey` (Trackpad-Pinch) bleibt die Ansicht
 *   fest eingepasst, während normales Tippen, Ziehen und Scrollen mit einem Finger unberührt bleiben.
 */
export function disablePinchZoom(target: EventTarget = document): () => void {
  const onGesture = (event: Event): void => {
    event.preventDefault();
  };

  const onTouchMove = (event: Event): void => {
    const touchEvent = event as TouchEvent;
    if (touchEvent.touches && touchEvent.touches.length > 1) {
      event.preventDefault();
    }
  };

  const onWheel = (event: Event): void => {
    const wheelEvent = event as WheelEvent;
    if (wheelEvent.ctrlKey) {
      event.preventDefault();
    }
  };

  const options: AddEventListenerOptions = { passive: false };
  target.addEventListener('gesturestart', onGesture, options);
  target.addEventListener('gesturechange', onGesture, options);
  target.addEventListener('touchmove', onTouchMove, options);
  target.addEventListener('wheel', onWheel, options);

  return () => {
    target.removeEventListener('gesturestart', onGesture);
    target.removeEventListener('gesturechange', onGesture);
    target.removeEventListener('touchmove', onTouchMove);
    target.removeEventListener('wheel', onWheel);
  };
}
