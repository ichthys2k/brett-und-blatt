import type { SeekBoardView } from '@brett-und-blatt/online';
import { findGame } from './registry';

/** Ein Hinweis fürs Schwarze Brett (Benachrichtigung, wenn die Seite im Hintergrund liegt). */
export interface BoardAlert {
  title: string;
  body: string;
}

const gameName = (id: string): string => findGame(id)?.name ?? 'ein Spiel';
const votesOnMine = (view: SeekBoardView): number => view.notes.filter((note) => note.mine).reduce((sum, note) => sum + Object.values(note.votes).reduce((a, b) => a + b, 0), 0);

/**
 * Was ist seit der letzten Sicht neu? Jemand sagt auf meinem Zettel „Bin dabei“, oder ein Vorschlag wartet auf meine
 * Zusage. Reine Rechnung, damit sie sich ohne Browser prüfen lässt.
 */
export function boardAlerts(previous: SeekBoardView | null, next: SeekBoardView): BoardAlert[] {
  if (previous === null) return [];
  const alerts: BoardAlert[] = [];
  const before = votesOnMine(previous);
  const after = votesOnMine(next);
  if (after > before) alerts.push({ title: 'Schwarzes Brett', body: after - before === 1 ? 'Jemand hat auf deinem Zettel „Bin dabei“ gesagt.' : `${after - before} Leute haben auf deinem Zettel „Bin dabei“ gesagt.` });
  const proposal = next.proposal;
  const had = previous.proposal;
  if (proposal && !proposal.youConfirmed && (!had || had.noteId !== proposal.noteId || had.gameId !== proposal.gameId)) {
    alerts.push({ title: 'Schwarzes Brett', body: `${gameName(proposal.gameId)} mit ${proposal.names.join(', ')} – los geht’s? Bitte bestätigen.` });
  }
  return alerts;
}
