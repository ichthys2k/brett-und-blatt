import { applyBackupPut, type StoredBackup } from '../../online/src/backup';
import {
  connectSync,
  createPlayerLock,
  createSync,
  currentSyncCode,
  disconnectSync,
  openPlayerLock,
  parsePlayerCode,
  PLAYER_SALT,
  PLAYER_WORDS,
  playerBlock,
  randomPlayerCode,
  revokePlayerLock,
  updatePlayerLock,
  type PlayerPass,
} from '../src/sync';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Nachgebauter Spieleserver mit den echten Regeln für Sicherungen.
const vault = new Map<string, StoredBackup>();
vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
  const id = url.split('/').pop()!;
  if (!init?.method) {
    const stored = vault.get(id);
    return stored ? new Response(JSON.stringify(stored)) : new Response('', { status: 404 });
  }
  const result = applyBackupPut(vault.get(id) ?? null, JSON.parse(init.body as string), 1);
  if (result.status === 200) vault.set(id, result.stored);
  return new Response('{}', { status: result.status });
});

const server = () => 'http://server';
const pass = (token: string, name = 'Ada'): PlayerPass => ({ token: token.repeat(32).slice(0, 32), name, avatar: '🦊', code: null });

describe('Spielercode', () => {
  beforeEach(() => {
    vault.clear();
    disconnectSync();
  });

  it('die Wortliste hat genau 256 verschiedene Wörter', () => {
    expect(PLAYER_WORDS).toHaveLength(256);
    expect(new Set(PLAYER_WORDS.map((word) => word.toLowerCase())).size).toBe(256);
  });

  it('liest Codes unabhängig von Schreibweise, Trennzeichen und als Link', () => {
    for (let i = 0; i < 50; i++) {
      const code = randomPlayerCode();
      expect(parsePlayerCode(code)).toBe(code);
      expect(parsePlayerCode(code.toLowerCase().replaceAll('-', ' '))).toBe(code);
      expect(parsePlayerCode(`https://spiele.lipponer.de/#/online?ausweis=${encodeURIComponent(code)}`)).toBe(code);
    }
    expect(parsePlayerCode('Fuchs-Birne-Mond')).toBeNull();
    expect(parsePlayerCode('Fuchs-Birne-Mond-Quatsch')).toBeNull();
  });

  it('ein zweites Gerät bekommt über den Code dieselbe Kennung', async () => {
    const code = await createPlayerLock(server, pass('a'));
    const opened = await openPlayerLock(server, code);
    expect(opened).toEqual({ ...pass('a'), code });
  });

  it('der Server sieht weder Kennung noch Namen', async () => {
    await createPlayerLock(server, pass('a', 'Geheimname'));
    const stored = [...vault.values()][0]!.data;
    expect(atob(stored)).not.toContain('Geheimname');
    expect(atob(stored)).not.toContain('a'.repeat(32));
  });

  it('ein neuer Name kommt beim nächsten Gerät an', async () => {
    const code = await createPlayerLock(server, pass('a'));
    await updatePlayerLock(server, code, pass('a', 'Grace'));
    expect((await openPlayerLock(server, code)).name).toBe('Grace');
  });

  it('ein ersetzter oder unbekannter Code öffnet nichts', async () => {
    const code = await createPlayerLock(server, pass('a'));
    await revokePlayerLock(server, code);
    await expect(openPlayerLock(server, code)).rejects.toThrow('ersetzt');
    await expect(openPlayerLock(server, 'Fuchs-Birne-Mond-Anker')).rejects.toThrow('keinen Ausweis');
  });
});

describe('Ausweis in der Sicherung', () => {
  beforeEach(() => {
    vault.clear();
    disconnectSync();
  });

  it('ein Gerät mit Sicherungscode übernimmt Kennung und Spielercode, behält aber seinen Namen', async () => {
    let first: PlayerPass = { ...pass('a'), code: 'Fuchs-Birne-Mond-Anker' };
    const firstBlock = playerBlock(PLAYER_SALT, server, { read: () => first, write: (next) => (first = next) });
    expect(await createSync(firstBlock)).toBe(true);
    const code = currentSyncCode()!;
    disconnectSync();

    let second = pass('b', 'Tablet');
    const secondBlock = playerBlock(PLAYER_SALT, server, { read: () => second, write: (next) => (second = next) });
    expect(await connectSync(secondBlock, code)).toBe(true);
    expect(second.token).toBe(first.token);
    expect(second.code).toBe('Fuchs-Birne-Mond-Anker');
    expect(second.name).toBe('Tablet');
  });
});
