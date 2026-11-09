import { useEffect, useState } from 'react';
import { accountLabel, accountProviders, linkedAccounts, startAccount, type AccountIntent } from '../lib/accountLogin';
import { isPassError } from '../lib/playerPass';
import type { AccountProvider } from '@brett-und-blatt/ui/sync';
import { Button } from './controls';

/**
 * Konten verknüpfen (#154): Google oder Microsoft als weiterer Weg in den Pass. Der Bereich erscheint nur, wenn der
 * Spieleserver mindestens einen Anbieter eingerichtet hat. Hinweise zu Grenzen und Datenschutz stehen dabei.
 */
export function AccountPanel() {
  const [providers, setProviders] = useState<AccountProvider[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const linked = linkedAccounts();

  useEffect(() => {
    void accountProviders().then(setProviders);
  }, []);
  if (providers.length === 0) return null;

  const go = async (intent: AccountIntent, provider: AccountProvider) => {
    setBusy(true);
    setError(null);
    try {
      await startAccount(intent, provider);
    } catch (failure) {
      setError(isPassError(failure) ? failure.message : 'Die Anmeldung lässt sich gerade nicht starten.');
      setBusy(false);
    }
  };

  return (
    <section className="space-y-3 rounded-2xl border border-line bg-surface p-4" aria-labelledby="account-title">
      <h2 id="account-title" className="text-xl font-bold">
        🔗 Mit Konto anmelden
      </h2>
      <p className="text-sm text-muted">
        Du kannst ein Google- oder Microsoft-Konto (auch Schul- und Arbeitskonto) als weiteren Weg in deinen Pass verknüpfen. Das ist freiwillig. Unser Server speichert weder E-Mail-Adresse noch Namen, sondern nur einen Prüfwert.
      </p>
      <p className="text-sm text-muted">
        <strong>Nur Konto</strong> ist bequem, aber wer das Konto übernimmt oder der Betreiber des Servers könnte den Pass öffnen. <strong>Konto + PIN</strong> ist sicherer: Ohne deine PIN nützt das Konto allein nichts. Kinder unter 16 brauchen dafür das Einverständnis der Eltern.
      </p>
      <ul className="space-y-2">
        {providers.map((provider) => {
          const isLinked = linked.some((item) => item.provider === provider);
          return (
            <li key={provider} className="flex flex-wrap items-center gap-2 rounded-xl border border-line bg-bg p-3">
              <span className="min-w-0 flex-1 font-medium">
                {accountLabel(provider)} {isLinked ? <span className="text-sm text-muted">· verknüpft</span> : null}
              </span>
              <Button disabled={busy} onClick={() => void go('link', provider)}>
                {isLinked ? 'Neu verknüpfen' : 'Verknüpfen'}
              </Button>
              {isLinked && (
                <Button variant="ghost" disabled={busy} onClick={() => void go('unlink', provider)}>
                  Lösen
                </Button>
              )}
            </li>
          );
        })}
      </ul>
      <div className="space-y-2">
        <p className="text-sm font-medium">Neues Gerät? Mit Konto anmelden</p>
        <div className="flex flex-wrap gap-2">
          {providers.map((provider) => (
            <Button key={provider} disabled={busy} onClick={() => void go('login', provider)}>
              Mit {accountLabel(provider)} anmelden
            </Button>
          ))}
        </div>
      </div>
      {error && (
        <p className="text-sm text-danger" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
