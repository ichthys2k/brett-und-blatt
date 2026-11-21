import { describe, expect, it } from 'vitest';
import { shouldShowShellNotice } from '../src/lib/shellNotice';

describe('Hinweis „Neue Oberfläche“ (#639)', () => {
  const base = { alreadySeen: false, shell: 'console' as const, routeName: 'menu' };
  it('erscheint beim ersten Besuch in der Konsole', () => expect(shouldShowShellNotice(base)).toBe(true));
  it('nur einmal', () => expect(shouldShowShellNotice({ ...base, alreadySeen: true })).toBe(false));
  it('nicht in der klassischen Oberfläche', () => expect(shouldShowShellNotice({ ...base, shell: 'classic' })).toBe(false));
  it('nur auf Start, Bibliothek und Optionen', () => {
    for (const routeName of ['menu', 'home', 'sound']) expect(shouldShowShellNotice({ ...base, routeName })).toBe(true);
    for (const routeName of ['play', 'setup', 'room', 'display', 'online', 'tournamentEmbed']) expect(shouldShowShellNotice({ ...base, routeName })).toBe(false);
  });
});
