/**
 * Porträts der Gegner (KI-erzeugt mit Canva, CC BY-SA 4.0, siehe THIRD_PARTY.md).
 * Dateiname: `boss-<key>-<stufe>.webp` für Herrschaften, `court-<key>-<stufe>.webp` für Höflinge und Edle.
 * Stufe 1 schmunzelt, 2 lacht herzhaft, 3 hat einen Lachkrampf – alle drei aus demselben Grundbild.
 * Fehlt ein Bild, zeigt die Oberfläche das Emoji.
 */
const files = import.meta.glob<string>('./portraits/*.webp', { eager: true, query: '?url', import: 'default' });

export type PortraitStage = 1 | 2 | 3;

export function portraitUrl(key: string | undefined, stage: PortraitStage = 1): string | undefined {
  if (!key) return undefined;
  return files[`./portraits/${key}-${stage}.webp`] ?? files[`./portraits/${key}-1.webp`];
}

/** Hat der Gegner alle drei Stimmungen? Sonst zeigt die Oberfläche die Miene als Abzeichen. */
export function hasMoods(key: string | undefined): boolean {
  return !!key && !!files[`./portraits/${key}-3.webp`];
}

/** Stimmung nach Anteil am Ziel: ab 60 % lacht der Gegner, am Ziel kommt der Lachkrampf. */
export function stageOf(share: number): PortraitStage {
  if (share >= 1) return 3;
  if (share >= 0.6) return 2;
  return 1;
}

/** Lädt die lachenden Fassungen vor, damit der Wechsel nicht flackert. */
export function preloadPortrait(key: string | undefined): void {
  if (!key || typeof Image === 'undefined') return;
  for (const stage of [2, 3] as const) {
    const url = files[`./portraits/${key}-${stage}.webp`];
    if (url) new Image().src = url;
  }
}
