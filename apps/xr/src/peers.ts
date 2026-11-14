/**
 * VR-Treffpunkt (#351) und Sprachchat (#352) in der VR-App: dünne Hülle um `RtcMesh` aus
 * `packages/rtc`. Kopf und Hände laufen über den Datenkanal; klappt keine direkte Verbindung,
 * schickt die App höchstens einmal je Sekunde nur den Kopf über den Raum (`pose`).
 */
import type { ClientMessage, MemberInfo, RtcSignal } from '@brett-und-blatt/online';
import { RtcMesh, peerWishes } from '@brett-und-blatt/rtc';

/** [x, y, z, qx, qy, qz, qw] im eigenen Tischsystem (eigener Platz vorn). */
import { decodePacket, encodePacket, type Held, type Pose7 as Pose } from './presence';
export type Pose7 = Pose;

export interface RemotePose {
  head: Pose7;
  left: Pose7 | null;
  right: Pose7 | null;
  /** Ortszeit des Eingangs. */
  at: number;
  /** Kam über den Raum (Rückfall, nur Kopf). */
  viaRoom: boolean;
  /** Gegriffenes Objekt (#385): Ort im Tischsystem des Senders und Art, nie ein Kartenwert. */
  held?: Held | null;
  pointLeft?: boolean;
  pointRight?: boolean;
  fingerLeft?: number[] | null;
  fingerRight?: number[] | null;
}

/** Nach so langer Zeit ohne offenen Kanal gilt der Rückfall über den Raum. */
const FALLBACK_AFTER_MS = 10_000;

export class PeerMesh {
  readonly rtc: RtcMesh;
  readonly poses = new Map<string, RemotePose>();
  private xrPeers: string[] = [];

  constructor(
    send: (message: ClientMessage) => void,
    private readonly you: string,
    onAudio: (from: string, stream: MediaStream | null) => void,
  ) {
    this.rtc = new RtcMesh(send, you, {
      onAudio,
      onData: (from, text) => {
        // Kaputte Pakete werden übersprungen.
        const packet = decodePacket(text);
        if (packet) this.poses.set(from, { ...packet, at: Date.now(), viaRoom: false });
      },
    });
  }

  loadIceServers(server: string): Promise<void> {
    return this.rtc.loadIceServers(server);
  }

  /** Abgleich mit dem Raum: Brillen bekommen den Datenkanal, Sprechende den Ton. */
  update(members: readonly MemberInfo[], selfVoice: boolean): void {
    this.xrPeers = members.filter((m) => m.id !== this.you && m.xr && m.connected).map((m) => m.id);
    for (const id of [...this.poses.keys()]) if (!this.xrPeers.includes(id)) this.poses.delete(id);
    this.rtc.setPeers(peerWishes(members, this.you, true, selfVoice));
  }

  handle(from: string, signal: RtcSignal): Promise<void> {
    return this.rtc.handle(from, signal);
  }

  /** Kopf über den Raum (Rückfall) – gilt nur, solange zu dieser Brille kein Kanal offen ist. */
  roomPose(from: string, head: Pose7): void {
    if (this.rtc.isOpen(from)) return;
    this.poses.set(from, { head, left: null, right: null, at: Date.now(), viaRoom: true });
  }

  /** Gibt es eine Brille, zu der seit einer Weile kein Kanal aufgeht? Dann den Kopf auch über den Raum schicken. */
  needsFallback(): boolean {
    const now = Date.now();
    return this.xrPeers.some((id) => {
      const since = this.rtc.waitingSince(id);
      return since !== null && now - since > FALLBACK_AFTER_MS;
    });
  }

  broadcast(head: Pose7, left: Pose7 | null, right: Pose7 | null, held: Held | null = null, point: [boolean, boolean] = [false, false], fingers: { left: number[] | null; right: number[] | null } = { left: null, right: null }): void {
    this.rtc.broadcast(encodePacket({ head, left, right, held, pointLeft: point[0], pointRight: point[1], fingerLeft: fingers.left, fingerRight: fingers.right }));
  }

  status(): Record<string, string> {
    return this.rtc.status();
  }

  close(): void {
    this.rtc.close();
    this.poses.clear();
  }
}
