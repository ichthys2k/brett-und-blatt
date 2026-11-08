import { describe, expect, it } from 'vitest';
import { DEFAULT_SOUND_SETTINGS, soundCatalog, soundDuration, soundSettingsFrom, soundsForEvents, eventsOfSeats, type SoundMap } from '../src/audio/sound';

describe('DEFAULT_SOUND_SETTINGS', () => {
  it('hat clientMusic standardmäßig deaktiviert', () => {
    expect(DEFAULT_SOUND_SETTINGS.clientMusic).toBe(false);
  });
});

describe('soundSettingsFrom', () => {
  it('nimmt ohne Gespeichertes die Standardwerte', () => {
    expect(soundSettingsFrom({})).toEqual(DEFAULT_SOUND_SETTINGS);
  });

  it('übernimmt das frühere gemeinsame Stummschalten für beides', () => {
    const settings = soundSettingsFrom({ muted: true, effects: 0.2 });
    expect(settings).toMatchObject({ effectsOff: true, musicOff: true, effects: 0.2 });
    expect(settings).not.toHaveProperty('muted');
  });

  it('schaltet Effekte und Musik getrennt', () => {
    expect(soundSettingsFrom({ effectsOff: true, musicOff: false })).toMatchObject({ effectsOff: true, musicOff: false });
    expect(soundSettingsFrom({ effectsOff: false, musicOff: true })).toMatchObject({ effectsOff: false, musicOff: true });
  });
});

describe('Klang-Katalog', () => {
  it('hat gültige Einträge', () => {
    for (const [name, spec] of Object.entries(soundCatalog)) {
      expect(name, name).toMatch(/^[a-z]+(-[a-z]+)*$/);
      expect(spec.file, name).toMatch(/^[a-z0-9_]+\.mp3$/);
      expect(spec.start ?? 0, name).toBeGreaterThanOrEqual(0);
      if (spec.end !== undefined) expect(spec.end, name).toBeGreaterThan(spec.start ?? 0);
      expect(spec.gain ?? 1, name).toBeGreaterThan(0);
      expect(spec.gain ?? 1, name).toBeLessThanOrEqual(3);
      // Effekte sind kurz; Jingles dürfen etwas länger sein.
      expect(soundDuration(name as keyof typeof soundCatalog), name).toBeLessThanOrEqual(2.5);
    }
  });
});

describe('soundsForEvents', () => {
  const map: SoundMap = {
    moved: (event) => [event.captured ? 'stein-schlagen' : 'stein-ziehen', ...(event.check ? (['schach'] as const) : [])],
    placed: 'stein-setzen',
    ignored: () => null,
  };

  it('ordnet Ereignisse in Reihenfolge zu und lässt Doppelte weg', () => {
    expect(soundsForEvents([{ type: 'placed' }, { type: 'placed' }, { type: 'unbekannt' }], map)).toEqual(['stein-setzen']);
    expect(soundsForEvents([{ type: 'moved', captured: 'p', check: true }], map)).toEqual(['stein-schlagen', 'schach']);
    expect(soundsForEvents([{ type: 'moved', captured: null, check: false }, { type: 'ignored' }], map)).toEqual(['stein-ziehen']);
  });

  it('bleibt ohne Zuordnung still', () => {
    expect(soundsForEvents([{ type: 'placed' }], undefined)).toEqual([]);
  });
});

describe('eventsOfSeats', () => {
  it('lässt nur Ereignisse der eigenen Plätze und solche ohne Platz durch', () => {
    const events = [{ type: 'bought', seat: 0 }, { type: 'bought', seat: 1 }, { type: 'roundStart' }];
    expect(eventsOfSeats(events, [1])).toEqual([{ type: 'bought', seat: 1 }, { type: 'roundStart' }]);
    expect(eventsOfSeats(events, [0, 1])).toEqual(events);
  });
});
