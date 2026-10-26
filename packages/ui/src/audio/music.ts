import catalog from './music.json';

/*
 * Hintergrundmusik: Playlists je Spielfamilie, erstellt mit Suno. Die Dateien liegen
 * wie die Effekte im Klang-Repo (Ordner „musik/“) und werden erst beim Abspielen
 * geladen – immer nur das laufende und das nächste Stück.
 */

export interface MusicTrack {
  id: string;
  title: string;
  file: string;
  playlist: string;
}

export interface Playlist {
  id: string;
  title: string;
  /** Stimmung in wenigen Worten, z. B. „ruhig und konzentriert“. */
  mood: string;
  /** Spiele, die diese Playlist von sich aus spielen. */
  games: string[];
}

export const playlists: Playlist[] = catalog.playlists;
export const musicTracks: MusicTrack[] = catalog.tracks;

/** Ohne eigene Zuordnung spielt ein neues Spiel den Spielabend. */
const FALLBACK_PLAYLIST = 'spielabend';

export function defaultPlaylist(gameId: string): string {
  return playlists.find((list) => list.games.includes(gameId))?.id ?? FALLBACK_PLAYLIST;
}

/** Die Stücke einer Playlist – ist sie noch leer, alle Stücke, damit trotzdem Musik läuft. */
export function playlistTracks(playlistId: string): MusicTrack[] {
  const own = musicTracks.filter((track) => track.playlist === playlistId);
  return own.length > 0 ? own : musicTracks;
}

export interface MusicPrefs {
  /** Mit Stern markierte Stücke laufen doppelt so oft. */
  starred: string[];
  /** Ausgeschlossene Stücke laufen nie. */
  excluded: string[];
  /** Nur Stücke mit Stern – solange es in der Auswahl welche gibt. */
  onlyStars: boolean;
}

export const DEFAULT_MUSIC_PREFS: MusicPrefs = { starred: [], excluded: [], onlyStars: false };

/** Was aus einer Auswahl laufen darf. */
export function playableTracks(tracks: MusicTrack[], prefs: MusicPrefs): MusicTrack[] {
  const allowed = tracks.filter((track) => !prefs.excluded.includes(track.id));
  if (!prefs.onlyStars) return allowed;
  const starred = allowed.filter((track) => prefs.starred.includes(track.id));
  return starred.length > 0 ? starred : allowed;
}

/** Zufälliges nächstes Stück: keine direkte Wiederholung, Sterne doppelt gewichtet. */
export function pickTrack(candidates: MusicTrack[], prefs: MusicPrefs, avoid: string[], random: () => number = Math.random): MusicTrack | null {
  const fresh = candidates.filter((track) => !avoid.includes(track.id));
  const pool = fresh.length > 0 ? fresh : candidates;
  const weights = pool.map((track) => (prefs.starred.includes(track.id) ? 2 : 1));
  let roll = random() * weights.reduce((sum, weight) => sum + weight, 0);
  for (const [i, track] of pool.entries()) {
    roll -= weights[i] as number;
    if (roll < 0) return track;
  }
  return pool.at(-1) ?? null;
}

const CROSSFADE_S = 2;

interface Deck {
  element: HTMLAudioElement;
  gain: GainNode;
  track: MusicTrack | null;
  /** Das Ende ist eingeleitet – das nächste Stück blendet schon ein. */
  ending: boolean;
  /** Einmal in einer Berührung abgespielt; erst dann darf iOS ohne Berührung abspielen. */
  unlocked: boolean;
}

/**
 * Spielt Musik mit Überblenden über zwei Abspieler, die abwechselnd laufen. Der Ton geht
 * durch Web Audio (sonst ließe sich die Lautstärke auf iPhones nicht einstellen); die
 * Dateien werden ganz geladen und als Blob abgespielt, so landen sie im Offline-Speicher.
 */
export class MusicPlayer {
  private decks: Deck[] = [];
  private active = 0;
  private master: GainNode | null = null;
  private volume = 0;
  private hidden = false;
  private selection: { tracks: MusicTrack[]; prefs: MusicPrefs } | null = null;
  /** Zuletzt gespielte Stücke, damit sich nichts direkt wiederholt. */
  private recent: string[] = [];
  private failed = new Set<string>();
  private loads = new Map<string, Promise<string | null>>();
  private upcoming: MusicTrack | null = null;
  /** Jeder Wechsel bekommt eine Nummer; ein überholter Ladevorgang verwirft sein Ergebnis. */
  private token = 0;
  private listeners = new Set<() => void>();

  /**
   * @param baseUrl Ordner mit den Stücken, z. B. „/klaenge/musik/“.
   * @param getContext Der gemeinsame AudioContext der Effekte.
   */
  constructor(
    private readonly baseUrl: string,
    private readonly getContext: () => AudioContext | null,
  ) {}

  /** Das laufende Stück oder null. */
  get current(): MusicTrack | null {
    return this.decks[this.active]?.track ?? null;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Aus einer Berührung aufrufen: schaltet die Abspieler frei (iOS) und startet ausstehende Musik. */
  unlock(): void {
    if (!this.ensureGraph()) return;
    for (const deck of this.decks) {
      if (deck.unlocked || deck.track) continue;
      deck.element.src = SILENCE;
      deck.element
        .play()
        .then(() => {
          deck.unlocked = true;
          if (!deck.track) deck.element.pause();
        })
        .catch(() => {});
    }
    this.kick();
  }

  /** 0 hält die Musik an, ohne die Auswahl zu vergessen. */
  setVolume(volume: number): void {
    const was = this.volume;
    this.volume = Math.max(0, Math.min(1, volume));
    if (this.master) this.master.gain.value = this.volume;
    if (this.volume === 0 && was > 0) this.halt();
    else if (this.volume > 0 && was === 0) this.kick();
  }

  /** Wenn die Seite verborgen ist (Handy gesperrt, anderer Tab), pausiert die Musik. */
  setHidden(hidden: boolean): void {
    this.hidden = hidden;
    if (hidden) for (const deck of this.decks) deck.element.pause();
    else this.kick();
  }

  /** Musik aus dieser Auswahl. Passt das laufende Stück noch, läuft es weiter. */
  play(tracks: MusicTrack[], prefs: MusicPrefs): void {
    this.selection = { tracks, prefs };
    const candidates = this.candidates();
    if (this.upcoming && !candidates.some((track) => track.id === this.upcoming?.id)) this.upcoming = null;
    const current = this.current;
    if (current && !candidates.some((track) => track.id === current.id)) void this.advance();
    else this.kick();
  }

  /** Sofort zum nächsten Stück (oder zu einem bestimmten) überblenden. */
  next(track?: MusicTrack): void {
    if (!this.selection) return;
    void this.advance(track);
  }

  /** Blendet aus und vergisst die Auswahl, z. B. beim Verlassen einer Partie. */
  stop(): void {
    this.selection = null;
    this.upcoming = null;
    this.halt();
  }

  private candidates(): MusicTrack[] {
    if (!this.selection) return [];
    return playableTracks(this.selection.tracks, this.selection.prefs).filter((track) => !this.failed.has(track.file));
  }

  private canPlay(): boolean {
    return this.selection !== null && this.volume > 0 && !this.hidden && this.getContext()?.state === 'running';
  }

  /** Startet oder setzt fort, sobald alles bereit ist. */
  private kick(): void {
    if (!this.canPlay() || !this.ensureGraph()) return;
    const deck = this.decks[this.active] as Deck;
    if (deck.track) void deck.element.play().catch(() => {});
    else void this.advance();
  }

  private async advance(chosen?: MusicTrack): Promise<void> {
    if (!this.selection || !this.ensureGraph()) return;
    const token = ++this.token;
    const track = chosen ?? this.choose();
    if (!track) return this.halt();
    const url = await this.load(track);
    if (token !== this.token || !this.canPlay()) return;
    if (!url) {
      // Fehlt die Datei (z. B. ohne Klang-Repo gebaut), das nächste versuchen – bis keins mehr übrig ist.
      this.failed.add(track.file);
      return this.advance();
    }
    const context = this.getContext() as AudioContext;
    const from = this.decks[this.active] as Deck;
    const toIndex = 1 - this.active;
    const to = this.decks[toIndex] as Deck;
    if (from.track) this.fadeOut(from, CROSSFADE_S);
    to.track = track;
    to.ending = false;
    to.element.src = url;
    to.element.currentTime = 0;
    const now = context.currentTime;
    to.gain.gain.cancelScheduledValues(now);
    to.gain.gain.setValueAtTime(0, now);
    to.gain.gain.linearRampToValueAtTime(1, now + (from.track ? CROSSFADE_S : 0.5));
    this.active = toIndex;
    this.recent = [track.id, ...this.recent.filter((id) => id !== track.id)].slice(0, 2);
    this.upcoming = null;
    this.emit();
    try {
      await to.element.play();
      to.unlocked = true;
    } catch {
      // Ohne Berührung verweigert – unlock() startet es später.
    }
    this.prepareNext();
    this.release();
  }

  /** Das nächste Stück: das schon vorbereitete, wenn es noch passt. */
  private choose(): MusicTrack | null {
    const candidates = this.candidates();
    if (this.upcoming && candidates.some((track) => track.id === this.upcoming?.id)) return this.upcoming;
    return pickTrack(candidates, this.selection?.prefs ?? DEFAULT_MUSIC_PREFS, this.recent.slice(0, candidates.length > 2 ? 2 : 1));
  }

  /** Lädt das nächste Stück schon während des laufenden, damit das Überblenden pünktlich klappt. */
  private prepareNext(): void {
    const candidates = this.candidates().filter((track) => track.id !== this.current?.id);
    this.upcoming = pickTrack(candidates, this.selection?.prefs ?? DEFAULT_MUSIC_PREFS, this.recent);
    if (this.upcoming) void this.load(this.upcoming);
  }

  private load(track: MusicTrack): Promise<string | null> {
    let promise = this.loads.get(track.file);
    if (!promise) {
      promise = fetch(this.baseUrl + track.file)
        .then((response) => (response.ok ? response.blob() : Promise.reject(new Error(String(response.status)))))
        .then((blob) => URL.createObjectURL(blob))
        .catch(() => null);
      this.loads.set(track.file, promise);
    }
    return promise;
  }

  /** Gibt geladene Stücke frei, die weder laufen noch als Nächstes dran sind. */
  private release(): void {
    const keep = new Set([...this.decks.map((deck) => deck.track?.file), this.upcoming?.file]);
    for (const [file, promise] of this.loads) {
      if (keep.has(file)) continue;
      this.loads.delete(file);
      void promise.then((url) => url && URL.revokeObjectURL(url));
    }
  }

  private halt(): void {
    this.token++;
    for (const deck of this.decks) if (deck.track) this.fadeOut(deck, 0.8);
    this.emit();
  }

  private fadeOut(deck: Deck, seconds: number): void {
    const context = this.getContext();
    const track = deck.track;
    deck.track = null;
    deck.ending = false;
    if (!context || !track) return;
    const now = context.currentTime;
    deck.gain.gain.cancelScheduledValues(now);
    deck.gain.gain.setValueAtTime(deck.gain.gain.value, now);
    deck.gain.gain.linearRampToValueAtTime(0, now + seconds);
    window.setTimeout(() => {
      if (deck.track) return;
      deck.element.pause();
      this.release();
    }, seconds * 1000 + 100);
  }

  private ensureGraph(): boolean {
    if (this.master) return true;
    const context = this.getContext();
    if (!context || typeof Audio === 'undefined') return false;
    this.master = context.createGain();
    this.master.gain.value = this.volume;
    this.master.connect(context.destination);
    for (let i = 0; i < 2; i++) {
      const element = new Audio();
      element.preload = 'auto';
      const gain = context.createGain();
      gain.gain.value = 0;
      context.createMediaElementSource(element).connect(gain).connect(this.master);
      const deck: Deck = { element, gain, track: null, ending: false, unlocked: false };
      const isActive = () => this.decks[this.active] === deck && deck.track !== null;
      element.addEventListener('timeupdate', () => {
        if (!isActive() || deck.ending || !Number.isFinite(element.duration)) return;
        if (element.duration - element.currentTime > CROSSFADE_S) return;
        deck.ending = true;
        void this.advance();
      });
      element.addEventListener('ended', () => {
        if (isActive() && !deck.ending) void this.advance();
      });
      element.addEventListener('error', () => {
        if (!isActive() || !deck.track) return;
        this.failed.add(deck.track.file);
        void this.advance();
      });
      this.decks.push(deck);
    }
    context.addEventListener('statechange', () => this.kick());
    return true;
  }

  private emit(): void {
    for (const listener of this.listeners) listener();
  }
}

/** Eine Zehntelsekunde Stille als WAV – zum Freischalten der Abspieler auf iOS. */
const SILENCE = (() => {
  const samples = 800;
  const bytes = new Uint8Array(44 + samples * 2);
  const view = new DataView(bytes.buffer);
  const text = (offset: number, value: string) => [...value].forEach((char, i) => view.setUint8(offset + i, char.charCodeAt(0)));
  text(0, 'RIFF');
  view.setUint32(4, 36 + samples * 2, true);
  text(8, 'WAVEfmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, 8000, true);
  view.setUint32(28, 16000, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  text(36, 'data');
  view.setUint32(40, samples * 2, true);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return `data:audio/wav;base64,${btoa(binary)}`;
})();
