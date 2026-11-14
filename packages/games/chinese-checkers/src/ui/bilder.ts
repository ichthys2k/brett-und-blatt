import type { PieceSetId } from '@brett-und-blatt/ui';

/** Gemalte Murmeln für Chinesisches Dame (#325): `<satz>-marble-n.webp`, cremefarben und je Platz getönt. */
const FIGUREN = import.meta.glob<string>('./figuren/*.webp', { eager: true, query: '?url', import: 'default' });

export const marbleImage = (set: PieceSetId): string | undefined => (set === 'classic' ? undefined : FIGUREN[`./figuren/${set}-marble-n.webp`]);
