import { deriveKeys, open, seal, type VaultKeys } from './crypto';
import { fetchRemote, putRemote, SyncError, type SyncBlock } from './vault';

/**
 * Spielerausweis (W-052): macht die geheime Kennung, an der ein Online-Raum seine Mitglieder
 * erkennt, auf andere Geräte übertragbar – ohne Konto und ohne neue Serverdaten außer einem
 * verschlüsselten Block in der vorhandenen Sicherungsablage.
 *
 * - **Spielercode:** vier Wörter, leicht abzutippen. Darunter liegt verschlüsselt der Ausweis.
 * - **Sicherungscode und Passkey:** Der Ausweis ist ein weiterer Block der gemeinsamen Sicherung
 *   (`PLAYER_SALT`), der Passkey kommt damit von selbst mit.
 *
 * Die Kennung selbst bleibt beim Anlegen unverändert, darum laufen begonnene Partien weiter.
 */

export interface PlayerPass {
  token: string;
  name: string;
  avatar: string;
  /** Spielercode, damit er auch über Sicherungscode oder Passkey auf ein neues Gerät kommt. */
  code: string | null;
}

/** Eigenes Salt für das Schloss des Spielercodes, getrennt vom Block der Sicherung. */
const CODE_LOCK_SALT = 'brett-und-blatt/spielercode/v1';

const WORDS = [
  'Abend', 'Adler', 'Affe', 'Ahorn', 'Ameise', 'Ampel', 'Anker', 'Apfel', 'Arche', 'Ast', 'Atlas', 'Auto', 'Bach', 'Backe', 'Ball', 'Banane',
  'Bank', 'Bart', 'Bauer', 'Baum', 'Beere', 'Berg', 'Besen', 'Biber', 'Biene', 'Birne', 'Blatt', 'Blume', 'Bogen', 'Boot', 'Brief', 'Brille',
  'Brot', 'Brunnen', 'Buch', 'Burg', 'Dach', 'Dachs', 'Damm', 'Decke', 'Delfin', 'Dorf', 'Drache', 'Dose', 'Eiche', 'Eimer', 'Eis', 'Elch',
  'Elefant', 'Ente', 'Erbse', 'Erde', 'Esel', 'Eule', 'Fackel', 'Fahne', 'Falke', 'Farn', 'Feder', 'Fee', 'Feld', 'Fenster', 'Fisch', 'Flagge',
  'Flasche', 'Flosse', 'Floh', 'Flut', 'Forelle', 'Frosch', 'Fuchs', 'Gabel', 'Gans', 'Garten', 'Geige', 'Giraffe', 'Glocke', 'Gold', 'Gras', 'Gurke',
  'Hafen', 'Hahn', 'Hamster', 'Hase', 'Haus', 'Hecht', 'Hecke', 'Heft', 'Held', 'Hemd', 'Herz', 'Hirsch', 'Honig', 'Horn', 'Hummel', 'Hund',
  'Hut', 'Igel', 'Insel', 'Jacke', 'Jahr', 'Kaffee', 'Kamel', 'Kamm', 'Kanne', 'Karte', 'Kater', 'Katze', 'Kerze', 'Kirsche', 'Kiste', 'Kiwi',
  'Klee', 'Knopf', 'Koala', 'Koffer', 'Kohl', 'Komet', 'Krabbe', 'Kran', 'Krone', 'Kuchen', 'Kugel', 'Kuh', 'Lachs', 'Lampe', 'Laub', 'Leiter',
  'Licht', 'Linde', 'Lineal', 'Lippe', 'Loch', 'Lupe', 'Luchs', 'Marder', 'Markt', 'Maus', 'Meer', 'Melone', 'Mond', 'Moos', 'Motte', 'Mantel',
  'Mühle', 'Mütze', 'Nadel', 'Nagel', 'Nase', 'Nebel', 'Nest', 'Nuss', 'Oase', 'Ofen', 'Orange', 'Otter', 'Paket', 'Palme', 'Panda', 'Papier',
  'Pferd', 'Pilz', 'Pinsel', 'Pirat', 'Pony', 'Pudel', 'Pumpe', 'Puppe', 'Quelle', 'Rabe', 'Rad', 'Rakete', 'Raupe', 'Regen', 'Reh', 'Reis',
  'Ring', 'Ritter', 'Robbe', 'Rose', 'Rübe', 'Säge', 'Sand', 'Schaf', 'Schal', 'Schiff', 'Schuh', 'Schule', 'See', 'Segel', 'Seife', 'Sessel',
  'Sonne', 'Spatz', 'Spiegel', 'Spinne', 'Stern', 'Stift', 'Storch', 'Strand', 'Stuhl', 'Sturm', 'Suppe', 'Tafel', 'Tanne', 'Tasche', 'Tasse', 'Teich',
  'Teller', 'Tiger', 'Tisch', 'Tomate', 'Tor', 'Traube', 'Trommel', 'Tulpe', 'Turm', 'Uhr', 'Ufer', 'Vase', 'Vogel', 'Vulkan', 'Wal', 'Wald',
  'Wand', 'Wasser', 'Weg', 'Wiese', 'Wind', 'Wolf', 'Wolke', 'Wurm', 'Wurzel', 'Zange', 'Zaun', 'Zebra', 'Zelt', 'Ziege', 'Zimmer', 'Zitrone',
  'Zug', 'Zwerg', 'Zweig', 'Zwiebel', 'Kompass', 'Muschel', 'Laterne', 'Schnee', 'Pfeil', 'Rucksack', 'Salat', 'Kakao', 'Tunnel', 'Brücke', 'Wippe', 'Schaukel',
] as const;

export const PLAYER_WORDS: readonly string[] = WORDS;
export const PLAYER_CODE_WORDS = 4;

/** Vier Wörter aus 256: 32 Bit Zufall; jeder Versuch kostet eine Anfrage an den Server. */
export function randomPlayerCode(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(PLAYER_CODE_WORDS)), (b) => WORDS[b]).join('-');
}

const WORD_BY_KEY = new Map(WORDS.map((word) => [word.toLowerCase(), word]));

/** Liest einen eingegebenen Spielercode: Groß/klein und Trennzeichen egal, ein ganzer Link geht auch. */
export function parsePlayerCode(input: string): string | null {
  let text = input.trim();
  const fromLink = /[?&#]ausweis=([^&#\s]+)/i.exec(text);
  if (fromLink) text = decodeURIComponent(fromLink[1]!);
  const parts = text.toLowerCase().split(/[^\p{L}]+/u).filter(Boolean);
  if (parts.length !== PLAYER_CODE_WORDS) return null;
  const words = parts.map((part) => WORD_BY_KEY.get(part));
  return words.every(Boolean) ? words.join('-') : null;
}

/** Macht aus fremden Daten einen gültigen Ausweis oder nichts. */
export function sanitizePlayerPass(value: unknown): PlayerPass | null {
  if (!value || typeof value !== 'object') return null;
  const { token, name, avatar, code } = value as Record<string, unknown>;
  if (typeof token !== 'string' || !/^[\w-]{32,100}$/.test(token)) return null;
  return {
    token,
    name: typeof name === 'string' ? name.slice(0, 40) : '',
    avatar: typeof avatar === 'string' ? avatar.slice(0, 20) : '',
    code: typeof code === 'string' ? parsePlayerCode(code) : null,
  };
}

/** Der Ausweis als Block der gemeinsamen Sicherung: Kennung vom Server, der eigene Name bleibt, falls vorhanden. */
export function playerBlock(salt: string, serverUrl: () => string | null, store: { read(): PlayerPass; write(pass: PlayerPass): void }): SyncBlock<PlayerPass> {
  return {
    salt,
    field: 'player',
    serverUrl,
    read: store.read,
    write: store.write,
    sanitize: (value) => sanitizePlayerPass(value) ?? store.read(),
    merge: (remote, local) => ({
      token: remote.token,
      name: local.name || remote.name,
      avatar: local.name ? local.avatar : remote.avatar,
      code: remote.code ?? local.code,
    }),
    same: (a, b) => a.token === b.token && a.name === b.name && a.avatar === b.avatar && a.code === b.code,
  };
}

function lockKeys(code: string): Promise<VaultKeys> {
  return deriveKeys(new TextEncoder().encode(code), 'code', CODE_LOCK_SALT);
}

/** Legt unter einem frischen Spielercode ein Schloss an und liefert den Code. */
export async function createPlayerLock(serverUrl: () => string | null, pass: PlayerPass): Promise<string> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const code = randomPlayerCode();
    const keys = await lockKeys(code);
    if (await fetchRemote(serverUrl, keys.id)) continue;
    if (await putRemote(serverUrl, keys.id, await seal(keys, { v: 1, player: { ...pass, code } }), 0)) return code;
  }
  throw new SyncError('Kein freier Code gefunden. Noch einmal versuchen.');
}

async function replaceLock(serverUrl: () => string | null, code: string, content: unknown): Promise<void> {
  const keys = await lockKeys(code);
  for (let attempt = 0; attempt < 3; attempt++) {
    const remote = await fetchRemote(serverUrl, keys.id);
    if (await putRemote(serverUrl, keys.id, await seal(keys, content), remote?.rev ?? 0)) return;
  }
  throw new SyncError('Andere Geräte schreiben gerade gleichzeitig. Gleich noch einmal versuchen.');
}

/** Schreibt Name und Bild in das vorhandene Schloss, damit ein neues Gerät sie mitbekommt. */
export function updatePlayerLock(serverUrl: () => string | null, code: string, pass: PlayerPass): Promise<void> {
  return replaceLock(serverUrl, code, { v: 1, player: { ...pass, code } });
}

/** Macht einen Spielercode ungültig: Das Schloss bleibt, enthält aber keinen Ausweis mehr. */
export function revokePlayerLock(serverUrl: () => string | null, code: string): Promise<void> {
  return replaceLock(serverUrl, code, { v: 1, revoked: true });
}

/** Öffnet das Schloss eines Spielercodes. */
export async function openPlayerLock(serverUrl: () => string | null, code: string): Promise<PlayerPass> {
  const keys = await lockKeys(code);
  const remote = await fetchRemote(serverUrl, keys.id);
  if (!remote) throw new SyncError('Zu diesem Spielercode gibt es keinen Ausweis. Bitte genau abschreiben.');
  let value: { player?: unknown; revoked?: unknown };
  try {
    value = (await open(keys, remote.data)) as typeof value;
  } catch {
    throw new SyncError('Der Ausweis lässt sich mit diesem Code nicht öffnen.');
  }
  if (value?.revoked) throw new SyncError('Dieser Spielercode wurde durch einen neuen ersetzt.');
  const pass = sanitizePlayerPass(value?.player);
  if (!pass) throw new SyncError('Der Ausweis lässt sich mit diesem Code nicht öffnen.');
  return { ...pass, code };
}
