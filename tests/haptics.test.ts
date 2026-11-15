import { describe, expect, it } from 'vitest';
import { HAPTIC_PATTERNS, hapticFor } from '../apps/web/src/lib/haptics';
import { CARDS_DB } from '../packages/games/drachenspiel/src/cards';
import { CREATURE_HAPTICS, DRACHENSPIEL_HAPTICS, SPELL_HAPTICS } from '../packages/games/drachenspiel/src/ui/haptics';
import { hapticsForEvents, soundCatalog } from '../packages/ui/src';

describe('Vibration (#89)', () => {
  it('ordnet Treffer, Fehler, kräftige Stöße und Sieg zu', () => {
    expect(hapticFor('treffer')).toBe('hit');
    expect(hapticFor('quiz-falsch')).toBe('error');
    expect(hapticFor('poker-all-in')).toBe('heavy');
    expect(hapticFor('schach-matt')).toBe('heavy');
    expect(hapticFor('sieg')).toBe('win');
    expect(hapticFor('wuerfeln')).toBe('tick');
    expect(hapticFor('mischen')).toBeNull();
  });

  it('kennt nur Klangnamen, die es im Katalog gibt', () => {
    const names = [
      'wuerfeln',
      'wuerfelbecher-schuetteln',
      'stein-fallen',
      'klopfen-stoss',
      'reizen-klopfen',
      'schach-rochade',
      'ruebenacker-hopps',
      'ruf-mau',
      'ruf-eins',
      'treffer',
      'kein-paar',
      'karten-klatsch',
      'wort-mittel',
      'wort-kurz',
      'go-gefangene',
      'mauer-fertig',
      'fs-angriff',
      'schach-umwandlung',
      'poker-pot',
      'poker-all-in',
      'ruf-fertig',
      'ruf-re',
      'ruf-kontra',
      'ruf-sauspiel',
      'ruf-wenz',
      'ruf-revolution',
      'ruf-maexle',
      'ruf-tout',
      'ruf-solo',
      'ruf-schwarz',
      'ruf-schneider',
      'quiz-falsch',
      'galgen-falsch',
      'strafe-ziehen',
      'peter-gezogen',
      'ruebenacker-maulwurf',
      'ruf-schach',
      'nh-buh',
      'sieg',
      'niederlage',
      'zeit-um',
      'schach-matt',
      'ruf-bingo',
      'ruf-speed',
      'ruf-kartenblitz',
    ];
    for (const name of names) {
      expect(name in soundCatalog).toBe(true);
      expect(hapticFor(name)).not.toBeNull();
    }
  });

  it('hält alle Impulse kurz (<= 300 ms)', () => {
    for (const pattern of Object.values(HAPTIC_PATTERNS)) {
      expect(pattern.reduce((a, b) => a + b, 0)).toBeLessThanOrEqual(300);
    }
    for (const pattern of [...Object.values(CREATURE_HAPTICS), ...Object.values(SPELL_HAPTICS)]) {
      expect(pattern.length).toBeGreaterThan(0);
      expect(pattern.reduce((a, b) => a + b, 0)).toBeLessThanOrEqual(300);
    }
  });

  it('ordnet Drachenspiel-Kreaturen und -Zaubern gültige, eigene Muster zu', () => {
    for (const id of [...Object.keys(CREATURE_HAPTICS), ...Object.keys(SPELL_HAPTICS)]) {
      expect(id in CARDS_DB).toBe(true);
    }
    expect(hapticsForEvents([{ type: 'cardPlayed', card: { id: 'c54' } }], DRACHENSPIEL_HAPTICS)).toEqual([CREATURE_HAPTICS.c54]);
    expect(hapticsForEvents([{ type: 'minionAwoke', minion: { cardId: 'token_eggdragon' } }], DRACHENSPIEL_HAPTICS)).toEqual([
      CREATURE_HAPTICS.token_eggdragon,
    ]);
    expect(hapticsForEvents([{ type: 'spellCast', card: { id: 'n_dragonbreath' } }], DRACHENSPIEL_HAPTICS)).toEqual([
      SPELL_HAPTICS.n_dragonbreath,
    ]);
    expect(hapticsForEvents([{ type: 'trapSprung' }], DRACHENSPIEL_HAPTICS)).toEqual([[45, 30, 25]]);
    expect(hapticsForEvents([{ type: 'cardPlayed', card: { id: 'c1' } }], DRACHENSPIEL_HAPTICS)).toEqual([]);
  });
});
