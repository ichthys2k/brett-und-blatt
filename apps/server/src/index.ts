import { DurableObject } from 'cloudflare:workers';
import { exchangeCode } from './oidc';
import {
  ATTEMPT_WINDOW_MS,
  FLOW_TTL_MS,
  TICKET_TTL_MS,
  ACCOUNT_PROVIDERS,
  accountLockId,
  buildAuthorizeUrl,
  createAccountLock,
  isAccountProvider,
  openAccountLock,
  randomToken,
  saveAccountLock,
  sha256Url,
  ticketValid,
  isPlausibleClientId,
  type AccountProvider,
  type AccountRecord,
  type FlowRecord,
  type TicketRecord,
  BACKUP_ID_PATTERN,
  BACKUP_TTL_MS,
  CLASS_TTL_MS,
  OpenRoomDirectory,
  Room,
  SERIES_CODE_PATTERN,
  SeriesBook,
  TOURNAMENT_CODE_PATTERN,
  Tournament,
  applyBackupPut,
  classView,
  configureClass,
  createClass,
  decide,
  enrollMember,
  isClassExpired,
  joinClass,
  leaveClass,
  mayDissolve,
  putCard,
  parseClassCode,
  randomClassCode,
  removeMember,
  setLead,
  updateMember,
  listingNeedsSync,
  parseRoomCode,
  parseTournamentMessage,
  parseTournamentSettings,
  parseFieldCount,
  applyTournamentMessage,
  parseEntrants,
  parseSeriesLink,
  parseSeed,
  parsePointRules,
  randomRoomCode,
  serverBotRunner,
  type ClassState,
  type MatchRoomConfig,
  type OpenRoomListing,
  type OpenRoomsMessage,
  type RoomDeps,
  type RoomReport,
  type RoomSnapshot,
  type SeriesEntry,
  type SeriesRecord,
  type SeriesView,
  type PointScheme,
  type ServerMessage,
  type StoredBackup,
  type TournamentServerMessage,
  type TournamentSettings,
  type PointRules,
  type StoredTournamentSnapshot,
  isBlocked,
  recordMiss,
  type AttemptState,
} from '@brett-und-blatt/online';
import {
  SHARE_ID_PATTERN,
  SHARE_TTL_MS,
  isExpired,
  mayRemoveShare,
  putShare,
  type ShareRecord,
  LOCK_ID_PATTERN,
  LOCK_TTL_MS,
  changeLock,
  createLock,
  mayRemoveLock,
  openLock,
  resetLock,
  saveLock,
  type LockOutcome,
  type LockRecord,
} from '@brett-und-blatt/online';
import { BOT_BUDGET_MS, BOT_STEP_MS } from './bots';
import { bibelQuizKatalog } from './bibelquiz';
import { wortspielKataloge } from './wortspiele';
import { onlineGames } from './games';
import { isOperator } from './operator';
import {
  answerOffer,
  decideRequest,
  emptyDesk,
  openRequests,
  requestsOf,
  setApproved,
  submitRequest,
  type OrgDeskState,
  configureOrg,
  createInvite,
  createOrg,
  isOrgExpired,
  leaveOrg,
  mayDissolveOrg,
  offerRoles,
  ORG_TTL_MS,
  ORG_KINDS,
  orgView,
  parseOrgCode,
  randomOrgCode,
  redeemInvite,
  removeOrgMember,
  revokeInvite,
  revokeRoles,
  rolesOf,
  orgCapabilities,
  isOrgRole,
  type OrgRole,
  updateOrgMember,
  type OrgState,
} from '@brett-und-blatt/online';

/**
 * Der Spieleserver auf Cloudflare – nur ein dünner Adapter: Die ganze Spiellogik
 * steckt in `packages/online` (Klasse `Room`) und in den Spielmodulen.
 *
 * - `POST /rooms` erstellt einen Raum und antwortet mit seinem Emoji-Code.
 * - `GET /rooms` bzw. `GET /rooms/open` liefert offene Spiele der letzten 60 Minuten;
 *   mit WebSocket-Upgrade kommt die Liste live (bei jeder Änderung neu).
 * - `GET /rooms/<code>` mit WebSocket-Upgrade betritt einen Raum.
 * - `POST /turniere` legt ein Turnier an, `GET /turniere/<Code>` mit WebSocket-Upgrade öffnet die Turnierseite.
 * - `GET /bibelquiz/fragen` liefert den Fragenkatalog des Bibel-Quiz (liegt nicht im Browser-Bundle).
 * - `GET /wortspiele/kategorien`, `/wer-bin-ich`, `/begriffe` liefern die Kataloge der Wortspiele.
 * - `GET`/`PUT /sicherung/<Kennung>` lädt bzw. schreibt eine im Browser verschlüsselte Sicherung
 *   (Narrenhof-Fortschritt). Der Server sieht nur Kennung und Datensalat.
 *
 * Jeder Raum ist ein eigenes Durable Object (ein kleiner Server mit Speicher),
 * angelegt in der EU.
 */

interface Env {
  ROOMS: DurableObjectNamespace<GameRoom>;
  LOBBY_REGISTRY: DurableObjectNamespace<LobbyRegistry>;
  BACKUPS: DurableObjectNamespace<BackupVault>;
  ATTEMPTS: DurableObjectNamespace<AttemptLimiter>;
  PASS_LOCKS: DurableObjectNamespace<PassLock>;
  SHARES: DurableObjectNamespace<PassShare>;
  CLASSES: DurableObjectNamespace<ClassRoom>;
  SERIES: DurableObjectNamespace<SeriesRoom>;
  ORGS: DurableObjectNamespace<OrgRoom>;
  ORG_DESK: DurableObjectNamespace<OrgDesk>;
  ACCOUNT_FLOWS: DurableObjectNamespace<AccountFlow>;
  ACCOUNT_LOCKS: DurableObjectNamespace<AccountLockBox>;
  /** Anmeldung mit Google (`wrangler secret put GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`). Fehlen sie, ist der Anbieter nicht eingerichtet. */
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  /** Anmeldung mit Microsoft (`MS_CLIENT_ID`/`MS_CLIENT_SECRET`). */
  MS_CLIENT_ID?: string;
  MS_CLIENT_SECRET?: string;
  /** Geheimer Pfeffer für die Schlösser der Ausweise (`wrangler secret put PASS_PEPPER`, lokal in `.dev.vars`). Fehlt er, melden die Schloss-Endpunkte 503. */
  PASS_PEPPER?: string;
  /** Betreiber-Schlüssel (`wrangler secret put OPERATOR_KEY`): löscht per `DELETE /betreiber/…` Turniere und Klassen. Fehlt er, gibt es die Endpunkte nicht. */
  OPERATOR_KEY?: string;
  TOURNAMENTS: DurableObjectNamespace<TournamentRoom>;
  ALLOWED_ORIGINS: string;
  /** "eu" im echten Betrieb. Nur der lokale Testserver kennt keine Jurisdiktionen und setzt "none". */
  ROOM_JURISDICTION: string;
}

/** Was an jeder WebSocket-Verbindung hängt und auch das Schlafen des Raums übersteht. */
interface Attachment {
  id: string;
  memberId: string | null;
}

const gamesById = new Map(onlineGames.map((m) => [m.info.id, m]));
const botRunner = serverBotRunner(onlineGames, { stepMs: BOT_STEP_MS });

function randomInt(n: number): number {
  return crypto.getRandomValues(new Uint32Array(1))[0]! % n;
}

function randomSeed(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, '0')).join('');
}

function roomStub(env: Env, code: string): DurableObjectStub<GameRoom> {
  // Kein stilles Ausweichen: Ohne ausdrückliches "none" werden Räume immer in der EU angelegt.
  const namespace = env.ROOM_JURISDICTION === 'none' ? env.ROOMS : env.ROOMS.jurisdiction('eu');
  return namespace.get(namespace.idFromName(code));
}

function registryStub(env: Env): DurableObjectStub<LobbyRegistry> {
  const namespace = env.ROOM_JURISDICTION === 'none' ? env.LOBBY_REGISTRY : env.LOBBY_REGISTRY.jurisdiction('eu');
  return namespace.get(namespace.idFromName('global'));
}

function backupStub(env: Env, id: string): DurableObjectStub<BackupVault> {
  const namespace = env.ROOM_JURISDICTION === 'none' ? env.BACKUPS : env.BACKUPS.jurisdiction('eu');
  return namespace.get(namespace.idFromName(id));
}

function lockStub(env: Env, id: string): DurableObjectStub<PassLock> {
  const namespace = env.ROOM_JURISDICTION === 'none' ? env.PASS_LOCKS : env.PASS_LOCKS.jurisdiction('eu');
  return namespace.get(namespace.idFromName(id));
}

function shareStub(env: Env, id: string): DurableObjectStub<PassShare> {
  const namespace = env.ROOM_JURISDICTION === 'none' ? env.SHARES : env.SHARES.jurisdiction('eu');
  return namespace.get(namespace.idFromName(id));
}

function classStub(env: Env, code: string): DurableObjectStub<ClassRoom> {
  const namespace = env.ROOM_JURISDICTION === 'none' ? env.CLASSES : env.CLASSES.jurisdiction('eu');
  return namespace.get(namespace.idFromName(code));
}

/** Rollen eines Geräts in einer Organisation; bei Fehlern keine (lieber zu wenig Recht als zu viel). */
async function orgRolesOf(env: Env, orgCode: string, token: string): Promise<OrgRole[]> {
  try {
    const parsed = JSON.parse(await orgStub(env, orgCode).rolesOf(token)) as unknown;
    return Array.isArray(parsed) ? parsed.filter(isOrgRole) : [];
  } catch (err) {
    console.error('Organisation nicht erreichbar:', err);
    return [];
  }
}

function orgDeskStub(env: Env): DurableObjectStub<OrgDesk> {
  const namespace = env.ROOM_JURISDICTION === 'none' ? env.ORG_DESK : env.ORG_DESK.jurisdiction('eu');
  return namespace.get(namespace.idFromName('antraege'));
}

function orgStub(env: Env, code: string): DurableObjectStub<OrgRoom> {
  const namespace = env.ROOM_JURISDICTION === 'none' ? env.ORGS : env.ORGS.jurisdiction('eu');
  return namespace.get(namespace.idFromName(code));
}

function seriesStub(env: Env, code: string): DurableObjectStub<SeriesRoom> {
  const namespace = env.ROOM_JURISDICTION === 'none' ? env.SERIES : env.SERIES.jurisdiction('eu');
  return namespace.get(namespace.idFromName(code));
}

function flowStub(env: Env, name: string): DurableObjectStub<AccountFlow> {
  const namespace = env.ROOM_JURISDICTION === 'none' ? env.ACCOUNT_FLOWS : env.ACCOUNT_FLOWS.jurisdiction('eu');
  return namespace.get(namespace.idFromName(name));
}

function accountLockStub(env: Env, id: string): DurableObjectStub<AccountLockBox> {
  const namespace = env.ROOM_JURISDICTION === 'none' ? env.ACCOUNT_LOCKS : env.ACCOUNT_LOCKS.jurisdiction('eu');
  return namespace.get(namespace.idFromName(id));
}

/** Zugangsdaten des Anbieters aus den Secrets; null, wenn er nicht eingerichtet ist. */
function providerCredentials(env: Env, provider: AccountProvider): { clientId: string; clientSecret: string } | null {
  const [rawId, rawSecret] = provider === 'google' ? [env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET] : [env.MS_CLIENT_ID, env.MS_CLIENT_SECRET];
  const clientId = rawId?.trim();
  const clientSecret = rawSecret?.trim();
  if (!clientId || !clientSecret) return null;
  // Sicherung gegen vertauschte Werte: Ein Geheimnis in der ID-Zeile würde sonst in der Adresse an den Anbieter gehen.
  return isPlausibleClientId(provider, clientId) ? { clientId, clientSecret } : null;
}

function attemptStub(env: Env, sender: string): DurableObjectStub<AttemptLimiter> {
  const namespace = env.ROOM_JURISDICTION === 'none' ? env.ATTEMPTS : env.ATTEMPTS.jurisdiction('eu');
  return namespace.get(namespace.idFromName(sender));
}

function tournamentStub(env: Env, code: string): DurableObjectStub<TournamentRoom> {
  const namespace = env.ROOM_JURISDICTION === 'none' ? env.TOURNAMENTS : env.TOURNAMENTS.jurisdiction('eu');
  return namespace.get(namespace.idFromName(code));
}

/** Zeichen ohne 0, 1, I und O, wie bei den Sicherungscodes. */
const CODE_LETTERS = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

function randomLetters(length: number): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(length)), (b) => CODE_LETTERS[b & 31]).join('');
}

function corsHeaders(request: Request, env: Env): Record<string, string> {
  const origin = request.headers.get('Origin') ?? '';
  const allowed = env.ALLOWED_ORIGINS.split(',').map((o) => o.trim());
  return allowed.includes(origin)
    ? {
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        Vary: 'Origin',
      }
    : {};
}

/** Nur die eigene Web-App darf Räume anlegen und betreten. */
function originAllowed(request: Request, env: Env): boolean {
  const origin = request.headers.get('Origin');
  return origin !== null && env.ALLOWED_ORIGINS.split(',').map((o) => o.trim()).includes(origin);
}

/** Liest einen kleinen JSON-Körper; null bei Fehlern oder zu großer Länge. */
async function readJson(request: Request, maxLength: number): Promise<Record<string, unknown> | null> {
  try {
    const text = await request.text();
    if (text.length > maxLength) return null;
    const body = JSON.parse(text) as unknown;
    return typeof body === 'object' && body !== null && !Array.isArray(body) ? (body as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/** Kurzform einer Geräte-Kennung: erkennt dieselbe Person über Turniere hinweg, verrät die Kennung nicht. */
async function personKey(token: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${token}/serie`));
  return Array.from(new Uint8Array(digest).slice(0, 8), (b) => b.toString(16).padStart(2, '0')).join('');
}

function json(data: unknown, status: number, headers: Record<string, string>): Response {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', ...headers } });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const cors = corsHeaders(request, env);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });

    if (url.pathname === '/rooms' && request.method === 'POST') {
      if (!originAllowed(request, env)) return json({ error: 'origin' }, 403, cors);
      let isPublic = true;
      try {
        const body = (await request.json()) as { isPublic?: boolean };
        if (typeof body?.isPublic === 'boolean') isPublic = body.isPublic;
      } catch {
        // Leerer Body: Standard beibehalten
      }
      // Ein freier Code ist fast immer der erste; zur Sicherheit ein paar Versuche.
      for (let attempt = 0; attempt < 5; attempt++) {
        const code = randomRoomCode(randomInt);
        if (await roomStub(env, code).create(code, isPublic)) return json({ code }, 201, cors);
      }
      return json({ error: 'busy' }, 503, cors);
    }

    if ((url.pathname === '/rooms' || url.pathname === '/rooms/open') && request.method === 'GET') {
      if (request.headers.get('Upgrade') === 'websocket') {
        if (!originAllowed(request, env)) return new Response('Origin nicht erlaubt', { status: 403 });
        return registryStub(env).fetch(request);
      }
      if (!originAllowed(request, env)) return json({ error: 'origin' }, 403, cors);
      const rooms = await registryStub(env).listOpen();
      return json(rooms, 200, cors);
    }

    if (url.pathname === '/bibelquiz/fragen' && request.method === 'GET') {
      if (!originAllowed(request, env)) return json({ error: 'origin' }, 403, cors);
      // Die Fragen ändern sich selten; fünf Minuten frisch genügt und spart Anfragen.
      return json(bibelQuizKatalog, 200, { ...cors, 'Cache-Control': 'public, max-age=300' });
    }

    const wortspiel = wortspielKataloge[url.pathname];
    if (wortspiel !== undefined && request.method === 'GET') {
      if (!originAllowed(request, env)) return json({ error: 'origin' }, 403, cors);
      return json(wortspiel, 200, { ...cors, 'Cache-Control': 'public, max-age=300' });
    }

    // Anträge auf Organisationen (#228): Antragsteller stellen und fragen ab, der Betreiber entscheidet und sperrt.
    if (url.pathname === '/org-antrag' && request.method === 'POST') {
      if (!originAllowed(request, env)) return json({ error: 'origin' }, 403, cors);
      const noStore = { ...cors, 'Cache-Control': 'no-store' };
      let body: Record<string, unknown>;
      try {
        const text = await request.text();
        if (text.length > 4000) return json({ error: 'size' }, 413, noStore);
        body = JSON.parse(text) as Record<string, unknown>;
      } catch {
        return json({ error: 'body' }, 400, noStore);
      }
      const limiter = attemptStub(env, request.headers.get('CF-Connecting-IP') ?? 'unbekannt');
      if (await limiter.blocked()) return json({ error: 'rate' }, 429, { ...noStore, 'Retry-After': String(ATTEMPT_WINDOW_MS / 1000) });
      if (body.action === 'status') return json({ requests: JSON.parse(await orgDeskStub(env).mine(String(body.token ?? ''))) as unknown }, 200, noStore);
      if (body.action !== 'submit') return json({ error: 'action' }, 400, noStore);
      const result = JSON.parse(await orgDeskStub(env).submit(JSON.stringify(body))) as { error?: string; id?: string };
      if (result.error) {
        await limiter.miss();
        return json({ error: result.error }, 409, noStore);
      }
      return json({ id: result.id }, 201, noStore);
    }

    const operatorDesk = /^\/betreiber\/(antraege|antrag\/([0-9a-f]{12})|org-sperre\/([^/]+))$/.exec(url.pathname);
    if (operatorDesk) {
      const noStore = { ...cors, 'Cache-Control': 'no-store' };
      if (!env.OPERATOR_KEY) return json({ error: 'aus' }, 404, cors);
      const limiter = attemptStub(env, request.headers.get('CF-Connecting-IP') ?? 'unbekannt');
      if (await limiter.blocked()) return json({ error: 'rate' }, 429, { ...noStore, 'Retry-After': String(ATTEMPT_WINDOW_MS / 1000) });
      const wanted = operatorDesk[1] === 'antraege' ? 'GET' : 'POST';
      if (request.method !== wanted) return json({ error: 'method' }, 405, cors);
      if (!(await isOperator(request, env.OPERATOR_KEY))) {
        await limiter.miss();
        return json({ error: 'nicht erlaubt' }, 401, noStore);
      }
      if (operatorDesk[1] === 'antraege') return json({ antraege: JSON.parse(await orgDeskStub(env).list()) as unknown }, 200, noStore);
      let body: Record<string, unknown> = {};
      try {
        const text = await request.text();
        if (text.length > 4000) return json({ error: 'size' }, 413, noStore);
        if (text) body = JSON.parse(text) as Record<string, unknown>;
      } catch {
        return json({ error: 'body' }, 400, noStore);
      }
      if (operatorDesk[3]) {
        const code = parseOrgCode(decodeURIComponent(operatorDesk[3]));
        if (!code || typeof body.blocked !== 'boolean') return json({ error: 'code' }, 400, noStore);
        const done = await orgStub(env, code).setBlocked(body.blocked);
        console.log(JSON.stringify({ betreiber: 'org-sperre', ziel: code, gesperrt: body.blocked, am: new Date().toISOString(), ok: done }));
        return json({ ok: done }, done ? 200 : 404, noStore);
      }
      const id = operatorDesk[2]!;
      const approve = body.approve === true;
      const decided = JSON.parse(await orgDeskStub(env).decide(id, approve, body.note ?? '')) as { error?: string; request?: { token: string; name: string; avatar: string; crest?: string; orgName: string; kind: string } };
      if (decided.error || !decided.request) return json({ error: decided.error ?? 'missing' }, 409, noStore);
      if (!approve) return json({ ok: true }, 200, noStore);
      const req = decided.request;
      for (let attempt = 0; attempt < 8; attempt++) {
        const code = randomOrgCode((n) => crypto.getRandomValues(new Uint32Array(1))[0]! % n);
        const created = await orgStub(env, code).create(code, JSON.stringify({ name: req.orgName, kind: req.kind, founder: { token: req.token, name: req.name, avatar: req.avatar, crest: req.crest } }));
        if (created === 'taken') continue;
        if (created !== 'ok') return json({ error: created }, 400, noStore);
        await orgDeskStub(env).approved(id, code);
        console.log(JSON.stringify({ betreiber: 'org-freigabe', antrag: id, am: new Date().toISOString() }));
        return json({ ok: true, code }, 200, noStore);
      }
      return json({ error: 'busy' }, 503, noStore);
    }

    // Betreiber-Endpunkte (Schlüssel `OPERATOR_KEY`): Liste der offenen Turniere und Löschen von Turnieren und Klassen.
    const operator = /^\/betreiber\/(turnier|klasse|serie|org|liste)(?:\/([^/]+))?$/.exec(url.pathname);
    if (operator) {
      if (!env.OPERATOR_KEY) return json({ error: 'aus' }, 404, cors);
      const wanted = operator[1] === 'liste' ? 'GET' : 'DELETE';
      if (request.method !== wanted) return json({ error: 'method' }, 405, cors);
      const limiter = attemptStub(env, request.headers.get('CF-Connecting-IP') ?? 'unbekannt');
      if (await limiter.blocked()) return json({ error: 'rate' }, 429, { ...cors, 'Retry-After': String(ATTEMPT_WINDOW_MS / 1000) });
      if (!(await isOperator(request, env.OPERATOR_KEY))) {
        await limiter.miss();
        return json({ error: 'nicht erlaubt' }, 401, cors);
      }
      if (operator[1] === 'liste') {
        const rooms = await registryStub(env).listOpen();
        return json({ turniere: rooms.filter((room) => room.tournament) }, 200, { ...cors, 'Cache-Control': 'no-store' });
      }
      if (!operator[2]) return json({ error: 'code' }, 400, cors);
      const target = decodeURIComponent(operator[2]);
      let done = false;
      if (operator[1] === 'turnier') {
        if (!TOURNAMENT_CODE_PATTERN.test(target)) return json({ error: 'code' }, 400, cors);
        done = await tournamentStub(env, target).operatorDelete();
      } else if (operator[1] === 'org') {
        const code = parseOrgCode(target);
        if (!code) return json({ error: 'code' }, 400, cors);
        done = await orgStub(env, code).operatorDelete();
      } else if (operator[1] === 'serie') {
        if (!SERIES_CODE_PATTERN.test(target)) return json({ error: 'code' }, 400, cors);
        done = await seriesStub(env, target).operatorDelete();
      } else {
        const code = parseClassCode(target);
        if (!code) return json({ error: 'code' }, 400, cors);
        done = await classStub(env, code).operatorDissolve();
      }
      // Ohne den Schlüssel: Spur im Protokoll, was wann gelöscht wurde.
      console.log(JSON.stringify({ betreiber: operator[1], ziel: target, am: new Date().toISOString(), geloescht: done }));
      return json({ ok: done }, done ? 200 : 404, { ...cors, 'Cache-Control': 'no-store' });
    }

    if (url.pathname === '/turniere' && request.method === 'POST') {
      if (!originAllowed(request, env)) return json({ error: 'origin' }, 403, cors);
      let body: { settings?: unknown; token?: unknown; name?: unknown; entrants?: unknown; seed?: unknown };
      try {
        const text = await request.text();
        if (text.length > 12_000) return json({ error: 'size' }, 413, cors);
        body = JSON.parse(text) as typeof body;
      } catch {
        return json({ error: 'body' }, 400, cors);
      }
      const settings = parseTournamentSettings(body.settings, (id) => gamesById.get(id));
      if (!settings || typeof body.token !== 'string' || body.token.length < 16 || body.token.length > 100 || typeof body.name !== 'string') return json({ error: 'body' }, 400, cors);
      // Ein Turnier unter dem Namen einer Organisation (#230) darf nur anlegen, wer dort das Recht dazu hat.
      if (settings.org) {
        const roles = await orgRolesOf(env, settings.org, body.token);
        if (!orgCapabilities(roles).includes('createTournament')) return json({ error: 'Du darfst in dieser Gruppe keine Turniere anlegen.' }, 403, cors);
      }
      for (let attempt = 0; attempt < 5; attempt++) {
        const code = randomLetters(8);
        if (await tournamentStub(env, code).create(code, settings, { token: body.token, name: body.name }, parseFieldCount(body.settings), parsePointRules(body.settings), parseEntrants(body.entrants), settings.mode === 'local' ? parseSeed(body.seed) : undefined)) return json({ code }, 201, cors);
      }
      return json({ error: 'busy' }, 503, cors);
    }

    const tournament = /^\/turniere\/([^/]+)$/.exec(url.pathname);
    if (tournament && request.method === 'GET') {
      const code = tournament[1]!;
      if (!TOURNAMENT_CODE_PATTERN.test(code)) return json({ error: 'code' }, 404, cors);
      if (!originAllowed(request, env)) return new Response('Origin nicht erlaubt', { status: 403 });
      if (request.headers.get('Upgrade') !== 'websocket') return json({ exists: await tournamentStub(env, code).exists() }, 200, cors);
      return tournamentStub(env, code).fetch(request);
    }

    // Serien (#205): `POST /serien` legt eine an, `GET`/`POST`/`DELETE /serien/<Code>` zeigen und verwalten sie (Kennung der Leitung als `Authorization: Bearer`).
    if (url.pathname === '/serien' && request.method === 'POST') {
      if (!originAllowed(request, env)) return json({ error: 'origin' }, 403, cors);
      const body = await readJson(request, 2_000);
      if (!body || typeof body.name !== 'string' || typeof body.token !== 'string' || (body.scheme !== 'linear' && body.scheme !== 'f1')) return json({ error: 'body' }, 400, cors);
      for (let attempt = 0; attempt < 5; attempt++) {
        const code = randomLetters(8);
        const error = await seriesStub(env, code).create(code, body.name, body.scheme, body.token);
        if (error === null) return json({ code }, 201, cors);
        if (error !== 'belegt') return json({ error }, 400, cors);
      }
      return json({ error: 'busy' }, 503, cors);
    }

    const series = /^\/serien\/([^/]+)$/.exec(url.pathname);
    if (series) {
      if (!originAllowed(request, env)) return json({ error: 'origin' }, 403, cors);
      const code = series[1]!.toUpperCase();
      if (!SERIES_CODE_PATTERN.test(code)) return json({ error: 'code' }, 404, cors);
      const noStore = { ...cors, 'Cache-Control': 'no-store' };
      const bearer = /^Bearer (.{16,100})$/.exec(request.headers.get('Authorization') ?? '')?.[1] ?? null;
      const stub = seriesStub(env, code);
      if (request.method === 'GET') {
        const view = await stub.view(bearer);
        return view ? json(view, 200, noStore) : json({ error: 'missing' }, 404, noStore);
      }
      if (!bearer) return json({ error: 'token' }, 401, noStore);
      if (request.method === 'DELETE') {
        const error = await stub.deleteByLeader(bearer);
        return error ? json({ error }, 403, noStore) : json({ ok: true }, 200, noStore);
      }
      if (request.method === 'POST') {
        const body = await readJson(request, 2_000);
        if (!body || typeof body.action !== 'string') return json({ error: 'body' }, 400, noStore);
        if (body.action === 'transfer') {
          const issued = await stub.issueTransfer(bearer);
          return 'error' in issued ? json({ error: issued.error }, 400, noStore) : json(issued, 200, noStore);
        }
        if (body.action === 'take') {
          // Fehlversuche je Absender zählen, damit sich der Code nicht durchprobieren lässt.
          const limiter = attemptStub(env, request.headers.get('CF-Connecting-IP') ?? 'unbekannt');
          if (await limiter.blocked()) return json({ error: 'rate' }, 429, { ...noStore, 'Retry-After': String(ATTEMPT_WINDOW_MS / 1000) });
          const failure = await stub.takeLeadership(bearer, typeof body.code === 'string' ? body.code.slice(0, 20) : '');
          if (failure) {
            await limiter.miss();
            return json({ error: failure }, 400, noStore);
          }
          return json({ ok: true }, 200, noStore);
        }
        const error = await stub.manage(bearer, { action: body.action, name: typeof body.name === 'string' ? body.name : undefined, scheme: body.scheme === 'linear' || body.scheme === 'f1' ? body.scheme : undefined, tournament: typeof body.tournament === 'string' ? body.tournament : undefined });
        return error ? json({ error }, 400, noStore) : json({ ok: true }, 200, noStore);
      }
      return json({ error: 'method' }, 405, cors);
    }

    const backup = /^\/sicherung\/([^/]+)$/.exec(url.pathname);
    if (backup) {
      if (!originAllowed(request, env)) return json({ error: 'origin' }, 403, cors);
      const id = backup[1]!;
      if (!BACKUP_ID_PATTERN.test(id)) return json({ error: 'id' }, 404, cors);
      const noStore = { ...cors, 'Cache-Control': 'no-store' };
      if (request.method === 'GET') {
        // Fehlversuche je Absender zählen: Spielercodes sind kurz und dürfen nicht durchprobiert werden.
        const limiter = attemptStub(env, request.headers.get('CF-Connecting-IP') ?? 'unbekannt');
        if (await limiter.blocked()) return json({ error: 'rate' }, 429, { ...noStore, 'Retry-After': String(ATTEMPT_WINDOW_MS / 1000) });
        const stored = await backupStub(env, id).load();
        if (!stored) {
          await limiter.miss();
          return json({ error: 'missing' }, 404, noStore);
        }
        return json({ data: stored.data, rev: stored.rev }, 200, noStore);
      }
      if (request.method === 'PUT') {
        const length = Number(request.headers.get('Content-Length') ?? 0);
        if (length > 80 * 1024) return json({ error: 'size' }, 413, noStore);
        let body: unknown;
        try {
          const text = await request.text();
          if (text.length > 80 * 1024) return json({ error: 'size' }, 413, noStore);
          body = JSON.parse(text);
        } catch {
          return json({ error: 'body' }, 400, noStore);
        }
        const result = await backupStub(env, id).save(body);
        if (result.status === 200) return json({ rev: result.stored.rev }, 200, noStore);
        if (result.status === 409) return json(result.current ? { data: result.current.data, rev: result.current.rev } : { rev: 0 }, 409, noStore);
        return json({ error: result.error }, 400, noStore);
      }
      return json({ error: 'method' }, 405, cors);
    }

    if (url.pathname === '/klassen' && request.method === 'POST') {
      if (!originAllowed(request, env)) return json({ error: 'origin' }, 403, cors);
      let body: Record<string, unknown>;
      try {
        const text = await request.text();
        if (text.length > 4000) return json({ error: 'size' }, 413, cors);
        body = JSON.parse(text) as Record<string, unknown>;
      } catch {
        return json({ error: 'body' }, 400, cors);
      }
      for (let attempt = 0; attempt < 8; attempt++) {
        const code = randomClassCode((n) => crypto.getRandomValues(new Uint32Array(1))[0]! % n);
        const created = await classStub(env, code).create(code, JSON.stringify(body));
        if (created === 'taken') continue;
        if (created !== 'ok') return json({ error: created }, 400, { ...cors, 'Cache-Control': 'no-store' });
        return json({ code }, 201, { ...cors, 'Cache-Control': 'no-store' });
      }
      return json({ error: 'busy' }, 503, cors);
    }

    const klasse = /^\/klassen\/([^/]+)$/.exec(url.pathname);
    if (klasse) {
      if (!originAllowed(request, env)) return json({ error: 'origin' }, 403, cors);
      if (request.method !== 'POST') return json({ error: 'method' }, 405, cors);
      const noStore = { ...cors, 'Cache-Control': 'no-store' };
      const code = parseClassCode(decodeURIComponent(klasse[1]!));
      if (!code) return json({ error: 'code' }, 404, noStore);
      let body: Record<string, unknown>;
      try {
        const text = await request.text();
        if (text.length > 4000) return json({ error: 'size' }, 413, noStore);
        body = JSON.parse(text) as Record<string, unknown>;
      } catch {
        return json({ error: 'body' }, 400, noStore);
      }
      // Ein Klassencode hat 16,7 Millionen Möglichkeiten; dennoch zählen Fehlversuche je Absender wie beim Spielercode.
      const limiter = attemptStub(env, request.headers.get('CF-Connecting-IP') ?? 'unbekannt');
      if (await limiter.blocked()) return json({ error: 'rate' }, 429, { ...noStore, 'Retry-After': String(ATTEMPT_WINDOW_MS / 1000) });
      const result = await classStub(env, code).act(JSON.stringify(body));
      if (result.status === 404) await limiter.miss();
      return json(JSON.parse(result.body) as Record<string, unknown>, result.status, noStore);
    }

    // Organisationen (#217): Anlegen nur mit dem Betreiber-Schlüssel, bis Antrag und Freigabe (#228) folgen.
    if (url.pathname === '/org' && request.method === 'POST') {
      if (!originAllowed(request, env)) return json({ error: 'origin' }, 403, cors);
      const noStore = { ...cors, 'Cache-Control': 'no-store' };
      if (!env.OPERATOR_KEY) return json({ error: 'aus' }, 404, cors);
      const limiter = attemptStub(env, request.headers.get('CF-Connecting-IP') ?? 'unbekannt');
      if (await limiter.blocked()) return json({ error: 'rate' }, 429, { ...noStore, 'Retry-After': String(ATTEMPT_WINDOW_MS / 1000) });
      if (!(await isOperator(request, env.OPERATOR_KEY))) {
        await limiter.miss();
        return json({ error: 'nicht erlaubt' }, 401, noStore);
      }
      let body: Record<string, unknown>;
      try {
        const text = await request.text();
        if (text.length > 4000) return json({ error: 'size' }, 413, noStore);
        body = JSON.parse(text) as Record<string, unknown>;
      } catch {
        return json({ error: 'body' }, 400, noStore);
      }
      for (let attempt = 0; attempt < 8; attempt++) {
        const code = randomOrgCode((n) => crypto.getRandomValues(new Uint32Array(1))[0]! % n);
        const created = await orgStub(env, code).create(code, JSON.stringify(body));
        if (created === 'taken') continue;
        if (created !== 'ok') return json({ error: created }, 400, noStore);
        return json({ code }, 201, noStore);
      }
      return json({ error: 'busy' }, 503, noStore);
    }

    const org = /^\/org\/([^/]+)$/.exec(url.pathname);
    if (org) {
      if (!originAllowed(request, env)) return json({ error: 'origin' }, 403, cors);
      if (request.method !== 'POST') return json({ error: 'method' }, 405, cors);
      const noStore = { ...cors, 'Cache-Control': 'no-store' };
      const code = parseOrgCode(decodeURIComponent(org[1]!));
      if (!code) return json({ error: 'code' }, 404, noStore);
      let body: Record<string, unknown>;
      try {
        const text = await request.text();
        if (text.length > 4000) return json({ error: 'size' }, 413, noStore);
        body = JSON.parse(text) as Record<string, unknown>;
      } catch {
        return json({ error: 'body' }, 400, noStore);
      }
      const limiter = attemptStub(env, request.headers.get('CF-Connecting-IP') ?? 'unbekannt');
      if (await limiter.blocked()) return json({ error: 'rate' }, 429, { ...noStore, 'Retry-After': String(ATTEMPT_WINDOW_MS / 1000) });
      const result = await orgStub(env, code).act(JSON.stringify(body));
      if (result.status === 404) await limiter.miss();
      return json(JSON.parse(result.body) as Record<string, unknown>, result.status, noStore);
    }

    const share = /^\/teilen\/([^/]+)(?:\/(loeschen))?$/.exec(url.pathname);
    if (share) {
      if (!originAllowed(request, env)) return json({ error: 'origin' }, 403, cors);
      const id = share[1]!;
      if (!SHARE_ID_PATTERN.test(id)) return json({ error: 'id' }, 404, cors);
      const noStore = { ...cors, 'Cache-Control': 'no-store' };
      const stub = shareStub(env, id);
      if (request.method === 'GET' && !share[2]) {
        // Lesen ist für alle mit dem Link möglich; Anfragen an nicht vorhandene Schnappschüsse zählen je Absender wie bei Sicherungen.
        const limiter = attemptStub(env, request.headers.get('CF-Connecting-IP') ?? 'unbekannt');
        if (await limiter.blocked()) return json({ error: 'rate' }, 429, { ...noStore, 'Retry-After': String(ATTEMPT_WINDOW_MS / 1000) });
        const data = await stub.read();
        if (data === null) {
          await limiter.miss();
          return json({ error: 'missing' }, 404, noStore);
        }
        return json({ data }, 200, noStore);
      }
      if (request.method !== 'PUT' && request.method !== 'POST') return json({ error: 'method' }, 405, cors);
      let body: unknown;
      try {
        const text = await request.text();
        if (text.length > 64 * 1024) return json({ error: 'size' }, 413, noStore);
        body = JSON.parse(text);
      } catch {
        return json({ error: 'body' }, 400, noStore);
      }
      const status = share[2] ? (request.method === 'POST' ? await stub.remove(body) : 405) : request.method === 'PUT' ? await stub.write(body) : 405;
      return json({}, status, noStore);
    }

    // Anmeldung mit Google oder Microsoft (#154): welche Anbieter sind eingerichtet?
    if (url.pathname === '/konto' && request.method === 'GET') {
      if (!originAllowed(request, env)) return json({ error: 'origin' }, 403, cors);
      const providers = ACCOUNT_PROVIDERS.filter((p) => providerCredentials(env, p) && env.PASS_PEPPER);
      return json({ providers }, 200, { ...cors, 'Cache-Control': 'no-store' });
    }

    const accountFlow = /^\/konto\/([a-z]+)\/(start|rueckruf)$/.exec(url.pathname);
    if (accountFlow) {
      const provider = accountFlow[1];
      if (!isAccountProvider(provider)) return json({ error: 'provider' }, 404, cors);
      const credentials = providerCredentials(env, provider);
      const redirectUri = `${url.origin}/konto/${provider}/rueckruf`;
      if (accountFlow[2] === 'start') {
        if (request.method !== 'POST') return json({ error: 'method' }, 405, cors);
        if (!originAllowed(request, env)) return json({ error: 'origin' }, 403, cors);
        if (!credentials || !env.PASS_PEPPER) return json({ error: 'not-configured' }, 503, { ...cors, 'Cache-Control': 'no-store' });
        const limiter = attemptStub(env, request.headers.get('CF-Connecting-IP') ?? 'unbekannt');
        if (await limiter.blocked()) return json({ error: 'rate' }, 429, { ...cors, 'Retry-After': String(ATTEMPT_WINDOW_MS / 1000) });
        const body = await readJson(request, 1024);
        const binding = body?.binding;
        if (typeof binding !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(binding)) return json({ error: 'binding' }, 400, cors);
        const state = randomToken(24);
        const verifier = randomToken(48);
        const nonce = randomToken(24);
        const flow: FlowRecord = { provider, verifier, nonce, binding, returnTo: request.headers.get('Origin')!, at: Date.now() };
        await flowStub(env, `flow:${state}`).put(JSON.stringify(flow), FLOW_TTL_MS);
        const authorize = buildAuthorizeUrl({ provider, clientId: credentials.clientId, redirectUri, state, nonce, challenge: await sha256Url(verifier) });
        return json({ url: authorize }, 200, { ...cors, 'Cache-Control': 'no-store' });
      }
      // Rückkehr vom Anbieter (Weiterleitung des Browsers, ohne Origin).
      if (request.method !== 'GET') return json({ error: 'method' }, 405, cors);
      const state = url.searchParams.get('state') ?? '';
      const code = url.searchParams.get('code') ?? '';
      if (!/^[A-Za-z0-9_-]{32}$/.test(state)) return new Response('Ungültiger Anmeldevorgang', { status: 400 });
      const taken = await flowStub(env, `flow:${state}`).take();
      const flow = taken ? (JSON.parse(taken) as FlowRecord) : null;
      const back = (query: string): Response => Response.redirect(`${flow?.returnTo ?? env.ALLOWED_ORIGINS.split(',')[0]!.trim()}/#/konto?${query}`, 302);
      if (!flow || flow.provider !== provider || Date.now() > flow.at + FLOW_TTL_MS) return back('fehler=abgelaufen');
      if (url.searchParams.get('error') || !code || code.length > 2048) return back('fehler=abgebrochen');
      if (!credentials || !env.PASS_PEPPER) return back('fehler=nicht-eingerichtet');
      const done = await exchangeCode({ provider, clientId: credentials.clientId, clientSecret: credentials.clientSecret, redirectUri, code, verifier: flow.verifier, nonce: flow.nonce });
      if (!done.ok) return back(`fehler=anmeldung&grund=${encodeURIComponent(`${done.reason}${'detail' in done && done.detail ? ` ${done.detail}` : ''}`)}`);
      const ticket = randomToken(24);
      const record: TicketRecord = { provider, lockId: await accountLockId(env.PASS_PEPPER, provider, done.accountKey), binding: flow.binding, at: Date.now() };
      await flowStub(env, `ticket:${ticket}`).put(JSON.stringify(record), TICKET_TTL_MS);
      return back(`ticket=${ticket}&anbieter=${provider}`);
    }

    // Dem Browser sagen, zu welchem Konto-Schloss sein Ticket gehört (nur mit dem Geheimnis, das er beim Start hatte).
    if (url.pathname === '/konto/ticket' && request.method === 'POST') {
      if (!originAllowed(request, env)) return json({ error: 'origin' }, 403, cors);
      const noStore = { ...cors, 'Cache-Control': 'no-store' };
      const limiter = attemptStub(env, request.headers.get('CF-Connecting-IP') ?? 'unbekannt');
      if (await limiter.blocked()) return json({ error: 'rate' }, 429, { ...noStore, 'Retry-After': String(ATTEMPT_WINDOW_MS / 1000) });
      const body = await readJson(request, 1024);
      const ticketText = body && typeof body.ticket === 'string' && /^[A-Za-z0-9_-]{32}$/.test(body.ticket) ? await flowStub(env, `ticket:${body.ticket}`).peek() : null;
      const ticket = ticketText ? (JSON.parse(ticketText) as TicketRecord) : null;
      if (!ticket || !(await ticketValid(ticket, null, body?.binding, Date.now()))) {
        await limiter.miss();
        return json({ error: 'ticket' }, 401, noStore);
      }
      return json({ lockId: ticket.lockId, provider: ticket.provider }, 200, noStore);
    }

    const accountLock = /^\/konto-schloss\/([^/]+)\/([a-z]+)$/.exec(url.pathname);
    if (accountLock) {
      if (!originAllowed(request, env)) return json({ error: 'origin' }, 403, cors);
      const noStore = { ...cors, 'Cache-Control': 'no-store' };
      const id = accountLock[1]!;
      const action = accountLock[2]!;
      if (!/^[0-9a-f]{32}$/.test(id)) return json({ error: 'id' }, 404, cors);
      if (request.method !== 'POST' || !['status', 'anlegen', 'oeffnen', 'speichern', 'loeschen'].includes(action)) return json({ error: 'method' }, 405, cors);
      const limiter = attemptStub(env, request.headers.get('CF-Connecting-IP') ?? 'unbekannt');
      if (await limiter.blocked()) return json({ error: 'rate' }, 429, { ...noStore, 'Retry-After': String(ATTEMPT_WINDOW_MS / 1000) });
      const body = await readJson(request, 80 * 1024);
      if (!body) return json({ error: 'body' }, 400, noStore);
      const ticketText = typeof body.ticket === 'string' && /^[A-Za-z0-9_-]{32}$/.test(body.ticket) ? await flowStub(env, `ticket:${body.ticket}`).peek() : null;
      const ticket = ticketText ? (JSON.parse(ticketText) as TicketRecord) : null;
      if (!(await ticketValid(ticket, id, body.binding, Date.now()))) {
        await limiter.miss();
        return json({ error: 'ticket' }, 401, noStore);
      }
      const result = (await accountLockStub(env, id).act(action, JSON.stringify(body), env.PASS_PEPPER)) as { status: number };
      if (result.status === 401) await limiter.miss();
      return json(result, result.status, noStore);
    }

    const lock = /^\/schloss\/([^/]+)(?:\/([a-z]+))?$/.exec(url.pathname);
    if (lock) {
      if (!originAllowed(request, env)) return json({ error: 'origin' }, 403, cors);
      const id = lock[1]!;
      if (!LOCK_ID_PATTERN.test(id)) return json({ error: 'id' }, 404, cors);
      const noStore = { ...cors, 'Cache-Control': 'no-store' };
      const limiter = attemptStub(env, request.headers.get('CF-Connecting-IP') ?? 'unbekannt');
      if (await limiter.blocked()) return json({ error: 'rate' }, 429, { ...noStore, 'Retry-After': String(ATTEMPT_WINDOW_MS / 1000) });
      const stub = lockStub(env, id);
      if (request.method === 'GET' && !lock[2]) {
        const exists = await stub.exists();
        if (!exists) await limiter.miss();
        return json({ exists }, 200, noStore);
      }
      const actions = ['anlegen', 'oeffnen', 'speichern', 'aendern', 'zuruecksetzen', 'loeschen'] as const;
      type Action = (typeof actions)[number];
      const action = lock[2] as Action | undefined;
      if (request.method !== 'POST' || !action || !actions.includes(action)) return json({ error: 'method' }, 405, cors);
      let body: unknown;
      try {
        const text = await request.text();
        if (text.length > 80 * 1024) return json({ error: 'size' }, 413, noStore);
        body = JSON.parse(text);
      } catch {
        return json({ error: 'body' }, 400, noStore);
      }
      const result = (await stub.act(action, body, env.PASS_PEPPER)) as { status: number };
      // Falsche Beweise und Anfragen an nicht vorhandene Schlösser zählen auch je Absender.
      if (result.status === 401 || result.status === 404) await limiter.miss();
      return json(result, result.status, noStore);
    }

    const match = /^\/rooms\/([^/]+)$/.exec(url.pathname);
    if (match && request.method === 'GET') {
      const code = parseRoomCode(decodeURIComponent(match[1]!));
      if (!code) return json({ error: 'code' }, 404, cors);
      if (request.headers.get('Upgrade') !== 'websocket') {
        return json({ exists: await roomStub(env, code).exists() }, 200, cors);
      }
      if (!originAllowed(request, env)) return new Response('Origin nicht erlaubt', { status: 403 });
      return roomStub(env, code).fetch(request);
    }

    if (url.pathname === '/') return new Response('Brett & Blatt – Spieleserver. Quellcode: https://github.com/ichthys2k/brett-und-blatt', { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
    return new Response('Nicht gefunden', { status: 404 });
  },
} satisfies ExportedHandler<Env>;

/**
 * Ein Raum als Durable Object. Der Raum selbst liegt im Speicher und zusätzlich als
 * Schnappschuss im Speicher des Objekts. Legt Cloudflare den Raum schlafen, bleiben
 * die WebSocket-Verbindungen offen; beim Aufwachen wird der Raum aus dem Schnappschuss
 * neu aufgebaut und die Verbindungen werden wieder zugeordnet.
 */
export class GameRoom extends DurableObject<Env> {
  private room: Room | null = null;
  private sockets = new Map<string, WebSocket>();
  /** Zuletzt ans Verzeichnis gemeldete Karte (undefined: seit dem Aufwachen noch nicht). */
  private lastListing: OpenRoomListing | null | undefined = undefined;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.blockConcurrencyWhile(async () => {
      const snapshot = await ctx.storage.get<RoomSnapshot>('room');
      if (!snapshot) return;
      this.room = Room.restore(snapshot, this.deps());
      for (const ws of ctx.getWebSockets()) {
        const attachment = ws.deserializeAttachment() as Attachment;
        this.sockets.set(attachment.id, ws);
        if (attachment.memberId) this.room.reattach(attachment.id, attachment.memberId);
        else this.room.connect(attachment.id);
      }
    });
  }

  /** Legt den Raum an. false, wenn es ihn unter diesem Code schon gibt. */
  async create(code: string, isPublic = true): Promise<boolean> {
    if (this.room) return false;
    this.room = new Room(code, this.deps(), isPublic);
    await this.persist();
    return true;
  }

  /** Legt den Raum für eine Turnierpartie an. false, wenn es den Code schon gibt. */
  async createMatch(code: string, config: MatchRoomConfig): Promise<boolean> {
    if (this.room) return false;
    const room = new Room(code, this.deps(), false);
    if (!room.setupMatch(config)) return false;
    this.room = room;
    await this.persist();
    return true;
  }

  async exists(): Promise<boolean> {
    return this.room !== null;
  }

  override async fetch(request: Request): Promise<Response> {
    if (!this.room) return new Response('Diesen Raum gibt es nicht (mehr).', { status: 404 });
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair) as [WebSocket, WebSocket];
    const id = crypto.randomUUID();
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({ id, memberId: null } satisfies Attachment);
    this.sockets.set(id, server);
    this.room.connect(id);
    return new Response(null, { status: 101, webSocket: client });
  }

  override async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    if (typeof message !== 'string') return;
    this.room?.receive(this.idOf(ws), message);
  }

  override async webSocketClose(ws: WebSocket): Promise<void> {
    this.dropSocket(ws);
  }

  override async webSocketError(ws: WebSocket): Promise<void> {
    this.dropSocket(ws);
  }

  override async alarm(): Promise<void> {
    const room = this.room;
    if (!room) return;
    // Lange niemand da: Raum samt allen Daten löschen.
    if (Date.now() >= room.expiresAt() && room.connectionCount === 0) {
      const code = room.code;
      this.room = null;
      await this.ctx.storage.deleteAll();
      await registryStub(this.env).removeRoom(code);
      return;
    }
    // tick() meldet die Änderung selbst (changed → persist); ein zweites Speichern wäre doppelt.
    room.tick();
  }

  private dropSocket(ws: WebSocket): void {
    const id = this.idOf(ws);
    this.sockets.delete(id);
    this.room?.disconnect(id);
  }

  private idOf(ws: WebSocket): string {
    return (ws.deserializeAttachment() as Attachment).id;
  }

  private deps(): RoomDeps {
    return {
      now: () => Date.now(),
      findGame: (id) => gamesById.get(id),
      botRunner,
      botBudgetMs: BOT_BUDGET_MS,
      randomSeed,
      send: (id, message) => this.send(id, message),
      close: (id) => {
        try {
          this.sockets.get(id)?.close(1000, 'Auf Wiedersehen');
        } catch {
          // Schon geschlossen.
        }
        this.sockets.delete(id);
      },
      changed: () => void this.persist(),
    };
  }

  private send(id: string, message: ServerMessage): void {
    const ws = this.sockets.get(id);
    if (!ws) return;
    // Nach der Anmeldung merkt sich die Verbindung ihr Mitglied – für das Aufwachen.
    if (message.type === 'welcome') ws.serializeAttachment({ id, memberId: message.you } satisfies Attachment);
    try {
      ws.send(JSON.stringify(message));
    } catch {
      // Verbindung schon weg; webSocketClose räumt auf.
    }
  }

  /** Speichert den Raum und stellt den Wecker auf den nächsten fälligen Zeitpunkt. */
  private async persist(): Promise<void> {
    const room = this.room;
    if (!room) return;
    await this.ctx.storage.put('room', room.snapshot());
    const wake = room.nextWakeup();
    if (wake !== null) await this.ctx.storage.setAlarm(Math.max(wake, Date.now() + 50));
    await this.syncRegistry();
    await this.reportMatch();
  }

  /** Meldet das Ergebnis einer Turnierpartie. Klappt das nicht, versucht es der Wecker erneut. */
  private async reportMatch(): Promise<void> {
    const room = this.room;
    const report = room?.matchReport();
    if (!room || !report) return;
    try {
      await tournamentStub(this.env, report.tournament).reportMatch(report.match, room.code, report.report);
      room.markMatchReported();
    } catch (err) {
      console.error('Turnier nicht erreichbar:', err);
      await this.ctx.storage.setAlarm(Date.now() + 60_000);
    }
  }

  /** Meldet die Karte des Raums ans Verzeichnis – nur, wenn sie sich geändert hat. */
  private async syncRegistry(): Promise<void> {
    const room = this.room;
    if (!room) return;
    const listing = room.publicListing();
    if (!listingNeedsSync(this.lastListing, listing)) return;
    const previous = this.lastListing;
    this.lastListing = listing;
    try {
      const reg = registryStub(this.env);
      if (listing) await reg.updateRoom(listing);
      else await reg.removeRoom(room.code);
    } catch (err) {
      this.lastListing = previous; // Beim nächsten Mal erneut versuchen.
      console.error('LobbyRegistry sync failed:', err);
    }
  }
}

/**
 * Zentrale Übersicht aller offenen Räume („Offene Runden“). Browser, die die Liste
 * ansehen, halten eine WebSocket-Verbindung (mit Hibernation: schlafende Verbindungen
 * kosten nichts) und bekommen bei jeder Änderung die ganze Liste. Veraltete Einträge
 * (> 60 min ohne Meldung) räumt ein Wecker ab.
 */
export class LobbyRegistry extends DurableObject<Env> {
  private directory = new OpenRoomDirectory();

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    // Lebenszeichen der Browser beantwortet Cloudflare selbst, ohne das Objekt zu wecken.
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong'));
    ctx.blockConcurrencyWhile(async () => {
      const saved = await ctx.storage.get<Record<string, OpenRoomListing>>('listings');
      this.directory = new OpenRoomDirectory(saved);
    });
  }

  override async fetch(): Promise<Response> {
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair) as [WebSocket, WebSocket];
    this.ctx.acceptWebSocket(server);
    await this.prune();
    this.sendTo(server, this.message());
    return new Response(null, { status: 101, webSocket: client });
  }

  override async webSocketMessage(): Promise<void> {
    // Browser schicken nur „ping“ (beantwortet Cloudflare selbst).
  }

  override async webSocketClose(ws: WebSocket, code: number): Promise<void> {
    try {
      ws.close(code === 1005 ? 1000 : code, 'Tschüss');
    } catch {
      // Schon zu.
    }
  }

  async updateRoom(listing: OpenRoomListing): Promise<void> {
    if (this.directory.update(listing)) await this.changed();
  }

  async removeRoom(code: string): Promise<void> {
    if (this.directory.remove(code)) await this.changed();
  }

  async listOpen(): Promise<OpenRoomListing[]> {
    await this.prune();
    return this.directory.list();
  }

  override async alarm(): Promise<void> {
    await this.prune();
    await this.scheduleExpiry();
  }

  private async prune(): Promise<void> {
    if (this.directory.prune(Date.now())) await this.changed();
  }

  /** Speichert, stellt den Wecker und schickt die neue Liste an alle Zuschauer. */
  private async changed(): Promise<void> {
    await this.ctx.storage.put('listings', this.directory.toJSON());
    await this.scheduleExpiry();
    const message = this.message();
    for (const ws of this.ctx.getWebSockets()) this.sendTo(ws, message);
  }

  private async scheduleExpiry(): Promise<void> {
    const next = this.directory.nextExpiry();
    if (next === null) await this.ctx.storage.deleteAlarm();
    else await this.ctx.storage.setAlarm(Math.max(next + 1000, Date.now() + 1000));
  }

  private message(): string {
    return JSON.stringify({ type: 'openRooms', rooms: this.directory.list() } satisfies OpenRoomsMessage);
  }

  private sendTo(ws: WebSocket, message: string): void {
    try {
      ws.send(message);
    } catch {
      // Verbindung schon weg.
    }
  }
}

/**
 * Eine verschlüsselte Sicherung als eigenes Durable Object (eins je Kennung, in der EU).
 * Unbenutzt wird sie nach `BACKUP_TTL_MS` gelöscht; jedes Lesen und Schreiben verlängert die Frist.
 */
export class BackupVault extends DurableObject<Env> {
  async load(): Promise<StoredBackup | null> {
    const stored = (await this.ctx.storage.get<StoredBackup>('backup')) ?? null;
    if (stored) await this.touch({ ...stored, at: Date.now() });
    return stored;
  }

  async save(body: unknown): Promise<ReturnType<typeof applyBackupPut>> {
    const current = (await this.ctx.storage.get<StoredBackup>('backup')) ?? null;
    const result = applyBackupPut(current, body, Date.now());
    if (result.status === 200) await this.touch(result.stored);
    return result;
  }

  override async alarm(): Promise<void> {
    const stored = await this.ctx.storage.get<StoredBackup>('backup');
    if (!stored || Date.now() >= stored.at + BACKUP_TTL_MS) {
      await this.ctx.storage.deleteAll();
      return;
    }
    await this.ctx.storage.setAlarm(stored.at + BACKUP_TTL_MS);
  }

  private async touch(stored: StoredBackup): Promise<void> {
    await this.ctx.storage.put('backup', stored);
    await this.ctx.storage.setAlarm(stored.at + BACKUP_TTL_MS);
  }
}

/**
 * Ein geteilter Pass-Schnappschuss als eigenes Durable Object (eins je Kennung, in der EU). Logik in `packages/online/src/share.ts`;
 * hier nur Speicher und Frist (ein Jahr ohne Abruf).
 */
export class PassShare extends DurableObject<Env> {
  async read(): Promise<string | null> {
    const record = (await this.ctx.storage.get<ShareRecord>('share')) ?? null;
    if (!record || isExpired(record, Date.now())) return null;
    await this.put({ ...record, at: Date.now() });
    return record.data;
  }

  /** Anlegen oder Ersetzen; gibt den HTTP-Status zurück. */
  async write(body: unknown): Promise<number> {
    const current = (await this.ctx.storage.get<ShareRecord>('share')) ?? null;
    const result = await putShare(current && !isExpired(current, Date.now()) ? current : null, body, Date.now());
    if (result.status !== 200) return result.status;
    await this.put(result.record);
    return 200;
  }

  async remove(body: unknown): Promise<number> {
    const current = (await this.ctx.storage.get<ShareRecord>('share')) ?? null;
    if (!current) return 404;
    if (!(await mayRemoveShare(current, body))) return 401;
    await this.ctx.storage.deleteAll();
    return 200;
  }

  override async alarm(): Promise<void> {
    const record = await this.ctx.storage.get<ShareRecord>('share');
    if (!record || isExpired(record, Date.now())) {
      await this.ctx.storage.deleteAll();
      return;
    }
    await this.ctx.storage.setAlarm(record.at + SHARE_TTL_MS);
  }

  private async put(record: ShareRecord): Promise<void> {
    await this.ctx.storage.put('share', record);
    await this.ctx.storage.setAlarm(record.at + SHARE_TTL_MS);
  }
}

/**
 * Eine Klasse (#150) als eigenes Durable Object (eins je Code, in der EU). Logik in `packages/online/src/classroom.ts`;
 * hier nur Speicher, Frist (ein Jahr ohne Aktivität) und die Zuordnung der Aktionen.
 */
export class ClassRoom extends DurableObject<Env> {
  async create(code: string, json: string): Promise<string> {
    if (await this.ctx.storage.get('class')) return 'taken';
    const body = JSON.parse(json) as Record<string, unknown>;
    const state = createClass(code, body.className, { token: body.token, name: body.name, avatar: body.avatar, crest: body.crest }, Date.now());
    if (typeof state === 'string') return state;
    await this.save(state);
    return 'ok';
  }

  /** Nimmt eine Aktion als JSON-Text; Antwort ebenfalls als Text (RPC kennt `unknown` nicht). */
  async act(json: string): Promise<{ status: number; body: string }> {
    const reply = (status: number, value: Record<string, unknown>) => ({ status, body: JSON.stringify(value) });
    const body = JSON.parse(json) as Record<string, unknown>;
    const state = (await this.ctx.storage.get<ClassState>('class')) ?? null;
    if (!state || isClassExpired(state, Date.now())) return reply(404, { error: 'missing' });
    const now = Date.now();
    const token = body.token;
    let outcome: { error: string } | { ok: true } = { ok: true };
    switch (body.action) {
      case 'view':
        return reply(200, { view: classView(state, token) });
      case 'join':
        outcome = joinClass(state, { token, name: body.name, avatar: body.avatar, crest: body.crest }, now);
        break;
      case 'enroll': {
        const who = (body.who && typeof body.who === 'object' ? body.who : {}) as Record<string, unknown>;
        outcome = enrollMember(state, token, { token: who.token, name: who.name, avatar: who.avatar }, now);
        break;
      }
      case 'update':
        outcome = updateMember(state, token, { name: body.name, avatar: body.avatar, ...('crest' in body ? { crest: body.crest } : {}) }, now);
        break;
      case 'card':
        outcome = putCard(state, token, body.card, now);
        break;
      case 'leave':
        outcome = leaveClass(state, token);
        break;
      case 'accept':
      case 'reject':
        outcome = decide(state, token, body.id, body.action === 'accept', now);
        break;
      case 'remove':
        outcome = removeMember(state, token, body.id);
        break;
      case 'lead':
        outcome = setLead(state, token, body.id, body.lead === true);
        break;
      case 'configure':
        outcome = configureClass(state, token, { name: body.name, open: body.open, approval: body.approval, sections: body.sections }, now);
        break;
      case 'dissolve':
        if (!mayDissolve(state, token)) return reply(403, { error: 'Das darf nur die Leitung.' });
        await this.ctx.storage.deleteAll();
        return reply(200, { dissolved: true });
      default:
        return reply(400, { error: 'action' });
    }
    if ('error' in outcome) return reply(409, { error: outcome.error, view: classView(state, token) });
    await this.save(state);
    return reply(200, { view: classView(state, token) });
  }

  /** Auflösen durch den Betreiber (`/betreiber/klasse/<Code>`). */
  async operatorDissolve(): Promise<boolean> {
    if (!(await this.ctx.storage.get('class'))) return false;
    await this.ctx.storage.deleteAll();
    return true;
  }

  override async alarm(): Promise<void> {
    const state = await this.ctx.storage.get<ClassState>('class');
    if (!state || isClassExpired(state, Date.now())) {
      await this.ctx.storage.deleteAll();
      return;
    }
    await this.ctx.storage.setAlarm(state.lastActive + CLASS_TTL_MS);
  }

  private async save(state: ClassState): Promise<void> {
    await this.ctx.storage.put('class', state);
    await this.ctx.storage.setAlarm(state.lastActive + CLASS_TTL_MS);
  }
}

/**
 * Der Schalter für Anträge auf Organisationen (#228): ein einziges Durable Object (in der EU), das die offenen und kürzlich
 * entschiedenen Anträge hält. Logik in `packages/online/src/org-requests.ts`; Antworten gehen als JSON-Text.
 */
export class OrgDesk extends DurableObject<Env> {
  private async load(): Promise<OrgDeskState> {
    return (await this.ctx.storage.get<OrgDeskState>('desk')) ?? emptyDesk();
  }

  async submit(json: string): Promise<string> {
    const body = JSON.parse(json) as Record<string, unknown>;
    const desk = await this.load();
    const result = submitRequest(desk, { token: body.token, name: body.name, avatar: body.avatar, crest: body.crest, orgName: body.orgName, kind: body.kind, purpose: body.purpose }, Date.now());
    if ('ok' in result) await this.ctx.storage.put('desk', desk);
    return JSON.stringify(result);
  }

  async mine(token: string): Promise<string> {
    return JSON.stringify(requestsOf(await this.load(), token));
  }

  async list(): Promise<string> {
    return JSON.stringify(openRequests(await this.load()));
  }

  async decide(id: string, approve: boolean, note: unknown): Promise<string> {
    const desk = await this.load();
    const result = decideRequest(desk, id, approve, note, Date.now());
    if ('ok' in result && !approve) await this.ctx.storage.put('desk', desk);
    return JSON.stringify(result);
  }

  async approved(id: string, code: string): Promise<void> {
    const desk = await this.load();
    setApproved(desk, id, code, Date.now());
    await this.ctx.storage.put('desk', desk);
  }
}

/**
 * Eine Organisation als Durable Object (eins je Code, in der EU, #217). Die Logik steht in `packages/online/src/org.ts`;
 * hier nur Speicher und Frist (ein Jahr nach der letzten Aktivität).
 */
export class OrgRoom extends DurableObject<Env> {
  async create(code: string, json: string): Promise<string> {
    if (await this.ctx.storage.get('org')) return 'taken';
    const body = JSON.parse(json) as Record<string, unknown>;
    const founder = (body.founder && typeof body.founder === 'object' ? body.founder : {}) as Record<string, unknown>;
    if (!ORG_KINDS.some((k) => k === body.kind)) return 'Art der Organisation fehlt.';
    const state = createOrg(code, { name: body.name, kind: body.kind }, { token: founder.token, name: founder.name, avatar: founder.avatar, crest: founder.crest }, Date.now());
    if (typeof state === 'string') return state;
    await this.save(state);
    return 'ok';
  }

  /** Nimmt eine Aktion als JSON-Text; Antwort ebenfalls als Text (RPC kennt `unknown` nicht). */
  async act(json: string): Promise<{ status: number; body: string }> {
    const reply = (status: number, value: Record<string, unknown>) => ({ status, body: JSON.stringify(value) });
    const body = JSON.parse(json) as Record<string, unknown>;
    const state = (await this.ctx.storage.get<OrgState>('org')) ?? null;
    const now = Date.now();
    if (!state || isOrgExpired(state, now)) return reply(404, { error: 'missing' });
    const token = body.token;
    let outcome: { error: string } | { ok: true } = { ok: true };
    let extra: Record<string, unknown> = {};
    switch (body.action) {
      case 'view':
        return reply(200, { view: orgView(state, token, now) });
      case 'redeem':
        outcome = redeemInvite(state, { token, name: body.name, avatar: body.avatar, crest: body.crest }, body.invite, now);
        break;
      case 'invite': {
        const made = createInvite(state, token, body.roles, now);
        if ('error' in made) outcome = made;
        else extra = { invite: { id: made.id, code: made.code, expiresAt: made.expiresAt } };
        break;
      }
      case 'revokeInvite':
        outcome = revokeInvite(state, token, body.id, now);
        break;
      case 'offer':
        outcome = offerRoles(state, token, body.id, body.roles, now);
        break;
      case 'accept':
      case 'decline':
        outcome = answerOffer(state, token, body.action === 'accept', now);
        break;
      case 'revoke':
        outcome = revokeRoles(state, token, body.id, body.roles, now);
        break;
      case 'remove':
        outcome = removeOrgMember(state, token, body.id, now);
        break;
      case 'leave':
        outcome = leaveOrg(state, token, now);
        break;
      case 'configure':
        outcome = configureOrg(state, token, { name: body.name, leaderMayGrant: body.leaderMayGrant }, now);
        break;
      case 'update':
        outcome = updateOrgMember(state, token, { name: body.name, avatar: body.avatar, ...('crest' in body ? { crest: body.crest } : {}) }, now);
        break;
      case 'dissolve':
        if (!mayDissolveOrg(state, token)) return reply(403, { error: 'Das darf nur der Betreiber.' });
        await this.ctx.storage.deleteAll();
        return reply(200, { dissolved: true });
      default:
        return reply(400, { error: 'action' });
    }
    if ('error' in outcome) return reply(409, { error: outcome.error, view: orgView(state, token, now) });
    await this.save(state);
    return reply(200, { view: orgView(state, token, now), ...extra });
  }

  /** Rollen eines Geräts in dieser Organisation (für Turniere, #230); leer in gesperrten, unbekannten und für Fremde. */
  async rolesOf(token: string): Promise<string> {
    const state = await this.ctx.storage.get<OrgState>('org');
    if (!state || isOrgExpired(state, Date.now()) || state.status !== 'active') return '[]';
    return JSON.stringify(rolesOf(state, token));
  }

  /** Sperrt oder gibt eine Organisation wieder frei (Betreiber der Plattform); gesperrt gelten keine Rollen und keine Einladungen. */
  async setBlocked(blocked: boolean): Promise<boolean> {
    const state = await this.ctx.storage.get<OrgState>('org');
    if (!state) return false;
    state.status = blocked ? 'blocked' : 'active';
    await this.save(state);
    return true;
  }

  /** Auflösen durch den Betreiber der Plattform (`/betreiber/org/<Code>`). */
  async operatorDelete(): Promise<boolean> {
    if (!(await this.ctx.storage.get('org'))) return false;
    await this.ctx.storage.deleteAll();
    return true;
  }

  override async alarm(): Promise<void> {
    const state = await this.ctx.storage.get<OrgState>('org');
    if (!state || isOrgExpired(state, Date.now())) {
      await this.ctx.storage.deleteAll();
      return;
    }
    await this.ctx.storage.setAlarm(state.lastActive + ORG_TTL_MS);
  }

  private async save(state: OrgState): Promise<void> {
    await this.ctx.storage.put('org', state);
    await this.ctx.storage.setAlarm(state.lastActive + ORG_TTL_MS);
  }
}

/**
 * Das Schloss eines Ausweises als eigenes Durable Object (eins je Kennung, in der EU).
 * Logik und Zähler in `packages/online/src/lock.ts`; hier nur Speicher und Frist.
 */
export class PassLock extends DurableObject<Env> {
  async exists(): Promise<boolean> {
    const record = await this.ctx.storage.get<LockRecord>('lock');
    return !!record && record.data !== '';
  }

  async act(action: string, body: unknown, pepper: string | undefined): Promise<{ status: number } & Record<string, unknown>> {
    const now = Date.now();
    const stored = (await this.ctx.storage.get<LockRecord>('lock')) ?? null;
    if (action === 'anlegen') {
      if (stored) return { status: 409, current: null };
      const made = await createLock(body, pepper, now);
      if (made.status !== 200) return made;
      await this.put(made.record);
      return { status: 200, share: made.share };
    }
    if (!stored) return { status: 404 };
    let outcome: LockOutcome;
    if (action === 'oeffnen') outcome = await openLock(stored, body, pepper, now);
    else if (action === 'speichern') outcome = await saveLock(stored, body, pepper, now);
    else if (action === 'aendern') outcome = await changeLock(stored, body, pepper, now);
    else if (action === 'zuruecksetzen') outcome = await resetLock(stored, body, pepper, now);
    else {
      outcome = await mayRemoveLock(stored, body, pepper, now);
      if (outcome.result.status === 200) {
        await this.ctx.storage.deleteAll();
        return outcome.result;
      }
    }
    // Zähler und Fristen werden auch nach Fehlversuchen gespeichert.
    if (outcome.record) await this.put(outcome.record);
    return outcome.result;
  }

  override async alarm(): Promise<void> {
    const stored = await this.ctx.storage.get<LockRecord>('lock');
    if (!stored || Date.now() >= stored.at + LOCK_TTL_MS) {
      await this.ctx.storage.deleteAll();
      return;
    }
    await this.ctx.storage.setAlarm(stored.at + LOCK_TTL_MS);
  }

  private async put(record: LockRecord): Promise<void> {
    await this.ctx.storage.put('lock', record);
    await this.ctx.storage.setAlarm(record.at + LOCK_TTL_MS);
  }
}

/** Vorgänge und Tickets der Anmeldung mit Google oder Microsoft (#154): ein kurzlebiger Wert je Objekt, nach der Frist weg. */
export class AccountFlow extends DurableObject<Env> {
  async put(value: string, ttlMs: number): Promise<void> {
    await this.ctx.storage.put('value', value);
    await this.ctx.storage.setAlarm(Date.now() + ttlMs);
  }

  /** Einmal lesen und löschen (Vorgang). */
  async take(): Promise<string | null> {
    const value = (await this.ctx.storage.get<string>('value')) ?? null;
    await this.ctx.storage.deleteAll();
    return value;
  }

  /** Lesen, ohne zu löschen (Ticket gilt für mehrere Aufrufe bis zum Ablauf). */
  async peek(): Promise<string | null> {
    return (await this.ctx.storage.get<string>('value')) ?? null;
  }

  override async alarm(): Promise<void> {
    await this.ctx.storage.deleteAll();
  }
}

/** Das Konto-Schloss (#154), ein Objekt je Kennung. Logik in `packages/online/src/account.ts`; die Ticket-Prüfung geschieht vorher im Worker. */
export class AccountLockBox extends DurableObject<Env> {
  async act(action: string, bodyText: string, pepper: string | undefined): Promise<{ status: number } & Record<string, unknown>> {
    const body = JSON.parse(bodyText) as unknown;
    const now = Date.now();
    const stored = (await this.ctx.storage.get<AccountRecord>('lock')) ?? null;
    if (action === 'status') return { status: 200, exists: !!stored && stored.data !== '', pin: stored?.authMac != null };
    if (action === 'anlegen') {
      const made = await createAccountLock(body, pepper, now);
      if (made.status !== 200) return made;
      await this.put(made.record);
      return { status: 200, share: made.share };
    }
    if (action === 'loeschen') {
      await this.ctx.storage.deleteAll();
      return { status: 200 };
    }
    if (!stored) return { status: 404 };
    const outcome = action === 'oeffnen' ? await openAccountLock(stored, body, pepper, now) : await saveAccountLock(stored, body, pepper, now);
    if (outcome.record) await this.put(outcome.record);
    return outcome.result;
  }

  override async alarm(): Promise<void> {
    const stored = await this.ctx.storage.get<AccountRecord>('lock');
    if (!stored || Date.now() >= stored.at + LOCK_TTL_MS) {
      await this.ctx.storage.deleteAll();
      return;
    }
    await this.ctx.storage.setAlarm(stored.at + LOCK_TTL_MS);
  }

  private async put(record: AccountRecord): Promise<void> {
    await this.ctx.storage.put('lock', record);
    await this.ctx.storage.setAlarm(record.at + LOCK_TTL_MS);
  }
}

/** Zählt je Absender (Adresse) die Anfragen an nicht vorhandene Sicherungen; Logik in `packages/online/src/attempts.ts`. */
export class AttemptLimiter extends DurableObject<Env> {
  async blocked(): Promise<boolean> {
    return isBlocked((await this.ctx.storage.get<AttemptState>('attempts')) ?? null, Date.now());
  }

  async miss(): Promise<void> {
    const now = Date.now();
    const state = recordMiss((await this.ctx.storage.get<AttemptState>('attempts')) ?? null, now);
    await this.ctx.storage.put('attempts', state);
    await this.ctx.storage.setAlarm(state.since + ATTEMPT_WINDOW_MS);
  }

  override async alarm(): Promise<void> {
    await this.ctx.storage.deleteAll();
  }
}

/** Was an einer Verbindung der Turnierseite hängt und das Schlafen übersteht. */
interface TournamentAttachment {
  token: string | null;
  name?: string;
  avatar?: string;
}

/**
 * Ein Turnier als Durable Object (in der EU): hält Stand und Stichtage, legt für jede Partie
 * einen normalen Spielraum an und schickt jede Änderung an alle offenen Turnierseiten.
 */
/**
 * Eine Serie als eigenes Durable Object (eins je Code, in der EU, #205). Die Logik steht in `packages/online/src/series-book.ts`;
 * hier nur Speicher und Frist (ein Jahr nach der letzten Aktivität).
 */
export class SeriesRoom extends DurableObject<Env> {
  private book: SeriesBook | null = null;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.blockConcurrencyWhile(async () => {
      const record = await ctx.storage.get<SeriesRecord>('series');
      if (record) this.book = SeriesBook.restore(record, this.deps());
    });
  }

  /** Legt die Serie an; gibt einen Fehlertext zurück, `'belegt'`, wenn der Code schon vergeben ist, sonst null. */
  async create(code: string, name: string, scheme: PointScheme, token: string): Promise<string | null> {
    if (this.book) return 'belegt';
    const book = SeriesBook.create(code, name, scheme, token, this.deps());
    if (typeof book === 'string') return book;
    this.book = book;
    await this.save();
    return null;
  }

  async view(token: string | null): Promise<SeriesView | null> {
    return this.book ? this.book.view(token) : null;
  }

  async accepts(key: string): Promise<boolean> {
    return this.book?.accepts(key) ?? false;
  }

  async report(key: string, entry: SeriesEntry): Promise<string | null> {
    if (!this.book) return 'Diese Serie gibt es nicht (mehr).';
    const error = this.book.report(key, entry);
    if (!error) await this.save();
    return error;
  }

  async manage(token: string, request: { action: string; name?: string; scheme?: PointScheme; tournament?: string }): Promise<string | null> {
    const book = this.book;
    if (!book) return 'Diese Serie gibt es nicht (mehr).';
    let error: string | null;
    switch (request.action) {
      case 'rename':
        error = book.rename(token, request.name ?? '');
        break;
      case 'scheme':
        error = request.scheme ? book.setScheme(token, request.scheme) : 'Unbekannte Punktewertung.';
        break;
      case 'remove':
        error = book.remove(token, request.tournament ?? '');
        break;
      case 'extend':
        error = book.extend(token);
        break;
      case 'newKey':
        error = book.newKey(token);
        break;
      default:
        error = 'Unbekannte Aktion.';
    }
    if (!error) await this.save();
    return error;
  }

  /** Übergabecode für ein anderes Gerät (nur die Leitung). */
  async issueTransfer(token: string): Promise<{ code: string; expiresAt: number } | { error: string }> {
    if (!this.book) return { error: 'Diese Serie gibt es nicht (mehr).' };
    const issued = this.book.issueTransfer(token);
    if (!('error' in issued)) await this.save();
    return issued;
  }

  async takeLeadership(token: string, code: string): Promise<string | null> {
    if (!this.book) return 'Diese Serie gibt es nicht (mehr).';
    const error = this.book.takeLeadership(token, code);
    // Auch ein falscher Code zählt als Versuch und muss gespeichert werden.
    await this.save();
    return error;
  }

  async deleteByLeader(token: string): Promise<string | null> {
    if (!this.book) return 'Diese Serie gibt es nicht (mehr).';
    if (!this.book.mayManage(token)) return 'Das darf nur die Leitung der Serie.';
    await this.wipe();
    return null;
  }

  async operatorDelete(): Promise<boolean> {
    if (!this.book) return false;
    await this.wipe();
    return true;
  }

  override async alarm(): Promise<void> {
    const book = this.book;
    if (!book) return;
    if (Date.now() >= book.expiresAt()) return this.wipe();
    await this.ctx.storage.setAlarm(book.expiresAt());
  }

  private async wipe(): Promise<void> {
    this.book = null;
    await this.ctx.storage.deleteAll();
  }

  private async save(): Promise<void> {
    if (!this.book) return;
    await this.ctx.storage.put('series', this.book.snapshot());
    await this.ctx.storage.setAlarm(this.book.expiresAt());
  }

  private deps() {
    return { now: () => Date.now(), randomKey: () => randomLetters(8) };
  }
}

export class TournamentRoom extends DurableObject<Env> {
  private tournament: Tournament | null = null;
  /** Rollen aus der Organisation je Kennung, kurz gemerkt (#230); sie ändern sich selten, die Abfrage soll nicht jede Nachricht bremsen. */
  private orgCache = new Map<string, { roles: OrgRole[]; at: number }>();
  private lastListing: OpenRoomListing | null | undefined = undefined;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong'));
    ctx.blockConcurrencyWhile(async () => {
      const snapshot = await ctx.storage.get<StoredTournamentSnapshot>('tournament');
      if (snapshot) this.tournament = Tournament.restore(snapshot, this.deps());
    });
  }

  async create(code: string, settings: TournamentSettings, leader: { token: string; name: string }, fields = 0, points?: PointRules, entrants: string[] = [], seed?: string): Promise<boolean> {
    if (this.tournament) return false;
    // Ein Turnier, das ohne Netz geleitet wurde, bringt seinen Startwert der Auslosung mit, damit die Wiedergabe dieselbe Auslosung ergibt.
    this.tournament = Tournament.create(code, seed ?? randomSeed(), settings, leader, this.deps(), fields, points);
    // Folgephase vor Ort: Die Teilnehmer der vorigen Phase stehen schon in der Reihenfolge der Setzliste auf der Liste.
    if (entrants.length > 0) this.tournament.addEntrants(leader.token, entrants);
    await this.changed();
    return true;
  }

  async exists(): Promise<boolean> {
    return this.tournament !== null;
  }

  async reportMatch(match: string, room: string, report: RoomReport): Promise<void> {
    if (this.tournament?.report(match, room, report)) await this.changed();
  }

  override async fetch(): Promise<Response> {
    if (!this.tournament) return new Response('Dieses Turnier gibt es nicht (mehr).', { status: 404 });
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair) as [WebSocket, WebSocket];
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({ token: null } satisfies TournamentAttachment);
    return new Response(null, { status: 101, webSocket: client });
  }

  /** Holt die Rollen aus der Organisation des Turniers für diese Kennungen (höchstens alle 15 Sekunden je Kennung). */
  private async loadOrgRoles(tokens: readonly (string | null | undefined)[]): Promise<void> {
    const t = this.tournament;
    const org = t?.snapshot().settings.org;
    if (!t || !org) return;
    const now = Date.now();
    for (const token of new Set(tokens)) {
      if (!token) continue;
      const cached = this.orgCache.get(token);
      if (!cached || now - cached.at > 15_000) {
        const roles = await orgRolesOf(this.env, org, token);
        this.orgCache.set(token, { roles, at: now });
      }
      t.setOrgRoles(token, this.orgCache.get(token)!.roles);
    }
  }

  override async webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer): Promise<void> {
    const t = this.tournament;
    if (!t || typeof raw !== 'string') return;
    const message = parseTournamentMessage(raw);
    if (!message) return this.sendTo(ws, { type: 'error', message: 'Unbekannte Nachricht.' });
    if (message.type === 'hello') {
      await this.loadOrgRoles([message.token]);
      ws.serializeAttachment({ token: message.token, name: message.name, avatar: message.avatar } satisfies TournamentAttachment);
      if (t.greet(message.token, message.name, message.avatar)) return this.changed();
      return this.sendView(ws);
    }
    const { token, name, avatar } = ws.deserializeAttachment() as TournamentAttachment;
    if (!token) return this.sendTo(ws, { type: 'error', message: 'Erst anmelden.' });
    await this.loadOrgRoles([token]);
    if (message.type === 'attachSeries' || message.type === 'detachSeries') return this.handleSeries(ws, t, token, message);
    const result = applyTournamentMessage(t, { token, name: name ?? '', avatar: avatar ?? '' }, message);
    if (result.kind === 'delete') return this.deleteTournament(t);
    if (result.kind === 'error') return this.sendTo(ws, { type: 'error', message: result.message });
    if (result.claim) this.sendTo(ws, { type: 'claimCode', player: result.claim.player, code: result.claim.code });
    if (result.leaderCode) this.sendTo(ws, { type: 'leaderCode', code: result.leaderCode.code, expiresAt: result.leaderCode.expiresAt });
    await this.changed();
  }

  override async webSocketClose(ws: WebSocket, code: number): Promise<void> {
    try {
      ws.close(code === 1005 ? 1000 : code, 'Tschüss');
    } catch {
      // Schon zu.
    }
  }

  /** Serie zuordnen oder lösen (#205): Der Zuordnungscode wird beim Serien-Objekt geprüft. */
  private async handleSeries(ws: WebSocket, t: Tournament, token: string, message: { type: 'attachSeries'; link: string } | { type: 'detachSeries' }): Promise<void> {
    if (message.type === 'detachSeries') {
      const error = t.detachSeries(token);
      if (error) return this.sendTo(ws, { type: 'error', message: error });
      return this.changed();
    }
    if (!t.mayDelete(token)) return this.sendTo(ws, { type: 'error', message: 'Das Turnier einer Serie zuordnen kann nur die Hauptleitung.' });
    const link = parseSeriesLink(message.link);
    if (!link) return this.sendTo(ws, { type: 'error', message: 'Bitte den Zuordnungscode der Serie eingeben (zweimal acht Zeichen).' });
    let accepted = false;
    try {
      accepted = await seriesStub(this.env, link.code).accepts(link.key);
    } catch (err) {
      console.error('Serie nicht erreichbar:', err);
    }
    if (!accepted) return this.sendTo(ws, { type: 'error', message: 'Diese Serie gibt es nicht, oder der Zuordnungscode passt nicht.' });
    t.attachSeries(token, link.code, link.key);
    return this.changed();
  }

  /** Meldet ein beendetes Turnier an seine Serie; bei Fehlern wird beim nächsten Wecken erneut versucht. */
  private async reportSeries(t: Tournament): Promise<boolean> {
    const link = t.seriesLink();
    if (!link || !t.seriesDue()) return false;
    const source = t.seriesSource();
    if (!source) return false;
    try {
      const players = await Promise.all(source.entry.players.map(async (p) => ({ ...p, ...(source.tokens[p.id] ? { key: await personKey(source.tokens[p.id]!) } : {}) })));
      const error = await seriesStub(this.env, link.code).report(link.key, { ...source.entry, players });
      if (error) console.error('Serie hat das Ergebnis nicht angenommen:', error);
      // Eine abgelehnte Meldung (Serie weg, Schlüssel erneuert) wird nicht endlos wiederholt.
      t.markSeriesReported();
      return true;
    } catch (err) {
      console.error('Serie nicht erreichbar:', err);
      return false;
    }
  }

  /** Löschen durch den Betreiber (`/betreiber/turnier/<Code>`). */
  async operatorDelete(): Promise<boolean> {
    const t = this.tournament;
    if (!t) return false;
    await this.deleteTournament(t, 'Vom Betreiber gelöscht');
    return true;
  }

  /** Löscht das Turnier samt Eintrag in „Offene Runden“; alle Verbindungen erfahren es. */
  private async deleteTournament(t: Tournament, reason = 'Turnier gelöscht'): Promise<void> {
    this.tournament = null;
    await registryStub(this.env).removeRoom(t.snapshot().code).catch(() => undefined);
    await this.ctx.storage.deleteAll();
    for (const ws of this.ctx.getWebSockets()) {
      if (reason === 'Turnier gelöscht') this.sendTo(ws, { type: 'deleted' });
      ws.close(1000, reason);
    }
  }

  override async alarm(): Promise<void> {
    const t = this.tournament;
    if (!t) return;
    if (Date.now() >= t.expiresAt()) return this.deleteTournament(t, 'Turnier beendet');
    t.tick();
    await this.changed();
  }

  /** Räume anlegen, speichern, Wecker stellen, allen den neuen Stand schicken. */
  private async changed(): Promise<void> {
    const t = this.tournament;
    if (!t) return;
    let retry = false;
    for (const request of t.pendingRooms()) {
      const code = await this.createMatchRoom({ tournament: t.snapshot().code, match: request.match, gameId: request.gameId, time: request.time, options: request.options, tokens: request.tokens, label: request.label, ...(request.bestOf ? { bestOf: request.bestOf } : {}), ...(request.teams ? { teams: request.teams } : {}) });
      if (code) t.roomCreated(request.match, code);
      else retry = true;
    }
    if (!(await this.reportSeries(t)) && t.seriesDue()) retry = true;
    await this.ctx.storage.put('tournament', t.snapshot());
    const wake = retry ? Date.now() + 30_000 : t.nextWakeup();
    await this.ctx.storage.setAlarm(Math.max(wake, Date.now() + 1000));
    await this.loadOrgRoles(this.ctx.getWebSockets().map((ws) => (ws.deserializeAttachment() as TournamentAttachment).token));
    for (const ws of this.ctx.getWebSockets()) this.sendView(ws);
    await this.syncRegistry(t);
  }

  /** Schreibt das Turnier in „Offene Runden“ aus (oder nimmt es heraus) – nur bei sichtbarer Änderung. */
  private async syncRegistry(t: Tournament): Promise<void> {
    const listing = t.publicListing();
    if (!listingNeedsSync(this.lastListing, listing)) return;
    const previous = this.lastListing;
    this.lastListing = listing;
    try {
      const reg = registryStub(this.env);
      if (listing) await reg.updateRoom(listing);
      else await reg.removeRoom(t.snapshot().code);
    } catch (err) {
      this.lastListing = previous;
      console.error('LobbyRegistry sync failed (Turnier):', err);
    }
  }

  private async createMatchRoom(config: MatchRoomConfig): Promise<string | null> {
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = randomRoomCode(randomInt);
      try {
        if (await roomStub(this.env, code).createMatch(code, config)) return code;
      } catch (err) {
        console.error('Spielraum nicht angelegt:', err);
      }
    }
    return null;
  }

  private sendView(ws: WebSocket): void {
    const t = this.tournament;
    if (!t) return;
    const token = (ws.deserializeAttachment() as TournamentAttachment).token;
    if (!token) return;
    this.sendTo(ws, t.maySee(token) ? { type: 'tournament', view: t.view(token) } : { type: 'closed', name: t.name });
  }

  private sendTo(ws: WebSocket, message: TournamentServerMessage): void {
    try {
      ws.send(JSON.stringify(message));
    } catch {
      // Verbindung schon weg.
    }
  }

  private deps() {
    return { now: () => Date.now(), randomClaim: () => randomLetters(8), ruleVersion: (gameId: string) => gamesById.get(gameId)?.info.ruleVersion };
  }
}
