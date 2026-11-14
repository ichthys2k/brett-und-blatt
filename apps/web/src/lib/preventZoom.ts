/**
 * Unterbindet das Zoomen mit zwei Fingern („Pinch to zoom“) in der PWA und im mobilen Browser (#267).
 *
 * Hintergrund:
 * - Das Viewport-Metatag (`user-scalable=no`) und CSS (`touch-action: manipulation`) reichen unter iOS Safari
 *   nicht allein aus, weil Safari `user-scalable=no` seit iOS 10 absichtlich ignoriert.
 * - Durch `preventDefault()` bei Safari-Gesten (`gesturestart`, `gesturechange`), bei `touchmove` mit mehr als
 *   einem Finger sowie bei `wheel`-Ereignissen mit gesetztem `ctrlKey` (Trackpad-Pinch) bleibt die Ansicht
 *   fest eingepasst, während normales Tippen, Ziehen und Scrollen mit einem Finger unberührt bleiben.
 * - Schon beim Aufsetzen des zweiten Fingers (`touchstart`) wird abgebrochen: Hat der Browser mit dem ersten
 *   Finger bereits zu wischen begonnen, sind die folgenden `touchmove` nicht mehr abbrechbar (`cancelable: false`),
 *   und „erst wischen, dann zweiten Finger dazu“ zoomte trotz Sperre (iOS ignoriert `user-scalable=no`; #397).
 *   Pointer-Ereignisse (Startspieler-Helfer mit mehreren Fingern) bleiben davon unberührt.
 * - Die Sperre greift nur, solange die Seite nicht vergrößert ist. Ist sie doch einmal vergrößert (eine Lücke,
 *   die wir nicht kennen, oder Android mit „Zoomen immer erlauben“), bleibt Zurückzoomen mit
 *   zwei Fingern möglich – sonst säße man in der Vergrößerung fest (4er-Schach am Handy, 14.11.2026).
 */

/** Maßstab, ab dem die Seite als vergrößert gilt (kleine Abweichungen durch Rundung zählen nicht). */
const ZOOMED_SCALE = 1.01;

/** Aktueller Zoom-Maßstab der Seite; ohne `visualViewport` gilt 1. */
export type ScaleSource = () => number;

const viewportScale: ScaleSource = () => (typeof window !== 'undefined' ? (window.visualViewport?.scale ?? 1) : 1);

export function disablePinchZoom(target: EventTarget = document, scale: ScaleSource = viewportScale): () => void {
  const zoomed = (): boolean => scale() > ZOOMED_SCALE;

  const onGesture = (event: Event): void => {
    if (!zoomed()) event.preventDefault();
  };

  // Zweiter Finger setzt auf: Mehr-Finger-Geste von Anfang an unterbinden.
  const onTouchStart = (event: Event): void => {
    const touchEvent = event as TouchEvent;
    if (touchEvent.touches && touchEvent.touches.length > 1 && event.cancelable && !zoomed()) {
      event.preventDefault();
    }
  };

  const onTouchMove = (event: Event): void => {
    const touchEvent = event as TouchEvent;
    if (touchEvent.touches && touchEvent.touches.length > 1 && !zoomed()) {
      event.preventDefault();
    }
  };

  const onWheel = (event: Event): void => {
    const wheelEvent = event as WheelEvent;
    if (wheelEvent.ctrlKey && !zoomed()) {
      event.preventDefault();
    }
  };

  const options: AddEventListenerOptions = { passive: false };
  target.addEventListener('gesturestart', onGesture, options);
  target.addEventListener('gesturechange', onGesture, options);
  target.addEventListener('touchstart', onTouchStart, options);
  target.addEventListener('touchmove', onTouchMove, options);
  target.addEventListener('wheel', onWheel, options);

  return () => {
    target.removeEventListener('gesturestart', onGesture);
    target.removeEventListener('gesturechange', onGesture);
    target.removeEventListener('touchstart', onTouchStart);
    target.removeEventListener('touchmove', onTouchMove);
    target.removeEventListener('wheel', onWheel);
  };
}
