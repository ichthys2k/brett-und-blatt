/** Zugtexte (#335, #358): kurze deutsche Beschreibung eines Zugs, auch für den Bildschirmleser und die VR-App. */
import type { GrafschaftMove, GrafschaftState } from './rules';

const NAMES: Record<string, string> = { wald: 'Wald', wiese: 'Wiese', feld: 'Feld', teich: 'Teich', dorf: 'Dorf', berg: 'Berg' };

export function describeMove(view: GrafschaftState, move: GrafschaftMove): string {
  const tile = view.market[move.marketIndex];
  return `${NAMES[tile?.type ?? ''] ?? 'Plättchen'} (Markt ${move.marketIndex + 1}) nach (${move.q}|${move.r})`;
}
