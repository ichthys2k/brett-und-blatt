/** Zugtexte (#335, #358): kurze deutsche Beschreibung eines Zugs, auch für den Bildschirmleser und die VR-App. */
import { MAEXLE, type MaexleMove, type MaexleState, type MaexleValue } from './rules';

/** „Mäxle“, „Pasch 3“ oder „53“. */
export function valueText(value: MaexleValue): string {
  if (value === MAEXLE) return 'Mäxle';
  if (Math.floor(value / 10) === value % 10) return `Pasch ${value % 10}`;
  return String(value);
}

export function describeMove(_view: MaexleState, move: MaexleMove): string {
  switch (move.type) {
    case 'roll':
      return 'Würfeln';
    case 'announce':
      return `${valueText(move.value)} ansagen`;
    case 'believe':
      return 'Glauben';
    case 'doubt':
      return 'Anzweifeln';
    case 'passBlind':
      return `Blind weitergeben: ${valueText(move.value)}`;
  }
}
