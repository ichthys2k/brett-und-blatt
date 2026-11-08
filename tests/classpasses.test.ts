import { describe, expect, it } from 'vitest';
import { mergeChildPasses, parseNames, randomPin, sameChildPasses, sanitizeChildPasses, type ChildPass } from '../apps/web/src/lib/classPassesCore';

const child = (over: Partial<ChildPass> = {}): ChildPass => ({ classCode: 'K', name: 'Mia', avatar: '🦊', playerCode: '🐶🐱🦊🐻', syncCode: 'ABCDEFGH23456789', passKey: 'k'.repeat(43), token: 't'.repeat(32), pin: '123456', at: 1, ...over });

describe('Klassenausweise (#152)', () => {
  it('würfelt eine PIN aus sechs Ziffern', () => {
    expect(randomPin()).toMatch(/^\d{6}$/);
    let i = 0;
    expect(randomPin(() => i++ % 10)).toBe('012345');
  });
  it('liest Namen zeilenweise, ohne Leere und Doppelte', () => {
    expect(parseNames('Mia\n\n  Ben  \nmia\nLeo Karl\r\nZ')).toEqual(['Mia', 'Ben', 'Leo Karl', 'Z']);
    expect(parseNames('x\n'.repeat(5), 3)).toEqual(['x']);
  });
  it('prüft die Liste und wirft Unbrauchbares weg', () => {
    expect(sanitizeChildPasses(null)).toEqual([]);
    expect(sanitizeChildPasses([child(), { name: 'x' }, child({ pin: '12' })])).toEqual([child()]);
  });
  it('führt zusammen: je Spielercode gilt der jüngere Eintrag', () => {
    const merged = mergeChildPasses([child({ pin: '111111', at: 1 })], [child({ pin: '222222', at: 5 }), child({ playerCode: '🍎🍌🍓🍕', name: 'Ben' })]);
    expect(merged).toHaveLength(2);
    expect(merged.find((c) => c.name === 'Mia')?.pin).toBe('222222');
    expect(sameChildPasses(merged, [...merged].reverse())).toBe(true);
  });
});
