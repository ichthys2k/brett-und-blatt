// @vitest-environment node
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { disablePinchZoom } from '../src/lib/preventZoom';

const here = dirname(fileURLToPath(import.meta.url));

describe('Pinch-to-Zoom unterbinden (#267)', () => {
  it('index.html setzt user-scalable=no und maximum-scale=1 im Viewport-Metatag', () => {
    const html = readFileSync(resolve(here, '../index.html'), 'utf-8');
    expect(html).toContain('user-scalable=no');
    expect(html).toContain('maximum-scale=1');
  });

  it('styles.css setzt touch-action: manipulation auf dem Wurzelbereich', () => {
    const css = readFileSync(resolve(here, '../src/styles.css'), 'utf-8');
    expect(css).toContain('touch-action: manipulation;');
  });

  it('disablePinchZoom blockiert Mehr-Finger-Touchmove, Safari-Gesten und Ctrl-Wheel, lässt Ein-Finger-Touch aber durch', () => {
    const target = new EventTarget();
    const cleanup = disablePinchZoom(target);

    // 1. Safari gesturestart / gesturechange
    const gestureStart = new Event('gesturestart', { cancelable: true });
    target.dispatchEvent(gestureStart);
    expect(gestureStart.defaultPrevented).toBe(true);

    const gestureChange = new Event('gesturechange', { cancelable: true });
    target.dispatchEvent(gestureChange);
    expect(gestureChange.defaultPrevented).toBe(true);

    // 2. touchmove mit 1 Finger -> darf NICHT blockiert werden (normales Scrollen/Ziehen)
    const singleTouch = Object.assign(new Event('touchmove', { cancelable: true }), {
      touches: [{ identifier: 1 }],
    });
    target.dispatchEvent(singleTouch);
    expect(singleTouch.defaultPrevented).toBe(false);

    // 3. touchmove mit 2 Fingern (Pinch) -> MUSS blockiert werden
    const multiTouch = Object.assign(new Event('touchmove', { cancelable: true }), {
      touches: [{ identifier: 1 }, { identifier: 2 }],
    });
    target.dispatchEvent(multiTouch);
    expect(multiTouch.defaultPrevented).toBe(true);

    // 4. wheel ohne ctrlKey -> normales Scrollen, nicht blockieren
    const normalWheel = Object.assign(new Event('wheel', { cancelable: true }), {
      ctrlKey: false,
    });
    target.dispatchEvent(normalWheel);
    expect(normalWheel.defaultPrevented).toBe(false);

    // 5. wheel mit ctrlKey (Trackpad-Pinch) -> blockieren
    const pinchWheel = Object.assign(new Event('wheel', { cancelable: true }), {
      ctrlKey: true,
    });
    target.dispatchEvent(pinchWheel);
    expect(pinchWheel.defaultPrevented).toBe(true);

    // Nach dem Aufräumen greifen die Listener nicht mehr
    cleanup();
    const afterCleanup = new Event('gesturestart', { cancelable: true });
    target.dispatchEvent(afterCleanup);
    expect(afterCleanup.defaultPrevented).toBe(false);
  });

  it('lässt Zurückzoomen zu, wenn die Seite schon vergrößert ist', () => {
    const target = new EventTarget();
    let scale = 1.8;
    const cleanup = disablePinchZoom(target, () => scale);
    const pinch = () =>
      Object.assign(new Event('touchmove', { cancelable: true }), {
        touches: [{ identifier: 1 }, { identifier: 2 }],
      });

    const whileZoomed = pinch();
    target.dispatchEvent(whileZoomed);
    expect(whileZoomed.defaultPrevented).toBe(false);
    const gesture = new Event('gesturechange', { cancelable: true });
    target.dispatchEvent(gesture);
    expect(gesture.defaultPrevented).toBe(false);
    const wheel = Object.assign(new Event('wheel', { cancelable: true }), { ctrlKey: true });
    target.dispatchEvent(wheel);
    expect(wheel.defaultPrevented).toBe(false);

    // Wieder auf normaler Größe: Die Sperre greift erneut.
    scale = 1;
    const atNormal = pinch();
    target.dispatchEvent(atNormal);
    expect(atNormal.defaultPrevented).toBe(true);
    cleanup();
  });
});
