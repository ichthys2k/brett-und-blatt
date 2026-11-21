import { resolveOptions } from '@brett-und-blatt/engine';
import { describe, expect, it } from 'vitest';
import { gameModule } from '../../../packages/games/tic-tac-toe/src';
import { defaultDraft, humansMissing, visibleOptionsOf, withoutHidden } from '../src/lib/setupDraftCore';
import type { LoadedGame } from '../src/lib/registry';

const game = { info: gameModule.info, module: gameModule, ui: {} as never } as unknown as LoadedGame;

describe('Partie-Vorbereitung ohne Speicher (#611)', () => {
  it('defaultDraft: Mensch gegen Computer, gemütliche Zeit, Vorgabe-Optionen', () => {
    const draft = defaultDraft(game);
    expect(draft.seats.map((s) => s.kind)).toEqual(['human', 'bot']);
    expect(draft.time).toBe('relaxed');
    expect(draft.options).toEqual(resolveOptions(gameModule));
  });

  it('withoutHidden entfernt verborgene Optionen', () => {
    const hiddenGame = {
      ...game,
      module: { ...gameModule, options: [...gameModule.options, { id: 'geheim', label: 'Geheim', hidden: true, default: '', choices: [] }] },
    } as unknown as LoadedGame;
    const draft = { ...defaultDraft(game), options: { ...resolveOptions(gameModule), geheim: 'x' } };
    expect(withoutHidden(hiddenGame.module, draft).options).not.toHaveProperty('geheim');
    expect(visibleOptionsOf(hiddenGame, draft).some((spec) => spec.id === 'geheim')).toBe(false);
  });

  it('humansMissing zählt fehlende Menschen', () => {
    const draft = defaultDraft(game);
    expect(humansMissing(game, draft)).toBe(0);
    expect(humansMissing(game, { ...draft, seats: draft.seats.map((s) => ({ ...s, kind: 'bot' as const })) })).toBe(1);
  });
});
