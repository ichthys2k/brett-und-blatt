/** Zugtexte (#335, #358): kurze deutsche Beschreibung eines Zugs, auch für den Bildschirmleser und die VR-App. */
import { STONES, type DominoEnd, type DominoMove, type DominoState } from './rules';

const ENDS = { left: 'links', right: 'rechts', up: 'oben', down: 'unten' } as const;

function describeEnd(end: DominoEnd): string {
  if (end in ENDS) return ENDS[end as keyof typeof ENDS];
  if (end === 'mexican') return 'am Mexican Train';
  if (end.startsWith('seat-')) {
    const idx = Number(end.slice(5));
    return Number.isFinite(idx) ? `an Zug ${idx + 1}` : end;
  }
  return end;
}

export function describeMove(_view: DominoState, move: DominoMove): string {
  if (move.type === 'draw') return 'Stein ziehen';
  if (move.type === 'pass') return 'Passen';
  const [a, b] = STONES[move.stone]!;
  return `[${a}|${b}] ${describeEnd(move.end)} anlegen`;
}
