import { DEFAULT_SOUND_SETTINGS, SoundPlayer, type SoundSettings } from '@brett-und-blatt/ui';
import { useSyncExternalStore } from 'react';

/*
 * Ton für die ganze App. Die Dateien baut vite.config.ts unter „klaenge/“ ein,
 * wenn das Klang-Repo vorhanden ist; sonst bleibt alles still.
 */
const SETTINGS_KEY = 'brett-und-blatt:ton';

export const sound = new SoundPlayer(`${import.meta.env.BASE_URL}klaenge/`);

function loadSettings(): SoundSettings {
  try {
    const raw = window.localStorage.getItem(SETTINGS_KEY);
    const saved = raw ? (JSON.parse(raw) as Partial<SoundSettings>) : {};
    return {
      muted: typeof saved.muted === 'boolean' ? saved.muted : DEFAULT_SOUND_SETTINGS.muted,
      effects: typeof saved.effects === 'number' ? saved.effects : DEFAULT_SOUND_SETTINGS.effects,
    };
  } catch {
    return DEFAULT_SOUND_SETTINGS;
  }
}

let settings = loadSettings();
const listeners = new Set<() => void>();
sound.setSettings(settings);

export function setSoundSettings(next: Partial<SoundSettings>): void {
  settings = { ...settings, ...next };
  sound.setSettings(settings);
  try {
    window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // Speicher gesperrt – gilt dann nur bis zum Neuladen.
  }
  for (const listener of listeners) listener();
}

export function useSoundSettings(): SoundSettings {
  return useSyncExternalStore(
    (onChange) => {
      listeners.add(onChange);
      return () => listeners.delete(onChange);
    },
    () => settings,
  );
}

// Browser erlauben Ton erst nach einer Berührung; jede weitere weckt den Ton auch nach einer Unterbrechung (z. B. Anruf).
for (const type of ['pointerdown', 'keydown'] as const) window.addEventListener(type, () => sound.unlock(), { capture: true, passive: true });
