/**
 * Brett & Blatt VR (#339). Die Seite zeigt immer die Taverne; davor liegt eine schlichte
 * 2D-Leiste für Anmeldung und Lobby, für Bildschirmleser und für den Browser ohne Brille.
 * In der Brille übernimmt das 2D-Fenster über dem Tisch dieselben Aufgaben.
 */
import { AVATARS, parseRoomCode } from '@brett-und-blatt/online';
import { createXRStore } from '@react-three/xr';
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { GAME_CHOICES, LEVEL_TEXT, gameName } from './catalog';
import { createRoom, loadProfile, saveProfile, sendMove, serverUrl, useRoom } from './net';
import { Scene } from './scene/Scene';
import type { VoiceControls } from './scene/Panel';
import { play, soundsFor, unlockAudio } from './sound';
import { PeerMesh } from './peers';
import { VoiceChat, type VoiceState } from '@brett-und-blatt/rtc';

const noSubscribe = () => () => {};
const NO_VOICE: VoiceState = { joined: false, muted: false, silenced: [], speaking: [], error: null };
const noVoice = () => NO_VOICE;

const store = createXRStore({
  // Im Entwicklungsbetrieb ohne Brille eine Quest 3 nachbilden (IWER), sonst nie.
  emulate: import.meta.env.DEV ? 'metaQuest3' : false,
  hand: { teleportPointer: false },
  controller: { teleportPointer: false },
});

const AVATAR_CHOICES = AVATARS.slice(0, 16);

function codeFromHash(): string | null {
  const raw = decodeURIComponent(location.hash.replace(/^#\/?/, ''));
  return raw ? parseRoomCode(raw) : null;
}

export function App() {
  const server = useMemo(serverUrl, []);
  const [profile, setProfile] = useState(loadProfile);
  const [code, setCode] = useState<string | null>(codeFromHash);
  const [joining, setJoining] = useState('');
  const [problem, setProblem] = useState<string | null>(null);
  const [vrSupported, setVrSupported] = useState(false);
  const [arSupported, setArSupported] = useState(false);

  useEffect(() => {
    void navigator.xr?.isSessionSupported('immersive-vr').then(setVrSupported, () => setVrSupported(false));
    void navigator.xr?.isSessionSupported('immersive-ar').then(setArSupported, () => setArSupported(false));
    const onHash = () => setCode(codeFromHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const room = useRoom(server, code, profile);
  const { send, game } = room;

  // VR-Treffpunkt (#351) und Sprachchat (#352): direkte Verbindungen zu den anderen Geräten im Raum.
  const [mesh, setMesh] = useState<PeerMesh | null>(null);
  const [voice, setVoice] = useState<VoiceChat | null>(null);
  useEffect(() => {
    if (!room.you || room.status !== 'open') return;
    let chat: VoiceChat | null = null;
    const next = new PeerMesh(send, room.you, (from, stream) => chat?.remoteAudio(from, stream));
    chat = new VoiceChat(next.rtc, room.you, (on) => send({ type: 'voice', on }));
    void next.loadIceServers(server);
    setMesh(next);
    setVoice(chat);
    const off = room.onXr((message) => {
      if (message.type === 'rtc') void next.handle(message.from, message.signal);
      else next.roomPose(message.from, message.head);
    });
    return () => {
      off();
      chat?.dispose();
      next.close();
      setMesh(null);
      setVoice(null);
    };
  }, [room.you, room.status === 'open', send, server]);
  const voiceState = useSyncExternalStore(voice?.subscribe ?? noSubscribe, voice?.getState ?? noVoice);
  const members = room.room?.members;
  const xrMembers = useMemo(() => (members ?? []).filter((m) => m.xr && m.connected).map((m) => m.id), [members]);
  // Meldung oder öffentlicher Raum: Sprachchat sofort beenden.
  useEffect(() => {
    if (room.room?.voiceOff && voiceState.joined) voice?.stopByRoom();
  }, [room.room?.voiceOff, voiceState.joined, voice]);
  useEffect(() => {
    if (!mesh) return;
    mesh.update(members ?? [], voiceState.joined);
    // Gescheiterte Verbindungen regelmäßig neu versuchen; Zustand für Tests lesbar.
    const id = window.setInterval(() => {
      mesh.update(members ?? [], voiceState.joined);
      (window as unknown as { __brettXrPeers?: unknown }).__brettXrPeers = { peers: mesh.status(), poses: [...mesh.poses.keys()], voice: voice?.getState() };
    }, 2000);
    return () => window.clearInterval(id);
  }, [mesh, members, voiceState.joined, voice]);

  // Ton erst nach der ersten Berührung (Vorgabe der Browser).
  useEffect(() => {
    const unlock = () => unlockAudio();
    window.addEventListener('pointerdown', unlock);
    return () => window.removeEventListener('pointerdown', unlock);
  }, []);

  // Klänge zu den Ereignissen jeder neuen game-Nachricht, dazu „Du bist dran“ und Sieg.
  const heard = useRef<{ round: number; version: number; myTurn: boolean }>({ round: -1, version: -1, myTurn: false });
  useEffect(() => {
    if (!game) return;
    const last = heard.current;
    const fresh = game.round !== last.round || game.version > last.version;
    const myTurn = game.yourSeat !== null && !game.result && game.current.includes(game.yourSeat) && game.legalMoves.length > 0;
    if (fresh && last.version >= 0) {
      const names = new Set(game.events.flatMap((event) => soundsFor(game.gameId, event)));
      for (const name of names) play(name);
      if (myTurn && !last.myTurn && game.seats.length > 1) play('dein-zug');
      if (game.result?.kind === 'win' && game.yourSeat !== null && game.result.winners.includes(game.yourSeat)) play('sieg');
    }
    heard.current = { round: game.round, version: game.version, myTurn };
  }, [game]);
  const host = room.room?.hostId === room.you;
  const onMove = (index: number) => {
    if (game && game.legalMoves[index] !== undefined) sendMove(send, game, game.legalMoves[index]);
  };

  const enter = (next: string) => {
    location.hash = encodeURIComponent(next);
    setCode(next);
  };

  if (!code) {
    return (
      <main className="xr-start">
        <h1>Brett &amp; Blatt am Tavernentisch</h1>
        <p>Spiele mit der Meta Quest oder im Browser gegen Freunde am Handy oder gegen Bots – mit denselben Raumcodes wie auf spiele.lipponer.de.</p>
        <label>
          Dein Name
          <input value={profile.name} maxLength={16} onChange={(e) => setProfile({ ...profile, name: e.target.value })} onBlur={() => saveProfile(profile)} />
        </label>
        <fieldset className="xr-avatars">
          <legend>Dein Bild</legend>
          {AVATAR_CHOICES.map((a) => (
            <button key={a} type="button" aria-pressed={profile.avatar === a} onClick={() => { const p = { ...profile, avatar: a }; setProfile(p); saveProfile(p); }}>
              {a}
            </button>
          ))}
        </fieldset>
        <button
          type="button"
          className="xr-primary"
          onClick={async () => {
            saveProfile(profile);
            try {
              enter(await createRoom(server));
            } catch (error) {
              setProblem(error instanceof Error ? error.message : String(error));
            }
          }}
        >
          Neuen Raum anlegen
        </button>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const parsed = parseRoomCode(joining);
            if (!parsed) return setProblem('Der Raumcode besteht aus vier Emoji.');
            saveProfile(profile);
            enter(parsed);
          }}
        >
          <label>
            Raumcode
            <input value={joining} onChange={(e) => setJoining(e.target.value)} placeholder="🐻🦊🌈🚀" />
          </label>
          <button type="submit">Beitreten</button>
        </form>
        {problem && <p role="alert">{problem}</p>}
      </main>
    );
  }

  const voiceOff = room.room?.voiceOff ?? null;
  const voiceControls: VoiceControls = {
    joined: voiceState.joined,
    muted: voiceState.muted,
    off: voiceOff,
    error: voiceState.error,
    join: () => void voice?.join(),
    leave: () => voice?.leave(),
    mute: (muted) => voice?.setMuted(muted),
    report: () => send({ type: 'reportVoice' }),
  };
  const voiceMembers = (room.room?.members ?? []).filter((m) => m.voice && m.id !== room.you);
  const lobby = room.room?.phase === 'lobby' ? room.room.lobby : null;
  const mySeat = lobby?.seats.findIndex((s) => s.kind === 'human' && s.memberId === room.you) ?? -1;
  return (
    <div className="xr-shell">
      <div className="xr-canvas">
        <Scene store={store} room={room.room} game={game} you={room.you} signals={room.signals} send={send} onMove={onMove} gameAt={room.gameAt} mesh={mesh} xrMembers={xrMembers} voice={voiceControls} speaking={voiceState.speaking} error={room.error} />
      </div>
      <aside className="xr-bar" aria-label="Raum und Züge">
        <header>
          <strong>Raum {code}</strong>
          <span className="xr-status">{room.status === 'open' ? '' : room.status === 'reconnecting' ? 'verbinde neu …' : room.status === 'closed' ? 'Verbindung verloren' : 'verbinde …'}</span>
          {vrSupported && (
            <button type="button" className="xr-primary" onClick={() => void store.enterVR()}>
              In VR betreten
            </button>
          )}
          {arSupported && (
            <button type="button" className="xr-primary" onClick={() => void store.enterAR()}>
              In Mixed Reality betreten
            </button>
          )}
          <button type="button" onClick={() => { location.hash = ''; setCode(null); }}>
            Raum verlassen
          </button>
        </header>
        {room.error && <p role="alert">{room.error}</p>}
        <section aria-label="Sprachchat">
          <h2>Sprachchat</h2>
          {voiceOff ? (
            <p>{voiceOff === 'public' ? 'Sprachchat gibt es nur in privaten Räumen.' : 'Der Sprachchat ist für diese Runde abgeschaltet.'}</p>
          ) : !voiceState.joined ? (
            <>
              {voiceState.error && <p role="alert">{voiceState.error}</p>}
              <button type="button" onClick={() => void voice?.join()}>
                🎙 Mitsprechen
              </button>
              {voiceMembers.length > 0 && <p>Es sprechen: {voiceMembers.map((m) => `${m.avatar} ${m.name}`).join(', ')}</p>}
            </>
          ) : (
            <>
              <p>
                <button type="button" aria-pressed={voiceState.muted} onClick={() => voice?.setMuted(!voiceState.muted)}>
                  {voiceState.muted ? '🎙 Mikrofon an' : '🔇 Stumm'}
                </button>{' '}
                <button type="button" onClick={() => voice?.leave()}>
                  Aussteigen
                </button>{' '}
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm('Sprachchat für alle bis zur nächsten Partie abschalten?')) send({ type: 'reportVoice' });
                  }}
                >
                  ⚠ Melden
                </button>
              </p>
              <ul className="xr-seats">
                {voiceMembers.map((m) => (
                  <li key={m.id}>
                    <span>
                      {voiceState.speaking.includes(m.id) ? '🔊 ' : ''}
                      {m.avatar} {m.name}
                    </span>
                    <button type="button" aria-pressed={voiceState.silenced.includes(m.id)} onClick={() => voice?.silence(m.id, !voiceState.silenced.includes(m.id))}>
                      {voiceState.silenced.includes(m.id) ? 'Wieder hören' : 'Für mich stumm'}
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
        {lobby && room.room && (
          <section>
            <h2>Lobby</h2>
            {host ? (
              <label>
                Spiel
                <select value={lobby.gameId ?? ''} onChange={(e) => send({ type: 'setGame', gameId: e.target.value })}>
                  <option value="" disabled>
                    wählen …
                  </option>
                  {GAME_CHOICES.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                      {g.board ? ' (3D)' : ''}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <p>Spiel: {gameName(lobby.gameId)}</p>
            )}
            {host && (
              <p className="xr-count">
                Plätze: {lobby.seats.length}{' '}
                <button type="button" aria-label="Ein Platz weniger" onClick={() => send({ type: 'setSeatCount', count: lobby.seats.length - 1 })}>
                  −
                </button>{' '}
                <button type="button" aria-label="Ein Platz mehr" onClick={() => send({ type: 'setSeatCount', count: lobby.seats.length + 1 })}>
                  +
                </button>
              </p>
            )}
            <ol className="xr-seats">
              {lobby.seats.map((seat, i) => {
                const member = seat.kind === 'human' ? room.room!.members.find((m) => m.id === seat.memberId) : undefined;
                return (
                  <li key={i}>
                    <span>
                      {seat.kind === 'bot' ? `🤖 Bot (${LEVEL_TEXT[seat.level]})` : member ? `${member.avatar} ${member.name}${member.id === room.you ? ' (du)' : ''}` : 'frei'}
                    </span>
                    {seat.kind === 'human' && !seat.memberId && mySeat < 0 && (
                      <button type="button" onClick={() => send({ type: 'takeSeat', index: i })}>
                        Hinsetzen
                      </button>
                    )}
                    {host && seat.kind === 'human' && !seat.memberId && (
                      <button type="button" onClick={() => send({ type: 'setSeat', index: i, seat: { bot: 'easy' } })}>
                        Bot
                      </button>
                    )}
                    {host && seat.kind === 'bot' && (
                      <button type="button" onClick={() => send({ type: 'setSeat', index: i, seat: 'open' })}>
                        Frei machen
                      </button>
                    )}
                  </li>
                );
              })}
            </ol>
            {host && (
              <button type="button" className="xr-primary" disabled={!lobby.gameId} onClick={() => send({ type: 'start' })}>
                Partie beginnen
              </button>
            )}
          </section>
        )}
        {game && (
          <section>
            <h2>{gameName(game.gameId)}</h2>
            {game.result ? (
              <>
                <p role="status">{game.result.kind === 'win' ? `Es gewinnt ${game.result.winners.map((w) => game.seats[w]?.name).join(' und ')}` : game.result.kind === 'draw' ? 'Unentschieden' : 'Niemand gewinnt'}</p>
                <button type="button" onClick={() => send({ type: 'afterVote', choice: 'again' })}>
                  Nochmal
                </button>
                {host && (
                  <button type="button" onClick={() => send({ type: 'toLobby' })}>
                    Zur Lobby
                  </button>
                )}
              </>
            ) : game.legalMoves.length > 0 ? (
              <>
                <p role="status">Du bist am Zug.</p>
                <ul className="xr-moves" aria-label="Deine Züge">
                  {game.legalMoves.map((_, i) => (
                    <li key={i}>
                      <button type="button" onClick={() => onMove(i)}>
                        {game.moveLabels?.[i] ?? JSON.stringify(game.legalMoves[i])}
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p role="status">Am Zug: {game.current.map((s) => game.seats[s]?.name).join(', ') || '–'}</p>
            )}
          </section>
        )}
      </aside>
    </div>
  );
}
