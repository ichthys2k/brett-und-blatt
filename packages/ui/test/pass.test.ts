import { applyBackupPut, BACKUP_MAX_BYTES, type StoredBackup } from '../../online/src/backup';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  deriveBlockKeys,
  parsePassKey,
  passBlockNames,
  passBlockSalt,
  playerBlock,
  randomPassKey,
  registerPassBlock,
  sanitizePlayerPass,
  syncPassBlocks,
  type PassBlock,
  type PlayerPass,
} from '../src/sync';

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

/** Ein Probe-Block: Liste von Wörtern, Zusammenführen = Vereinigung. Jedes „Gerät“ hat seinen eigenen Speicher. */
function wordsBlock(name: string): { block: PassBlock<string[]>; device: { words: string[] } } {
  const device = { words: [] as string[] };
  const block: PassBlock<string[]> = {
    name,
    read: () => device.words,
    write: (value) => {
      device.words = value;
    },
    sanitize: (value) => (Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string').slice(0, 1000) : []),
    merge: (remote, local) => [...new Set([...remote, ...local])].sort(),
    same: (a, b) => JSON.stringify(a) === JSON.stringify(b),
  };
  return { block, device };
}

describe('Passschlüssel und Blöcke (#137)', () => {
  beforeEach(() => vault.clear());

  it('ein Passschlüssel hat 256 Bit und wird streng gelesen', () => {
    const key = randomPassKey();
    expect(key).toHaveLength(43);
    expect(parsePassKey(key)).toBe(key);
    expect(randomPassKey()).not.toBe(key);
    for (const bad of [null, 42, '', 'kurz', `${key}x`, key.replace(/.$/, '!'), `${key.slice(0, 42)} `]) expect(parsePassKey(bad)).toBeNull();
  });

  it('leitet je Block eine eigene, stabile Kennung ab', async () => {
    const key = randomPassKey();
    const a1 = await deriveBlockKeys(key, 'einstellungen');
    const a2 = await deriveBlockKeys(key, 'einstellungen');
    const b = await deriveBlockKeys(key, 'chronik');
    const other = await deriveBlockKeys(randomPassKey(), 'einstellungen');
    expect(a1.id).toMatch(/^[0-9a-f]{32}$/);
    expect(a1.id).toBe(a2.id);
    expect(new Set([a1.id, b.id, other.id]).size).toBe(3);
    expect(passBlockSalt('album')).toBe('brett-und-blatt/pass/album/v1');
    await expect(Promise.resolve().then(() => deriveBlockKeys('kaputt', 'album'))).rejects.toThrow();
  });

  it('nimmt nur gültige Blocknamen an', () => {
    for (const bad of ['', 'A', 'mit Leerzeichen', '1zahl', 'a/b', 'x'.repeat(40)]) expect(() => registerPassBlock({ ...wordsBlock('x').block, name: bad })).toThrow();
  });

  it('zwei Geräte mit demselben Passschlüssel gleichen einen Block ab', async () => {
    const key = randomPassKey();
    const phone = wordsBlock('probe-eins');
    const tablet = wordsBlock('probe-eins');
    phone.device.words = ['Apfel', 'Birne'];
    tablet.device.words = ['Kirsche'];

    registerPassBlock(phone.block);
    expect((await syncPassBlocks(key, server)).failed).toEqual({});
    registerPassBlock(tablet.block);
    const result = await syncPassBlocks(key, server);
    expect(result.synced).toContain('probe-eins');
    expect(tablet.device.words).toEqual(['Apfel', 'Birne', 'Kirsche']);

    registerPassBlock(phone.block);
    await syncPassBlocks(key, server);
    expect(phone.device.words).toEqual(['Apfel', 'Birne', 'Kirsche']);
  });

  it('der Server sieht nur Datensalat, und ein anderer Schlüssel öffnet nichts', async () => {
    const key = randomPassKey();
    const one = wordsBlock('probe-geheim');
    one.device.words = ['Geheimwort'];
    registerPassBlock(one.block);
    await syncPassBlocks(key, server);
    expect(JSON.stringify([...vault.values()])).not.toContain('Geheimwort');

    const stranger = wordsBlock('probe-geheim');
    registerPassBlock(stranger.block);
    await syncPassBlocks(randomPassKey(), server);
    expect(stranger.device.words).toEqual([]);
  });

  it('fremde Daten im Block werden bereinigt', async () => {
    const key = randomPassKey();
    const a = wordsBlock('probe-sauber');
    a.device.words = ['gut'];
    // sanitize darf nicht werfen und macht aus Unsinn einen gültigen Stand
    expect(a.block.sanitize({ nix: 1 })).toEqual([]);
    expect(a.block.sanitize(['x', 3, null])).toEqual(['x']);
    registerPassBlock(a.block);
    await syncPassBlocks(key, server);
    expect(vault.has((await deriveBlockKeys(key, 'probe-sauber')).id)).toBe(true);
  });

  it('ein zu großer Block scheitert mit klarer Meldung, die anderen laufen weiter', async () => {
    const key = randomPassKey();
    const big = wordsBlock('probe-gross');
    big.device.words = Array.from({ length: 2000 }, (_, i) => `wort${i}`.padEnd(60, 'x'));
    big.block.sanitize = (value) => (Array.isArray(value) ? (value as string[]) : []);
    const small = wordsBlock('probe-klein');
    small.device.words = ['ok'];
    registerPassBlock(big.block);
    registerPassBlock(small.block);
    const result = await syncPassBlocks(key, server);
    expect(result.failed['probe-gross']).toMatch(/zu groß/);
    expect(result.synced).toContain('probe-klein');
    expect(BACKUP_MAX_BYTES).toBe(64 * 1024);
    expect(passBlockNames()).toContain('probe-gross');
  });
});

describe('Passschlüssel im Ausweis', () => {
  const token = 'a'.repeat(32);
  const pass = (extra: Partial<PlayerPass> = {}): PlayerPass => ({ token, name: 'Ada', avatar: '🦊', code: null, ...extra });
  const block = playerBlock('x', server, { read: () => pass(), write: () => undefined });

  it('bleibt beim Bereinigen erhalten, ungültige fallen weg', () => {
    const key = randomPassKey();
    expect(sanitizePlayerPass(pass({ passKey: key }))?.passKey).toBe(key);
    expect(sanitizePlayerPass({ ...pass(), passKey: 'kaputt' })?.passKey).toBeUndefined();
    expect(sanitizePlayerPass(pass())?.passKey).toBeUndefined();
  });

  it('beim Zusammenführen gilt der Schlüssel des Servers, sonst der eigene', () => {
    const [mine, theirs] = [randomPassKey(), randomPassKey()];
    expect(block.merge(pass({ passKey: theirs }), pass({ passKey: mine })).passKey).toBe(theirs);
    expect(block.merge(pass(), pass({ passKey: mine })).passKey).toBe(mine);
    expect(block.merge(pass(), pass()).passKey).toBeUndefined();
    expect(block.same(pass({ passKey: mine }), pass({ passKey: theirs }))).toBe(false);
    expect(block.same(pass({ passKey: mine }), pass({ passKey: mine }))).toBe(true);
  });
});
