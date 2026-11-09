/*
 * Betreiber-Schlüssel: ein langes Geheimwort (`wrangler secret put OPERATOR_KEY`), mit dem der Betreiber per Kommandozeile Turniere und
 * Klassen löscht. Kein Konto, keine Oberfläche. Ist das Secret nicht gesetzt, gibt es die Endpunkte nicht.
 */

const enc = new TextEncoder();

async function digest(text: string): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(text)));
}

/** Vergleich ohne Zeitunterschied: beide Seiten werden zuerst gehasht, dann gleich lange Bytes verglichen. */
export async function sameKey(given: string, expected: string): Promise<boolean> {
  const [a, b] = await Promise.all([digest(given), digest(expected)]);
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i]! ^ b[i]!;
  return diff === 0;
}

/** Der Schlüssel aus `Authorization: Bearer …`, sonst null. */
export function bearerKey(request: Request): string | null {
  const header = request.headers.get('Authorization') ?? '';
  const match = /^Bearer\s+(\S{16,200})$/.exec(header);
  return match ? match[1]! : null;
}

export async function isOperator(request: Request, key: string | undefined): Promise<boolean> {
  if (!key || key.length < 16) return false;
  const given = bearerKey(request);
  return given !== null && (await sameKey(given, key));
}
