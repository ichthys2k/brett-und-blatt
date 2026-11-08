import { describe, expect, it } from 'vitest';
import { NOTES_MAX_AGE_MS, NOTES_MAX_GAMES, NOTE_MAX_LENGTH, sanitizeNotes, withNote, notesKey } from '../apps/web/src/lib/notes';

const NOW = 1_800_000_000_000;

describe('Notizblock (#105)', () => {
  it('speichert je Partie und Platz getrennt', () => {
    let store = withNote({}, 'skat:a', '0', 'Karo-Bube bei Ben', NOW);
    store = withNote(store, 'skat:a', '1', 'Kreuz fehlt', NOW);
    expect(store['skat:a']?.texts).toEqual({ '0': 'Karo-Bube bei Ben', '1': 'Kreuz fehlt' });
    expect(notesKey('skat', 'a')).toBe('skat:a');
  });

  it('löscht eine Notiz, wenn der Text leer wird', () => {
    const store = withNote(withNote({}, 'g:p', 'ich', 'x', NOW), 'g:p', 'ich', '  ', NOW);
    expect(store).toEqual({});
  });

  it('wirft Notizen nach 30 Tagen weg', () => {
    const store = { alt: { at: NOW - NOTES_MAX_AGE_MS - 1, texts: { ich: 'x' } }, neu: { at: NOW - 1000, texts: { ich: 'y' } } };
    expect(Object.keys(sanitizeNotes(store, NOW))).toEqual(['neu']);
  });

  it('behält höchstens 20 Partien, die jüngsten', () => {
    const store = Object.fromEntries(Array.from({ length: 30 }, (_, i) => [`g:${i}`, { at: NOW - i * 1000, texts: { ich: 'x' } }]));
    const clean = sanitizeNotes(store, NOW);
    expect(Object.keys(clean)).toHaveLength(NOTES_MAX_GAMES);
    expect(clean['g:0']).toBeDefined();
    expect(clean['g:29']).toBeUndefined();
  });

  it('kürzt zu lange Texte und ignoriert Unbrauchbares', () => {
    expect(withNote({}, 'g:p', 'ich', 'a'.repeat(NOTE_MAX_LENGTH + 50), NOW)['g:p']?.texts.ich).toHaveLength(NOTE_MAX_LENGTH);
    expect(sanitizeNotes('kaputt', NOW)).toEqual({});
    expect(sanitizeNotes({ g: { at: 'x', texts: {} }, h: { at: NOW, texts: { ich: 5 } } }, NOW)).toEqual({});
  });
});
