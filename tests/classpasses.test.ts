import { describe, expect, it } from 'vitest';
import {
  mergeChildPasses,
  parseNames,
  pickFreePlayerCode,
  randomPin,
  sameChildPasses,
  sanitizeChildPasses,
  type ChildPass,
} from '../apps/web/src/lib/classPassesCore';

const child = (over: Partial<ChildPass> = {}): ChildPass => ({
  classCode: 'K',
  name: 'Mia',
  avatar: '🦊',
  playerCode: '🐶🐱🦊🐻',
  syncCode: 'ABCDEFGH23456789',
  passKey: 'k'.repeat(43),
  token: 't'.repeat(32),
  pin: '123456',
  at: 1,
  ...over,
});

describe('Klassenausweise (#152)', () => {
  it('würfelt eine PIN aus sechs Ziffern', () => {
    expect(randomPin()).toMatch(/^\d{6}$/);
    let i = 0;
    expect(randomPin(() => i++ % 10)).toBe('012345');
  });

  it('liest Namen zeilenweise, ohne Leere und Doppelte', () => {
    expect(parseNames('Mia\n\n  Ben  \nmia\nLeo Karl\r\nZ')).toEqual([
      { name: 'Mia' },
      { name: 'Ben' },
      { name: 'Leo Karl' },
      { name: 'Z' },
    ]);
    expect(parseNames('x\n'.repeat(5), 3)).toEqual([{ name: 'x' }]);
  });

  it('liest Namensliste mit Tier-Emojis aus Zwischenablage (Mia 🦊 oder Mia;🦊)', () => {
    const input = [
      'Mia 🦊',
      'Ben;🐶',
      'Leo Karl\t🐼',
      'Noah 🚗', // kein Tier aus AVATARS -> Bild verwerfen
      'Anna;🚀', // kein Tier -> Bild verwerfen
      '🦁 Sophie', // Tier vorne
      'Felix', // ohne Bild
    ].join('\n');

    expect(parseNames(input)).toEqual([
      { name: 'Mia', avatar: '🦊' },
      { name: 'Ben', avatar: '🐶' },
      { name: 'Leo Karl', avatar: '🐼' },
      { name: 'Noah' },
      { name: 'Anna' },
      { name: 'Sophie', avatar: '🦁' },
      { name: 'Felix' },
    ]);
  });

  it('Dubletten-Prüfung beim Spielercode: zieht neuen Code, wenn schon ein Schloss existiert', async () => {
    const candidates = ['🐶🐱🦊🐻', '🍎🍌🍓🍕'];
    const revoked: string[] = [];
    let call = 0;

    const code = await pickFreePlayerCode(
      async () => candidates[call++] ?? 'DEFAULT',
      async (candidate) => candidate === '🐶🐱🦊🐻', // der erste hat schon ein Schloss
      async (candidate) => {
        revoked.push(candidate);
      },
    );

    expect(code).toBe('🍎🍌🍓🍕');
    expect(revoked).toEqual(['🐶🐱🦊🐻']);
  });

  it('Dubletten-Prüfung bricht nach maxAttempts ab, wenn kein freier Code gefunden wird', async () => {
    await expect(
      pickFreePlayerCode(
        async () => 'COLLISION',
        async () => true, // immer kollidierend
        async () => {},
        3,
      ),
    ).rejects.toThrow('Kein freier Spielercode gefunden');
  });

  it('prüft die Liste und wirft Unbrauchbares weg', () => {
    expect(sanitizeChildPasses(null)).toEqual([]);
    expect(sanitizeChildPasses([child(), { name: 'x' }, child({ pin: '12' })])).toEqual([child()]);
  });

  it('führt zusammen: je Spielercode gilt der jüngere Eintrag', () => {
    const merged = mergeChildPasses(
      [child({ pin: '111111', at: 1 })],
      [child({ pin: '222222', at: 5 }), child({ playerCode: '🍎🍌🍓🍕', name: 'Ben' })],
    );
    expect(merged).toHaveLength(2);
    expect(merged.find((c) => c.name === 'Mia')?.pin).toBe('222222');
    expect(sameChildPasses(merged, [...merged].reverse())).toBe(true);
  });
});
