import { useState } from 'react';
import { t } from '../i18n';
import { disablePush, enablePush, pushAvailability, type PushSubscribeMessage } from '../lib/push';
import { paths } from '../lib/router';
import { Button } from './controls';

/**
 * Schalter „Hinweise aufs Gerät“ (Web Push, #242). Unsichtbar, solange der Build keinen öffentlichen Schlüssel hat
 * oder der Browser es nicht kann. Berechtigung und Abo gibt es nur auf Knopfdruck.
 *
 * `enabled` kommt vom Aufrufer (Antwort des Servers oder Wunsch dieses Geräts); `onEnable` schickt das Abo über die
 * Verbindung, die der Aufrufer gerade hat, `onDisable` den Widerruf.
 */
export function PushToggle({
  enabled,
  onEnable,
  onDisable,
  note,
}: {
  enabled: boolean;
  onEnable: (message: PushSubscribeMessage) => void;
  onDisable: () => void;
  /** Zusatzzeile, z. B. wann der Schalter wirkt. */
  note?: string;
}) {
  const [problem, setProblem] = useState<'denied' | 'error' | null>(null);
  const [busy, setBusy] = useState(false);
  const availability = pushAvailability();
  if (availability === 'hidden') return null;

  const turnOn = async () => {
    setBusy(true);
    setProblem(null);
    const result = await enablePush();
    setBusy(false);
    if (result.ok) return onEnable(result.message);
    if (result.reason !== 'unavailable') setProblem(result.reason);
  };
  const turnOff = async () => {
    setBusy(true);
    await disablePush();
    setBusy(false);
    onDisable();
  };

  return (
    <section className="space-y-2 rounded-2xl border border-line bg-surface p-4" aria-label={t('push.title')}>
      <h2 className="text-sm font-semibold tracking-wide text-muted uppercase">🔔 {t('push.title')}</h2>
      <p className="text-sm">{t('push.explain')}</p>
      {availability === 'needsInstall' && <p className="text-sm text-muted">{t('push.ios')}</p>}
      {availability === 'blocked' && <p className="text-sm text-warning">{t('push.blocked')}</p>}
      {availability === 'ready' && (
        <Button variant={enabled ? 'secondary' : 'primary'} disabled={busy} onClick={enabled ? turnOff : turnOn}>
          {enabled ? t('push.off') : t('push.on')}
        </Button>
      )}
      {problem === 'denied' && <p role="status" className="text-sm text-warning">{t('push.denied')}</p>}
      {problem === 'error' && <p role="alert" className="text-sm text-danger">{t('push.error')}</p>}
      {note && <p className="text-xs text-muted">{note}</p>}
      <p className="text-xs text-muted">
        {t('push.noGuarantee')}{' '}
        <a className="underline" href={paths.privacy}>
          {t('push.privacy')}
        </a>
      </p>
    </section>
  );
}
