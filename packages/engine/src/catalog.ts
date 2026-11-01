import type { PrepareContext } from './types';

/*
 * Inhalte, die nicht im JS-Bundle stecken (Fragen, Begriffe, Wortlisten), holt ein Spiel in
 * `prepare`: zuerst vom Spieleserver (immer aktuell, ohne neuen Web-Build), sonst aus der
 * mitgelieferten Datei neben dem JS-Paket (`apps/web/kataloge.ts`). Vorbild: Bibel-Quiz.
 */

export interface CatalogSource {
  /** Pfad auf dem Spieleserver, z. B. `/wortspiele/kategorien`. */
  serverPath: string;
  /** Datei neben dem JS-Paket, z. B. `wortspiele/kategorien.json`. */
  file: string;
  /** Name für Fehlermeldungen. */
  label: string;
}

/** Wie lange auf eine Quelle gewartet wird, bevor die nächste drankommt. */
const TIMEOUT_MS = 3000;

async function fetchWithTimeout(url: string): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/** Lädt einen Katalog und gibt die rohen JSON-Daten zurück; wirft, wenn keine Quelle antwortet. */
export async function loadCatalog(context: PrepareContext, source: CatalogSource): Promise<unknown> {
  const urls = [
    ...(context.serverUrl ? [`${context.serverUrl.replace(/\/+$/, '')}${source.serverPath}`] : []),
    `${context.baseUrl}${source.file}`,
  ];
  const errors: string[] = [];
  for (const url of urls) {
    try {
      const response = await fetchWithTimeout(url);
      if (!response.ok) {
        errors.push(`${url}: ${response.status}`);
        continue;
      }
      return await response.json();
    } catch (error) {
      errors.push(`${url}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  throw new Error(`${source.label}: Der Katalog ließ sich nicht laden (${errors.join('; ')})`);
}
