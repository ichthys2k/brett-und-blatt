import type { CustomCardCatalog, ParsedCombatCard, ParsedCourtCard, ParsedQuartettCard } from '@brett-und-blatt/engine';
import { Button } from './controls';

export interface CustomCardsOverlayProps {
  checksum: string;
  catalog?: CustomCardCatalog;
  customCards?: Record<string, Partial<ParsedCombatCard>>;
  customMods?: Record<string, { baseChips?: number; multiplier?: number }>;
  customCardSet?: { cards?: Array<{ id: string; name: string; values?: Record<string, number> }> };
  onClose: () => void;
}

export function CustomCardsOverlay({
  checksum,
  catalog,
  customCards,
  customMods,
  customCardSet,
  onClose,
}: CustomCardsOverlayProps) {
  const combatCards = catalog?.combatCards ?? customCards;
  const courtCards = catalog?.courtCards;
  const quartettCards = catalog?.quartettCards;
  const notices = catalog?.notices ?? [];

  const combatEntries = combatCards ? Object.entries(combatCards) : [];
  const courtEntries = courtCards ? Object.entries(courtCards) : [];
  const quartettEntries = quartettCards ? Object.entries(quartettCards) : [];
  const modEntries = customMods ? Object.entries(customMods) : [];

  const hasAnyEntries =
    combatEntries.length > 0 ||
    courtEntries.length > 0 ||
    quartettEntries.length > 0 ||
    modEntries.length > 0 ||
    (customCardSet?.cards && customCardSet.cards.length > 0);

  return (
    <div
      className="absolute inset-0 z-30 overflow-y-auto bg-bg/95 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Eigenes Kartenset (Anki)"
    >
      <div className="mx-auto max-w-xl space-y-4 rounded-2xl border border-line bg-surface p-4 shadow-md">
        <div className="flex items-start justify-between gap-2 border-b border-line pb-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl" aria-hidden="true">
                ✨
              </span>
              <h2 className="text-lg font-semibold">Eigenes Kartenset (Anki)</h2>
              <span className="rounded-full border border-accent/40 bg-accent/10 px-2 py-0.5 font-mono text-xs font-bold text-accent">
                #{checksum}
              </span>
            </div>
            <p className="mt-1 text-xs text-muted">
              In dieser Runde gelten angepasste Kartenwerte, die aus einem Anki-Notizensatz stammen.
            </p>
          </div>
          <Button variant="ghost" className="px-2.5" onClick={onClose} aria-label="Schließen">
            ✕
          </Button>
        </div>

        {notices.length > 0 && (
          <div className="rounded-xl border border-warning/30 bg-warning/10 p-2.5 text-xs text-warning-ink">
            <p className="font-semibold mb-1">Hinweise bei der Validierung:</p>
            <ul className="list-disc pl-4 space-y-0.5">
              {notices.map((n, i) => (
                <li key={i}>{n}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="max-h-[60vh] space-y-3 overflow-y-auto pr-1 text-sm">
          {combatEntries.length > 0 && (
            <div className="space-y-2">
              <p className="font-semibold text-xs uppercase tracking-wider text-muted">
                Kampfkarten / Drachenspiel ({combatEntries.length})
              </p>
              <div className="grid gap-2">
                {combatEntries.map(([id, card]) => (
                  <div key={id} className="rounded-xl border border-line/60 bg-surface-2/40 p-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">{card.name ?? id}</span>
                      <span className="font-mono text-[11px] text-muted">{id}</span>
                    </div>
                    <div className="mt-1.5 flex flex-wrap gap-1.5 text-xs">
                      {card.cost !== undefined && (
                        <span className="rounded-md border border-line bg-surface px-1.5 py-0.5">
                          <span className="text-muted">Kosten: </span>
                          <span className="font-semibold">{card.cost}</span>
                        </span>
                      )}
                      {card.attack !== undefined && (
                        <span className="rounded-md border border-line bg-surface px-1.5 py-0.5">
                          <span className="text-muted">Angriff: </span>
                          <span className="font-semibold text-danger">{card.attack}</span>
                        </span>
                      )}
                      {card.health !== undefined && (
                        <span className="rounded-md border border-line bg-surface px-1.5 py-0.5">
                          <span className="text-muted">Leben: </span>
                          <span className="font-semibold text-emerald-600">{card.health}</span>
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {courtEntries.length > 0 && (
            <div className="space-y-2">
              <p className="font-semibold text-xs uppercase tracking-wider text-muted">
                Narrenhof-Karten ({courtEntries.length})
              </p>
              <div className="grid gap-2">
                {courtEntries.map(([key, card]) => (
                  <div key={key} className="rounded-xl border border-line/60 bg-surface-2/40 p-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">{card.name ?? key}</span>
                      <span className="font-mono text-[11px] text-muted">{key}</span>
                    </div>
                    <div className="mt-1.5 flex flex-wrap gap-1.5 text-xs">
                      {card.baseChips !== undefined && (
                        <span className="rounded-md border border-line bg-surface px-1.5 py-0.5">
                          <span className="text-muted">Chips: </span>
                          <span className="font-semibold">{card.baseChips}</span>
                        </span>
                      )}
                      {card.multiplier !== undefined && (
                        <span className="rounded-md border border-line bg-surface px-1.5 py-0.5">
                          <span className="text-muted">Multiplikator: </span>
                          <span className="font-semibold">x{card.multiplier}</span>
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {modEntries.length > 0 && courtEntries.length === 0 && (
            <div className="space-y-2">
              <p className="font-semibold text-xs uppercase tracking-wider text-muted">
                Narrenhof-Karten ({modEntries.length})
              </p>
              <div className="grid gap-2">
                {modEntries.map(([key, mod]) => (
                  <div key={key} className="rounded-xl border border-line/60 bg-surface-2/40 p-2.5">
                    <span className="font-medium">{key}</span>
                    <div className="mt-1.5 flex flex-wrap gap-1.5 text-xs">
                      {mod.baseChips !== undefined && (
                        <span className="rounded-md border border-line bg-surface px-1.5 py-0.5">
                          <span className="text-muted">Chips: </span>
                          <span className="font-semibold">{mod.baseChips}</span>
                        </span>
                      )}
                      {mod.multiplier !== undefined && (
                        <span className="rounded-md border border-line bg-surface px-1.5 py-0.5">
                          <span className="text-muted">Multiplikator: </span>
                          <span className="font-semibold">x{mod.multiplier}</span>
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {quartettEntries.length > 0 && (
            <div className="space-y-2">
              <p className="font-semibold text-xs uppercase tracking-wider text-muted">
                Quartett-Karten ({quartettEntries.length})
              </p>
              <div className="grid gap-2">
                {quartettEntries.map(([id, card]) => (
                  <div key={id} className="rounded-xl border border-line/60 bg-surface-2/40 p-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">{card.name}</span>
                      <span className="font-mono text-[11px] text-muted">{id}</span>
                    </div>
                    {card.values && (
                      <div className="mt-1.5 flex flex-wrap gap-1.5 text-xs">
                        {Object.entries(card.values).map(([k, v]) => (
                          <span key={k} className="rounded-md border border-line bg-surface px-1.5 py-0.5">
                            <span className="text-muted">{k}: </span>
                            <span className="font-semibold">{v}</span>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {customCardSet?.cards && quartettEntries.length === 0 && (
            <div className="space-y-2">
              <p className="font-semibold text-xs uppercase tracking-wider text-muted">
                Quartett-Kartensatz ({customCardSet.cards.length} Karten)
              </p>
              <div className="grid gap-2">
                {customCardSet.cards.map((card) => (
                  <div key={card.id} className="rounded-xl border border-line/60 bg-surface-2/40 p-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">{card.name}</span>
                      <span className="font-mono text-[11px] text-muted">{card.id}</span>
                    </div>
                    {card.values && (
                      <div className="mt-1.5 flex flex-wrap gap-1.5 text-xs">
                        {Object.entries(card.values).map(([k, v]) => (
                          <span key={k} className="rounded-md border border-line bg-surface px-1.5 py-0.5">
                            <span className="text-muted">{k}: </span>
                            <span className="font-semibold">{v}</span>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {!hasAnyEntries && <p className="text-muted">Keine Kartendetails verfügbar.</p>}
        </div>

        <Button variant="primary" className="w-full" onClick={onClose}>
          Schließen
        </Button>
      </div>
    </div>
  );
}
