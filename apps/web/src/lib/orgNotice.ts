import type { OrgRequestMine } from '@brett-und-blatt/online';

/*
 * Merkliste für den Hinweis zu Anträgen auf Organisationen (#228). Bewusst ohne Abhängigkeit von Speicher, Server oder
 * Oberfläche, damit sie sich einzeln testen lässt.
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
