/*
 * Gemalte Kartenbilder des Drachenspiels (#309): `karten/bub-ds-<Karten-id>.webp`. Fehlt ein Bild,
 * zeigt die Karte weiter ihr Emoji. Der Dateiname ist zugleich der Medienname im Anki-Paket; ein in
 * Anki ersetztes Bild gleichen Namens (aus dem aktiven Kartenset) hat Vorrang.
 */
const files = import.meta.glob<string>('./karten/bub-ds-*.webp', { eager: true, query: '?url', import: 'default' });

/**
 * Großfassungen (#419) in `karten/gross/`: `eager` mit `?url` bindet nur die Adressen ein; die Bilddateien
 * selbst werden erst geholt, wenn die Großansicht sie anzeigt.
 */
const largeFiles = import.meta.glob<string>('./karten/gross/bub-ds-*.webp', { eager: true, query: '?url', import: 'default' });
const LARGE_ART_MEDIA: Readonly<Record<string, string>> = Object.fromEntries(
  Object.entries(largeFiles).map(([path, url]) => [path.replace('./karten/gross/', ''), url]),
);

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

/**
 * Medienname des Bilds, das eine Karte zeigt: zuerst das Bild aus dem Anki-Feld „Bild“ eines
 * aktiven Kartensets (`<img src="…">`), sonst das eingebaute. Steht im Feld nur ein Emoji, gilt
 * das eingebaute Bild.
 */
export function cardArtFileFor(cardId: string, bildField: string | undefined, builtIn: (id: string) => string | undefined = cardArtOf): string | undefined {
  const fromNote = /<img[^>]*\bsrc\s*=\s*["']([^"']+)["']/i.exec(bildField ?? '')?.[1];
  return fromNote ?? builtIn(cardId);
}

/** Adresse der Großfassung des eingebauten Kartenbilds, falls es eine gibt (#419). */
export function cardArtLargeUrl(cardId: string): string | undefined {
  return LARGE_ART_MEDIA[cardArtFile(cardId)];
}

/**
 * Adresse der Großfassung für die Großansicht: nur, wenn die Karte ihr eingebautes Bild zeigt – ein Bild
 * aus dem Anki-Feld „Bild“ oder ein Medium gleichen Namens aus dem Kartenset hat keine Großfassung.
 */
export function cardArtLargeUrlFor(cardId: string, bildField: string | undefined, mediaUrlMap: Record<string, string> | undefined): string | undefined {
  const file = cardArtFileFor(cardId, bildField);
  if (!file || file !== cardArtOf(cardId) || mediaUrlMap?.[file]) return undefined;
  return cardArtLargeUrl(cardId);
}

/** Adresse des Kartenbilds für die Großansicht oder undefined, wenn die Karte keines hat (#417). */
export function cardArtUrl(cardId: string, bildField: string | undefined, mediaUrlMap: Record<string, string> | undefined): string | undefined {
  const file = cardArtFileFor(cardId, bildField);
  return file ? withCardArt(mediaUrlMap)?.[file] : undefined;
}

/** Eingebaute Bilder, darüber die des aktiven Kartensets. */
export function withCardArt(mediaUrlMap: Record<string, string> | undefined): Record<string, string> | undefined {
  if (Object.keys(CARD_ART_MEDIA).length === 0) return mediaUrlMap;
  return { ...CARD_ART_MEDIA, ...mediaUrlMap };
}
