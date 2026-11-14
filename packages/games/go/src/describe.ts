/** Zugtexte (#335): kurze deutsche Beschreibung eines Zugs, auch für den Bildschirmleser. */
import type { GoMove, GoState } from './rules';

export const COLOR_NAMES = ['Schwarz', 'Weiß'];

/** Go-Koordinaten: Spalten ohne „I“, Reihen von unten gezählt. */
const COLUMNS = 'ABCDEFGHJKLMNOPQRST';

export function pointName(point: number, size: number): string {
  return `${COLUMNS[point % size]}${size - Math.floor(point / size)}`;
}

/** Etwa „Schwarz auf D4“, „Passen“ oder in der Auszählung „Gruppe auf C3 als tot markieren“. */
export function describeMove(view: GoState, move: GoMove): string {
  switch (move.type) {
    case 'place':
      return `${COLOR_NAMES[view.turn] ?? 'Stein'} auf ${pointName(move.point, view.size)}`;
    case 'pass':
      return 'Passen';
    case 'toggleDead':
      return `Gruppe auf ${pointName(move.point, view.size)} als ${view.dead.includes(move.point) ? 'lebend' : 'tot'} markieren`;
    case 'acceptScore':
      return 'Auszählung annehmen';
    case 'resume':
      return 'Weiterspielen';
    case 'resign':
      return 'Aufgeben';
    case 'loadSgf':
      return 'SGF-Partie laden';
  }
}
