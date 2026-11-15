/**
 * Bild-Resolver für „Paare finden“: Die Web-App registriert hier beim Start die
 * Zuordnung von Bildschlüsseln (z. B. `avatar:🐶`, `quartett:tiere/…`, `drachenspiel:f_bear`)
 * auf Vite-Asset-URLs, damit die Spiellogik und der Server frei von Bild-Imports bleiben.
 */
export type PairImageResolver = (key: string) => string | undefined;

let resolver: PairImageResolver | null = null;

export function setPairImageResolver(next: PairImageResolver | null): void {
  resolver = next;
}

export function resolvePairImage(key: string | undefined): string | undefined {
  return key && resolver ? resolver(key) : undefined;
}
