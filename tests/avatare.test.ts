import { describe, expect, it } from 'vitest';
import { AVATARS } from '../packages/online/src/avatars';
import { avatarUrl } from '../apps/web/src/lib/avatarArt';

/** #312: Zu jedem Emoji der Avatar-Auswahl gibt es ein gemaltes Bild, und das Profil speichert weiter das Emoji. */
describe('Gemalte Avatare (#312)', () => {
  it('jedes Emoji der Auswahlliste hat ein Bild', () => {
    const ohne = AVATARS.filter((emoji) => !avatarUrl(emoji));
    expect(ohne).toEqual([]);
  });

  it('erkennt Emoji mit und ohne Variantenzeichen', () => {
    const mitSelektor = AVATARS.find((e) => e.includes('️'));
    if (mitSelektor) expect(avatarUrl(mitSelektor.replace(/️/g, ''))).toBe(avatarUrl(mitSelektor));
  });

  it('kennt kein Bild für fremde Zeichen', () => {
    expect(avatarUrl('🙂')).toBeUndefined();
    expect(avatarUrl('')).toBeUndefined();
  });
});
