/**
 * Sprachchat in der Web-App (#352): verbindet `RoomConnection` mit `RtcMesh` und `VoiceChat` aus
 * `packages/rtc`. Nur in privaten Räumen; das Mikrofon geht erst nach ausdrücklichem Einschalten an.
 */
import { RtcMesh, VoiceChat, peerWishes, type VoiceState } from '@brett-und-blatt/rtc';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { GAME_SERVER, type RoomConnection, type RoomState } from './online';

const NO_VOICE: VoiceState = { joined: false, muted: false, silenced: [], speaking: [], error: null };
const noSubscribe = () => () => {};
const noState = () => NO_VOICE;

export function useVoice(connection: RoomConnection | null, state: RoomState | null): { voice: VoiceChat | null; voiceState: VoiceState } {
  const [parts, setParts] = useState<{ mesh: RtcMesh; voice: VoiceChat } | null>(null);
  const you = state?.status === 'open' ? state.you : null;

  useEffect(() => {
    if (!connection || !you || !GAME_SERVER) return;
    let voice: VoiceChat | null = null;
    const mesh = new RtcMesh((message) => connection.send(message), you, { onAudio: (from, stream) => voice?.remoteAudio(from, stream) });
    voice = new VoiceChat(mesh, you, (on) => connection.send({ type: 'voice', on }));
    void mesh.loadIceServers(GAME_SERVER);
    const off = connection.onRtc((message) => void mesh.handle(message.from, message.signal));
    setParts({ mesh, voice });
    return () => {
      off();
      voice?.dispose();
      mesh.close();
      setParts(null);
    };
  }, [connection, you]);

  const voiceState = useSyncExternalStore(parts?.voice.subscribe ?? noSubscribe, parts?.voice.getState ?? noState);
  const members = state?.room?.members;
  const voiceOff = state?.room?.voiceOff;

  // Meldung oder öffentlicher Raum: sofort beenden.
  useEffect(() => {
    if (voiceOff && voiceState.joined) parts?.voice.stopByRoom();
  }, [voiceOff, voiceState.joined, parts]);

  // Mit allen verbinden, die mitsprechen – solange man selbst mitspricht.
  useEffect(() => {
    if (!parts || !you) return;
    parts.mesh.setPeers(peerWishes(members ?? [], you, false, voiceState.joined));
  }, [parts, members, you, voiceState.joined]);

  return { voice: parts?.voice ?? null, voiceState };
}
