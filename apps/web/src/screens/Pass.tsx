import { useMemo, useState } from 'react';
import { Button } from '../components/controls';
import { StampBook } from '../components/StampBook';
import { t } from '../i18n';
import { pinnedList } from '../lib/chronik';
import { formOf, levelStats, ratingOf, winRate } from '../lib/botRating';
import { hasReplay, loadBook, loadBookRecent, loadChronik, pinGame, unpinGame } from '../lib/chronikStore';
import { levelLabel } from '../lib/format';
import type { PlayedGame } from '../lib/partiebuch';
import { findGame } from '../lib/registry';
import { navigate, paths } from '../lib/router';

const OUTCOME_ICON = { win: '🏆', draw: '🤝', loss: '▫️' } as const;

function describe(game: PlayedGame): string {
  const others = game.seats.filter((seat) => !seat.you).map((seat) => `${seat.avatar ?? (seat.kind === 'bot' ? '🤖' : '🙂')} ${seat.name}`);
  return others.join(', ');
}

/** Bot-Wertung (#144): je Spiel Leistungszahl oder Siegquote gegen die Bots und die Form. */
function BotRating() {
  const [hints, setHints] = useState(() => {
    try {
      return window.localStorage.getItem('brett-und-blatt:botvorschlag') !== 'aus';
    } catch {
      return true;
    }
  });
  const book = loadBook();
  const rows = [...new Set(Object.values(book.counts).flatMap((games) => Object.keys(games)))]
    .map((gameId) => ({ gameId, stats: levelStats(book, gameId) }))
    .filter(({ stats }) => stats.easy.played + stats.medium.played + stats.hard.played > 0)
    .sort((a, b) => (findGame(a.gameId)?.name ?? a.gameId).localeCompare(findGame(b.gameId)?.name ?? b.gameId, 'de'));
  return (
    <section className="space-y-3 rounded-2xl border border-line bg-surface p-4" aria-labelledby="botrating-title">
      <h2 id="botrating-title" className="text-xl font-bold">
        {t('botrating.title')}
      </h2>
      <p className="text-sm text-muted">{t('botrating.intro')}</p>
      {rows.length === 0 ? (
        <p className="text-sm text-muted">{t('botrating.empty')}</p>
      ) : (
        <ul className="space-y-2">
          {rows.map(({ gameId, stats }) => {
            const info = findGame(gameId);
            const two = info?.players.max === 2;
            const rating = ratingOf(stats);
            const form = formOf(book, gameId);
            return (
              <li key={gameId} className="rounded-xl border border-line bg-bg p-3">
                <span className="block font-medium">
                  {info?.emoji} {info?.name ?? gameId}
                </span>
                <span className="block text-sm">
                  {[two ? (rating.rating !== null ? t('botrating.rating', { n: rating.rating }) : t('botrating.few')) : null, t('botrating.games', { n: rating.games })].filter(Boolean).join(' · ')}
                </span>
                <span className="block text-xs text-muted">
                  {(['easy', 'medium', 'hard'] as const)
                    .filter((level) => stats[level].played > 0)
                    .map((level) => `${levelLabel(level)}: ${t('botrating.rate', { p: Math.round((winRate(stats[level]) ?? 0) * 100) })} (${stats[level].played})`)
                    .join(' · ')}
                  {form.games > 0 && ` · ${t('botrating.form', { points: form.points, games: form.games })}`}
                </span>
              </li>
            );
          })}
        </ul>
      )}
      <label className="flex cursor-pointer items-center gap-2 text-sm">
        <input
          type="checkbox"
          className="accent-accent"
          checked={hints}
          onChange={(event) => {
            setHints(event.target.checked);
            try {
              if (event.target.checked) window.localStorage.removeItem('brett-und-blatt:botvorschlag');
              else window.localStorage.setItem('brett-und-blatt:botvorschlag', 'aus');
            } catch {
              // Speicher gesperrt
            }
          }}
        />
        {t('botrating.suggest')}
      </label>
    </section>
  );
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

      <StampBook />

      <BotRating />

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
