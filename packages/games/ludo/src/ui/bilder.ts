import type { PieceSetId } from '@brett-und-blatt/ui';

/** Gemalte Spielfiguren für Ludo (#325): `<satz>-pawn-n.webp`, cremefarben und je Platz getönt. */
const FIGUREN = import.meta.glob<string>('./figuren/*.webp', { eager: true, query: '?url', import: 'default' });

export const pawnImage = (set: PieceSetId): string | undefined => (set === 'classic' ? undefined : FIGUREN[`./figuren/${set}-pawn-n.webp`]);
