import { PLAYER_EMOJIS, PLAYER_SALT, SyncError, createPassLock, createPlayerLock, fetchRemote, keysFromCode, putRemote, randomCode, randomPassKey, resetPassLock, revokePlayerLock, seal, stretchSecret, type PlayerPass } from '@brett-und-blatt/ui/sync';
import { renderSVG } from 'uqr';
import { classAct } from './classes';
import { mergeChildPasses, randomPin, sanitizeChildPasses, type ChildPass, type ChildPasses } from './classPassesCore';
import { passServer, passSyncSoon, playerLink } from './playerPass';

/*
 * Klassenausweise (#152): Die Leitung legt mit einer Namensliste auf einmal Pässe für die ganze Klasse an. Jeder bekommt Spielercode und
 * Start-PIN und ist schon Mitglied. Die Liste (mit Rettungscode und Passschlüssel der Kinder) liegt im Pass-Block `klassen` der Leitung,
 * der mit deren Passschlüssel verschlüsselt ist – das ist das „Lehrkraft-Schloss“: Vergisst ein Kind die PIN, setzt die Leitung eine neue.
 */

export const CHILD_PASSES_KEY = 'brett-und-blatt:klassenausweise';

export function loadChildPasses(): ChildPasses {
  try {
    return sanitizeChildPasses(JSON.parse(window.localStorage.getItem(CHILD_PASSES_KEY) ?? 'null'));
  } catch {
    return [];
  }
}
export function saveChildPasses(list: ChildPasses): void {
  try {
    window.localStorage.setItem(CHILD_PASSES_KEY, JSON.stringify(list));
  } catch {
    // ohne Speicher gilt die Liste nur bis zum Neuladen
  }
  passSyncSoon();
}
export { mergeChildPasses, sanitizeChildPasses };

function randomToken(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Legt einen Ausweis mit Start-PIN für ein Kind an und trägt es in die Klasse ein. */
async function createChildPass(classCode: string, name: string): Promise<ChildPass> {
  const avatar = PLAYER_EMOJIS[crypto.getRandomValues(new Uint8Array(1))[0]! % PLAYER_EMOJIS.length]!;
  const pass: PlayerPass = { token: randomToken(), name, avatar, code: null, passKey: randomPassKey() };
  const playerCode = await createPlayerLock(passServer, pass);
  const withCode: PlayerPass = { ...pass, code: playerCode };
  // Rettungscode des Kindes: der Ausweis als Block der gemeinsamen Sicherung, wie bei einem eigenen Pass.
  let syncCode = '';
  for (let attempt = 0; attempt < 3 && !syncCode; attempt++) {
    const candidate = randomCode();
    const keys = await keysFromCode(candidate, PLAYER_SALT);
    if (await fetchRemote(passServer, keys.id)) continue;
    if (await putRemote(passServer, keys.id, await seal(keys, { v: 1, player: withCode }), 0)) syncCode = candidate;
  }
  if (!syncCode) throw new SyncError('Kein freier Rettungscode gefunden. Noch einmal versuchen.');
  const pin = randomPin();
  await createPassLock(passServer, playerCode, await stretchSecret(playerCode, pin), syncCode, withCode);
  await revokePlayerLock(passServer, playerCode).catch(() => undefined);
  const reply = await classAct(classCode, 'enroll', { who: { token: pass.token, name, avatar } });
  if (!reply.ok) throw new SyncError(reply.error || 'Das Kind ließ sich nicht in die Klasse eintragen.');
  return { classCode, name, avatar, playerCode, syncCode, passKey: pass.passKey!, token: pass.token, pin, at: Date.now() };
}

/** Legt für jeden Namen einen Klassenausweis an; meldet nach jedem Kind den Stand. Fehler beenden den Lauf, Fertiges bleibt gespeichert. */
export async function createClassPasses(classCode: string, names: readonly string[], onProgress: (done: number, total: number) => void): Promise<{ created: ChildPass[]; error?: string }> {
  const created: ChildPass[] = [];
  try {
    for (const name of names) {
      const entry = await createChildPass(classCode, name);
      created.push(entry);
      saveChildPasses(mergeChildPasses(loadChildPasses(), [entry]));
      onProgress(created.length, names.length);
    }
    return { created };
  } catch (error) {
    return { created, error: error instanceof SyncError ? error.message : 'Das hat nicht geklappt. Später noch einmal versuchen.' };
  }
}

/** Setzt für ein Kind mit der Rettungskarte (Lehrkraft-Schloss) eine neue Start-PIN. */
export async function resetChildPin(entry: ChildPass): Promise<ChildPass> {
  const pin = randomPin();
  const pass: PlayerPass = { token: entry.token, name: entry.name, avatar: entry.avatar, code: entry.playerCode, passKey: entry.passKey };
  await resetPassLock(passServer, entry.playerCode, entry.syncCode, await stretchSecret(entry.playerCode, pin), pass);
  const next = { ...entry, pin, at: Date.now() };
  saveChildPasses(mergeChildPasses(loadChildPasses(), [next]));
  return next;
}

const escape = (text: string) => text.replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]!);

/** Druckansicht: je Kind eine Karte mit Bild, Name, QR-Code (Spielercode) und Start-PIN. Nichts davon geht an einen Server. */
export function printChildCards(entries: readonly ChildPass[], className: string): void {
  const win = window.open('', '_blank', 'width=900,height=1000');
  if (!win) return;
  const cards = entries
    .map((e) => {
      const qr = renderSVG(playerLink(e.playerCode), { border: 1, whiteColor: '#ffffff', blackColor: '#000000' });
      return `<div class="card"><div class="top"><span class="av">${escape(e.avatar)}</span><strong>${escape(e.name)}</strong></div><div class="qr">${qr}</div>
<p>Spielercode: <span class="code">${escape(e.playerCode)}</span></p><p>PIN: <span class="pin">${escape(e.pin)}</span></p><p class="small">Brett &amp; Blatt · spiele.lipponer.de · ${escape(className)}</p></div>`;
    })
    .join('');
  win.document.write(`<!doctype html><html lang="de"><head><meta charset="utf-8"><title>Klassenausweise – ${escape(className)}</title>
<style>body{font:16px system-ui,sans-serif;margin:16px;color:#000}.grid{display:grid;grid-template-columns:repeat(2,1fr);gap:12px}.card{border:2px solid #000;border-radius:10px;padding:12px;break-inside:avoid}
.top{display:flex;align-items:center;gap:10px;font-size:20px}.av{font-size:34px}.qr{width:140px;margin:8px 0}.qr svg{width:100%;height:auto}.code{font-size:24px}.pin{font:bold 24px monospace;letter-spacing:.1em}.small{font-size:11px;color:#444}p{margin:4px 0}</style></head>
<body><h1>Klassenausweise – ${escape(className)}</h1><div class="grid">${cards}</div><script>window.onload=function(){window.print()}</script></body></html>`);
  win.document.close();
}
