/*
 * Gemalte Kartenbilder des Drachenspiels (#309): `karten/bub-ds-<Karten-id>.webp`. Fehlt ein Bild,
 * zeigt die Karte weiter ihr Emoji. Der Dateiname ist zugleich der Medienname im Anki-Paket; ein in
 * Anki ersetztes Bild gleichen Namens (aus dem aktiven Kartenset) hat Vorrang.
 */
const files = import.meta.glob<string>('./karten/bub-ds-*.webp', { eager: true, query: '?url', import: 'default' });

/** Medienname → Adresse aller vorhandenen Kartenbilder. */
export const CARD_ART_MEDIA: Readonly<Record<string, string>> = Object.fromEntries(
  Object.entries(files).map(([path, url]) => [path.replace('./karten/', ''), url]),
);

export function cardArtFile(cardId: string): string {
  return `bub-ds-${cardId}.webp`;
}

/** Medienname des Kartenbilds oder undefined, solange es keines gibt. */
export function cardArtOf(cardId: string): string | undefined {
  const file = cardArtFile(cardId);
  return CARD_ART_MEDIA[file] ? file : undefined;
}

/** Eingebaute Bilder, darüber die des aktiven Kartensets. */
export function withCardArt(mediaUrlMap: Record<string, string> | undefined): Record<string, string> | undefined {
  if (Object.keys(CARD_ART_MEDIA).length === 0) return mediaUrlMap;
  return { ...CARD_ART_MEDIA, ...mediaUrlMap };
}
