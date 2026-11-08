import { parseRoomCode, type RoomMessage } from '@brett-und-blatt/online';
import { useEffect, useState, type ReactNode } from 'react';
import { Button } from '../components/controls';
import { QrCode, SignalToasts } from '../components/OnlineParts';
import { t } from '../i18n';
import { GAME_SERVER, useRoomConnection, type RoomState } from '../lib/online';
import { stageScale } from '../lib/stage';
import type { LoadedGame } from '../lib/registry';
import { paths } from '../lib/router';
import { GameTable } from './Play';
import { useLoadedGame } from './Room';

/** Hält den Bildschirm wach, solange der Tisch läuft (Fernseher, Beamer, Tablet). */
function useWakeLock(): void {
  useEffect(() => {
    let lock: WakeLockSentinel | null = null;
    const request = async () => {
      try {
        lock = (await navigator.wakeLock?.request('screen')) ?? null;
      } catch {
        // Nicht überall erlaubt; der Tisch läuft trotzdem.
      }
    };
    void request();
    const onVisible = () => {
      if (!document.hidden) void request();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      void lock?.release().catch(() => undefined);
    };
  }, []);
}

function FullscreenButton() {
  const [full, setFull] = useState(Boolean(document.fullscreenElement));
  useEffect(() => {
    const onChange = () => setFull(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);
  if (!document.documentElement.requestFullscreen) return null;
  return (
    <button
      type="button"
      className="fixed right-3 bottom-3 z-30 grid size-11 place-items-center rounded-full bg-surface-2/80 text-xl opacity-60 hover:opacity-100 focus-visible:opacity-100"
      aria-label={t('display.fullscreen')}
      title={t('display.fullscreen')}
      onClick={() => (full ? document.exitFullscreen() : document.documentElement.requestFullscreen()).catch(() => undefined)}
    >
      {full ? '🗗' : '⛶'}
    </button>
  );
}

/**
 * Das Spiel auf dem Fernseher: Es denkt, die Fläche sei etwa 1280 × 720 groß, und wird als Ganzes auf den
 * Bildschirm hochgezogen. So werden Karten, Steine und Schrift groß, ohne dass jedes Spiel eine eigene
 * Fernsehansicht braucht. Festgesetzte Elemente (Siegerehrung, Sprechblasen) bleiben in der Bühne.
 */
function Stage({ children }: { children: ReactNode }) {
  const [size, setSize] = useState(() => ({ width: window.innerWidth, height: window.innerHeight }));
  useEffect(() => {
    const onResize = () => setSize({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  const scale = stageScale(size.width, size.height);
  return (
    <div className="fixed inset-0 overflow-hidden">
      <div style={{ width: size.width / scale, height: size.height / scale, transform: `scale(${scale})`, transformOrigin: '0 0' }}>{children}</div>
    </div>
  );
}

function Message({ text, action }: { text: string; action?: React.ReactNode }) {
  return (
    <main className="grid min-h-dvh place-items-center p-8 text-center">
      <div className="space-y-4">
        <p className="text-3xl">{text}</p>
        {action}
      </div>
    </main>
  );
}

/** Die Lobby auf dem großen Bildschirm: Code und QR zum Mitspielen, Spiel und besetzte Plätze. */
function LobbyScene({ room, game }: { room: RoomMessage; game: LoadedGame | null }) {
  const link = `${window.location.origin}${window.location.pathname}${paths.room(room.code)}`;
  const memberOf = (id: string | null) => room.members.find((m) => m.id === id);
  const seatedIds = new Set(room.lobby.seats.flatMap((seat) => (seat.kind === 'human' && seat.memberId ? [seat.memberId] : [])));
  const watching = room.members.filter((m) => m.connected && !seatedIds.has(m.id));
  return (
    <main className="mx-auto flex min-h-dvh max-w-[96rem] flex-col items-center justify-center gap-8 p-8 text-center">
      <p className="text-[clamp(1.1rem,2.6vw,2rem)] text-muted">{t('display.join')}</p>
      <div className="flex flex-wrap items-center justify-center gap-[clamp(1.5rem,5vw,4rem)]">
        <div className="w-[clamp(10rem,32vmin,24rem)]">
          <QrCode text={link} label={`${t('online.qr')}: ${link}`} />
        </div>
        <div className="space-y-3">
          <p className="bub-room-code text-[clamp(3rem,13vmin,10rem)] leading-none tracking-widest" aria-label={`${t('online.room')} ${room.code}`}>
            {room.code}
          </p>
          <p className="text-[clamp(1.4rem,3.4vw,2.6rem)] font-semibold">{game ? `${game.info.emoji} ${game.info.name}` : t('display.noGame')}</p>
        </div>
      </div>
      {room.lobby.seats.length > 0 && (
        <ul className="grid w-full max-w-4xl grid-cols-[repeat(auto-fit,minmax(14rem,1fr))] gap-3 text-[clamp(1.1rem,2.2vw,1.8rem)]">
          {room.lobby.seats.map((seat, index) => {
            const member = seat.kind === 'human' ? memberOf(seat.memberId) : undefined;
            const text = seat.kind === 'bot' ? `🤖 ${t('display.bot')}` : member ? `${member.avatar} ${member.name}` : `⬜ ${t('display.seatFree')}`;
            return (
              <li key={index} className={`rounded-2xl border border-line bg-surface px-4 py-3 ${member && !member.connected ? 'opacity-50' : ''} ${seat.kind === 'human' && !member ? 'text-muted' : ''}`}>
                {text}
              </li>
            );
          })}
        </ul>
      )}
      {watching.length > 0 && (
        <p className="text-[clamp(1rem,1.8vw,1.4rem)] text-muted">
          {t('display.spectators')}: {watching.map((m) => `${m.avatar} ${m.name}`).join(' · ')}
        </p>
      )}
    </main>
  );
}

function Scene({ state }: { state: RoomState }) {
  const room = state.room!;
  const game = useLoadedGame(room.lobby.gameId);
  if (state.game && room.phase !== 'lobby') {
    const { session, loaded } = state.game;
    return (
      <Stage>
        <GameTable
          key={session.id}
          session={session}
          game={loaded}
          online={{
            yourSeat: null,
            isHost: false,
            display: true,
            onLobby: () => undefined,
            onLeave: () => undefined,
            avatars: room.lobby.seats.map((seat) => (seat.kind === 'human' && seat.memberId ? (room.members.find((m) => m.id === seat.memberId)?.avatar ?? null) : null)),
            invite: { code: room.code, link: `${window.location.origin}${window.location.pathname}${paths.room(room.code)}` },
          }}
        />
      </Stage>
    );
  }
  return <LobbyScene room={room} game={game} />;
}

/** Tisch-Bildschirm (#100): zeigt den offenen Tisch groß, ohne Platz, ohne Bedienung. */
export function DisplayScreen({ code: rawCode }: { code: string }) {
  const code = parseRoomCode(rawCode);
  const [state] = useRoomConnection(code ?? '', null, code !== null);
  useWakeLock();

  if (!code) return <Message text={t('online.notFound')} />;
  if (!GAME_SERVER || !state) return <Message text={t('online.unavailable')} />;
  switch (state.status) {
    case 'gone':
      return <Message text={t('online.notFound')} />;
    case 'outdated':
      return <Message text={t('online.outdated')} action={<Button onClick={() => window.location.reload()}>↻</Button>} />;
    case 'kicked':
    case 'left':
      return <Message text={t('online.notFound')} />;
  }
  if (!state.room) return <Message text={t('online.connecting')} />;
  return (
    <>
      <Scene state={state} />
      <SignalToasts signals={state.signals} members={state.room.members} />
      <FullscreenButton />
      {state.status === 'reconnecting' && <p className="fixed inset-x-0 bottom-0 z-30 bg-warning px-3 py-2 text-center text-sm font-medium text-white">{t('online.reconnecting')}</p>}
    </>
  );
}
