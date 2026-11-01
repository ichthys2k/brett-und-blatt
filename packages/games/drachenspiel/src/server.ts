import type { PrepareContext } from '@brett-und-blatt/engine';

/** Adresse des Spieleservers für die Sicherung der Decks (W-050); die Plattform nennt sie über `prepare`. */
let serverUrl: string | null = null;

export function syncServerUrl(): string | null {
  return serverUrl;
}

export async function prepare(context: PrepareContext): Promise<void> {
  serverUrl = context.serverUrl ? context.serverUrl.replace(/\/+$/, '') : null;
}
