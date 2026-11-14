import type { BoardServerMessage, SeekBoardView, SeekError } from '@brett-und-blatt/online';
import { useCallback, useEffect, useRef, useState } from 'react';
import { boardAlerts } from './boardAlerts';
import { disablePush, type PushSubscribeMessage } from './push';
import { notifyHidden } from './notifications';
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
  /** Hinweise aufs Gerät: Antwort des Servers (`null`, solange sie fehlt oder die Funktion aus ist). */
  push: boolean | null;
}

const INITIAL: BoardState = { status: 'connecting', you: null, notes: [], proposal: null, error: null, push: null };
const PING_MS = 25_000;

export interface BoardActions {
  post(input: { name: string; avatar: string; games: string[]; seats: string; mood: string }): void;
  withdraw(): void;
  extend(): void;
  join(noteId: string, gameId: string): void;
  unjoin(noteId: string): void;
  confirm(noteId: string, ok: boolean): void;
  pushOn(message: PushSubscribeMessage): void;
  pushOff(): void;
}

/** Hängt die Seite ans Schwarze Brett; ohne Spieleserver bleibt sie leer. */
export function useBoard(): [BoardState, BoardActions] {
  const [state, setState] = useState<BoardState>(INITIAL);
  const socket = useRef<WebSocket | null>(null);
  const lastView = useRef<SeekBoardView | null>(null);

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
        if (message.type === 'board') {
          // Liegt die Seite im Hintergrund, sagt eine Benachrichtigung Bescheid (falls erlaubt).
          for (const alert of boardAlerts(lastView.current, message)) notifyHidden(alert.title, alert.body);
          lastView.current = { notes: message.notes, proposal: message.proposal };
          setState((s) => ({ ...s, status: 'open', you: message.you, notes: message.notes, proposal: message.proposal }));
        }
        else if (message.type === 'pushState') setState((s) => ({ ...s, push: message.enabled }));
        else if (message.type === 'boardError') setState((s) => ({ ...s, error: message.error }));
        else if (message.type === 'matched') {
          notifyHidden('Schwarzes Brett', 'Dein Raum steht – komm herein!');
          navigate(paths.room(message.code));
        }
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
    pushOn: (message) => send(message),
    pushOff: () => {
      send({ type: 'pushUnsubscribe' });
      void disablePush();
    },
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

/**
 * Hängt die eigene offene Runde als Zettel ans Brett („Mitspieler gesucht“, Konzept Punkt 5). Dafür genügt eine kurze
 * Verbindung: Das Brett prüft, dass die Runde wirklich in „Offene Runden“ steht, und nimmt den Zettel ab, sobald sie voll
 * ist oder startet. Gibt `'ok'` oder den Fehlercode des Bretts zurück.
 */
export function postRoomNote(input: { name: string; avatar: string; code: string; seats: string; mood: string }): Promise<'ok' | SeekError | 'hello' | 'message' | 'offline'> {
  const server = GAME_SERVER;
  if (!server) return Promise.resolve('offline');
  return new Promise((resolve) => {
    const ws = new WebSocket(`${server.replace(/^http/, 'ws')}/brett`);
    let sent = false;
    const done = (result: Awaited<ReturnType<typeof postRoomNote>>) => {
      window.clearTimeout(timer);
      ws.close();
      resolve(result);
    };
    const timer = window.setTimeout(() => done('offline'), 8000);
    ws.onopen = () => ws.send(JSON.stringify({ type: 'hello', token: storage.deviceToken() }));
    ws.onerror = () => done('offline');
    ws.onmessage = (event) => {
      if (typeof event.data !== 'string') return;
      let message: BoardServerMessage;
      try {
        message = JSON.parse(event.data) as BoardServerMessage;
      } catch {
        return;
      }
      if (message.type === 'boardError') return done(message.error);
      if (message.type !== 'board' || message.you === null) return;
      if (!sent) {
        sent = true;
        ws.send(JSON.stringify({ type: 'postRoom', ...input }));
      } else if (message.notes.some((note) => note.mine && note.room === input.code)) done('ok');
    };
  });
}
