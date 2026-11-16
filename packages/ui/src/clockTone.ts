import type { ClockReading } from '@brett-und-blatt/engine';

export type ClockTone = 'idle' | 'ok' | 'warning' | 'danger';

/** Ton des Zeitbalkens: ruhig ohne laufende Uhr, sonst grün, gelb unter 35 %, rot unter 15 % oder in der Reserve. */
export function clockTone(clock: ClockReading | null): ClockTone {
  if (!clock || clock.kind === 'none' || !clock.running) return 'idle';
  const fraction = Math.max(0, Math.min(1, clock.fraction));
  return clock.usingBank || fraction < 0.15 ? 'danger' : fraction < 0.35 ? 'warning' : 'ok';
}
