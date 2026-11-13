/**
 * VR-Treffpunkt (#351): Kopf und Hände laufen direkt zwischen den Brillen über einen
 * WebRTC-Datenkanal. Der Raum vermittelt nur den Verbindungsaufbau (`rtc`). Klappt keine direkte
 * Verbindung, schickt die App höchstens einmal je Sekunde nur den Kopf über den Raum (`pose`).
 */
import type { ClientMessage, RtcSignal } from '@brett-und-blatt/online';

/** [x, y, z, qx, qy, qz, qw] im eigenen Tischsystem (eigener Platz vorn). */
export type Pose7 = number[];

export interface RemotePose {
  head: Pose7;
  left: Pose7 | null;
  right: Pose7 | null;
  /** Ortszeit des Eingangs. */
  at: number;
  /** Kam über den Raum (Rückfall, nur Kopf). */
  viaRoom: boolean;
}

interface Peer {
  pc: RTCPeerConnection;
  channel: RTCDataChannel | null;
  started: number;
  initiator: boolean;
  /** ICE-Kandidaten, die vor der Gegenbeschreibung ankamen. */
  pending: RTCIceCandidateInit[];
}

/** Nach so langer Zeit ohne offenen Kanal gilt der Rückfall über den Raum. */
const FALLBACK_AFTER_MS = 10_000;

export class PeerMesh {
  private peers = new Map<string, Peer>();
  readonly poses = new Map<string, RemotePose>();
  private iceServers: RTCIceServer[] = [{ urls: 'stun:stun.cloudflare.com:3478' }];

  constructor(
    private readonly send: (message: ClientMessage) => void,
    private readonly you: string,
  ) {}

  /** ICE-Server vom Spieleserver holen (STUN, mit eingerichtetem Schlüssel auch TURN). */
  async loadIceServers(server: string): Promise<void> {
    try {
      const response = await fetch(`${server}/rtc/ice`);
      const data = (await response.json()) as { iceServers?: RTCIceServer[] };
      if (Array.isArray(data.iceServers) && data.iceServers.length) this.iceServers = data.iceServers;
    } catch {
      // STUN reicht für die meisten Netze.
    }
  }

  /** Abgleich mit den Brillen im Raum: neue verbinden, gegangene schließen. */
  update(xrMembers: string[]): void {
    const wanted = new Set(xrMembers.filter((id) => id !== this.you));
    for (const [id, peer] of this.peers) {
      if (!wanted.has(id)) {
        peer.pc.close();
        this.peers.delete(id);
        this.poses.delete(id);
      }
    }
    for (const id of wanted) {
      if (this.peers.has(id)) continue;
      // Immer die kleinere Kennung macht das Angebot, damit sich beide nicht gleichzeitig anrufen.
      if (this.you < id) void this.call(id);
    }
  }

  private create(id: string, initiator: boolean): Peer {
    const pc = new RTCPeerConnection({ iceServers: this.iceServers });
    const peer: Peer = { pc, channel: null, started: Date.now(), initiator, pending: [] };
    pc.onicecandidate = (event) => {
      if (event.candidate) this.send({ type: 'rtc', to: id, signal: { kind: 'ice', candidate: event.candidate.candidate, sdpMid: event.candidate.sdpMid, sdpMLineIndex: event.candidate.sdpMLineIndex } });
    };
    pc.ondatachannel = (event) => this.attach(id, peer, event.channel);
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
        // Neuer Versuch beim nächsten Abgleich.
        if (this.peers.get(id) === peer) this.peers.delete(id);
      }
    };
    this.peers.set(id, peer);
    return peer;
  }

  private attach(id: string, peer: Peer, channel: RTCDataChannel): void {
    peer.channel = channel;
    channel.onmessage = (event) => {
      try {
        const data = JSON.parse(String(event.data)) as { h?: Pose7; l?: Pose7 | null; r?: Pose7 | null };
        if (Array.isArray(data.h) && data.h.length === 7) this.poses.set(id, { head: data.h, left: data.l ?? null, right: data.r ?? null, at: Date.now(), viaRoom: false });
      } catch {
        // kaputtes Paket überspringen
      }
    };
  }

  private async call(id: string): Promise<void> {
    const peer = this.create(id, true);
    // Unzuverlässig und ungeordnet: Ein verspätetes Paket ist ohnehin veraltet.
    this.attach(id, peer, peer.pc.createDataChannel('pose', { ordered: false, maxRetransmits: 0 }));
    const offer = await peer.pc.createOffer();
    await peer.pc.setLocalDescription(offer);
    this.send({ type: 'rtc', to: id, signal: { kind: 'offer', sdp: offer.sdp ?? '' } });
  }

  /** Vermittlungsdaten einer anderen Brille. */
  async handle(from: string, signal: RtcSignal): Promise<void> {
    if (signal.kind === 'bye') {
      this.peers.get(from)?.pc.close();
      this.peers.delete(from);
      return;
    }
    if (signal.kind === 'offer') {
      this.peers.get(from)?.pc.close();
      const peer = this.create(from, false);
      await peer.pc.setRemoteDescription({ type: 'offer', sdp: signal.sdp });
      await this.flush(peer);
      const answer = await peer.pc.createAnswer();
      await peer.pc.setLocalDescription(answer);
      this.send({ type: 'rtc', to: from, signal: { kind: 'answer', sdp: answer.sdp ?? '' } });
      return;
    }
    const peer = this.peers.get(from);
    if (!peer) return;
    if (signal.kind === 'answer') {
      await peer.pc.setRemoteDescription({ type: 'answer', sdp: signal.sdp });
      await this.flush(peer);
      return;
    }
    if (signal.kind !== 'ice') return;
    const candidate = { candidate: signal.candidate, sdpMid: signal.sdpMid ?? null, sdpMLineIndex: signal.sdpMLineIndex ?? null };
    if (!peer.pc.remoteDescription) peer.pending.push(candidate);
    else await peer.pc.addIceCandidate(candidate).catch(() => {});
  }

  private async flush(peer: Peer): Promise<void> {
    for (const candidate of peer.pending.splice(0)) await peer.pc.addIceCandidate(candidate).catch(() => {});
  }

  /** Kopf über den Raum (Rückfall) – gilt nur, solange zu dieser Brille kein Kanal offen ist. */
  roomPose(from: string, head: Pose7): void {
    if (this.isOpen(from)) return;
    this.poses.set(from, { head, left: null, right: null, at: Date.now(), viaRoom: true });
  }

  isOpen(id: string): boolean {
    return this.peers.get(id)?.channel?.readyState === 'open';
  }

  /** Gibt es eine Brille, zu der seit einer Weile kein Kanal aufgeht? Dann schickt man den Kopf auch über den Raum. */
  needsFallback(xrMembers: string[]): boolean {
    const now = Date.now();
    return xrMembers.some((id) => id !== this.you && !this.isOpen(id) && now - (this.peers.get(id)?.started ?? 0) > FALLBACK_AFTER_MS);
  }

  /** Eigene Pose an alle offenen Kanäle. */
  broadcast(head: Pose7, left: Pose7 | null, right: Pose7 | null): void {
    const text = JSON.stringify({ h: head, l: left, r: right });
    for (const peer of this.peers.values()) if (peer.channel?.readyState === 'open') peer.channel.send(text);
  }

  /** Zustand für Tests und Anzeige. */
  status(): Record<string, string> {
    return Object.fromEntries([...this.peers].map(([id, p]) => [id, p.channel?.readyState === 'open' ? 'direkt' : p.pc.connectionState]));
  }

  close(): void {
    for (const [id, peer] of this.peers) {
      this.send({ type: 'rtc', to: id, signal: { kind: 'bye' } });
      peer.pc.close();
    }
    this.peers.clear();
    this.poses.clear();
  }
}
