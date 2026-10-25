import type { GameInfo, SessionSnapshot } from '@brett-und-blatt/engine';
import { useState } from 'react';
import { Button } from '../components/controls';
import { t } from '../i18n';
import { discardGame } from '../lib/activeGame';
import { findGame, games } from '../lib/registry';
import { navigate, paths } from '../lib/router';
import { storage } from '../lib/storage';

function playerCount(info: GameInfo): string {
  const { min, max } = info.players;
  return min === max ? t('home.playersFixed', { count: min }) : t('home.players', { min, max });
}

function ResumeCard({ snapshot, onDiscard }: { snapshot: SessionSnapshot; onDiscard: () => void }) {
  const info = findGame(snapshot.config.gameId);
  if (!info) return null;
  return (
    <section className="flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-surface p-4 shadow-sm">
      <span className="text-3xl" aria-hidden="true">
        {info.emoji}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm text-muted">{t('home.resume')}</p>
        <p className="truncate font-semibold">
          {info.name}: {snapshot.config.seats.map((seat) => seat.name).join(' gegen ')}
        </p>
      </div>
      <div className="flex gap-2">
        <Button variant="ghost" onClick={onDiscard}>
          {t('home.resume.discard')}
        </Button>
        <Button variant="primary" onClick={() => navigate(paths.play)}>
          {t('home.resume.play')}
        </Button>
      </div>
    </section>
  );
}

export function Home() {
  const [snapshot, setSnapshot] = useState(() => storage.loadActive());

  return (
    <div className="mx-auto flex min-h-full max-w-3xl flex-col gap-6 px-4 pt-[max(env(safe-area-inset-top),1.5rem)] pb-[max(env(safe-area-inset-bottom),1.5rem)]">
      <header className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">
          <span aria-hidden="true">🎲 </span>
          {t('app.title')}
        </h1>
        <p className="text-muted">{t('app.tagline')}</p>
      </header>

      {snapshot && (
        <ResumeCard
          snapshot={snapshot}
          onDiscard={() => {
            discardGame();
            setSnapshot(null);
          }}
        />
      )}

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">{t('home.games')}</h2>
        <ul className="grid gap-3 sm:grid-cols-2">
          {games.map((info) => (
            <li key={info.id}>
              <a
                href={paths.setup(info.id)}
                className="flex h-full items-start gap-4 rounded-2xl border border-line bg-surface p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-3 focus-visible:outline-accent"
              >
                <span className="text-4xl leading-none" aria-hidden="true">
                  {info.emoji}
                </span>
                <span className="min-w-0 space-y-1">
                  <span className="block font-semibold">{info.name}</span>
                  <span className="block text-sm text-muted">{info.description}</span>
                  <span className="block text-xs text-muted">{playerCount(info)}</span>
                </span>
              </a>
            </li>
          ))}
        </ul>
      </section>

      <footer className="mt-auto space-y-2 text-xs text-muted">
        <p>
          {t('home.footer')}{' '}
          <a className="underline" href="https://github.com/ichthys2k/brett-und-blatt" target="_blank" rel="noreferrer">
            {t('home.source')}
          </a>
        </p>
        <nav className="flex gap-4" aria-label="Rechtliches">
          <a className="underline" href={paths.imprint}>
            {t('legal.imprint')}
          </a>
          <a className="underline" href={paths.privacy}>
            {t('legal.privacy')}
          </a>
        </nav>
      </footer>
    </div>
  );
}
