import { randomSeed, type GameEvent, type GameSession, type Result, type SeatId } from '@brett-und-blatt/engine';
import { PlayerChip } from '@brett-und-blatt/ui';
import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { Button } from '../components/controls';
import { HowToOverlay } from '../components/HowTo';
import { t } from '../i18n';
import { getActiveGame, resumeGame, saveProgress, startGame, type ActiveGame } from '../lib/activeGame';
import { levelLabel } from '../lib/format';
import type { LoadedGame } from '../lib/registry';
import { navigate, paths } from '../lib/router';

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
  const names = winners.map((seat) => seats[seat]?.name ?? '?').join(' & ');
  if (online) return online.yourSeat !== null && winners.includes(online.yourSeat) ? t('play.youWon') : t('play.won', { name: names });
  if (seats.length === 1) return humans.length === 1 ? t('play.solved') : t('play.solvedBy', { name: seats[0]?.name ?? '' });
  if (humans.length === 1) return winners.includes(humans[0] as number) ? t('play.youWon') : t('play.botWon');
  return t('play.won', { name: names });
}

/** Was der Tisch online zusätzlich wissen muss. */
export interface OnlineTableProps {
  yourSeat: SeatId | null;
  isHost: boolean;
  onLobby(): void;
  onLeave(): void;
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
  const [events, setEvents] = useState<GameEvent[]>([]);
  const [, setTick] = useState(0);
  const [hint, setHint] = useState<unknown>(null);
  const [hintMissing, setHintMissing] = useState(false);
  const [showHowTo, setShowHowTo] = useState(false);
  /** Hot-Seat mit Geheimnissen: Wer hat zuletzt seine Sicht aufgedeckt? */
  const [revealedFor, setRevealedFor] = useState<SeatId | null>(null);

  useSyncExternalStore(
    (onChange) => session.subscribe(onChange),
    () => session.version,
  );

  useEffect(
    () =>
      session.subscribe((change) => {
        setEvents(change.events);
        setHint(null);
        setHintMissing(false);
        localRef.current?.onChange();
      }),
    [session],
  );

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
  /** Ab drei Spielern wird die linke Spalte im Querformat breiter und die Spieler stehen zu zweit nebeneinander. */
  const crowded = seats.length > 2;
  /** Sehr viele Spieler (Bingo bis 30): eine Zeile zum Wischen statt vieler umbrechender Reihen. */
  const many = seats.length > 10;
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

  let status: string;
  if (result) status = resultTitle(result, session, online);
  else if (session.paused) status = t('play.paused');
  else {
    const seat = current[0];
    const name = seat === undefined ? '' : (seats[seat]?.name ?? '');
    if (seat === undefined) status = '';
    else if (session.isThinking(seat)) status = t('play.thinking', { name });
    else if (online ? seat === online.yourSeat : humans.length === 1 && seat === humans[0]) status = t('play.yourTurn');
    else status = t('play.turnOf', { name });
  }

  const resign = () => {
    const seat = online ? (online.yourSeat ?? undefined) : (actingSeat ?? humans[0]);
    if (seat !== undefined && window.confirm(t('play.resignConfirm'))) session.resign(seat);
  };

  return (
    <div className="mx-auto flex h-dvh max-w-3xl flex-col pt-[env(safe-area-inset-top)] pb-[max(env(safe-area-inset-bottom),0.75rem)] flat:max-w-none flat:flex-row flat:pl-[env(safe-area-inset-left)] flat:pr-[env(safe-area-inset-right)]">
      {/* Im Hochformat löst sich diese Spalte auf (contents); die Reihenfolge regelt order. */}
      <div className={`contents flat:flex flat:flex-none flat:flex-col flat:overflow-y-auto ${crowded ? 'flat:w-80' : 'flat:w-64'}`}>
        <header className="flex h-14 flex-none items-center gap-2 px-3">
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

        <section
          className={`flex flex-none gap-2 px-3 ${many ? 'overflow-x-auto pb-1 flat:flex-col flat:overflow-x-visible' : 'flex-wrap'} ${crowded && !many ? 'flat:grid flat:grid-cols-2' : ''}`}
          data-crowded={crowded || undefined}
          data-many={many || undefined}
          aria-label="Spieler"
        >
          {seats.map((seat, index) => (
            <PlayerChip
              key={index}
              name={seat.name}
              symbol={<ui.SeatSymbol seat={index} />}
  detail={ui.seatDetail?.(publicView, index) ?? (seat.kind === 'bot' ? `${ui.seatLabel(index)} · ${levelLabel(seat.level ?? 'medium')}` : ui.seatLabel(index))}
              active={!result && current.includes(index)}
              thinking={session.isThinking(index) && seat.kind === 'bot'}
              away={session.isAway(index)}
              winner={result?.kind === 'win' && result.winners.includes(index)}
              clock={session.timed ? session.clock(index) : null}
            />
          ))}
        </section>

        <p className="flex-none py-2 text-center font-medium" aria-live="polite">
          {status}
          {result?.reason === 'time' && ` (${t('play.reason.time')})`}
          {result?.reason === 'resign' && ` (${t('play.reason.resign')})`}
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

        <footer className="order-2 flex flex-none flat:mt-auto flex-wrap justify-center gap-2 px-3 pt-3 [&>button]:px-3">
          {online ? (
            result ? (
              online.isHost ? (
                <Button variant="primary" onClick={online.onLobby}>
                  {t('online.toLobby')}
                </Button>
              ) : (
                <p className="text-sm text-muted">{t('online.waitForHost')}</p>
              )
            ) : (
              <>
                {info.hints && actingSeat !== undefined && <Button onClick={askHint}>💡 {t('play.hint')}</Button>}
                {online.yourSeat !== null && (
                  <Button variant="ghost" onClick={resign}>
                    {t('play.resign')}
                  </Button>
                )}
              </>
            )
          ) : result ? (
            <>
              <Button variant="primary" onClick={() => local?.onRestart(true)}>
                {t('play.rematch')}
              </Button>
              <Button onClick={() => navigate(paths.setup(info.id))}>{t('play.settings')}</Button>
              <Button variant="ghost" onClick={() => navigate(paths.home)}>
                {t('play.menu')}
              </Button>
            </>
          ) : (
            <>
              {humans.length > 0 && (
                <Button disabled={!session.canUndo()} onClick={() => session.undo()}>
                  ↶ {t('play.undo')}
                </Button>
              )}
              {info.hints && actingSeat !== undefined && <Button onClick={askHint}>💡 {t('play.hint')}</Button>}
              <Button onClick={() => local?.onRestart(false)}>{t('play.restart')}</Button>
              {humans.length > 0 && (
                <Button variant="ghost" onClick={resign}>
                  {t('play.resign')}
                </Button>
              )}
            </>
          )}
        </footer>
        {online?.extra}
      </div>

      <main className="relative order-1 min-h-0 min-w-0 flex-1 px-3 flat:py-2">
        <ui.Board
          view={session.view(viewer)}
          legalMoves={legalMoves}
          onMove={(move) => actingSeat !== undefined && session.submit(actingSeat, move)}
          events={events}
          activeSeat={current[0] ?? null}
          hint={hint}
          viewer={viewer}
          seatNames={seats.map((seat) => seat.name)}
          invite={online?.invite}
          humanSeats={
            !online && !needsHandover && humans.length > 1
              ? humans.map((seat) => ({ seat, legalMoves: session.isAway(seat) || session.paused ? [] : session.legalMoves(seat), onMove: (move: unknown) => session.submit(seat, move) }))
              : undefined
          }
        />
        {showHowTo && <HowToOverlay info={info} onClose={() => setShowHowTo(false)} />}
        {handoverSeat !== null ? (
          <div className="absolute inset-0 grid place-items-center bg-bg px-6 text-center">
            <div className="space-y-3">
              <p className="text-4xl" aria-hidden="true">
                🤫
              </p>
              <p className="text-xl font-semibold">{t('play.handover', { name: seats[handoverSeat]?.name ?? '' })}</p>
              <p className="text-muted">{t('play.handoverHint')}</p>
              <Button
                variant="primary"
                onClick={() => {
                  setRevealedFor(handoverSeat);
                  session.resume();
                }}
              >
                {t('play.handoverReveal', { name: seats[handoverSeat]?.name ?? '' })}
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
