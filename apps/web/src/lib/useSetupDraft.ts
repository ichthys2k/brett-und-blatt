import { randomSeed, timePresetsOf } from '@brett-und-blatt/engine';
import { useEffect, useState } from 'react';
import { startGame } from './activeGame';
import { loadGame, type LoadedGame } from './registry';
import { navigate, paths } from './router';
import { launchGame, restoreDraft, toSeatConfigs } from './setupDraft';
import { withoutHidden, type SeatDraft, type SetupDraft } from './setupDraftCore';
import { storage } from './storage';

/*
 * Zustand der Partie-Vorbereitung als Hook (#607, K2b): lädt das Spiel, stellt die gemerkten
 * Einstellungen wieder her, erledigt den Sofortstart (`?autostart=1`, mit `gegner=bot`) und bietet
 * die Änderungsfunktionen. Benutzt von `screens/Setup.tsx` und der Spielseite der Konsole.
 */

export interface SetupState {
  game: LoadedGame | null;
  draft: SetupDraft | null;
  failed: boolean;
  update: (change: Partial<SetupDraft>) => void;
  setOption: (id: string, value: string) => void;
  updateSeat: (index: number, change: Partial<SeatDraft>) => void;
  setCount: (count: number) => void;
  /** Startet die Partie und wechselt zum Spieltisch. */
  start: () => Promise<void>;
}

/** Zustand mit geladenem Spiel und Entwurf (nach dem Laden). */
export type ReadySetupState = SetupState & { game: LoadedGame; draft: SetupDraft };

export function useSetupDraft(gameId: string, params?: Record<string, string>): SetupState {
  const [game, setGame] = useState<LoadedGame | null>(null);
  const [draft, setDraft] = useState<SetupDraft | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadGame(gameId).then(
      async (loaded) => {
        if (cancelled) return;
        const restored = restoreDraft(loaded, params);
        setGame(loaded);
        setDraft(restored);
        if (params?.autostart === '1') {
          // Ein vorgegebener Solo-Kampf ändert nicht, was hier fürs nächste Mal gespeichert ist.
          if (params.gegner === 'bot') restored.seats = [{ kind: 'human', name: restored.seats[0]?.name ?? '', level: 'medium' }, { kind: 'bot', name: '', level: 'medium' }];
          else storage.saveSetup(loaded.info.id, withoutHidden(loaded.module, restored));
          await startGame({
            gameId: loaded.info.id,
            seats: toSeatConfigs(restored.seats, loaded.info.id),
            options: loaded.ui.prepareOptions ? loaded.ui.prepareOptions(restored.options) : restored.options,
            seed: randomSeed(),
            time: timePresetsOf(loaded.module, restored.options)[restored.time],
          });
          if (!cancelled) navigate(paths.play);
        }
      },
      () => !cancelled && setFailed(true),
    );
    return () => {
      cancelled = true;
    };
  }, [gameId]);

  const update = (change: Partial<SetupDraft>) => setDraft((d) => (d ? { ...d, ...change } : d));
  // Funktional, damit mehrere Werte nacheinander (z. B. SGF, Brettgröße, Komi) alle ankommen.
  const setOption = (id: string, value: string) => setDraft((d) => (d ? { ...d, options: { ...d.options, [id]: value } } : d));
  const updateSeat = (index: number, change: Partial<SeatDraft>) =>
    setDraft((d) => (d ? { ...d, seats: d.seats.map((s, i) => (i === index ? { ...s, ...change } : s)) } : d));
  const setCount = (count: number) =>
    setDraft((d) => (d ? { ...d, seats: Array.from({ length: count }, (_, i) => d.seats[i] ?? { kind: 'bot', name: '', level: 'medium' }) } : d));

  const start = async () => {
    if (!game || !draft) return;
    await launchGame(game, draft);
    navigate(paths.play);
  };

  return { game, draft, failed, update, setOption, updateSeat, setCount, start };
}
