import { beforeEach, describe, expect, it, vi } from 'vitest';

const calls: string[] = [];

vi.mock('../apps/web/src/lib/storage', () => ({
  storage: {
    saveProfile: () => calls.push('saveProfile'),
    loadProfile: () => ({ name: 'Mia', avatar: '🦊' }),
    deviceToken: () => 'token',
    loadPlayerCode: () => '🦊🐻🐸🐙',
    loadTournaments: () => [],
    loadPassKey: () => null,
    loadLockSecrets: () => null,
  },
}));
vi.mock('../apps/web/src/lib/online', () => ({ GAME_SERVER: 'http://test' }));
vi.mock('../packages/ui/src/sync/index', () => ({
  updatePlayerLock: () => {
    calls.push('updatePlayerLock');
    return Promise.resolve();
  },
  hasPassLock: () => Promise.resolve(false),
  savePassLock: () => {
    calls.push('savePassLock');
    return Promise.resolve();
  },
  parsePassKey: () => null,
  randomPassKey: () => 'k',
  currentSyncCode: () => null,
  syncNow: () => Promise.resolve(true),
  syncPassBlocks: () => Promise.resolve({ synced: [], failed: {} }),
  playerBlock: () => ({}),
  PLAYER_SALT: 'x',
  SyncError: class extends Error {},
}));

describe('Eigenes Profil und Ausweis (#136)', () => {
  beforeEach(() => {
    calls.length = 0;
  });

  it('saveOwnProfile speichert das Profil und frischt das Schloss des Spielercodes auf', async () => {
    const { saveOwnProfile } = await import('../apps/web/src/lib/playerPass');
    saveOwnProfile({ name: 'Mia', avatar: '🦊' });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(calls).toEqual(['saveProfile', 'updatePlayerLock']);
  });
});
