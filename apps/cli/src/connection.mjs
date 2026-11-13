/**
 * Verbindung zum Spieleserver nur über das offene Protokoll (#334, docs/protokoll.md).
 * Kennt keine Spielregeln und keinen Code aus packages/ – mit Absicht: Dieser Client ist
 * die Vorlage für eigene Clients in jeder Sprache (#336).
 */

/** Protokollversion, die dieser Client spricht (`PROTOCOL_VERSION` in protocol.ts). */
export const PROTOCOL = 1;
/** Öffentliche Kennung für die Ratenbegrenzung des Servers. */
export const CLIENT_ID = 'brett-cli';

/** Zufällige geheime Gerätekennung für den Wiedereinstieg. */
export function newToken() {
  return `cli-${crypto.randomUUID()}`;
}

/** Legt einen Raum an und gibt seinen Code zurück (vier Emoji). */
export async function createRoom(server, { isPublic = false, client = CLIENT_ID } = {}) {
  const response = await fetch(`${server}/rooms?client=${client}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ isPublic }),
  });
  if (response.status !== 201) throw new Error(`Raum anlegen ging nicht (HTTP ${response.status}): ${await response.text()}`);
  const { code } = await response.json();
  return code;
}

/** Gibt es den Raum? */
export async function roomExists(server, code, { client = CLIENT_ID } = {}) {
  const response = await fetch(`${server}/rooms/${encodeURIComponent(code)}?client=${client}`);
  if (!response.ok) return false;
  return (await response.json()).exists === true;
}

/**
 * Eine WebSocket-Verbindung zu einem Raum, die nach einem Abbruch selbst neu verbindet und
 * sich mit demselben Token wieder anmeldet (Wiedereinstieg auf den eigenen Platz).
 *
 * Ereignisse über `on(type, fn)`: jede Servernachricht nach ihrem `type` ('welcome', 'room',
 * 'game', 'error', …), dazu 'reconnecting' und 'closed'.
 */
export class Connection {
  constructor({ server, code, token, name, avatar, client = CLIENT_ID, maxRetries = 8 }) {
    this.url = `${server.replace(/^http/, 'ws')}/rooms/${encodeURIComponent(code)}?client=${client}`;
    // `avatar` ist Pflicht; ein Bild außerhalb der Liste AVATARS ersetzt der Server durch das erste.
    this.hello = { type: 'hello', protocol: PROTOCOL, token, name, avatar: avatar ?? '🦉' };
    this.maxRetries = maxRetries;
    this.handlers = new Map();
    this.retries = 0;
    this.closing = false;
    this.you = null;
    this.ws = null;
    this.lastHeard = 0;
    this.heartbeat = null;
  }

  on(type, fn) {
    const list = this.handlers.get(type) ?? [];
    list.push(fn);
    this.handlers.set(type, list);
    return this;
  }

  emit(type, value) {
    for (const fn of this.handlers.get(type) ?? []) fn(value);
  }

  /** Verbindet und meldet sich an; löst auf, sobald `welcome` da ist. */
  connect() {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(this.url);
      this.ws = ws;
      let welcomed = false;
      ws.addEventListener('open', () => ws.send(JSON.stringify(this.hello)));
      ws.addEventListener('message', (event) => {
        this.lastHeard = Date.now();
        let message;
        try {
          message = JSON.parse(String(event.data));
        } catch {
          return;
        }
        if (message.type === 'welcome') {
          welcomed = true;
          this.retries = 0;
          this.you = message.you;
          this.startHeartbeat();
          resolve(message);
        } else if (message.type === 'error' && !welcomed) {
          reject(new Error(`Anmeldung abgelehnt: ${message.code} – ${message.message}`));
        }
        // Unbekannte Nachrichtentypen gehen einfach an niemanden (Protokoll: still übergehen).
        this.emit(message.type, message);
      });
      ws.addEventListener('close', () => {
        if (this.ws !== ws) return;
        if (this.closing) return this.emit('closed', null);
        // Vor der Anmeldung entscheidet der Aufrufer (connect().catch), ob es weitergeht.
        if (!welcomed) return reject(new Error('Verbindung zum Server fehlgeschlagen.'));
        this.lost(ws);
      });
      ws.addEventListener('error', () => {});
    });
  }

  /** Nach einem Abbruch: kurz warten und mit demselben Token neu anmelden. */
  reconnect() {
    if (this.retries >= this.maxRetries) return this.emit('closed', new Error('Server nicht mehr erreichbar.'));
    this.retries++;
    const delay = Math.min(500 * 2 ** (this.retries - 1), 8_000);
    this.emit('reconnecting', { attempt: this.retries, delay });
    setTimeout(() => this.connect().catch(() => this.reconnect()), delay);
  }

  send(message) {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(message));
  }

  /**
   * Herzschlag: alle 10 s ein `ping` (der Server antwortet mit `pong`). Kommt 25 s lang nichts,
   * gilt die Verbindung als verloren – ein Funkloch meldet sich sonst oft gar nicht.
   */
  startHeartbeat() {
    clearInterval(this.heartbeat);
    this.lastHeard = Date.now();
    this.heartbeat = setInterval(() => {
      if (Date.now() - this.lastHeard > 25_000) return this.lost(this.ws);
      this.send({ type: 'ping' });
    }, 10_000);
    this.heartbeat.unref?.();
  }

  /** Die Verbindung ist weg: die alte vergessen und neu verbinden. */
  lost(ws) {
    if (!ws || this.ws !== ws || this.closing) return;
    clearInterval(this.heartbeat);
    this.ws = null;
    try {
      ws.close();
    } catch {
      // schon zu
    }
    this.reconnect();
  }

  /** Nur für Tests: Verbindung hart trennen, als wäre das Netz weg. */
  drop() {
    this.lost(this.ws);
  }

  close() {
    this.closing = true;
    clearInterval(this.heartbeat);
    this.ws?.close();
  }
}
