import { DurableObject } from 'cloudflare:workers';
import {
  ATTEMPT_WINDOW_MS,
  BACKUP_ID_PATTERN,
  BACKUP_TTL_MS,
  CLASS_TTL_MS,
  OpenRoomDirectory,
  Room,
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
  parseEntrants,
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
  /** Geheimer Pfeffer für die Schlösser der Ausweise (`wrangler secret put PASS_PEPPER`, lokal in `.dev.vars`). Fehlt er, melden die Schloss-Endpunkte 503. */
  PASS_PEPPER?: string;
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
        'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        Vary: 'Origin',
      }
    : {};
}

/** Nur die eigene Web-App darf Räume anlegen und betreten. */
function originAllowed(request: Request, env: Env): boolean {
  const origin = request.headers.get('Origin');
  return origin !== null && env.ALLOWED_ORIGINS.split(',').map((o) => o.trim()).includes(origin);
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

    if (url.pathname === '/turniere' && request.method === 'POST') {
      if (!originAllowed(request, env)) return json({ error: 'origin' }, 403, cors);
      let body: { settings?: unknown; token?: unknown; name?: unknown; entrants?: unknown };
      try {
        const text = await request.text();
        if (text.length > 12_000) return json({ error: 'size' }, 413, cors);
        body = JSON.parse(text) as typeof body;
      } catch {
        return json({ error: 'body' }, 400, cors);
      }
      const settings = parseTournamentSettings(body.settings, (id) => gamesById.get(id));
      if (!settings || typeof body.token !== 'string' || body.token.length < 16 || body.token.length > 100 || typeof body.name !== 'string') return json({ error: 'body' }, 400, cors);
      for (let attempt = 0; attempt < 5; attempt++) {
        const code = randomLetters(8);
        if (await tournamentStub(env, code).create(code, settings, { token: body.token, name: body.name }, parseFieldCount(body.settings), parsePointRules(body.settings), parseEntrants(body.entrants))) return json({ code }, 201, cors);
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
export class TournamentRoom extends DurableObject<Env> {
  private tournament: Tournament | null = null;
  private lastListing: OpenRoomListing | null | undefined = undefined;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong'));
    ctx.blockConcurrencyWhile(async () => {
      const snapshot = await ctx.storage.get<StoredTournamentSnapshot>('tournament');
      if (snapshot) this.tournament = Tournament.restore(snapshot, this.deps());
    });
  }

  async create(code: string, settings: TournamentSettings, leader: { token: string; name: string }, fields = 0, points?: PointRules, entrants: string[] = []): Promise<boolean> {
    if (this.tournament) return false;
    this.tournament = Tournament.create(code, randomSeed(), settings, leader, this.deps(), fields, points);
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

  override async webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer): Promise<void> {
    const t = this.tournament;
    if (!t || typeof raw !== 'string') return;
    const message = parseTournamentMessage(raw);
    if (!message) return this.sendTo(ws, { type: 'error', message: 'Unbekannte Nachricht.' });
    if (message.type === 'hello') {
      ws.serializeAttachment({ token: message.token, name: message.name, avatar: message.avatar } satisfies TournamentAttachment);
      if (t.greet(message.token, message.name, message.avatar)) return this.changed();
      return this.sendView(ws);
    }
    const { token, name, avatar } = ws.deserializeAttachment() as TournamentAttachment;
    if (!token) return this.sendTo(ws, { type: 'error', message: 'Erst anmelden.' });
    let error: string | null = null;
    switch (message.type) {
      case 'delete':
        if (!t.mayDelete(token)) {
          error = 'Löschen darf nur, wer das Turnier angelegt hat.';
          break;
        }
        return this.deleteTournament(t);
      case 'join':
        error = t.join(token, name ?? '', avatar ?? '');
        break;
      case 'leave':
        error = t.leave(token);
        break;
      case 'claim':
        error = t.claim(token, message.code);
        break;
      case 'start':
        error = t.start(token);
        break;
      case 'ready':
        error = t.ready(token, message.match, message.ready);
        break;
      case 'setResult':
        error = t.setResult(token, message.match, message.winner);
        break;
      case 'extend':
        error = t.extend(token, message.days, message.minutes);
        break;
      case 'startRound':
        error = t.startRound(token);
        break;
      case 'wish':
        error = t.wish(token, message.disciplines);
        break;
      case 'enterTable':
        error = t.enterTable(token, message.table, { ...(message.places ? { places: message.places } : {}), ...(message.scores ? { scores: message.scores } : {}) });
        break;
      case 'withdraw':
        error = t.withdraw(token, message.player);
        break;
      case 'reissue': {
        const issued = t.reissue(token, message.player);
        if ('error' in issued) error = issued.error;
        else this.sendTo(ws, { type: 'claimCode', player: message.player, code: issued.code });
        break;
      }
      case 'addEntrants':
        error = t.addEntrants(token, message.names);
        break;
      case 'removeEntrant':
        error = t.removeEntrant(token, message.player);
        break;
      case 'enterResult':
        error = t.enterResult(token, message.match, message.score ? { score: message.score } : { winner: message.winner! });
        break;
      case 'setFields':
        error = t.setFields(token, message.count);
        break;
      case 'addHelper':
        error = t.addHelper(token, message.name, message.role);
        break;
      case 'removeHelper':
        error = t.removeHelper(token, message.helper);
        break;
      case 'helper':
        error = t.joinAsHelper(token, message.code);
        break;
      case 'setSchedule':
        error = t.setSchedule(token, message.schedule);
        break;
      case 'setReferees':
        error = t.setReferees(token, message.on);
        break;
    }
    if (error) return this.sendTo(ws, { type: 'error', message: error });
    await this.changed();
  }

  override async webSocketClose(ws: WebSocket, code: number): Promise<void> {
    try {
      ws.close(code === 1005 ? 1000 : code, 'Tschüss');
    } catch {
      // Schon zu.
    }
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
    await this.ctx.storage.put('tournament', t.snapshot());
    const wake = retry ? Date.now() + 30_000 : t.nextWakeup();
    await this.ctx.storage.setAlarm(Math.max(wake, Date.now() + 1000));
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
