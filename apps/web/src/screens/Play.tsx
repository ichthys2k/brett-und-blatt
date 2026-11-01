import { randomSeed, type GameEvent, type GameSession, type Result, type SeatId } from '@brett-und-blatt/engine';
import { PlayerChip } from '@brett-und-blatt/ui';
import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { Ceremony } from '../components/Ceremony';
import { Button } from '../components/controls';
import { HowToOverlay } from '../components/HowTo';
import { SoundControl } from '../components/SoundControl';
import { t } from '../i18n';
import { getActiveGame, resumeGame, saveProgress, startGame, type ActiveGame } from '../lib/activeGame';
import { levelLabel } from '../lib/format';
import type { LoadedGame } from '../lib/registry';
import { useGameMusic } from '../lib/music';
import { categoryOf } from './Home';
import { navigate, paths } from '../lib/router';
import { useSoundSettings } from '../lib/sound';
import { storage, type Profile } from '../lib/storage';
import { useGameSounds } from '../lib/useGameSounds';

export function Play() {
  const [active, setActive] = useState<ActiveGame | null>(() => getActiveGame());

  useEffect(() => {
    if (active) return;
    let cancelled = false;
    resumeGame().then((resumed) => {
      if (cancelled) return;
      if (resumed) setActive(resumed);
      else navigate(paths.home);
    });
    return () => {
      cancelled = true;
    };
  }, [active]);

  if (!active) return <p className="p-6 text-center text-muted">{t('play.loading')}</p>;
  return <LocalTable key={active.session.id} active={active} onRestart={setActive} />;
}

/** Eine Partie im Browser: speichern nach jedem Zug, neu starten, Revanche. */
function LocalTable({ active, onRestart }: { active: ActiveGame; onRestart: (game: ActiveGame) => void }) {
  const restart = async (rotate: boolean) => {
    const config = active.session.config;
    const nextSeats = rotate ? [...config.seats.slice(1), config.seats[0]!] : config.seats;
    onRestart(await startGame({ ...config, seats: nextSeats, seed: randomSeed() }));
  };
  return <GameTable session={active.session} game={active.game} local={{ onChange: () => saveProgress(active.session), onRestart: restart }} />;
}

function resultTitle(result: Result, session: GameSession, online?: OnlineTableProps): string {
  const seats = session.config.seats;
  if (result.kind === 'draw') return t('play.draw');
  if (result.kind === 'loss') return t('play.lost');
  const humans = seats.map((seat, i) => (seat.kind === 'human' ? i : -1)).filter((i) => i >= 0);
  const winners = result.winners;
  const names = winners.map((seat) => { const s = seats[seat]; return s ? (s.avatar ? `${s.avatar} ${s.name}` : s.name) : '?'; }).join(' & ');
  if (online) return online.yourSeat !== null && winners.includes(online.yourSeat) ? t('play.youWon') : t('play.won', { name: names });
  if (seats.length === 1) return humans.length === 1 ? t('play.solved') : t('play.solvedBy', { name: seats[0]?.name ?? '' });
  if (humans.length === 1) return winners.includes(humans[0] as number) ? t('play.youWon') : t('play.botWon');
  return t('play.won', { name: names });
}

/** Was der Tisch online zusätzlich wissen muss. */
export interface OnlineTableProps {
  yourSeat: SeatId | null;
  isHost: boolean;
  onRestart?(rotate: boolean): void;
  onLobby(): void;
  onLeave(): void;
  /** Avatare (Emojis) der Plätze in Sitzreihenfolge, falls bekannt. */
  avatars?: (string | null)[];
  /** Z. B. die Leiste mit Emoji-Reaktionen. */
  extra?: ReactNode;
  /** Raumcode und Einladungslink – Spiele zeigen sie z. B. auf einer Tafel an. */
  invite?: { code: string; link: string };
}

interface GameTableProps {
  session: GameSession;
  game: LoadedGame;
  local?: { onChange(): void; onRestart(rotate: boolean): void };
  online?: OnlineTableProps;
}

/** Der Spieltisch – lokal (Solo, Hot-Seat) und online gleichermaßen. */
export function GameTable({ session, game, local, online }: GameTableProps) {
  const { ui, info } = game;
  const isOnline = online !== undefined;
  const localRef = useRef(local);
  localRef.current = local;
  // Im Ref, damit Sicht und Ereignisse auch bei Bot-Zügen im selben Durchlauf ankommen.
  const eventsRef = useRef<GameEvent[]>([]);
  const [, setEvents] = useState<GameEvent[]>([]);
  const [, setTick] = useState(0);
  const [hint, setHint] = useState<unknown>(null);
  const [hintMissing, setHintMissing] = useState(false);
  const [showHowTo, setShowHowTo] = useState(false);
  /** Hot-Seat mit Geheimnissen: Wer hat zuletzt seine Sicht aufgedeckt? */
  const [revealedFor, setRevealedFor] = useState<SeatId | null>(null);
  const [copiedInvite, setCopiedInvite] = useState(false);
  /** Siegerehrung geschlossen (gilt bis zur nächsten Partie in diesem Tisch). */
  const [ceremonyClosed, setCeremonyClosed] = useState(false);

  useSyncExternalStore(
    (onChange) => session.subscribe(onChange),
    () => session.version,
  );

  useEffect(
    () =>
      session.subscribe((change) => {
        eventsRef.current = change.events;
        setEvents(change.events);
        setHint(null);
        setHintMissing(false);
        localRef.current?.onChange();
      }),
    [session],
  );

  const isClient = online !== undefined && !online.isHost;
  const soundSettings = useSoundSettings();
  const playMusic = !isClient || Boolean(soundSettings.clientMusic);

  useGameSounds(session, ui.sounds, online ? online.yourSeat : undefined);
  useGameMusic(info.id, playMusic && !info.ownMusic);

  // Uhren prüfen und anzeigen.
  useEffect(() => {
    if (!session.timed) return;
    const id = window.setInterval(() => {
      session.tick();
      setTick((n) => n + 1);
    }, 200);
    return () => window.clearInterval(id);
  }, [session]);

  // Wer das Fenster wechselt oder das Handy sperrt, soll keine Zeit verlieren (nur lokal – online läuft die Uhr beim Server).
  useEffect(() => {
    if (isOnline) return;
    const onVisibility = () => {
      if (document.hidden && session.timed) session.pause();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [session, isOnline]);

  const seats = session.config.seats;
  /** Ab drei Spielern wird die linke Spalte im Querformat breiter; auf flachen Handy-Bildschirmen stehen die Spieler zu zweit nebeneinander. */
  const crowded = seats.length > 2;
  /** Viele Spieler: im Hochformat eine Zeile zum Wischen statt vieler Reihen, die dem Spielfeld den Platz nehmen. */
  const many = seats.length > 4;
  const playersRef = useRef<HTMLElement>(null);
  const humans = seats.map((seat, i) => (seat.kind === 'human' ? i : -1)).filter((i) => i >= 0);
  const result = session.result;
  const current = session.currentSeats();
  /** Der Mensch, der jetzt am Gerät dran ist – auch während einer Pause. */
  const turnSeat = current.find((seat) => session.isHuman(seat) && !session.isAway(seat));

  // Mehrere Menschen an einem Gerät und Geheimnisse (z. B. Handkarten): Vor jedem
  // Zug wird das Gerät übergeben, erst dann wird die eigene Sicht aufgedeckt.
  const needsHandover = !online && (info.privateViews ?? info.hiddenInformation) && humans.length >= 2;
  const handoverSeat = needsHandover && !result && turnSeat !== undefined && revealedFor !== turnSeat ? turnSeat : null;
  useEffect(() => {
    if (handoverSeat !== null && session.timed) session.pause();
  }, [handoverSeat, session]);

  const actingSeat = handoverSeat === null ? session.humanSeatsToAct()[0] : undefined;
  let viewer: SeatId | 'spectator';
  if (online) viewer = online.yourSeat ?? 'spectator';
  else if (!needsHandover) viewer = humans.length === 1 ? (humans[0] as number) : (actingSeat ?? 'spectator');
  else viewer = revealedFor !== null && revealedFor === turnSeat ? revealedFor : 'spectator';
  const legalMoves = actingSeat !== undefined ? session.legalMoves(actingSeat) : [];
  // Online geht der Hinweis nur an den, dessen Platz der Computer übernommen hat.
  const awaySeats = humans.filter((seat) => session.isAway(seat) && (!online || seat === online.yourSeat));
  const publicView = session.view('spectator');

  const askHint = async () => {
    if (actingSeat === undefined) return;
    const move = await session.hint(actingSeat);
    setHint(move);
    setHintMissing(move === null);
  };

  // Deutlich zeigen, wenn ein Mensch an diesem Gerät dran ist (nur bei Spielen, in denen reihum gezogen wird).
  const concealed = !result && (ui.concealTurns?.(publicView) ?? false);
  const yourMove = !concealed && !result && !session.paused && handoverSeat === null && actingSeat !== undefined && current.length === 1 && seats.length > 1;
  useEffect(() => {
    if (!yourMove) return;
    const before = document.title;
    document.title = `● ${t('play.yourTurn')} – ${before}`;
    return () => {
      document.title = before;
    };
  }, [yourMove]);

  useEffect(() => {
    if (!result) setCeremonyClosed(false);
  }, [result]);

  // Wer dran ist, soll auch in einer rollbaren Spielerleiste zu sehen sein.
  const turnChip = concealed ? undefined : current[0];
  useEffect(() => {
    const list = playersRef.current;
    const chip = turnChip === undefined ? undefined : (list?.children[turnChip] as HTMLElement | undefined);
    if (!list || !chip) return;
    list.scrollTo({
      left: chip.offsetLeft - (list.clientWidth - chip.offsetWidth) / 2,
      top: chip.offsetTop - (list.clientHeight - chip.offsetHeight) / 2,
      behavior: 'smooth',
    });
  }, [turnChip]);
  const reasonText =
    result?.reason === 'time' ? t('play.reason.time') : result?.reason === 'resign' ? t('play.reason.resign') : result?.reason === 'agreement' ? t('play.reason.agreement') : null;

  let status: string;
  if (result) status = resultTitle(result, session, online);
  else if (session.paused) status = t('play.paused');
  else {
    const seat = concealed ? undefined : current[0];
    const seatConfig = seat === undefined ? undefined : seats[seat];
    const name = seat === undefined ? '' : (seatConfig?.avatar ? `${seatConfig.avatar} ${seatConfig.name}` : (seatConfig?.name ?? ''));
    if (seat === undefined) status = '';
    // Geteilter Bildschirm (z. B. Kartenblitz): mehrere Menschen am Gerät handeln zugleich.
    else if (!online && current.filter((s) => humans.includes(s)).length > 1) status = t('play.together');
    else if (session.isThinking(seat)) status = t('play.thinking', { name });
    else if (online ? seat === online.yourSeat : humans.length === 1 && seat === humans[0]) status = t('play.yourTurn');
    else status = t('play.turnOf', { name });
  }

  // Wer aufgibt: online der eigene Platz, lokal wer gerade zieht – sonst der erste Mensch,
  // der noch im Spiel ist (bei Vierer-Schach scheidet nur diese Farbe aus).
  const resignSeat = online
    ? (online.yourSeat ?? undefined)
    : actingSeat !== undefined && session.canResign(actingSeat)
      ? actingSeat
      : humans.find((seat) => session.canResign(seat));
  const canResign = resignSeat !== undefined && session.canResign(resignSeat);
  const resign = () => {
    if (resignSeat === undefined) return;
    const resignName = seats[resignSeat]; const resignLabel = resignName ? (resignName.avatar ? `${resignName.avatar} ${resignName.name}` : resignName.name) : '';
    const question = humans.length > 1 && !online ? t('play.resignConfirmNamed', { name: resignLabel }) : t('play.resignConfirm');
    if (window.confirm(question)) session.resign(resignSeat);
  };

  // Knöpfe nach Partieende – unter dem Spielfeld und in der Siegerehrung.
  const resultActions = online ? (
    online.isHost ? (
      <>
        {online.onRestart && (
          <Button variant="primary" onClick={() => online.onRestart?.(true)}>
            {t('play.rematch')}
          </Button>
        )}
        <Button variant={online.onRestart ? 'secondary' : 'primary'} onClick={online.onLobby}>
          {t('online.toLobby')}
        </Button>
      </>
    ) : (
      <p className="text-sm text-muted">{t('online.waitForHost')}</p>
    )
  ) : (
    <>
      <Button variant="primary" onClick={() => local?.onRestart(true)}>
        {t('play.rematch')}
      </Button>
      <Button onClick={() => navigate(paths.setup(info.id))}>{t('play.settings')}</Button>
      <Button variant="ghost" onClick={() => navigate(paths.home)}>
        {t('play.menu')}
      </Button>
    </>
  );

  return (
    <div className="mx-auto flex h-dvh max-w-3xl flex-col pt-[env(safe-area-inset-top)] pb-[max(env(safe-area-inset-bottom),0.75rem)] side:max-w-none side:flex-row side:pl-[env(safe-area-inset-left)] side:pr-[env(safe-area-inset-right)]">
      {/* Im Hochformat löst sich diese Spalte auf (contents); die Reihenfolge regelt order. */}
      <div className={`contents side:flex side:flex-none side:flex-col side:overflow-y-auto ${crowded ? 'side:w-80' : 'side:w-64 wide:w-72'}`}>
        <header className="flex h-14 flex-none items-center gap-2 px-3 short:h-11">
          <Button variant="ghost" className="px-3" aria-label={online ? t('online.leave') : t('play.back')} onClick={() => (online ? online.onLeave() : navigate(paths.home))}>
            ←
          </Button>
          <h1 className="truncate text-lg font-semibold">
            <span aria-hidden="true">{info.emoji} </span>
            {info.name}
          </h1>
          <Button variant="ghost" className="ml-auto px-3 text-lg" aria-label={t('howto.open')} title={t('howto.open')} onClick={() => setShowHowTo(true)}>
            ?
          </Button>
          <SoundControl gameId={info.id} isClient={isClient} ownMusic={info.ownMusic} />
          {session.timed && !result && !online && (
            <Button
              variant="ghost"
              className="px-3 text-xl"
              aria-label={session.paused ? t('play.resume') : t('play.pause')}
              title={session.paused ? t('play.resume') : t('play.pause')}
              onClick={() => (session.paused ? session.resume() : session.pause())}
            >
              {session.paused ? '▶' : '⏸'}
            </Button>
          )}
        </header>

        {online?.invite && (
          <div className="order-2 mx-3 mb-1 hidden side:flex flex-none items-center justify-between rounded-xl border border-line/70 bg-surface px-3 py-1.5 text-xs text-muted">
            <span>
              {t('online.room')}: <strong className="font-semibold text-ink">{online.invite.code}</strong>
            </span>
            <button
              type="button"
              className="cursor-pointer font-medium hover:text-ink"
              onClick={() => {
                navigator.clipboard.writeText(online.invite!.link);
                setCopiedInvite(true);
                setTimeout(() => setCopiedInvite(false), 2000);
              }}
              title={t('online.copyLink')}
            >
              📋 {copiedInvite ? t('online.copied') : t('online.copyLink')}
            </button>
          </div>
        )}

        <section
          ref={playersRef}
          className={`bub-players relative flex flex-none gap-2 px-3 side:min-h-20 side:flex-initial side:flex-col side:flex-nowrap side:overflow-x-hidden side:overflow-y-auto ${many ? 'overflow-x-auto pb-1' : 'flex-wrap'} ${crowded ? 'flat:grid flat:grid-cols-2 flat:content-start' : ''}`}
          data-crowded={crowded || undefined}
          data-many={many || undefined}
          aria-label="Spieler"
        >
          {seats.map((seat, index) => {
            const profile = !online ? storage.loadProfile() : null;
            const localAvatar = !online && seat.kind === 'human' ? (profile?.avatar ?? seat.avatar ?? null) : (seat.avatar ?? null);
            const avatar = online ? (seat.avatar ?? online.avatars?.[index] ?? null) : localAvatar;
            return (
            <PlayerChip
              key={index}
              name={seat.name}
              avatar={avatar ?? undefined}
              symbol={<ui.SeatSymbol seat={index} seats={seats.length} />}
              score={ui.seatScore?.(publicView, index)}
              detail={ui.seatDetail?.(publicView, index) ?? (seat.kind === 'bot' ? `${ui.seatLabel(index, seats.length)} · ${levelLabel(seat.level ?? 'medium')}` : ui.seatLabel(index, seats.length))}
              active={!concealed && !result && current.includes(index)}
              thinking={!concealed && session.isThinking(index) && seat.kind === 'bot'}
              away={session.isAway(index)}
              winner={result?.kind === 'win' && result.winners.includes(index)}
              clock={session.timed ? session.clock(index) : null}
            />
            );
          })}
        </section>

        <p className="flex-none py-2 text-center font-medium short:py-1" aria-live="polite">
          {yourMove ? (
            <span key={`${session.version}`} className="bub-your-turn">
              <span aria-hidden="true">👉</span>
              {status}
            </span>
          ) : (
            status
          )}
          {result?.reason === 'time' && ` (${t('play.reason.time')})`}
          {result?.reason === 'resign' && ` (${t('play.reason.resign')})`}
          {result?.reason === 'agreement' && ` (${t('play.reason.agreement')})`}
        </p>


        {hintMissing && <p className="order-2 flex-none pt-2 text-center text-sm text-muted">{t('play.noHint')}</p>}

        {awaySeats.length > 0 && !result && (
          <div className="order-2 mx-3 mt-2 flex flex-wrap items-center gap-2 rounded-xl border border-line bg-surface p-3 text-sm">
            {awaySeats.map((seat) => (
              <span key={seat} className="flex flex-1 flex-wrap items-center gap-2">
                {online ? t('online.away') : t('play.away', { name: seats[seat]?.name ?? '' })}
                <Button variant="primary" onClick={() => session.returnSeat(seat)}>
                  {t('play.takeBack')}
                </Button>
              </span>
            ))}
          </div>
        )}

        <footer className="order-2 flex flex-none side:mt-auto flex-wrap justify-center gap-2 px-3 pt-3 pb-1 [&>button]:px-3 short:flex-nowrap short:gap-1 short:pt-1 short:pb-0 short:[&>button]:min-h-9 short:[&>button]:flex-none short:[&>button]:px-2 short:[&>button]:text-sm short:[&>button]:whitespace-nowrap">
          {online ? (
            result ? (
              <>
              {ceremonyClosed && (
                <Button variant="ghost" onClick={() => setCeremonyClosed(false)}>
                  {t('ceremony.show')}
                </Button>
              )}
              {resultActions}
            </>
            ) : (
              <>
                {info.hints && actingSeat !== undefined && <Button onClick={askHint}>💡 {t('play.hint')}</Button>}
                {online.isHost && online.onRestart && (
                  <Button
                    onClick={() => {
                      if (window.confirm(t('play.restartConfirm'))) {
                        online.onRestart?.(false);
                      }
                    }}
                  >
                    {t('play.restart')}
                  </Button>
                )}
                {online.isHost && (
                  <Button
                    variant="ghost"
                    onClick={() => {
                      if (window.confirm(t('online.toLobbyConfirm'))) {
                        online.onLobby();
                      }
                    }}
                  >
                    {t('online.toLobby')}
                  </Button>
                )}
                {canResign && (
                  <Button variant="ghost" onClick={resign}>
                    {t('play.resign')}
                  </Button>
                )}
              </>
            )
          ) : result ? (
            <>
              {ceremonyClosed && (
                <Button variant="ghost" onClick={() => setCeremonyClosed(false)}>
                  {t('ceremony.show')}
                </Button>
              )}
              {resultActions}
            </>
          ) : (
            <>
              {humans.length > 0 && !info.noUndo && (
                <Button disabled={!session.canUndo()} onClick={() => session.undo()}>
                  ↶ {t('play.undo')}
                </Button>
              )}
              {info.hints && actingSeat !== undefined && <Button onClick={askHint}>💡 {t('play.hint')}</Button>}
              <Button onClick={() => local?.onRestart(false)}>{t('play.restart')}</Button>
              {canResign && (
                <Button variant="ghost" onClick={resign}>
                  {t('play.resign')}
                </Button>
              )}
            </>
          )}
        </footer>
        {online?.extra}
      </div>

      <main className="bub-table relative order-1 min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain px-3 side:py-2 side:px-4" data-category={categoryOf(info.id)}>
        {yourMove && <div key={`${session.version}`} className="bub-turn-frame" aria-hidden="true" />}
        <ui.Board
          view={session.view(viewer)}
          legalMoves={legalMoves}
          onMove={(move) => {
            const seat = actingSeat !== undefined ? actingSeat : (typeof viewer === 'number' ? viewer : undefined);
            return seat !== undefined && session.submit(seat, move);
          }}
          events={eventsRef.current}
          clock={session.timed && current[0] !== undefined ? session.clock(current[0]) : null}
          activeSeat={current[0] ?? null}
          hint={hint}
          viewer={viewer}
          seatNames={seats.map((seat) => seat.name)}
          audio={{ muted: soundSettings.muted, music: playMusic ? soundSettings.music : 0, effects: soundSettings.effects }}
          invite={online?.invite}
          canJoinSeat={session.canJoinSeat ? (seat) => session.canJoinSeat!(seat) : undefined}
          onJoinSeat={session.joinSeat ? (seat, kind, name) => session.joinSeat!(seat, kind, name) : undefined}
          canLeaveSeat={session.canLeaveSeat ? (seat) => session.canLeaveSeat!(seat) : undefined}
          onLeaveSeat={session.leaveSeat ? (seat) => session.leaveSeat!(seat) : undefined}
          humanSeats={
            !online && !needsHandover && humans.length > 1
              ? humans.map((seat) => ({ seat, legalMoves: session.isAway(seat) || session.paused ? [] : session.legalMoves(seat), onMove: (move: unknown) => session.submit(seat, move) }))
              : undefined
          }
        />
        {showHowTo && <HowToOverlay info={info} onClose={() => setShowHowTo(false)} />}
        {result && !ceremonyClosed && (
          <Ceremony
            result={result}
            title={status}
            reason={reasonText}
            seats={seats.map((seat, index) => ({
              seat: index,
              name: seat.name,
              avatar: (online ? (seat.avatar ?? online.avatars?.[index]) : seat.kind === 'human' ? (storage.loadProfile()?.avatar ?? seat.avatar) : seat.avatar) ?? null,
              symbol: <ui.SeatSymbol seat={index} seats={seats.length} />,
              score: ui.seatScore?.(publicView, index) ?? null,
              you: online ? index === online.yourSeat : seat.kind === 'human',
            }))}
            actions={resultActions}
            onClose={() => setCeremonyClosed(true)}
          />
        )}
        {handoverSeat !== null ? (
          <div className="absolute inset-0 grid place-items-center bg-bg px-6 text-center">
            <div className="space-y-3">
              <p className="text-4xl" aria-hidden="true">
                🤫
              </p>
              <p className="text-xl font-semibold">{t('play.handover', { name: (seats[handoverSeat]?.avatar ? `${seats[handoverSeat]?.avatar} ${seats[handoverSeat]?.name}` : (seats[handoverSeat]?.name ?? '')) })}</p>
              <p className="text-muted">{t('play.handoverHint')}</p>
              <Button
                variant="primary"
                onClick={() => {
                  setRevealedFor(handoverSeat);
                  session.resume();
                }}
              >
                {t('play.handoverReveal', { name: (seats[handoverSeat]?.avatar ? `${seats[handoverSeat]?.avatar} ${seats[handoverSeat]?.name}` : (seats[handoverSeat]?.name ?? '')) })}
              </Button>
            </div>
          </div>
        ) : session.paused && !result && (
          <button type="button" className="absolute inset-0 grid place-items-center bg-bg/80 text-xl font-semibold backdrop-blur-sm" onClick={() => session.resume()}>
            ▶ {t('play.resume')}
          </button>
        )}
      </main>
    </div>
  );
}
