/**
 * Textausgabe des Kommandozeilen-Clients (#336). Ohne Spielregeln: Die Sicht wird nur als
 * gekürztes JSON gezeigt, die Züge kommen als nummerierte Liste mit den Zugtexten des Servers.
 */

const LEVELS = { easy: 'leicht', medium: 'mittel', hard: 'schwer' };

/** Kompaktes JSON, auf `max` Zeichen gekürzt. */
export function shortJson(value, max = 400) {
  const text = JSON.stringify(value) ?? 'null';
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

/** Wie ein Zug in der Liste heißt: der Zugtext des Servers, sonst das JSON des Zugs. */
export function moveText(game, index) {
  return game.moveLabels?.[index] ?? shortJson(game.legalMoves[index], 120);
}

/** Die nummerierte Zugliste, beginnend bei 1. */
export function formatMoves(game) {
  return game.legalMoves.map((_, i) => `  ${String(i + 1).padStart(3)}) ${moveText(game, i)}`).join('\n');
}

/** Wer an einem Platz sitzt, für Lobby und Partie. */
function seatText(seat, room, you) {
  if (seat.kind === 'bot') return `Bot (${LEVELS[seat.level] ?? seat.level})`;
  if (seat.memberId === null || seat.memberId === undefined) return seat.name ?? 'frei';
  const member = room?.members.find((m) => m.id === seat.memberId);
  const name = member?.name ?? seat.name ?? seat.memberId;
  return seat.memberId === you ? `${name} (du)` : name;
}

/** Kurzfassung des Raums. */
export function formatRoom(room, you) {
  const lines = [];
  const host = room.hostId === you ? 'du leitest den Raum' : `Leitung: ${room.members.find((m) => m.id === room.hostId)?.name ?? '–'}`;
  lines.push(`Raum ${room.code} · ${room.phase === 'lobby' ? 'Lobby' : room.phase === 'playing' ? 'Partie läuft' : 'Partie vorbei'} · ${host}`);
  lines.push(`Spiel: ${room.lobby.gameId ?? '(noch keins)'}`);
  room.lobby.seats.forEach((seat, i) => lines.push(`  Platz ${i + 1}: ${seatText(seat, room, you)}`));
  const watching = room.members.filter((m) => !room.lobby.seats.some((s) => s.kind === 'human' && s.memberId === m.id));
  if (watching.length) lines.push(`  ohne Platz: ${watching.map((m) => (m.id === you ? `${m.name} (du)` : m.name)).join(', ')}`);
  return lines.join('\n');
}

/** Ergebnis einer Partie als Satz. */
export function formatResult(game) {
  const { result } = game;
  if (!result) return '';
  const name = (seat) => (seat === game.yourSeat ? 'du' : `Platz ${seat + 1} (${game.seats[seat]?.name ?? '?'})`);
  if (result.kind === 'win') {
    if (result.winners.length === 1 && result.winners[0] === game.yourSeat) return 'Partie vorbei: Du gewinnst! 🎉';
    const names = result.winners.map(name).join(' und ');
    return `Partie vorbei: ${result.winners.length > 1 ? `Es gewinnen ${names}` : `Es gewinnt ${names}`}${result.winners.includes(game.yourSeat) ? ' 🎉' : ''}.`;
  }
  if (result.kind === 'draw') return 'Partie vorbei: unentschieden.';
  return 'Partie vorbei: Niemand gewinnt.';
}

/** Kopf einer Partie-Nachricht: wer spielt, wer dran ist, gekürzte Sicht. */
export function formatGame(game, { fullView = false } = {}) {
  const lines = [];
  const seats = game.seats.map((s, i) => `${i + 1}: ${s.kind === 'bot' ? `Bot ${LEVELS[s.level] ?? ''}`.trim() : s.name}${i === game.yourSeat ? ' (du)' : ''}`);
  lines.push(`${game.gameId} · Runde ${game.round} · Zug-Version ${game.version} · Plätze ${seats.join(', ')}`);
  if (game.result) lines.push(formatResult(game));
  else lines.push(`Am Zug: ${game.current.map((s) => (s === game.yourSeat ? 'du' : `Platz ${s + 1}`)).join(', ') || 'niemand'}`);
  lines.push(`Sicht: ${fullView ? JSON.stringify(game.view, null, 2) : shortJson(game.view)}`);
  return lines.join('\n');
}

export const HELP = `Befehle:
  <Zahl>              Zug aus der Liste wählen
  sicht               ganze Sicht als JSON
  züge                Zugliste noch einmal zeigen
  aufgeben            Partie aufgeben
  raum                Raum und Plätze zeigen
  spiel <id>          (Leitung) Spiel wählen, z. B. spiel tic-tac-toe
  bot <platz> [stufe] (Leitung) Platz mit Bot besetzen: leicht, mittel, schwer
  offen <platz>       (Leitung) Platz wieder freigeben
  setzen <platz>      sich auf einen Platz setzen
  aufstehen           Platz verlassen
  start               (Leitung) Partie beginnen
  lobby               (Leitung) nach der Partie zurück in die Lobby
  ende                Client beenden (der Platz bleibt reserviert)`;
