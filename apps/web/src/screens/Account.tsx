import type { AccountSession } from '@brett-und-blatt/ui/sync';
import { useEffect, useRef, useState } from 'react';
import { Button } from '../components/controls';
import { TavernPage } from '../components/TavernPage';
import { accountLabel, clearPendingAccount, linkWithAccount, openWithAccount, pinFor, returnedAccount, unlinkWithAccount, type ReturnedAccount } from '../lib/accountLogin';
import { adoptAccountPass, isPassError, passForAccount } from '../lib/playerPass';
import { navigate, paths } from '../lib/router';
import { storage } from '../lib/storage';

const FIELD = 'min-h-11 w-full rounded-xl border border-line bg-surface px-3';
const ERRORS: Record<string, string> = {
  abgelaufen: 'Die Anmeldung ist abgelaufen. Bitte noch einmal anmelden.',
  abgebrochen: 'Die Anmeldung wurde abgebrochen.',
  anmeldung: 'Die Anmeldung beim Anbieter ist fehlgeschlagen. Bitte noch einmal versuchen.',
  'nicht-eingerichtet': 'Die Anmeldung mit diesem Anbieter ist auf dem Spieleserver noch nicht eingerichtet.',
};

/**
 * Rückkehr vom Anbieter (`#/konto?ticket=…`, #154): je nach Absicht den Pass verknüpfen, über das Konto öffnen oder die Verknüpfung lösen.
 * Das Ticket gilt wenige Minuten; danach muss man sich neu anmelden.
 */
export function AccountScreen({ ticket, error, reason }: { ticket?: string; error?: string; reason?: string }) {
  const [state, setState] = useState<ReturnedAccount | null>(null);
  const [message, setMessage] = useState<string | null>(error ? `${ERRORS[error] ?? 'Die Anmeldung ist fehlgeschlagen.'}${reason ? ` (Grund: ${reason})` : ''}` : null);
  const [busy, setBusy] = useState(!!ticket && !error);
  const [withPin, setWithPin] = useState(false);
  const [pin, setPin] = useState('');
  const [done, setDone] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (!ticket || error || started.current) return;
    started.current = true;
    // Das Ticket aus der Adresse nehmen, damit es nicht in Verlauf oder Lesezeichen bleibt.
    window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}#/konto`);
    void returnedAccount(ticket)
      .then((result) => {
        if (!result) setMessage('Die Anmeldung gibt es nicht mehr. Bitte noch einmal anmelden.');
        else setState(result);
      })
      .catch((failure) => setMessage(isPassError(failure) ? failure.message : 'Keine Verbindung zum Spieleserver.'))
      .finally(() => setBusy(false));
  }, [ticket, error]);

  const finish = (text: string) => {
    clearPendingAccount();
    setState(null);
    setDone(text);
  };

  const run = async (task: (session: AccountSession) => Promise<void>) => {
    if (!state) return;
    setBusy(true);
    setMessage(null);
    try {
      await task(state.session);
    } catch (failure) {
      setMessage(isPassError(failure) ? failure.message : 'Das hat nicht geklappt. Bitte noch einmal versuchen.');
    } finally {
      setBusy(false);
    }
  };

  const secretsFor = async (session: AccountSession) => {
    const secret = pin.trim();
    if (!/^[0-9]{6}$/.test(secret) && secret.length < 8) throw new Error('pin');
    return pinFor(session, secret);
  };
  const needPin = (failure: unknown) => !isPassError(failure) && failure instanceof Error && failure.message === 'pin';

  const link = () =>
    run(async (session) => {
      try {
        const pass = await passForAccount();
        await linkWithAccount(session, pass, withPin ? await secretsFor(session) : undefined);
        finish(`Dein Pass ist mit deinem ${accountLabel(session.provider)}-Konto verknüpft. Auf einem neuen Gerät kannst du dich jetzt mit dem Konto anmelden.`);
      } catch (failure) {
        if (needPin(failure)) setMessage('PIN: sechs Ziffern. Passwort: mindestens 8 Zeichen.');
        else throw failure;
      }
    });

  const open = () =>
    run(async (session) => {
      try {
        const pass = await openWithAccount(session, state?.pin ? await secretsFor(session) : undefined);
        const own = storage.loadProfile();
        if (own?.name && storage.loadPlayerCode() && storage.loadPlayerCode() !== pass.code && !window.confirm(`Dieses Gerät hat schon den Pass „${own.name}“. Er wird durch den Pass „${pass.name || 'ohne Namen'}“ ersetzt. Fortfahren?`)) return;
        adoptAccountPass(pass);
        finish(`Angemeldet als ${pass.name || 'dein Pass'}.`);
      } catch (failure) {
        if (needPin(failure)) setMessage('PIN: sechs Ziffern. Passwort: mindestens 8 Zeichen.');
        else throw failure;
      }
    });

  const unlink = () =>
    run(async (session) => {
      await unlinkWithAccount(session);
      finish(`Die Verknüpfung mit dem ${accountLabel(session.provider)}-Konto ist gelöst.`);
    });

  return (
    <TavernPage title="Konto" subtitle="Anmeldung" back={paths.pass}>
      <div className="space-y-4 text-left">
        {busy && <p role="status">Einen Moment …</p>}
        {message && (
          <p className="rounded-xl border border-line bg-surface p-3 text-sm" role="alert">
            {message}
          </p>
        )}
        {done && (
          <>
            <p className="rounded-xl border border-line bg-surface p-3" role="status">
              {done}
            </p>
            <Button variant="primary" onClick={() => navigate(paths.pass)}>
              Zum Pass
            </Button>
          </>
        )}

        {state?.intent === 'link' && (
          <div className="space-y-3">
            <p>
              Verknüpfen mit deinem <strong>{accountLabel(state.session.provider)}</strong>-Konto.
            </p>
            {state.exists && <p className="rounded-xl border border-line bg-surface p-3 text-sm">Dieses Konto ist schon mit einem Pass verknüpft. Wenn du fortfährst, gilt es künftig für <em>diesen</em> Pass.</p>}
            <label className="flex min-h-11 items-start gap-2">
              <input type="checkbox" className="mt-1 size-5 accent-accent" checked={withPin} onChange={(event) => setWithPin(event.target.checked)} />
              <span>
                Zusätzlich mit PIN schützen (empfohlen)
                <span className="block text-sm text-muted">Das Konto allein reicht dann nicht, um den Pass zu öffnen.</span>
              </span>
            </label>
            {withPin && <input className={FIELD} inputMode="numeric" autoComplete="off" placeholder="PIN (6 Ziffern) oder Passwort" aria-label="PIN oder Passwort" value={pin} onChange={(event) => setPin(event.target.value)} />}
            <Button variant="primary" disabled={busy} onClick={() => void link()}>
              {state.exists ? 'Ersetzen und verknüpfen' : 'Verknüpfen'}
            </Button>
          </div>
        )}

        {state?.intent === 'login' && (
          <div className="space-y-3">
            {!state.exists ? (
              <p>Zu diesem {accountLabel(state.session.provider)}-Konto gehört noch kein Pass. Öffne deinen Pass zuerst auf einem Gerät, auf dem du ihn hast, und verknüpfe das Konto im Pass unter „Mit Konto anmelden“.</p>
            ) : (
              <>
                <p>Anmelden mit deinem <strong>{accountLabel(state.session.provider)}</strong>-Konto.</p>
                {state.pin && <input className={FIELD} inputMode="numeric" autoComplete="off" placeholder="PIN oder Passwort" aria-label="PIN oder Passwort" value={pin} onChange={(event) => setPin(event.target.value)} />}
                <Button variant="primary" disabled={busy} onClick={() => void open()}>
                  Pass öffnen
                </Button>
              </>
            )}
          </div>
        )}

        {state?.intent === 'unlink' && (
          <div className="space-y-3">
            {!state.exists ? (
              <p>Dieses {accountLabel(state.session.provider)}-Konto ist mit keinem Pass verknüpft.</p>
            ) : (
              <>
                <p>Die Verknüpfung mit deinem <strong>{accountLabel(state.session.provider)}</strong>-Konto lösen? Dein Pass bleibt erhalten; nur der Weg über das Konto fällt weg.</p>
                <Button variant="primary" disabled={busy} onClick={() => void unlink()}>
                  Verknüpfung lösen
                </Button>
              </>
            )}
          </div>
        )}

        {!busy && !state && !done && (
          <Button onClick={() => navigate(paths.pass)}>Zurück zum Pass</Button>
        )}
      </div>
    </TavernPage>
  );
}
