import { CardSetNote } from '../components/CardSetNote';
import { useState } from 'react';
import { Button } from '../components/controls';
import { HowToList } from '../components/HowTo';
import { QrCode } from '../components/OnlineParts';
import { SetupForm } from '../components/SetupForm';
import { t } from '../i18n';
import { levelLabel } from '../lib/format';
import { LEVELS, levelStats, suggest } from '../lib/botRating';
import { loadBook } from '../lib/chronikStore';
import { navigate, paths } from '../lib/router';
import { useGameScene } from '../lib/gameScene';
import { humansMissing, visibleOptionsOf } from '../lib/setupDraftCore';
import { useSetupDraft, type ReadySetupState } from '../lib/useSetupDraft';

export function Setup({ gameId, params }: { gameId: string; params?: Record<string, string> }) {
  useGameScene(gameId);
  const state = useSetupDraft(gameId, params);
  const { game, draft, failed, update, start } = state;
  const [copiedKind, setCopiedKind] = useState<'setup' | 'autostart' | null>(null);

  if (failed) return <p className="p-6 text-center text-muted">{t('setup.failed')}</p>;
  if (!game || !draft) return <p className="p-6 text-center text-muted">{t('setup.loading')}</p>;

  const { info } = game;
  const visibleOptions = visibleOptionsOf(game, draft);
  // Bot-Wertung (#144): Vorschlag zur Stufe, wenn der Pass genug Partien gegen die gewählte Stufe hat (abschaltbar auf „Mein Pass“).
  const botLevels = draft.seats.filter((seat) => seat.kind === 'bot').map((seat) => seat.level);
  const strongest = botLevels.length > 0 ? LEVELS[Math.max(...botLevels.map((level) => LEVELS.indexOf(level)))] : undefined;
  const hintsOn = (() => {
    try {
      return window.localStorage.getItem('brett-und-blatt:botvorschlag') !== 'aus';
    } catch {
      return true;
    }
  })();
  const botHint = hintsOn && strongest ? suggest(levelStats(loadBook(), info.id), strongest, info.players.max === 2) : null;
  const missing = humansMissing(game, draft);

  return (
    <div className="mx-auto flex min-h-full max-w-xl flex-col gap-6 px-4 pt-[max(env(safe-area-inset-top),1rem)] pb-[max(env(safe-area-inset-bottom),1.5rem)]">
      <header className="flex items-center gap-2">
        <Button variant="ghost" className="px-3" aria-label={t('play.back')} onClick={() => navigate(paths.home)}>
          ←
        </Button>
        <div>
          <p className="text-sm text-muted">{t('setup.title')}</p>
          <h1 className="text-2xl font-bold">
            <span aria-hidden="true">{info.emoji} </span>
            {info.name}
          </h1>
        </div>
      </header>

      {botHint && (
        <div className="space-y-2 rounded-2xl border border-line bg-surface p-3 shadow-sm" role="note">
          <p className="text-sm">{t(botHint.kind === 'up' ? 'botrating.up' : 'botrating.down', { p: Math.round(botHint.rate * 100), n: botHint.games, from: levelLabel(botHint.from), to: levelLabel(botHint.to) })}</p>
          <Button onClick={() => update({ seats: draft.seats.map((seat) => (seat.kind === 'bot' ? { ...seat, level: botHint.to } : seat)) })}>{t('botrating.apply', { to: levelLabel(botHint.to) })}</Button>
        </div>
      )}

      <CardSetNote gameId={info.id} />
      <Button variant="primary" className="w-full text-lg" disabled={missing > 0} onClick={start}>
        {t('setup.start')}
      </Button>
      {missing > 0 && <p className="-mt-3 text-center text-sm text-muted">{t('setup.needHumans', { n: info.minHumans ?? 1 })}</p>}

      <details className="rounded-2xl border border-line bg-surface p-3 shadow-sm">
        <summary className="cursor-pointer font-semibold">📖 {t('howto.title')}</summary>
        <div className="pt-3">
          <HowToList info={info} />
        </div>
      </details>

      <SetupForm state={state as ReadySetupState} gameId={gameId} />

      {/* Übungslink & QR-Code für Unterricht / Tafel / Arbeitsblatt */}
      {(() => {
        const publicOpts: Record<string, string> = {};
        for (const spec of visibleOptions) {
          const val = draft.options[spec.id] ?? spec.default;
          if (val) publicOpts[spec.id] = val;
        }
        const baseOrigin = `${window.location.origin}${window.location.pathname}`;
        const setupUrl = `${baseOrigin}${paths.setup(info.id, publicOpts)}`;
        const autostartUrl = `${baseOrigin}${paths.setup(info.id, { ...publicOpts, autostart: '1' })}`;

        const copyLink = async (url: string, kind: 'setup' | 'autostart') => {
          try {
            await navigator.clipboard.writeText(url);
            setCopiedKind(kind);
            window.setTimeout(() => setCopiedKind(null), 2000);
          } catch {
            // Fallback ignorieren
          }
        };

        return (
          <details className="rounded-2xl border border-line bg-surface p-3 shadow-sm">
            <summary className="cursor-pointer font-semibold">
              🔗 Übungslink & QR-Code (für Tafel / Arbeitsblatt)
            </summary>
            <div className="space-y-3 pt-3 text-center">
              <p className="text-xs text-muted">
                Teile genau diese Spieleinstellung per QR-Code am Beamer oder als Direktlink (z. B. in WebUntis oder auf einem Arbeitsblatt):
              </p>
              <QrCode text={setupUrl} label={`QR-Code für ${info.name}`} />
              <div className="flex flex-wrap justify-center gap-2">
                <Button onClick={() => copyLink(setupUrl, 'setup')}>
                  {copiedKind === 'setup' ? '✓ Link kopiert!' : '🔗 Link zur Einrichtung kopieren'}
                </Button>
                <Button onClick={() => copyLink(autostartUrl, 'autostart')}>
                  {copiedKind === 'autostart' ? '✓ Direktstart kopiert!' : '🚀 Direktstart-Link kopieren'}
                </Button>
              </div>
            </div>
          </details>
        );
      })()}

      <Button variant="primary" className="mt-auto w-full text-lg" disabled={missing > 0} onClick={start}>
        {t('setup.start')}
      </Button>
    </div>
  );
}
