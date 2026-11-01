// Probe für Marktplatz (W-041): spielt die Regeln aus docs/spiele/marktplatz.md nur mit Bots durch,
// bevor Oberfläche und Spielmodul gebaut werden. Kein Teil des Spiels, nur ein Messwerkzeug.
//
//   node scripts/marktplatz-probe.mjs                 # alle Messungen, Standardzahlen
//   node scripts/marktplatz-probe.mjs --games=500     # weniger Partien je Fall
//   node scripts/marktplatz-probe.mjs --set=angepasst # die Zahlen aus dem Vorschlag (siehe SETS)
//   node scripts/marktplatz-probe.mjs --json=<Datei>  # Rohdaten zusätzlich als JSON

import { writeFileSync } from 'node:fs';

const GUILDS = [
  { name: 'Bäcker', fields: [1, 3, 5], prices: [4, 4, 5], ware: [1, 2, 4], build: 2 },
  { name: 'Weber', fields: [7, 8, 10], prices: [6, 6, 7], ware: [1, 3, 6], build: 3 },
  { name: 'Imker', fields: [12, 13, 15], prices: [8, 8, 9], ware: [2, 4, 8], build: 4 },
  { name: 'Schuster', fields: [17, 19, 21], prices: [10, 10, 11], ware: [2, 5, 10], build: 5 },
  { name: 'Schmiede', fields: [23, 25, 26], prices: [12, 12, 13], ware: [3, 6, 12], build: 6 },
  { name: 'Steinmetze', fields: [28, 30, 34], prices: [14, 14, 16], ware: [3, 7, 14], build: 7 },
];

/** Grundzahlen des Plans; `SETS` verändert sie für Vergleiche. */
const BASE = {
  guilds: GUILDS,
  start: 30,
  goMoney: 3,
  communityPrice: 10,
  communityRent: 2,
  bail: 5,
  wholeBonus: 10,
  partnerBonus: 5,
  news: true,
  partnership: true,
  trade: true,
  // Bis hier der Plan; die folgenden Schalter sind nur für Vergleiche.
  seatBonus: 0, // Startgeld je späterem Platz
  partnerBuild: 2, // höchste Baustufe in einer Partnerschaft
  partnerFee: 0, // Brezeln je Partner beim Abschluss
  partnerByMajor: false, // nur wer zwei Betriebe hat, kann die Partnerschaft anbieten (erst Kauf versuchen)
  cautious: false, // Krämer hält Rücklage passend zur höchsten Ware auf dem Brett
};

const SETS = {
  plan: {},
  // Vorschlag aus der Probe: mehr Geld im Umlauf, milderes Zunfthaus, Ausgleich für spätere Plätze.
  angepasst: {
    start: 40,
    goMoney: 5,
    seatBonus: 1,
    partnerByMajor: true,
    cautious: true,
    guilds: GUILDS.map((guild, i) => ({ ...guild, ware: [[1, 2, 3], [1, 3, 5], [2, 4, 6], [2, 5, 8], [3, 6, 9], [3, 7, 11]][i] })),
  },
};

/** Fassungen für `--compare`. */
const COMPARE = (cfg) => {
  const ware = (tables) => cfg.guilds.map((guild, i) => ({ ...guild, ware: tables[i] }));
  const careful = { ...cfg, cautious: true };
  const major = { ...careful, partnerByMajor: true };
  return {
    Plan: cfg,
    'Partner nur von 2er-Halter': major,
    'dazu Partner nur Werkstatt': { ...major, partnerBuild: 1 },
    'dazu Start 40, Marktgeld 5': { ...major, start: 40, goMoney: 5 },
    'dazu Platz-Ausgleich +1': { ...major, start: 40, goMoney: 5, seatBonus: 1 },
    'dazu Zunfthaus milder': { ...major, start: 40, goMoney: 5, seatBonus: 1, guilds: ware([[1, 2, 3], [1, 3, 5], [2, 4, 6], [2, 5, 8], [3, 6, 9], [3, 7, 11]]) },
    'ohne Partnerschaft': { ...careful, start: 40, goMoney: 5, seatBonus: 1, partnership: false },
  };
};

const COMMUNITY = [6, 14, 22, 31];
const CRIER = new Set([2, 16, 24, 32]);
const NEWS = ['goodHarvest', 'badHarvest', 'wool', 'bees', 'shoes', 'tourney', 'cathedral', 'pilgrims', 'flood', 'kingVisit', 'frost', 'peace', 'calm'];
const NEWS_DOUBLE = { goodHarvest: 0, wool: 1, bees: 2, shoes: 3, tourney: 4, cathedral: 5 };
const CARDS = ['errand', 'pardon', 'toJail', 'blessing', 'birthday', 'festival', 'repairs', 'praise', 'toGate', 'pilgrimage', 'purse', 'crooked'];
const JAIL = 9;

function rngFrom(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffled(list, rng) {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

class Game {
  /** @param kinds je Platz 'merchant' (Krämer) oder 'random' (Zufall) */
  constructor(cfg, kinds, years, seed, gift = null) {
    this.cfg = cfg;
    this.kinds = kinds;
    this.n = kinds.length;
    this.rng = rngFrom(seed);
    this.rounds = years * 8;
    this.round = 0;
    this.prop = new Map();
    cfg.guilds.forEach((guild, g) => guild.fields.forEach((field, i) => this.prop.set(field, { field, guild: g, price: guild.prices[i], owner: -1, level: 0, mortgaged: false })));
    for (const field of COMMUNITY) this.prop.set(field, { field, guild: -1, price: cfg.communityPrice, owner: -1, level: 0, mortgaged: false });
    this.players = kinds.map((kind, seat) => ({ seat, kind, pos: 0, cash: cfg.start + seat * cfg.seatBonus, jailTurns: -1, pardon: false, blessed: false, rentIn: 0 }));
    this.partners = new Map(); // Zunft → [Platz, Platz]
    this.debts = []; // { from, to (−1 = Stadt), amount }
    this.news = 'calm';
    this.newsDeck = [];
    this.cardDeck = shuffled(CARDS, this.rng);
    this.stats = { turns: 0, trades: 0, offers: 0, partnerships: 0, auctions: 0, auctionPaid: 0, builds: 0, mortgages: 0, jail: 0, rentByGuild: cfg.guilds.map(() => 0), rentCommunity: 0, landings: new Array(36).fill(0), minCash: cfg.start, cashTotal: 0, cashSamples: 0 };
    if (gift) this.applyGift(gift);
  }

  /** Für den Zunft-Vergleich: Ein Platz startet mit einer ganzen Zunft und zahlt dafür den Listenpreis. */
  applyGift({ seat, guild }) {
    for (const field of this.cfg.guilds[guild].fields) {
      const p = this.prop.get(field);
      p.owner = seat;
      this.players[seat].cash -= p.price;
    }
  }

  guildOwners(g) {
    return this.cfg.guilds[g].fields.map((field) => this.prop.get(field).owner);
  }
  hasWhole(seat, g) {
    return this.guildOwners(g).every((o) => o === seat);
  }
  isPartner(seat, g) {
    return this.partners.get(g)?.includes(seat) ?? false;
  }
  canDouble(seat, g) {
    return this.hasWhole(seat, g) || this.isPartner(seat, g);
  }
  buildCost(g) {
    return this.cfg.guilds[g].build + (this.news === 'frost' ? 1 : 0);
  }

  rent(p) {
    if (p.mortgaged || p.owner < 0) return 0;
    if (p.guild < 0) {
      if (this.news === 'flood' && (p.field === 6 || p.field === 14)) return 0;
      const count = COMMUNITY.filter((f) => {
        const c = this.prop.get(f);
        return c.owner === p.owner && !c.mortgaged;
      }).length;
      return this.cfg.communityRent * count;
    }
    let rent = this.cfg.guilds[p.guild].ware[p.level];
    if (p.level === 0 && this.canDouble(p.owner, p.guild)) rent *= 2;
    if (NEWS_DOUBLE[this.news] === p.guild) rent *= 2;
    if (this.news === 'badHarvest' && p.guild === 0) rent = Math.ceil(rent / 2);
    return rent;
  }

  worth(seat) {
    let total = this.players[seat].cash;
    for (const p of this.prop.values()) {
      if (p.owner !== seat) continue;
      total += p.mortgaged ? Math.ceil(p.price / 2) : p.price;
      if (p.guild >= 0) total += p.level * this.cfg.guilds[p.guild].build;
    }
    this.cfg.guilds.forEach((_, g) => {
      if (this.hasWhole(seat, g)) total += this.cfg.wholeBonus;
      else if (this.isPartner(seat, g)) total += this.cfg.partnerBonus;
    });
    for (const d of this.debts) {
      if (d.from === seat) total -= d.amount;
      if (d.to === seat) total += d.amount;
    }
    return total;
  }

  /** Zahlen; reicht das Geld nicht, werden Bauten verkauft und Betriebe verpfändet, der Rest wird Schuldschein. */
  pay(seat, to, amount) {
    const player = this.players[seat];
    this.raise(seat, amount);
    const paid = Math.min(player.cash, amount);
    player.cash -= paid;
    if (to >= 0) this.players[to].cash += paid;
    if (amount > paid) this.debts.push({ from: seat, to, amount: amount - paid });
    this.stats.minCash = Math.min(this.stats.minCash, player.cash);
    return paid;
  }

  raise(seat, amount) {
    const player = this.players[seat];
    while (player.cash < amount) {
      const built = [...this.prop.values()].filter((p) => p.owner === seat && p.level > 0).sort((a, b) => b.level - a.level || a.price - b.price)[0];
      if (built) {
        built.level--;
        player.cash += Math.ceil(this.cfg.guilds[built.guild].build / 2);
        continue;
      }
      const free = [...this.prop.values()].filter((p) => p.owner === seat && !p.mortgaged).sort((a, b) => Number(a.guild >= 0 && this.canDouble(seat, a.guild)) - Number(b.guild >= 0 && this.canDouble(seat, b.guild)) || a.price - b.price)[0];
      if (!free) return;
      free.mortgaged = true;
      player.cash += Math.ceil(free.price / 2);
      this.stats.mortgages++;
    }
  }

  /** Was ein Betrieb einem Platz über den Listenpreis hinaus wert ist (Krämer-Bewertung). */
  premium(seat, p) {
    if (p.guild >= 0 && this.players[seat].focus === p.guild) return p.price;
    if (p.guild < 0) {
      const mine = COMMUNITY.filter((f) => this.prop.get(f).owner === seat).length;
      return 1 + mine;
    }
    const owners = this.guildOwners(p.guild).filter((_, i) => this.cfg.guilds[p.guild].fields[i] !== p.field);
    const mine = owners.filter((o) => o === seat).length;
    const left = this.rounds - this.round;
    const scale = Math.min(1, left / 8);
    if (mine === 2) return Math.ceil(p.price * 0.75 * scale) + this.cfg.wholeBonus * 0.5;
    if (mine === 1) return Math.ceil(p.price * 0.25 * scale);
    return 0;
  }

  reserve(seat) {
    // Rücklage: reicht für eine mittlere Ware; am Ende zählt alles nach Listenpreis, also wird dann alles angelegt.
    if (this.rounds - this.round <= 2) return 1;
    if (!this.cfg.cautious) return 5;
    let danger = 0;
    for (const p of this.prop.values()) if (p.owner >= 0 && p.owner !== seat) danger = Math.max(danger, this.rent(p));
    return Math.max(5, Math.ceil(danger * 0.75));
  }

  wantsToBuy(seat, p) {
    const player = this.players[seat];
    if (player.cash < p.price) return false;
    // Spezialist: lässt alles andere liegen, solange seine Zunft noch zu haben ist.
    if (player.focus !== undefined && p.guild !== player.focus) {
      const open = this.cfg.guilds[player.focus].fields.some((f) => {
        const c = this.prop.get(f);
        return c.owner === -1 || c.owner === seat;
      });
      if (open && player.cash - p.price < this.cfg.guilds[player.focus].prices[0]) return false;
    }
    if (player.kind === 'random') return this.rng() < 0.5;
    return player.cash - p.price >= this.reserve(seat) || this.premium(seat, p) >= p.price * 0.5;
  }

  buy(seat, p, price = p.price) {
    this.players[seat].cash -= price;
    p.owner = seat;
  }

  auction(p, starter) {
    this.stats.auctions++;
    const limit = this.players.map((player) => {
      const max = player.kind === 'random' ? Math.floor(this.rng() * p.price * 1.2) : p.price + this.premium(player.seat, p) - 1;
      return Math.min(max, player.cash - (player.kind === 'random' ? 0 : 2));
    });
    let bid = 0;
    let leader = -1;
    let active = this.players.map((player) => player.seat);
    let i = starter;
    while (active.length > 1 || leader === -1) {
      const seat = i % this.n;
      i++;
      if (!active.includes(seat)) continue;
      if (seat === leader) continue;
      if (limit[seat] > bid) {
        bid++;
        leader = seat;
      } else {
        active = active.filter((s) => s !== seat);
        if (active.length === 0) break;
      }
    }
    if (leader >= 0 && bid > 0) {
      this.buy(leader, p, bid);
      this.stats.auctionPaid += bid / p.price;
    }
  }

  /** Bauen, gleichmäßig; `discount` halbiert die Kosten (Thronsaal). */
  buildable(seat) {
    const out = [];
    this.cfg.guilds.forEach((guild, g) => {
      if (!this.canDouble(seat, g)) return;
      const mine = guild.fields.map((f) => this.prop.get(f)).filter((p) => p.owner === seat);
      if (mine.some((p) => p.mortgaged)) return;
      const low = Math.min(...mine.map((p) => p.level));
      if (low >= (this.hasWhole(seat, g) ? 2 : this.cfg.partnerBuild)) return;
      out.push(mine.find((p) => p.level === low));
    });
    return out;
  }

  manage(seat) {
    const player = this.players[seat];
    if (player.kind === 'random') {
      for (const p of this.buildable(seat)) {
        const cost = this.buildCost(p.guild);
        if (player.cash >= cost && this.rng() < 0.3) {
          player.cash -= cost;
          p.level++;
          this.stats.builds++;
        }
      }
      return;
    }
    // Krämer: Pfänder auslösen, solange sich das noch lohnt, dann teure Zünfte zuerst bauen.
    if (this.rounds - this.round > 6) {
      for (const p of this.prop.values()) {
        if (p.owner !== seat || !p.mortgaged) continue;
        const cost = Math.ceil(p.price / 2) + Math.max(1, Math.ceil(p.price * 0.1));
        if (player.cash - cost >= this.reserve(seat) + 3) {
          player.cash -= cost;
          p.mortgaged = false;
        }
      }
    }
    for (let guard = 0; guard < 12; guard++) {
      const options = this.buildable(seat).sort((a, b) => b.guild - a.guild);
      const next = options.find((p) => player.cash - this.buildCost(p.guild) >= this.reserve(seat) + 2);
      if (!next) break;
      player.cash -= this.buildCost(next.guild);
      next.level++;
      this.stats.builds++;
    }
  }

  /** Ein Handelsangebot des Platzes; gebaute Betriebe sind nicht handelbar. */
  offerTrade(seat) {
    if (!this.cfg.trade) return;
    const player = this.players[seat];
    if (player.kind === 'random') return;
    const tradable = (p) => p && p.level === 0 && !p.mortgaged && !this.partners.has(p.guild);
    // Wer hält den letzten Betrieb einer Zunft, von der ich zwei habe?
    const wanted = [];
    this.cfg.guilds.forEach((guild, g) => {
      if (this.partners.has(g)) return;
      const props = guild.fields.map((f) => this.prop.get(f));
      if (props.some((p) => p.level > 0)) return;
      const mine = props.filter((p) => p.owner === seat);
      if (mine.length !== 2) return;
      const other = props.find((p) => p.owner !== seat);
      if (other.owner >= 0 && tradable(other)) wanted.push(other);
    });
    for (const target of wanted) {
      const holder = this.players[target.owner];
      // Tausch: Beide vollenden eine Zunft.
      for (let g = 0; g < this.cfg.guilds.length; g++) {
        if (g === target.guild || this.partners.has(g)) continue;
        const props = this.cfg.guilds[g].fields.map((f) => this.prop.get(f));
        if (props.some((p) => p.level > 0 || p.mortgaged)) continue;
        const theirs = props.filter((p) => p.owner === holder.seat).length;
        const mineHere = props.find((p) => p.owner === seat);
        if (theirs === 2 && mineHere) {
          const diff = target.price - mineHere.price;
          if (diff > 0 ? player.cash < diff : holder.cash < -diff) continue;
          this.stats.offers++;
          if (holder.kind === 'random' && this.rng() > 0.2) return;
          player.cash -= diff;
          holder.cash += diff;
          target.owner = seat;
          mineHere.owner = holder.seat;
          this.stats.trades++;
          return;
        }
      }
      // Kauf: Preis plus Aufschlag.
      const offer = target.price + Math.ceil(target.price * 0.5);
      if (player.cash - offer >= 2) {
        this.stats.offers++;
        const accept = holder.kind === 'random' ? this.rng() < 0.2 : this.premium(holder.seat, target) < offer - target.price;
        if (accept) {
          player.cash -= offer;
          holder.cash += offer;
          target.owner = seat;
          this.stats.trades++;
        }
        return;
      }
    }
  }

  checkPartnerships(asking = -1) {
    if (!this.cfg.partnership) return;
    this.cfg.guilds.forEach((_, g) => {
      if (this.partners.has(g)) return;
      const owners = this.guildOwners(g);
      if (owners.includes(-1)) return;
      const distinct = [...new Set(owners)];
      if (distinct.length !== 2) return;
      if (this.cfg.partnerByMajor && owners.filter((o) => o === asking).length !== 2) return;
      if (this.cfg.partnerFee && distinct.some((seat) => this.players[seat].cash < this.cfg.partnerFee)) return;
      // Zufallsbots schließen nur manchmal ab; der Krämer immer, denn es gibt nur Vorteile.
      if (distinct.some((seat) => this.players[seat].kind === 'random' && this.rng() > 0.3)) return;
      for (const seat of distinct) this.players[seat].cash -= this.cfg.partnerFee;
      this.partners.set(g, distinct);
      this.stats.partnerships++;
    });
  }

  goToJail(player) {
    player.pos = JAIL;
    player.jailTurns = 0;
    this.stats.jail++;
  }

  /** Vorziehen; beim Überqueren des Stadttors gibt es Marktgeld. */
  advance(player, steps) {
    const before = player.pos;
    player.pos = (player.pos + steps) % 36;
    if (player.pos < before) player.cash += this.news === 'kingVisit' ? 6 : this.cfg.goMoney;
  }

  drawCard(player) {
    if (this.cardDeck.length === 0) this.cardDeck = shuffled(CARDS.filter((c) => c !== 'pardon' || !this.players.some((p) => p.pardon)), this.rng);
    const card = this.cardDeck.pop();
    switch (card) {
      case 'errand': {
        // +2 oder 1 bis 3 Felder weiter: Der Krämer geht, wenn er so einen freien Betrieb erreicht.
        const hit = player.kind === 'merchant' ? [1, 2, 3].find((s) => {
          const p = this.prop.get((player.pos + s) % 36);
          return p && p.owner === -1 && player.cash >= p.price;
        }) : undefined;
        if (hit) {
          this.advance(player, hit);
          this.land(player);
        } else player.cash += 2;
        break;
      }
      case 'pardon':
        player.pardon = true;
        break;
      case 'toJail':
        this.goToJail(player);
        break;
      case 'blessing':
        player.blessed = true;
        break;
      case 'birthday':
        for (const other of this.players) if (other !== player) this.pay(other.seat, player.seat, 1);
        break;
      case 'festival':
        for (const other of this.players) if (other !== player) this.pay(player.seat, other.seat, 1);
        break;
      case 'repairs': {
        let bill = 0;
        for (const p of this.prop.values()) if (p.owner === player.seat) bill += p.level;
        this.pay(player.seat, -1, bill);
        break;
      }
      case 'praise':
        player.cash += 4;
        break;
      case 'toGate':
        player.pos = 0;
        player.cash += this.news === 'kingVisit' ? 6 : this.cfg.goMoney;
        break;
      case 'pilgrimage':
        this.advance(player, (11 - player.pos + 36) % 36);
        this.land(player);
        break;
      case 'purse':
        player.cash += 3;
        break;
      case 'crooked':
        this.pay(player.seat, -1, 3);
        break;
    }
  }

  land(player) {
    const seat = player.seat;
    const field = player.pos;
    this.stats.landings[field]++;
    const p = this.prop.get(field);
    if (p) {
      if (p.owner === -1) {
        if (this.wantsToBuy(seat, p)) this.buy(seat, p);
        else this.auction(p, seat);
      } else if (p.owner !== seat) {
        let rent = this.rent(p);
        if (rent > 0 && player.blessed) {
          rent = Math.ceil(rent / 2);
          player.blessed = false;
        }
        if (rent > 0) {
          const paid = this.pay(seat, p.owner, rent);
          this.players[p.owner].rentIn += paid;
          if (p.guild >= 0) this.stats.rentByGuild[p.guild] += rent;
          else this.stats.rentCommunity += rent;
        }
      }
      return;
    }
    if (CRIER.has(field)) return this.drawCard(player);
    switch (field) {
      case 4:
        this.pay(seat, -1, Math.max(2, Math.ceil(player.cash * 0.1)));
        break;
      case 33:
        this.pay(seat, -1, 4);
        break;
      case 11:
        player.cash += this.news === 'pilgrims' ? 4 : 2;
        break;
      case 18:
        player.cash += 2;
        for (const other of this.players) this.offerTrade(other.seat);
        break;
      case 20: {
        // Audienz: 4 Brezeln oder ein Bau zum halben Preis.
        const option = player.kind === 'merchant' ? this.buildable(seat).sort((a, b) => b.guild - a.guild)[0] : undefined;
        const cost = option ? Math.ceil(this.buildCost(option.guild) / 2) : 0;
        if (option && player.cash >= cost && this.cfg.guilds[option.guild].build / 2 >= 2) {
          player.cash -= cost;
          option.level++;
          this.stats.builds++;
        } else player.cash += 4;
        break;
      }
      case 27:
        this.goToJail(player);
        break;
      case 29:
        player.cash += 1;
        break;
      case 35: {
        // Markttag: einen freien Betrieb zum Listenpreis kaufen.
        const free = [...this.prop.values()].filter((c) => c.owner === -1 && player.cash >= c.price);
        if (free.length === 0) break;
        if (player.kind === 'random') {
          if (this.rng() < 0.5) this.buy(seat, free[Math.floor(this.rng() * free.length)]);
        } else {
          const best = free.sort((a, b) => this.premium(seat, b) - this.premium(seat, a) || b.price - a.price)[0];
          if (player.cash - best.price >= this.reserve(seat)) this.buy(seat, best);
        }
        break;
      }
    }
  }

  roll() {
    const a = 1 + Math.floor(this.rng() * 6);
    const b = 1 + Math.floor(this.rng() * 6);
    return { total: a + b, double: a === b };
  }

  turn(seat) {
    const player = this.players[seat];
    this.stats.turns++;
    this.offerTrade(seat);
    this.checkPartnerships(seat);
    this.manage(seat);

    if (player.jailTurns >= 0) {
      if (player.pardon) {
        player.pardon = false;
        player.jailTurns = -1;
      } else if (player.kind === 'merchant' && player.cash >= this.cfg.bail + 10) {
        player.cash -= this.cfg.bail;
        player.jailTurns = -1;
      } else {
        const r = this.roll();
        player.jailTurns++;
        if (r.double || player.jailTurns >= 3) {
          if (!r.double) this.pay(seat, -1, this.cfg.bail);
          player.jailTurns = -1;
          this.advance(player, r.total);
          this.land(player);
        }
        return;
      }
    }

    for (let doubles = 0; doubles < 3; doubles++) {
      const r = this.roll();
      if (r.double && doubles === 2) {
        this.goToJail(player);
        return;
      }
      this.advance(player, r.total);
      this.land(player);
      if (!this.cfg.partnerByMajor) this.checkPartnerships();
      if (!r.double || player.jailTurns >= 0) break;
    }
    this.manage(seat);
  }

  play() {
    for (this.round = 0; this.round < this.rounds; this.round++) {
      if (this.round % 2 === 0 && this.cfg.news) {
        if (this.newsDeck.length === 0) this.newsDeck = shuffled(NEWS, this.rng);
        this.news = this.newsDeck.pop();
        if (this.news === 'peace') for (const player of this.players) this.offerTrade(player.seat);
      }
      for (let seat = 0; seat < this.n; seat++) this.turn(seat);
      for (const player of this.players) {
        this.stats.cashTotal += player.cash;
        this.stats.cashSamples++;
      }
    }
    return this.players.map((player) => this.worth(player.seat));
  }
}

function winners(worths) {
  const best = Math.max(...worths);
  return worths.map((w) => (w === best ? 1 / worths.filter((x) => x === best).length : 0));
}

/** Eine Reihe gleicher Partien, ausgewertet. */
function measure(cfg, players, years, games, seedBase, kinds = null) {
  const seatWins = new Array(players).fill(0);
  const out = { players, years, games, turns: 0, gap: 0, gapSecond: 0, debtGames: 0, debtSum: 0, trades: 0, partnerships: 0, wholes: 0, builds: 0, auctions: 0, auctionPaid: 0, mortgages: 0, worth: 0, cash: 0, jail: 0, unowned: 0 };
  const guilds = cfg.guilds.map(() => ({ rent: 0, whole: 0, wholeWins: 0, partner: 0, partnerWins: 0 }));
  const landings = new Array(36).fill(0);
  let community = 0;
  for (let i = 0; i < games; i++) {
    const game = new Game(cfg, kinds ?? new Array(players).fill('merchant'), years, seedBase + i);
    const worths = game.play();
    const wins = winners(worths);
    wins.forEach((w, seat) => (seatWins[seat] += w));
    const sorted = [...worths].sort((a, b) => b - a);
    out.turns += game.stats.turns;
    out.gap += sorted[0] - sorted[sorted.length - 1];
    out.gapSecond += sorted[0] - sorted[1];
    out.worth += sorted.reduce((a, b) => a + b, 0) / players;
    out.cash += game.stats.cashTotal / game.stats.cashSamples;
    out.trades += game.stats.trades;
    out.partnerships += game.stats.partnerships;
    out.builds += game.stats.builds;
    out.auctions += game.stats.auctions;
    out.auctionPaid += game.stats.auctionPaid;
    out.mortgages += game.stats.mortgages;
    out.jail += game.stats.jail;
    out.unowned += [...game.prop.values()].filter((p) => p.owner === -1).length;
    if (game.debts.length > 0) out.debtGames++;
    out.debtSum += game.debts.reduce((a, d) => a + d.amount, 0);
    community += game.stats.rentCommunity;
    game.stats.landings.forEach((v, f) => (landings[f] += v));
    cfg.guilds.forEach((_, g) => {
      guilds[g].rent += game.stats.rentByGuild[g];
      for (let seat = 0; seat < players; seat++) {
        if (game.hasWhole(seat, g)) {
          guilds[g].whole++;
          out.wholes++;
          guilds[g].wholeWins += wins[seat];
        } else if (game.isPartner(seat, g)) {
          guilds[g].partner++;
          guilds[g].partnerWins += wins[seat];
        }
      }
    });
  }
  const per = (key) => out[key] / games;
  return {
    players,
    years,
    games,
    seatWin: seatWins.map((w) => (w / games) * 100),
    turns: per('turns'),
    gap: per('gap'),
    gapSecond: per('gapSecond'),
    debtShare: (out.debtGames / games) * 100,
    debtSum: per('debtSum'),
    trades: per('trades'),
    partnerships: per('partnerships'),
    wholes: per('wholes'),
    builds: per('builds'),
    auctions: per('auctions'),
    auctionRatio: out.auctions ? out.auctionPaid / out.auctions : 0,
    mortgages: per('mortgages'),
    worth: per('worth'),
    cash: per('cash'),
    jail: per('jail'),
    unowned: per('unowned'),
    communityRent: community / games,
    guilds: guilds.map((g, i) => ({
      name: cfg.guilds[i].name,
      rent: g.rent / games,
      wholeShare: (g.whole / games) * 100,
      wholeWin: g.whole ? (g.wholeWins / g.whole) * 100 : 0,
      partnerShare: (g.partner / games) * 100,
      partnerWin: g.partner ? (g.partnerWins / g.partner) * 100 : 0,
    })),
    landings: landings.map((v) => v / games),
  };
}

/** Ursächlicher Zunft-Vergleich: Platz 0 oder ein zufälliger Platz startet mit der Zunft, bezahlt zum Listenpreis. */
function guildGift(cfg, players, years, games, seedBase) {
  const start = Math.max(cfg.start, 60);
  const rich = { ...cfg, start };
  return cfg.guilds.map((guild, g) => {
    let wins = 0;
    let worth = 0;
    let others = 0;
    for (let i = 0; i < games; i++) {
      const seat = i % players;
      const game = new Game(rich, new Array(players).fill('merchant'), years, seedBase + i, { seat, guild: g });
      const worths = game.play();
      wins += winners(worths)[seat];
      worth += worths[seat];
      others += (worths.reduce((a, b) => a + b, 0) - worths[seat]) / (players - 1);
    }
    return { name: guild.name, win: (wins / games) * 100, lead: (worth - others) / games };
  });
}

/** Gezielter Vergleich: Ein Platz verfolgt eine Zunft, die anderen spielen normal. */
function guildFocus(cfg, players, years, games, seedBase) {
  return cfg.guilds.map((guild, g) => {
    let wins = 0;
    let got = 0;
    for (let i = 0; i < games; i++) {
      const seat = i % players;
      const game = new Game(cfg, new Array(players).fill('merchant'), years, seedBase + i);
      game.players[seat].focus = g;
      wins += winners(game.play())[seat];
      if (game.canDouble(seat, g)) got++;
    }
    return { name: guild.name, win: (wins / games) * 100, got: (got / games) * 100 };
  });
}

function fmt(v, d = 1) {
  return v.toFixed(d).replace('.', ',');
}

function table(head, rows) {
  const line = (cells) => `| ${cells.join(' | ')} |`;
  return [line(head), line(head.map(() => '---')), ...rows.map(line)].join('\n');
}

/** Eine Zeile je Fassung, damit sich Regeln und Zahlen schnell gegenüberstellen lassen. */
function compare(variants, games) {
  const rows = [];
  for (const [name, cfg] of Object.entries(variants)) {
    const a = measure(cfg, 4, 3, games, 21_000_000);
    const six = measure(cfg, 6, 3, games, 22_000_000);
    const two = measure(cfg, 2, 3, games, 23_000_000);
    const gift = guildFocus(cfg, 4, 3, games, 24_000_000);
    const seat = (r) => Math.max(...r.seatWin.map((w) => Math.abs(w - 100 / r.players)));
    rows.push([
      name,
      fmt(a.worth, 0),
      fmt(a.gapSecond, 0),
      fmt(a.gap, 0),
      fmt(a.debtShare, 0),
      fmt(a.debtSum, 1),
      fmt(a.trades),
      fmt(a.partnerships),
      fmt(a.wholes),
      fmt(a.builds),
      `${fmt(seat(two))} / ${fmt(seat(a))} / ${fmt(seat(six))}`,
      gift.map((g) => fmt(g.win, 0)).join(' '),
    ]);
  }
  console.log(table(['Fassung', 'Vermögen', '1.–2.', '1.–Letzter', 'Schuld %', 'Schuld Ø', 'Handel', 'Partner', 'ganz', 'Bauten', 'Platz 2/4/6', 'Zunft B W I Sch Sm St'], rows));
}

function main() {
  const arg = (name, fallback) => {
    const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
    return hit ? hit.split('=')[1] : fallback;
  };
  const games = Number(arg('games', 3000));
  const setName = arg('set', 'plan');
  const cfg = { ...BASE, ...SETS[setName] };
  const report = { set: setName, games };
  if (process.argv.includes('--compare')) return compare(COMPARE(cfg), games);
  console.log(`# Marktplatz-Probe, Zahlensatz „${setName}“, ${games} Partien je Fall\n`);

  // 1. Alle Spielerzahlen und Dauern, nur Krämer.
  report.grid = [];
  for (const players of [2, 3, 4, 5, 6]) for (const years of [2, 3, 4]) report.grid.push(measure(cfg, players, years, games, players * 1000 + years * 100000));
  console.log('## Überblick (nur Krämer)\n');
  console.log(
    table(
      ['Spieler', 'Jahre', 'Züge', 'Vermögen', 'Abstand 1.–Letzter', 'Abstand 1.–2.', 'Kasse Ø', 'Schuldscheine %', 'Handel', 'Partnerschaften', 'ganze Zünfte', 'Bauten', 'frei am Ende'],
      report.grid.map((r) => [r.players, r.years, fmt(r.turns, 0), fmt(r.worth, 0), fmt(r.gap, 0), fmt(r.gapSecond, 0), fmt(r.cash, 0), fmt(r.debtShare, 1), fmt(r.trades), fmt(r.partnerships), fmt(r.wholes), fmt(r.builds), fmt(r.unowned)]),
    ),
  );

  console.log('\n## Siegquote je Startplatz in % (fair = 100 / Spieler)\n');
  console.log(table(['Spieler', 'Jahre', 'Plätze', 'größte Abweichung (Prozentpunkte)'], report.grid.map((r) => [r.players, r.years, r.seatWin.map((w) => fmt(w, 0)).join(' / '), fmt(Math.max(...r.seatWin.map((w) => Math.abs(w - 100 / r.players))))])));

  // 2. Zünfte, 4 Spieler 3 Jahre.
  const ref = report.grid.find((r) => r.players === 4 && r.years === 3);
  console.log('\n## Zünfte (4 Spieler, 3 Jahre; fair = 25 %)\n');
  console.log(table(['Zunft', 'Ware je Partie', 'ganz %', 'Sieg wenn ganz %', 'Partner %', 'Sieg als Partner %'], ref.guilds.map((g) => [g.name, fmt(g.rent), fmt(g.wholeShare), fmt(g.wholeWin), fmt(g.partnerShare), fmt(g.partnerWin)])));
  console.log(`\nGemeinschaftsbetriebe: ${fmt(ref.communityRent)} Brezeln Ware je Partie.`);

  report.gift = guildGift(cfg, 4, 3, Math.ceil(games / 2), 7_000_000);
  console.log('\n## Ursache: Ein Platz startet mit der ganzen Zunft zum Listenpreis (Startgeld 60, 4 Spieler, 3 Jahre)\n');
  console.log(table(['Zunft', 'Siegquote %', 'Vorsprung auf die anderen'], report.gift.map((g) => [g.name, fmt(g.win), fmt(g.lead)])));

  report.focus = guildFocus(cfg, 4, 3, games, 8_000_000);
  console.log('\n## Ein Platz verfolgt gezielt eine Zunft, die anderen spielen normal (4 Spieler, 3 Jahre; fair = 25 %)\n');
  console.log(table(['Zunft', 'Siegquote %', 'Zunft erreicht %'], report.focus.map((g) => [g.name, fmt(g.win), fmt(g.got)])));

  // 3. Schalter im Vergleich.
  report.toggles = {};
  const variants = { Plan: {}, 'ohne Hofnachrichten': { news: false }, 'ohne Partnerschaft': { partnership: false }, 'ohne Handel': { trade: false } };
  for (const [name, change] of Object.entries(variants)) report.toggles[name] = measure({ ...cfg, ...change }, 4, 3, games, 9_000_000);
  console.log('\n## Schalter (4 Spieler, 3 Jahre)\n');
  console.log(table(['Fassung', 'Vermögen', 'Abstand 1.–Letzter', 'Abstand 1.–2.', 'Handel', 'Partnerschaften', 'ganze Zünfte', 'Bauten', 'Schuldscheine %'], Object.entries(report.toggles).map(([name, r]) => [name, fmt(r.worth, 0), fmt(r.gap, 0), fmt(r.gapSecond, 0), fmt(r.trades), fmt(r.partnerships), fmt(r.wholes), fmt(r.builds), fmt(r.debtShare)])));

  // 4. Krämer gegen Zufall.
  report.bots = [];
  for (const players of [2, 3, 4, 6]) {
    const kinds = ['merchant', ...new Array(players - 1).fill('random')];
    let wins = 0;
    for (let i = 0; i < games; i++) {
      const rotated = kinds.map((_, s) => kinds[(s + i) % players]);
      const game = new Game(cfg, rotated, 3, 12_000_000 + i);
      const seat = rotated.indexOf('merchant');
      wins += winners(game.play())[seat];
    }
    report.bots.push({ players, win: (wins / games) * 100 });
  }
  console.log('\n## Ein Krämer gegen Zufallsbots (3 Jahre)\n');
  console.log(table(['Spieler', 'Siegquote Krämer %', 'fair %'], report.bots.map((b) => [b.players, fmt(b.win), fmt(100 / b.players)])));

  const out = arg('json', null);
  if (out) writeFileSync(out, JSON.stringify(report, null, 1));
}

main();
