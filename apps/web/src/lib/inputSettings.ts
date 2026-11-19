import { DEFAULT_INPUT_SETTINGS, type InputSettings } from '@brett-und-blatt/ui';
import { useSyncExternalStore } from 'react';

const STORAGE_KEY = 'brett-und-blatt:eingabe';
const CHANGE_EVENT = 'bub:input-settings-changed';

let cachedRaw: string | null = null;
let cachedParsed: InputSettings = DEFAULT_INPUT_SETTINGS;

export function loadInputSettings(): InputSettings {
  if (typeof localStorage === 'undefined') return DEFAULT_INPUT_SETTINGS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === cachedRaw) return cachedParsed;
    cachedRaw = raw;
    if (!raw) {
      cachedParsed = DEFAULT_INPUT_SETTINGS;
      return cachedParsed;
    }
    const data = JSON.parse(raw) as Partial<InputSettings>;
    cachedParsed = {
      mode:
        data.mode === 'standard' ||
        data.mode === 'legalMoves' ||
        data.mode === 'scanAuto' ||
        data.mode === 'scanStep'
          ? data.mode
          : DEFAULT_INPUT_SETTINGS.mode,
      deadzone:
        typeof data.deadzone === 'number' && data.deadzone >= 0.1 && data.deadzone <= 0.6
          ? data.deadzone
          : DEFAULT_INPUT_SETTINGS.deadzone,
      scanIntervalMs:
        typeof data.scanIntervalMs === 'number' && data.scanIntervalMs >= 400 && data.scanIntervalMs <= 3000
          ? data.scanIntervalMs
          : DEFAULT_INPUT_SETTINGS.scanIntervalMs,
      haptics: typeof data.haptics === 'boolean' ? data.haptics : DEFAULT_INPUT_SETTINGS.haptics,
      hotSeatMode: data.hotSeatMode === 'multi' ? 'multi' : 'pass',
    };
    return cachedParsed;
  } catch {
    return DEFAULT_INPUT_SETTINGS;
  }
}

export function saveInputSettings(patch: Partial<InputSettings>): void {
  const next: InputSettings = { ...loadInputSettings(), ...patch };
  if (typeof localStorage !== 'undefined') {
    const raw = JSON.stringify(next);
    cachedRaw = raw;
    cachedParsed = next;
    localStorage.setItem(STORAGE_KEY, raw);
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }
}

export function useInputSettings(): InputSettings {
  return useSyncExternalStore(
    (onChange) => {
      if (typeof window === 'undefined') return () => {};
      window.addEventListener(CHANGE_EVENT, onChange);
      window.addEventListener('storage', onChange);
      return () => {
        window.removeEventListener(CHANGE_EVENT, onChange);
        window.removeEventListener('storage', onChange);
      };
    },
    () => loadInputSettings(),
    () => DEFAULT_INPUT_SETTINGS,
  );
}
