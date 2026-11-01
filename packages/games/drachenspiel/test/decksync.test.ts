import { applyBackupPut, type StoredBackup } from '../../../online/src/backup';
import { connectSync, createSync, disconnectSync, keysFromCode, NARRENHOF_SALT, DRACHENSPIEL_SALT, parseCode, randomCode, seal, syncNow } from '@brett-und-blatt/ui/sync';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { prepare } from '../src/server';
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

const anyDeck = () => {
  const decks = { abc: { id: 'abc', name: 'Hof', code: `forest:c7*2,${'c23*2,'.repeat(1)}c25*2`, updatedAt: 5 } };
  return { decks };
};

describe('Sicherung der Decks', () => {
  beforeEach(async () => {
    vault.clear();
    disconnectSync();
    decksBlock.write({ decks: {} });
    await prepare({ serverUrl: 'http://server/' } as never);
  });

  it('das Salt des Narrenhofs bleibt wortgleich, das Drachenspiel hat einen eigenen Block', async () => {
    expect(NARRENHOF_SALT).toBe('brett-und-blatt/narrenhof-sicherung/v1');
    const c = randomCode();
    expect((await keysFromCode(c, NARRENHOF_SALT)).id).not.toBe((await keysFromCode(c, DRACHENSPIEL_SALT)).id);
    // Dieselbe Ableitung wie vor dem Umzug: ohne Salt gilt das des Narrenhofs.
    expect((await keysFromCode(c)).id).toBe((await keysFromCode(c, NARRENHOF_SALT)).id);
  });

  it('ein Code aus dem Narrenhof gilt hier: Der eigene Block wird angelegt, der fremde bleibt unberührt', async () => {
    const c = randomCode();
    const narrenhof = await keysFromCode(c, NARRENHOF_SALT);
    vault.set(narrenhof.id, { data: await seal(narrenhof, { v: 1, progress: {} }), rev: 1, at: 1 });
    const before = vault.get(narrenhof.id);
    decksBlock.write(sanitizeDecks(anyDeck()));
    expect(await connectSync(decksBlock, c)).toBe(true);
    const own = await keysFromCode(c, DRACHENSPIEL_SALT);
    expect(vault.get(own.id)?.rev).toBe(1);
    expect(vault.get(narrenhof.id)).toBe(before);
    // Der Server sieht nur Datensalat.
    expect(vault.get(own.id)?.data).not.toContain('Hof');
  });

  it('ein unbekannter Code wird abgelehnt und legt nichts an', async () => {
    expect(await connectSync(decksBlock, randomCode())).toBe(false);
    expect(vault.size).toBe(0);
    expect(parseCode('zu kurz')).toBeNull();
    expect(await connectSync(decksBlock, 'zu kurz')).toBe(false);
  });

  it('zwei Geräte führen ihre Decks zusammen, ein Löschvermerk setzt sich durch', async () => {
    decksBlock.write(sanitizeDecks(anyDeck()));
    expect(await createSync(decksBlock)).toBe(true);
    // Zweites Gerät: hat das Deck gelöscht.
    decksBlock.write({ decks: { abc: { id: 'abc', name: '', code: '', updatedAt: 9, deleted: true } } });
    expect(await syncNow(decksBlock)).toBe(true);
    decksBlock.write({ decks: {} });
    expect(await syncNow(decksBlock)).toBe(true);
    expect(decksBlock.read().decks.abc?.deleted).toBe(true);
  });
});
