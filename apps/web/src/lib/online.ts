import { OnlineSession, PROTOCOL_VERSION, type ClientMessage, type GameMessage, type RoomMessage, type ServerMessage } from '@brett-und-blatt/online';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { createBotRunner } from './botRunner';
import { notifyTurn } from './notifications';
import { loadGame, type LoadedGame } from './registry';
import { sound } from './sound';
import { storage, type Profile } from './storage';

/**
 * Adresse des Spieleservers. Beim Bauen über VITE_GAME_SERVER festgelegt; im
 * Dev-Modus der lokale Server (`wrangler dev`). Ohne Adresse gibt es keine Online-Spiele.
 */
export const GAME_SERVER: string | null = import.meta.env.VITE_GAME_SERVER || (import.meta.env.DEV ? 'http://127.0.0.1:8787' : null);

export async function createRoom(): Promise<string> {
  const response = await fetch(`${GAME_SERVER}/rooms`, { method: 'POST' });
  if (!response.ok) throw new Error(`Server antwortet mit ${response.status}`);
  return ((await response.json()) as { code: string }).code;
}

export async function roomExists(code: string): Promise<boolean> {
  const response = await fetch(`${GAME_SERVER}/rooms/${encodeURIComponent(code)}`);
  return response.ok && ((await response.json()) as { exists: boolean }).exists;
}

export type ConnectionStatus = 'connecting' | 'open' | 'reconnecting' | 'gone' | 'kicked' | 'outdated' | 'left';

export interface Signal {
  id: number;
  from: string;
  kind: 'react' | 'say';
  value: string;
}

export interface RoomState {
  status: ConnectionStatus;
  /** Die eigene Mitgliedsnummer im Raum. */
  you: string | null;
  room: RoomMessage | null;
  game: { session: OnlineSession; loaded: LoadedGame } | null;
  error: string | null;
  signals: Signal[];
}

let botRunner: ReturnType<typeof createBotRunner> | null = null;

/**
 * Die Verbindung zu einem Raum. Bricht sie ab (Funkloch, Handy gesperrt), verbindet
 * sie sich selbst wieder – mit wachsenden Pausen, damit ein ausgefallener Server
 * nicht von allen gleichzeitig überrannt wird.
 */
export class RoomConnection {
  state: RoomState = { status: 'connecting', you: null, room: null, game: null, error: null, signals: [] };
  private ws: WebSocket | null = null;
  private listeners = new Set<() => void>();
  private retries = 0;
  private retryTimer: number | undefined;
  private stopped = false;
  private nextSignal = 1;
  /** Spielnachricht, die eintraf, während die Regeln noch geladen werden. */
  private pendingGame: GameMessage | null = null;
  private loadingGame: string | null = null;

  constructor(
    readonly code: string,
    private profile: Profile,
  ) {
    this.connect();
    document.addEventListener('visibilitychange', this.onVisible);
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getState = (): RoomState => this.state;

  send(message: ClientMessage): void {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(message));
  }

  /** Den Raum endgültig verlassen: Der Platz geht an den Computer. */
  leave(): void {
    this.send({ type: 'leave' });
    this.set({ status: 'left' });
    this.dispose();
  }

  dispose(): void {
    this.stopped = true;
    window.clearTimeout(this.retryTimer);
    document.removeEventListener('visibilitychange', this.onVisible);
    this.ws?.close();
    this.ws = null;
  }

  private set(change: Partial<RoomState>): void {
    this.state = { ...this.state, ...change };
    for (const listener of this.listeners) listener();
  }

  private connect(): void {
    if (this.stopped) return;
    const url = `${GAME_SERVER!.replace(/^http/, 'ws')}/rooms/${encodeURIComponent(this.code)}`;
    const ws = new WebSocket(url);
    this.ws = ws;
    let opened = false;
    ws.onopen = () => {
      opened = true;
      this.retries = 0;
      ws.send(JSON.stringify({ type: 'hello', protocol: PROTOCOL_VERSION, token: storage.deviceToken(), name: this.profile.name, avatar: this.profile.avatar } satisfies ClientMessage));
    };
    ws.onmessage = (event) => {
      if (typeof event.data === 'string') this.receive(JSON.parse(event.data) as ServerMessage);
    };
    ws.onclose = () => {
      if (this.ws !== ws || this.stopped) return;
      this.ws = null;
      if (['kicked', 'outdated', 'left'].includes(this.state.status)) return;
      // Kam gar keine Verbindung zustande, gibt es den Raum vielleicht nicht mehr.
      if (!opened) {
        roomExists(this.code).then(
          (exists) => (exists ? this.retry() : this.set({ status: 'gone' })),
          () => this.retry(),
        );
        return;
      }
      this.retry();
    };
  }

  private retry(): void {
    if (this.stopped) return;
    this.set({ status: 'reconnecting' });
    const delay = Math.min(10_000, 500 * 2 ** this.retries) * (0.75 + Math.random() * 0.5);
    this.retries++;
    this.retryTimer = window.setTimeout(() => this.connect(), delay);
  }

  /** Zurück im Vordergrund (Handy entsperrt): sofort neu verbinden statt zu warten. */
  private onVisible = (): void => {
    if (document.hidden || this.stopped || this.ws || this.state.status !== 'reconnecting') return;
    window.clearTimeout(this.retryTimer);
    this.connect();
  };

  private receive(message: ServerMessage): void {
    switch (message.type) {
      case 'welcome':
        return this.set({ status: 'open', you: message.you });
      case 'room':
        // In der Lobby gibt es keine laufende Partie mehr – auch keine, die gerade noch lädt.
        if (message.phase === 'lobby') this.pendingGame = null;
        return this.set(message.phase === 'lobby' ? { room: message, game: null } : { room: message });
      case 'game':
        return this.receiveGame(message);
      case 'signal': {
        const signal: Signal = { id: this.nextSignal++, from: message.from, kind: message.kind, value: message.value };
        this.set({ signals: [...this.state.signals.slice(-4), signal] });
        if (message.from !== this.state.you) sound.play('reaktion');
        window.setTimeout(() => this.set({ signals: this.state.signals.filter((s) => s.id !== signal.id) }), 3500);
        return;
      }
      case 'error':
        // Veraltete Züge löst der Server selbst auf – kein Grund für eine Meldung.
        if (message.code === 'staleMove') return;
        if (message.code === 'protocol') return this.set({ status: 'outdated' });
        this.set({ error: message.message });
        window.setTimeout(() => this.state.error === message.message && this.set({ error: null }), 4000);
        return;
      case 'kicked':
        return this.set({ status: 'kicked' });
      case 'pong':
        return;
    }
  }

  private receiveGame(message: GameMessage): void {
    const current = this.state.game;
    if (current && current.session.id === `${this.code}/${message.round}` && current.loaded.info.id === message.gameId) {
      current.session.update(message);
      if (message.yourSeat !== null && message.current.includes(message.yourSeat)) {
        notifyTurn(current.loaded.info.name);
      }
      return;
    }
    // Neue Partie: erst Regeln und Oberfläche laden, dann die Sitzung anlegen.
    this.pendingGame = message;
    if (this.loadingGame === message.gameId) return;
    this.loadingGame = message.gameId;
    loadGame(message.gameId).then((loaded) => {
      this.loadingGame = null;
      const latest = this.pendingGame;
      this.pendingGame = null;
      if (!latest || latest.gameId !== loaded.info.id || this.stopped) return;
      botRunner ??= createBotRunner();
      const session = new OnlineSession(latest, { module: loaded.module, roomCode: this.code, send: (m) => this.send(m), botRunner });
      this.set({ game: { session, loaded } });
      if (latest.yourSeat !== null && latest.current.includes(latest.yourSeat)) {
        notifyTurn(loaded.info.name);
      }
    });
  }
}

/** Verbindung zu einem Raum für die Dauer eines Bildschirms. */
export function useRoomConnection(code: string, profile: Profile | null): [RoomState | null, RoomConnection | null] {
  const [connection, setConnection] = useState<RoomConnection | null>(null);
  useEffect(() => {
    if (!profile || !GAME_SERVER) return;
    const next = new RoomConnection(code, profile);
    setConnection(next);
    return () => next.dispose();
  }, [code, profile]);
  const state = useSyncExternalStore(connection?.subscribe ?? noopSubscribe, connection?.getState ?? nullState);
  return [connection ? state : null, connection];
}

const noopSubscribe = () => () => {};
const nullState = () => null;
