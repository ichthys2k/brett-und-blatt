import type { BoardServerMessage, SeekBoardView, SeekError } from '@brett-und-blatt/online';
import { useCallback, useEffect, useRef, useState } from 'react';
import { GAME_SERVER } from './server';
import { navigate, paths } from './router';
import { storage } from './storage';

/**
 * Verbindung zum Schwarzen Brett „Wer hat Lust?“ (#65): live per WebSocket (`/brett`). Der Server schickt bei jeder
 * Änderung die ganze Sicht; ein Treffer führt alle Beteiligten in den neuen Raum.
 */
export interface BoardState extends SeekBoardView {
  status: 'connecting' | 'open' | 'offline';
  /** Meine Kurzkennung (mit ihr erkenne ich meinen Zettel). */
  you: string | null;
  /** Letzte Fehlermeldung des Bretts (z. B. „zu schnell“), bis zur nächsten Aktion. */
  error: SeekError | 'hello' | 'message' | null;
}

const INITIAL: BoardState = { status: 'connecting', you: null, notes: [], proposal: null, error: null };
const PING_MS = 25_000;

export interface BoardActions {
  post(input: { name: string; avatar: string; games: string[]; seats: string; mood: string }): void;
  withdraw(): void;
  extend(): void;
  join(noteId: string, gameId: string): void;
  unjoin(noteId: string): void;
  confirm(noteId: string, ok: boolean): void;
}

/** Hängt die Seite ans Schwarze Brett; ohne Spieleserver bleibt sie leer. */
export function useBoard(): [BoardState, BoardActions] {
  const [state, setState] = useState<BoardState>(INITIAL);
  const socket = useRef<WebSocket | null>(null);

  useEffect(() => {
    const server = GAME_SERVER;
    if (!server) {
      setState((s) => ({ ...s, status: 'offline' }));
      return;
    }
    let stopped = false;
    let retries = 0;
    let retryTimer: number | undefined;
    let pingTimer: number | undefined;

    const connect = () => {
      if (stopped) return;
      const ws = new WebSocket(`${server.replace(/^http/, 'ws')}/brett`);
      socket.current = ws;
      ws.onopen = () => {
        retries = 0;
        ws.send(JSON.stringify({ type: 'hello', token: storage.deviceToken() }));
        pingTimer = window.setInterval(() => ws.readyState === WebSocket.OPEN && ws.send('ping'), PING_MS);
      };
      ws.onmessage = (event) => {
        if (typeof event.data !== 'string' || event.data === 'pong') return;
        let message: BoardServerMessage;
        try {
          message = JSON.parse(event.data) as BoardServerMessage;
        } catch {
          return;
        }
        if (message.type === 'board') setState((s) => ({ ...s, status: 'open', you: message.you, notes: message.notes, proposal: message.proposal }));
        else if (message.type === 'boardError') setState((s) => ({ ...s, error: message.error }));
        else if (message.type === 'matched') navigate(paths.room(message.code));
      };
      ws.onclose = () => {
        window.clearInterval(pingTimer);
        if (socket.current !== ws || stopped) return;
        socket.current = null;
        setState((s) => ({ ...s, status: 'connecting' }));
        retryTimer = window.setTimeout(connect, Math.min(30_000, 1000 * 2 ** retries++) * (0.75 + Math.random() * 0.5));
      };
    };
    connect();
    return () => {
      stopped = true;
      window.clearTimeout(retryTimer);
      window.clearInterval(pingTimer);
      const ws = socket.current;
      socket.current = null;
      ws?.close();
    };
  }, []);

  const send = useCallback((message: object) => {
    const ws = socket.current;
    if (ws?.readyState !== WebSocket.OPEN) return;
    setState((s) => (s.error ? { ...s, error: null } : s));
    ws.send(JSON.stringify(message));
  }, []);

  const actions: BoardActions = {
    post: (input) => send({ type: 'post', ...input }),
    withdraw: () => send({ type: 'withdraw' }),
    extend: () => send({ type: 'extend' }),
    join: (noteId, gameId) => send({ type: 'join', noteId, gameId, name: storage.loadProfile()?.name ?? 'Jemand' }),
    unjoin: (noteId) => send({ type: 'unjoin', noteId }),
    confirm: (noteId, ok) => send({ type: 'confirm', noteId, ok }),
  };
  return [state, actions];
}

/** Wie viele Zettel hängen? Für den Hinweis im Hauptmenü; null, wenn der Server nicht antwortet. */
export async function fetchBoardCount(): Promise<number | null> {
  if (!GAME_SERVER) return null;
  try {
    const response = await fetch(`${GAME_SERVER}/brett`);
    if (!response.ok) return null;
    const body = (await response.json()) as { count?: unknown };
    return typeof body.count === 'number' ? body.count : null;
  } catch {
    return null;
  }
}
