/** JSON mit sortierten Schlüsseln: Gleiche Werte ergeben immer denselben Text. */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(sortKeys(value));
}

/** Vergleicht zwei JSON-Werte inhaltlich, unabhängig von der Reihenfolge der Schlüssel. */
export function sameValue(a: unknown, b: unknown): boolean {
  return canonicalJson(a) === canonicalJson(b);
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value !== null && typeof value === 'object') {
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(value).sort()) {
      const entry = (value as Record<string, unknown>)[key];
      if (entry !== undefined) sorted[key] = sortKeys(entry);
    }
    return sorted;
  }
  return value;
}
