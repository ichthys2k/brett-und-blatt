/** Zugtexte (#335, #358): kurze deutsche Beschreibung eines Zugs, auch für den Bildschirmleser und die VR-App. */
import { setOf, type QuartettMove, type QuartettState } from './rules';

export function describeMove(view: QuartettState, move: QuartettMove): string {
  if (move.type === 'chooseProperty') return `${setOf(view).properties.find((p) => p.id === move.property)?.label ?? move.property} vergleichen`;
  return `Platz ${move.target + 1} nach Karte ${move.card} fragen`;
}
