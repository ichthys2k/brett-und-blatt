import type { Card, RunState, ViewCard } from '../types';

/**
 * Die ausgewählten Handkarten, soweit sie offen liegen – nur in der Audienz.
 *
 * Beim Auspacken eines Bündels zeigen die Auswahl-Nummern auf `run.pack.hand`, nicht auf
 * `run.hand` (die ist dann leer). Früher wurde trotzdem `run.hand[i]` gelesen: Wer im
 * Trickbeutel oder in der Wunderkiste eine Karte antippte, bekam einen leeren Bildschirm (#71).
 */
export function pickedHandCards(run: Pick<RunState, 'phase'> & { hand: readonly (Card | ViewCard)[] }, picked: number[]): Card[] {
  if (run.phase !== 'play') return [];
  return picked.flatMap((i) => {
    const card = run.hand[i];
    return card && !('hidden' in card) ? [card] : [];
  });
}
