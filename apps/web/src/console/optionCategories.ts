/** Kategorien der Optionen in der Konsole (#640, U5), in der Reihenfolge der Navigation. */
export const OPTION_CATEGORIES = ['sound', 'music', 'look', 'pieces', 'input', 'push', 'app'] as const;
export type OptionCategory = (typeof OPTION_CATEGORIES)[number];

/** Die Kategorie aus der Adresse (`?bereich=…`); unbekannt oder fehlend: die erste verfügbare. */
export function parseOptionCategory(raw: string | undefined, available: readonly OptionCategory[]): OptionCategory {
  return available.find((id) => id === raw) ?? available[0]!;
}
