import { clearSyncError, connectWithPasskey, createPasskey, createSync, formatCode, passkeySupport, syncNow, useSyncState } from '@brett-und-blatt/ui/sync';
import { useEffect, useRef, useState } from 'react';
import { t } from '../i18n';
import { adoptCode, createPlayerCode, isPassError, leavePass, passBlock, passServer, playerLink, renewPlayerCode, takeLinkedCode } from '../lib/playerPass';
import { storage } from '../lib/storage';
import { Button, Section } from './controls';
import { QrCode } from './OnlineParts';

/** Spielerausweis: dieselbe Person auf mehreren Geräten, mit Spielercode, QR-Code, Sicherungscode oder Passkey. */
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

  const run = async (task: () => Promise<unknown>, done?: string) => {
    setBusy(true);
    setError(null);
    setNotice(null);
    clearSyncError();
    try {
      const result = await task();
      setCode(storage.loadPlayerCode());
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
            <Button
              variant="ghost"
              disabled={busy}
              onClick={() => {
                if (window.confirm(t('pass.renewConfirm'))) void run(renewPlayerCode);
              }}
            >
              {t('pass.renew')}
            </Button>
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
        <p className="text-xs text-muted">{t('pass.enterWarning')}</p>
      </form>

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
