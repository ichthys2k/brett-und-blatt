/** Zugtexte (#335, #358): kurze deutsche Beschreibung eines Zugs, auch für den Bildschirmleser und die VR-App. */
import { simulateSteps, type TargetNumberMove, type TargetNumberState } from './rules';

export function describeMove(view: TargetNumberState, move: TargetNumberMove): string {
  const items = simulateSteps(view.cards, move.steps, view.allowedOps);
  const item = items?.[move.finalIndex];
  if (!item || !items) return 'Rechnung abgeben';
  const rest = items.filter((_, i) => i !== move.finalIndex).map((i) => i.expr);
  return `${item.expr} = ${item.value} abgeben${rest.length ? ` (übrig: ${rest.join(', ')})` : ''}`;
}
