/** Zugtexte (#335, #358): kurze deutsche Beschreibung eines Zugs, auch für den Bildschirmleser und die VR-App. */
import type { SprintMove, SprintState } from './rules';

export function describeMove(view: SprintState, move: SprintMove): string {
  if (move.type === 'finish') return 'Fertig';
  if (move.type === 'answer') return `${view.categoryNames[move.category] ?? `Kategorie ${move.category + 1}`}: ${move.text || '(leer)'}`;
  return `Bewerten: ${move.verdicts.map((v) => (v === 1 ? '✓' : v === 0 ? '✗' : '–')).join(' ')}`;
}
