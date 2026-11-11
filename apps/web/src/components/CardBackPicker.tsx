import { GameCard } from '@brett-und-blatt/ui';
import { useState } from 'react';
import { Button } from './controls';
import {
  CARD_BACK_CATALOG,
  currentUnlockState,
  setActiveCardBack,
  useActiveCardBack,
} from '../lib/cardBacks';
import { useCrest } from '../lib/crestStore';

export function CardBackPicker() {
  const activeBack = useActiveCardBack();
  const crest = useCrest();
  const unlockState = currentUnlockState();
  const [flipped, setFlipped] = useState<Record<string, boolean>>({});

  const toggleFlip = (id: string) => {
    setFlipped((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <section className="space-y-4 rounded-2xl border border-line bg-surface p-4" aria-labelledby="card-backs-title">
      <div>
        <h2 id="card-backs-title" className="text-xl font-bold">
          🃏 Kartenrücken
        </h2>
        <p className="text-sm text-muted">
          Wähle das Aussehen verdeckter Karten für alle Spiele. Tippe auf eine Karte, um sie umzudrehen.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {CARD_BACK_CATALOG.map((entry) => {
          const { unlocked, progressLabel } = entry.unlockCheck(unlockState);
          const isSelected = activeBack === entry.id;
          // Standardmäßig Rücken oben (faceDown=true), Antippen dreht um
          const isFaceDown = flipped[entry.id] === undefined ? true : flipped[entry.id]!;

          return (
            <div
              key={entry.id}
              className={`flex items-center gap-3.5 rounded-xl border p-3 transition-colors ${
                isSelected
                  ? 'border-accent bg-accent/5 shadow-sm'
                  : unlocked
                    ? 'border-line bg-bg hover:border-line-hover'
                    : 'border-line/60 bg-bg/40 opacity-75'
              }`}
            >
              {/* Interaktive Live-Vorschau (Antippen wendet) */}
              <div
                className="flex-none cursor-pointer"
                onClick={() => toggleFlip(entry.id)}
                title="Tippen zum Umdrehen"
              >
                <GameCard
                  size="sm"
                  faceDown={isFaceDown}
                  title={entry.name}
                  cardBackProps={{ design: entry.id, crest }}
                  illustration={<span className="text-xl">✨</span>}
                  bodyText={<span className="text-center font-medium">{entry.name}</span>}
                />
              </div>

              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold">{entry.name}</span>
                  {!unlocked && <span className="text-xs" title="Gesperrt">🔒</span>}
                  {isSelected && (
                    <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-bold text-white">
                      Aktiv
                    </span>
                  )}
                </div>

                <p className="text-xs text-muted leading-tight">{entry.description}</p>

                <p className={`text-xs ${unlocked ? 'text-muted' : 'font-medium text-warning'}`}>
                  {progressLabel}
                </p>

                <div className="pt-1">
                  {isSelected ? (
                    <span className="inline-block text-xs font-semibold text-accent">
                      ✓ Ausgewählt
                    </span>
                  ) : unlocked ? (
                    <Button
                      variant="ghost"
                      className="px-2.5 py-1 text-xs"
                      onClick={() => setActiveCardBack(entry.id)}
                    >
                      Auswählen
                    </Button>
                  ) : (
                    <span className="inline-block text-xs text-muted">
                      Noch gesperrt
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
