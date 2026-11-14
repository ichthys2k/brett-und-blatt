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

const chess = import.meta.glob<string>('../../../../packages/games/chess/src/ui/figuren/*-n-w.webp', { eager: true, query: '?url', import: 'default' });

const pick = (files: Record<string, string>, set: string, piece: string): string | undefined =>
  Object.entries(files).find(([path]) => path.endsWith(`/${set}-${piece}.webp`))?.[1];

export const PIECE_GAMES: readonly PieceGame[] = [
  {
    id: 'chess',
    name: 'Schach',
    classicGlyph: '♞',
    previews: { wood: pick(chess, 'wood', 'n-w'), metal: pick(chess, 'metal', 'n-w'), fable: pick(chess, 'fable', 'n-w') },
  },
];
