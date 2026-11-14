import type { Point } from './types';

/** Faktor von Pixel je Millisekunde (waagerecht) auf Grad Neigung. */
const TILT_PER_SPEED = 14;

function reducedMotion(): boolean {
  return typeof window !== 'undefined' && (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false);
}

/**
 * Neigung einer gezogenen Karte in Grad (#421): Zug nach rechts neigt sie nach rechts, höchstens `maxDeg`,
 * auf eine Nachkommastelle gerundet. Im Stillstand und bei „Bewegung reduzieren“ 0.
 */
export function dragTilt(velocity: Point, maxDeg = 10, reduce: boolean = reducedMotion()): number {
  if (reduce) return 0;
  const deg = Math.max(-maxDeg, Math.min(maxDeg, velocity.x * TILT_PER_SPEED));
  const rounded = Math.round(deg * 10) / 10;
  return rounded === 0 ? 0 : rounded;
}
