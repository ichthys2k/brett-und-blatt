/** Zugtexte (#335, #358): kurze deutsche Beschreibung eines Zugs, auch für den Bildschirmleser und die VR-App. */
import type { PlacedTile, ScrabbleMove, ScrabbleState } from './rules';

const COLUMNS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

/** Etwa „DEM ab H8 waagrecht“; Joker als Kleinbuchstabe. */
export function placementText(tiles: readonly PlacedTile[]): string {
  const sorted = [...tiles].sort((a, b) => a.row - b.row || a.col - b.col);
  const first = sorted[0]!;
  const across = sorted.every((t) => t.row === first.row) && sorted.length > 1 ? 'waagrecht' : sorted.length > 1 ? 'senkrecht' : '';
  const letters = sorted.map((t) => (t.blank ? t.letter.toLowerCase() : t.letter)).join('');
  return `${letters} ab ${COLUMNS[first.col]}${first.row + 1}${across ? ` ${across}` : ''}`;
}

export function describeMove(_view: ScrabbleState, move: ScrabbleMove): string {
  switch (move.type) {
    case 'play':
      return `${placementText(move.tiles)} legen`;
    case 'exchange':
      return `Tauschen: ${move.tiles.join(', ')}`;
    case 'pass':
      return 'Passen';
    case 'vote':
      return move.accept ? 'Wort annehmen' : 'Wort ablehnen';
  }
}
