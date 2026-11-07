import type { OnlineSession } from '@brett-und-blatt/online';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { t } from '../i18n';

/**
 * Leiste für „Zug zurücknehmen mit Zustimmung“ (online, Spiele mit `GameInfo.takeBack`):
 * Wer abstimmen muss, bekommt „Erlauben“ und „Ablehnen“ mit Restzeit; alle anderen sehen,
 * auf wen gewartet wird. Nach dem Ausgang bleibt ein kurzer Hinweis bis zum nächsten Zug.
 * Aussehen wie die Remis-Leiste (`bub-draw` aus dem Baukasten).
 */
export function TakeBackBar({ session }: { session: OnlineSession }) {
  useSyncExternalStore(
    (onChange) => session.subscribe(onChange),
    () => session.version,
  );
  const info = session.takeBack;
  const pending = info?.status === 'pending';
  // Restzeit sekündlich nachziehen.
  const [, setNow] = useState(0);
  useEffect(() => {
    if (!pending) return;
    const timer = window.setInterval(() => setNow((n) => n + 1), 1000);
    return () => window.clearInterval(timer);
  }, [pending]);
  if (!info) return null;

  const name = (seat: number) => session.config.seats[seat]?.name ?? `Platz ${seat + 1}`;
  const you = session.yourSeat;
  const what = info.moves > 2 ? t('online.takeBackMovesN', { count: info.moves - 1 }) : info.moves === 2 ? t('online.takeBackMoves2') : t('online.takeBackMoves1');

  if (!pending) {
    const text =
      info.status === 'accepted'
        ? info.seat === you
          ? t('online.takeBackAcceptedSelf')
          : t('online.takeBackAccepted', { name: name(info.seat) })
        : info.status === 'declined'
          ? t('online.takeBackDeclined', { name: info.by !== undefined ? name(info.by) : '?' })
          : t('online.takeBackExpired');
    return (
      <div className="bub-draw bub-draw-quiet mx-3 mt-2" role="status">
        {text}
      </div>
    );
  }

  const seconds = Math.ceil(session.takeBackLeftMs() / 1000);
  const waiting = info.waiting.filter((seat) => seat !== you).map(name);
  return (
    <div className="bub-draw mx-3 mt-2" role="status" aria-live="polite">
      <span>
        ↶ {info.seat === you ? t('online.takeBackPendingSelf', { what }) : t('online.takeBackPendingOther', { name: name(info.seat), what })}{' '}
        {!session.mustAnswerTakeBack && waiting.length > 0 && <span className="text-muted">{t('online.takeBackWaiting', { names: waiting.join(', ') })} </span>}
        <span className="text-muted">({t('online.takeBackLeft', { seconds })})</span>
      </span>
      {session.mustAnswerTakeBack && (
        <span className="bub-draw-actions">
          <button type="button" className="bub-draw-yes" onClick={() => session.answerTakeBack(true)}>
            ✓ {t('online.takeBackAllow')}
          </button>
          <button type="button" onClick={() => session.answerTakeBack(false)}>
            ✗ {t('online.takeBackDecline')}
          </button>
        </span>
      )}
    </div>
  );
}
