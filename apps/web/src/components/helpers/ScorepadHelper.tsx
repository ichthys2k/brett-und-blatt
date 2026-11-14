import { useEffect, useMemo, useState } from 'react';
import { Button, Section, Segmented } from '../controls';
import {
  computeScoreTotals,
  loadHelperState,
  rankScorePlayers,
  saveHelperState,
  type ScorePlayer,
  type ScoreRound,
} from '../../lib/helpers';
import { sound } from '../../lib/sound';

interface StoredScorepad {
  players: ScorePlayer[];
  rounds: ScoreRound[];
  order: 'desc' | 'asc';
}

const DEFAULT_PLAYERS: ScorePlayer[] = [
  { id: 'p1', name: 'Spieler 1' },
  { id: 'p2', name: 'Spieler 2' },
  { id: 'p3', name: 'Spieler 3' },
];

const DEFAULT_SCOREPAD: StoredScorepad = {
  players: DEFAULT_PLAYERS,
  rounds: [],
  order: 'desc',
};

export function ScorepadHelper() {
  const initial = useMemo(() => loadHelperState<StoredScorepad>('punkte', DEFAULT_SCOREPAD), []);
  const [players, setPlayers] = useState<ScorePlayer[]>(
    Array.isArray(initial.players) && initial.players.length > 0 ? initial.players : DEFAULT_PLAYERS,
  );
  const [rounds, setRounds] = useState<ScoreRound[]>(Array.isArray(initial.rounds) ? initial.rounds : []);
  const [order, setOrder] = useState<'desc' | 'asc'>(initial.order === 'asc' ? 'asc' : 'desc');
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [newName, setNewName] = useState('');

  useEffect(() => {
    saveHelperState<StoredScorepad>('punkte', { players, rounds, order });
  }, [players, rounds, order]);

  const totals = useMemo(() => computeScoreTotals(players, rounds), [players, rounds]);
  const ranking = useMemo(() => rankScorePlayers(players, totals, order), [players, totals, order]);

  const addPlayer = () => {
    const trimmed = newName.trim() || `Spieler ${players.length + 1}`;
    const id = `p${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    setPlayers((prev) => [...prev, { id, name: trimmed }]);
    setNewName('');
  };

  const removePlayer = (id: string) => {
    if (players.length <= 1) return;
    setPlayers((prev) => prev.filter((p) => p.id !== id));
  };

  const renamePlayer = (id: string, name: string) => {
    setPlayers((prev) => prev.map((p) => (p.id === id ? { ...p, name } : p)));
  };

  const bumpDraft = (id: string, delta: number) => {
    setDraft((prev) => {
      const current = Number(prev[id] ?? 0) || 0;
      return { ...prev, [id]: String(current + delta) };
    });
  };

  const commitRound = () => {
    const scores: Record<string, number> = {};
    for (const p of players) {
      const val = Number(draft[p.id] ?? 0);
      scores[p.id] = Number.isFinite(val) ? val : 0;
    }
    setRounds((prev) => [...prev, { id: Date.now(), scores }]);
    setDraft({});
    sound.play('stein-setzen');
  };

  const deleteLastRound = () => {
    setRounds((prev) => prev.slice(0, -1));
  };

  const clearRounds = () => {
    setRounds([]);
    setDraft({});
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Segmented
          label="Sieg-Richtung"
          value={order}
          onChange={setOrder}
          choices={[
            { value: 'desc', label: '🏆 Höchste Punkte' },
            { value: 'asc', label: '⛳ Niedrigste Punkte' },
          ]}
        />
      </div>

      <Section title={`Runde ${rounds.length + 1} eintragen`}>
        <div className="space-y-3 rounded-2xl border border-line bg-surface-2 p-3">
          <div className="space-y-2">
            {players.map((p) => (
              <div key={p.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-surface p-2.5">
                <div className="flex min-w-36 flex-1 items-center gap-2">
                  <input
                    type="text"
                    aria-label={`Name für ${p.name}`}
                    value={p.name}
                    onChange={(e) => renamePlayer(p.id, e.target.value)}
                    className="min-w-0 flex-1 rounded-lg border border-transparent bg-transparent px-1.5 py-1 text-sm font-semibold text-ink focus:border-line focus:bg-surface-2 focus:outline-none"
                  />
                  {players.length > 1 && (
                    <button
                      type="button"
                      aria-label={`${p.name} entfernen`}
                      onClick={() => removePlayer(p.id)}
                      className="rounded-md px-1.5 py-0.5 text-xs text-muted hover:bg-surface-2 hover:text-ink"
                    >
                      ✕
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-1">
                  {[-5, -1].map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => bumpDraft(p.id, d)}
                      className="min-h-9 min-w-9 rounded-lg border border-line bg-surface-2 px-2 text-xs font-semibold hover:border-accent"
                    >
                      {d}
                    </button>
                  ))}
                  <input
                    type="number"
                    inputMode="numeric"
                    aria-label={`Punkte für ${p.name}`}
                    value={draft[p.id] ?? ''}
                    placeholder="0"
                    onChange={(e) => setDraft((prev) => ({ ...prev, [p.id]: e.target.value }))}
                    className="h-9 w-16 rounded-lg border border-line bg-surface-2 px-2 text-center text-sm font-bold tabular-nums text-ink focus:border-accent focus:outline-none"
                  />
                  {[1, 5].map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => bumpDraft(p.id, d)}
                      className="min-h-9 min-w-9 rounded-lg border border-line bg-surface-2 px-2 text-xs font-semibold hover:border-accent"
                    >
                      +{d}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="primary" onClick={commitRound} className="flex-1">
              ✓ Runde {rounds.length + 1} eintragen
            </Button>
            {rounds.length > 0 && (
              <Button variant="secondary" onClick={deleteLastRound}>
                Letzte Runde löschen
              </Button>
            )}
          </div>

          <div className="flex gap-2 border-t border-line/70 pt-2.5">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addPlayer();
                }
              }}
              placeholder="Neuer Spielername …"
              className="min-w-0 flex-1 rounded-xl border border-line bg-surface px-3 py-1.5 text-sm text-ink focus:border-accent focus:outline-none"
            />
            <Button variant="secondary" onClick={addPlayer}>
              + Spieler
            </Button>
          </div>
        </div>
      </Section>

      <Section title="Rangliste & Gesamtpunkte">
        <div className="space-y-1.5 rounded-2xl border border-line bg-surface-2 p-3">
          {ranking.map((entry) => (
            <div
              key={entry.player.id}
              className={`flex items-center justify-between rounded-xl px-3 py-2 ${
                entry.rank === 1 && rounds.length > 0 ? 'bg-accent/15 ring-1 ring-accent' : 'bg-surface'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-surface-2 text-xs font-bold tabular-nums">
                  {entry.rank}.
                </span>
                <span className="font-semibold">{entry.player.name || 'Ohne Namen'}</span>
              </div>
              <strong className="text-lg font-bold tabular-nums text-accent">{entry.total}</strong>
            </div>
          ))}
        </div>
      </Section>

      {rounds.length > 0 && (
        <Section title={`Rundenverlauf (${rounds.length})`}>
          <div className="space-y-2 rounded-2xl border border-line bg-surface-2 p-3">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-line text-xs text-muted">
                    <th className="py-1.5 pr-3 font-semibold">Runde</th>
                    {players.map((p) => (
                      <th key={p.id} className="px-2 py-1.5 text-right font-semibold">
                        {p.name || '–'}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rounds.map((r, idx) => (
                    <tr key={r.id} className="border-b border-line/40 last:border-none">
                      <td className="py-1.5 pr-3 text-xs text-muted tabular-nums">#{idx + 1}</td>
                      {players.map((p) => (
                        <td key={p.id} className="px-2 py-1.5 text-right tabular-nums">
                          {r.scores[p.id] ?? 0}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-line font-bold">
                    <td className="pt-2 pr-3 text-xs uppercase text-muted">Summe</td>
                    {players.map((p) => (
                      <td key={p.id} className="px-2 pt-2 text-right tabular-nums text-accent">
                        {totals[p.id] ?? 0}
                      </td>
                    ))}
                  </tr>
                </tfoot>
              </table>
            </div>

            <div className="flex justify-end pt-1">
              <Button variant="ghost" onClick={clearRounds}>
                Punkte zurücksetzen
              </Button>
            </div>
          </div>
        </Section>
      )}
    </div>
  );
}
