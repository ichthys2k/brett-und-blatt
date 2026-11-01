// Probe für Marktstände (W-039): spielt den Entwurf aus docs/spiele/umsetzungsplan-pakete-a-b-c.md nur
// mit Bots durch, bevor Oberfläche und Spielmodul gebaut werden. Kein Teil des Spiels, nur ein Messwerkzeug.
//
//   node scripts/marktstaende-probe.mjs              # alle Messungen, Standardzahlen
//   node scripts/marktstaende-probe.mjs --games=500  # weniger Partien je Fall
//   node scripts/marktstaende-probe.mjs --set="nur beste Ware plus"  # Tischgrößen und Können für diese Fassung
//   node scripts/marktstaende-probe.mjs --duels="Entwurf;nur beste Ware plus"  # Strategie-Tabellen dieser Fassungen
//   node scripts/marktstaende-probe.mjs --json=<Datei>  # Rohdaten zusätzlich als JSON

import { writeFileSync } from 'node:fs';

/** Sterne je Ware (15 Karten), über die Zahlen verteilt; `STARS.even` ist die Grundfassung. */
const STARS = {
  even: [0, 1, 2, 0, 2, 1, 0, 1, 2, 0, 2, 1, 0, 1, 2],
  few: [0, 1, 0, 2, 0, 1, 0, 0, 1, 0, 2, 0, 1, 0, 0],
};

/** Grundfassung des Entwurfs; `VARIANTS` verändert sie für Vergleiche. */
const BASE = {
  stars: 'even',
  fifth: 'takeAll', // takeAll: die fünfte Karte kommt mit, der Stand ist leer; keepCard: sie bleibt als neuer Anfang
  tie: 'allPlus', // allPlus: Gleichstand an der Spitze zählt für alle plus; nonePlus: für alle minus
  sameWare: true, // dieselbe Ware darf immer angelegt werden
  capacity: 5,
  deals: 1,
  plusWares: 4, // so viele der stärksten eigenen Waren können plus zählen, die übrigen immer minus
  costEvery: 0, // je so viele Karten in der Kammer 1 Minuspunkt (0 = keine Kosten)
};

const VARIANTS = {
  Entwurf: {},
  'fünfte Karte bleibt liegen': { fifth: 'keepCard' },
  'Gleichstand zählt minus': { tie: 'nonePlus' },
  'wenig Sterne': { stars: 'few' },
  'fünfte bleibt, Gleichstand minus': { fifth: 'keepCard', tie: 'nonePlus' },
  'ohne Waren-Regel': { sameWare: false },
  'nur beste Ware plus': { plusWares: 1 },
  'zwei beste Waren plus': { plusWares: 2 },
  'je 3 Karten −1': { costEvery: 3 },
  'je 2 Karten −1': { costEvery: 2 },
  'beste Ware, je 3 Karten −1': { plusWares: 1, costEvery: 3 },
  'zwei beste Waren, je 3 Karten −1': { plusWares: 2, costEvery: 3 },
  'beste Ware, fünfte bleibt': { plusWares: 1, fifth: 'keepCard' },
  'beste Ware, Gleichstand minus': { plusWares: 1, tie: 'nonePlus' },
  'beste Ware, wenig Sterne': { plusWares: 1, stars: 'few' },
  'beste Ware, 3 Ausgaben': { plusWares: 1, deals: 3 },
};

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

/** 60 Karten: je Viererblock jede Ware einmal, damit keine Ware nur hohe Zahlen hat. */
function makeDeck(cfg) {
  const rng = rngFrom(60);
  const seen = [0, 0, 0, 0];
  const cards = [];
  for (let block = 0; block < 15; block++) {
    const order = shuffle([0, 1, 2, 3], rng);
    for (let i = 0; i < 4; i++) {
      const ware = order[i];
      cards.push({ n: block * 4 + i + 1, ware, stars: STARS[cfg.stars][seen[ware]++] });
    }
  }
  return cards;
}

const handSize = (seats) => Math.min(10, Math.floor(56 / seats));

function counts(pantry) {
  const count = [0, 0, 0, 0];
  const stars = [0, 0, 0, 0];
  for (const card of pantry) {
    count[card.ware]++;
    stars[card.ware] += card.stars;
  }
  return { count, stars };
}

/** Punkte aller Plätze aus den Vorratskammern. */
function scores(pantries, cfg) {
  const all = pantries.map(counts);
  const out = pantries.map(({ length }) => (cfg.costEvery ? -Math.floor(length / cfg.costEvery) : 0));
  // Die stärksten Waren je Platz: erst nach Karten, bei Gleichstand nach Sternen.
  const strong = all.map(({ count, stars }) =>
    [0, 1, 2, 3].sort((a, b) => count[b] - count[a] || stars[b] - stars[a]).slice(0, cfg.plusWares),
  );
  for (let ware = 0; ware < 4; ware++) {
    let top = 0;
    let holders = 0;
    for (const { count } of all) {
      if (count[ware] > top) {
        top = count[ware];
        holders = 1;
      } else if (count[ware] === top && top > 0) holders++;
    }
    all.forEach(({ count, stars }, seat) => {
      if (!count[ware]) return;
      const leads = count[ware] === top && (holders === 1 || cfg.tie === 'allPlus') && strong[seat].includes(ware);
      out[seat] += leads ? stars[ware] : -stars[ware];
    });
  }
  return out;
}

function fits(stand, card, cfg) {
  if (stand.length === 0) return true;
  const top = stand[stand.length - 1];
  return top.n < card.n || (cfg.sameWare && top.ware === card.ware);
}

/** Legt die Karte an Stand `index`; gibt die Zahl genommener Karten zurück. */
function place(stands, pantries, seat, card, index, cfg) {
  const stand = stands[index];
  if (!fits(stand, card, cfg)) {
    pantries[seat].push(...stand);
    stands[index] = [card];
    return { taken: stand.length, forced: true };
  }
  if (stand.length === cfg.capacity - 1) {
    pantries[seat].push(...stand);
    if (cfg.fifth === 'takeAll') {
      pantries[seat].push(card);
      stands[index] = [];
      return { taken: stand.length + 1, forced: false };
    }
    stands[index] = [card];
    return { taken: stand.length, forced: false };
  }
  stand.push(card);
  return { taken: 0, forced: false };
}

/** Wert der Lage für einen Platz: eigene Punkte gegen den Schnitt der anderen. */
function value(pantries, seat, cfg) {
  const all = scores(pantries, cfg);
  let others = 0;
  all.forEach((score, i) => {
    if (i !== seat) others += score;
  });
  return all[seat] - others / Math.max(1, all.length - 1);
}

/** Alle Stände, an die die Karte darf; sonst alle, denn dann wird einer genommen. */
function options(stands, card, cfg) {
  const legal = stands.flatMap((stand, i) => (fits(stand, card, cfg) ? [i] : []));
  return legal.length > 0 ? legal : stands.map((_, i) => i);
}

function greedyStand(stands, pantries, seat, card, cfg) {
  let best = 0;
  let bestScore = -Infinity;
  for (const i of options(stands, card, cfg)) {
    const nextStands = stands.map((s) => [...s]);
    const nextPantries = pantries.map((p) => [...p]);
    place(nextStands, nextPantries, seat, card, i, cfg);
    let score = value(nextPantries, seat, cfg);
    // Kleiner Abstand lässt die anderen Stände offen; ein vierter Stern-Stapel ist ein Geschenk an den Nächsten.
    const top = stands[i][stands[i].length - 1];
    if (top) score -= Math.abs(card.n - top.n) * 0.005;
    if (nextStands[i].length === cfg.capacity - 1) score -= 0.2;
    if (score > bestScore) {
      bestScore = score;
      best = i;
    }
  }
  return best;
}

const BOTS = {
  Zufall: {
    card: (ctx) => ctx.hand[Math.floor(ctx.rng() * ctx.hand.length)],
    stand: (ctx, card) => {
      const list = options(ctx.stands, card, ctx.cfg);
      return list[Math.floor(ctx.rng() * list.length)];
    },
  },
  // Nimmt möglichst nichts.
  Meider: {
    card: (ctx) => {
      const safety = (card) => ctx.stands.filter((s) => fits(s, card, ctx.cfg) && s.length < ctx.cfg.capacity - 1).length;
      return [...ctx.hand].sort((a, b) => safety(b) - safety(a) || b.n - a.n)[0];
    },
    stand: (ctx, card) => {
      const cost = (i) => {
        const stand = ctx.stands[i];
        if (fits(stand, card, ctx.cfg) && stand.length < ctx.cfg.capacity - 1) return -1000 + stand.length * -1;
        return stand.reduce((sum, c) => sum + c.stars + 0.1, 0);
      };
      return [...options(ctx.stands, card, ctx.cfg)].sort((a, b) => cost(a) - cost(b))[0];
    },
  },
  // Setzt auf die Ware, von der die Kammer oder die Hand am meisten hat, und räumt dort gezielt ab.
  Sammler: {
    card: (ctx) => {
      const focus = focusWare(ctx);
      const taking = (card) =>
        ctx.stands.some((s) => fits(s, card, ctx.cfg) && s.length === ctx.cfg.capacity - 1 && gain(s, focus) > 0) ? 1 : 0;
      return [...ctx.hand].sort((a, b) => taking(b) - taking(a) || Number(b.ware !== focus) - Number(a.ware !== focus) || a.n - b.n)[0];
    },
    stand: (ctx, card) => {
      const focus = focusWare(ctx);
      const score = (i) => {
        const stand = ctx.stands[i];
        if (!fits(stand, card, ctx.cfg) || stand.length === ctx.cfg.capacity - 1) return gain(stand, focus);
        return -0.1 + (stand.length === ctx.cfg.capacity - 2 ? -0.5 : 0);
      };
      return [...options(ctx.stands, card, ctx.cfg)].sort((a, b) => score(b) - score(a))[0];
    },
  },
  // Rechnet Spielstände durch und schätzt die Karten der anderen.
  Krämer: {
    card: (ctx) => {
      if (ctx.hand.length === 1) return ctx.hand[0];
      let best = ctx.hand[0];
      let bestScore = -Infinity;
      for (const card of ctx.hand) {
        let total = 0;
        for (let k = 0; k < ctx.samples; k++) {
          const pool = shuffle(ctx.unseen, ctx.rng);
          const plays = [{ seat: ctx.seat, card }];
          for (let seat = 0; seat < ctx.seats; seat++) if (seat !== ctx.seat) plays.push({ seat, card: pool[seat] });
          plays.sort((a, b) => a.card.n - b.card.n);
          const stands = ctx.stands.map((s) => [...s]);
          const pantries = ctx.pantries.map((p) => [...p]);
          for (const play of plays) place(stands, pantries, play.seat, play.card, greedyStand(stands, pantries, play.seat, play.card, ctx.cfg), ctx.cfg);
          total += value(pantries, ctx.seat, ctx.cfg);
        }
        if (total > bestScore) {
          bestScore = total;
          best = card;
        }
      }
      return best;
    },
    stand: (ctx, card) => greedyStand(ctx.stands, ctx.pantries, ctx.seat, card, ctx.cfg),
  },
};

function focusWare(ctx) {
  const score = [0, 0, 0, 0];
  for (const card of ctx.pantries[ctx.seat]) score[card.ware] += 2;
  for (const card of ctx.hand) score[card.ware] += 1;
  return score.indexOf(Math.max(...score));
}

const gain = (stand, focus) => stand.reduce((sum, c) => sum + (c.ware === focus ? c.stars + 0.5 : -c.stars), 0);

/** Eine Partie. `lineup` nennt den Bot je Platz. */
function playGame(lineup, cfg, seed, samples) {
  const rng = rngFrom(seed);
  const seats = lineup.length;
  const stats = { takes: 0, forced: 0, placements: 0, realChoice: 0, optionSum: 0, cardsTaken: 0 };
  const pantries = lineup.map(() => []);
  const handAvg = lineup.map(() => 0);
  const deck = makeDeck(cfg);
  const perDeal = handSize(seats);
  for (let deal = 0; deal < cfg.deals; deal++) {
    const cards = shuffle(deck, rng);
    const stands = [0, 1, 2, 3].map((i) => [cards[i]]);
    const hands = lineup.map((_, seat) => cards.slice(4 + seat * perDeal, 4 + (seat + 1) * perDeal));
    hands.forEach((hand, seat) => (handAvg[seat] += hand.reduce((sum, c) => sum + c.n, 0) / hand.length));
    const seen = new Set(stands.flat());
    for (let round = 0; round < perDeal; round++) {
      const ctxFor = (seat) => ({
        rng,
        cfg,
        seat,
        seats,
        samples,
        stands,
        pantries,
        hand: hands[seat],
        unseen: deck.filter((c) => !seen.has(c) && !hands[seat].includes(c)),
      });
      const plays = lineup.map((bot, seat) => ({ seat, card: BOTS[bot].card(ctxFor(seat)) }));
      plays.sort((a, b) => a.card.n - b.card.n);
      for (const { seat, card } of plays) {
        hands[seat] = hands[seat].filter((c) => c !== card);
        seen.add(card);
        const list = options(stands, card, cfg);
        const safe = list.filter((i) => fits(stands[i], card, cfg) && stands[i].length < cfg.capacity - 1);
        stats.placements++;
        stats.optionSum += list.length;
        if (list.length > 1) stats.realChoice++;
        const index = BOTS[lineup[seat]].stand(ctxFor(seat), card);
        const { taken, forced } = place(stands, pantries, seat, card, index, cfg);
        if (taken > 0) {
          stats.takes++;
          stats.cardsTaken += taken;
          if (safe.length === 0 && !fits(stands[index], card, cfg)) stats.forced++;
          else if (forced) stats.forced++;
        }
      }
    }
  }
  const finalScores = scores(pantries, cfg);
  return { scores: finalScores, stats, pantries, handAvg };
}

/** Gleiche Bots an allen Plätzen: Kennzahlen des Spielverlaufs. */
function profile(bot, seats, cfg, games, samples, seedBase) {
  const sum = { takes: 0, forced: 0, placements: 0, realChoice: 0, optionSum: 0, cardsTaken: 0 };
  let margin = 0;
  let sharedWin = 0;
  let negative = 0;
  let zeroSeats = 0;
  let scoreSum = 0;
  let lowHandWins = 0;
  let mostCardsWins = 0;
  let fewestCardsWins = 0;
  const seatWins = Array(seats).fill(0);
  for (let g = 0; g < games; g++) {
    const { scores: result, stats, pantries, handAvg } = playGame(Array(seats).fill(bot), cfg, seedBase + g, samples);
    for (const key of Object.keys(sum)) sum[key] += stats[key];
    const sorted = [...result].sort((a, b) => b - a);
    margin += sorted[0] - sorted[1];
    if (sorted[0] === sorted[1]) sharedWin++;
    const winners = result.flatMap((score, seat) => (score === sorted[0] ? [seat] : []));
    for (const seat of winners) seatWins[seat] += 1 / winners.length;
    for (const score of result) {
      if (score < 0) negative++;
      if (score === 0) zeroSeats++;
      scoreSum += score;
    }
    const share = (pick) => winners.filter((seat) => pick.includes(seat)).length / winners.length;
    const low = Math.min(...handAvg);
    lowHandWins += share(handAvg.flatMap((h, i) => (h === low ? [i] : [])));
    const sizes = pantries.map((p) => p.length);
    const most = Math.max(...sizes);
    const fewest = Math.min(...sizes);
    mostCardsWins += share(sizes.flatMap((s, i) => (s === most ? [i] : [])));
    fewestCardsWins += share(sizes.flatMap((s, i) => (s === fewest ? [i] : [])));
  }
  const fair = 100 / seats;
  return {
    seats,
    handSize: handSize(seats),
    takes: sum.takes / games,
    cardsTaken: sum.cardsTaken / games,
    forcedShare: sum.takes ? (100 * sum.forced) / sum.takes : 0,
    realChoice: (100 * sum.realChoice) / sum.placements,
    options: sum.optionSum / sum.placements,
    margin: margin / games,
    sharedWin: (100 * sharedWin) / games,
    negative: (100 * negative) / (games * seats),
    zero: (100 * zeroSeats) / (games * seats),
    avgScore: scoreSum / (games * seats),
    seatSpread: Math.max(...seatWins.map((w) => Math.abs((100 * w) / games - fair))),
    lowHand: (100 * lowHandWins) / games,
    mostCards: (100 * mostCardsWins) / games,
    fewestCards: (100 * fewestCardsWins) / games,
    fair,
  };
}

/** Siegesanteil eines Bots gegen lauter andere; der Platz wandert, geteilte Siege zählen anteilig. */
function duel(hero, rest, seats, cfg, games, samples, seedBase) {
  let wins = 0;
  let score = 0;
  for (let g = 0; g < games; g++) {
    const seat = g % seats;
    const lineup = Array(seats).fill(rest);
    lineup[seat] = hero;
    const { scores: result } = playGame(lineup, cfg, seedBase + g, samples);
    const top = Math.max(...result);
    const winners = result.filter((s) => s === top).length;
    if (result[seat] === top) wins += 1 / winners;
    score += result[seat];
  }
  return { win: (100 * wins) / games, score: score / games, fair: 100 / seats };
}

const fmt = (v, digits = 1) => v.toFixed(digits).replace('.', ',');
function table(head, rows) {
  console.log(`| ${head.join(' | ')} |`);
  console.log(`| ${head.map(() => '---').join(' | ')} |`);
  for (const row of rows) console.log(`| ${row.join(' | ')} |`);
  console.log('');
}

const arg = (name, fallback) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
};
const GAMES = Number(arg('games', 3000));
const SMART_GAMES = Math.max(100, Math.round(GAMES / 10));
const SAMPLES = 6;
const SET = arg('set', 'Entwurf');
const CHOSEN = { ...BASE, ...VARIANTS[SET] };
const output = { set: SET };

console.log(`## Spielverlauf je Tischgröße (Krämer an allen Plätzen, ${SMART_GAMES} Partien, ${SET})\n`);
output.byTable = [2, 3, 4, 5, 6, 8, 10].map((seats) => profile('Krämer', seats, CHOSEN, SMART_GAMES, SAMPLES, 1000 * seats));
table(
  ['Plätze', 'Handkarten', 'Abräumen', 'genommene Karten', 'davon erzwungen %', 'echte Wahl %', 'Stände zur Wahl', 'Abstand 1.–2.', 'geteilter Sieg %', 'Plätze im Minus %', 'Plätze mit 0 %', 'Bestplatz-Abweichung', 'wenigste Karten gewinnt %', 'meiste Karten gewinnt %', 'niedrigste Hand gewinnt %', 'fair %'],
  output.byTable.map((r) => [r.seats, r.handSize, fmt(r.takes), fmt(r.cardsTaken), fmt(r.forcedShare), fmt(r.realChoice), fmt(r.options), fmt(r.margin), fmt(r.sharedWin), fmt(r.negative), fmt(r.zero), fmt(r.seatSpread), fmt(r.fewestCards), fmt(r.mostCards), fmt(r.lowHand), fmt(r.fair)]),
);

console.log(`## Fassungen im Vergleich (4 Plätze, Krämer an allen Plätzen, ${SMART_GAMES} Partien)\n`);
output.variants = Object.entries(VARIANTS).map(([name, change]) => ({ name, ...profile('Krämer', 4, { ...BASE, ...change }, SMART_GAMES, SAMPLES, 7000) }));
table(
  ['Fassung', 'Abräumen', 'erzwungen %', 'echte Wahl %', 'Abstand 1.–2.', 'geteilter Sieg %', 'im Minus %', 'mit 0 %', 'wenigste Karten gewinnt %', 'meiste Karten gewinnt %'],
  output.variants.map((r) => [r.name, fmt(r.takes), fmt(r.forcedShare), fmt(r.realChoice), fmt(r.margin), fmt(r.sharedWin), fmt(r.negative), fmt(r.zero), fmt(r.fewestCards), fmt(r.mostCards)]),
);

console.log(`## Strategien gegeneinander (je 1 gegen 3 auf vier Plätzen, fair 25 %; ${GAMES} Partien, gegen Krämer und mit Krämer ${SMART_GAMES})\n`);
const names = Object.keys(BOTS);
output.duels = {};
for (const variant of arg('duels', SET).split(';')) {
  const change = VARIANTS[variant];
  const cfg = { ...BASE, ...change };
  const rows = names.map((hero) =>
    names.map((rest) => {
      if (hero === rest) return null;
      const smart = hero === 'Krämer' || rest === 'Krämer';
      return duel(hero, rest, 4, cfg, smart ? SMART_GAMES : GAMES, SAMPLES, 20000);
    }),
  );
  output.duels[variant] = rows;
  console.log(`**${variant}** (Zeile: der eine, Spalte: die drei anderen; Siegesanteil %, in Klammern Punkte)\n`);
  table(['', ...names], names.map((hero, i) => [hero, ...rows[i].map((c) => (c ? `${fmt(c.win)} (${fmt(c.score)})` : '–'))]));
}

console.log(`## Krämer gegen Zufall je Tischgröße (${SET}, ${SMART_GAMES} Partien)\n`);
output.skill = [2, 3, 4, 6, 10].map((seats) => ({ seats, ...duel('Krämer', 'Zufall', seats, CHOSEN, SMART_GAMES, SAMPLES, 40000) }));
table(['Plätze', 'Krämer %', 'fair %', 'Faktor'], output.skill.map((r) => [r.seats, fmt(r.win), fmt(r.fair), fmt(r.win / r.fair)]));

const json = arg('json');
if (json) writeFileSync(json, JSON.stringify(output, null, 2));
