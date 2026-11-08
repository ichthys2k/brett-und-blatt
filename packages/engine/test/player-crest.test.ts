import { describe, expect, it } from 'vitest';
import { CREST_COLORS, CREST_ORNAMENTS, CREST_SHIELDS, DEFAULT_CREST, cleanCrest, clampCrest, parseCrest, serializeCrest, unlockOf, type CrestProgress } from '../src';

const none: CrestProgress = { stamps: 0, trophies: 0, wins: 0, played: 0, tournamentWins: 0, categoriesComplete: 0 };

describe('Spielerwappen (#147)', () => {
  it('schreibt und liest in Normalform, auch mit gemischter Reihenfolge', () => {
    const spec = { shield: 'spitz', division: 'schraeg', colors: 'purpur-silber', animal: '🦄', ornaments: ['band', 'krone'], inRoom: false } as const;
    const text = serializeCrest({ ...spec, ornaments: [...spec.ornaments] });
    expect(text).toBe('schild:spitz;teilung:schraeg;farben:purpur-silber;tier:🦄;zier:krone,band;raum:0');
    expect(parseCrest(text)).toEqual({ ...spec, ornaments: ['krone', 'band'] });
    expect(cleanCrest('raum:0;zier:band,krone;tier:🦄;farben:purpur-silber;teilung:schraeg;schild:spitz')).toBe(text);
  });

  it('jede Kombination ist stabil (Schreiben, Lesen, Schreiben)', () => {
    for (const shield of CREST_SHIELDS) for (const colors of CREST_COLORS) {
      const text = serializeCrest({ ...DEFAULT_CREST, shield, colors, ornaments: [...CREST_ORNAMENTS] });
      expect(serializeCrest(parseCrest(text)!)).toBe(text);
    }
  });

  it('verwirft alles, was nicht erlaubt ist', () => {
    expect(parseCrest(null)).toBeNull();
    expect(parseCrest('')).toBeNull();
    expect(parseCrest('x'.repeat(200))).toBeNull();
    expect(parseCrest('kein wappen')).toBeNull();
    const odd = parseCrest('schild:dreieck;teilung:wild;farben:pink;tier:<b>hi</b>;zier:krone,krone,hut;raum:ja')!;
    expect(odd).toEqual({ ...DEFAULT_CREST, ornaments: ['krone'], inRoom: true });
    // Tiere: ein Emoji ja, Text, Ziffern und zu lange Ketten nein
    expect(parseCrest('tier:🐸')!.animal).toBe('🐸');
    expect(parseCrest('tier:abc')!.animal).toBe(DEFAULT_CREST.animal);
    expect(parseCrest('tier:12')!.animal).toBe(DEFAULT_CREST.animal);
    expect(parseCrest('tier:' + '🐸'.repeat(6))!.animal).toBe(DEFAULT_CREST.animal);
    expect(parseCrest('tier:👩‍🚀')!.animal).toBe('👩‍🚀');
  });

  it('Freischalten: die Zahlen aus den Entwürfen', () => {
    expect(unlockOf('shield', 'klassisch', none)).toEqual({ ok: true, hint: '' });
    expect(unlockOf('division', 'quer', none).ok).toBe(true);
    expect(unlockOf('colors', 'rot-gold', none).ok).toBe(true);
    expect(unlockOf('shield', 'spitz', { ...none, stamps: 5 })).toEqual({ ok: false, hint: '10 Stempel (du hast 5)' });
    expect(unlockOf('shield', 'spitz', { ...none, stamps: 10 }).ok).toBe(true);
    expect(unlockOf('shield', 'rund', { ...none, stamps: 5 }).ok).toBe(true);
    expect(unlockOf('shield', 'rolle', { ...none, stamps: 19 }).ok).toBe(false);
    expect(unlockOf('division', 'geteilt', { ...none, stamps: 3 }).ok).toBe(true);
    expect(unlockOf('division', 'schraeg', { ...none, stamps: 4 }).ok).toBe(false);
    expect(unlockOf('colors', 'schwarz-gold', { ...none, wins: 10 }).ok).toBe(true);
    expect(unlockOf('colors', 'purpur-silber', { ...none, categoriesComplete: 1 }).ok).toBe(true);
    expect(unlockOf('colors', 'orange-blau', { ...none, played: 24 }).hint).toBe('25 Partien (du hast 24)');
    expect(unlockOf('ornament', 'rahmen', { ...none, trophies: 2 }).hint).toBe('3 Pokale (du hast 2)');
    expect(unlockOf('ornament', 'krone', { ...none, trophies: 5 }).ok).toBe(true);
    expect(unlockOf('ornament', 'lorbeer', { ...none, tournamentWins: 1 }).ok).toBe(true);
    expect(unlockOf('ornament', 'band', none).ok).toBe(false);
  });

  it('gesperrte Teile fallen auf die Vorgabe zurück', () => {
    const spec = { shield: 'rolle', division: 'schraeg', colors: 'schwarz-gold', animal: '🦊', ornaments: ['krone', 'band', 'lorbeer'], inRoom: true } as const;
    const clamped = clampCrest({ ...spec, ornaments: [...spec.ornaments] }, { ...none, stamps: 5, trophies: 5 });
    expect(clamped).toMatchObject({ shield: 'klassisch', division: 'schraeg', colors: 'rot-gold', ornaments: ['krone'], animal: '🦊' });
  });
});
