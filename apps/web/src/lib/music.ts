import { DEFAULT_MUSIC_PREFS, defaultPlaylist, MusicPlayer, type MusicPrefs, type MusicTrack, playlistTracks, playlists } from '@brett-und-blatt/ui';
import { useEffect, useSyncExternalStore } from 'react';
import { getSoundSettings, sound, subscribeSoundSettings } from './sound';

/*
 * Musik für die ganze App. Sie läuft in Partien (lokal und online) und in den
 * Ton-Einstellungen zum Probehören; die Stücke baut vite.config.ts unter
 * „klaenge/musik/“ ein und lädt sie erst beim Abspielen.
 */
const PREFS_KEY = 'brett-und-blatt:musik';

export interface MusicSettings extends MusicPrefs {
  /** Gewählte Playlist je Spiel, wenn sie von der Standard-Playlist abweicht. */
  playlists: Record<string, string>;
}

export const music = new MusicPlayer(`${import.meta.env.BASE_URL}klaenge/musik/`, () => sound.audioContext());

const strings = (value: unknown): string[] => (Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []);

function loadPrefs(): MusicSettings {
  try {
    const raw = window.localStorage.getItem(PREFS_KEY);
    const saved = raw ? (JSON.parse(raw) as Partial<MusicSettings>) : {};
    const chosen = saved.playlists && typeof saved.playlists === 'object' ? saved.playlists : {};
    return {
      starred: strings(saved.starred),
      excluded: strings(saved.excluded),
      onlyStars: typeof saved.onlyStars === 'boolean' ? saved.onlyStars : DEFAULT_MUSIC_PREFS.onlyStars,
      playlists: Object.fromEntries(Object.entries(chosen).filter(([, id]) => playlists.some((list) => list.id === id))),
    };
  } catch {
    return { ...DEFAULT_MUSIC_PREFS, playlists: {} };
  }
}

let prefs = loadPrefs();
const listeners = new Set<() => void>();

export function setMusicPrefs(next: Partial<MusicSettings>): void {
  prefs = { ...prefs, ...next };
  try {
    window.localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // Speicher gesperrt – gilt dann nur bis zum Neuladen.
  }
  for (const listener of listeners) listener();
}

export function useMusicPrefs(): MusicSettings {
  return useSyncExternalStore(
    (onChange) => {
      listeners.add(onChange);
      return () => listeners.delete(onChange);
    },
    () => prefs,
  );
}

export function toggleStar(track: MusicTrack): void {
  const starred = prefs.starred.includes(track.id) ? prefs.starred.filter((id) => id !== track.id) : [...prefs.starred, track.id];
  setMusicPrefs({ starred, excluded: prefs.excluded.filter((id) => id !== track.id) });
}

export function toggleExcluded(track: MusicTrack): void {
  const excluded = prefs.excluded.includes(track.id) ? prefs.excluded.filter((id) => id !== track.id) : [...prefs.excluded, track.id];
  setMusicPrefs({ excluded, starred: prefs.starred.filter((id) => id !== track.id) });
}

/** Die Playlist, die in diesem Spiel läuft. */
export function playlistFor(gameId: string, settings: MusicSettings = prefs): string {
  return settings.playlists[gameId] ?? defaultPlaylist(gameId);
}

export function choosePlaylist(gameId: string, playlistId: string): void {
  const { [gameId]: _, ...rest } = prefs.playlists;
  setMusicPrefs({ playlists: playlistId === defaultPlaylist(gameId) ? rest : { ...rest, [gameId]: playlistId } });
}

/** Das laufende Stück, für Anzeigen. */
export function useCurrentTrack(): MusicTrack | null {
  return useSyncExternalStore(
    (onChange) => music.subscribe(onChange),
    () => music.current,
  );
}

/** Musik zur Partie: die Playlist des Spiels, solange die Komponente da ist. */
export function useGameMusic(gameId: string): void {
  const settings = useMusicPrefs();
  const playlistId = playlistFor(gameId, settings);
  useEffect(() => () => music.stop(), []);
  useEffect(() => music.play(playlistTracks(playlistId), settings), [playlistId, settings]);
}

const applyVolume = () => {
  const settings = getSoundSettings();
  music.setVolume(settings.muted ? 0 : settings.music);
};
applyVolume();
subscribeSoundSettings(applyVolume);

for (const type of ['pointerdown', 'keydown'] as const) window.addEventListener(type, () => music.unlock(), { capture: true, passive: true });
document.addEventListener('visibilitychange', () => music.setHidden(document.hidden));
