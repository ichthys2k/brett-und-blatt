/**
 * Gemalte Karten für Rübenacker (G9, #318). Fehlt ein Bild, bleibt die heutige Darstellung (Zahl und Pfoten).
 */
const KARTEN = import.meta.glob<string>('./karten/*.webp', { eager: true, query: '?url', import: 'default' });

/** Bild einer Karte: 1, 2, 3 Schritte oder `mole` für den Maulwurf. */
export const cardImage = (card: 1 | 2 | 3 | 'mole'): string | undefined =>
  KARTEN[`./karten/bub-ruebenacker-karte-${card === 'mole' ? 'maulwurf' : card}.webp`];

const TEILE = import.meta.glob<string>('./teile/*.webp', { eager: true, query: '?url', import: 'default' });

export type TeilName = 'erdhuegel' | 'maulwurf' | 'ruebe' | 'zaunpfahl' | 'hase-rot' | 'hase-blau' | 'hase-gruen' | 'hase-gelb' | 'hase-lila' | 'hase-tuerkis';

/** Freigestelltes Teil für das Feld (Hasen in den Spielerfarben, Rübe, Maulwurf, Erdhügel, Zaunpfahl). */
export const teilImage = (name: TeilName): string | undefined => TEILE[`./teile/${name}.webp`];
