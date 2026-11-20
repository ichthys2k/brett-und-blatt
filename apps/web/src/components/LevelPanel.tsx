import { t } from '../i18n';
import { passBook } from '../lib/passes';
import { currentProgress, setRewardsHidden, useRewardsHidden } from '../lib/rewards';
import { levelOf, LEVELS, nextLevelGaps } from '../lib/stufen';

/** Titel der Stufe für den Deckel des Passes; `null` bei Gast und bei „Belohnungen nicht anzeigen“. */
export function useLevelTitle(): string | null {
  const hidden = useRewardsHidden();
  if (hidden || passBook.activeIsGuest()) return null;
  const level = levelOf(currentProgress());
  return level.rank > 0 ? level.title : null;
}

/**
 * Stufe und Titel des aktiven Passes (Belohnungskonzept #324, Schritt #573): was die Stufe ist, was bis zur nächsten fehlt
 * (als Text, auch für Screenreader) und der Schalter „Belohnungen nicht anzeigen“. Keine Bilder; der Titel steht nur hier.
 */
export function LevelPanel() {
  const hidden = useRewardsHidden();
  if (passBook.activeIsGuest()) {
    return (
      <section className="space-y-1 rounded-2xl border border-line bg-surface p-4" aria-labelledby="level-title">
        <h2 id="level-title" className="text-xl font-bold">
          {t('pass.level.title')}
        </h2>
        <p className="text-sm text-muted">{t('pass.level.guest')}</p>
      </section>
    );
  }
  const progress = currentProgress();
  const level = levelOf(progress);
  const next = nextLevelGaps(progress);
  const open = next ? next.gaps.filter((gap) => !gap.done) : [];
  return (
    <section className="space-y-3 rounded-2xl border border-line bg-surface p-4" aria-labelledby="level-title">
      <h2 id="level-title" className="text-xl font-bold">
        {t('pass.level.title')}
        {!hidden && `: ${level.title}`}
      </h2>
      {hidden ? (
        <p className="text-sm text-muted">{t('pass.level.hidden')}</p>
      ) : (
        <>
          <p className="text-sm">
            Stufe {level.rank} von {LEVELS.length - 1}: {level.title}.{' '}
            {next ? `Noch ${open.length} ${open.length === 1 ? 'Schritt' : 'Schritte'} bis ${next.level.title}.` : t('pass.level.top')}
          </p>
          {next && (
            <ul className="space-y-2" aria-label={`Auf dem Weg zu ${next.level.title}`}>
              {next.gaps.map((gap) => (
                <li key={gap.label} className="text-sm">
                  <span className="block">
                    <span aria-hidden="true">{gap.done ? '✓ ' : '○ '}</span>
                    {gap.label}: {gap.done ? 'geschafft' : `${Math.min(gap.have, gap.min)} von ${gap.min}, ${gap.text}`}
                  </span>
                  <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-line" aria-hidden="true">
                    <span className="block h-full rounded-full bg-accent" style={{ width: `${Math.min(100, Math.round((gap.have / gap.min) * 100))}%` }} />
                  </span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
      <label className="flex cursor-pointer items-center gap-2 text-sm">
        <input type="checkbox" className="accent-accent" checked={hidden} onChange={(event) => setRewardsHidden(event.target.checked)} />
        {t('pass.level.hide')}
      </label>
    </section>
  );
}
