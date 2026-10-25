import { randomSeed, type GameEvent, type LocalSession, type Result, type SeatId } from '@brett-und-blatt/engine';
import { PlayerChip } from '@brett-und-blatt/ui';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { Button } from '../components/controls';
import { t } from '../i18n';
import { getActiveGame, resumeGame, saveProgress, startGame, type ActiveGame } from '../lib/activeGame';
import { levelLabel } from '../lib/format';
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
  return <Table key={active.session.config.seed} active={active} onRestart={setActive} />;
}

function resultTitle(result: Result, session: LocalSession): string {
  if (result.kind === 'draw') return t('play.draw');
  const humans = session.config.seats.map((seat, i) => (seat.kind === 'human' ? i : -1)).filter((i) => i >= 0);
  const winners = result.winners;
  if (humans.length === 1) return winners.includes(humans[0] as number) ? t('play.youWon') : t('play.botWon');
  return t('play.won', { name: winners.map((seat) => session.config.seats[seat]?.name ?? '?').join(' & ') });
}

function Table({ active, onRestart }: { active: ActiveGame; onRestart: (game: ActiveGame) => void }) {
  const { session, game } = active;
  const { ui, info } = game;
  const [events, setEvents] = useState<GameEvent[]>([]);
  const [, setTick] = useState(0);

  useSyncExternalStore(
    (onChange) => session.subscribe(onChange),
    () => session.version,
  );

  useEffect(
    () =>
      session.subscribe((change) => {
        setEvents(change.events);
        saveProgress(session);
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

  // Wer das Fenster wechselt oder das Handy sperrt, soll keine Zeit verlieren.
  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden && session.timed) session.pause();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [session]);

  const seats = session.config.seats;
  const humans = seats.map((seat, i) => (seat.kind === 'human' ? i : -1)).filter((i) => i >= 0);
  const result = session.result;
  const current = session.currentSeats();
  const actingSeat = session.humanSeatsToAct()[0];
  const viewer: SeatId | 'spectator' = humans.length === 1 ? (humans[0] as number) : (actingSeat ?? 'spectator');
  const legalMoves = actingSeat !== undefined ? session.legalMoves(actingSeat) : [];
  const awaySeats = humans.filter((seat) => session.isAway(seat));

  let status: string;
  if (result) status = resultTitle(result, session);
  else if (session.paused) status = t('play.paused');
  else {
    const seat = current[0];
    const name = seat === undefined ? '' : (seats[seat]?.name ?? '');
    if (seat === undefined) status = '';
    else if (session.isThinking(seat)) status = t('play.thinking', { name });
    else if (humans.length === 1 && seat === humans[0]) status = t('play.yourTurn');
    else status = t('play.turnOf', { name });
  }

  const restart = async (rotate: boolean) => {
    const config = session.config;
    const nextSeats = rotate ? [...config.seats.slice(1), config.seats[0]!] : config.seats;
    onRestart(await startGame({ ...config, seats: nextSeats, seed: randomSeed() }));
  };

  const resign = () => {
    const seat = actingSeat ?? humans[0];
    if (seat !== undefined && window.confirm(t('play.resignConfirm'))) session.resign(seat);
  };

  return (
    <div className="mx-auto flex h-dvh max-w-3xl flex-col pt-[env(safe-area-inset-top)] pb-[max(env(safe-area-inset-bottom),0.75rem)]">
      <header className="flex h-14 flex-none items-center gap-2 px-3">
        <Button variant="ghost" className="px-3" aria-label={t('play.back')} onClick={() => navigate(paths.home)}>
          ←
        </Button>
        <h1 className="truncate text-lg font-semibold">
          <span aria-hidden="true">{info.emoji} </span>
          {info.name}
        </h1>
        {session.timed && !result && (
          <Button
            variant="ghost"
            className="ml-auto px-3 text-xl"
            aria-label={session.paused ? t('play.resume') : t('play.pause')}
            title={session.paused ? t('play.resume') : t('play.pause')}
            onClick={() => (session.paused ? session.resume() : session.pause())}
          >
            {session.paused ? '▶' : '⏸'}
          </Button>
        )}
      </header>

      <section className="flex flex-none gap-2 px-3" aria-label="Spieler">
        {seats.map((seat, index) => (
          <PlayerChip
            key={index}
            name={seat.name}
            symbol={<ui.SeatSymbol seat={index} />}
            detail={seat.kind === 'bot' ? `${ui.seatLabel(index)} · ${levelLabel(seat.level ?? 'medium')}` : ui.seatLabel(index)}
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

      <main className="relative min-h-0 flex-1 px-3">
        <ui.Board view={session.view(viewer)} legalMoves={legalMoves} onMove={(move) => actingSeat !== undefined && session.submit(actingSeat, move)} events={events} activeSeat={current[0] ?? null} />
        {session.paused && !result && (
          <button type="button" className="absolute inset-0 grid place-items-center bg-bg/80 text-xl font-semibold backdrop-blur-sm" onClick={() => session.resume()}>
            ▶ {t('play.resume')}
          </button>
        )}
      </main>

      {awaySeats.length > 0 && !result && (
        <div className="mx-3 mt-2 flex flex-wrap items-center gap-2 rounded-xl border border-line bg-surface p-3 text-sm">
          {awaySeats.map((seat) => (
            <span key={seat} className="flex flex-1 flex-wrap items-center gap-2">
              {t('play.away', { name: seats[seat]?.name ?? '' })}
              <Button variant="primary" onClick={() => session.returnSeat(seat)}>
                {t('play.takeBack')}
              </Button>
            </span>
          ))}
        </div>
      )}

      <footer className="flex flex-none flex-wrap justify-center gap-2 px-3 pt-3 [&>button]:px-3">
        {result ? (
          <>
            <Button variant="primary" onClick={() => restart(true)}>
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
            <Button onClick={() => restart(false)}>{t('play.restart')}</Button>
            {humans.length > 0 && (
              <Button variant="ghost" onClick={resign}>
                {t('play.resign')}
              </Button>
            )}
          </>
        )}
      </footer>
    </div>
  );
}
