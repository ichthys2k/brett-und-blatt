/**
 * Porträts der Gegner (KI-erzeugt mit Canva, CC BY-SA 4.0, siehe THIRD_PARTY.md).
 * Dateiname: `boss-<key>.webp` für Herrschaften, `court-<key>.webp` für Höflinge und Edle.
 * Fehlt ein Bild, zeigt die Oberfläche das Emoji.
 */
const files = import.meta.glob<string>('./portraits/*.webp', { eager: true, query: '?url', import: 'default' });

export function portraitUrl(key: string | undefined): string | undefined {
  return key ? files[`./portraits/${key}.webp`] : undefined;
}
