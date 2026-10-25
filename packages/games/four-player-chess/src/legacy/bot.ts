// @ts-nocheck – übernommen aus dem Projekt 4playerchess (gleicher Autor), noch nicht typisiert.
// Einfacher Computergegner. Er bewertet jeden erlaubten Zug mit ein paar
// Faustregeln (Material gewinnen, nichts einstellen, Schach und Matt geben,
// Figuren entwickeln) und wählt den besten – mit etwas Zufall, damit er nicht
// in jeder Partie gleich spielt.

import {
    COLORS, TEAM_OF, legalMoves, applyToBoard, attackers, isAttacked,
    enemiesOf, findKing, relRank, nextActive, rowOf, colOf,
} from './engine';

const VALUE = { P: 1, N: 3, B: 4, R: 5, Q: 9, K: 50 };

/** Liefert eine Zug-Aktion für color oder null, wenn kein Zug möglich ist. */
export function chooseBotMove(state, color = state.turn, random = Math.random) {
    const moves = legalMoves(state, color);
    if (!moves.length) return null;
    let best = moves[0], bestScore = -Infinity;
    for (const m of moves) {
        const score = scoreMove(state, color, m) + random() * 0.4;
        if (score > bestScore) {
            bestScore = score;
            best = m;
        }
    }
    const action = { t: 'm', p: color, f: best.from, to: best.to };
    if (best.promote) action.pr = 'Q';
    return action;
}

function cheapest(list) {
    return Math.min(...list.map(a => VALUE[a.piece.t]));
}

function centerDistance(i) {
    return Math.abs(rowOf(i) - 6.5) + Math.abs(colOf(i) - 6.5);
}

function scoreMove(state, color, m) {
    const board = state.board;
    const piece = board[m.from];
    const victim = m.ep !== undefined ? board[m.ep] : board[m.to];
    const enemy = enemiesOf(state, color);
    const friend = x => x === color || (state.mode === 'teams' && TEAM_OF[x] === TEAM_OF[color]);
    const value = piece.t === 'K' ? 0 : VALUE[piece.t];
    let score = 0;

    if (victim) score += victim.d ? 0.2 : victim.t === 'K' ? 100 : VALUE[victim.t];
    if (m.promote) score += 8;
    if (m.castle) score += 1.2;

    const after = board.slice();
    applyToBoard(after, m, 'Q');

    if (piece.t !== 'K') {
        // Steht die Figur nach dem Zug ungedeckt oder gegen eine billigere Figur?
        const threats = attackers(after, m.to, enemy);
        if (threats.length) {
            const newValue = m.promote ? VALUE.Q : value;
            const defended = isAttacked(after, m.to, friend);
            score -= defended ? Math.max(0, newValue - cheapest(threats)) * 0.9 : newValue * 0.9;
        }
        // Eine bedrohte Figur in Sicherheit bringen.
        const before = attackers(board, m.from, enemy);
        if (before.length) {
            const defended = isAttacked(board, m.from, friend);
            score += (defended ? Math.max(0, value - cheapest(before)) : value) * 0.7;
        }
    }

    // Schach, Doppelschach und (wahrscheinliches) Matt.
    const probe = { ...state, board: after, ep: [] };
    let checks = 0;
    for (const other of COLORS) {
        if (!enemy(other)) continue;
        const king = findKing(after, other);
        if (king < 0 || !isAttacked(after, king, x => x === color)) continue;
        checks++;
        score += 0.5;
        if (!legalMoves(probe, other).length) score += other === nextActive(state, color) ? 30 : 6;
    }
    if (state.mode === 'ffa' && checks >= 2) score += 4;

    // Stellungsspiel: entwickeln, Richtung Mitte, Bauern vorwärts, König geschützt.
    const early = state.ply < 48;
    if (early && (piece.t === 'N' || piece.t === 'B') && relRank(color, m.from) === 1) score += 0.4;
    if (piece.t === 'P') score += 0.05 * relRank(color, m.to);
    if (piece.t === 'K' && !m.castle) score -= early ? 0.6 : 0.1;
    if (piece.t === 'Q' && early) score -= 0.3;
    if (piece.t !== 'K') score += (centerDistance(m.from) - centerDistance(m.to)) * 0.04;

    return score;
}
