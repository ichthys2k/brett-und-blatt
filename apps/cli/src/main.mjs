#!/usr/bin/env node
/**
 * Brett & Blatt auf der Kommandozeile (#336) – ein Client ohne Spielregeln, nur über das
 * offene Protokoll (docs/protokoll.md). Aufruf siehe `--hilfe`.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { createInterface } from 'node:readline';
import { newToken } from './connection.mjs';
import { startClient } from './play.mjs';

const DEFAULT_SERVER = 'https://brett-und-blatt.lipponer.workers.dev';

const USAGE = `Brett & Blatt auf der Kommandozeile

  node apps/cli/src/main.mjs neu [Optionen]      neuen Raum anlegen und leiten
  node apps/cli/src/main.mjs <Raumcode> [Optionen] Raum mit Code betreten

Optionen:
  --server <url>   Spieleserver (Standard: ${DEFAULT_SERVER})
  --name <name>    eigener Name (Standard: Konsole)
  --spiel <id>     als Leitung gleich dieses Spiel wählen, z. B. tic-tac-toe
  --bot <stufe>    als Leitung alle übrigen Plätze mit Bots besetzen (leicht, mittel, schwer)
  --platz <n>      sich auf Platz n setzen (ab 1)
  --start          Partie beginnen, sobald alle Plätze besetzt sind
  --auto           ohne Eingabe spielen (immer der erste Zug) und nach der Partie enden
  --token <text>   geheime Gerätekennung statt der gespeicherten (für den Wiedereinstieg)

Beispiel: node apps/cli/src/main.mjs neu --spiel tic-tac-toe --bot leicht --start`;

const LEVELS = { leicht: 'easy', mittel: 'medium', schwer: 'hard', easy: 'easy', medium: 'medium', hard: 'hard' };

/** Liest die Befehlszeile; wirft bei unbekannten Angaben. */
export function parseArgs(argv) {
  const options = { server: DEFAULT_SERVER, name: 'Konsole', code: undefined, auto: false, start: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const value = () => {
      const next = argv[++i];
      if (next === undefined) throw new Error(`${arg} braucht einen Wert.`);
      return next;
    };
    if (arg === '--hilfe' || arg === '-h' || arg === '--help') options.help = true;
    else if (arg === '--server') options.server = value().replace(/\/+$/, '');
    else if (arg === '--name') options.name = value();
    else if (arg === '--spiel') options.game = value();
    else if (arg === '--bot') {
      const level = LEVELS[value()];
      if (!level) throw new Error('--bot: leicht, mittel oder schwer');
      options.bot = level;
    } else if (arg === '--platz') {
      const seat = Number(value());
      if (!Number.isInteger(seat) || seat < 1) throw new Error('--platz: eine Zahl ab 1');
      options.seat = seat - 1;
    } else if (arg === '--start') options.start = true;
    else if (arg === '--auto') options.auto = true;
    else if (arg === '--token') options.token = value();
    else if (arg.startsWith('--')) throw new Error(`Unbekannte Option ${arg}`);
    else if (options.code !== undefined) throw new Error(`Doppelte Angabe: ${arg}`);
    else options.code = arg === 'neu' ? null : arg;
  }
  return options;
}

/** Gerätekennung je Server, gespeichert unter ~/.config/brett-und-blatt/cli.json. */
function storedToken(server) {
  const file = join(process.env.XDG_CONFIG_HOME ?? join(homedir(), '.config'), 'brett-und-blatt', 'cli.json');
  let data = {};
  try {
    data = JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    // Noch keine Datei – wird gleich angelegt.
  }
  data.tokens ??= {};
  if (!data.tokens[server]) {
    data.tokens[server] = newToken();
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`, { mode: 0o600 });
  }
  return data.tokens[server];
}

async function main() {
  let options;
  try {
    options = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(`${error.message}\n\n${USAGE}`);
    process.exit(2);
  }
  if (options.help || options.code === undefined) {
    console.log(USAGE);
    process.exit(options.help ? 0 : 2);
  }
  options.token ??= storedToken(options.server);
  const io = { print: (text) => console.log(text) };
  const client = await startClient(options, io);
  if (!options.auto) {
    const lines = createInterface({ input: process.stdin });
    lines.on('line', (line) => client.input(line));
    lines.on('close', () => client.input('ende'));
    client.done.then(() => lines.close());
  }
  await client.done;
  process.exit(0);
}

// Nur als Programm starten, nicht beim Import in Tests.
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
