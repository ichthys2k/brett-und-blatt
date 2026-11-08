import { useState } from 'react';
import { t } from '../i18n';
import { printCertificate } from '../lib/certificate';
import { loadBook } from '../lib/chronikStore';
import { crestUrl } from '../lib/crest';
import { levelLabel } from '../lib/format';
import { sanitizeTrophies, shelves } from '../lib/pokale';
import { TROPHIES_KEY } from '../lib/passRecorder';
import { findGame } from '../lib/registry';
import { storage } from '../lib/storage';

function loadTrophies() {
  try {
    return sanitizeTrophies(JSON.parse(window.localStorage.getItem(TROPHIES_KEY) ?? 'null'));
  } catch {
    return [];
  }
}

/** Der Pokalschrank des Passes (#146): je Spiel ein Regalfach mit der Zahl der Siege; aufgeklappt die letzten Pokale und die Urkunden. */
export function TrophyCabinet() {
  const [open, setOpen] = useState<string | null>(null);
  const book = loadBook();
  const trophies = loadTrophies();
  const list = shelves(book, trophies);
  const total = list.reduce((sum, shelf) => sum + shelf.wins, 0);
  const player = storage.loadProfile()?.name ?? '';

  return (
    <section className="space-y-3 rounded-2xl border border-line bg-surface p-4" aria-labelledby="trophy-title">
      <h2 id="trophy-title" className="text-xl font-bold">
        🏆 {t('pass.trophy.title')}
      </h2>
      <p className="text-sm text-muted">{t('pass.trophy.intro')}</p>
      {list.length === 0 ? (
        <p className="text-sm text-muted">{t('pass.trophy.empty')}</p>
      ) : (
        <>
          <p className="text-sm font-medium">{t('pass.trophy.total', { n: total })}</p>
          <ul className="space-y-2">
            {list.map((shelf) => {
              const info = findGame(shelf.gameId);
              const crest = crestUrl(shelf.gameId);
              const expanded = open === shelf.gameId;
              return (
                <li key={shelf.gameId} className="rounded-xl border border-line bg-bg">
                  <button type="button" className="flex min-h-11 w-full items-center gap-3 p-2 text-left" aria-expanded={expanded} onClick={() => setOpen(expanded ? null : shelf.gameId)}>
                    {crest ? <img src={crest} alt="" aria-hidden="true" className="size-10 flex-none rounded-lg object-cover" loading="lazy" /> : <span aria-hidden="true" className="grid size-10 flex-none place-items-center rounded-lg bg-surface-2 text-2xl">{info?.emoji ?? '🎲'}</span>}
                    <span className="min-w-0 flex-1 truncate font-medium">{info?.name ?? shelf.gameId}</span>
                    <span aria-label={t('pass.trophy.total', { n: shelf.wins })} className="flex-none font-semibold">
                      🏆 × {shelf.wins}
                    </span>
                  </button>
                  {expanded && (
                    <ul className="space-y-1 border-t border-line p-2 text-sm">
                      {shelf.trophies.map((trophy) => (
                        <li key={trophy.id} className="flex items-center gap-2">
                          <span className="min-w-0 flex-1">
                            {new Date(trophy.at).toLocaleDateString('de-DE', { dateStyle: 'medium' })} · {t(`pass.chronik.mode.${trophy.mode}`)}
                            {trophy.level ? ` · ${levelLabel(trophy.level)}` : ''}
                            {trophy.opponents.length > 0 ? ` · ${t('pass.trophy.against', { names: trophy.opponents.join(', ') })}` : ''}
                          </span>
                          {trophy.cert && (
                            <button type="button" className="flex-none rounded-lg border border-line px-2 py-1 text-xs hover:bg-surface-2" onClick={() => printCertificate(trophy, info?.name ?? shelf.gameId, player)}>
                              📜 {t('pass.trophy.certificate')}
                            </button>
                          )}
                        </li>
                      ))}
                      {shelf.wins > shelf.trophies.length && <li className="text-xs text-muted">{t('pass.trophy.older')}</li>}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
}
