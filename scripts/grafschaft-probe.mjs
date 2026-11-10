// Probe für Grafschaft (W-039): simuliert das Sechseck-Legespiel mit Bots,
// um Balance, Hofaufträge, Dorf-Vielfalt und Spieldauer vor dem Bau zu prüfen.
//
//   node scripts/grafschaft-probe.mjs
//   node scripts/grafschaft-probe.mjs --games=500
//   node scripts/grafschaft-probe.mjs --set="Dorf wächst mit"

const HEX_DIRECTIONS = [
  [1, 0],
  [1, -1],
  [0, -1],
  [-1, 0],
  [-1, 1],
  [0, 1],
];

function hexKey(q, r) {
  return `${q},${r}`;
}

function parseHexKey(key) {
  const [q, r] = key.split(',').map(Number);
  return { q, r };
}

function hexDistance(q1, r1, q2, r2) {
  return (Math.abs(q1 - q2) + Math.abs(q1 + r1 - q2 - r2) + Math.abs(r1 - r2)) / 2;
}

function rngFrom(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle(list, rng) {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** 6 Landschaftstypen */
export const LANDSCAPES = ['wald', 'wiese', 'feld', 'teich', 'dorf', 'berg'];

/** 60 Landschaftsplättchen */
export function createDeck() {
  const deck = [];
  let id = 1;

  // Wald: 14 Plättchen (4 mit Fluss, 4 mit Weg)
  for (let i = 0; i < 14; i++) {
    deck.push({ id: id++, type: 'wald', river: i < 4, road: i >= 4 && i < 8, mill: false });
  }
  // Wiese: 12 Plättchen (3 mit Fluss, 4 mit Weg)
  for (let i = 0; i < 12; i++) {
    deck.push({ id: id++, type: 'wiese', river: i < 3, road: i >= 3 && i < 7, mill: false });
  }
  // Feld: 12 Plättchen (3 mit Mühle, 4 mit Weg)
  for (let i = 0; i < 12; i++) {
    deck.push({ id: id++, type: 'feld', river: false, road: i < 4, mill: i >= 4 && i < 7 });
  }
  // Teich: 8 Plättchen (4 mit Fluss)
  for (let i = 0; i < 8; i++) {
    deck.push({ id: id++, type: 'teich', river: i < 4, road: false, mill: false });
  }
  // Berg: 6 Plättchen (2 mit Weg)
  for (let i = 0; i < 6; i++) {
    deck.push({ id: id++, type: 'berg', river: false, road: i < 2, mill: false });
  }
  // Dorf: 8 Plättchen (4 mit Weg)
  for (let i = 0; i < 8; i++) {
    deck.push({ id: id++, type: 'dorf', river: false, road: i < 4, mill: false });
  }

  return deck;
}

/** 20 Höflings-Aufträge */
export const QUESTS = [
  { id: 'q1', name: 'Die Gans: 3 Teiche zusammen', points: 3, check: checkPondGroup3 },
  { id: 'q2', name: 'Der Müller: Mühle am Fluss oder Teich', points: 3, check: checkMillWater },
  { id: 'q3', name: 'Der Bär: 4 Wälder zusammen', points: 4, check: checkForestGroup4 },
  { id: 'q4', name: 'Der Ritter: Berg am Weg', points: 2, check: checkMountainRoad },
  { id: 'q5', name: 'Der Schäfer: Wiese neben Dorf', points: 2, check: checkPastureVillage },
  { id: 'q6', name: 'Die Wirtin: Dorf mit 4 Landschaften', points: 4, check: checkVillageVariety4 },
  { id: 'q7', name: 'Der Fischer: Teich neben Wald', points: 2, check: checkPondForest },
  { id: 'q8', name: 'Der Einsiedler: Berg ohne Dorf (Abstand ≥ 2)', points: 3, check: checkMountainIsolated },
  { id: 'q9', name: 'Der Bauer: 4 Felder zusammen', points: 4, check: checkFieldGroup4 },
  { id: 'q10', name: 'Der Bote: Weglänge ≥ 4', points: 4, check: checkRoadLength4 },
  { id: 'q11', name: 'Der Flusslauf: Flusslänge ≥ 4', points: 4, check: checkRiverLength4 },
  { id: 'q12', name: 'Das Bergnest: Dorf am Berg', points: 3, check: checkVillageMountain },
  { id: 'q13', name: 'Die Schafweide: 4 Wiesen zusammen', points: 4, check: checkPastureGroup4 },
  { id: 'q14', name: 'Der Hofnarr: Plättchen mit 4 Nachbarn', points: 3, check: checkHexWith4Neighbors },
  { id: 'q15', name: 'Der Baumeister: Umringtes Dorf (6 Nachbarn)', points: 5, check: checkSurroundedVillage },
  { id: 'q16', name: 'Die Kornkammer: Mühle an 2 Feldern', points: 3, check: checkMillTwoFields },
  { id: 'q17', name: 'Der Wanderer: Weg an Berg und Teich', points: 4, check: checkRoadMountainPond },
  { id: 'q18', name: 'Das Doppeldorf: 2 Dörfer benachbart', points: 3, check: checkAdjacentVillages },
  { id: 'q19', name: 'Der Schilfgürtel: Teich an Wiese und Feld', points: 3, check: checkPondPastureField },
  { id: 'q20', name: 'Die Waldlichtung: Wiese umringt von ≥ 3 Wäldern', points: 3, check: checkPastureForestRing },
];

// Hilfsfunktionen für Zusammenhang und Nachbarschaft
function getNeighbors(board, q, r) {
  const neighbors = [];
  for (const [dq, dr] of HEX_DIRECTIONS) {
    const key = hexKey(q + dq, r + dr);
    if (board.has(key)) {
      neighbors.push({ q: q + dq, r: r + dr, tile: board.get(key) });
    }
  }
  return neighbors;
}

function getConnectedComponent(board, startKey, predicate) {
  const visited = new Set();
  const queue = [startKey];
  visited.add(startKey);

  while (queue.length > 0) {
    const currentKey = queue.shift();
    const { q, r } = parseHexKey(currentKey);
    for (const [dq, dr] of HEX_DIRECTIONS) {
      const nKey = hexKey(q + dq, r + dr);
      if (!visited.has(nKey) && board.has(nKey)) {
        const neighbor = board.get(nKey);
        if (predicate(neighbor, q + dq, r + dr)) {
          visited.add(nKey);
          queue.push(nKey);
        }
      }
    }
  }
  return visited.size;
}

function checkPondGroup3(board) {
  for (const [key, tile] of board) {
    if (tile.type === 'teich') {
      if (getConnectedComponent(board, key, (t) => t.type === 'teich') >= 3) return true;
    }
  }
  return false;
}

function checkMillWater(board) {
  for (const [key, tile] of board) {
    if (tile.mill) {
      const { q, r } = parseHexKey(key);
      const neighbors = getNeighbors(board, q, r);
      if (neighbors.some((n) => n.tile.type === 'teich' || n.tile.river)) return true;
    }
  }
  return false;
}

function checkForestGroup4(board) {
  for (const [key, tile] of board) {
    if (tile.type === 'wald') {
      if (getConnectedComponent(board, key, (t) => t.type === 'wald') >= 4) return true;
    }
  }
  return false;
}

function checkMountainRoad(board) {
  for (const [key, tile] of board) {
    if (tile.type === 'berg') {
      const { q, r } = parseHexKey(key);
      const neighbors = getNeighbors(board, q, r);
      if (tile.road || neighbors.some((n) => n.tile.road)) return true;
    }
  }
  return false;
}

function checkPastureVillage(board) {
  for (const [key, tile] of board) {
    if (tile.type === 'dorf') {
      const { q, r } = parseHexKey(key);
      const neighbors = getNeighbors(board, q, r);
      if (neighbors.some((n) => n.tile.type === 'wiese')) return true;
    }
  }
  return false;
}

function checkVillageVariety4(board) {
  for (const [key, tile] of board) {
    if (tile.type === 'dorf') {
      const { q, r } = parseHexKey(key);
      const neighbors = getNeighbors(board, q, r);
      const types = new Set(neighbors.map((n) => n.tile.type));
      if (types.size >= 4) return true;
    }
  }
  return false;
}

function checkPondForest(board) {
  for (const [key, tile] of board) {
    if (tile.type === 'teich') {
      const { q, r } = parseHexKey(key);
      const neighbors = getNeighbors(board, q, r);
      if (neighbors.some((n) => n.tile.type === 'wald')) return true;
    }
  }
  return false;
}

function checkMountainIsolated(board) {
  for (const [key, tile] of board) {
    if (tile.type === 'berg') {
      const { q: mq, r: mr } = parseHexKey(key);
      let hasNearbyVillage = false;
      for (const [vKey, vTile] of board) {
        if (vTile.type === 'dorf') {
          const { q: vq, r: vr } = parseHexKey(vKey);
          if (hexDistance(mq, mr, vq, vr) < 2) {
            hasNearbyVillage = true;
            break;
          }
        }
      }
      if (!hasNearbyVillage) return true;
    }
  }
  return false;
}

function checkFieldGroup4(board) {
  for (const [key, tile] of board) {
    if (tile.type === 'feld') {
      if (getConnectedComponent(board, key, (t) => t.type === 'feld') >= 4) return true;
    }
  }
  return false;
}

function checkRoadLength4(board) {
  for (const [key, tile] of board) {
    if (tile.road) {
      if (getConnectedComponent(board, key, (t) => t.road) >= 4) return true;
    }
  }
  return false;
}

function checkRiverLength4(board) {
  for (const [key, tile] of board) {
    if (tile.river) {
      if (getConnectedComponent(board, key, (t) => t.river) >= 4) return true;
    }
  }
  return false;
}

function checkVillageMountain(board) {
  for (const [key, tile] of board) {
    if (tile.type === 'dorf') {
      const { q, r } = parseHexKey(key);
      const neighbors = getNeighbors(board, q, r);
      if (neighbors.some((n) => n.tile.type === 'berg')) return true;
    }
  }
  return false;
}

function checkPastureGroup4(board) {
  for (const [key, tile] of board) {
    if (tile.type === 'wiese') {
      if (getConnectedComponent(board, key, (t) => t.type === 'wiese') >= 4) return true;
    }
  }
  return false;
}

function checkHexWith4Neighbors(board) {
  for (const [key] of board) {
    const { q, r } = parseHexKey(key);
    if (getNeighbors(board, q, r).length >= 4) return true;
  }
  return false;
}

function checkSurroundedVillage(board) {
  for (const [key, tile] of board) {
    if (tile.type === 'dorf') {
      const { q, r } = parseHexKey(key);
      if (getNeighbors(board, q, r).length === 6) return true;
    }
  }
  return false;
}

function checkMillTwoFields(board) {
  for (const [key, tile] of board) {
    if (tile.mill) {
      const { q, r } = parseHexKey(key);
      const neighbors = getNeighbors(board, q, r);
      const fieldCount = neighbors.filter((n) => n.tile.type === 'feld').length;
      if (fieldCount >= 2) return true;
    }
  }
  return false;
}

function checkRoadMountainPond(board) {
  for (const [key, tile] of board) {
    if (tile.road) {
      const { q, r } = parseHexKey(key);
      const neighbors = getNeighbors(board, q, r);
      const hasMountain = tile.type === 'berg' || neighbors.some((n) => n.tile.type === 'berg');
      const hasPond = tile.type === 'teich' || neighbors.some((n) => n.tile.type === 'teich');
      if (hasMountain && hasPond) return true;
    }
  }
  return false;
}

function checkAdjacentVillages(board) {
  for (const [key, tile] of board) {
    if (tile.type === 'dorf') {
      const { q, r } = parseHexKey(key);
      const neighbors = getNeighbors(board, q, r);
      if (neighbors.some((n) => n.tile.type === 'dorf')) return true;
    }
  }
  return false;
}

function checkPondPastureField(board) {
  for (const [key, tile] of board) {
    if (tile.type === 'teich') {
      const { q, r } = parseHexKey(key);
      const neighbors = getNeighbors(board, q, r);
      const hasPasture = neighbors.some((n) => n.tile.type === 'wiese');
      const hasField = neighbors.some((n) => n.tile.type === 'feld');
      if (hasPasture && hasField) return true;
    }
  }
  return false;
}

function checkPastureForestRing(board) {
  for (const [key, tile] of board) {
    if (tile.type === 'wiese') {
      const { q, r } = parseHexKey(key);
      const neighbors = getNeighbors(board, q, r);
      if (neighbors.filter((n) => n.tile.type === 'wald').length >= 3) return true;
    }
  }
  return false;
}

/** Ermittelt alle anlegbaren Felder (freie Felder mit mindestens 1 Nachbarn) */
function getLegalPlacements(board) {
  const placements = new Set();
  for (const key of board.keys()) {
    const { q, r } = parseHexKey(key);
    for (const [dq, dr] of HEX_DIRECTIONS) {
      const nKey = hexKey(q + dq, r + dr);
      if (!board.has(nKey)) {
        placements.add(nKey);
      }
    }
  }
  return Array.from(placements).map(parseHexKey);
}

/** Berechnet die Dorf-Vielfalt für ein gelegtes Plättchen */
function scoreVillagePlacement(board, q, r, mode) {
  // mode:
  // 'sofort': Wer das Dorf legt, erhält sofort 1 Pkt je verschiedener Landschaft der Nachbarn
  // 'wächst_mit': Jedes Dorfpunktet bei Fertigstellung oder bei jedem neuen Nachbar
  const tile = board.get(hexKey(q, r));
  let points = 0;

  if (tile.type === 'dorf') {
    const neighbors = getNeighbors(board, q, r);
    const types = new Set(neighbors.map((n) => n.tile.type));
    points += types.size;
  }

  // Wenn Nachbarn an ein bereits liegendes Dorf angelegt werden (im Modus 'wachstum')
  if (mode === 'wächst_mit') {
    const neighbors = getNeighbors(board, q, r);
    for (const n of neighbors) {
      if (n.tile.type === 'dorf') {
        const dorfNeighbors = getNeighbors(board, n.q, n.r);
        const types = new Set(dorfNeighbors.map((x) => x.tile.type));
        // Bonus für den Besitzer des Dorfes
        if (n.tile.owner !== undefined) {
          points += 1;
        }
      }
    }
  }
  return points;
}

/**
 * Spiel-Simulation
 */
export function simulateGame(options = {}) {
  const {
    playerCount = 4,
    deckSize = 60,
    marketSize = 5,
    questsPerPlayer = 3,
    villageScoringMode = 'sofort', // 'sofort', 'wächst_mit', 'umringt'
    botTypes = ['heuristic', 'heuristic', 'heuristic', 'heuristic'],
    seed = Math.floor(Math.random() * 1_000_000),
  } = options;

  const rng = rngFrom(seed);
  let deck = shuffle(createDeck(), rng);
  if (deck.length > deckSize) deck = deck.slice(0, deckSize);

  let questDeck = shuffle([...QUESTS], rng);

  // Startplättchen: 1 Startdorf oder Startburg in der Mitte
  const board = new Map();
  const startTile = { id: 0, type: 'wald', river: true, road: true, mill: false, owner: -1 };
  board.set(hexKey(0, 0), startTile);

  // Jahrmarkt mit 5 offenen Plättchen
  const market = deck.splice(0, marketSize);

  // Spieler initialisieren
  const players = Array.from({ length: playerCount }, (_, i) => ({
    seat: i,
    type: botTypes[i] || 'heuristic',
    points: 0,
    villagePoints: 0,
    questPoints: 0,
    completedQuests: 0,
    quests: questDeck.splice(0, questsPerPlayer),
  }));

  let currentSeat = 0;
  let roundCount = 0;

  // Spielschleife: Läuft solange Plättchen auf dem Jahrmarkt sind
  while (market.length > 0) {
    const player = players[currentSeat];
    const legalPlacements = getLegalPlacements(board);

    if (legalPlacements.length === 0) break;

    let chosenMarketIndex = 0;
    let chosenPlacement = legalPlacements[0];

    if (player.type === 'random') {
      chosenMarketIndex = Math.floor(rng() * market.length);
      chosenPlacement = legalPlacements[Math.floor(rng() * legalPlacements.length)];
    } else {
      // Heuristischer Bot
      let bestScore = -Infinity;

      for (let mIdx = 0; mIdx < market.length; mIdx++) {
        const candidateTile = market[mIdx];

        for (const pos of legalPlacements) {
          // Hypothetisches Anlegen prüfen
          const posKey = hexKey(pos.q, pos.r);
          board.set(posKey, { ...candidateTile, owner: player.seat });

          let score = 0;

          // 1. Dorf-Vielfalt
          if (candidateTile.type === 'dorf') {
            const neighbors = getNeighbors(board, pos.q, pos.r);
            const types = new Set(neighbors.map((n) => n.tile.type));
            score += types.size * 2;
          }

          // 2. Offene Aufträge prüfen
          for (const quest of player.quests) {
            if (quest.check(board)) {
              score += quest.points * 3; // Hohe Priorität für erfüllbare Aufträge
            }
          }

          // 3. Nachbarschaftsgunst (Kompaktheit / Verbindung)
          const neighborsCount = getNeighbors(board, pos.q, pos.r).length;
          score += neighborsCount * 0.5;

          board.delete(posKey);

          if (score > bestScore) {
            bestScore = score;
            chosenMarketIndex = mIdx;
            chosenPlacement = pos;
          }
        }
      }
    }

    // Zug ausführen
    const placedTile = market.splice(chosenMarketIndex, 1)[0];
    placedTile.owner = player.seat;
    board.set(hexKey(chosenPlacement.q, chosenPlacement.r), placedTile);

    // Dorf-Punkte vergeben
    if (placedTile.type === 'dorf') {
      const neighbors = getNeighbors(board, chosenPlacement.q, chosenPlacement.r);
      const types = new Set(neighbors.map((n) => n.tile.type));
      const vPoints = types.size;
      player.villagePoints += vPoints;
      player.points += vPoints;
    }

    // Aufträge prüfen und abrechnen
    const survivingQuests = [];
    for (const quest of player.quests) {
      if (quest.check(board)) {
        player.points += quest.points;
        player.questPoints += quest.points;
        player.completedQuests++;
        // Neuen Auftrag ziehen, falls vorhanden
        if (questDeck.length > 0) {
          survivingQuests.push(questDeck.pop());
        }
      } else {
        survivingQuests.push(quest);
      }
    }
    player.quests = survivingQuests;

    // Jahrmarkt auffüllen
    if (deck.length > 0) {
      market.push(deck.pop());
    }

    currentSeat = (currentSeat + 1) % playerCount;
    roundCount++;
  }

  // Auswertung
  const ranked = [...players].sort((a, b) => b.points - a.points);
  const winner = ranked[0];
  const isTie = ranked.length > 1 && ranked[0].points === ranked[1].points;

  return {
    roundCount,
    boardSize: board.size,
    winnerSeat: winner.seat,
    isTie,
    spread: ranked[0].points - ranked[1].points,
    players,
  };
}

/** Hauptprogramm für Messungen */
export function runSimulationSuite(runs = 1000) {
  console.log(`=== Grafschaft: Bot-Probepartien (${runs} Durchläufe je Fall) ===\n`);

  // Testfall 1: 4 Spieler mit Heuristik-Bots
  let winCounts = [0, 0, 0, 0];
  let ties = 0;
  let totalSpread = 0;
  let totalVillagePoints = 0;
  let totalQuestPoints = 0;
  let totalQuestsCompleted = 0;
  let totalRounds = 0;

  for (let i = 0; i < runs; i++) {
    const res = simulateGame({
      playerCount: 4,
      seed: 10000 + i,
      botTypes: ['heuristic', 'heuristic', 'heuristic', 'heuristic'],
    });

    if (res.isTie) ties++;
    else winCounts[res.winnerSeat]++;

    totalSpread += res.spread;
    totalRounds += res.roundCount;

    for (const p of res.players) {
      totalVillagePoints += p.villagePoints;
      totalQuestPoints += p.questPoints;
      totalQuestsCompleted += p.completedQuests;
    }
  }

  const avgSpread = (totalSpread / runs).toFixed(2);
  const avgRounds = (totalRounds / runs).toFixed(1);
  const avgVillageP = (totalVillagePoints / (runs * 4)).toFixed(1);
  const avgQuestP = (totalQuestPoints / (runs * 4)).toFixed(1);
  const avgQuests = (totalQuestsCompleted / (runs * 4)).toFixed(1);

  console.log(`1. Balance unter gleichstarken Bots (4 Spieler, je ${runs} Partien):`);
  console.log(`- Startspieler 1: ${(winCounts[0] / runs * 100).toFixed(1)} %`);
  console.log(`- Spieler 2:      ${(winCounts[1] / runs * 100).toFixed(1)} %`);
  console.log(`- Spieler 3:      ${(winCounts[2] / runs * 100).toFixed(1)} %`);
  console.log(`- Spieler 4:      ${(winCounts[3] / runs * 100).toFixed(1)} %`);
  console.log(`- Geteilter Sieg: ${(ties / runs * 100).toFixed(1)} %`);
  console.log(`- Punkteabstand Platz 1 zu 2: Ø ${avgSpread} Punkte`);
  console.log(`- Züge pro Partie: Ø ${avgRounds} Züge (~15 Züge je Spieler)`);
  console.log(`- Punkteverteilung je Spieler:`);
  console.log(`  * Dörfer (Vielfalt): Ø ${avgVillageP} Punkte`);
  console.log(`  * Hofaufträge:       Ø ${avgQuestP} Punkte (${avgQuests} Aufträge erfüllt)`);

  // Testfall 2: Können-Differenzierung (1 Heuristik-Bot gegen 3 Zufallsbots)
  let heuristicWins = 0;
  let heuristicSpread = 0;

  for (let i = 0; i < runs; i++) {
    const res = simulateGame({
      playerCount: 4,
      seed: 20000 + i,
      botTypes: ['heuristic', 'random', 'random', 'random'],
    });
    if (!res.isTie && res.winnerSeat === 0) heuristicWins++;
    heuristicSpread += (res.players[0].points - res.players[1].points);
  }

  console.log(`\n2. Können-Differenzierung (Heuristik-Bot gegen 3 Zufallsbots):`);
  console.log(`- Siegquote Heuristik-Bot: ${(heuristicWins / runs * 100).toFixed(1)} % (Erwartung > 85 %)`);
  console.log(`- Vorsprung auf Platz 2: Ø ${(heuristicSpread / runs).toFixed(1)} Punkte`);

  // Testfall 3: Tischgrößen 2, 3, 5 Spieler
  for (const count of [2, 3, 5]) {
    let p1Wins = 0;
    for (let i = 0; i < runs; i++) {
      const res = simulateGame({
        playerCount: count,
        seed: 30000 + count * 1000 + i,
        botTypes: Array(count).fill('heuristic'),
      });
      if (!res.isTie && res.winnerSeat === 0) p1Wins++;
    }
    console.log(`\n3. Tischgröße ${count} Spieler: Startspieler-Siegquote = ${(p1Wins / runs * 100).toFixed(1)} % (Fair = ${(100 / count).toFixed(1)} %)`);
  }
}

// Direkte Ausführung
if (process.argv[1]?.endsWith('grafschaft-probe.mjs')) {
  runSimulationSuite(1000);
}
