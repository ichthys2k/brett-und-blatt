import { Die3D } from '@brett-und-blatt/ui';
import { useEffect, useMemo, useState } from 'react';
import { Button, PlayerCount, Section } from '../controls';
import {
  CUSTOM_DICE_PRESETS,
  loadHelperState,
  parseCustomFaces,
  rollDiceSet,
  saveHelperState,
  STANDARD_DICE,
  sumNumericDice,
  type DiceHistoryEntry,
  type DieKind,
  type DieResult,
} from '../../lib/helpers';
import { sound } from '../../lib/sound';

interface StoredDicePrefs {
  count: number;
  kind: DieKind;
  customRaw: string;
  history: DiceHistoryEntry[];
}

const DEFAULT_PREFS: StoredDicePrefs = {
  count: 2,
  kind: 'd6',
  customRaw: CUSTOM_DICE_PRESETS[0]!.faces,
  history: [],
};

export function DiceHelper() {
  const initial = useMemo(() => loadHelperState<StoredDicePrefs>('wuerfel', DEFAULT_PREFS), []);
  const [count, setCount] = useState(Math.max(1, Math.min(10, initial.count || 2)));
  const [kind, setKind] = useState<DieKind>(initial.kind ?? 'd6');
  const [customRaw, setCustomRaw] = useState(initial.customRaw || DEFAULT_PREFS.customRaw);
  const [rollKey, setRollKey] = useState(1);
  const [dice, setDice] = useState<DieResult[]>(() =>
    rollDiceSet([], Math.max(1, Math.min(10, initial.count || 2)), initial.kind ?? 'd6', parseCustomFaces(initial.customRaw || DEFAULT_PREFS.customRaw)),
  );
  const [history, setHistory] = useState<DiceHistoryEntry[]>(Array.isArray(initial.history) ? initial.history.slice(0, 10) : []);

  const customFaces = useMemo(() => parseCustomFaces(customRaw), [customRaw]);

  useEffect(() => {
    saveHelperState<StoredDicePrefs>('wuerfel', { count, kind, customRaw, history });
  }, [count, kind, customRaw, history]);

  const kindLabel = kind === 'custom' ? 'Eigene' : (STANDARD_DICE.find((d) => d.id === kind)?.label ?? 'W6');

  const roll = (nextCount = count, nextKind = kind, nextFaces = customFaces) => {
    const nextDice = rollDiceSet(dice, nextCount, nextKind, nextFaces);
    setDice(nextDice);
    setRollKey((k) => k + 1);
    sound.play('wuerfeln');

    const entry: DiceHistoryEntry = {
      id: Date.now() + Math.random(),
      kindLabel: nextKind === 'custom' ? 'Eigene' : (STANDARD_DICE.find((d) => d.id === nextKind)?.label ?? 'W6'),
      values: nextDice.map((d) => d.label),
      sum: sumNumericDice(nextDice),
      at: Date.now(),
    };
    setHistory((prev) => [entry, ...prev].slice(0, 10));
  };

  // Leertaste würfelt, sofern der Fokus nicht in einem Eingabefeld oder auf einem Button liegt.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'Space') return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || tag === 'BUTTON') return;
      e.preventDefault();
      roll();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const handleCountChange = (next: number) => {
    setCount(next);
    setDice((prev) => rollDiceSet(prev, next, kind, customFaces));
    setRollKey((k) => k + 1);
  };

  const handleKindChange = (next: DieKind) => {
    setKind(next);
    setDice(rollDiceSet([], count, next, customFaces));
    setRollKey((k) => k + 1);
  };

  const toggleHold = (id: number) => {
    sound.play('wuerfel-halten');
    setDice((prev) => prev.map((d) => (d.id === id ? { ...d, held: !d.held } : d)));
  };

  const releaseAll = () => {
    setDice((prev) => prev.map((d) => ({ ...d, held: false })));
  };

  const totalSum = sumNumericDice(dice);
  const anyHeld = dice.some((d) => d.held);

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Section title="Anzahl Würfel">
          <PlayerCount value={count} min={1} max={10} onChange={handleCountChange} label="Anzahl Würfel" />
        </Section>

        <Section title="Würfelart">
          <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Würfelart">
            {STANDARD_DICE.map((spec) => (
              <button
                key={spec.id}
                type="button"
                role="radio"
                aria-checked={kind === spec.id}
                onClick={() => handleKindChange(spec.id)}
                className={`min-h-10 rounded-lg border px-3 py-1.5 text-sm font-semibold transition ${
                  kind === spec.id
                    ? 'border-accent bg-accent text-accent-ink shadow-sm'
                    : 'border-line bg-surface-2 text-ink hover:bg-surface'
                }`}
              >
                {spec.label}
              </button>
            ))}
            <button
              type="button"
              role="radio"
              aria-checked={kind === 'custom'}
              onClick={() => handleKindChange('custom')}
              className={`min-h-10 rounded-lg border px-3 py-1.5 text-sm font-semibold transition ${
                kind === 'custom'
                  ? 'border-accent bg-accent text-accent-ink shadow-sm'
                  : 'border-line bg-surface-2 text-ink hover:bg-surface'
              }`}
            >
              Eigene
            </button>
          </div>
        </Section>
      </div>

      {kind === 'custom' && (
        <Section title="Eigene Würfelseiten">
          <div className="space-y-2 rounded-2xl border border-line bg-surface-2 p-3">
            <div className="flex flex-wrap gap-1.5">
              {CUSTOM_DICE_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => {
                    setCustomRaw(preset.faces);
                    setDice(rollDiceSet([], count, 'custom', parseCustomFaces(preset.faces)));
                    setRollKey((k) => k + 1);
                  }}
                  className="rounded-lg border border-line bg-surface px-2.5 py-1 text-xs font-medium text-ink transition hover:border-accent"
                >
                  {preset.name}
                </button>
              ))}
            </div>
            <label className="block text-xs text-muted">
              Seiten mit Komma oder Leerzeichen trennen (max. 24 Seiten):
              <input
                type="text"
                value={customRaw}
                onChange={(e) => setCustomRaw(e.target.value)}
                placeholder="z. B. 🔴, 🔵, 🟢, 🟡"
                className="mt-1 w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none"
              />
            </label>
            <p className="text-xs text-muted">Aktive Seiten ({customFaces.length}): {customFaces.join(' · ')}</p>
          </div>
        </Section>
      )}

      <Section title="Wurf">
        <div className="rounded-2xl border border-line bg-surface-2 p-4 space-y-4">
          <div className="flex flex-wrap items-center justify-center gap-3 min-h-24">
            {dice.map((die, idx) => (
              <button
                key={die.id}
                type="button"
                aria-pressed={die.held}
                aria-label={`Würfel ${idx + 1}: ${die.label}${die.held ? ', gehalten' : ''}. Antippen zum ${die.held ? 'Lösen' : 'Halten'}.`}
                onClick={() => toggleHold(die.id)}
                className={`group relative flex flex-col items-center gap-1 rounded-2xl p-2 transition focus-visible:outline-3 focus-visible:outline-accent ${
                  die.held ? 'bg-accent/15 ring-2 ring-accent' : 'hover:bg-surface/70'
                }`}
              >
                {die.kind === 'd6' && die.numeric !== null ? (
                  <Die3D
                    value={die.numeric}
                    rollKey={rollKey}
                    still={die.held}
                    delayMs={idx * 45}
                    held={die.held}
                    crit={die.numeric === 6}
                    style={{ width: '3.25rem' }}
                  />
                ) : (
                  <span
                    className={`flex h-14 min-w-14 items-center justify-center rounded-xl border-2 px-2.5 text-xl font-bold shadow-sm transition motion-safe:animate-[pop_220ms_ease-out] ${
                      die.held
                        ? 'border-accent bg-surface text-accent -translate-y-0.5'
                        : 'border-line bg-surface text-ink'
                    }`}
                  >
                    {die.label}
                  </span>
                )}
                <span className="text-[11px] font-medium text-muted">
                  {die.held ? '🔒 Gehalten' : kindLabel}
                </span>
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line/70 pt-3">
            <div className="text-sm">
              {totalSum !== null ? (
                <span>
                  Summe: <strong className="text-lg tabular-nums text-ink">{totalSum}</strong>
                </span>
              ) : (
                <span className="text-muted">Tippe einen Würfel an, um ihn zu halten.</span>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {anyHeld && (
                <Button variant="secondary" onClick={releaseAll}>
                  Alle lösen
                </Button>
              )}
              <Button variant="primary" onClick={() => roll()} className="min-w-36">
                🎲 Würfeln
              </Button>
            </div>
          </div>
        </div>
      </Section>

      {history.length > 0 && (
        <Section title="Verlauf">
          <div className="space-y-1.5 rounded-2xl border border-line bg-surface-2 p-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted">Letzte {history.length} Würfe</span>
              <button
                type="button"
                onClick={() => setHistory([])}
                className="text-xs text-muted underline hover:text-ink"
              >
                Verlauf leeren
              </button>
            </div>
            <ul className="space-y-1 text-sm">
              {history.map((entry) => (
                <li key={entry.id} className="flex items-center justify-between gap-2 rounded-lg bg-surface px-2.5 py-1.5">
                  <span className="truncate">
                    <span className="mr-1.5 text-xs font-semibold text-muted">{entry.kindLabel}:</span>
                    <span className="font-medium">{entry.values.join(', ')}</span>
                  </span>
                  {entry.sum !== null && (
                    <span className="shrink-0 rounded-md bg-surface-2 px-2 py-0.5 text-xs font-bold tabular-nums">
                      ∑ {entry.sum}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </Section>
      )}
    </div>
  );
}
