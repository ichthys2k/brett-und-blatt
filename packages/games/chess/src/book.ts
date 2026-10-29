import { Chess } from 'chess.js';
import { positionKey } from './rules';

/**
 * Kleines Eröffnungsbuch für die Bots auf „mittel“ und „schwer“: bekannte Hauptvarianten
 * (Zugfolgen sind Allgemeinwissen), je 8–12 Halbzüge in englischer Kurzschreibweise.
 * Der Bot spielt einen der Buchzüge der aktuellen Stellung – auch wenn sie über eine andere
 * Zugfolge entstanden ist –, so beginnen seine Partien abwechslungsreich und solide.
 */
const LINES = [
  // 1. e4 e5
  'e4 e5 Nf3 Nc6 Bc4 Bc5 c3 Nf6 d3 d6 O-O O-O', // Italienisch, Giuoco Piano
  'e4 e5 Nf3 Nc6 Bc4 Nf6 d3 Be7 O-O O-O Re1 d6', // Italienisch, ruhig
  'e4 e5 Nf3 Nc6 Bc4 Nf6 Ng5 d5 exd5 Na5 Bb5+ c6', // Zweispringerspiel
  'e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O Be7 Re1 b5', // Spanisch, Hauptvariante
  'e4 e5 Nf3 Nc6 Bb5 Nf6 O-O Nxe4 d4 Nd6 Bxc6 dxc6', // Spanisch, Berliner
  'e4 e5 Nf3 Nc6 Bb5 a6 Bxc6 dxc6 O-O f6 d4 exd4', // Spanisch, Abtausch
  'e4 e5 Nf3 Nc6 d4 exd4 Nxd4 Nf6 Nxc6 bxc6 e5 Qe7', // Schottisch
  'e4 e5 Nf3 Nc6 Nc3 Nf6 Bb5 Bb4 O-O O-O d3 d6', // Vierspringerspiel
  'e4 e5 Nf3 Nf6 Nxe5 d6 Nf3 Nxe4 d4 d5 Bd3 Nc6', // Russisch (Petroff)
  'e4 e5 Nf3 d6 d4 Nf6 Nc3 Nbd7 Bc4 Be7 O-O O-O', // Philidor
  'e4 e5 f4 exf4 Nf3 d6 d4 g5 h4 g4', // Königsgambit
  // 1. e4, andere Antworten
  'e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6 Be2 e5', // Sizilianisch, Najdorf
  'e4 c5 Nf3 Nc6 d4 cxd4 Nxd4 Nf6 Nc3 e5 Ndb5 d6', // Sizilianisch, Sweschnikow
  'e4 c5 Nf3 e6 d4 cxd4 Nxd4 Nc6 Nc3 Qc7 Be2 a6', // Sizilianisch, Taimanow
  'e4 c5 c3 Nf6 e5 Nd5 d4 cxd4 Nf3 Nc6 cxd4 d6', // Sizilianisch, Alapin
  'e4 c5 Nc3 Nc6 g3 g6 Bg2 Bg7 d3 d6 f4 e6', // Sizilianisch, geschlossen
  'e4 e6 d4 d5 Nc3 Nf6 Bg5 Be7 e5 Nfd7 Bxe7 Qxe7', // Französisch, klassisch
  'e4 e6 d4 d5 Nc3 Bb4 e5 c5 a3 Bxc3+ bxc3 Ne7', // Französisch, Winawer
  'e4 e6 d4 d5 e5 c5 c3 Nc6 Nf3 Qb6 a3 c4', // Französisch, Vorstoß
  'e4 e6 d4 d5 Nd2 Nf6 e5 Nfd7 Bd3 c5 c3 Nc6', // Französisch, Tarrasch
  'e4 c6 d4 d5 Nc3 dxe4 Nxe4 Bf5 Ng3 Bg6 h4 h6', // Caro-Kann, klassisch
  'e4 c6 d4 d5 e5 Bf5 Nf3 e6 Be2 c5 Be3 Nd7', // Caro-Kann, Vorstoß
  'e4 d5 exd5 Qxd5 Nc3 Qa5 d4 Nf6 Nf3 c6 Bc4 Bf5', // Skandinavisch
  'e4 Nf6 e5 Nd5 d4 d6 Nf3 Bg4 Be2 e6 O-O Be7', // Aljechin
  'e4 d6 d4 Nf6 Nc3 g6 Nf3 Bg7 Be2 O-O O-O c6', // Pirc
  // 1. d4
  'd4 d5 c4 e6 Nc3 Nf6 Bg5 Be7 e3 O-O Nf3 h6', // Damengambit, abgelehnt
  'd4 d5 c4 dxc4 Nf3 Nf6 e3 e6 Bxc4 c5 O-O a6', // Damengambit, angenommen
  'd4 d5 c4 c6 Nf3 Nf6 Nc3 dxc4 a4 Bf5 e3 e6', // Slawisch
  'd4 d5 c4 c6 Nf3 Nf6 Nc3 e6 e3 Nbd7 Bd3 dxc4', // Halbslawisch
  'd4 d5 Nf3 Nf6 Bf4 e6 e3 c5 c3 Nc6 Nbd2 Bd6', // Londoner System
  'd4 Nf6 c4 e6 Nc3 Bb4 e3 O-O Bd3 d5 Nf3 c5', // Nimzoindisch
  'd4 Nf6 c4 e6 Nf3 b6 g3 Ba6 b3 Bb4+ Bd2 Be7', // Damenindisch
  'd4 Nf6 c4 g6 Nc3 Bg7 e4 d6 Nf3 O-O Be2 e5', // Königsindisch
  'd4 Nf6 c4 g6 Nc3 d5 cxd5 Nxd5 e4 Nxc3 bxc3 Bg7', // Grünfeld
  'd4 Nf6 c4 c5 d5 e6 Nc3 exd5 cxd5 d6 e4 g6', // Benoni
  'd4 Nf6 Bf4 g6 e3 Bg7 Nf3 O-O Be2 d6 O-O Nbd7', // Londoner gegen Königsindisch
  'd4 f5 g3 Nf6 Bg2 e6 Nf3 Be7 O-O O-O c4 d6', // Holländisch
  // 1. c4, 1. Nf3
  'c4 e5 Nc3 Nf6 Nf3 Nc6 g3 d5 cxd5 Nxd5 Bg2 Nb6', // Englisch, umgekehrtes Sizilianisch
  'c4 c5 Nc3 Nc6 g3 g6 Bg2 Bg7 Nf3 Nf6 O-O O-O', // Englisch, symmetrisch
  'c4 Nf6 Nc3 e6 Nf3 d5 d4 Be7 Bg5 O-O e3 h6', // Englisch, Übergang zum Damengambit
  'Nf3 d5 g3 Nf6 Bg2 c6 O-O Bg4 d3 Nbd7 Nbd2 e5', // Réti
  'Nf3 Nf6 c4 g6 Nc3 Bg7 e4 d6 d4 O-O Be2 e5', // Réti, Übergang zum Königsindisch
];

let book: Map<string, string[]> | null = null;

/** Baut das Buch beim ersten Gebrauch: Stellung → mögliche nächste Züge (mit Häufigkeit). */
function load(): Map<string, string[]> {
  if (book) return book;
  book = new Map();
  for (const line of LINES) {
    const chess = new Chess();
    for (const san of line.split(' ')) {
      const key = positionKey(chess.fen());
      const move = chess.move(san);
      book.set(key, [...(book.get(key) ?? []), move.lan]);
    }
  }
  return book;
}

/** Buchzüge dieser Stellung als Langschreibweise (z. B. „e2e4“, „e7e8q“); mehrfach genannte zählen öfter. */
export function bookMoves(fen: string): string[] {
  return load().get(positionKey(fen)) ?? [];
}

/** Für den Test: alle Zeilen. */
export const BOOK_LINES = LINES;
