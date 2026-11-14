/*
 * Gemalte Kartenrücken (#314): Bilder `backs/bub-ruecken-<id>.webp` (500 × 700 px, punktsymmetrisch).
 * Der Katalog in der Web-App bietet nur Rücken an, deren Datei vorhanden ist; solange ein Bild fehlt,
 * zeichnet `CardBack` an seiner Stelle den SVG-Rücken `classic-red`. Der Dateiname ist zugleich der
 * Medienname im Anki-Paket.
 */

export const PAINTED_CARD_BACK_IDS = ['tavern-lantern', 'castle-banner', 'library-ink', 'garden-rose', 'fairground', 'night-sky'] as const;
export type PaintedCardBackId = (typeof PAINTED_CARD_BACK_IDS)[number];

const files = import.meta.glob<string>('./backs/bub-ruecken-*.webp', { eager: true, query: '?url', import: 'default' });

export function isPaintedCardBack(id: string | undefined): id is PaintedCardBackId {
  return (PAINTED_CARD_BACK_IDS as readonly string[]).includes(id ?? '');
}

/** Medien- und Dateiname eines gemalten Rückens. */
export function paintedCardBackFile(id: PaintedCardBackId): string {
  return `bub-ruecken-${id}.webp`;
}

/** Adresse des Bildes oder undefined, solange es (noch) nicht im Repo liegt. */
export function paintedCardBackUrl(id: PaintedCardBackId): string | undefined {
  return files[`./backs/${paintedCardBackFile(id)}`];
}
