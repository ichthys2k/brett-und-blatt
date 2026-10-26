import { describe, expect, it } from 'vitest';
import { getCreatureAudioUrl } from '../src/ui/audio';

describe('Drachenspiel Creature Audio', () => {
  it('generiert korrekte URLs für Profil-Tiere mit Artikel', () => {
    const url = getCreatureAudioUrl('Ameise', 'play');
    expect(url).toMatch(/\/klaenge\/tiere\/ameise\/(12|13|14|15|16)_Die%20Ameise\.mp3$/);
  });

  it('generiert korrekte URLs für Profil-Tiere ohne Artikel', () => {
    const url = getCreatureAudioUrl('Alpha-Wolf', 'attack');
    expect(url).toMatch(/\/klaenge\/tiere\/alpha-wolf\/(02|03|04|05|06)_Alpha-Wolf\.mp3$/);
  });

  it('generiert EasterEgg-URLs für Profil-Tiere', () => {
    const url = getCreatureAudioUrl('Frosch', 'easterEgg');
    expect(url).toMatch(/\/klaenge\/tiere\/frosch\/(17|18|19|20|21)_Der%20Frosch\.mp3$/);
  });

  it('generiert Fallback-URLs für Einzelkarten', () => {
    const url = getCreatureAudioUrl('Mücke', 'play', 'mücke.mp3');
    expect(url).toMatch(/\/klaenge\/tiere\/m%C3%BCcke\.mp3$/);
  });

  it('nutzt Tierlaut-Fallbacks für Karten ohne Sprachausgabe', () => {
    const url = getCreatureAudioUrl('Hahn', 'play');
    expect(url).toMatch(/\/klaenge\/chicken_cluck\.mp3$/);
  });

  it('gibt null zurück, wenn kein Sound vorhanden ist', () => {
    const url = getCreatureAudioUrl('UnbekanntesTier', 'play', null);
    expect(url).toBeNull();
  });
});
