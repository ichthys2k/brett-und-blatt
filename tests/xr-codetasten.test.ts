import { describe, expect, it } from 'vitest';
import { ROOM_EMOJIS } from '../packages/online/src';
import { codeComplete, codeEmojis, pressBackspace, pressEmoji } from '../apps/xr/src/code-keys';

describe('Emoji-Tastatur für den Raumcode (#393)', () => {
  it('baut den Code Emoji für Emoji auf und hört nach vier auf', () => {
    let code = '';
    for (const e of ['🐻', '🦊', '🌈', '🚀', '🐶']) code = pressEmoji(code, e);
    expect(code).toBe('🐻🦊🌈🚀');
    expect(codeComplete(code)).toBe(true);
  });

  it('löscht das letzte Emoji, auch aus leerem Code ohne Fehler', () => {
    expect(pressBackspace('🐻🦊')).toBe('🐻');
    expect(pressBackspace('')).toBe('');
  });

  it('nimmt nur Code-Emoji, auch bei eingefügtem Text', () => {
    expect(pressEmoji('', '😀')).toBe('');
    expect(codeEmojis(' 🐻 x 🦊️ ')).toEqual(['🐻', '🦊']);
  });

  it('kennt alle 16 Emoji', () => {
    expect(ROOM_EMOJIS).toHaveLength(16);
    for (const e of ROOM_EMOJIS) expect(pressEmoji('', e)).toBe(e);
  });
});
