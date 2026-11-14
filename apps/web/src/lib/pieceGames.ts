import type { PieceSetId } from '@brett-und-blatt/ui';

/**
 * Spiele mit gemalten Figurensätzen (#325) und die Vorschaubilder der Sätze. Jedes weitere Spiel mit Figuren
 * kommt hier dazu; „classic“ braucht kein Bild (die Kachel zeigt das gezeichnete Zeichen).
 */
export interface PieceGame {
  id: string;
  name: string;
  /** Zeichen für die Kachel „Klassisch“. */
  classicGlyph: string;
  previews: Partial<Record<PieceSetId, string>>;
}

const FILES = import.meta.glob<string>('../../../../packages/games/*/src/ui/figuren/*.webp', { eager: true, query: '?url', import: 'default' });

/** Vorschau eines Satzes: Bild `<satz>-<figur>.webp` im Figuren-Ordner des Spiels. */
function previews(game: string, piece: string): PieceGame['previews'] {
  const find = (set: string) => Object.entries(FILES).find(([path]) => path.includes(`/games/${game}/`) && path.endsWith(`/${set}-${piece}.webp`))?.[1];
  return { wood: find('wood'), metal: find('metal'), fable: find('fable') };
}

export const PIECE_GAMES: readonly PieceGame[] = [
  { id: 'chess', name: 'Schach', classicGlyph: '♞', previews: previews('chess', 'n-w') },
  { id: 'checkers', name: 'Dame', classicGlyph: '⛀', previews: previews('checkers', 'king-w') },
  { id: 'mill', name: 'Mühle', classicGlyph: '●', previews: previews('mill', 'stone-w') },
  { id: 'reversi', name: 'Reversi', classicGlyph: '◐', previews: previews('reversi', 'disc-w') },
  { id: 'go', name: 'Go', classicGlyph: '●', previews: previews('go', 'stone-b') },
  { id: 'four-in-a-row', name: 'Vier in einer Reihe', classicGlyph: '🔴', previews: previews('four-in-a-row', 'disc-w') },
  { id: 'tic-tac-toe', name: 'Tic-Tac-Toe', classicGlyph: '✕', previews: previews('tic-tac-toe', 'x') },
];
