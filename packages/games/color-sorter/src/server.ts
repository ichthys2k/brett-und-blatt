import type { PrepareContext } from '@brett-und-blatt/engine';

/**
 * Adresse des Spieleservers für die Sicherung (W-018). Die Plattform nennt sie über
 * `prepare`, bevor die Oberfläche erscheint; ohne Server gibt es nur den Sicherungstext.
 */
let serverUrl: string | null = null;

export function syncServerUrl(): string | null {
  return serverUrl;
}

export function setSyncServerUrl(url: string | null): void {
  serverUrl = url ? url.replace(/\/+$/, '') : null;
}

export async function prepare(context: PrepareContext): Promise<void> {
  setSyncServerUrl(context.serverUrl);
}
