import type { PieceSetId } from '@brett-und-blatt/ui';

/** Gemalte Schachfiguren (#325): `<satz>-<figur>-<farbe>.webp`, Figur k q r b n p, Farbe w oder b. */
const FIGUREN = import.meta.glob<string>('./figuren/*.webp', { eager: true, query: '?url', import: 'default' });

export const pieceImage = (set: PieceSetId, type: string, white: boolean): string | undefined =>
  set === 'classic' ? undefined : FIGUREN[`./figuren/${set}-${type}-${white ? 'w' : 'b'}.webp`];
