import { DurableObject } from 'cloudflare:workers';
import {
  OpenRoomDirectory,
  Room,
  listingNeedsSync,
  parseRoomCode,
  randomRoomCode,
  serverBotRunner,
  type OpenRoomListing,
  type OpenRoomsMessage,
  type RoomDeps,
  type RoomSnapshot,
  type ServerMessage,
} from '@brett-und-blatt/online';
import { BOT_BUDGET_MS, BOT_STEP_MS } from './bots';
import { bibelQuizKatalog } from './bibelquiz';
import { onlineGames } from './games';

/**
 * Der Spieleserver auf Cloudflare – nur ein dünner Adapter: Die ganze Spiellogik
 * steckt in `packages/online` (Klasse `Room`) und in den Spielmodulen.
 *
 * - `POST /rooms` erstellt einen Raum und antwortet mit seinem Emoji-Code.
 * - `GET /rooms` bzw. `GET /rooms/open` liefert offene Spiele der letzten 60 Minuten;
 *   mit WebSocket-Upgrade kommt die Liste live (bei jeder Änderung neu).
 * - `GET /rooms/<code>` mit WebSocket-Upgrade betritt einen Raum.
 * - `GET /bibelquiz/fragen` liefert den Fragenkatalog des Bibel-Quiz (liegt nicht im Browser-Bundle).
 *
 * Jeder Raum ist ein eigenes Durable Object (ein kleiner Server mit Speicher),
 * angelegt in der EU.
 */

interface Env {
  ROOMS: DurableObjectNamespace<GameRoom>;
  LOBBY_REGISTRY: DurableObjectNamespace<LobbyRegistry>;
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

function corsHeaders(request: Request, env: Env): Record<string, string> {
  const origin = request.headers.get('Origin') ?? '';
  const allowed = env.ALLOWED_ORIGINS.split(',').map((o) => o.trim());
  return allowed.includes(origin)
    ? {
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
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
