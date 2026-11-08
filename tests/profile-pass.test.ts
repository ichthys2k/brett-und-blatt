import { beforeEach, describe, expect, it, vi } from 'vitest';

const calls: string[] = [];

vi.mock('../apps/web/src/lib/storage', () => ({
  storage: {
    saveProfile: () => calls.push('saveProfile'),
    loadProfile: () => ({ name: 'Mia', avatar: '🦊' }),
    deviceToken: () => 'token',
    loadPlayerCode: () => '🦊🐻🐸🐙',
    loadTournaments: () => [],
  },
}));
vi.mock('../apps/web/src/lib/online', () => ({ GAME_SERVER: 'http://test' }));
vi.mock('../packages/ui/src/sync/index', () => ({
  updatePlayerLock: () => {
    calls.push('updatePlayerLock');
    return Promise.resolve();
  },
  scheduleSync: () => calls.push('scheduleSync'),
  playerBlock: () => ({}),
  PLAYER_SALT: 'x',
  SyncError: class extends Error {},
}));

describe('Eigenes Profil und Ausweis (#136)', () => {
  beforeEach(() => {
    calls.length = 0;
  });

  it('saveOwnProfile speichert das Profil und frischt Schloss und Sicherung auf', async () => {
    const { saveOwnProfile } = await import('../apps/web/src/lib/playerPass');
    saveOwnProfile({ name: 'Mia', avatar: '🦊' });
    expect(calls).toEqual(['saveProfile', 'updatePlayerLock', 'scheduleSync']);
  });
});
