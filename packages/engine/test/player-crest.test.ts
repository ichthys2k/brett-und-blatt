import { describe, expect, it } from 'vitest';
import { CREST_COLORS, CREST_COLOR_SETS, CREST_ORNAMENTS, CREST_SHIELDS, DEFAULT_CREST, cleanCrest, clampCrest, parseCrest, serializeCrest, unlockOf, type CrestProgress } from '../src';

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

describe('Farbkombinationen (#201)', () => {
  const hex = (color: string) => [1, 3, 5].map((at) => parseInt(color.slice(at, at + 2), 16));
  const distance = (a: string, b: string) => Math.hypot(...hex(a).map((v, i) => v - hex(b)[i]!));

  it('Kennungen sind eindeutig, Namen und 2 bis 4 gültige Farben vorhanden', () => {
    const ids = new Set<string>();
    for (const set of CREST_COLOR_SETS) {
      expect(ids.has(set.id), set.id).toBe(false);
      ids.add(set.id);
      expect(set.name.length).toBeGreaterThan(0);
      expect(set.colors.length).toBeGreaterThanOrEqual(2);
      expect(set.colors.length).toBeLessThanOrEqual(4);
      for (const color of set.colors) expect(color).toMatch(/^#[0-9A-F]{6}$/);
      expect(set.colorNames.split(', ')).toHaveLength(set.colors.length);
      expect(set.id).toMatch(/^[a-z0-9-]{3,32}$/);
    }
  });

  it('benachbarte Farben lassen sich unterscheiden', () => {
    for (const set of CREST_COLOR_SETS) {
      for (let i = 1; i < set.colors.length; i++) expect(distance(set.colors[i - 1]!, set.colors[i]!), set.id).toBeGreaterThan(60);
    }
  });

  it('die alten Kennungen gelten weiter, neue sind frei, alle überstehen Schreiben und Lesen', () => {
    for (const id of ['rot-gold', 'blau-silber', 'gruen-gold', 'schwarz-gold', 'purpur-silber', 'orange-blau']) expect(CREST_COLORS).toContain(id);
    // Städte, Länder, Vereine müssen erspielt werden; die Schwelle steigt mit der Stelle in der Liste.
    expect(unlockOf('colors', 'stadt-reutlingen', none).ok).toBe(false);
    expect(unlockOf('colors', 'stadt-reutlingen', { ...none, played: 3 }).ok).toBe(true);
    expect(unlockOf('colors', 'stadt-tuebingen', { ...none, played: 3 }).hint).toBe('6 Partien (du hast 3)');
    expect(unlockOf('colors', 'land-be', { ...none, stamps: 1 }).ok).toBe(true);
    expect(unlockOf('colors', 'land-bg', { ...none, stamps: 1 }).ok).toBe(false);
    expect(unlockOf('colors', 'bl-bayern', { ...none, wins: 2 }).ok).toBe(true);
    expect(unlockOf('colors', 'sport-ssv-reutlingen', none).ok).toBe(false);
    expect(unlockOf('colors', 'sport-ssv-reutlingen', { ...none, tournamentWins: 1 }).ok).toBe(true);
    expect(parseCrest('farben:bl-bayern')!.colors).toBe('bl-bayern');
    expect(parseCrest('farben:land-de')!.colors).toBe('land-de');
    expect(parseCrest('farben:gibt-es-nicht')!.colors).toBe(DEFAULT_CREST.colors);
    for (const colors of CREST_COLORS) expect(serializeCrest(parseCrest(serializeCrest({ ...DEFAULT_CREST, colors }))!)).toBe(serializeCrest({ ...DEFAULT_CREST, colors }));
  });

  it('Gruppen: Städte, Länder (ohne ungeprüftes Zypern), Bundesliga mit 18 Vereinen', () => {
    const count = (group: string) => CREST_COLOR_SETS.filter((set) => set.group === group).length;
    expect(count('fussball')).toBe(18);
    expect(count('laender')).toBe(27);
    expect(count('staedte')).toBeGreaterThanOrEqual(5);
  });
});
