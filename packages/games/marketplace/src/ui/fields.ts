/**
 * Fachwerkhäuser, Zunftbetriebe und Ortsgrafiken für das Handelsspiel Marktplatz (#73, docs/spiele/marktplatz.md).
 * KI-erzeugte Kunstwerke im Narrenhof-Ölstil (THIRD_PARTY.md, scripts/grafik/manifeste/marktplatz-felder.json).
 */

const files = import.meta.glob<string>('./fields/*.webp', { eager: true, query: '?url', import: 'default' });

export type FieldGraphicId =
  | 'guild-baker'
  | 'guild-weaver'
  | 'guild-beekeeper'
  | 'guild-cobbler'
  | 'guild-smith'
  | 'guild-mason'
  | 'comm-mill'
  | 'comm-bridge'
  | 'comm-scale'
  | 'comm-tavern'
  | 'corner-gate'
  | 'corner-jail'
  | 'corner-fair'
  | 'corner-guard';

export function fieldGraphicFor(field: number): string | null {
  switch (field) {
    case 0:
      return files['./fields/corner-gate.webp'] ?? null;
    case 1:
    case 3:
    case 5:
      return files['./fields/guild-baker.webp'] ?? null;
    case 6:
      return files['./fields/comm-mill.webp'] ?? null;
    case 7:
    case 8:
    case 10:
      return files['./fields/guild-weaver.webp'] ?? null;
    case 9:
      return files['./fields/corner-jail.webp'] ?? null;
    case 12:
    case 13:
    case 15:
      return files['./fields/guild-beekeeper.webp'] ?? null;
    case 14:
      return files['./fields/comm-bridge.webp'] ?? null;
    case 17:
    case 19:
    case 21:
      return files['./fields/guild-cobbler.webp'] ?? null;
    case 18:
      return files['./fields/corner-fair.webp'] ?? null;
    case 22:
      return files['./fields/comm-scale.webp'] ?? null;
    case 23:
    case 25:
    case 26:
      return files['./fields/guild-smith.webp'] ?? null;
    case 27:
      return files['./fields/corner-guard.webp'] ?? null;
    case 28:
    case 30:
    case 34:
      return files['./fields/guild-mason.webp'] ?? null;
    case 29:
      return files['./fields/special-forest.webp'] ?? null;
    case 31:
      return files['./fields/comm-tavern.webp'] ?? null;
    default:
      return null;
  }
}
