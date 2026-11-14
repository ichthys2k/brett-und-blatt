/**
 * Sprachchat (#352): Mikrofon, Lautsprecher je Mitspieler, Stummschalten und „wer spricht“.
 * Nur in privaten Räumen; das Mikrofon geht erst nach ausdrücklichem Einschalten an. Die Stimme
 * läuft direkt zwischen den Geräten (RtcMesh); der Server vermittelt nur und speichert nichts.
 */
import type { RtcMesh } from './mesh';

export interface VoiceState {
  /** Eigenes Mikrofon ist eingeschaltet (Sprachchat beigetreten). */
  joined: boolean;
  /** Eigenes Mikrofon stumm (beigetreten, aber nichts senden). */
  muted: boolean;
  /** Mitglieder, die man selbst stumm geschaltet hat. */
  silenced: string[];
  /** Wer gerade spricht (eigene Kennung eingeschlossen). */
  speaking: string[];
  /** Fehler beim Einschalten, z. B. Mikrofon verweigert. */
  error: string | null;
}

/** Pegel (RMS), ab dem jemand als „spricht“ gilt; Rauschunterdrückung hält Stille deutlich darunter. */
const LEVEL_THRESHOLD = 0.01;

export class VoiceChat {
  state: VoiceState = { joined: false, muted: false, silenced: [], speaking: [], error: null };
  private listeners = new Set<() => void>();
  private stream: MediaStream | null = null;
  private outputs = new Map<string, HTMLAudioElement>();
  private analysers = new Map<string, AnalyserNode>();
  private context: AudioContext | null = null;
  /** Räumlicher Ton (#381): je Mitspieler Quelle → Verstärker → Panner; Ort setzt die Oberfläche. */
  private spatialOn = false;
  private spots = new Map<string, [number, number, number]>();
  private nodes = new Map<string, { source: MediaStreamAudioSourceNode; gain: GainNode; panner: PannerNode }>();
  private streams = new Map<string, MediaStream>();
  private timer: number | undefined;

  constructor(
    private readonly mesh: RtcMesh,
    private readonly you: string,
    /** Meldet dem Server, ob man mitspricht (`voice`). */
    private readonly announce: (on: boolean) => void,
  ) {}

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getState = (): VoiceState => this.state;

  private set(change: Partial<VoiceState>): void {
    this.state = { ...this.state, ...change };
    for (const listener of this.listeners) listener();
  }

  /** Mikrofon einschalten und mitsprechen. Fragt den Browser um Erlaubnis. */
  async join(): Promise<void> {
    if (this.state.joined) return;
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
    } catch {
      this.set({ error: 'Das Mikrofon ist nicht freigegeben.' });
      return;
    }
    this.context ??= new AudioContext();
    void this.context.resume();
    this.watch(this.you, this.stream);
    this.mesh.setMicrophone(this.stream);
    this.announce(true);
    this.set({ joined: true, muted: false, error: null });
    this.startLevels();
  }

  /** Aussteigen: Mikrofon aus, niemanden mehr hören. */
  leave(): void {
    if (!this.state.joined) return;
    this.announce(false);
    this.mesh.setMicrophone(null);
    for (const track of this.stream?.getTracks() ?? []) track.stop();
    this.stream = null;
    for (const id of [...this.outputs.keys()]) this.remoteAudio(id, null);
    this.analysers.delete(this.you);
    window.clearInterval(this.timer);
    this.timer = undefined;
    this.set({ joined: false, muted: false, speaking: [] });
  }

  /** Server hat den Sprachchat beendet (Meldung, öffentlicher Raum): alles zu, ohne erneute Meldung. */
  stopByRoom(): void {
    if (!this.state.joined) return;
    this.mesh.setMicrophone(null);
    for (const track of this.stream?.getTracks() ?? []) track.stop();
    this.stream = null;
    for (const id of [...this.outputs.keys()]) this.remoteAudio(id, null);
    window.clearInterval(this.timer);
    this.timer = undefined;
    this.set({ joined: false, muted: false, speaking: [] });
  }

  setMuted(muted: boolean): void {
    for (const track of this.stream?.getAudioTracks() ?? []) track.enabled = !muted;
    this.set({ muted });
  }

  /** Stimmen aus der Richtung des Sprechers (nur in der Brille); schaltet bestehende Verbindungen um. */
  setSpatial(on: boolean): void {
    if (this.spatialOn === on) return;
    this.spatialOn = on;
    for (const [id, stream] of [...this.streams]) this.remoteAudio(id, stream);
  }

  /** Ort einer Stimme im Raum, z. B. Kopf des Sprechers. */
  place(id: string, at: [number, number, number]): void {
    this.spots.set(id, at);
    const panner = this.nodes.get(id)?.panner;
    if (panner) {
      panner.positionX.value = at[0];
      panner.positionY.value = at[1];
      panner.positionZ.value = at[2];
    }
  }

  /** Kopf des Hörers (Position, Blick- und Aufwärtsrichtung). */
  listen(at: [number, number, number], forward: [number, number, number], up: [number, number, number]): void {
    const l = this.context?.listener;
    if (!l?.positionX) return;
    l.positionX.value = at[0];
    l.positionY.value = at[1];
    l.positionZ.value = at[2];
    l.forwardX.value = forward[0];
    l.forwardY.value = forward[1];
    l.forwardZ.value = forward[2];
    l.upX.value = up[0];
    l.upY.value = up[1];
    l.upZ.value = up[2];
  }

  /** Einen Mitspieler für sich selbst stumm schalten (oder wieder hören). */
  silence(id: string, silenced: boolean): void {
    const output = this.outputs.get(id);
    if (output && !this.nodes.has(id)) output.muted = silenced;
    const node = this.nodes.get(id);
    if (node) node.gain.gain.value = silenced ? 0 : 1;
    this.set({ silenced: silenced ? [...new Set([...this.state.silenced, id])] : this.state.silenced.filter((x) => x !== id) });
  }

  /** Ton eines anderen Geräts (aus RtcMesh.onAudio). Nur abspielen, solange man selbst mitspricht. */
  remoteAudio(id: string, stream: MediaStream | null): void {
    const old = this.outputs.get(id);
    if (old) {
      old.srcObject = null;
      this.outputs.delete(id);
      this.analysers.delete(id);
    }
    const oldNode = this.nodes.get(id);
    if (oldNode) {
      oldNode.source.disconnect();
      oldNode.gain.disconnect();
      oldNode.panner.disconnect();
      this.nodes.delete(id);
    }
    if (!stream) this.streams.delete(id);
    if (!stream || !this.state.joined) return;
    this.streams.set(id, stream);
    const output = new Audio();
    output.autoplay = true;
    output.srcObject = stream;
    const silenced = this.state.silenced.includes(id);
    output.muted = silenced;
    // Chrome liefert den Strom an Web Audio nur, solange ein Element ihn abspielt (stumm genügt).
    const spatial = this.spatialOn && this.context !== null;
    if (spatial) output.muted = true;
    void output.play().catch(() => {});
    this.outputs.set(id, output);
    if (spatial && this.context) {
      const source = this.context.createMediaStreamSource(stream);
      const gain = this.context.createGain();
      gain.gain.value = silenced ? 0 : 1;
      const panner = this.context.createPanner();
      panner.panningModel = 'HRTF';
      panner.distanceModel = 'inverse';
      // Sanfte Abschwächung: am Tisch soll niemand zu leise werden.
      panner.refDistance = 1.2;
      panner.rolloffFactor = 0.5;
      const at = this.spots.get(id) ?? [0, 1.2, 0];
      panner.positionX.value = at[0];
      panner.positionY.value = at[1];
      panner.positionZ.value = at[2];
      source.connect(gain).connect(panner).connect(this.context.destination);
      this.nodes.set(id, { source, gain, panner });
    }
    this.watch(id, stream);
  }

  private watch(id: string, stream: MediaStream): void {
    if (!this.context) return;
    try {
      const source = this.context.createMediaStreamSource(stream);
      const analyser = this.context.createAnalyser();
      analyser.fftSize = 512;
      source.connect(analyser);
      this.analysers.set(id, analyser);
    } catch {
      // Ohne Pegel keine Sprech-Anzeige, der Ton läuft trotzdem.
    }
  }

  private startLevels(): void {
    const buffer = new Float32Array(512);
    window.clearInterval(this.timer);
    this.timer = window.setInterval(() => {
      const speaking: string[] = [];
      for (const [id, analyser] of this.analysers) {
        if (id === this.you && this.state.muted) continue;
        analyser.getFloatTimeDomainData(buffer);
        let sum = 0;
        for (const v of buffer) sum += v * v;
        if (Math.sqrt(sum / buffer.length) > LEVEL_THRESHOLD) speaking.push(id);
      }
      if (speaking.join() !== this.state.speaking.join()) this.set({ speaking });
    }, 200);
  }

  dispose(): void {
    this.leave();
    void this.context?.close();
    this.context = null;
  }
}
