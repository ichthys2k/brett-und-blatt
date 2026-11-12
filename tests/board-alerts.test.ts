import type { SeekBoardView, SeekNoteView } from '@brett-und-blatt/online';
import { describe, expect, it } from 'vitest';
import { boardAlerts } from '../apps/web/src/lib/boardAlerts';
import { DEFAULT_CHOICE, sanitizeChoice, startingChoice } from '../apps/web/src/lib/boardChoice';

const note = (extra: Partial<SeekNoteView> = {}): SeekNoteView => ({ id: 'z1', name: 'Anna', avatar: '🦊', games: ['black-peter'], seats: 'any', mood: 'relaxed', expiresAt: 1, votes: {}, mine: true, joined: null, ...extra });
const view = (notes: SeekNoteView[], proposal: SeekBoardView['proposal'] = null): SeekBoardView => ({ notes, proposal });

describe('Hinweise am Schwarzen Brett', () => {
  it('sagt nichts bei der ersten Sicht und wenn sich nichts ändert', () => {
    expect(boardAlerts(null, view([note({ votes: { 'black-peter': 2 } })]))).toEqual([]);
    expect(boardAlerts(view([note()]), view([note()]))).toEqual([]);
  });

  it('meldet neue Zusagen auf dem eigenen Zettel, nicht auf fremden', () => {
    const alerts = boardAlerts(view([note()]), view([note({ votes: { 'black-peter': 1 } })]));
    expect(alerts).toEqual([{ title: 'Schwarzes Brett', body: 'Jemand hat auf deinem Zettel „Bin dabei“ gesagt.' }]);
    expect(boardAlerts(view([note()]), view([note({ votes: { 'black-peter': 3 } })]))[0]!.body).toContain('3 Leute');
    expect(boardAlerts(view([note({ mine: false })]), view([note({ mine: false, votes: { 'black-peter': 1 } })]))).toEqual([]);
  });

  it('meldet einen neuen Vorschlag, der noch auf die eigene Zusage wartet – einmal', () => {
    const proposal = { noteId: 'z1', gameId: 'black-peter', names: ['Anna', 'Ben'], confirmed: 1, total: 2, deadline: 1, youConfirmed: false };
    const alerts = boardAlerts(view([note({ mine: false })]), view([note({ mine: false })], proposal));
    expect(alerts).toHaveLength(1);
    expect(alerts[0]!.body).toContain('Anna, Ben');
    expect(boardAlerts(view([note({ mine: false })], proposal), view([note({ mine: false })], { ...proposal, confirmed: 2 }))).toEqual([]);
    expect(boardAlerts(view([note()]), view([note()], { ...proposal, youConfirmed: true }))).toEqual([]);
  });
});

describe('Vorbelegung des Zettels', () => {
  const known = ['black-peter', 'uno', 'skat', 'mau-mau'];

  it('liest nur gültige Werte und kennt nur vorhandene Spiele', () => {
    expect(sanitizeChoice({ games: ['uno', 'gibt-es-nicht', 'uno', 'skat', 'mau-mau', 'black-peter'], seats: '3-4', mood: 'kids' }, known)).toEqual({ games: ['uno', 'skat', 'mau-mau'], seats: '3-4', mood: 'kids' });
    expect(sanitizeChoice({ games: 5, seats: 'x', mood: 'y' }, known)).toEqual(DEFAULT_CHOICE);
    expect(sanitizeChoice(null, known)).toBeNull();
  });

  it('nimmt die letzte Wahl, sonst die Lieblingsspiele (höchstens drei, nur bekannte)', () => {
    const stored = { games: ['skat'], seats: '2' as const, mood: 'serious' as const };
    expect(startingChoice(stored, ['uno'], known)).toEqual(stored);
    expect(startingChoice(null, ['uno', 'solitaire', 'skat', 'mau-mau', 'black-peter'], known)).toEqual({ ...DEFAULT_CHOICE, games: ['uno', 'skat', 'mau-mau'] });
    expect(startingChoice(null, [], known)).toEqual(DEFAULT_CHOICE);
  });
});
