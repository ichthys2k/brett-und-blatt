import type { OrgKind, OrgRequestMine } from '@brett-und-blatt/online';
import { serializeCrest } from '@brett-und-blatt/engine';
import { currentCrest, hasCrest } from './crestStore';
import { GAME_SERVER } from './server';
import { storage } from './storage';

/*
 * Organisationen im Browser (#217, #228): Antrag stellen und den eigenen Stand erfahren. Die Kennung des Passes
 * (`storage.deviceToken()`) weist den Antragsteller aus; sie geht nie in eine Anzeige.
 */

/** Merkt, dass dieses Gerät einen Antrag gestellt hat; nur dann fragt die App nach dem Stand. */
const APPLIED_KEY = 'brett-und-blatt:org-antraege';
/** Entscheidungen, die die Person schon gesehen hat. */
const SEEN_KEY = 'brett-und-blatt:org-antraege-gesehen';

function readList(key: string): string[] {
  try {
    const list = JSON.parse(window.localStorage.getItem(key) ?? '[]');
    return Array.isArray(list) ? list.filter((x): x is string => typeof x === 'string').slice(0, 50) : [];
  } catch {
    return [];
  }
}
function writeList(key: string, list: string[]): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(list.slice(-50)));
  } catch {
    // ohne Speicher gibt es keinen Hinweis beim nächsten Öffnen; der Antrag bleibt auf dem Server
  }
}

export const hasAppliedForOrg = (): boolean => readList(APPLIED_KEY).length > 0;
export const markOrgApplied = (id: string): void => writeList(APPLIED_KEY, [...readList(APPLIED_KEY), id]);

/** Entschiedene Anträge, die die Person noch nicht gesehen hat. */
export function unseenOrgDecisions(requests: readonly OrgRequestMine[]): OrgRequestMine[] {
  const seen = new Set(readList(SEEN_KEY));
  return requests.filter((r) => r.status !== 'open' && !seen.has(r.id));
}
export const markOrgSeen = (ids: readonly string[]): void => writeList(SEEN_KEY, [...readList(SEEN_KEY), ...ids]);

function identity(): { token: string; name: string; avatar: string; crest?: string } {
  const profile = storage.loadProfile();
  return { token: storage.deviceToken(), name: profile?.name ?? '', avatar: profile?.avatar ?? '', ...(hasCrest() ? { crest: serializeCrest(currentCrest()) } : {}) };
}

async function callDesk(body: Record<string, unknown>): Promise<{ status: number; body: Record<string, unknown> }> {
  const response = await fetch(`${GAME_SERVER}/org-antrag`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  return { status: response.status, body: (await response.json().catch(() => ({}))) as Record<string, unknown> };
}

export async function submitOrgRequest(input: { orgName: string; kind: OrgKind; purpose: string }): Promise<{ id: string } | { error: string }> {
  if (!GAME_SERVER) return { error: 'Es gibt gerade keinen Spieleserver.' };
  try {
    const { status, body } = await callDesk({ action: 'submit', ...identity(), ...input });
    if (status === 201 && typeof body.id === 'string') {
      markOrgApplied(body.id);
      return { id: body.id };
    }
    if (status === 429) return { error: 'Zu viele Versuche. Bitte später noch einmal.' };
    return { error: typeof body.error === 'string' ? body.error : 'Das hat nicht geklappt. Bitte später noch einmal versuchen.' };
  } catch {
    return { error: 'Keine Verbindung zum Spieleserver.' };
  }
}

/** Die eigenen Anträge; leer ohne Server oder ohne Verbindung. */
export async function loadMyOrgRequests(): Promise<OrgRequestMine[]> {
  if (!GAME_SERVER) return [];
  try {
    const { status, body } = await callDesk({ action: 'status', token: storage.deviceToken() });
    return status === 200 && Array.isArray(body.requests) ? (body.requests as OrgRequestMine[]) : [];
  } catch {
    return [];
  }
}
