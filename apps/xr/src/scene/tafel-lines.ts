/**
 * Spieltafel (#358): Für Spiele ohne eigenen 3D-Tisch steht eine Tafel auf dem Tisch, die den
 * Stand in kurzen Zeilen zeigt. Die Züge stehen als Knöpfe im Fenster darüber (mit Zugtexten).
 * Je Spiel liest ein kleiner Übersetzer nur aus der Sicht; ohne eigenen Übersetzer zeigt die
 * Tafel, was sich allgemein finden lässt (Runde, Punkte). Ohne three.js, damit Tests es prüfen.
 */
import type { GameMessage } from '@brett-und-blatt/online';
import bibel from '../../../../content/quartett/bibel.json';
import dinosaurier from '../../../../content/quartett/dinosaurier.json';
import geometrie from '../../../../content/quartett/geometrie.json';
import tiere from '../../../../content/quartett/tiere.json';
import weltraum from '../../../../content/quartett/weltraum.json';

interface QuartettSet {
  properties: { id: string; label: string; unit: string }[];
  cards: { id: string; name: string; emoji: string; values: Record<string, number> }[];
}
const QUARTETT_SETS: Record<string, QuartettSet> = { bibel, dinosaurier, geometrie, tiere, weltraum } as unknown as Record<string, QuartettSet>;

const name = (game: GameMessage, seat: number) => (seat === game.yourSeat ? 'Du' : (game.seats[seat]?.name ?? `Platz ${seat + 1}`));
const number = (n: number) => n.toLocaleString('de-DE');

/** Punkte je Platz, wenn die Sicht ein Feld `scores` mit Zahlen hat. */
function scoreLine(game: GameMessage, view: Record<string, unknown>): string[] {
  const scores = view.scores;
  if (!Array.isArray(scores) || !scores.every((s) => typeof s === 'number')) return [];
  return [`Punkte: ${scores.map((s, i) => `${name(game, i)} ${s}`).join(' · ')}`];
}

export function tafelLines(game: GameMessage): string[] {
  const view = (game.view ?? {}) as Record<string, unknown>;
  const me = game.yourSeat;
  switch (game.gameId) {
    case 'quartett': {
      const v = view as { set: string; mode: string; stacks: { card: string | null }[][]; hands: (string | null)[][]; middle: string[] };
      const set = QUARTETT_SETS[v.set];
      if (v.mode === 'trump') {
        const top = me === null ? null : (v.stacks[me]?.[0]?.card ?? null);
        const card = set?.cards.find((c) => c.id === top);
        const lines = [`Deine Karten: ${me === null ? 0 : (v.stacks[me]?.length ?? 0)}${v.middle.length ? ` · Mitte: ${v.middle.length}` : ''}`];
        if (card && set) {
          lines.push(`${card.emoji} ${card.name} (${card.id})`);
          for (const p of set.properties) lines.push(`${p.label}: ${number(card.values[p.id] ?? 0)} ${p.unit}`);
        }
        return lines;
      }
      const hand = me === null ? [] : (v.hands[me] ?? []).filter((c): c is string => c !== null);
      return [`Deine Karten (${hand.length}):`, ...chunk(hand.map((id) => set?.cards.find((c) => c.id === id)?.name ?? id), 3).map((row) => row.join(', '))];
    }
    case 'turnip-patch': {
      const v = view as { hares: number[][]; card: number | null; turn: number };
      return [...v.hares.map((h, s) => `${name(game, s)}: Hasen auf ${h.map((f) => (f === 0 ? 'Start' : f >= 25 ? 'Rübe' : f)).join(', ')}`), v.card ? `Gezogen: ${v.card}` : ''].filter(Boolean);
    }
    case 'market-stalls': {
      const v = view as { day: number; days: number; stands: number[][]; hands: number[][]; pantries: number[][] };
      return [
        `Tag ${v.day} von ${v.days}`,
        ...v.stands.map((s, i) => `Stand ${i + 1}: ${s.join(', ') || '–'}`),
        `Deine Hand: ${me === null ? '' : (v.hands[me] ?? []).filter((c) => c > 0).join(', ')}`,
        ...v.pantries.map((p, s) => `${name(game, s)}: ${p.length} Karten in der Vorratskammer`),
      ];
    }
    case 'ligretto': {
      const v = view as { center: { id: number; suit: string; cards: { value: number }[] }[]; players: { ligrettoCount: number; row: { suit: string; value: number }[]; talonTop: { suit: string; value: number } | null }[] };
      const mine = me === null ? undefined : v.players[me];
      return [
        `Mitte: ${v.center.map((p) => `${p.id + 1}: ${SUITS[p.suit] ?? p.suit} ${p.cards[p.cards.length - 1]?.value ?? ''}`).join(' · ') || 'noch leer'}`,
        mine ? `Deine Reihe: ${mine.row.map((c) => `${SUITS[c.suit] ?? c.suit} ${c.value}`).join(', ')}` : '',
        mine ? `Talon: ${mine.talonTop ? `${SUITS[mine.talonTop.suit] ?? ''} ${mine.talonTop.value}` : '–'} · Kartenblitz-Stapel: ${mine.ligrettoCount}` : '',
        ...v.players.map((p, s) => (s === me ? '' : `${name(game, s)}: noch ${p.ligrettoCount}`)),
      ].filter(Boolean);
    }
    case 'marketplace': {
      const v = view as { round: number; rounds: number; players: { pos: number; cash: number; gone: boolean }[] };
      return [`Runde ${v.round + 1} von ${v.rounds}`, ...v.players.map((p, s) => `${name(game, s)}: ${p.cash} Taler, Feld ${p.pos + 1}${p.gone ? ' (ausgeschieden)' : ''}`)];
    }
    case 'drachenspiel': {
      const v = view as { players: { health: number; armor: number; mana: number; maxMana: number; handCount: number; board: unknown[]; deckCount: number }[] };
      return v.players.map((p, s) => `${name(game, s)}: ❤ ${p.health}${p.armor ? ` 🛡 ${p.armor}` : ''} · Mana ${p.mana}/${p.maxMana} · Hand ${p.handCount} · Feld ${p.board.length} · Stapel ${p.deckCount}`);
    }
    case 'wolves-sheep': {
      const v = view as { phase: string; day: number; roles: (string | null)[]; alive: boolean[] };
      const role = me === null ? null : v.roles[me];
      return [`${v.phase === 'night' ? 'Nacht' : 'Tag'} ${v.day}`, role ? `Deine Rolle: ${ROLES[role] ?? role}` : '', `Noch im Spiel: ${v.alive.map((a, s) => (a ? name(game, s) : '')).filter(Boolean).join(', ')}`].filter(Boolean);
    }
    case 'bible-quiz': {
      const v = view as { currentRound: number; totalRounds: number; currentQuestion: { category: string; emojis: string; shuffledOptions: string[] } | null; scores: number[] };
      const q = v.currentQuestion;
      return [`Frage ${v.currentRound} von ${v.totalRounds}${q ? ` · ${q.category}` : ''}`, q ? q.emojis : '', ...(q?.shuffledOptions.map((o, i) => `${String.fromCharCode(65 + i)}: ${o}`) ?? []), ...scoreLine(game, view)].filter(Boolean);
    }
    case 'hangman': {
      const v = view as { boards: { maskedWord: string; wrongLetters: string[]; mistakes: number }[]; maxMistakes: number };
      return v.boards.flatMap((b) => [b.maskedWord.split('').join(' '), `Fehler: ${b.mistakes} von ${v.maxMistakes}${b.wrongLetters.length ? ` (${b.wrongLetters.join(', ')})` : ''}`]);
    }
    case 'bingo': {
      const v = view as { size: number; cards: (number | string | null)[][]; marks: boolean[][]; lastCall: number | string | null; drawn: number };
      const card = me === null ? [] : (v.cards[me] ?? []);
      const marks = me === null ? [] : (v.marks[me] ?? []);
      const rows = Array.from({ length: v.size }, (_, r) => card.slice(r * v.size, r * v.size + v.size).map((c, k) => (marks[r * v.size + k] ? `[${c ?? '★'}]` : String(c ?? '★'))).join('  '));
      return [`Gerufen: ${v.lastCall ?? '–'} (${v.drawn} gezogen)`, ...rows];
    }
    case 'word-salad': {
      const v = view as { currentDisplay: string; currentHint: string; players: { foundWords: string[]; score: number }[] };
      const mine = me === null ? undefined : v.players[me];
      return [`${v.currentDisplay} – ${v.currentHint}`, mine ? `Gefunden: ${mine.foundWords.join(', ') || '–'}` : '', ...v.players.map((p, s) => `${name(game, s)}: ${p.score} Punkte`)].filter(Boolean);
    }
    case 'majority':
    case 'estimate':
    case 'timeline': {
      const v = view as { questions: ({ text?: string; title?: string; options?: string[] } | null)[]; round: number; phase: string };
      const q = v.questions[v.round];
      return [`Runde ${v.round + 1} von ${v.questions.length}`, q?.text ?? q?.title ?? '', ...(game.gameId === 'majority' ? (q?.options ?? []) : []), ...scoreLine(game, view)].filter(Boolean);
    }
  }
  const lines: string[] = [];
  if (typeof view.round === 'number' && typeof view.totalRounds === 'number') lines.push(`Runde ${view.round + 1} von ${view.totalRounds}`);
  return [...lines, ...scoreLine(game, view)];
}

const SUITS: Record<string, string> = { red: 'Rot', yellow: 'Gelb', green: 'Grün', blue: 'Blau' };
const ROLES: Record<string, string> = { wolf: 'Wolf', sheep: 'Schaf', examiner: 'Prüfer', shepherd: 'Hirte', hound: 'Hütehund', binder: 'Bandstifter', lamb: 'Lamm', stray: 'Zugelaufenes Schaf', leader: 'Leithammel' };

function chunk<T>(list: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}
