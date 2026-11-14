/**
 * Wer sich mit dem Spieleserver verbinden darf (#334). Das Protokoll ist offen: Neben der eigenen
 * Web-App dürfen auch fremde Programme (Quest-App, Kommandozeile, Mods) Räume anlegen und spielen.
 *
 * - **Webseiten** schicken immer einen `Origin`-Kopf. Nur eingetragene Webseiten (`ALLOWED_ORIGINS`)
 *   sind erlaubt – so kann keine fremde Seite ihre Besucher unbemerkt in Räume schicken.
 * - **Andere Programme** schicken keinen `Origin`, nennen dafür eine frei gewählte, öffentliche
 *   Kennung `?client=<name>`. Sie ist kein Geheimnis und kein Schutz, sondern dient nur der
 *   Ratenbegrenzung (`MessageBudget`). Schutz geben die Prüfungen des Servers: Jeder Zug wird geprüft,
 *   jede Sicht ist auf den eigenen Platz beschränkt, freien Text gibt es nicht.
 */

/** Kennung eines Clients ohne Webseite: 3–40 Zeichen, Kleinbuchstaben, Ziffern und Bindestriche. */
export const CLIENT_ID_PATTERN = /^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/;

/** Name des Abfrage-Parameters, mit dem sich ein Client ohne Webseite ausweist. */
export const CLIENT_PARAM = 'client';

export type Access = { kind: 'web'; origin: string } | { kind: 'client'; client: string };

/** Prüft eine Client-Kennung; `null`, wenn sie fehlt oder nicht dem Muster folgt. */
export function parseClientId(value: string | null | undefined): string | null {
  return typeof value === 'string' && CLIENT_ID_PATTERN.test(value) ? value : null;
}

/**
 * Entscheidet über den Zugang. Ein vorhandener, aber nicht eingetragener `Origin` wird immer
 * abgelehnt, auch mit Kennung: Eine fremde Webseite darf sich nicht als Programm ausgeben.
 */
export function accessFor(origin: string | null, clientParam: string | null, allowedOrigins: readonly string[]): Access | null {
  if (origin !== null) return allowedOrigins.includes(origin) ? { kind: 'web', origin } : null;
  const client = parseClientId(clientParam);
  return client ? { kind: 'client', client } : null;
}

/** Wie viele Nachrichten ein Client ohne Webseite auf einmal schicken darf … */
export const CLIENT_BURST = 40;
/** … und wie viele je Sekunde nachwachsen. Reicht auch für schnelle Echtzeit-Spiele. */
export const CLIENT_PER_SECOND = 8;

/**
 * Ratenbegrenzung je Verbindung (Eimer mit Marken): Jede Nachricht kostet eine Marke, Marken wachsen
 * gleichmäßig nach. Ist der Eimer leer, wird die Nachricht verworfen.
 */
export class MessageBudget {
  private tokens: number;
  private last: number;

  constructor(
    now: number,
    private readonly burst = CLIENT_BURST,
    private readonly perSecond = CLIENT_PER_SECOND,
  ) {
    this.tokens = burst;
    this.last = now;
  }

  /** `true`, wenn die Nachricht erlaubt ist (und eine Marke verbraucht wurde). */
  take(now: number): boolean {
    const elapsed = Math.max(0, now - this.last);
    this.last = now;
    this.tokens = Math.min(this.burst, this.tokens + (elapsed / 1000) * this.perSecond);
    if (this.tokens < 1) return false;
    this.tokens -= 1;
    return true;
  }
}
