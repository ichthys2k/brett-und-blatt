/**
 * Klänge der VR-App (#349): wenige Effekte aus dem Katalog der Web-App, abgespielt über Web Audio.
 * Fehlen die Dateien (Build ohne das private Klang-Repo), bleibt alles still.
 */
import type { GameMessage } from '@brett-und-blatt/online';
import catalog from '../../../packages/ui/src/audio/catalog.json';
import type { XrSoundName } from './sound-names';

interface Spec {
  file: string;
  start?: number;
  end?: number;
  gain?: number;
}

type GameEvent = GameMessage['events'][number];

const STORE = 'brett-und-blatt-xr-ton';
let volume = readVolume();
let context: AudioContext | null = null;
const buffers = new Map<string, Promise<AudioBuffer | null>>();
const listeners = new Set<() => void>();

function readVolume(): number {
  try {
    const value = Number(localStorage.getItem(STORE));
    return localStorage.getItem(STORE) !== null && Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0.7;
  } catch {
    return 0.7;
  }
}

export function getVolume(): number {
  return volume;
}

export function setVolume(next: number): void {
  volume = Math.round(Math.min(1, Math.max(0, next)) * 10) / 10;
  try {
    localStorage.setItem(STORE, String(volume));
  } catch {
    // ohne Speicher nur bis zum Neuladen
  }
  for (const fn of listeners) fn();
}

export function onVolumeChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Browser erlauben Ton erst nach einer Berührung; beim ersten Klick aufrufen. */
export function unlockAudio(): void {
  context ??= new AudioContext();
  if (context.state === 'suspended') void context.resume();
}

function load(file: string): Promise<AudioBuffer | null> {
  let hit = buffers.get(file);
  if (!hit) {
    hit = fetch(`${import.meta.env.BASE_URL}klaenge/${file}`)
      .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(String(r.status)))))
      .then((data) => context!.decodeAudioData(data))
      .catch(() => null);
    buffers.set(file, hit);
  }
  return hit;
}

export function play(name: XrSoundName): void {
  if (volume <= 0 || !context) return;
  const spec = (catalog as Record<string, Spec>)[name];
  if (!spec) return;
  void load(spec.file).then((buffer) => {
    if (!buffer || !context) return;
    const source = context.createBufferSource();
    source.buffer = buffer;
    const gain = context.createGain();
    gain.gain.value = volume * (spec.gain ?? 1) * 0.6;
    source.connect(gain).connect(context.destination);
    const start = spec.start ?? 0;
    source.start(0, start, spec.end !== undefined ? Math.max(0.05, spec.end - start) : undefined);
  });
}

/**
 * Welcher Klang zu einem Ereignis passt – ohne Spielregeln, nur nach Art des Ereignisses,
 * angelehnt an die Klänge, die die Spiele in der Web-App nutzen.
 */
export function soundsFor(gameId: string, event: GameEvent): XrSoundName[] {
  const e = event as GameEvent & { captured?: unknown; flipped?: unknown[]; san?: string };
  switch (event.type) {
    case 'placed':
      if (gameId === 'go') return Array.isArray(e.captured) && e.captured.length ? ['stein-schlagen'] : ['stein-schiefer'];
      if (gameId === 'gomoku') return ['stein-schiefer'];
      if (gameId === 'reversi' && e.flipped?.length) return ['stein-setzen', 'steine-wenden'];
      return ['stein-setzen'];
    case 'dropped':
      return ['stein-fallen'];
    case 'popped':
      return ['stein-heraus'];
    case 'moved':
      if (typeof e.san === 'string' && /^O-O/.test(e.san)) return ['schach-rochade'];
      if (typeof e.san === 'string' && /=/.test(e.san)) return ['schach-umwandlung'];
      return e.captured ? ['stein-schlagen'] : ['stein-ziehen'];
    case 'mill':
      return ['muehle'];
    case 'removed':
      return ['stein-schlagen'];
    case 'drawOffered':
      return ['remis-angebot'];
    case 'win':
      return gameId === 'gomoku' ? ['gomoku-fuenf'] : [];
    default:
      return [];
  }
}
