import type { AnyGameModule, GameInfo } from '@brett-und-blatt/engine';
import type { GameUi } from '@brett-und-blatt/ui';
import { gameFolders, gameInfos, loadRules } from './modules';

const uiFiles = import.meta.glob<GameUi>('../../../../packages/games/*/src/ui/index.tsx', { import: 'gameUi' });

export interface LoadedGame {
  info: GameInfo;
  module: AnyGameModule;
  ui: GameUi;
}

export const games = gameInfos;

export function findGame(id: string): GameInfo | undefined {
  return games.find((game) => game.id === id);
}

const cache = new Map<string, Promise<LoadedGame>>();

/** Lädt Regeln und Oberfläche eines Spiels – erst, wenn es gebraucht wird (Code-Splitting). */
export function loadGame(id: string): Promise<LoadedGame> {
  let promise = cache.get(id);
  if (!promise) {
    const info = findGame(id);
    const loadUi = uiFiles[`${gameFolders.get(id)}/src/ui/index.tsx`];
    promise =
      info && loadUi
        ? Promise.all([loadRules(id), loadUi()]).then(([module, ui]) => ({ info, module, ui }))
        : Promise.reject(new Error(`Unbekanntes Spiel: ${id}`));
    promise.catch(() => cache.delete(id));
    cache.set(id, promise);
  }
  return promise;
}
