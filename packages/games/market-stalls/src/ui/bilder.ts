/**
 * Gemalte Bilder für Marktstände (G9, #318): Waren auf den Karten und Kulissen hinter den Ständen.
 * Fehlt ein Bild, bleibt die heutige Darstellung (Emoji, einfarbiger Stand).
 */
const WAREN = import.meta.glob<string>('./waren/*.webp', { eager: true, query: '?url', import: 'default' });
const STAENDE = import.meta.glob<string>('./staende/*.webp', { eager: true, query: '?url', import: 'default' });

const WARE_IDS = ['bread', 'cheese', 'apples', 'fish'] as const;

/** Bild einer Ware (0 = Brot, 1 = Käse, 2 = Äpfel, 3 = Fisch). */
export const wareImage = (ware: number): string | undefined => WAREN[`./waren/bub-marktstaende-${WARE_IDS[ware]}.webp`];

/** Kulisse eines Standes (0 bis 3). */
export const standImage = (stand: number): string | undefined => STAENDE[`./staende/stand-${stand + 1}.webp`];
