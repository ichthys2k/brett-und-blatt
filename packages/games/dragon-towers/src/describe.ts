/** Zugtexte (#335): kurze deutsche Beschreibung eines Zugs, auch für den Bildschirmleser. */
import { COLOR_NAMES, squareName, type DragonTowersMove, type DragonTowersState } from './rules';

/** Etwa „Turm Lila c1–c5“ oder „Aussetzen (Turm Lila eingesperrt)“. */
export function describeMove(view: DragonTowersState, move: DragonTowersMove): string {
  if (move.type === 'pass') {
    const color = view.required === null ? null : COLOR_NAMES[view.required];
    return color ? `Aussetzen (Turm ${color} eingesperrt)` : 'Aussetzen';
  }
  const tower = view.towers[move.from];
  const name = tower ? `Turm ${COLOR_NAMES[tower.color]}` : 'Turm';
  return `${name} ${squareName(move.from)}–${squareName(move.to)}`;
}
