// Ein nachgebauter Mitspieler zum Ausprobieren im Browser: Zwei Tabs im selben Browser
// sind für den Server dieselbe Person (gleiche Geräte-Kennung). Dieses Skript tritt
// stattdessen als „Ben“ bei, setzt sich auf den ersten freien Platz und zieht immer
// selbst, wenn er dran ist. Beenden mit Strg+C.
//   node apps/server/scripts/mitspieler.mjs '🦊🍎🚀🎈' [http://127.0.0.1:8787]
const [code, base = 'http://127.0.0.1:8787'] = process.argv.slice(2);
if (!code) {
  console.log('Aufruf: node apps/server/scripts/mitspieler.mjs <Raumcode> [Serveradresse]');
  process.exit(1);
}
const ws = new WebSocket(`${base.replace(/^http/, 'ws')}/rooms/${encodeURIComponent(code)}`, { headers: { Origin: 'http://localhost:5173' } });
let you = null;
let lastVersion = -1;
ws.addEventListener('open', () => ws.send(JSON.stringify({ type: 'hello', protocol: 1, token: `mitspieler-${crypto.randomUUID()}`, name: 'Ben', avatar: '🐼' })));
ws.addEventListener('message', (event) => {
  const m = JSON.parse(event.data);
  if (m.type === 'welcome') {
    you = m.you;
    console.log(`Im Raum ${code} als Ben (${you}).`);
  }
  if (m.type === 'room' && m.phase === 'lobby' && !m.lobby.seats.some((s) => s.kind === 'human' && s.memberId === you)) {
    const open = m.lobby.seats.findIndex((s) => s.kind === 'human' && s.memberId === null);
    if (open >= 0) ws.send(JSON.stringify({ type: 'takeSeat', index: open }));
  }
  if (m.type === 'game' && m.legalMoves.length > 0 && m.version !== lastVersion) {
    lastVersion = m.version;
    // Kurz „überlegen“, dann einen Zug aus der Mitte der erlaubten Züge.
    setTimeout(() => ws.send(JSON.stringify({ type: 'move', version: m.version, move: m.legalMoves[Math.floor(m.legalMoves.length / 2)] })), 700);
  }
  if (m.type === 'game' && m.result) console.log('Partie zu Ende:', JSON.stringify(m.result));
  if (m.type === 'signal') console.log('Reaktion:', m.value);
  if (m.type === 'error') console.log('Fehler:', m.message);
});
ws.addEventListener('close', () => {
  console.log('Verbindung beendet.');
  process.exit(0);
});
