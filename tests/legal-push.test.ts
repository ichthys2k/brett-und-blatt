import { describe, expect, it } from 'vitest';
import { PUSH_LIMIT_MS } from '../packages/online/src/push';
import { CORRESPONDENCE_ROOM_TTL_MS } from '../packages/online/src/room';
import { LEAGUE_KEEP_MS, TOURNAMENT_KEEP_MS } from '../packages/online/src/tournament/types';

// Ohne Node-Typen: das eingebaute Modul über `process` holen (wie in tests/repo.test.ts).
const fs = (globalThis as unknown as { process: { getBuiltinModule(name: 'node:fs'): { readFileSync(path: URL, encoding: 'utf8'): string } } }).process.getBuiltinModule('node:fs');

/** Datenschutzerklärung zu Hinweisen aufs Gerät (#242, Schritt 8): der Entwurf nennt, was die Technik tatsächlich tut. */
describe('Datenschutz: Hinweise aufs Gerät', () => {
  const source = fs.readFileSync(new URL('../apps/web/src/screens/Legal.tsx', import.meta.url), 'utf8');
  const start = source.indexOf('export function PushPrivacy');
  const end = source.indexOf('export function Datenschutz');
  const text = source.slice(start, end).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

  it('nennt Zweck, Daten, Empfänger, Dauer, Widerruf und Rechtsgrundlage', () => {
    for (const part of ['Hinweise aufs Gerät (Web Push)', 'freiwillig', 'Endpunkt', 'Geräte-Kennung', 'Google, Apple, Mozilla oder Microsoft', 'keine Namen', '30 Tage', 'ausschalten', 'Einwilligung', 'Art. 6 Abs. 1 lit. a', 'keine Zustellgarantie']) {
      expect(text, part).toContain(part);
    }
  });

  it('erscheint nur, wenn die Funktion sichtbar ist', () => {
    expect(source).toContain('{PUSH_PUBLIC_KEY && <PushPrivacy />}');
  });

  it('die genannten Fristen und Grenzen stimmen mit dem Code überein', () => {
    expect(PUSH_LIMIT_MS).toBe(30 * 60 * 1000);
    expect(TOURNAMENT_KEEP_MS).toBe(30 * 86_400_000);
    expect(LEAGUE_KEEP_MS).toBe(365 * 86_400_000);
    expect(CORRESPONDENCE_ROOM_TTL_MS).toBe(30 * 86_400_000);
  });
});
