/// <reference types="vite/client" />
import type { GameInfo } from '@brett-und-blatt/engine';
import { describe, expect, it } from 'vitest';
import { onlineGames } from '../src/games';

const metas = import.meta.glob<GameInfo>('../../../packages/games/*/src/meta.ts', { eager: true, import: 'meta' });

describe('Spiele auf dem Server', () => {
  it('jedes Spiel für mehrere Personen wird online angeboten', () => {
    const multiplayer = Object.values(metas)
      .filter((info) => info.players.max >= 2)
      .map((info) => info.id);
    expect(onlineGames.map((m) => m.info.id).sort()).toEqual(multiplayer.sort());
  });
});
