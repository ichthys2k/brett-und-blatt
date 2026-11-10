import type { OrgKind, OrgRequestMine, OrgView } from '@brett-und-blatt/online';
import { serializeCrest } from '@brett-und-blatt/engine';
import { currentCrest, hasCrest } from './crestStore';
import { GAME_SERVER } from './server';
import { markOrgApplied } from './orgNotice';
import { storage } from './storage';

/*
 * Organisationen im Browser (#217, #228): Antrag stellen und den eigenen Stand erfahren. Die Kennung des Passes
 * (`storage.deviceToken()`) weist den Antragsteller aus; sie geht nie in eine Anzeige.
 */

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

/*
 * Meine Organisationen (Merkliste dieses Geräts) und Aktionen in einer Organisation (#229).
 */
const ORGS_KEY = 'brett-und-blatt:organisationen';
export interface KnownOrg {
  code: string;
  name: string;
}
export function loadOrgs(): KnownOrg[] {
  try {
    const list = JSON.parse(window.localStorage.getItem(ORGS_KEY) ?? '[]');
    return Array.isArray(list) ? list.filter((o): o is KnownOrg => typeof o?.code === 'string' && typeof o?.name === 'string').slice(0, 30) : [];
  } catch {
    return [];
  }
}
export function rememberOrg(entry: KnownOrg): void {
  const others = loadOrgs().filter((o) => o.code !== entry.code);
  try {
    window.localStorage.setItem(ORGS_KEY, JSON.stringify([entry, ...others].slice(0, 30)));
  } catch {
    // ohne Speicher gibt es keine Merkliste; die Mitgliedschaft bleibt auf dem Server
  }
}
export function forgetOrg(code: string): void {
  try {
    window.localStorage.setItem(ORGS_KEY, JSON.stringify(loadOrgs().filter((o) => o.code !== code)));
  } catch {
    // nichts zu tun
  }
}

export type OrgReply = { ok: true; view: OrgView; invite?: { id: string; code: string; expiresAt: number } } | { ok: false; status: number; error: string; view?: OrgView };

/** Eine Aktion in einer Organisation; `view` fragt nur den Stand ab. Beim Einlösen und Ändern geht das Profil mit. */
export async function orgAct(code: string, action: string, extra: Record<string, unknown> = {}): Promise<OrgReply> {
  if (!GAME_SERVER) return { ok: false, status: 0, error: 'Es gibt gerade keinen Spieleserver.' };
  try {
    const response = await fetch(`${GAME_SERVER}/org/${encodeURIComponent(code)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...(action === 'redeem' || action === 'update' ? identity() : { token: storage.deviceToken() }), ...extra, action }),
    });
    const data = (await response.json().catch(() => ({}))) as { view?: OrgView; invite?: { id: string; code: string; expiresAt: number }; error?: string };
    if (response.ok && data.view) return { ok: true, view: data.view, ...(data.invite ? { invite: data.invite } : {}) };
    if (response.ok) return { ok: false, status: 200, error: '' };
    return { ok: false, status: response.status, error: data.error === 'rate' ? 'Zu viele Versuche. Bitte später noch einmal.' : (data.error ?? 'Fehler'), ...(data.view ? { view: data.view } : {}) };
  } catch {
    return { ok: false, status: 0, error: 'Keine Verbindung zum Spieleserver.' };
  }
}
