import { PlayerCrest } from '@brett-und-blatt/ui';
import { useState } from 'react';
import { t } from '../i18n';
import { useCrest } from '../lib/crestStore';
import { Button } from './controls';
import { LevelPanel, useLevelTitle } from './LevelPanel';
import { CrestDesigner } from './CrestDesigner';
import { loadBook } from '../lib/chronikStore';
import { crestUrl } from '../lib/crest';
import { totals } from '../lib/partiebuch';
import { games } from '../lib/registry';
import { loadLearnBook } from '../lib/learnStore';
import { categoryStamp, learnStampDescription, learnStamps, STAMP_ICON, stampCount, stampDescription, stampsFor } from '../lib/stamps';
import { storage } from '../lib/storage';
import { CATEGORIES } from '../screens/Home';

const date = (at: number | null) => (at ? new Date(at).toLocaleDateString('de-DE', { dateStyle: 'medium' }) : null);

/** Das Stempelheft des Passes (#145): Deckblatt und je Rubrik eine Seite mit einem Stempelfeld je Spiel. */
export function StampBook() {
  const crest = useCrest();
  const [designing, setDesigning] = useState(false);
  // Welcher Stempel gerade erklärt wird (Fokus, Tippen oder Hover): `<Spiel>/<Art>`.
  const [shown, setShown] = useState<string | null>(null);
  const book = loadBook();
  const profile = storage.loadProfile();
  const known = new Map(games.map((game) => [game.id, game]));
  const pages = CATEGORIES.map((category) => ({ category, list: category.gameIds.flatMap((id) => known.get(id) ?? []) }));
  const allIds = pages.flatMap((page) => page.list.map((game) => game.id));
  const sum = totals(book);
  const learn = learnStamps(loadLearnBook().days);
  const [learnInfo, setLearnInfo] = useState('');
  const levelTitle = useLevelTitle();

  return (
    <div className="space-y-4">
      <section className="bub-pass-cover-wrap space-y-1 rounded-2xl border-2 border-line bg-surface p-5 text-center shadow-sm" aria-labelledby="cover-title">
        {/* Im Taverne-Aussehen ein gemalter Buchdeckel: das Wappen sitzt im Oval, Name und Titel stehen unten auf dem Leder (#315). */}
        <div className="bub-pass-cover space-y-1">
          <div className="bub-cover-crest flex justify-center text-ink">
            <PlayerCrest spec={crest} size={112} label={t('crest.of', { name: profile?.name || t('pass.cover.noName') })} />
          </div>
          <div className="bub-cover-title space-y-1">
            <h2 id="cover-title" className="text-2xl font-bold">
              {profile?.name || t('pass.cover.noName')}
            </h2>
            {levelTitle && <p className="text-base font-semibold">{levelTitle}</p>}
            <p className="text-sm text-muted">{t('pass.cover.title')}</p>
          </div>
        </div>
        <p className="text-sm">{t('pass.cover.numbers', { stamps: stampCount(book, allIds), played: sum.played, won: sum.won })}</p>
        <div className="pt-2">
          <Button onClick={() => setDesigning(!designing)} aria-expanded={designing}>
            {t('crest.change')}
          </Button>
        </div>
      </section>
      {designing && <CrestDesigner name={profile?.name || t('pass.cover.noName')} onClose={() => setDesigning(false)} />}

      <LevelPanel />

      <section className="space-y-3 rounded-2xl border border-line bg-surface p-4" aria-labelledby="stamps-learn">
        <h2 id="stamps-learn" className="text-xl font-bold">
          <span aria-hidden="true">📚 </span>Lernen
        </h2>
        <ul className="flex flex-wrap gap-2">
          {learn.map((stamp) => (
            <li key={stamp.days}>
              <button
                type="button"
                aria-label={learnStampDescription(stamp)}
                onClick={() => setLearnInfo(learnStampDescription(stamp))}
                className={`grid size-12 place-items-center rounded-full border text-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${stamp.earned ? 'border-accent bg-accent/15' : 'border-dashed border-line opacity-40 grayscale'}`}
              >
                <span aria-hidden="true">{stamp.icon}</span>
              </button>
            </li>
          ))}
        </ul>
        <p className="text-sm text-muted" role="status" aria-live="polite">
          {learnInfo || 'Lerntage in Folge im Karteikasten: 1, 5 und 10.'}
        </p>
      </section>

      {pages.map(({ category, list }) => {
        const banner = categoryStamp(book, list.map((game) => game.id));
        return (
          <section key={category.id} className="space-y-3 rounded-2xl border border-line bg-surface p-4" aria-labelledby={`stamps-${category.id}`}>
            <header>
              <h2 id={`stamps-${category.id}`} className="text-xl font-bold">
                <span aria-hidden="true">{category.icon} </span>
                {category.title}
              </h2>
              <p className={`text-sm ${banner.earned ? 'font-semibold text-accent' : 'text-muted'}`}>
                {banner.earned ? `✅ ${t('pass.stamps.categoryDone')}${banner.at ? ` · ${date(banner.at)}` : ''}` : t('pass.stamps.categoryProgress', { played: banner.played, total: banner.total })}
              </p>
            </header>
            <ul className="grid grid-cols-1 gap-2 min-[480px]:grid-cols-2">
              {list.map((game) => {
                const stamps = stampsFor(book, game.id);
                const earned = stamps.filter((stamp) => stamp.earned);
                const shownStamp = stamps.find((stamp) => `${game.id}/${stamp.kind}` === shown);
                const crest = crestUrl(game.id);
                return (
                  <li key={game.id} className="flex items-center gap-3 rounded-xl border border-line bg-bg p-2">
                    {crest ? (
                      <img src={crest} alt="" aria-hidden="true" className={`size-14 flex-none rounded-lg object-cover ${earned.length === 0 ? 'opacity-40 grayscale' : ''}`} loading="lazy" />
                    ) : (
                      <span aria-hidden="true" className={`grid size-14 flex-none place-items-center rounded-lg bg-surface-2 text-3xl ${earned.length === 0 ? 'opacity-40' : ''}`}>
                        {game.emoji}
                      </span>
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{game.name}</span>
                      <span className="mt-1 flex flex-wrap gap-1">
                        {stamps.map((stamp) => {
                          const id = `${game.id}/${stamp.kind}`;
                          const text = stampDescription(stamp, stamp.at ? date(stamp.at) : null, t('pass.stamps.open'));
                          return (
                            <button
                              key={stamp.kind}
                              type="button"
                              title={text}
                              aria-label={`${game.name}: ${text}`}
                              aria-pressed={shown === id}
                              onFocus={() => setShown(id)}
                              onClick={() => setShown(shown === id ? null : id)}
                              className={`grid size-7 cursor-help place-items-center rounded-full border text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${stamp.earned ? 'border-accent bg-accent/15' : 'border-dashed border-line opacity-40 grayscale'}`}
                            >
                              <span aria-hidden="true">{STAMP_ICON[stamp.kind]}</span>
                            </button>
                          );
                        })}
                      </span>
                      {shownStamp && (
                        <span className="mt-1 block text-xs text-muted" role="status">
                          {stampDescription(shownStamp, shownStamp.at ? date(shownStamp.at) : null, t('pass.stamps.open'))}
                        </span>
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
