import { describe, expect, it } from 'vitest';
import { AVATARS, MAX_NAME_LENGTH, ROOM_EMOJIS, cleanAvatar, cleanName, parseRoomCode, randomRoomCode } from '../src';

describe('Raumcodes', () => {
  it('16 verschiedene Emojis aus je einem Zeichen', () => {
    expect(new Set(ROOM_EMOJIS).size).toBe(16);
    expect(ROOM_EMOJIS.every((e) => Array.from(e).length === 1)).toBe(true);
  });

  it('ein neuer Code besteht aus sechs Emojis und lässt sich wieder lesen', () => {
    let i = 0;
    const code = randomRoomCode(() => (i++ * 17) % 16);
    expect(Array.from(code)).toHaveLength(6);
    expect(parseRoomCode(code)).toBe(code);
  });

  it('Leerzeichen und unsichtbare Varianten-Zeichen stören nicht', () => {
    expect(parseRoomCode(' 🦊 🍎️ 🚀🎈 ⭐️🐶 ')).toBe('🦊🍎🚀🎈⭐🐶');
  });

  it('falsche Länge oder fremde Zeichen ergeben keinen Code', () => {
    expect(parseRoomCode('🦊🍎🚀🎈⭐')).toBeNull();
    expect(parseRoomCode('🦊🍎🚀🎈⭐🐶🐶')).toBeNull();
    expect(parseRoomCode('🦊🍎🚀🎈⭐X')).toBeNull();
    expect(parseRoomCode('💩🍎🚀🎈⭐🐶')).toBeNull();
  });
});

describe('Spitznamen', () => {
  it('bereinigt Leerraum und Steuerzeichen und kürzt lange Namen', () => {
    expect(cleanName('  Anna   Lena ')).toBe('Anna Lena');
    expect(cleanName('Ben\u0000​')).toBe('Ben');
    expect(Array.from(cleanName('Ein sehr sehr langer Spitzname') ?? '')).toHaveLength(MAX_NAME_LENGTH);
    expect(cleanName('   ')).toBeNull();
  });

  it('sperrt unpassende Wörter, auch in verstellter Schreibweise', () => {
    expect(cleanName('Arschloch')).toBeNull();
    expect(cleanName('f1ck3r')).toBeNull();
    expect(cleanName('$h1t')).toBeNull();
  });

  it('lässt gewöhnliche Namen durch', () => {
    for (const name of ['Heiland', 'Benedikt', 'Mia-Sophie', 'Jürgen', 'Zoë', 'Team 7c']) expect(cleanName(name)).toBe(name);
  });

  it('unbekannte Avatare werden durch den ersten ersetzt', () => {
    expect(cleanAvatar('🐼')).toBe('🐼');
    expect(cleanAvatar('💩')).toBe(AVATARS[0]);
  });
});
