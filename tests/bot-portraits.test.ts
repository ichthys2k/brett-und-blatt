import { describe, expect, it } from 'vitest';
import { BOT_GAMES, BOT_NAMES, botAvatar, botName, botPortraitId, botPortraitUrl } from '../apps/web/src/lib/botPortraits';

/** #311: Jedes Spiel hat einen Bot mit Namen und gemaltem Porträt; der Wert `bot:<kennung>` trägt ihn als Avatar. */
type Fs = { readdirSync(path: URL): string[] };
const fs = (globalThis as unknown as { process: { getBuiltinModule(name: 'node:fs'): Fs } }).process.getBuiltinModule('node:fs');

describe('Bot-Porträts (#311)', () => {
  it('jedes zugeordnete Spiel gibt es, und jedes Porträt hat einen Namen und ein Bild', () => {
    const spiele = new Set(fs.readdirSync(new URL('../packages/games/', import.meta.url)));
    expect(BOT_GAMES.filter((id) => !spiele.has(id))).toEqual([]);
    const ohneBild = Object.keys(BOT_NAMES).filter((id) => !botPortraitUrl(`bot:${id}`));
    expect(ohneBild).toEqual([]);
  });

  it('jedes Spiel der Sammlung bekommt einen Bot (notfalls „Zufall“)', () => {
    const spiele = fs.readdirSync(new URL('../packages/games/', import.meta.url));
    for (const id of spiele) expect(botPortraitId(id), id).toBeTruthy();
    expect(botPortraitId('gibt-es-nicht')).toBe('zufall');
  });

  it('nennt Namen und Avatar-Wert', () => {
    expect(botName('battleship')).toBe('Admiral');
    expect(botName('uno')).toBe('Kartenprofi');
    expect(botName('chess')).toBe('Vorausrechner');
    expect(botAvatar('checkers')).toBe('bot:vorausrechner');
    expect(botAvatar(null)).toBe('bot:zufall');
  });

  it('kennt kein Bild für gewöhnliche Avatare', () => {
    expect(botPortraitUrl('🦊')).toBeUndefined();
  });
});
