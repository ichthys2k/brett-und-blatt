import { clearSyncError, connectWithPasskey, createPasskey, createSync, formatCode, passkeySupport, PLAYER_EMOJIS, syncNow, useSyncState } from '@brett-und-blatt/ui/sync';
import { useEffect, useRef, useState } from 'react';
import { t } from '../i18n';
import { printEmergencyCard } from '../lib/emergencyCard';
import { adoptCode, adoptLocked, changeSecret, createPlayerCode, emergencyCard, emergencyLink, hasLock, isPassError, leavePass, passBlock, passServer, playerLink, renewPlayerCode, resetSecret, setSecret, takeLinkedCode } from '../lib/playerPass';
import { navigate, paths } from '../lib/router';
import { storage } from '../lib/storage';
import { Button, Section } from './controls';
import { QrCode } from './OnlineParts';
import { RescueHint } from './RescueHint';

/** Spielerausweis: dieselbe Person auf mehreren Geräten, mit Spielercode, QR-Code, Rettungscode oder Passkey. */
export function PlayerPassPanel({ onChange }: { onChange: () => void }) {
  const sync = useSyncState();
  const [code, setCode] = useState(() => storage.loadPlayerCode());
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [showQr, setShowQr] = useState(false);
  const [passkey, setPasskey] = useState(false);
  const linkHandled = useRef(false);
  const [locked, setLocked] = useState(() => hasLock());
  /** Spielercode, zu dem noch PIN oder Passwort fehlt (Ausweis auf einem neuen Gerät öffnen). */
  const [pendingCode, setPendingCode] = useState<string | null>(null);
  const [secret, setSecretText] = useState('');
  const [oldSecret, setOldSecret] = useState('');
  const [cardInput, setCardInput] = useState('');

  const run = async (task: () => Promise<unknown>, done?: string) => {
    setBusy(true);
    setError(null);
    setNotice(null);
    clearSyncError();
    try {
      const result = await task();
      setCode(storage.loadPlayerCode());
      setLocked(hasLock());
      if (result !== false && done) setNotice(done);
      onChange();
    } catch (failure) {
      setError(isPassError(failure) ? failure.message : t('online.serverError'));
    } finally {
      setBusy(false);
    }
  };

  const adopt = (text: string) =>
    run(async () => {
      const ok = await adoptCode(text);
      if (ok === 'secret') {
        setPendingCode(text);
        return false;
      }
      if (ok) setInput('');
      return ok;
    }, t('pass.adopted'));

  useEffect(() => {
    void passkeySupport().then((support) => setPasskey(support !== 'no'));
    if (linkHandled.current) return;
    linkHandled.current = true;
    const linked = takeLinkedCode();
    if (linked) void adopt(linked);
  }, []);

  const shownError = error ?? sync.error;

  return (
    <Section title={`🪪 ${t('pass.title')}`}>
      <p className="text-sm text-muted">{t('pass.intro')}</p>
      <RescueHint onChange={onChange} />
      <Button onClick={() => navigate(paths.pass)}>{t('pass.chronik.link')}</Button>

      {code ? (
        <div className="space-y-2">
          <p className="text-sm font-medium">{t('pass.yourCode')}</p>
          <p className="rounded-xl border border-line bg-surface p-3 text-center font-semibold break-words">{code}</p>
          <p className="text-xs text-muted">{t('pass.keepSecret')}</p>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => setShowQr(!showQr)}>{showQr ? t('pass.hideQr') : t('pass.showQr')}</Button>
            <Button
              onClick={() => {
                void navigator.clipboard?.writeText(code).then(() => setNotice(t('pass.copied')));
              }}
            >
              {t('pass.copy')}
            </Button>
            {!locked && (
              <Button
                variant="ghost"
                disabled={busy}
                onClick={() => {
                  if (window.confirm(t('pass.renewConfirm'))) void run(renewPlayerCode);
                }}
              >
                {t('pass.renew')}
              </Button>
            )}
          </div>
          {showQr && <QrCode text={playerLink(code)} label={t('pass.qrLabel')} />}
        </div>
      ) : (
        <Button variant="primary" className="w-full" disabled={busy} onClick={() => void run(createPlayerCode)}>
          {t('pass.create')}
        </Button>
      )}

      <form
        className="space-y-1"
        onSubmit={(event) => {
          event.preventDefault();
          if (input.trim()) void adopt(input);
        }}
      >
        <label className="block space-y-1">
          <span className="text-sm font-medium">{t('pass.enterLabel')}</span>
          <span className="flex gap-2">
            <input
              className="min-h-11 min-w-0 flex-1 rounded-xl border border-line bg-surface px-3"
              placeholder={t('pass.enterHint')}
              autoCapitalize="none"
              autoComplete="off"
              spellCheck={false}
              value={input}
              onChange={(event) => setInput(event.target.value)}
            />
            <Button type="submit" disabled={busy || !input.trim()}>
              {t('pass.enter')}
            </Button>
          </span>
        </label>
        <div className="grid grid-cols-8 gap-1" role="group" aria-label={t('pass.emojiKeys')}>
          {PLAYER_EMOJIS.map((emoji) => (
            <button key={emoji} type="button" className="grid aspect-square place-items-center rounded-lg bg-surface-2 text-2xl hover:bg-line" onClick={() => setInput((current) => current + emoji)}>
              {emoji}
            </button>
          ))}
        </div>
        <p className="text-xs text-muted">{t('pass.enterWarning')}</p>
      </form>

      {pendingCode && (
        <form
          className="space-y-2 rounded-xl border border-line p-3"
          onSubmit={(event) => {
            event.preventDefault();
            void run(async () => {
              await adoptLocked(pendingCode, secret);
              setPendingCode(null);
              setSecretText('');
              setInput('');
            }, t('pass.adopted'));
          }}
        >
          <label className="block space-y-1">
            <span className="text-sm font-medium">{t('pass.lockOpenLabel')}</span>
            <input className="min-h-11 w-full rounded-xl border border-line bg-surface px-3" type="password" autoComplete="off" value={secret} onChange={(event) => setSecretText(event.target.value)} />
          </label>
          <p className="text-xs text-muted">{t('pass.lockHow')}</p>
          <Button type="submit" variant="primary" disabled={busy || !secret}>
            {t('pass.lockOpen')}
          </Button>
        </form>
      )}

      {code && (
        <div className="space-y-2">
          <p className="text-sm font-medium">{t('pass.lockTitle')}</p>
          {locked ? (
            <>
              <p className="text-sm">{t('pass.lockOn')}</p>
              <form
                className="space-y-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  void run(async () => {
                    await changeSecret(oldSecret, secret);
                    setOldSecret('');
                    setSecretText('');
                  }, t('pass.lockChanged'));
                }}
              >
                <input className="min-h-11 w-full rounded-xl border border-line bg-surface px-3" type="password" autoComplete="off" placeholder={t('pass.lockOld')} aria-label={t('pass.lockOld')} value={oldSecret} onChange={(event) => setOldSecret(event.target.value)} />
                <input className="min-h-11 w-full rounded-xl border border-line bg-surface px-3" type="password" autoComplete="off" placeholder={t('pass.lockNew')} aria-label={t('pass.lockNew')} value={secret} onChange={(event) => setSecretText(event.target.value)} />
                <Button type="submit" disabled={busy || !oldSecret || !secret}>
                  {t('pass.lockChange')}
                </Button>
              </form>
              <p className="text-xs text-muted">{t('pass.lockKeepsCode')}</p>
              <details className="space-y-2">
                <summary className="cursor-pointer text-sm">{t('pass.lockForgot')}</summary>
                <form
                  className="mt-2 space-y-2"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void run(async () => {
                      await resetSecret(cardInput, secret);
                      setCardInput('');
                      setSecretText('');
                    }, t('pass.lockResetDone'));
                  }}
                >
                  <input className="min-h-11 w-full rounded-xl border border-line bg-surface px-3" autoComplete="off" autoCapitalize="characters" spellCheck={false} placeholder={t('pass.lockCard')} aria-label={t('pass.lockCard')} value={cardInput} onChange={(event) => setCardInput(event.target.value)} />
                  <input className="min-h-11 w-full rounded-xl border border-line bg-surface px-3" type="password" autoComplete="off" placeholder={t('pass.lockNew')} aria-label={t('pass.lockNew')} value={secret} onChange={(event) => setSecretText(event.target.value)} />
                  <Button type="submit" disabled={busy || !cardInput || !secret}>
                    {t('pass.lockReset')}
                  </Button>
                </form>
              </details>
            </>
          ) : (
            <form
              className="space-y-2"
              onSubmit={(event) => {
                event.preventDefault();
                void run(async () => {
                  await setSecret(secret);
                  setSecretText('');
                }, t('pass.lockSetDone'));
              }}
            >
              <p className="text-xs text-muted">{t('pass.lockIntro')}</p>
              <input className="min-h-11 w-full rounded-xl border border-line bg-surface px-3" type="password" autoComplete="new-password" placeholder={t('pass.lockNew')} aria-label={t('pass.lockNew')} value={secret} onChange={(event) => setSecretText(event.target.value)} />
              <p className="text-xs text-muted">{t('pass.lockHow')}</p>
              <Button type="submit" disabled={busy || sync.busy || !secret}>
                {t('pass.lockSet')}
              </Button>
            </form>
          )}
          {emergencyCard() && (
            <div className="space-y-1">
              <p className="text-sm font-medium">{t('pass.cardTitle')}</p>
              <p className="text-xs text-muted">{t('pass.cardHint')}</p>
              <Button
                onClick={() => {
                  const card = emergencyCard();
                  if (card) printEmergencyCard(card, emergencyLink(card.syncCode));
                }}
              >
                {t('pass.cardPrint')}
              </Button>
            </div>
          )}
        </div>
      )}

      <div className="space-y-2">
        <p className="text-sm font-medium">{t('pass.backup')}</p>
        {sync.code ? (
          <>
            <p className="text-sm">
              {t('pass.backupCode')}: <span className="font-semibold break-all">{formatCode(sync.code)}</span>
            </p>
            <div className="flex flex-wrap gap-2">
              <Button disabled={busy || sync.busy} onClick={() => void run(() => syncNow(passBlock))}>
                {t('pass.backupSync')}
              </Button>
              {passkey && (
                <Button disabled={busy || sync.busy} onClick={() => void run(() => createPasskey(passServer))}>
                  {t('pass.passkeyCreate')}
                </Button>
              )}
            </div>
          </>
        ) : (
          <>
            <p className="text-xs text-muted">{t('pass.backupNone')}</p>
            <div className="flex flex-wrap gap-2">
              <Button disabled={busy || sync.busy} onClick={() => void run(() => createSync(passBlock))}>
                {t('pass.backupCreate')}
              </Button>
              {passkey && (
                <Button disabled={busy || sync.busy} onClick={() => void run(() => connectWithPasskey(passBlock), t('pass.adopted'))}>
                  {t('pass.passkeyUse')}
                </Button>
              )}
            </div>
          </>
        )}
      </div>

      <Button
        variant="ghost"
        onClick={() => {
          if (!window.confirm(t('pass.leaveConfirm'))) return;
          leavePass();
          setCode(null);
          setLocked(false);
          setPendingCode(null);
          setNotice(null);
          onChange();
        }}
      >
        {t('pass.leave')}
      </Button>

      {notice && <p className="text-sm text-muted">{notice}</p>}
      {shownError && (
        <p role="alert" className="rounded-xl bg-danger/10 p-3 text-danger">
          {shownError}
        </p>
      )}
    </Section>
  );
}
