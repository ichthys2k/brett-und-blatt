/** Zugtexte (#335, #358): kurze deutsche Beschreibung eines Zugs, auch für den Bildschirmleser und die VR-App. */
import { STONES, type DominoMove, type DominoState } from './rules';

const ENDS = { left: 'links', right: 'rechts', up: 'oben', down: 'unten' } as const;

export function describeMove(_view: DominoState, move: DominoMove): string {
  if (move.type === 'draw') return 'Stein ziehen';
  if (move.type === 'pass') return 'Passen';
  const [a, b] = STONES[move.stone]!;
  return `[${a}|${b}] ${ENDS[move.end]} anlegen`;
}
