/** Zugtexte (#335, #358): kurze deutsche Beschreibung eines Zugs, auch für den Bildschirmleser und die VR-App. */
import type { LigrettoMove, LigrettoView } from './rules';

export function describeMove(_view: LigrettoView, move: LigrettoMove): string {
  switch (move.type) {
    case 'play': {
      const from = move.source.from === 'ligretto' ? 'Kartenblitz-Stapel' : move.source.from === 'talon' ? 'Talon' : `Reihe Platz ${move.source.slot + 1}`;
      return `${from} auf ${move.pile === null ? 'neuen Stapel' : `Stapel ${move.pile + 1}`}`;
    }
    case 'flip':
      return 'Drei Karten umdrehen';
    case 'stuck':
      return 'Komme nicht weiter';
    case 'ready':
      return 'Bereit';
  }
}
