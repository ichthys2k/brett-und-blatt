import { parseCrest, CREST_COLORS } from '@brett-und-blatt/engine';
import { describe, expect, it } from 'vitest';
import map from '../src/lib/avatarMap.json';
import { avatarUrl } from '../src/lib/avatarArt';
import { botAvatar } from '../src/lib/botPortraits';
import {
  DEFAULT_AVATARS,
  DEFAULT_CREST_COLORS,
  defaultAvatar,
  defaultCrest,
  seatIdentity,
  seatMember,
} from '../src/lib/seatIdentity';

describe('seatIdentity', () => {
  it('DEFAULT_AVATARS enthält mindestens 30 gut unterscheidbare Emojis aus avatarMap.json', () => {
    expect(DEFAULT_AVATARS.length).toBeGreaterThanOrEqual(30);
    // Keine Doppelgänger
    const set = new Set(DEFAULT_AVATARS);
    expect(set.size).toBe(DEFAULT_AVATARS.length);

    // Jedes Emoji muss in avatarMap.json existieren und ein Bild haben
    for (const emoji of DEFAULT_AVATARS) {
      const clean = emoji.replace(/\uFE0F/g, '');
      expect((map as Record<string, string>)[clean], `Emoji ${emoji} muss in avatarMap.json existieren`).toBeDefined();
      expect(avatarUrl(emoji), `avatarUrl(${emoji}) muss ein gemaltes Bild liefern`).toBeDefined();
    }
  });

  it('defaultAvatar liefert für jeden Index ein definiertes Emoji aus der Liste und wickelt zyklisch um', () => {
    expect(defaultAvatar(0)).toBe(DEFAULT_AVATARS[0]);
    expect(defaultAvatar(DEFAULT_AVATARS.length)).toBe(DEFAULT_AVATARS[0]);
    expect(defaultAvatar(-1)).toBe(DEFAULT_AVATARS[DEFAULT_AVATARS.length - 1]);
  });

  it('DEFAULT_CREST_COLORS enthält 8 gültige Farbkennungen aus der Engine', () => {
    expect(DEFAULT_CREST_COLORS.length).toBe(8);
    const validColors = new Set(CREST_COLORS);
    for (const color of DEFAULT_CREST_COLORS) {
      expect(validColors.has(color), `Farbe ${color} muss in CREST_COLORS existieren`).toBe(true);
    }
  });

  it('defaultCrest liefert immer ein valides Wappen nach parseCrest', () => {
    for (let i = 0; i < 16; i++) {
      const crest = defaultCrest(i);
      expect(crest).toMatch(/^schild:klassisch;teilung:quer;farben:[\w-]+;raum:1$/);
      const parsed = parseCrest(crest);
      expect(parsed).not.toBeNull();
      expect(parsed?.shield).toBe('klassisch');
      expect(parsed?.division).toBe('quer');
      expect(parsed?.inRoom).toBe(true);
    }
  });

  it('seatMember findet das Mitglied anhand von seat.memberId', () => {
    const members = [
      { id: 'm1', name: 'Alice', avatar: '🐱', connected: true },
      { id: 'm2', name: 'Bob', avatar: '🐶', crest: 'schild:rund;teilung:einfarbig;farben:rot-gold;tier:🐶;raum:1', connected: true },
    ];
    expect(seatMember({ kind: 'bot' }, members)).toBeNull();
    expect(seatMember({ kind: 'human', memberId: null }, members)).toBeNull();
    expect(seatMember({ kind: 'human', memberId: 'm1' }, members)).toEqual(members[0]);
    expect(seatMember({ kind: 'human', memberId: 'unknown' }, members)).toBeNull();
  });

  it('Bots erhalten das Bot-Porträt ihres Spiels und ein Standardschild', () => {
    const id0 = seatIdentity({ index: 0, kind: 'bot', gameId: 'ludo' });
    expect(id0.avatar).toBe(botAvatar('ludo'));
    expect(id0.crest).toBe(defaultCrest(0));

    const id1 = seatIdentity({
      index: 1,
      kind: 'bot',
      gameId: 'chess',
      seatAvatar: '🐱',
      memberAvatar: '🐶',
      memberCrest: 'schild:spitz;teilung:schraeg;farben:blau-silber;tier:🐶;raum:1',
      own: { avatar: '🦊', crest: 'schild:rund;teilung:einfarbig;farben:rot-gold;tier:🦊;raum:1' },
    });
    // Menschliche Avatar-/Wappenwerte werden für Bots ignoriert
    expect(id1.avatar).toBe(botAvatar('chess'));
    expect(id1.crest).toBe(defaultCrest(1));
    expect(parseCrest(id1.crest)).not.toBeNull();
  });

  it('Menschen ohne eigenen Avatar/Wappen erhalten Standardwerte je Platz', () => {
    const id0 = seatIdentity({ index: 0, kind: 'human', gameId: 'ludo' });
    const id1 = seatIdentity({ index: 1, kind: 'human', gameId: 'ludo' });

    expect(id0.avatar).toBe(defaultAvatar(0));
    expect(id0.crest).toBe(defaultCrest(0));
    expect(id1.avatar).toBe(defaultAvatar(1));
    expect(id1.crest).toBe(defaultCrest(1));
    expect(id0.avatar).not.toBe(id1.avatar);
    expect(id0.crest).not.toBe(id1.crest);
  });

  it('Ungültiger Avatar (ohne gemaltes Bild) fällt auf defaultAvatar zurück', () => {
    const id = seatIdentity({
      index: 2,
      kind: 'human',
      gameId: 'mau-mau',
      seatAvatar: '👾', // kein gemalter Tavernengast
    });
    expect(id.avatar).toBe(defaultAvatar(2));
  });

  it('Avatar-Rangfolge: seatAvatar vor memberAvatar vor own.avatar', () => {
    const id = seatIdentity({
      index: 0,
      kind: 'human',
      gameId: 'ludo',
      seatAvatar: '🐱',
      memberAvatar: '🐶',
      own: { avatar: '🦊' },
    });
    expect(id.avatar).toBe('🐱');

    const id2 = seatIdentity({
      index: 0,
      kind: 'human',
      gameId: 'ludo',
      seatAvatar: null,
      memberAvatar: '🐶',
      own: { avatar: '🦊' },
    });
    expect(id2.avatar).toBe('🐶');

    const id3 = seatIdentity({
      index: 0,
      kind: 'human',
      gameId: 'ludo',
      own: { avatar: '🦊' },
    });
    expect(id3.avatar).toBe('🦊');
  });

  it('Wappen-Rangfolge: memberCrest vor own.crest vor defaultCrest', () => {
    const crestA = 'schild:spitz;teilung:schraeg;farben:blau-silber;tier:🐶;raum:1';
    const crestB = 'schild:rund;teilung:einfarbig;farben:rot-gold;tier:🦊;raum:1';

    const id1 = seatIdentity({
      index: 0,
      kind: 'human',
      gameId: 'ludo',
      memberCrest: crestA,
      own: { crest: crestB },
    });
    expect(id1.crest).toBe(crestA);

    const id2 = seatIdentity({
      index: 0,
      kind: 'human',
      gameId: 'ludo',
      own: { crest: crestB },
    });
    expect(id2.crest).toBe(crestB);

    const id3 = seatIdentity({
      index: 3,
      kind: 'human',
      gameId: 'ludo',
      memberCrest: 'ungültiges wappen',
    });
    expect(id3.crest).toBe(defaultCrest(3));
  });

  it('Jeder zurückgegebene Wappentext besteht parseCrest', () => {
    for (let index = 0; index < 20; index++) {
      const human = seatIdentity({ index, kind: 'human', gameId: 'ludo' });
      const bot = seatIdentity({ index, kind: 'bot', gameId: 'ludo' });
      expect(parseCrest(human.crest), `human index ${index} must parse`).not.toBeNull();
      expect(parseCrest(bot.crest), `bot index ${index} must parse`).not.toBeNull();
    }
  });
});
