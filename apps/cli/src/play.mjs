/**
 * Ablauf des Kommandozeilen-Clients (#336): Raum betreten, Lobby einrichten, Züge aus der
 * Liste wählen. Getrennt von main.mjs, damit Tests ihn ohne Tastatur steuern können.
 */
import { Connection, createRoom } from './connection.mjs';
import { HELP, formatGame, formatMoves, formatResult, formatRoom, moveText } from './format.mjs';

const LEVEL_WORDS = { leicht: 'easy', mittel: 'medium', schwer: 'hard', easy: 'easy', medium: 'medium', hard: 'hard' };

/**
 * @param {object} options
 * @param {string} options.server   z. B. https://brett-und-blatt.lipponer.workers.dev
 * @param {string | null} options.code  Raumcode; null legt einen neuen Raum an
 * @param {string} options.token    geheime Gerätekennung (Wiedereinstieg)
 * @param {string} options.name
 * @param {string} [options.game]   Spiel-id, die die Leitung gleich wählt
 * @param {string} [options.bot]    Stufe, mit der die Leitung alle übrigen Plätze besetzt
 * @param {number} [options.seat]   Platz (ab 0), auf den sich der Client setzt
 * @param {boolean} [options.start] Partie beginnen, sobald alle Plätze besetzt sind
 * @param {boolean} [options.auto]  ohne Eingabe spielen: immer den ersten Zug wählen, nach der Partie enden
 * @param {number} [options.autoDelayMs] Bedenkzeit der Automatik (Standard 250 ms)
 * @param {{ print(text: string): void }} io
 * @returns {{ connection: Connection, done: Promise<object | null>, input(line: string): void }}
 */
export async function startClient(options, io) {
  const code = options.code ?? (await createRoom(options.server));
  if (!options.code) io.print(`Neuer Raum: ${code}  (andere treten mit diesem Code bei)`);
  const connection = new Connection({ server: options.server, code, token: options.token, name: options.name });

  let room = null;
  let game = null;
  /** Einmal-Schritte der Einrichtung, damit sie bei jeder Raum-Nachricht nicht doppelt kommen. */
  const sent = new Set();
  let shownVersion = -1;
  let finish;
  const done = new Promise((resolve) => (finish = resolve));

  const isHost = () => room?.hostId === connection.you;
  const mySeat = () => room?.lobby.seats.findIndex((s) => s.kind === 'human' && s.memberId === connection.you) ?? -1;
  const once = (key, message) => {
    if (sent.has(key)) return;
    sent.add(key);
    connection.send(message);
  };

  /** Die gewünschte Einrichtung Schritt für Schritt, je nach dem, was der Raum schon zeigt. */
  function setUp() {
    if (!room || room.phase !== 'lobby') return;
    const lobby = room.lobby;
    if (isHost() && options.game && lobby.gameId !== options.game) return once(`spiel:${options.game}`, { type: 'setGame', gameId: options.game });
    const wanted = options.seat ?? (isHost() && options.game ? 0 : undefined);
    if (wanted !== undefined && mySeat() !== wanted && lobby.seats[wanted]?.kind === 'human' && !lobby.seats[wanted].memberId) {
      return once(`platz:${wanted}`, { type: 'takeSeat', index: wanted });
    }
    if (isHost() && options.bot) {
      const free = lobby.seats.findIndex((s, i) => i !== mySeat() && s.kind === 'human' && !s.memberId);
      if (free >= 0) return once(`bot:${free}`, { type: 'setSeat', index: free, seat: { bot: options.bot } });
    }
    const full = lobby.gameId && lobby.seats.every((s) => s.kind === 'bot' || s.memberId);
    if (isHost() && options.start && full && mySeat() >= 0) once(`start:${game?.round ?? 0}`, { type: 'start' });
  }

  function showGame(next) {
    const fresh = next.version !== shownVersion;
    shownVersion = next.version;
    if (!fresh) return;
    if (next.result) {
      io.print(formatGame(next));
      if (options.auto) {
        connection.close();
        finish(next.result);
      } else io.print(isHost() ? 'Mit „lobby“ geht es zurück in die Lobby, mit „ende“ ist Schluss.' : 'Warte auf die Raumleitung …');
      return;
    }
    if (next.legalMoves.length === 0) return;
    io.print(`\n${formatGame(next)}\nDeine Züge:\n${formatMoves(next)}`);
    // Automatik: kurz warten (Ratenbegrenzung, 8 Nachrichten je Sekunde) und nur ziehen, wenn das noch der neueste Stand ist.
    if (options.auto) setTimeout(() => game === next && choose(next, 0), options.autoDelayMs ?? 250);
    else io.print('Zug wählen (Zahl), „hilfe“ für Befehle:');
  }

  function choose(current, index) {
    const move = current.legalMoves[index];
    if (move === undefined) return io.print(`Keinen Zug ${index + 1} – bitte 1 bis ${current.legalMoves.length}.`);
    io.print(`→ ${moveText(current, index)}`);
    // Der Zug geht unverändert aus legalMoves zurück, mit der zuletzt gesehenen Version.
    connection.send({ type: 'move', version: current.version, move });
  }

  connection
    .on('room', (message) => {
      const before = room;
      room = message;
      if (!before || before.phase !== room.phase || before.lobby.gameId !== room.lobby.gameId) io.print(formatRoom(room, connection.you));
      if (room.phase === 'lobby') game = null;
      setUp();
    })
    .on('game', (message) => {
      game = message;
      showGame(message);
    })
    .on('error', (message) => {
      // Bei einem veralteten Zug kommt die nächste game-Nachricht von selbst.
      io.print(`Server: ${message.message} (${message.code})`);
    })
    .on('reconnecting', ({ attempt, delay }) => io.print(`Verbindung weg – neuer Versuch ${attempt} in ${Math.round(delay / 100) / 10} s …`))
    .on('welcome', () => {
      if (shownVersion >= 0) io.print('Wieder verbunden – du sitzt auf deinem Platz.');
      // Nach dem Wiedereinstieg die aktuelle Partie neu zeigen.
      shownVersion = -1;
    })
    .on('closed', (error) => {
      if (error) io.print(error.message);
      finish(game?.result ?? null);
    });

  await connection.connect();
  io.print(`Angemeldet als ${options.name} (${connection.you}).`);

  /** Eine Eingabezeile im Mitspielbetrieb. */
  function input(line) {
    const [word = '', ...rest] = line.trim().split(/\s+/);
    const arg = rest[0];
    const seatArg = () => Number(arg) - 1;
    if (/^\d+$/.test(word)) {
      if (!game || game.result || game.legalMoves.length === 0) return io.print('Du bist gerade nicht am Zug.');
      return choose(game, Number(word) - 1);
    }
    switch (word.toLowerCase()) {
      case '':
        return;
      case 'hilfe':
      case '?':
        return io.print(HELP);
      case 'sicht':
        return io.print(game ? formatGame(game, { fullView: true }) : 'Keine Partie.');
      case 'züge':
      case 'zuege':
        return io.print(game && game.legalMoves.length ? formatMoves(game) : 'Keine Züge.');
      case 'raum':
        return io.print(room ? formatRoom(room, connection.you) : 'Noch kein Raum.');
      case 'aufgeben':
        return connection.send({ type: 'resign' });
      case 'spiel':
        return arg ? connection.send({ type: 'setGame', gameId: arg }) : io.print('Welches Spiel? z. B. spiel tic-tac-toe');
      case 'bot':
        return connection.send({ type: 'setSeat', index: seatArg(), seat: { bot: LEVEL_WORDS[rest[1] ?? 'leicht'] ?? 'easy' } });
      case 'offen':
        return connection.send({ type: 'setSeat', index: seatArg(), seat: 'open' });
      case 'setzen':
        return connection.send({ type: 'takeSeat', index: seatArg() });
      case 'aufstehen':
        return connection.send({ type: 'leaveSeat' });
      case 'start':
        return connection.send({ type: 'start' });
      case 'lobby':
        return connection.send({ type: 'toLobby' });
      case 'ende':
        connection.close();
        return finish(game?.result ?? null);
      default:
        return io.print(`Unbekannter Befehl „${word}“ – „hilfe“ zeigt alle.`);
    }
  }

  return { connection, done, input, code, result: () => (game?.result ? formatResult(game) : null) };
}
