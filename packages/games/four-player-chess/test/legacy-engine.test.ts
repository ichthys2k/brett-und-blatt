// Regeltests aus dem Projekt 4playerchess, auf Vitest und TypeScript umgestellt.
import { assert, test } from 'vitest';
import {
  COLORS,
  newGame,
  replay,
  applyAction,
  legalMoves,
  canClaim,
  findKing,
  inCheck,
  idx,
  type Color,
  type FourChessAction,
  type FourChessState,
  type GameMode,
  type PieceType,
  type PromoPiece,
} from '../src/legacy/engine';
import { chooseBotMove } from '../src/legacy/bot';

// Feldnamen wie im Spiel: Linien a–n von links, Reihen 1–14 von unten (Sicht Rot).
const at = (name: string): number => idx(14 - Number(name.slice(1)), name.charCodeAt(0) - 97);
const move = (s: FourChessState, p: Color, from: string, to: string, extra: { pr?: PromoPiece; time?: boolean } = {}): boolean =>
  applyAction(s, { t: 'm', p, f: at(from), to: at(to), ...extra });
const piece = (s: FourChessState, name: string) => s.board[at(name)];

/** Leeres Brett mit den angegebenen Figuren. Ohne Angabe stehen die vier Könige auf ihren Startfeldern. */
function custom(mode: GameMode, pieces: [string, Color, PieceType | null, boolean?][], turn: Color = 'r'): FourChessState {
  const s = newGame(mode);
  s.board.fill(null);
  const list: [string, Color, PieceType | null, boolean?][] = [
    ['h1', 'r', 'K'],
    ['a7', 'b', 'K'],
    ['g14', 'y', 'K'],
    ['n8', 'g', 'K'],
    ...pieces,
  ];
  for (const [sq, c, t, pr] of list) s.board[at(sq)] = t ? { c, t, pr: pr ?? false } : null;
  s.castle = { r: [], b: [], y: [], g: [] };
  s.turn = turn;
  s.seen = {};
  return s;
}

function seededRandom(seed: number): () => number {
  return () => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed / 2147483648;
  };
}

test('Startaufstellung: Könige gegenüber den Damen, je 20 Züge', () => {
  const s = newGame();
  assert.equal(s.board.filter(Boolean).length, 64);
  for (const [sq, c] of [
    ['h1', 'r'],
    ['a7', 'b'],
    ['g14', 'y'],
    ['n8', 'g'],
  ] as const) {
    assert.deepEqual(piece(s, sq), { c, t: 'K' });
  }
  for (const [sq, c] of [
    ['g1', 'r'],
    ['a8', 'b'],
    ['h14', 'y'],
    ['n7', 'g'],
  ] as const) {
    assert.deepEqual(piece(s, sq), { c, t: 'Q' });
  }
  for (const c of COLORS) assert.equal(legalMoves(s, c).length, 20, `Farbe ${c}`);
});

test('Zugreihenfolge Rot → Blau → Gelb → Grün', () => {
  const s = newGame();
  assert.ok(move(s, 'r', 'e2', 'e4'));
  assert.equal(s.turn, 'b');
  assert.equal(move(s, 'r', 'f2', 'f4'), false, 'Rot ist nicht am Zug');
  assert.ok(move(s, 'b', 'b5', 'd5'));
  assert.ok(move(s, 'y', 'e13', 'e11'));
  assert.ok(move(s, 'g', 'm5', 'k5'));
  assert.equal(s.turn, 'r');
});

test('Rochade kurz und lang für Rot', () => {
  let s = custom('ffa', [['k1', 'r', 'R']]);
  s.castle.r = [at('k1')];
  assert.ok(move(s, 'r', 'h1', 'j1'));
  assert.equal(piece(s, 'i1')?.t, 'R');
  assert.equal(piece(s, 'k1'), null);

  s = custom('ffa', [['d1', 'r', 'R']]);
  s.castle.r = [at('d1')];
  assert.ok(move(s, 'r', 'h1', 'f1'));
  assert.equal(piece(s, 'g1')?.t, 'R');
  assert.equal(s.log.at(-1)?.text, 'O-O-O+', 'Turm auf g1 gibt Schach gegen Gelb auf g14');
});

test('Rochade für Blau (seitlich)', () => {
  const s = custom('ffa', [['a4', 'b', 'R']], 'b');
  s.castle.b = [at('a4')];
  assert.ok(move(s, 'b', 'a7', 'a5'));
  assert.equal(piece(s, 'a6')?.t, 'R');
});

test('Keine Rochade über ein angegriffenes Feld – außer der Angreifer ist Teampartner', () => {
  const pieces: [string, Color, PieceType | null][] = [
    ['k1', 'r', 'R'],
    ['i14', 'y', 'R'],
  ];
  const ffa = custom('ffa', pieces);
  ffa.castle.r = [at('k1')];
  assert.ok(!legalMoves(ffa).some((m) => m.castle));

  const teams = custom('teams', pieces);
  teams.castle.r = [at('k1')];
  assert.ok(legalMoves(teams).some((m) => m.castle));
});

test('En passant über Kreuz und Verfall der Möglichkeit', () => {
  let s = custom('ffa', [
    ['f2', 'r', 'P'],
    ['e4', 'b', 'P'],
  ]);
  assert.ok(move(s, 'r', 'f2', 'f4'));
  assert.ok(move(s, 'b', 'e4', 'f3'), 'Blau schlägt en passant');
  assert.equal(piece(s, 'f4'), null);
  assert.equal(piece(s, 'f3')?.c, 'b');

  s = custom('ffa', [
    ['f2', 'r', 'P'],
    ['e4', 'b', 'P'],
  ]);
  move(s, 'r', 'f2', 'f4');
  move(s, 'b', 'a7', 'b7');
  move(s, 'y', 'g14', 'g13');
  move(s, 'g', 'n8', 'm8');
  move(s, 'r', 'h1', 'h2');
  assert.equal(move(s, 'b', 'e4', 'f3'), false, 'nach einer Runde verfallen');
});

test('Umwandlung im FFA auf der 8. Reihe, immer zur 1-Punkt-Dame', () => {
  const s = custom('ffa', [
    ['f7', 'r', 'P'],
    ['b8', 'b', 'R'],
  ]);
  assert.ok(move(s, 'r', 'f7', 'f8', { pr: 'N' }));
  assert.deepEqual(piece(s, 'f8'), { c: 'r', t: 'Q', pr: true });
  assert.ok(move(s, 'b', 'b8', 'f8'));
  assert.equal(s.scores.b, 1);
});

test('Umwandlung im Teammodus auf der 11. Reihe mit freier Wahl', () => {
  const s = custom('teams', [
    ['f10', 'r', 'P'],
    ['j7', 'r', 'P'],
  ]);
  assert.ok(move(s, 'r', 'f10', 'f11', { pr: 'N' }));
  assert.equal(piece(s, 'f11')?.t, 'N');
  const t = custom('teams', [['f7', 'r', 'P']]);
  assert.ok(move(t, 'r', 'f7', 'f8'));
  assert.equal(piece(t, 'f8')?.t, 'P', 'auf der 8. Reihe noch keine Umwandlung');
});

// Blau steht in der Ecke a11; Rot setzt mit dem Turm auf a5 matt.
const MATE: [string, Color, PieceType | null][] = [
  ['a7', 'b', null],
  ['a11', 'b', 'K'],
  ['b6', 'r', 'R'],
  ['f5', 'r', 'R'],
];

test('Schachmatt im FFA: +20, Figuren werden grau, Blau wird übersprungen', () => {
  const s = custom('ffa', MATE);
  assert.ok(move(s, 'r', 'f5', 'a5'));
  assert.equal(s.scores.r, 20);
  assert.equal(s.active.b, false);
  assert.equal(s.out.b, 'mate');
  assert.equal(s.turn, 'y');
  assert.ok(piece(s, 'a11')?.d, 'König von Blau ist jetzt tot');
  assert.equal(s.result, null);
});

test('Schachmatt im Teammodus beendet das Spiel', () => {
  const s = custom('teams', MATE);
  assert.ok(move(s, 'r', 'f5', 'a5'));
  assert.deepEqual(s.result?.winners, ['r', 'y']);
  assert.equal(s.result?.reason, 'mate');
});

test('Patt im FFA: +20 für den Pattgesetzten', () => {
  const s = custom('ffa', [
    ['a7', 'b', null],
    ['a11', 'b', 'K'],
    ['b6', 'r', 'R'],
    ['f10', 'r', 'R'],
  ]);
  assert.ok(move(s, 'r', 'h1', 'h2'));
  assert.equal(s.scores.b, 20);
  assert.equal(s.out.b, 'stalemate');
  assert.equal(s.turn, 'y');
});

test('Patt im Teammodus ist unentschieden', () => {
  const s = custom('teams', [
    ['a7', 'b', null],
    ['a11', 'b', 'K'],
    ['b6', 'r', 'R'],
    ['f10', 'r', 'R'],
  ]);
  move(s, 'r', 'h1', 'h2');
  assert.deepEqual(s.result?.winners, []);
});

test('Ein ungeschützter König im Schach kann geschlagen werden', () => {
  const s = custom('ffa', [['f7', 'r', 'R']]);
  assert.ok(move(s, 'r', 'f7', 'a7'));
  assert.equal(s.scores.r, 20);
  assert.equal(s.out.b, 'king');
  assert.equal(s.turn, 'y');
});

test('Teampartner können sich nicht schlagen', () => {
  const s = custom('teams', [
    ['f7', 'r', 'R'],
    ['i7', 'y', 'P'],
  ]);
  const targets = legalMoves(s)
    .filter((m) => m.from === at('f7'))
    .map((m) => m.to);
  assert.ok(targets.includes(at('h7')));
  assert.ok(!targets.includes(at('i7')));
});

test('Doppelschach: +5 mit dem Turm, +1 mit der Dame', () => {
  const s = custom('ffa', [
    ['a7', 'b', null],
    ['c9', 'b', 'K'],
    ['g14', 'y', null],
    ['i13', 'y', 'K'],
    ['i5', 'r', 'R'],
  ]);
  assert.ok(move(s, 'r', 'i5', 'i9'));
  assert.equal(s.scores.r, 5);
  assert.ok(inCheck(s, 'b'));

  const q = custom('ffa', [
    ['a7', 'b', null],
    ['c9', 'b', 'K'],
    ['g14', 'y', null],
    ['i13', 'y', 'K'],
    ['i5', 'r', 'Q'],
  ]);
  move(q, 'r', 'i5', 'i9');
  assert.equal(q.scores.r, 1);
});

test('Aufgeben im FFA: Figuren grau, letzter Spieler beendet das Spiel und gewinnt', () => {
  const s = newGame();
  assert.ok(applyAction(s, { t: 'resign', p: 'b' }));
  assert.equal(s.turn, 'r');
  assert.ok(piece(s, 'a7')?.d);
  move(s, 'r', 'e2', 'e4');
  assert.equal(s.turn, 'y', 'Blau wird übersprungen');
  applyAction(s, { t: 'resign', p: 'y' });
  assert.equal(s.turn, 'g');
  applyAction(s, { t: 'resign', p: 'g' });
  assert.equal(s.result?.reason, 'last');
  assert.deepEqual(s.result?.winners, ['r']);
  assert.equal(applyAction(s, { t: 'resign', p: 'r' }), false, 'nach Spielende geht nichts mehr');
});

test('Sieg beanspruchen bei 21 Punkten Vorsprung', () => {
  const s = newGame();
  applyAction(s, { t: 'resign', p: 'b' });
  applyAction(s, { t: 'resign', p: 'g' });
  s.scores.r = 30;
  s.scores.y = 9;
  assert.ok(canClaim(s, 'r'));
  assert.ok(!canClaim(s, 'y'));
  assert.ok(applyAction(s, { t: 'claim', p: 'r' }));
  assert.equal(s.scores.y, 29);
  assert.deepEqual(s.result?.winners, ['r']);
});

test('Dreifache Stellungswiederholung: Spielende, +10 für alle', () => {
  const s = newGame();
  const out = [
    ['r', 'e1', 'd3'],
    ['b', 'a5', 'c4'],
    ['y', 'e14', 'd12'],
    ['g', 'n5', 'l4'],
  ] as const;
  for (let round = 0; round < 2; round++) {
    for (const [p, a, b] of out) assert.ok(move(s, p, a, b));
    for (const [p, a, b] of out) assert.ok(move(s, p, b, a));
  }
  assert.equal(s.result?.reason, 'repetition');
  for (const c of COLORS) assert.equal(s.scores[c], 10);
});

for (const mode of ['ffa', 'teams'] as const) {
  test(`Zufallspartien (${mode}) laufen fehlerfrei und lassen sich exakt nachspielen`, () => {
    for (let game = 0; game < 6; game++) {
      const random = seededRandom(1000 + game);
      const s = newGame(mode);
      const actions: FourChessAction[] = [];
      while (!s.result && actions.length < 4000) {
        const moves = legalMoves(s);
        assert.ok(moves.length > 0, 'wer am Zug ist, hat einen Zug');
        const m = moves[Math.floor(random() * moves.length)]!;
        const action: FourChessAction = { t: 'm', p: s.turn, f: m.from, to: m.to };
        if (m.promote) action.pr = ('QRBN'[Math.floor(random() * 4)] as PromoPiece);
        assert.ok(applyAction(s, action));
        actions.push(action);
        for (const c of COLORS) {
          if (s.active[c]) assert.ok(findKing(s.board, c) >= 0, `aktive Farbe ${c} hat einen König`);
        }
        if (!s.result) assert.ok(s.active[s.turn]);
      }
      assert.ok(s.result, 'Partie endet (spätestens durch die 50-Züge-Regel)');
      const again = replay(mode, actions);
      assert.deepEqual(again.board, s.board);
      assert.deepEqual(again.scores, s.scores);
      assert.deepEqual(again.result, s.result);
    }
  });
}

test('Computergegner: schlägt eine ungedeckte Dame und findet ein Matt', () => {
  const s = custom('ffa', [
    ['f5', 'r', 'R'],
    ['j5', 'b', 'Q'],
  ]);
  const a = chooseBotMove(s);
  assert.equal(a?.to, at('j5'));

  const mate = custom('ffa', MATE);
  const b = chooseBotMove(mate);
  assert.deepEqual([b?.f, b?.to], [at('f5'), at('a5')]);
});

test('Computergegner: opfert keinen Turm für eine 1-Punkt umgewandelte Dame', () => {
  // Rot hat einen Turm auf f5, der von Blau (Turm auf j9) bedroht wird, falls Rot auf j5 schlägt.
  // Auf j5 steht eine umgewandelte 1-Punkt-Dame von Blau.
  const s = custom('ffa', [
    ['f5', 'r', 'R'],
    ['j5', 'b', 'Q', true], // umgewandelt
    ['j9', 'b', 'R'], // deckt j5 ab
  ]);
  const a = chooseBotMove(s, 'r', () => 0);
  // Turm darf nicht auf das abgedeckte Feld j5 opfern, um 1 Punkt zu holen
  assert.notEqual(a?.to, at('j5'));
});

test('Vier Computergegner spielen eine Partie zu Ende', () => {
  for (const mode of ['ffa', 'teams'] as const) {
    const random = seededRandom(7);
    const s = newGame(mode);
    let plies = 0;
    while (!s.result && plies < 3000) {
      const botMove = chooseBotMove(s, s.turn, random);
      assert.ok(botMove);
      if (!botMove) break;
      assert.ok(applyAction(s, botMove));
      plies++;
    }
    assert.ok(s.result, `${mode}: Partie beendet nach ${plies} Halbzügen`);
  }
});
