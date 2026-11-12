/**
 * Erzeugt ein VAPID-Schlüsselpaar für Web Push (#242, RFC 8292, ES256 auf P-256).
 *
 * Aufruf:
 *   node apps/server/scripts/vapid.mjs            Schlüsselpaar ausgeben (privater Schlüssel nur auf dem Bildschirm)
 *   node apps/server/scripts/vapid.mjs --dev      schreibt apps/server/.dev.vars für den lokalen Testserver (steht in .gitignore)
 *   node apps/server/scripts/vapid.mjs --put      legt den privaten Schlüssel direkt als Wrangler-Secret ab (wird nie angezeigt)
 *
 * Der private Schlüssel gehört nur als Secret auf den Server (`wrangler secret put VAPID_PRIVATE_KEY`) und lokal in
 * `.dev.vars`. Nie in Repo, Issue, Chat oder Log. Der öffentliche Schlüssel ist nicht geheim: Er kommt als GitHub-Variable
 * `VAPID_PUBLIC_KEY` in den Build und auf den Server (siehe docs/spiele/web-push.md).
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const mode = process.argv[2] ?? '';
if (!['', '--dev', '--put'].includes(mode)) {
  console.error('Unbekannte Option. Erlaubt: --dev oder --put (oder keine).');
  process.exit(1);
}

const b64url = (bytes) => Buffer.from(bytes).toString('base64url');
const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
const publicKey = b64url(new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey)));
const privateKey = (await crypto.subtle.exportKey('jwk', pair.privateKey)).d;
if (publicKey.length !== 87 || !privateKey || privateKey.length !== 43) throw new Error('Unerwartete Schlüssellänge');

const subject = 'https://spiele.lipponer.de';
const server = join(dirname(fileURLToPath(import.meta.url)), '..');

if (mode === '--dev') {
  const file = join(server, '.dev.vars');
  // Vorhandene Zeilen bleiben (z. B. Anmelde-Secrets); nur die VAPID-Zeilen werden ersetzt.
  const kept = existsSync(file) ? readFileSync(file, 'utf8').split('\n').filter((line) => line.trim() && !line.startsWith('VAPID_')) : [];
  writeFileSync(file, [...kept, `VAPID_PRIVATE_KEY=${privateKey}`, `VAPID_PUBLIC_KEY=${publicKey}`, `VAPID_SUBJECT=${subject}`, ''].join('\n'));
  console.log(`apps/server/.dev.vars geschrieben (nur lokal, nicht im Repo).`);
  console.log(`Öffentlicher Schlüssel: ${publicKey}`);
  console.log('Lokal sichtbar machen: beim Bauen der Web-App VITE_VAPID_PUBLIC_KEY=<dieser Schlüssel> setzen.');
} else if (mode === '--put') {
  // Der private Schlüssel geht über die Standardeingabe an Wrangler und wird nie ausgegeben.
  const result = spawnSync('corepack', ['pnpm', 'exec', 'wrangler', 'secret', 'put', 'VAPID_PRIVATE_KEY'], { cwd: server, input: privateKey, stdio: ['pipe', 'inherit', 'inherit'] });
  if (result.status !== 0) {
    console.error('Wrangler hat das Secret nicht angelegt; es wurde nichts gespeichert. Bitte noch einmal versuchen.');
    process.exit(1);
  }
  console.log('Secret VAPID_PRIVATE_KEY angelegt.');
  console.log(`Öffentlicher Schlüssel (als GitHub-Variable VAPID_PUBLIC_KEY eintragen): ${publicKey}`);
  console.log(`Absender (GitHub-Variable VAPID_SUBJECT, optional; Standard ${subject})`);
} else {
  console.log(`Öffentlicher Schlüssel (GitHub-Variable VAPID_PUBLIC_KEY):\n${publicKey}\n`);
  console.log(`Absender (GitHub-Variable VAPID_SUBJECT, optional; Standard ${subject}):\n${subject}\n`);
  console.log('Privater Schlüssel – geheim, nur für `wrangler secret put VAPID_PRIVATE_KEY`, nirgends sonst speichern:');
  console.log(privateKey);
}
