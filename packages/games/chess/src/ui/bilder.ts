import type { PieceSetId } from '@brett-und-blatt/ui';

/** Gemalte/gezeichnete Schachfiguren (#325): `<satz>-<figur>-<farbe>.{webp,svg}`, Figur k q r b n p, Farbe w oder b. */
const FIGUREN = import.meta.glob<string>('./figuren/*.{webp,svg}', { eager: true, query: '?url', import: 'default' });

export const pieceImage = (set: PieceSetId, type: string, white: boolean): string | undefined => {
  if (set === 'classic') return undefined;
  const side = white ? 'w' : 'b';
  return FIGUREN[`./figuren/${set}-${type}-${side}.svg`] ?? FIGUREN[`./figuren/${set}-${type}-${side}.webp`];
};
