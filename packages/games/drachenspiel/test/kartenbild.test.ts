import { describe, expect, it } from 'vitest';
import { CARDS_DB } from '../src/cards';
import { cardArtFileFor, cardArtOf, cardArtUrl } from '../src/ui/cardArt';

// Großansicht mit gemaltem Bild (#417): welches Bild eine Karte zeigt.
describe('Kartenbild der Großansicht', () => {
  it('jede Karte des Grundspiels hat ein eingebautes Bild', () => {
    const ohne = Object.keys(CARDS_DB).filter((id) => !cardArtOf(id));
    expect(ohne).toEqual([]);
  });

  it('nimmt ohne Anki-Feld das eingebaute Bild', () => {
    expect(cardArtFileFor('bug_bee', undefined)).toBe('bub-ds-bug_bee.webp');
    expect(cardArtUrl('bug_bee', undefined, undefined)).toBeTruthy();
  });

  it('ein Bild aus dem Anki-Feld „Bild“ hat Vorrang', () => {
    expect(cardArtFileFor('bug_bee', '<img src="eigene-biene.webp">')).toBe('eigene-biene.webp');
    expect(cardArtUrl('bug_bee', "<img class='x' src='eigene-biene.webp'>", { 'eigene-biene.webp': 'blob:biene' })).toBe('blob:biene');
  });

  it('ein Emoji im Feld „Bild“ lässt das eingebaute Bild stehen', () => {
    expect(cardArtFileFor('bug_bee', '🐝')).toBe('bub-ds-bug_bee.webp');
  });

  it('unbekannte Karten ohne Bild ergeben undefined', () => {
    expect(cardArtFileFor('gibt_es_nicht', undefined)).toBeUndefined();
    expect(cardArtUrl('gibt_es_nicht', undefined, undefined)).toBeUndefined();
  });
});
