import type { GameEvent } from '@brett-und-blatt/engine';
import { useLayoutEffect, useRef, type CSSProperties } from 'react';

/** Augen je Seite als Plätze im 3×3-Raster (0 = oben links, 8 = unten rechts). */
const PIPS: Record<number, number[]> = {
  1: [4],
  2: [2, 6],
  3: [2, 4, 6],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};

/**
 * Drehung des Würfels, damit die Seite `value` nach vorn zeigt. Die Seiten liegen wie bei einem
 * echten Würfel: Gegenüberliegende Seiten ergeben zusammen 7.
 */
const FACE_TURN: Record<number, [number, number]> = {
  1: [0, 0],
  2: [-90, 0],
  3: [0, -90],
  4: [0, 90],
  5: [90, 0],
  6: [0, 180],
};

/** Leichte Schräglage im Ruhezustand: So sieht man oben und seitlich noch etwas vom Würfel. */
const TILT = 'rotateX(-16deg) rotateY(20deg)';

const cubeTransform = (x: number, y: number, z: number) => `${TILT} rotateX(${x}deg) rotateY(${y}deg) rotateZ(${z}deg)`;

/** Gesamtdauer eines Wurfs ohne Versatz – der Wunsch war „höchstens etwa eine Sekunde“. */
export const DIE_ROLL_MS = 820;

export interface Die3DProps {
  /** Gezeigte Augenzahl 1–6. Ohne Wert zeigt der Würfel eine Sechs, blass („noch nicht gewürfelt“). */
  value: number | null;
  /**
   * Wechselt dieser Wert (nicht beim ersten Zeichnen), rollt der Würfel und landet auf `value`.
   * Am einfachsten aus `useRollCounter(events)`.
   */
  rollKey?: number | string;
  /** Liegen bleiben, obwohl `rollKey` wechselt – z. B. gehaltene Würfel im Würfelblock. */
  still?: boolean;
  /** Versatz in ms, damit mehrere Würfel nicht im Gleichschritt fallen. */
  delayMs?: number;
  /** Goldenes Aufleuchten mit Funken beim Landen, z. B. für eine Sechs oder einen Pasch. */
  crit?: boolean;
  /** Farbe der Seiten und der Augen (CSS-Farben). */
  color?: string;
  pipColor?: string;
  /** Hervorgehoben (gehalten): Rand in Akzentfarbe, leicht angehoben. */
  held?: boolean;
  /** Wartet auf einen Wurf: sanftes Wippen als Einladung zum Antippen. */
  inviting?: boolean;
  /** Vorgelesener Text. Fehlt er, ist der Würfel für Vorleseprogramme unsichtbar (z. B. im beschrifteten Knopf). */
  label?: string;
  className?: string;
  style?: CSSProperties;
}

const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/**
 * Ein Spielwürfel als 3D-Würfel aus sechs Seiten. Beim Wurf fliegt er von schräg oben herein,
 * überschlägt sich mehrfach, prallt zweimal auf und landet mit einem Lichtring auf der Augenzahl.
 * Die Größe richtet sich nach der Breite des Elternelements (Standard 3 rem, sonst `width` setzen).
 */
export function Die3D({ value, rollKey, still, delayMs = 0, crit, color, pipColor, held, inviting, label, className = '', style }: Die3DProps) {
  const tossRef = useRef<HTMLSpanElement>(null);
  const cubeRef = useRef<HTMLSpanElement>(null);
  const shadowRef = useRef<HTMLSpanElement>(null);
  const flashRef = useRef<HTMLSpanElement>(null);
  const sparkRef = useRef<HTMLSpanElement>(null);
  const lastKey = useRef(rollKey);
  const shown = value !== null && value >= 1 && value <= 6 ? value : 6;
  const [tx, ty] = FACE_TURN[shown]!;

  useLayoutEffect(() => {
    if (lastKey.current === rollKey) return;
    lastKey.current = rollKey;
    if (still || value === null) return;
    const cube = cubeRef.current;
    const toss = tossRef.current;
    if (!cube || !toss || typeof cube.animate !== 'function') return;
    const timing = { duration: DIE_ROLL_MS, delay: delayMs, fill: 'backwards' as const };

    if (reducedMotion()) {
      cube.animate([{ opacity: 0.2 }, { opacity: 1 }], { duration: 180, delay: delayMs, fill: 'backwards' });
      return;
    }

    // Zufällige Richtung und Zahl der Überschläge – reine Optik, der Wert steht schon fest.
    const turns = () => (2 + Math.floor(Math.random() * 2)) * 360 * (Math.random() < 0.5 ? -1 : 1);
    const sx = tx + turns();
    const sy = ty + turns();
    const sz = (Math.random() < 0.5 ? -1 : 1) * (90 + Math.floor(Math.random() * 3) * 90);
    const from = Math.random() < 0.5 ? -1 : 1;
    const animations: Animation[] = [];
    animations.push(
      cube.animate(
        [
          { transform: cubeTransform(sx, sy, sz), offset: 0 },
          { transform: cubeTransform(tx + (sx - tx) * 0.22, ty + (sy - ty) * 0.22, sz * 0.2), offset: 0.5 },
          { transform: cubeTransform(tx + (sx > tx ? 14 : -14), ty + (sy > ty ? -10 : 10), sz > 0 ? 6 : -6), offset: 0.72 },
          { transform: cubeTransform(tx - (sx > tx ? 4 : -4), ty, 0), offset: 0.88 },
          { transform: cubeTransform(tx, ty, 0), offset: 1 },
        ],
        { ...timing, easing: 'cubic-bezier(0.25, 0.6, 0.35, 1)' },
      ),
    );
    animations.push(
      toss.animate(
        [
          { transform: `translate(${from * 70}%, -150%) scale(1.35)`, offset: 0, easing: 'cubic-bezier(0.5, 0, 0.9, 0.6)' },
          { transform: 'translate(0, 0) scale(1)', offset: 0.5, easing: 'cubic-bezier(0.2, 0.7, 0.4, 1)' },
          { transform: `translate(${-from * 6}%, -26%) scale(1.04)`, offset: 0.64, easing: 'cubic-bezier(0.6, 0, 0.9, 0.5)' },
          { transform: 'translate(0, 0) scale(1)', offset: 0.77, easing: 'ease-out' },
          { transform: 'translate(0, -7%) scale(1.01)', offset: 0.86, easing: 'ease-in' },
          { transform: 'translate(0, 0) scale(1)', offset: 0.95 },
          { transform: 'translate(0, 0) scale(1)', offset: 1 },
        ],
        timing,
      ),
    );
    if (shadowRef.current) {
      animations.push(
        shadowRef.current.animate(
          [
            { transform: 'scale(1.6)', opacity: 0, offset: 0 },
            { transform: 'scale(1)', opacity: 1, offset: 0.5 },
            { transform: 'scale(1.15)', opacity: 0.7, offset: 0.64 },
            { transform: 'scale(1)', opacity: 1, offset: 0.77 },
            { transform: 'scale(1)', opacity: 1, offset: 1 },
          ],
          timing,
        ),
      );
    }
    // Aufprall: Lichtring beim ersten Aufschlag, beim Liegenbleiben ein zweiter, kräftiger bei `crit`.
    if (flashRef.current) {
      animations.push(
        flashRef.current.animate(
          [
            { transform: 'scale(0.6)', opacity: 0, offset: 0 },
            { transform: 'scale(0.6)', opacity: 0, offset: 0.49 },
            { transform: 'scale(0.9)', opacity: 0.55, offset: 0.52 },
            { transform: 'scale(1.5)', opacity: 0, offset: 0.7 },
            { transform: 'scale(0.8)', opacity: 0, offset: 0.92 },
            { transform: 'scale(1)', opacity: crit ? 1 : 0.45, offset: 0.95 },
            { transform: `scale(${crit ? 2.1 : 1.6})`, opacity: 0, offset: 1 },
          ],
          { duration: DIE_ROLL_MS + (crit ? 260 : 120), delay: delayMs, easing: 'ease-out' },
        ),
      );
    }
    if (crit && sparkRef.current) {
      animations.push(
        sparkRef.current.animate(
          [
            { opacity: 0, transform: 'scale(0.3) rotate(0deg)', offset: 0 },
            { opacity: 0, transform: 'scale(0.3) rotate(0deg)', offset: 0.7 },
            { opacity: 1, transform: 'scale(1) rotate(20deg)', offset: 0.85 },
            { opacity: 0, transform: 'scale(1.5) rotate(40deg)', offset: 1 },
          ],
          { duration: DIE_ROLL_MS + 360, delay: delayMs, easing: 'ease-out' },
        ),
      );
    }
    return () => animations.forEach((a) => a.cancel());
    // Nur ein neuer Wurf startet die Animation; Wertänderungen ohne Wurf (z. B. Rückblick) springen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rollKey]);

  const vars = {
    ...(color ? { '--bub-die-color': color } : {}),
    ...(pipColor ? { '--bub-die-pip': pipColor } : {}),
    ...style,
  } as CSSProperties;

  return (
    <span
      className={`bub-die ${className}`}
      data-held={held || undefined}
      data-empty={value === null || undefined}
      data-inviting={inviting || undefined}
      data-crit={crit || undefined}
      style={vars}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <span ref={shadowRef} className="bub-die-shadow" />
      <span ref={flashRef} className="bub-die-flash" />
      <span ref={sparkRef} className="bub-die-sparks">
        {Array.from({ length: 8 }, (_, i) => (
          <span key={i} style={{ '--bub-spark': `${i * 45}deg` } as CSSProperties} />
        ))}
      </span>
      <span ref={tossRef} className="bub-die-toss">
        <span className="bub-die-wobble">
          <span ref={cubeRef} className="bub-die-cube" style={{ transform: cubeTransform(tx, ty, 0) }}>
            {[1, 2, 3, 4, 5, 6].map((face) => (
              <span key={face} className={`bub-die-face bub-die-face-${face}`}>
                {Array.from({ length: 9 }, (_, i) => (
                  <span key={i} className={PIPS[face]!.includes(i) ? 'bub-die-pip' : undefined} />
                ))}
              </span>
            ))}
          </span>
        </span>
      </span>
    </span>
  );
}

/**
 * Zählt die Würfe in den Ereignissen eines Zugs mit: Der Wert wechselt, sobald neue Ereignisse
 * einen Wurf enthalten – passend für `Die3D.rollKey`. Beim ersten Zeichnen zählt nichts,
 * damit ein geöffnetes Spiel nicht sofort würfelt.
 */
export function useRollCounter(events: GameEvent[], isRoll: (event: GameEvent) => boolean = (e) => e.type === 'rolled'): number {
  const state = useRef({ events, count: 0 });
  if (state.current.events !== events) {
    state.current.events = events;
    if (events.some(isRoll)) state.current.count += 1;
  }
  return state.current.count;
}
