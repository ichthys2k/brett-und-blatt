import { describe, expect, it } from 'vitest';
// @ts-expect-error – reines JavaScript-Skript ohne Typen
import { SCHEMA_FILE, buildProtocolSchema } from '../scripts/protokoll-schema.mjs';

// Ohne @types/node: das eingebaute Modul über process holen (wie in tests/repo.test.ts).
const { readFileSync } = (globalThis as unknown as { process: { getBuiltinModule(name: 'node:fs'): { readFileSync(path: string, encoding: 'utf8'): string } } }).process.getBuiltinModule('node:fs');

describe('Online-Protokoll: JSON-Schema (#334)', () => {
  it('docs/protokoll.schema.json passt zu packages/online/src/protocol.ts', () => {
    const expected = (buildProtocolSchema as () => string)();
    const current = readFileSync(SCHEMA_FILE as string, 'utf8');
    expect(current, 'Schema veraltet: node scripts/protokoll-schema.mjs ausführen').toBe(expected);
  }, 60_000);

  it('beschreibt beide Richtungen und die Partie-Nachricht', () => {
    const schema = JSON.parse(readFileSync(SCHEMA_FILE as string, 'utf8')) as { definitions: Record<string, unknown> };
    for (const name of ['ClientMessage', 'ServerMessage', 'GameMessage', 'RoomMessage', 'ErrorCode']) {
      expect(schema.definitions, name).toHaveProperty(name);
    }
  });
});
