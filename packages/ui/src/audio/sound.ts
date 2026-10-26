import type { GameEvent } from '@brett-und-blatt/engine';
import catalog from './catalog.json';

/*
 * Klänge für alle Spiele. Die Spiele nennen nur Klangnamen (z. B. „stein-setzen“);
 * welche Datei dahintersteht, regelt der Katalog. Die Dateien selbst liegen nicht im
 * öffentlichen Repo (siehe docs/KONZEPT.md, Abschnitt „Klänge“) – fehlen sie, bleibt
 * die App einfach stumm.
 */

export type SoundName = keyof typeof catalog;

export interface SoundSpec {
  file: string;
  /** Ausschnitt der Datei in Sekunden. */
  start?: number;
  end?: number;
  /** Angleichung der Lautheit, 1 = unverändert. */
  gain?: number;
  /** Abspielgeschwindigkeit (und damit Tonhöhe), 1 = unverändert. */
  rate?: number;
}

export const soundCatalog: Record<SoundName, SoundSpec> = catalog;

/** Alle Dateien, die der Katalog braucht – ohne Doppelte. */
export const soundFiles: string[] = [...new Set(Object.values(soundCatalog).map((spec) => spec.file))].sort();

/** Wie ein Spiel seine Ereignisse vertont: Ereignistyp → Klangname, oder eine Funktion für Feinheiten. */
export type SoundMap = Record<string, SoundName | ((event: GameEvent) => SoundName | SoundName[] | null)>;

/** Die Klänge zu den Ereignissen eines Zugs, in Reihenfolge und ohne Doppelte. */
export function soundsForEvents(events: GameEvent[], map: SoundMap | undefined): SoundName[] {
  if (!map) return [];
  const names: SoundName[] = [];
  for (const event of events) {
    const entry = map[event.type];
    const found = typeof entry === 'function' ? entry(event) : entry;
    for (const name of Array.isArray(found) ? found : found ? [found] : []) if (!names.includes(name)) names.push(name);
  }
  return names;
}

/** Länge eines Klangs in Sekunden (ohne Ausschnitt nicht bekannt, dann 0,3 s). */
export function soundDuration(name: SoundName): number {
  const spec = soundCatalog[name];
  return spec.end === undefined ? 0.3 : (spec.end - (spec.start ?? 0)) / (spec.rate ?? 1);
}

export interface SoundSettings {
  muted: boolean;
  /** Lautstärke der Effekte, 0 bis 1. */
  effects: number;
  /** Lautstärke der Musik, 0 bis 1 (spielt der MusicPlayer). */
  music: number;
}

export const DEFAULT_SOUND_SETTINGS: SoundSettings = { muted: false, effects: 0.7, music: 0.4 };

const FADE_S = 0.03;

/** Spielt Klänge über Web Audio ab. Eine Instanz für die ganze App. */
export class SoundPlayer {
  private context: AudioContext | null = null;
  private output: GainNode | null = null;
  private buffers = new Map<string, Promise<AudioBuffer | null>>();
  private settings: SoundSettings = DEFAULT_SOUND_SETTINGS;

  /** @param baseUrl Ordner mit den Dateien, z. B. „/klaenge/“. */
  constructor(private readonly baseUrl: string) {}

  /** Browser erlauben Ton erst nach einer Berührung oder einem Tastendruck. */
  unlock(): void {
    const context = this.ensureContext();
    if (context && context.state !== 'running') void context.resume().catch(() => {});
  }

  /** Der gemeinsame AudioContext, auch für die Musik. */
  audioContext(): AudioContext | null {
    return this.ensureContext();
  }

  setSettings(settings: SoundSettings): void {
    this.settings = settings;
    if (this.output) this.output.gain.value = this.volume();
  }

  /** Lädt und dekodiert Klänge vorab, damit der erste nicht verzögert kommt. */
  preload(names: Iterable<SoundName>): void {
    for (const name of names) void this.buffer(soundCatalog[name].file);
  }

  /**
   * @param volume Anteil an der eingestellten Lautstärke, z. B. leiser für Züge der Gegner.
   * @param delay Verzögerung in Sekunden, um mehrere Klänge nacheinander zu spielen.
   */
  play(name: SoundName, { volume = 1, delay = 0 }: { volume?: number; delay?: number } = {}): void {
    if (this.volume() === 0) return;
    const context = this.ensureContext();
    // Vor der ersten Berührung nichts aufstauen, sonst kommt später alles auf einmal.
    if (!context || context.state !== 'running') return;
    const spec = soundCatalog[name];
    void this.buffer(spec.file).then((buffer) => {
      if (!buffer || !this.output) return;
      const source = context.createBufferSource();
      source.buffer = buffer;
      // Etwas Abwechslung, damit zehn Steine hintereinander nicht mechanisch klingen.
      source.playbackRate.value = (spec.rate ?? 1) * (0.97 + Math.random() * 0.06);
      const gain = context.createGain();
      source.connect(gain).connect(this.output);
      const offset = spec.start ?? 0;
      const length = Math.max(FADE_S, (spec.end ?? buffer.duration) - offset);
      const at = context.currentTime + delay;
      const end = at + length / source.playbackRate.value;
      const level = (spec.gain ?? 1) * volume;
      gain.gain.setValueAtTime(level, at);
      gain.gain.setValueAtTime(level, Math.max(at, end - FADE_S));
      gain.gain.linearRampToValueAtTime(0, end);
      source.start(at, offset, length);
      source.stop(end + 0.05);
    });
  }

  private volume(): number {
    return this.settings.muted ? 0 : Math.max(0, Math.min(1, this.settings.effects));
  }

  private ensureContext(): AudioContext | null {
    if (this.context) return this.context;
    if (typeof AudioContext === 'undefined') return null;
    this.context = new AudioContext();
    this.output = this.context.createGain();
    this.output.gain.value = this.volume();
    this.output.connect(this.context.destination);
    return this.context;
  }

  private buffer(file: string): Promise<AudioBuffer | null> {
    let promise = this.buffers.get(file);
    if (!promise) {
      const context = this.ensureContext();
      promise = context
        ? fetch(this.baseUrl + file)
            .then((response) => (response.ok ? response.arrayBuffer() : Promise.reject(new Error(String(response.status)))))
            .then((data) => context.decodeAudioData(data))
            // Fehlt die Datei (z. B. beim Bauen ohne Klang-Repo), bleibt es still.
            .catch(() => null)
        : Promise.resolve(null);
      this.buffers.set(file, promise);
    }
    return promise;
  }
}
