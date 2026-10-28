/**
 * Ton der Enten-Rallye wie im Original („Großer Preis“): Jede führende Ente hat ihr eigenes Lied
 * (sanft übergeblendet), dazu ein Ansager für Countdown, Führungswechsel, Fortschritt und Sieg,
 * Quaken bei jeder richtigen Antwort und die Siegesmusik.
 *
 * Alles läuft über einen eigenen AudioContext mit zwei Wegen: Musik und Stimme. Spricht der
 * Ansager, wird die Musik kurz leiser. `dispose()` stoppt alles – beim Verlassen des Spiels.
 * Die Dateien liegen im privaten Klang-Repo (`duck-rally/`) und landen unter `klaenge/duck-rally/`.
 */

const BASE = `${import.meta.env.BASE_URL}klaenge/duck-rally/`;

/** Lautstärken aus den Ton-Einstellungen (0–1). */
export interface RallyVolumes {
  muted: boolean;
  music: number;
  effects: number;
}

/** Stimme etwas über den Effekten, damit sie über der Musik gut zu hören ist. */
const VOICE_BOOST = 1.6;
/** Musik während einer Ansage. */
const DUCKED = 0.35;

export class RallyAudio {
  private ctx: AudioContext | null = null;
  private music: GainNode | null = null;
  private duck: GainNode | null = null;
  private voice: GainNode | null = null;
  private tracks = new Map<string, { el: HTMLAudioElement; gain: GainNode }>();
  private victory: HTMLAudioElement | null = null;
  private playing = new Set<HTMLAudioElement>();
  private speaking = 0;
  private volumes: RallyVolumes = { muted: false, music: 0.4, effects: 0.7 };
  private disposed = false;
  private lastQuack = 0;
  private readonly unlock = () => {
    if (this.ctx?.state === 'suspended') void this.ctx.resume();
  };

  constructor() {
    window.addEventListener('pointerdown', this.unlock, { capture: true, passive: true });
    window.addEventListener('keydown', this.unlock, { capture: true });
  }

  private context(): AudioContext | null {
    if (this.disposed) return null;
    if (this.ctx) return this.ctx;
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return null;
    const ctx = new Ctx();
    this.ctx = ctx;
    this.music = ctx.createGain();
    this.duck = ctx.createGain();
    this.voice = ctx.createGain();
    // Ein Begrenzer am Ende verhindert Übersteuern, wenn Stimme und Musik zusammenkommen.
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -3;
    limiter.ratio.value = 12;
    this.music.connect(this.duck).connect(limiter);
    this.voice.connect(limiter);
    limiter.connect(ctx.destination);
    this.applyVolumes();
    return ctx;
  }

  setVolumes(volumes: RallyVolumes): void {
    this.volumes = volumes;
    this.applyVolumes();
  }

  private applyVolumes(): void {
    if (!this.ctx || !this.music || !this.voice) return;
    const now = this.ctx.currentTime;
    const music = this.volumes.muted ? 0 : this.volumes.music;
    const voice = this.volumes.muted ? 0 : this.volumes.effects * VOICE_BOOST;
    this.music.gain.setTargetAtTime(music, now, 0.05);
    this.voice.gain.setTargetAtTime(voice, now, 0.05);
  }

  private silent(): boolean {
    return this.volumes.muted;
  }

  /** Spielt eine Datei einmal über den Weg der Stimme (Ansage oder Effekt). */
  private oneShot(file: string, announce: boolean): void {
    const ctx = this.context();
    if (!ctx || !this.voice || this.silent()) return;
    if (ctx.state === 'suspended') void ctx.resume();
    const el = new Audio(BASE + file);
    ctx.createMediaElementSource(el).connect(this.voice);
    this.playing.add(el);
    if (announce) this.duckMusic(true);
    el.addEventListener('ended', () => {
      this.playing.delete(el);
      if (announce) this.duckMusic(false);
    });
    void el.play().catch(() => {
      this.playing.delete(el);
      if (announce) this.duckMusic(false);
    });
  }

  private duckMusic(on: boolean): void {
    this.speaking = Math.max(0, this.speaking + (on ? 1 : -1));
    if (!this.ctx || !this.duck) return;
    this.duck.gain.setTargetAtTime(this.speaking > 0 ? DUCKED : 1, this.ctx.currentTime, 0.15);
  }

  announce(file: string | null): void {
    if (file) this.oneShot(file, true);
  }

  quack(): void {
    const now = performance.now();
    if (now - this.lastQuack < 250) return;
    this.lastQuack = now;
    this.oneShot('ente_variante_6.mp3', false);
  }

  /** Lied der führenden Ente; null blendet alle Lieder aus. */
  setLeaderTrack(file: string | null): void {
    const ctx = this.context();
    if (!ctx || !this.music) return;
    if (file && !this.tracks.has(file)) {
      const el = new Audio(BASE + file);
      el.loop = true;
      el.preload = 'auto';
      const gain = ctx.createGain();
      gain.gain.value = 0;
      ctx.createMediaElementSource(el).connect(gain).connect(this.music);
      this.tracks.set(file, { el, gain });
    }
    const now = ctx.currentTime;
    for (const [name, track] of this.tracks) {
      const target = name === file ? 1 : 0;
      track.gain.gain.cancelScheduledValues(now);
      track.gain.gain.setValueAtTime(track.gain.gain.value, now);
      track.gain.gain.linearRampToValueAtTime(target, now + 1);
      if (target > 0 && track.el.paused) void track.el.play().catch(() => {});
    }
  }

  /** Siegesmusik und Siegesansage; die Rennlieder verstummen. */
  victoryLap(announceFile: string): void {
    const ctx = this.context();
    if (!ctx || !this.music) return;
    if (ctx.state === 'suspended') void ctx.resume();
    this.setLeaderTrack(null);
    for (const track of this.tracks.values()) window.setTimeout(() => track.el.pause(), 1100);
    if (!this.victory) {
      const el = new Audio(BASE + 'Victory_Lap.mp3');
      el.loop = true;
      ctx.createMediaElementSource(el).connect(this.music);
      this.victory = el;
    }
    this.victory.currentTime = 0;
    void this.victory.play().catch(() => {});
    window.setTimeout(() => this.announce(announceFile), 400);
  }

  /** Siegesmusik anhalten (neues Rennen). */
  stopVictory(): void {
    this.victory?.pause();
  }

  /**
   * Lädt die Dateien einmal ganz und nacheinander im Hintergrund, damit der Service Worker sie
   * speichert – `<audio>` selbst fragt nur Stücke an, die er nicht speichert. Danach klingt das
   * Spiel auch offline. Bereits gespeicherte Dateien liefert der Service Worker ohne Netz.
   */
  prefetch(files: readonly string[]): void {
    if (typeof navigator === 'undefined' || !navigator.serviceWorker?.controller) return;
    const queue = [...new Set([...files, 'ente_variante_6.mp3', 'Victory_Lap.mp3'])];
    const next = (): void => {
      const file = queue.shift();
      if (!file || this.disposed) return;
      void fetch(BASE + file, { priority: 'low' } as RequestInit)
        .then((response) => response.arrayBuffer())
        .catch(() => {})
        .then(next);
    };
    next();
  }

  /** Alles anhalten und freigeben – beim Verlassen des Spiels. */
  dispose(): void {
    this.disposed = true;
    window.removeEventListener('pointerdown', this.unlock, { capture: true });
    window.removeEventListener('keydown', this.unlock, { capture: true });
    for (const track of this.tracks.values()) track.el.pause();
    this.victory?.pause();
    for (const el of this.playing) el.pause();
    this.tracks.clear();
    this.playing.clear();
    void this.ctx?.close().catch(() => {});
    this.ctx = null;
  }
}
