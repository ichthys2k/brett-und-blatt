// Erzeugt das JSON-Schema des Online-Protokolls (#334) aus packages/online/src/protocol.ts.
// Aufruf:  node scripts/protokoll-schema.mjs           – schreibt docs/protokoll.schema.json
//          node scripts/protokoll-schema.mjs --check   – meldet nur, ob die Datei aktuell ist
// Der Test tests/protokoll-schema.test.ts prüft in der CI, dass die Datei zum Code passt.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createGenerator } from 'ts-json-schema-generator';

const root = fileURLToPath(new URL('..', import.meta.url));
export const SCHEMA_FILE = `${root}docs/protokoll.schema.json`;

/** Baut das Schema mit beiden Richtungen als Text (stabil sortiert, mit Zeilenumbruch am Ende). */
export function buildProtocolSchema() {
  const generator = createGenerator({
    path: `${root}packages/online/src/protocol.ts`,
    tsconfig: `${root}tsconfig.json`,
    type: '*',
    expose: 'export',
    jsDoc: 'extended',
    skipTypeCheck: true,
    additionalProperties: true,
  });
  const client = generator.createSchema('ClientMessage');
  const server = generator.createSchema('ServerMessage');
  const definitions = Object.fromEntries(
    Object.entries({ ...client.definitions, ...server.definitions }).sort(([a], [b]) => a.localeCompare(b)),
  );
  const schema = {
    $schema: 'http://json-schema.org/draft-07/schema#',
    $id: 'https://github.com/ichthys2k/brett-und-blatt/blob/main/docs/protokoll.schema.json',
    title: 'Brett & Blatt – Online-Protokoll',
    description:
      'Nachrichten zwischen Client und Spieleserver (JSON über WebSocket). Erzeugt aus packages/online/src/protocol.ts mit scripts/protokoll-schema.mjs – nicht von Hand ändern. Beschreibung: docs/protokoll.md.',
    oneOf: [{ $ref: '#/definitions/ClientMessage' }, { $ref: '#/definitions/ServerMessage' }],
    definitions,
  };
  return `${JSON.stringify(schema, null, 2)}\n`;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const text = buildProtocolSchema();
  if (process.argv.includes('--check')) {
    let current = '';
    try {
      current = readFileSync(SCHEMA_FILE, 'utf8');
    } catch {
      // fehlt noch
    }
    if (current !== text) {
      console.error('docs/protokoll.schema.json ist veraltet: node scripts/protokoll-schema.mjs ausführen.');
      process.exit(1);
    }
    console.log('docs/protokoll.schema.json ist aktuell.');
  } else {
    writeFileSync(SCHEMA_FILE, text);
    console.log('docs/protokoll.schema.json geschrieben.');
  }
}
