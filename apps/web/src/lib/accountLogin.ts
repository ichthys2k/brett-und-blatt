import {
  ACCOUNT_PROVIDER_LABELS,
  accountSecrets,
  accountStatus,
  beginAccountLogin,
  linkAccount,
  loadAccountProviders,
  openAccountPass,
  resolveAccountTicket,
  unlinkAccount,
  type AccountProvider,
  type AccountSession,
} from '@brett-und-blatt/ui/sync';
import { passServer } from './playerPass';
import { storage } from './storage';

/*
 * Anmeldung mit Google oder Microsoft (#154), Browser-Seite. Die Logik steht in `@brett-und-blatt/ui/sync` (account.ts),
 * der Ablauf in `docs/spiele/konto-anmeldung.md`. Der Vorgang (was der Mensch wollte und das Geheimnis des Browsers)
 * liegt nur für die Dauer der Anmeldung im sessionStorage dieses Tabs.
 */

export type AccountIntent = 'link' | 'login' | 'unlink';
interface Pending {
  intent: AccountIntent;
  provider: AccountProvider;
  binding: string;
}

const KEY = 'brett-und-blatt:konto-vorgang';

function readPending(): Pending | null {
  try {
    const value = JSON.parse(window.sessionStorage.getItem(KEY) ?? 'null') as Pending | null;
    return value && typeof value.binding === 'string' && (value.provider === 'google' || value.provider === 'microsoft') ? value : null;
  } catch {
    return null;
  }
}

export function clearPendingAccount(): void {
  try {
    window.sessionStorage.removeItem(KEY);
  } catch {
    // ohne Speicher geht nichts verloren, was nicht neu angelegt werden könnte
  }
}

export const accountProviders = () => loadAccountProviders(passServer);
export const accountLabel = (provider: AccountProvider): string => ACCOUNT_PROVIDER_LABELS[provider];
export const linkedAccounts = () => storage.loadLinkedAccounts();

/** Schickt den Browser zum Anbieter. Kommt nur zurück, wenn es scheitert. */
export async function startAccount(intent: AccountIntent, provider: AccountProvider): Promise<void> {
  const { url, binding } = await beginAccountLogin(passServer, provider);
  window.sessionStorage.setItem(KEY, JSON.stringify({ intent, provider, binding } satisfies Pending));
  window.location.assign(url);
}

export interface ReturnedAccount {
  intent: AccountIntent;
  session: AccountSession;
  exists: boolean;
  pin: boolean;
}

/** Nach der Rückkehr vom Anbieter: Ticket auflösen und den Stand des Konto-Schlosses holen. `null`: kein Vorgang mehr da. */
export async function returnedAccount(ticket: string): Promise<ReturnedAccount | null> {
  const pending = readPending();
  if (!pending) return null;
  const session = await resolveAccountTicket(passServer, ticket, pending.binding);
  const status = await accountStatus(passServer, session);
  return { intent: pending.intent, session, ...status };
}

export const pinFor = (session: AccountSession, raw: string, rounds?: number) => accountSecrets(session, raw, rounds);
export const openWithAccount = (session: AccountSession, secrets?: Awaited<ReturnType<typeof accountSecrets>>) => openAccountPass(passServer, session, secrets);

export async function linkWithAccount(session: AccountSession, pass: Parameters<typeof linkAccount>[2], secrets?: Awaited<ReturnType<typeof accountSecrets>>): Promise<void> {
  await linkAccount(passServer, session, pass, secrets);
  const list = storage.loadLinkedAccounts().filter((item) => item.provider !== session.provider);
  storage.saveLinkedAccounts([...list, { provider: session.provider, at: Date.now() }]);
}

export async function unlinkWithAccount(session: AccountSession): Promise<void> {
  await unlinkAccount(passServer, session);
  storage.saveLinkedAccounts(storage.loadLinkedAccounts().filter((item) => item.provider !== session.provider));
}
