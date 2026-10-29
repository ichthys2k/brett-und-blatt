import type { AnyGameModule, GameInfo } from '@brett-und-blatt/engine';
import { GAME_SERVER } from './server';

/*
 * Die Plattform findet Spiele automatisch: Jeder Ordner unter packages/games/
 * mit einer src/meta.ts (Steckbrief) und einer src/index.ts (Regeln) ist ein Spiel.
 * Die Steckbriefe sind klein und werden sofort geladen, die Regeln erst bei Bedarf.
 */
const metaFiles = import.meta.glob<GameInfo>('../../../../packages/games/*/src/meta.ts', { eager: true, import: 'meta' });
const ruleFiles = import.meta.glob<AnyGameModule>('../../../../packages/games/*/src/index.ts', { import: 'gameModule' });

/** Ordner eines Spiels, z. B. „../../../../packages/games/tic-tac-toe“. */
export const gameFolders = new Map(Object.entries(metaFiles).map(([path, info]) => [info.id, path.replace(/\/src\/meta\.ts$/, '')]));

export const gameInfos: GameInfo[] = Object.values(metaFiles).sort((a, b) => a.name.localeCompare(b.name, 'de'));

const loaded = new Map<string, Promise<AnyGameModule>>();

export function loadRules(gameId: string): Promise<AnyGameModule> {
  let promise = loaded.get(gameId);
  if (!promise) {
    const loader = ruleFiles[`${gameFolders.get(gameId)}/src/index.ts`];
    promise = (loader ? loader() : Promise.reject(new Error(`Unbekanntes Spiel: ${gameId}`))).then(
      async (module) => {
        // Inhalte, die nicht im JS-Bundle liegen (z. B. der Fragenkatalog des Bibel-Quiz),
        // holt das Spiel hier – einmal, für Hauptfenster und Bot-Worker gleichermaßen.
        await module.prepare?.({ serverUrl: GAME_SERVER, baseUrl: import.meta.env.BASE_URL });
        return module;
      },
    );
    // Ein fehlgeschlagener Ladevorgang darf nicht dauerhaft hängen bleiben (z. B. offline gestartet).
    promise.catch(() => loaded.delete(gameId));
    loaded.set(gameId, promise);
  }
  return promise;
}
