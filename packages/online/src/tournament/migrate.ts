import { defaultScoring } from './scoring';
import type { TournamentSnapshot } from './types';

/** Schnappschuss vor W-058 Stufe 0: ohne `scoring`, Wertung fest aus der Form. */
export type TournamentSnapshotV1 = Omit<TournamentSnapshot, 'version' | 'scoring'> & { version: 1 };

export type StoredTournamentSnapshot = TournamentSnapshotV1 | TournamentSnapshot;

/** Bringt einen gespeicherten Schnappschuss auf den aktuellen Stand. Laufende Turniere spielen unverändert weiter. */
export function upgradeSnapshot(snapshot: StoredTournamentSnapshot): TournamentSnapshot {
  if (snapshot.version === 2) return snapshot;
  return { ...snapshot, version: 2, scoring: defaultScoring(snapshot.settings.format) };
}
