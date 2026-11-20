import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync(new URL('../apps/web/src/screens/Tournament.tsx', import.meta.url), 'utf8');

describe('Turnierseite bindet ihre Bausteine ein (#551, #552)', () => {
  it('„Leitung übergeben“ und „Serie zuordnen“ werden irgendwo gerendert, nicht nur definiert', () => {
    expect(source).toMatch(/<LeaderTransfer /);
    expect(source).toMatch(/<SeriesAttach /);
    // nur über die Hauptleitungs-Prüfung (keine Mitleitung, keine Helfer)
    expect(source).toMatch(/if \(!view\.isLeader \|\| view\.helperRole\) return null;/);
    // ohne Netz keine Leitungsübergabe, die Serie aber wird vorgemerkt
    expect(source).toMatch(/\{!offline && <LeaderTransfer /);
    expect(source).toMatch(/<SeriesAttach view=\{view\} send=\{send\} offline=\{offline\} \/>/);
  });

  it('Kalenderknöpfe hängen nicht mehr im Bereich „Drucken und Export“', () => {
    const print = source.slice(source.indexOf('function PrintTools('), source.indexOf('/** Druckansicht'));
    expect(print).not.toMatch(/Kalender|tournament\.cal\.|buildIcs/);
    expect(source).toMatch(/<CalendarButtons view=\{view\} \/>/);
  });
});
