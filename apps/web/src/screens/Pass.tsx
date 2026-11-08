import { useMemo, useState } from 'react';
import { Button } from '../components/controls';
import { t } from '../i18n';
import { pinnedList } from '../lib/chronik';
import { hasReplay, loadBookRecent, loadChronik, pinGame, unpinGame } from '../lib/chronikStore';
import type { PlayedGame } from '../lib/partiebuch';
import { findGame } from '../lib/registry';
import { navigate, paths } from '../lib/router';

const OUTCOME_ICON = { win: '🏆', draw: '🤝', loss: '▫️' } as const;

function describe(game: PlayedGame): string {
  const others = game.seats.filter((seat) => !seat.you).map((seat) => `${seat.avatar ?? (seat.kind === 'bot' ? '🤖' : '🙂')} ${seat.name}`);
  return others.join(', ');
}

/** Mein Pass (#/pass): vorerst die Chronik der letzten Partien (#143); Stempel, Pokale und Album folgen. */
export function PassScreen() {
  const [version, setVersion] = useState(0);
  const [gameFilter, setGameFilter] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  void version;
  const chronik = loadChronik();
  const pinnedIds = new Set(pinnedList(chronik).map((item) => item.id));
  // Angeheftete, die aus den letzten 50 herausgefallen sind, bleiben in der Liste.
  const rows = useMemo(() => {
    const recent = loadBookRecent();
    const ids = new Set(recent.map((game) => game.id));
    const extra = pinnedList(chronik).flatMap((item) => (item.game && !ids.has(item.id) ? [item.game] : []));
    return [...recent, ...extra].sort((a, b) => b.endedAt - a.endedAt);
  }, [version]); // eslint-disable-line react-hooks/exhaustive-deps
  const gameIds = [...new Set(rows.map((game) => game.gameId))];
  const shown = gameFilter ? rows.filter((game) => game.gameId === gameFilter) : rows;
  const nameOf = (id: string) => findGame(id)?.name ?? id;

  return (
    <div className="mx-auto max-w-2xl space-y-4 px-4 pt-[max(env(safe-area-inset-top),1rem)] pb-[max(env(safe-area-inset-bottom),2rem)]">
      <header className="flex items-center gap-2">
        <Button variant="ghost" className="px-3" aria-label={t('play.back')} onClick={() => navigate(paths.home)}>
          ←
        </Button>
        <h1 className="text-2xl font-bold">🪪 {t('pass.page')}</h1>
      </header>

      <section className="space-y-3 rounded-2xl border border-line bg-surface p-4" aria-labelledby="chronik-title">
        <h2 id="chronik-title" className="text-xl font-bold">
          {t('pass.chronik')}
        </h2>
        <p className="text-sm text-muted">{t('pass.chronik.intro')}</p>
        {gameIds.length > 1 && (
          <label className="flex items-center gap-2 text-sm">
            <span>{t('pass.chronik.filter')}</span>
            <select className="min-h-11 flex-1 rounded-xl border border-line bg-bg px-3" value={gameFilter} onChange={(event) => setGameFilter(event.target.value)}>
              <option value="">{t('pass.chronik.all')}</option>
              {gameIds.map((id) => (
                <option key={id} value={id}>
                  {nameOf(id)}
                </option>
              ))}
            </select>
          </label>
        )}
        {shown.length === 0 ? (
          <p className="text-sm text-muted">{t('pass.chronik.empty')}</p>
        ) : (
          <ul className="space-y-2">
            {shown.map((game) => {
              const pinned = pinnedIds.has(game.id);
              return (
                <li key={game.id} className="flex items-start gap-2 rounded-xl border border-line bg-bg p-3">
                  <span aria-hidden="true" className="text-2xl">
                    {OUTCOME_ICON[game.outcome]}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">
                      {nameOf(game.gameId)} · {t(`pass.chronik.${game.outcome}`)}
                      {game.score !== undefined && ` · ${game.score}`}
                    </span>
                    <span className="block text-xs text-muted">
                      {new Date(game.endedAt).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' })} · {t(`pass.chronik.mode.${game.mode}`)}
                      {describe(game) && ` · ${describe(game)}`}
                    </span>
                    {pinned && (
                      <span className="block text-xs text-muted">
                        📌 {t('pass.chronik.pinned')} · {hasReplay(game.id) ? t('pass.chronik.replay') : t('pass.chronik.noReplay')}
                      </span>
                    )}
                  </span>
                  <Button
                    variant="ghost"
                    aria-label={`${pinned ? t('pass.chronik.unpin') : t('pass.chronik.pin')}: ${nameOf(game.gameId)}`}
                    aria-pressed={pinned}
                    onClick={() => {
                      setMessage(null);
                      if (pinned) unpinGame(game.id);
                      else {
                        const result = pinGame(game);
                        if (!result.ok) setMessage(t(result.reason === 'limit' ? 'pass.chronik.limit' : 'pass.chronik.size'));
                      }
                      setVersion((v) => v + 1);
                    }}
                  >
                    {pinned ? '📍' : '📌'}
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
        {message && (
          <p role="alert" className="rounded-xl bg-danger/10 p-3 text-danger">
            {message}
          </p>
        )}
      </section>
    </div>
  );
}
