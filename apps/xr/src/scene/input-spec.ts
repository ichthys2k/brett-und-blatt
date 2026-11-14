/**
 * Freie Eingaben in VR (#358): Bei manchen Spielen sind die erlaubten Züge des Servers nur
 * Beispiele (Schätzmeister, Wort-Salat …), bei der Enten-Rallye und bei Fix gefunden! stünde
 * dort sogar die Lösung. Für diese Spiele baut die VR-App den Zug selbst aus einer Eingabe
 * (Zahlenfeld, Tastatur, Reihenfolge, Rechnung, Symbol) und blendet die Beispielzüge aus.
 * Der Server prüft den Zug wie jeden anderen. Ohne three.js, damit Tests es prüfen können.
 */
import type { GameMessage } from '@brett-und-blatt/online';
import { buildCards, symbolText, type Order, type SymbolSet } from '../../../../packages/games/symbol-match/src/deck';

export type InputSpec =
  | { kind: 'number'; prompt: string; make: (value: number) => unknown }
  | { kind: 'text'; prompt: string; fields?: string[]; make: (text: string, field: number) => unknown }
  | { kind: 'choice'; prompt: string; options: { label: string; move: unknown }[] }
  /** `scale` 10: Eingabe mit Komma, gespeichert in Zehnteln (Rechenmauer mit Dezimalzahlen). */
  | { kind: 'numbers'; prompt: string; slots: (number | null)[]; height: number; scale: number; make: (values: number[]) => unknown }
  | { kind: 'order'; prompt: string; items: string[]; make: (order: number[]) => unknown }
  | { kind: 'calc'; prompt: string; cards: number[]; make: (steps: { a: number; op: string; b: number }[], finalIndex: number) => unknown }
  | { kind: 'symbols'; prompt: string; center: string[]; targets: { seat: number; name: string; symbols: { label: string; move: unknown }[] }[] };

export interface InputPlan {
  spec: InputSpec;
  /** Zugarten, deren Beispielzüge nicht im Fenster stehen sollen. */
  hide: string[];
}

const typesOf = (game: GameMessage) => new Set(game.legalMoves.map((m) => (m as { type?: string }).type ?? ''));

export function inputPlan(game: GameMessage): InputPlan | null {
  const me = game.yourSeat;
  if (me === null || game.result) return null;
  const types = typesOf(game);
  const view = (game.view ?? {}) as Record<string, unknown>;
  switch (game.gameId) {
    case 'duck-rally': {
      if (!types.has('answer')) return null;
      const problem = (view as { racers: { currentProblem: { prompt: string; options: number[] | null } | null }[] }).racers[me]?.currentProblem;
      if (!problem) return null;
      const spec: InputSpec = problem.options
        ? { kind: 'choice', prompt: problem.prompt, options: problem.options.map((n) => ({ label: String(n), move: { type: 'answer', value: n } })) }
        : { kind: 'number', prompt: problem.prompt, make: (value) => ({ type: 'answer', value }) };
      return { spec, hide: ['answer'] };
    }
    case 'estimate': {
      if (!types.has('answer')) return null;
      const v = view as { questions: ({ text: string; unit: string; min: number; max: number } | null)[]; round: number };
      const q = v.questions[v.round];
      if (!q) return null;
      return { spec: { kind: 'number', prompt: `${q.text} (${q.min}–${q.max} ${q.unit})`, make: (answer) => ({ type: 'answer', answer }) }, hide: ['answer'] };
    }
    case 'timeline': {
      if (!types.has('answer')) return null;
      const v = view as { questions: ({ title: string; items: string[] } | null)[]; round: number };
      const q = v.questions[v.round];
      if (!q) return null;
      return { spec: { kind: 'order', prompt: `${q.title}: vom frühesten zum spätesten antippen`, items: q.items, make: (answer) => ({ type: 'answer', answer }) }, hide: ['answer'] };
    }
    case 'word-salad': {
      if (!types.has('submit')) return null;
      const v = view as { currentDisplay?: string; currentStem?: string };
      return { spec: { kind: 'text', prompt: `Wörter aus „${v.currentDisplay ?? v.currentStem ?? ''}“`, make: (word) => ({ type: 'submit', word: word.toUpperCase() }) }, hide: ['submit'] };
    }
    case 'category-sprint': {
      if (!types.has('answer')) return null;
      const v = view as { categoryNames: string[]; letters: string[] };
      return {
        spec: { kind: 'text', prompt: `Buchstabe ${v.letters[v.letters.length - 1] ?? ''}`, fields: v.categoryNames, make: (text, category) => ({ type: 'answer', category, text }) },
        hide: ['answer'],
      };
    }
    case 'describe-duel': {
      const kind = types.has('block') ? 'block' : types.has('clue') ? 'clue' : types.has('guess') ? 'guess' : null;
      if (!kind) return null;
      const prompt = kind === 'block' ? 'Sperrwörter, mit Leerzeichen getrennt' : kind === 'clue' ? 'Dein Hinweis' : 'Dein Tipp';
      const make = (text: string) => (kind === 'block' ? { type: 'block', words: text.split(/[\s,]+/).filter(Boolean) } : { type: kind, text });
      return { spec: { kind: 'text', prompt, make }, hide: ['block', 'clue', 'guess'] };
    }
    case 'who-am-i': {
      if (!types.has('guessText')) return null;
      return { spec: { kind: 'text', prompt: 'Wer bist du? Begriff eingeben', make: (text) => ({ type: 'guessText', text }) }, hide: ['guessText'] };
    }
    case 'number-wall': {
      if (!types.has('submit')) return null;
      const v = view as { givens: (number | null)[]; height: number; numberMode?: string };
      return {
        spec: { kind: 'numbers', prompt: 'Rechenmauer füllen', slots: v.givens, height: v.height, scale: v.numberMode === 'decimals' ? 10 : 1, make: (values) => ({ type: 'submit', values }) },
        hide: ['submit'],
      };
    }
    case 'target-number': {
      if (!types.has('submit')) return null;
      const v = view as { cards: number[]; target: number };
      return { spec: { kind: 'calc', prompt: `Ziel: ${v.target}`, cards: v.cards, make: (steps, finalIndex) => ({ type: 'submit', steps, finalIndex }) }, hide: ['submit'] };
    }
    case 'symbol-match': {
      if (!types.has('claim')) return null;
      const v = view as { center: number | null; options: { mode?: string; order: Order; symbols: SymbolSet }; players: { top: number | null }[] };
      const center = v.options.mode === 'hotPotato' ? (v.players[me]?.top ?? null) : v.center;
      if (center === null) return null;
      const cards = buildCards(v.options.order);
      const targets = [...new Set(game.legalMoves.map((m) => (m as { target: number }).target))];
      return {
        spec: {
          kind: 'symbols',
          prompt: 'Welches Symbol ist auf beiden Karten?',
          center: (cards[center] ?? []).map((s) => symbolText(v.options.symbols, s, center)),
          targets: targets.map((seat) => {
            const top = v.players[seat]?.top ?? null;
            return {
              seat,
              name: seat === me ? 'Deine Karte' : (game.seats[seat]?.name ?? `Platz ${seat + 1}`),
              symbols: top === null ? [] : (cards[top] ?? []).map((symbol) => ({ label: symbolText(v.options.symbols, symbol, top), move: { type: 'claim', symbol, center, target: seat, top } })),
            };
          }),
        },
        hide: ['claim'],
      };
    }
  }
  return null;
}

/** Indizes der Beispielzüge, die wegen einer eigenen Eingabe nicht im Fenster stehen. */
export function hiddenMoveIndexes(game: GameMessage): Set<number> {
  const plan = inputPlan(game);
  const hidden = new Set<number>();
  if (!plan) return hidden;
  game.legalMoves.forEach((m, i) => {
    if (plan.hide.includes((m as { type?: string }).type ?? '')) hidden.add(i);
  });
  return hidden;
}
