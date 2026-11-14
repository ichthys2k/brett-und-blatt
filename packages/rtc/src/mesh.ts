/**
 * Direkte Verbindungen zwischen Geräten im selben Raum (WebRTC, #351, #352). Der Spieleserver
 * vermittelt nur (`rtc`-Nachrichten); Stimme und Kopf-/Handpositionen laufen von Gerät zu Gerät.
 *
 * Je Paar gibt es genau eine Verbindung. Darin:
 * - ein Datenkanal „pose“ (ausgehandelt, Kennung 0), wenn beide Seiten Brillen sind;
 * - eine Tonspur, wenn beide Seiten beim Sprachchat mitmachen.
 * Neu verhandelt wird nach dem Muster „perfect negotiation“: Die Seite mit der größeren
 * Mitglieds-Kennung ist „höflich“ und gibt bei gleichzeitigen Angeboten nach.
 */
import type { ClientMessage, RtcSignal } from '@brett-und-blatt/online';

export interface PeerWish {
  id: string;
  /** Datenkanal für Kopf und Hände (beide Seiten Brille). */
  data: boolean;
  /** Tonspur (beide Seiten im Sprachchat). */
  audio: boolean;
}

export interface RtcMeshEvents {
  /** Text auf dem Datenkanal einer anderen Brille. */
  onData?(from: string, text: string): void;
  /** Ton eines anderen Geräts kommt an (oder ist weg: null). */
  onAudio?(from: string, stream: MediaStream | null): void;
}

interface Peer {
  pc: RTCPeerConnection;
  polite: boolean;
  makingOffer: boolean;
  ignoreOffer: boolean;
  channel: RTCDataChannel | null;
  audioSender: RTCRtpSender | null;
  wish: PeerWish;
  started: number;
  pending: RTCIceCandidateInit[];
}

export const DEFAULT_ICE_SERVERS: RTCIceServer[] = [{ urls: 'stun:stun.cloudflare.com:3478' }];

export class RtcMesh {
  private peers = new Map<string, Peer>();
  private iceServers: RTCIceServer[] = DEFAULT_ICE_SERVERS;
  private localTrack: MediaStreamTrack | null = null;
  private localStream: MediaStream | null = null;

  constructor(
    private readonly send: (message: ClientMessage) => void,
    private readonly you: string,
    private readonly events: RtcMeshEvents = {},
  ) {}

  /** ICE-Server vom Spieleserver (STUN, mit eingerichtetem Schlüssel auch TURN). */
  async loadIceServers(server: string): Promise<void> {
    try {
      const response = await fetch(`${server}/rtc/ice`);
      const data = (await response.json()) as { iceServers?: RTCIceServer[] };
      if (Array.isArray(data.iceServers) && data.iceServers.length) this.iceServers = data.iceServers;
    } catch {
      // STUN reicht für die meisten Netze.
    }
  }

  /** Abgleich: mit wem es eine Verbindung geben soll und wofür. */
  setPeers(wishes: PeerWish[]): void {
    const wanted = new Map(wishes.filter((w) => w.id !== this.you && (w.data || w.audio)).map((w) => [w.id, w]));
    for (const [id, peer] of this.peers) {
      const wish = wanted.get(id);
      if (!wish || (wish.data && !peer.wish.data)) {
        // Weg oder neu als Brille: Verbindung neu aufbauen (der Datenkanal entsteht nur beim Aufbau).
        this.drop(id, Boolean(wish));
      }
    }
    for (const [id, wish] of wanted) {
      const peer = this.peers.get(id);
      if (!peer) this.create(id, wish);
      else {
        peer.wish = wish;
        this.syncAudio(id, peer);
      }
    }
  }

  private create(id: string, wish: PeerWish): Peer {
    const pc = new RTCPeerConnection({ iceServers: this.iceServers });
    const peer: Peer = { pc, polite: this.you > id, makingOffer: false, ignoreOffer: false, channel: null, audioSender: null, wish, started: Date.now(), pending: [] };
    this.peers.set(id, peer);
    pc.onicecandidate = (event) => {
      if (event.candidate) this.send({ type: 'rtc', to: id, signal: { kind: 'ice', candidate: event.candidate.candidate, sdpMid: event.candidate.sdpMid, sdpMLineIndex: event.candidate.sdpMLineIndex } });
    };
    pc.onnegotiationneeded = async () => {
      try {
        peer.makingOffer = true;
        await pc.setLocalDescription();
        const description = pc.localDescription;
        if (description) this.send({ type: 'rtc', to: id, signal: { kind: description.type === 'answer' ? 'answer' : 'offer', sdp: description.sdp } });
      } catch {
        // Nächster Abgleich versucht es erneut.
      } finally {
        peer.makingOffer = false;
      }
    };
    pc.ontrack = (event) => {
      const stream = event.streams[0] ?? new MediaStream([event.track]);
      this.events.onAudio?.(id, stream);
      event.track.onended = () => this.events.onAudio?.(id, null);
    };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed') this.drop(id, true);
    };
    if (wish.data) {
      // Beide Seiten legen denselben ausgehandelten Kanal an – kein Wettlauf, wer ihn öffnet.
      const channel = pc.createDataChannel('pose', { negotiated: true, id: 0, ordered: false, maxRetransmits: 0 });
      channel.onmessage = (event) => this.events.onData?.(id, String(event.data));
      peer.channel = channel;
    }
    this.syncAudio(id, peer);
    return peer;
  }

  /** Eigene Tonspur zur Verbindung hinzufügen oder entfernen, je nach Wunsch und Mikrofon. */
  private syncAudio(id: string, peer: Peer): void {
    const want = peer.wish.audio && this.localTrack !== null;
    if (want && !peer.audioSender) {
      peer.audioSender = peer.pc.addTrack(this.localTrack!, this.localStream!);
    } else if (want && peer.audioSender && peer.audioSender.track !== this.localTrack) {
      void peer.audioSender.replaceTrack(this.localTrack);
    } else if (!want && peer.audioSender) {
      try {
        peer.pc.removeTrack(peer.audioSender);
      } catch {
        // Verbindung schon zu.
      }
      peer.audioSender = null;
      if (!peer.wish.audio) this.events.onAudio?.(id, null);
    }
  }

  /** Mikrofon an (Spur) oder aus (null) – gilt für alle Verbindungen mit Sprachwunsch. */
  setMicrophone(stream: MediaStream | null): void {
    this.localStream = stream;
    this.localTrack = stream?.getAudioTracks()[0] ?? null;
    for (const [id, peer] of this.peers) this.syncAudio(id, peer);
  }

  private drop(id: string, rebuild: boolean): void {
    const peer = this.peers.get(id);
    if (!peer) return;
    peer.pc.close();
    this.peers.delete(id);
    this.events.onAudio?.(id, null);
    if (rebuild) this.create(id, peer.wish);
  }

  /** Vermittlungsdaten eines anderen Geräts. */
  async handle(from: string, signal: RtcSignal): Promise<void> {
    if (signal.kind === 'bye') {
      this.peers.get(from)?.pc.close();
      this.peers.delete(from);
      this.events.onAudio?.(from, null);
      return;
    }
    // Die Gegenseite kennt uns schon; wir sie noch nicht (Raumnachricht unterwegs): erst einmal annehmen.
    const peer = this.peers.get(from) ?? this.create(from, { id: from, data: false, audio: false });
    const pc = peer.pc;
    try {
      if (signal.kind === 'offer' || signal.kind === 'answer') {
        const collision = signal.kind === 'offer' && (peer.makingOffer || pc.signalingState !== 'stable');
        peer.ignoreOffer = !peer.polite && collision;
        if (peer.ignoreOffer) return;
        await pc.setRemoteDescription({ type: signal.kind, sdp: signal.sdp });
        for (const candidate of peer.pending.splice(0)) await pc.addIceCandidate(candidate).catch(() => {});
        if (signal.kind === 'offer') {
          await pc.setLocalDescription();
          const answer = pc.localDescription;
          if (answer) this.send({ type: 'rtc', to: from, signal: { kind: 'answer', sdp: answer.sdp } });
        }
        return;
      }
      if (signal.kind !== 'ice') return;
      const candidate = { candidate: signal.candidate, sdpMid: signal.sdpMid ?? null, sdpMLineIndex: signal.sdpMLineIndex ?? null };
      if (!pc.remoteDescription) peer.pending.push(candidate);
      else await pc.addIceCandidate(candidate).catch(() => {});
    } catch {
      // Ein verpatzter Schritt: Beim nächsten Abgleich wird neu verhandelt.
    }
  }

  isOpen(id: string): boolean {
    return this.peers.get(id)?.channel?.readyState === 'open';
  }

  /** Wie lange schon versucht wird, ohne dass der Datenkanal offen ist (für den Rückfall). */
  waitingSince(id: string): number | null {
    const peer = this.peers.get(id);
    if (!peer || !peer.wish.data || this.isOpen(id)) return null;
    return peer.started;
  }

  /** Text an alle offenen Datenkanäle. */
  broadcast(text: string): void {
    for (const peer of this.peers.values()) if (peer.channel?.readyState === 'open') peer.channel.send(text);
  }

  status(): Record<string, string> {
    return Object.fromEntries([...this.peers].map(([id, p]) => [id, `${p.pc.connectionState}${p.channel?.readyState === 'open' ? '+daten' : ''}${p.audioSender ? '+ton' : ''}`]));
  }

  close(): void {
    for (const [id, peer] of this.peers) {
      this.send({ type: 'rtc', to: id, signal: { kind: 'bye' } });
      peer.pc.close();
    }
    this.peers.clear();
  }
}
