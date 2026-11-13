/**
 * Verbindung zum Spieleserver über das offene Protokoll (#334). Die XR-App kennt keine
 * Spielregeln: Sie zeigt `view`, bietet `legalMoves` (mit `moveLabels`) an und schickt den
 * gewählten Eintrag unverändert zurück. Typen kommen aus `packages/online`.
 */
import { AVATARS, PROTOCOL_VERSION, type ClientMessage, type GameMessage, type RoomMessage, type ServerMessage } from '@brett-und-blatt/online';
import { useCallback, useEffect, useRef, useState } from 'react';

const DEFAULT_SERVER = 'https://brett-und-blatt.lipponer.workers.dev';

/** Adresse des Spieleservers: `?server=` (Tests, lokal) vor Build-Variable vor dem echten Server. */
export function serverUrl(): string {
  const fromQuery = new URLSearchParams(location.search).get('server');
  const fromBuild = import.meta.env.VITE_GAME_SERVER as string | undefined;
  return (fromQuery || fromBuild || DEFAULT_SERVER).replace(/\/+$/, '');
}

const STORE = 'brett-und-blatt-xr';

interface Stored {
  token: string;
  name: string;
  avatar: string;
}

/** Name, Bild und geheime Gerätekennung bleiben im Browser (localStorage, mit Rückfall). */
export function loadProfile(): Stored {
  try {
    const raw = JSON.parse(localStorage.getItem(STORE) ?? 'null') as Partial<Stored> | null;
    if (raw?.token && raw.token.length >= 16) return { token: raw.token, name: raw.name ?? 'Gast', avatar: raw.avatar ?? AVATARS[0]! };
  } catch {
    // Kein Speicher (privates Fenster): dann gilt die Kennung nur für diese Sitzung.
  }
  const profile = { token: `xr-${crypto.randomUUID()}`, name: 'Gast', avatar: AVATARS[0]! };
  saveProfile(profile);
  return profile;
}

export function saveProfile(profile: Stored): void {
  try {
    localStorage.setItem(STORE, JSON.stringify(profile));
  } catch {
    // ohne Speicher weiter
  }
}

export async function createRoom(server: string): Promise<string> {
  const response = await fetch(`${server}/rooms`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ isPublic: false }) });
  if (response.status !== 201) throw new Error(`Raum anlegen ging nicht (HTTP ${response.status}).`);
  return ((await response.json()) as { code: string }).code;
}

/** Eine Reaktion oder Schnellnachricht, die gerade über einem Platz schwebt. */
export interface Signal {
  id: number;
  from: string;
  kind: 'react' | 'say';
  value: string;
  at: number;
}

export interface RoomState {
  status: 'connecting' | 'open' | 'reconnecting' | 'closed';
  you: string | null;
  room: RoomMessage | null;
  game: GameMessage | null;
  signals: Signal[];
  error: string | null;
  /** Für die Lastmessung (#339): empfangene Nachrichten und Zeichen, gesendete Nachrichten. */
  stats: { received: number; receivedChars: number; sent: number };
}

/**
 * Hält die WebSocket-Verbindung zu einem Raum, meldet sich mit `hello` an und verbindet nach
 * einem Abbruch mit demselben Token neu (Wiedereinstieg). Ein Herzschlag mit `ping` bemerkt
 * Funklöcher, die sich sonst nicht melden.
 */
export function useRoom(server: string, code: string | null, profile: Stored) {
  const [state, setState] = useState<RoomState>({ status: 'connecting', you: null, room: null, game: null, signals: [], error: null, stats: { received: 0, receivedChars: 0, sent: 0 } });
  const socket = useRef<WebSocket | null>(null);
  const stats = useRef({ received: 0, receivedChars: 0, sent: 0 });

  const send = useCallback((message: ClientMessage) => {
    const ws = socket.current;
    if (ws?.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify(message));
    stats.current.sent++;
  }, []);

  useEffect(() => {
    if (!code) return;
    let stopped = false;
    let retries = 0;
    let heartbeat = 0;
    let lastHeard = Date.now();
    let signalId = 0;
    const url = `${server.replace(/^http/, 'ws')}/rooms/${encodeURIComponent(code)}`;

    const connect = () => {
      const ws = new WebSocket(url);
      socket.current = ws;
      ws.onopen = () => ws.send(JSON.stringify({ type: 'hello', protocol: PROTOCOL_VERSION, token: profile.token, name: profile.name, avatar: profile.avatar } satisfies ClientMessage));
      ws.onmessage = (event) => {
        lastHeard = Date.now();
        const text = String(event.data);
        stats.current.received++;
        stats.current.receivedChars += text.length;
        // Für Tests und die Lastmessung lesbar (keine Geheimnisse, nur Zähler).
        (window as unknown as { __brettXrStats?: unknown }).__brettXrStats = stats.current;
        let message: ServerMessage;
        try {
          message = JSON.parse(text) as ServerMessage;
        } catch {
          return;
        }
        setState((s) => {
          const next = { ...s, stats: { ...stats.current } };
          switch (message.type) {
            case 'welcome':
              retries = 0;
              return { ...next, status: 'open', you: message.you, error: null };
            case 'room':
              return { ...next, room: message, game: message.phase === 'lobby' ? null : s.game };
            case 'game':
              return { ...next, game: message };
            case 'signal': {
              const now = Date.now();
              const fresh = s.signals.filter((x) => now - x.at < 4000);
              return { ...next, signals: [...fresh, { id: ++signalId, from: message.from, kind: message.kind, value: message.value, at: now }] };
            }
            case 'error':
              return { ...next, error: message.message };
            default:
              // Unbekannte Nachrichten still übergehen (Protokoll, „Versionen“).
              return next;
          }
        });
      };
      ws.onclose = () => {
        if (socket.current !== ws || stopped) return;
        clearInterval(heartbeat);
        retries++;
        setState((s) => ({ ...s, status: retries > 8 ? 'closed' : 'reconnecting' }));
        if (retries <= 8) setTimeout(connect, Math.min(500 * 2 ** (retries - 1), 8000));
      };
      clearInterval(heartbeat);
      heartbeat = window.setInterval(() => {
        if (Date.now() - lastHeard > 25_000) return ws.close();
        if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'ping' }));
      }, 10_000);
    };
    connect();
    return () => {
      stopped = true;
      clearInterval(heartbeat);
      socket.current?.close();
      socket.current = null;
    };
  }, [server, code, profile.token, profile.name, profile.avatar]);

  return { ...state, send };
}

/** Den Zug aus `legalMoves` mit der zuletzt gesehenen Version schicken. */
export function sendMove(send: (m: ClientMessage) => void, game: GameMessage, move: unknown): void {
  send({ type: 'move', version: game.version, move });
}
