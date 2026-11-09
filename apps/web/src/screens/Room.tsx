import { PlayerCrest } from '@brett-und-blatt/ui';
import { BOT_LEVELS, parseCrest, teamsFor, timePresetsOf, type TimePresetId } from '@brett-und-blatt/engine';
import { MAX_SEATS, TOURNAMENT_CODE_PATTERN, parseRoomCode, roomCapabilities, type Capability, type LobbySeat, type MemberInfo, type OnlineSession, type RoomMessage } from '@brett-und-blatt/online';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Button, PlayerCount, Section, Segmented } from '../components/controls';
import { ModeratorPanel, type ModeratorMember } from '../components/ModeratorPanel';
import { ProfileForm, QrCode, ReactionMenu, SignalToasts } from '../components/OnlineParts';
import { reloadForUpdate } from '../lib/appUpdate';
import { t } from '../i18n';
import { announceAvatar } from '../lib/avatar-sounds';
import { describeTime, levelLabel } from '../lib/format';
import { requestNotificationPermission } from '../lib/notifications';
import { GAME_SERVER, useRoomConnection, type RoomConnection, type RoomState } from '../lib/online';
import { saveOwnProfile } from '../lib/playerPass';
import { games, loadGame, type LoadedGame } from '../lib/registry';
import { navigate, paths } from '../lib/router';
import { storage, type Profile } from '../lib/storage';
import { GameTable } from './Play';
import { TakeBackBar } from '../components/TakeBackBar';
import { TeamChip, TeamSummary } from '../components/Teams';

const TIME_PRESETS: TimePresetId[] = ['relaxed', 'normal', 'fast'];
/** Online gibt es nur Spiele für mehrere Personen. */
const onlineGames = games.filter((info) => info.players.max >= 2);

function Page({ children }: { children: React.ReactNode }) {
  return <div className="bub-lobby mx-auto flex min-h-full max-w-xl flex-col gap-5 px-4 pt-[max(env(safe-area-inset-top),1rem)] pb-[max(env(safe-area-inset-bottom),1.5rem)]">{children}</div>;
}

function Notice({ text, action }: { text: string; action?: React.ReactNode }) {
  return (
    <Page>
      <p className="pt-10 text-center text-lg">{text}</p>
      <div className="flex justify-center gap-2">
        {action}
        <Button variant="ghost" onClick={() => navigate(paths.online)}>
          ← {t('online.title')}
        </Button>
      </div>
    </Page>
  );
}

export function RoomScreen({ code: rawCode }: { code: string }) {
  const code = parseRoomCode(rawCode);
  const [profile, setProfile] = useState<Profile | null>(() => storage.loadProfile());
  const [state, connection] = useRoomConnection(code ?? '', code ? profile : null);

  useEffect(() => {
    if (code && profile) {
      requestNotificationPermission();
    }
  }, [code, profile]);

  // Ein Turniercode im Raum-Link (z. B. aus einer älteren, noch zwischengespeicherten App-Version): zum Turnier weiterleiten.
  const missing = !code || state?.status === 'gone';
  useEffect(() => {
    if (!missing || !GAME_SERVER || !TOURNAMENT_CODE_PATTERN.test(rawCode)) return;
    let stopped = false;
    fetch(`${GAME_SERVER}/turniere/${encodeURIComponent(rawCode)}`)
      .then((response) => (response.ok ? (response.json() as Promise<{ exists: boolean }>) : null))
      .then((body) => body?.exists && !stopped && navigate(paths.tournament(rawCode)))
      .catch(() => undefined);
    return () => {
      stopped = true;
    };
  }, [missing, rawCode]);

  if (!code) return <Notice text={t('online.notFound')} />;
  if (!profile) {
    return (
      <Page>
        <h1 className="text-2xl font-bold">
          {t('online.room')} {code}
        </h1>
        <Section title={t('online.profile')}>
          <ProfileForm
            initial={null}
            submitLabel={t('online.enter')}
            onSave={(next) => {
              saveOwnProfile(next);
              setProfile(next);
            }}
          />
        </Section>
      </Page>
    );
  }
  if (!state || !connection) return <Notice text={t('online.unavailable')} />;
  switch (state.status) {
    case 'gone':
      return <Notice text={t('online.notFound')} />;
    case 'kicked':
      return <Notice text={t('online.kicked')} />;
    case 'outdated':
      return <Notice text={t('online.outdated')} action={<Button onClick={reloadForUpdate}>↻</Button>} />;
    case 'left':
      return <Notice text={t('online.leave')} />;
  }
  if (!state.room || !state.you) return <Notice text={t('online.connecting')} />;

  const room = state.room;
  const isHost = room.hostId === state.you;
  const leave = () => {
    if (!window.confirm(t('online.leaveConfirm'))) return;
    connection.leave();
    navigate(room.match ? paths.tournament(room.match.tournament) : paths.online);
  };
  /** Name am Lobby-Platz, für den Stand einer Serie. */
  const seatName = (index: number) => {
    const seat = room.lobby.seats[index];
    return (seat?.kind === 'human' && room.members.find((m) => m.id === seat.memberId)?.name) || '?';
  };
  const toTournament = room.match && (
    <Button className="w-full" onClick={() => navigate(paths.tournament(room.match!.tournament))}>
      🏆 {t('tournament.backToPage')}
    </Button>
  );
  const banner = state.status === 'reconnecting' && (
    <p className="fixed inset-x-0 bottom-0 z-30 bg-warning px-3 py-2 text-center text-sm font-medium text-white">{t('online.reconnecting')}</p>
  );
  const toasts = <SignalToasts signals={state.signals} members={room.members} />;
  const errorBox = state.error ? (
    <p role="alert" className="fixed inset-x-3 top-3 z-30 mx-auto max-w-md rounded-xl bg-danger px-3 py-2 text-center text-sm text-white shadow-md">
      {state.error}
    </p>
  ) : (
    state.notice && (
      <p role="status" className="pointer-events-none fixed inset-x-3 top-3 z-30 mx-auto w-fit max-w-md rounded-xl bg-surface px-3 py-2 text-center text-sm font-medium shadow-md">
        {state.notice}
      </p>
    )
  );

  if (state.game && room.phase !== 'lobby') {
    const { session, loaded } = state.game;
    return (
      <>
        <GameTable
          key={session.id}
          session={session}
          game={loaded}
          online={{
            yourSeat: session.yourSeat,
            displays: room.displays ?? 0,
            isHost,
            ...(room.match ? { finishedNote: room.match.series && !room.match.series.done ? t('tournament.room.seriesNext') : t('tournament.matchOver') } : {}),
            onRestart: (rotate: boolean) => connection.send({ type: 'start', rotate }),
            onLobby: () => connection.send({ type: 'toLobby' }),
            onLeave: leave,
            avatars: state.room?.lobby.seats.map((seat) => {
              if (seat.kind !== 'human' || !seat.memberId) return null;
              return state.room?.members.find((m) => m.id === seat.memberId)?.avatar ?? null;
            }),
            invite: { code: room.code, link: `${window.location.origin}${window.location.pathname}${paths.room(room.code)}` },
            ...(loaded.info.takeBack ? { bar: <TakeBackBar session={session} /> } : {}),
            chat: (inBar: boolean) => (
              <ReactionMenu inBar={inBar} onReact={(emoji) => connection.send({ type: 'react', emoji })} onSay={(phrase) => connection.send({ type: 'say', phrase })} phrases={loaded.ui.phrases} />
            ),
            extra: (
              <>
                {room.match?.series && (
                  <p className="rounded-xl bg-accent/10 px-3 py-2 text-center text-sm font-semibold">
                    🔁 {t('tournament.room.series', { n: room.match.series.bestOf, a: seatName(0), b: seatName(1), sa: room.match.series.score[0], sb: room.match.series.score[1] })}
                  </p>
                )}
                {toTournament}
                <GameSeats session={session} seatLabel={loaded.ui.seatLabel} room={room} send={connection.send.bind(connection)} />
                <ModeratorEntry session={session} seatLabel={loaded.ui.seatLabel} room={room} you={state.you} capabilities={roomCapabilities(isHost)} connection={connection} />
              </>
            ),
          }}
        />
        {toasts}
        {errorBox}
        {banner}
      </>
    );
  }

  if (room.match) {
    return (
      <>
        <Page>
          <h1 className="text-2xl font-bold">🏆 {room.match.label}</h1>
          <p className="text-muted">{room.match.noShow ? t('tournament.room.noShow') : room.lobby.seats.length > 2 ? t('tournament.room.waitingTable') : t('tournament.room.waiting')}</p>
          <ul className="space-y-1">
            {room.lobby.seats.map((seat, index) => {
              const member = seat.kind === 'human' ? room.members.find((m) => m.id === seat.memberId) : undefined;
              return (
                <li key={index} className="rounded-xl border border-line bg-surface px-3 py-2">
                  {member ? `${member.avatar} ${member.name} ${member.connected ? '✅' : '⏳'}` : `⏳ ${t('tournament.room.empty')}`}
                </li>
              );
            })}
          </ul>
          {toTournament}
        </Page>
        {errorBox}
        {banner}
      </>
    );
  }

  return (
    <>
      <Lobby room={room} state={state} connection={connection} isHost={isHost} onLeave={leave} />
      {toasts}
      {errorBox}
      {banner}
    </>
  );
}

/**
 * Plätze während der Partie: Die Raumleitung nimmt Abwesende vom Platz, Zuschauer
 * übernehmen einen freigegebenen Platz, den solange der Computer spielt.
 */
function GameSeats({
  session,
  seatLabel,
  room,
  send,
}: {
  session: OnlineSession;
  seatLabel: LoadedGame['ui']['seatLabel'];
  room: RoomMessage;
  send: RoomConnection['send'];
}) {
  // Neue Spielstände ändern die Sitzung selbst, nicht den Raum – deshalb eigens abonnieren.
  useSyncExternalStore(
    (listener) => session.subscribe(listener),
    () => session.version,
  );
  if (session.result) return null;
  const seats = session.config.seats.map((seat, index) => {
    const memberId = session.seatMember(index);
    return { index, seat, memberId, member: room.members.find((m) => m.id === memberId), orphaned: seat.kind === 'human' && memberId === null && session.isAway(index) };
  });
  const orphaned = session.yourSeat === null ? seats.filter((s) => s.orphaned) : [];
  if (orphaned.length === 0) return null;
  return (
    <div className="mx-3 mt-2 space-y-2 text-sm">
      {orphaned.map(({ index }) => (
        <div key={index} className="flex flex-wrap items-center gap-2 rounded-xl border border-accent/40 bg-accent/10 p-2">
          <span className="flex-1">
            🪑 {seatLabel(index, seats.length)}: {t('online.seatFreeBot')}
          </span>
          <Button variant="primary" className="min-h-9 text-sm" onClick={() => send({ type: 'takeSeat', index })}>
            {t('online.takeOver')}
          </Button>
        </div>
      ))}
    </div>
  );
}

/**
 * Spielleiter-Panel während der Partie (#100): Der Knopf erscheint, wenn `capabilities` etwas erlauben. Die Raumleitung
 * braucht dafür keinen Platz; die Plätze werden aus der laufenden Sitzung gelesen.
 */
function ModeratorEntry({
  session,
  seatLabel,
  room,
  you,
  capabilities,
  connection,
}: {
  session: OnlineSession;
  seatLabel: LoadedGame['ui']['seatLabel'];
  room: RoomMessage;
  you: string | null;
  capabilities: readonly Capability[];
  connection: RoomConnection;
}) {
  const [open, setOpen] = useState(false);
  useSyncExternalStore(
    (listener) => session.subscribe(listener),
    () => session.version,
  );
  if (capabilities.length === 0) return null;
  const seatCount = session.config.seats.length;
  const members: ModeratorMember[] = room.members.map((member) => {
    const index = session.config.seats.findIndex((_, i) => session.seatMember(i) === member.id);
    return {
      member,
      isYou: member.id === you,
      isRoomHost: member.id === room.hostId,
      seatLabel: index >= 0 ? seatLabel(index, seatCount) : null,
      away: index >= 0 && session.isAway(index),
      seatIndex: index >= 0 && !session.result ? index : null,
    };
  });
  return (
    <>
      <div className="mx-3 mt-2">
        <Button variant="secondary" className="min-h-9 text-sm" onClick={() => setOpen(true)}>
          🛠 {t('mod.open')}
        </Button>
      </div>
      {open && (
        <ModeratorPanel
          capabilities={capabilities}
          members={members}
          namesLocked={room.lobby.namesLocked ?? false}
          displays={room.displays ?? 0}
          onRename={(memberId, profile) => {
            if (memberId === you) {
              saveOwnProfile(profile);
              connection.rename(profile);
            } else {
              connection.send({ type: 'renameMember', memberId, name: profile.name, avatar: profile.avatar });
            }
          }}
          onKick={(member) => connection.send({ type: 'kick', memberId: member.id })}
          onUnseat={(index) => connection.send({ type: 'unseat', index })}
          onLockNames={(locked) => connection.send({ type: 'setNamesLocked', locked })}
          onRestart={() => connection.send({ type: 'start', rotate: false })}
          onLobby={() => connection.send({ type: 'toLobby' })}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

export function useLoadedGame(gameId: string | null): LoadedGame | null {
  const [loaded, setLoaded] = useState<LoadedGame | null>(null);
  useEffect(() => {
    let cancelled = false;
    setLoaded(null);
    if (gameId) loadGame(gameId).then((game) => !cancelled && setLoaded(game));
    return () => {
      cancelled = true;
    };
  }, [gameId]);
  return loaded;
}

function Lobby({ room, state, connection, isHost, onLeave }: { room: RoomMessage; state: RoomState; connection: RoomConnection; isHost: boolean; onLeave: () => void }) {
  const { lobby } = room;
  const game = useLoadedGame(lobby.gameId);
  const teams = game ? teamsFor(game.info, lobby.options, lobby.seats.length) : undefined;
  const [showQr, setShowQr] = useState(false);
  const [copied, setCopied] = useState(false);
  // Neue Mitglieder kündigen sich mit ihrem Tier an – nicht beim Öffnen der Lobby und
  // nicht beim Wiederverbinden, denn dabei bleibt die Mitglieds-ID gleich.
  const announced = useRef<Set<string> | null>(null);
  useEffect(() => {
    if (!announced.current) {
      announced.current = new Set(room.members.map((member) => member.id));
      return;
    }
    for (const member of room.members) {
      if (announced.current.has(member.id)) continue;
      announced.current.add(member.id);
      announceAvatar(member.avatar);
    }
  }, [room.members]);
  const link = `${window.location.origin}${window.location.pathname}${paths.room(room.code)}`;
  const displayLink = `${window.location.origin}${window.location.pathname}${paths.display(room.code)}`;
  const memberName = (id: string | null) => room.members.find((m) => m.id === id);
  const send = connection.send.bind(connection);
  const mySeat = lobby.seats.findIndex((seat) => seat.kind === 'human' && seat.memberId === state.you);
  // Freie Plätze fallen beim Start weg; es müssen nur genug besetzt sein.
  const filled = lobby.seats.filter((seat) => seat.kind === 'bot' || seat.memberId !== null).length;
  const humansSeated = lobby.seats.filter((seat) => seat.kind === 'human' && seat.memberId !== null).length;
  const humansMissing = game ? (game.info.minHumans ?? 1) - humansSeated : 0;
  const ready = game !== null && filled >= game.info.players.min && humansMissing <= 0;
  const openSeats = lobby.seats.length - filled;
  const seatedIds = new Set(lobby.seats.flatMap((seat) => (seat.kind === 'human' && seat.memberId ? [seat.memberId] : [])));
  const unseatedConnected = room.members.filter((m) => m.connected && !seatedIds.has(m.id)).length;
  const canGrowSeats = game !== null && lobby.seats.length < Math.min(game.info.players.max, MAX_SEATS);
  const canFillSeats = isHost && unseatedConnected > 0 && (openSeats > 0 || canGrowSeats);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setShowQr(true);
    }
  };

  return (
    <Page>
      <header className="flex items-center gap-2">
        <Button variant="ghost" className="px-3" aria-label={t('online.leave')} onClick={onLeave}>
          ←
        </Button>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm text-muted">{t('online.room')}</p>
            <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${lobby.isPublic ? 'border-accent/40 bg-accent/10 text-accent' : 'border-line bg-surface text-muted'}`}>
              {lobby.isPublic ? `🌐 ${t('online.badge.public')}` : `🔒 ${t('online.badge.private')}`}
            </span>
          </div>
          <h1 className="bub-room-code text-3xl tracking-widest">{room.code}</h1>
        </div>
      </header>

      <section className="space-y-3 rounded-2xl border border-line bg-surface p-3 shadow-sm">
        <div className="flex flex-wrap gap-2">
          <Button onClick={copy}>🔗 {copied ? t('online.copied') : t('online.copyLink')}</Button>
          {'share' in navigator && (
            <Button onClick={() => navigator.share({ title: 'Brett & Blatt', text: t('online.shareText', { code: room.code }), url: link }).catch(() => {})}>📤 {t('online.share')}</Button>
          )}
          <Button variant="ghost" aria-expanded={showQr} onClick={() => setShowQr(!showQr)}>
            ▦ {t('online.qr')}
          </Button>
        </div>
        {showQr && <QrCode text={link} label={`${t('online.qr')}: ${link}`} />}
        <div className="space-y-2 border-t border-line pt-2">
          <p className="text-xs text-muted">{t('display.openHint')}</p>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => window.open(displayLink, '_blank', 'noopener')}>📺 {t('display.open')}</Button>
            <Button variant="ghost" onClick={() => void navigator.clipboard?.writeText(displayLink).catch(() => undefined)}>
              🔗 {t('display.copyLink')}
            </Button>
          </div>
          {(room.displays ?? 0) > 0 && <p className="text-xs text-muted">{t('display.connected', { n: room.displays ?? 0 })}</p>}
        </div>
        {isHost && (
          <label className="flex cursor-pointer select-none items-center gap-3 border-t border-line pt-2">
            <input
              type="checkbox"
              checked={lobby.isPublic}
              onChange={(e) => send({ type: 'setPublic', isPublic: e.target.checked })}
              className="h-4 w-4 rounded accent-accent"
            />
            <div className="min-w-0 flex-1">
              <span className="block text-sm font-semibold">{t('online.publicListing')}</span>
              <span className="block text-xs text-muted">{t('online.publicListingHint')}</span>
            </div>
            <span className="text-xl" aria-hidden="true">
              🌐
            </span>
          </label>
        )}
        {isHost && (
          <label className="flex cursor-pointer select-none items-center gap-3 border-t border-line pt-2">
            <input
              type="checkbox"
              checked={lobby.namesLocked ?? false}
              onChange={(e) => send({ type: 'setNamesLocked', locked: e.target.checked })}
              className="h-4 w-4 rounded accent-accent"
            />
            <div className="min-w-0 flex-1">
              <span className="block text-sm font-semibold">{t('online.namesLocked')}</span>
              <span className="block text-xs text-muted">{t('online.namesLockedHint')}</span>
            </div>
            <span className="text-xl" aria-hidden="true">
              🔒
            </span>
          </label>
        )}
        {isHost && !room.match && (
          <label className="flex cursor-pointer select-none items-center gap-3 border-t border-line pt-2">
            <input
              type="checkbox"
              checked={lobby.takeBack ?? true}
              onChange={(e) => send({ type: 'setTakeBack', allowed: e.target.checked })}
              className="h-4 w-4 rounded accent-accent"
            />
            <div className="min-w-0 flex-1">
              <span className="block text-sm font-semibold">{t('online.takeBack')}</span>
              <span className="block text-xs text-muted">{t('online.takeBackHint')}</span>
            </div>
            <span className="text-xl" aria-hidden="true">
              ↶
            </span>
          </label>
        )}
      </section>

      <Section title={t('online.game')}>
        {isHost ? (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {onlineGames.map((info) => (
              <button
                key={info.id}
                type="button"
                aria-pressed={info.id === lobby.gameId}
                className={`flex items-center gap-2 rounded-xl border p-2 text-left text-sm ${info.id === lobby.gameId ? 'border-accent bg-accent/10 font-semibold' : 'border-line bg-surface'}`}
                onClick={() => send({ type: 'setGame', gameId: info.id })}
              >
                <span className="text-2xl" aria-hidden="true">
                  {info.emoji}
                </span>
                <span className="min-w-0">{info.name}</span>
              </button>
            ))}
          </div>
        ) : game ? (
          <p className="text-lg font-semibold">
            <span aria-hidden="true">{game.info.emoji} </span>
            {game.info.name}
          </p>
        ) : (
          <p className="text-muted">{t('online.noGame')}</p>
        )}
      </Section>

      {game && (
        <>
          <Section title={t('online.seats')}>
            {isHost && (game.info.players.min < Math.min(game.info.players.max, MAX_SEATS) || canFillSeats) && (
              <div className="flex flex-wrap items-center justify-between gap-2">
                {game.info.players.min < Math.min(game.info.players.max, MAX_SEATS) && (
                  <PlayerCount
                    label={t('setup.playerCount')}
                    value={lobby.seats.length}
                    min={game.info.players.min}
                    max={Math.min(game.info.players.max, MAX_SEATS)}
                    onChange={(count) => send({ type: 'setSeatCount', count })}
                  />
                )}
                {canFillSeats && (
                  <Button variant="secondary" className="min-h-9 text-sm" onClick={() => send({ type: 'fillSeats' })}>
                    🪑 {t('online.fillSeats', { n: unseatedConnected })}
                  </Button>
                )}
                {teams && (
                  <Button variant="secondary" className="min-h-9 text-sm" onClick={() => send({ type: 'shuffleTeams' })}>
                    🔀 {t('online.shuffleTeams')}
                  </Button>
                )}
              </div>
            )}
            {teams && <TeamSummary names={teams.names} seats={lobby.seats} />}
            <ol className="space-y-2">
              {lobby.seats.map((seat, index) => (
                <SeatRow key={index} teams={teams} compact={lobby.seats.length > 10} seatCount={lobby.seats.length} index={index} seat={seat} game={game} isHost={isHost} you={state.you} mySeat={mySeat} member={seat.kind === 'human' ? memberName(seat.memberId) : undefined} send={send} />
              ))}
            </ol>
          </Section>

          {game.module.options.some((spec) => !spec.hidden) && (
            <Section title={t('setup.rules')}>
              {game.module.options
                .filter((spec) => !spec.hidden)
                .filter((spec) => !spec.when || Object.entries(spec.when).every(([id, values]) => values.includes(lobby.options[id] ?? '')))
                .map((spec) => {
                  const value = lobby.options[spec.id] ?? spec.default;
                  return (
                    <div key={spec.id} className="space-y-1">
                      <p className="font-medium">{spec.label}</p>
                      {isHost ? (
                        <Segmented label={spec.label} value={value} choices={spec.choices.map((c) => ({ value: c.value, label: c.label }))} onChange={(next) => send({ type: 'setOption', id: spec.id, value: next })} />
                      ) : (
                        <p className="text-muted">{spec.choices.find((c) => c.value === value)?.label}</p>
                      )}
                    </div>
                  );
                })}
            </Section>
          )}

          <Section title={t('setup.time')}>
            {isHost ? (
              <Segmented
                label={t('setup.time')}
                value={lobby.time}
                choices={TIME_PRESETS.map((preset) => ({ value: preset, label: t(`time.${preset}`), hint: describeTime(timePresetsOf(game.module, lobby.options)[preset]) }))}
                onChange={(time) => send({ type: 'setTime', time })}
              />
            ) : (
              <p className="text-muted">
                {t(`time.${lobby.time}`)} · {describeTime(timePresetsOf(game.module, lobby.options)[lobby.time])}
              </p>
            )}
          </Section>
        </>
      )}

      <Section title={t('online.members')}>
        {!isHost && lobby.namesLocked && <p className="text-sm text-muted">🔒 {t('online.namesLockedNotice')}</p>}
        <ul className="space-y-1">
          {room.members.map((member) => (
            <MemberRow
              key={member.id}
              member={member}
              isYou={member.id === state.you}
              isHost={isHost}
              isRoomHost={member.id === room.hostId}
              canEdit={member.id === state.you ? isHost || (!member.nameFixed && !lobby.namesLocked) : isHost}
              onSave={(profile) => {
                if (member.id === state.you) {
                  saveOwnProfile(profile);
                  connection.rename(profile);
                } else {
                  send({ type: 'renameMember', memberId: member.id, name: profile.name, avatar: profile.avatar });
                }
              }}
              onKick={() => window.confirm(t('online.kickConfirm', { name: member.name })) && send({ type: 'kick', memberId: member.id })}
            />
          ))}
        </ul>
      </Section>

      {isHost && (
        <Button variant="primary" className="w-full" disabled={!ready} onClick={() => send({ type: 'start' })}>
          ▶ {t('online.start')}
        </Button>
      )}
      {isHost && game && humansMissing > 0 && <p className="-mt-3 text-center text-sm text-muted">{t('setup.needHumans', { n: game.info.minHumans ?? 1 })}</p>}
      {isHost && ready && openSeats > 0 ? (
        <p className="-mt-3 text-center text-sm text-muted">{t('online.openSeatsDropped', { n: openSeats })}</p>
      ) : !isHost ? (
        <p className="text-center text-sm text-muted">{t('online.startHint')}</p>
      ) : null}
    </Page>
  );
}

function MemberRow({
  member,
  isYou,
  isHost,
  isRoomHost,
  canEdit,
  onSave,
  onKick,
}: {
  member: MemberInfo;
  isYou: boolean;
  isHost: boolean;
  isRoomHost: boolean;
  canEdit: boolean;
  onSave: (profile: Profile) => void;
  onKick: () => void;
}) {
  const [editing, setEditing] = useState(false);
  return (
    <li className="space-y-2 rounded-xl bg-surface px-3 py-2">
      <div className="flex flex-wrap items-center gap-2">
        {parseCrest(member.crest) ? (
          <span className="text-ink">
            <PlayerCrest spec={parseCrest(member.crest)!} size={28} label={t('crest.of', { name: member.name })} />
          </span>
        ) : (
          <span className="text-xl" aria-hidden="true">
            {member.avatar}
          </span>
        )}
        <span className={`min-w-0 flex-1 font-medium ${member.connected ? '' : 'text-muted'}`}>
          {member.name}
          {isYou && ` (${t('online.you')})`}
          {isRoomHost && <span className="ml-2 text-xs text-muted">👑 {t('online.host')}</span>}
          {member.nameFixed && (
            <span className="ml-1 text-xs" title={t('online.nameFixed')}>
              🔒<span className="sr-only"> {t('online.nameFixed')}</span>
            </span>
          )}
          {!member.connected && <span className="ml-2 text-xs">· {t('online.offline')}</span>}
        </span>
        {canEdit && !editing && (
          <Button
            variant="ghost"
            className="min-h-9 text-sm"
            aria-label={isYou ? t('online.editProfile') : t('online.editProfileFor', { name: member.name })}
            onClick={() => setEditing(true)}
          >
            ✏️ {t('online.editProfile')}
          </Button>
        )}
        {isHost && !isYou && (
          <Button variant="ghost" className="min-h-9 text-sm" onClick={onKick}>
            {t('online.kick')}
          </Button>
        )}
      </div>
      {editing && (
        <div className="space-y-2 border-t border-line pt-2">
          {!isYou && <p className="text-sm text-muted">{t('online.editProfileFor', { name: member.name })}</p>}
          <ProfileForm
            initial={{ name: member.name, avatar: member.avatar }}
            submitLabel={t('online.saveProfile')}
            onSave={(profile) => {
              onSave(profile);
              setEditing(false);
            }}
          />
          <Button variant="ghost" className="w-full" onClick={() => setEditing(false)}>
            {t('online.cancel')}
          </Button>
        </div>
      )}
    </li>
  );
}

function SeatRow({
  teams,
  compact,
  seatCount,
  index,
  seat,
  game,
  isHost,
  you,
  mySeat,
  member,
  send,
}: {
  /** Viele Plätze (Bingo bis 30): eine Zeile je Platz, Bot-Auswahl als Klappliste. */
  compact: boolean;
  seatCount: number;
  index: number;
  seat: LobbySeat;
  game: LoadedGame;
  teams: ReturnType<typeof teamsFor>;
  isHost: boolean;
  you: string | null;
  mySeat: number;
  member: { name: string; avatar: string } | undefined;
  send: RoomConnection['send'];
}) {
  const { ui } = game;
  const mine = seat.kind === 'human' && seat.memberId === you;
  return (
    <li className={`space-y-2 border shadow-sm ${compact ? 'rounded-xl px-3 py-1.5' : 'rounded-2xl p-3'} ${mine ? 'border-accent bg-accent/5' : 'border-line bg-surface'}`}>
      <div className={`flex items-center ${compact ? 'gap-2' : 'flex-wrap gap-3'}`}>
        <ui.SeatSymbol seat={index} seats={seatCount} className={`block flex-none ${compact ? 'size-6' : 'size-8'}`} />
        <span className="text-sm whitespace-nowrap text-muted">{ui.seatLabel(index, seatCount)}</span>
        {teams && seat.team !== undefined && (
          <TeamChip
            names={teams.names}
            team={seat.team}
            onSwitch={isHost || mine ? () => send({ type: 'setTeam', index, team: (seat.team! + 1) % teams.count }) : undefined}
          />
        )}
        <span className={`flex-1 font-medium ${compact ? 'min-w-0 truncate' : ''}`}>
          {seat.kind === 'bot' ? (compact ? '🤖' : `🤖 ${t('setup.bot')} · ${levelLabel(seat.level)}`) : member ? `${member.avatar} ${member.name}` : compact && isHost ? '' : t('online.seatOpen')}
        </span>
        {seat.kind === 'human' && seat.memberId === null && (
          <Button variant={mySeat < 0 ? 'primary' : 'secondary'} className="min-h-9 text-sm" onClick={() => send({ type: 'takeSeat', index })}>
            {t('online.sitHere')}
          </Button>
        )}
        {mine && (
          <Button variant="ghost" className="min-h-9 text-sm" onClick={() => send({ type: 'leaveSeat' })}>
            {t('online.standUp')}
          </Button>
        )}
        {isHost && !mine && seat.kind === 'human' && seat.memberId !== null && (
          <Button variant="ghost" className="min-h-9 text-sm" aria-label={`${t('online.unseat')}: ${member?.name ?? ''}`} onClick={() => send({ type: 'unseat', index })}>
            {compact ? '✕' : t('online.unseat')}
          </Button>
        )}
        {compact && isHost && (seat.kind === 'bot' || seat.memberId === null) && (
          <select
            className="min-h-9 rounded-lg border border-line bg-bg px-2 text-sm"
            aria-label={`${ui.seatLabel(index, seatCount)}: ${t('online.seatOpen')} oder ${t('setup.bot')}`}
            value={seat.kind === 'bot' ? seat.level : 'open'}
            onChange={(event) => send({ type: 'setSeat', index, seat: event.target.value === 'open' ? 'open' : { bot: event.target.value as (typeof BOT_LEVELS)[number] } })}
          >
            <option value="open">{t('online.seatOpen')}</option>
            {BOT_LEVELS.map((level) => (
              <option key={level} value={level}>
                🤖 {levelLabel(level)}
              </option>
            ))}
          </select>
        )}
      </div>
      {!compact && isHost && (seat.kind === 'bot' || seat.memberId === null) && (
        <Segmented
          label={`${ui.seatLabel(index, seatCount)}: ${t('online.seatOpen')} oder ${t('setup.bot')}`}
          value={seat.kind === 'bot' ? seat.level : 'open'}
          choices={[{ value: 'open', label: t('online.seatOpen') }, ...BOT_LEVELS.map((level) => ({ value: level, label: `🤖 ${levelLabel(level)}` }))]}
          onChange={(value) => send({ type: 'setSeat', index, seat: value === 'open' ? 'open' : { bot: value as (typeof BOT_LEVELS)[number] } })}
        />
      )}
    </li>
  );
}
