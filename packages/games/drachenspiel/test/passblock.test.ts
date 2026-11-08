import { applyBackupPut, type StoredBackup } from '../../../online/src/backup';
import { passBlockNames, randomPassKey, syncPassBlocks } from '@brett-und-blatt/ui/sync';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { decksBlock, sanitizeDecks } from '../src/ui/deckStore';

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

describe('Drachenspiel-Decks als Block des Passes (#141)', () => {
  beforeEach(() => vault.clear());

  it('meldet sich beim Laden als Block „drachenspiel“ an', () => {
    expect(passBlockNames()).toContain('drachenspiel');
  });

  it('gleicht die Decks über den Passschlüssel ab', async () => {
    const key = randomPassKey();
    decksBlock.write(sanitizeDecks({ decks: { abc: { id: 'abc', name: 'Hof', code: 'forest:c7*2,c25*2', updatedAt: 5 } } }));
    const result = await syncPassBlocks(key, () => 'http://server');
    expect(result.failed).toEqual({});
    expect(result.synced).toContain('drachenspiel');
    // Ein zweites Gerät (leerer Speicher) holt die Decks.
    decksBlock.write({ decks: {} } as never);
    await syncPassBlocks(key, () => 'http://server');
    expect(Object.keys(decksBlock.read().decks)).toEqual(['abc']);
    // Ein fremder Schlüssel sieht nichts.
    decksBlock.write({ decks: {} } as never);
    await syncPassBlocks(randomPassKey(), () => 'http://server');
    expect(Object.keys(decksBlock.read().decks)).toEqual([]);
  });
});
