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
  /** Ob in Online-Partien auch als Mitspieler (nicht Raumleitung) Musik laufen soll. */
  clientMusic?: boolean;
}

export const DEFAULT_SOUND_SETTINGS: SoundSettings = { muted: false, effects: 0.7, music: 0.4, clientMusic: false };

const FADE_S = 0.03;

/** Spielt Klänge über Web Audio ab. Eine Instanz für die ganze App. */
export class SoundPlayer {
  private static sharedContext: AudioContext | null = null;
  private static sharedSettings: SoundSettings = DEFAULT_SOUND_SETTINGS;
  private static instances = new Set<SoundPlayer>();

  private output: GainNode | null = null;
  private buffers = new Map<string, Promise<AudioBuffer | null>>();

  /** @param baseUrl Ordner mit den Dateien, z. B. „/klaenge/“. */
  constructor(private readonly baseUrl: string) {
    SoundPlayer.instances.add(this);
  }

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
    SoundPlayer.sharedSettings = settings;
    for (const inst of SoundPlayer.instances) {
      if (inst.output) inst.output.gain.value = inst.volume();
    }
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

  /**
   * Spielt eine beliebige Audiodatei ab (z. B. Tier-Sounds für das Drachenspiel).
   * @param file Relativer Pfad unter baseUrl, z. B. „tiere/drache/01_Der Drache.mp3“.
   * @param volume Anteil an der eingestellten Lautstärke.
   * @param delay Verzögerung in Sekunden.
   */
  playFile(file: string, { volume = 1, delay = 0, gain = 1, rate = 1 }: { volume?: number; delay?: number; gain?: number; rate?: number } = {}): void {
    if (this.volume() === 0) return;
    const context = this.ensureContext();
    if (!context || context.state !== 'running') return;
    void this.buffer(file).then((buffer) => {
      if (!buffer || !this.output) return;
      const source = context.createBufferSource();
      source.buffer = buffer;
      source.playbackRate.value = rate;
      const gainNode = context.createGain();
      source.connect(gainNode).connect(this.output);
      const length = buffer.duration;
      const at = context.currentTime + delay;
      const end = at + length / source.playbackRate.value;
      const level = gain * volume;
      gainNode.gain.setValueAtTime(level, at);
      gainNode.gain.setValueAtTime(level, Math.max(at, end - FADE_S));
      gainNode.gain.linearRampToValueAtTime(0, end);
      source.start(at, 0, length);
      source.stop(end + 0.05);
    });
  }

  private volume(): number {
    return SoundPlayer.sharedSettings.muted ? 0 : Math.max(0, Math.min(1, SoundPlayer.sharedSettings.effects));
  }

  private ensureContext(): AudioContext | null {
    if (SoundPlayer.sharedContext) {
      if (!this.output) {
        this.output = SoundPlayer.sharedContext.createGain();
        this.output.gain.value = this.volume();
        this.output.connect(SoundPlayer.sharedContext.destination);
      }
      return SoundPlayer.sharedContext;
    }
    if (typeof AudioContext === 'undefined') return null;
    SoundPlayer.sharedContext = new AudioContext();
    this.output = SoundPlayer.sharedContext.createGain();
    this.output.gain.value = this.volume();
    this.output.connect(SoundPlayer.sharedContext.destination);
    return SoundPlayer.sharedContext;
  }

  private buffer(file: string): Promise<AudioBuffer | null> {
    let promise = this.buffers.get(file);
    if (!promise) {
      const context = this.ensureContext();
      const url = encodeURI(`${this.baseUrl}${file}`);
      promise = context
        ? fetch(url)
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
