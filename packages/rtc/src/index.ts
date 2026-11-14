export { DEFAULT_ICE_SERVERS, RtcMesh, type PeerWish, type RtcMeshEvents } from './mesh';
export { VoiceChat, type VoiceState } from './voice';

import type { MemberInfo } from '@brett-und-blatt/online';
import type { PeerWish } from './mesh';

/**
 * Mit wem man sich verbindet: Datenkanal, wenn beide Brillen sind (#351); Ton, wenn beide beim
 * Sprachchat mitmachen (#352).
 */
export function peerWishes(members: readonly MemberInfo[], you: string, selfXr: boolean, selfVoice: boolean): PeerWish[] {
  return members
    .filter((m) => m.id !== you && m.connected)
    .map((m) => ({ id: m.id, data: selfXr && Boolean(m.xr), audio: selfVoice && Boolean(m.voice) }))
    .filter((w) => w.data || w.audio);
}
