import { useEffect, useRef, useState } from 'react';
import { useDirectGamepad, useInputContext, useInputIntent } from './InputContext';

/**
 * Optionaler virtueller Zeiger (C8) als Fallback für freie Zeichen-/Sonderflächen.
 * Wird über L3 oder Select ein- und ausgeschaltet.
 */
export function SoftCursor() {
  const ctx = useInputContext();
  const active = ctx?.cursorActive ?? false;
  const [pos, setPos] = useState({ x: 200, y: 200 });
  const posRef = useRef(pos);
  posRef.current = pos;

  useEffect(() => {
    if (!active || typeof window === 'undefined') return;
    setPos({ x: Math.round(window.innerWidth / 2), y: Math.round(window.innerHeight / 2) });
  }, [active]);

  useDirectGamepad((sample) => {
    if (!active || typeof window === 'undefined') return;
    const { x, y } = sample.leftStick;
    if (x === 0 && y === 0) return;
    const speed = 10;
    setPos((prev) => ({
      x: Math.max(4, Math.min(window.innerWidth - 4, prev.x + x * speed)),
      y: Math.max(4, Math.min(window.innerHeight - 4, prev.y + y * speed)),
    }));
  });

  // Klick am Zielpunkt über Gamepad-A
  useEffect(() => {
    if (!active || typeof navigator === 'undefined' || typeof navigator.getGamepads !== 'function') return;
    let prevA = false;
    let raf = 0;
    const poll = () => {
      const pads = navigator.getGamepads();
      let pressedA = false;
      for (const p of pads) {
        if (p?.connected && p.buttons[0]?.pressed) pressedA = true;
      }
      if (pressedA && !prevA) {
        const el = document.elementFromPoint(posRef.current.x, posRef.current.y);
        if (el instanceof HTMLElement) {
          el.click();
          el.focus();
        }
      }
      prevA = pressedA;
      raf = requestAnimationFrame(poll);
    };
    raf = requestAnimationFrame(poll);
    return () => cancelAnimationFrame(raf);
  }, [active]);

  useInputIntent((intent) => {
    if (!active) return false;
    if (intent === 'cancel') {
      ctx?.setCursorActive(false);
      return true;
    }
    return false;
  }, 30);

  if (!active) return null;

  return (
    <div
      className="bub-soft-cursor"
      style={{ transform: `translate3d(${pos.x}px, ${pos.y}px, 0)` }}
      aria-hidden="true"
    />
  );
}
