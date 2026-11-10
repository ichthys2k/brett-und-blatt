// @vitest-environment node
import { resolveOptions, type GameModule } from '../../../packages/engine/src';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { gameModule as blackPeter } from '../../../packages/games/black-peter/src';
import { gameUi as blackPeterUi } from '../../../packages/games/black-peter/src/ui';
import { gameModule as dominoes } from '../../../packages/games/dominoes/src';
import { gameUi as dominoesUi } from '../../../packages/games/dominoes/src/ui';
import { gameModule as lowFlight } from '../../../packages/games/low-flight/src';
import { gameUi as lowFlightUi } from '../../../packages/games/low-flight/src/ui';
import { gameModule as maexle } from '../../../packages/games/maexle/src';
import { gameUi as maexleUi } from '../../../packages/games/maexle/src/ui';
import { gameModule as quartett } from '../../../packages/games/quartett/src';
import { gameUi as quartettUi } from '../../../packages/games/quartett/src/ui';

/**
 * Hand-Ansicht für Spiele, deren Züge am Tisch hängen (#214): Die Oberfläche muss in beiden Ansichten ohne Fehler rendern,
 * und die Hand-Ansicht zeigt weniger (die Mitspieler-Karten, die Kette, die Raster der anderen gehören dem Tisch-Bildschirm).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function render(module: GameModule<any, any, any>, ui: { Board: any }, seats: number, options: Record<string, string>, handOnly: boolean, extra: Record<string, unknown> = {}): string {
  const resolved = resolveOptions(module, options);
  const state = module.setup(seats, resolved, 'seed-handview');
  const actor = module.currentPlayers(state)[0] ?? 0;
  const view = module.playerView(state, actor);
  const legalMoves = module.legalMoves(state, actor);
  const element = createElement(ui.Board, { view, legalMoves, onMove: () => undefined, events: [], activeSeat: actor, hint: null, viewer: extra.display ? 'spectator' : actor, seatNames: Array.from({ length: seats }, (_, i) => `Spieler ${i + 1}`), handOnly, ...extra });
  return renderToStaticMarkup(element);
}

const count = (html: string, needle: string) => html.split(needle).length - 1;

describe('Hand-Ansicht der Tischspiele (#214)', () => {
  it('Schwarzer Peter: nur die Ziehkarten des Nachbarn, die übrigen als Zeile', () => {
    const full = render(blackPeter, blackPeterUi, 4, {}, false);
    const hand = render(blackPeter, blackPeterUi, 4, {}, true);
    expect(count(hand, 'bp-seat ')).toBeLessThan(count(full, 'bp-seat '));
    expect(hand).toContain('Mitspieler');
  });

  it('Domino: statt der Kette nur die Enden', () => {
    const full = render(dominoes, dominoesUi, 2, {}, false);
    const hand = render(dominoes, dominoesUi, 2, {}, true);
    expect(full).toContain('dm-chain');
    expect(hand).not.toContain('dm-chain');
    expect(hand).toContain('dm-ends');
    expect(hand).toContain('dm-hand');
  });

  it('Tiefflug: die Raster der anderen entfallen, das eigene bleibt', () => {
    const full = render(lowFlight, lowFlightUi, 3, {}, false);
    const hand = render(lowFlight, lowFlightUi, 3, {}, true);
    expect(count(hand, 'lf-grid')).toBeLessThan(count(full, 'lf-grid'));
    expect(hand).toContain('lf-mine');
  });

  it('Quartett (Sammeln und Trumpf): rendert ohne Fehler und zeigt weniger', () => {
    for (const mode of ['collect', 'trump']) {
      const options = { mode };
      const full = render(quartett, quartettUi, 3, options, false);
      const hand = render(quartett, quartettUi, 3, options, true);
      expect(hand.length).toBeLessThanOrEqual(full.length);
      expect(hand).toContain('qt-table');
    }
  });
});

describe('Tisch-Bildschirm bei geheimen Karten (#215)', () => {
  it('Quartett Sammeln: der Verlauf der Fragen steht offen da, sobald gefragt wurde', () => {
    const resolved = resolveOptions(quartett, { mode: 'collect' });
    let state = quartett.setup(3, resolved, 'seed-ask');
    const asker = quartett.currentPlayers(state)[0]!;
    const move = quartett.legalMoves(state, asker)[0]!;
    state = quartett.applyMove(state, asker, move, { rng: undefined as never } as never).state;
    const view = quartett.playerView(state, 'spectator' as never);
    const html = renderToStaticMarkup(createElement(quartettUi.Board, { view, legalMoves: [], onMove: () => undefined, events: [], activeSeat: null, hint: null, viewer: 'spectator', seatNames: ['A', 'B', 'C'], display: true } as never));
    expect(html).toContain('qt-log-big');
  });

  it('Quartett Trumpf und Mäxle rendern auf dem Tisch-Bildschirm ohne Fehler', () => {
    expect(render(quartett, quartettUi, 3, { mode: 'trump' }, false, { display: true })).toContain('qt-table');
    expect(render(maexle, maexleUi, 3, {}, false, { display: true })).toContain('data-display');
  });
});
