/*
 * Kartenblitz (Ligretto) für Brett & Blatt 16 – nach packages/games/ligretto/src/rules.ts.
 * 2–4 Spieler, je 40 Karten (Rot, Gelb, Grün, Blau, Werte 1–10).
 *
 * Karten (0..39):
 *   card = suit * 10 + (value - 1)
 *   suit: 0: Rot, 1: Gelb, 2: Grün, 3: Blau
 *   value: 1..10
 *
 * Züge:
 *   [actor, 0, source, slot, pile] – Karte aus Ligretto (0), Reihe (1), Talon (2) in die Mitte
 *   [actor, 1]                     – Umblättern (flip)
 *   [actor, 2]                     – Festgefahren (stuck)
 *   [actor, 3]                     – Bereit (ready)
 */
#include "spiel.h"
#include "bild.h"
#include "klang.h"
#include "karten.h"
#include "../res/grafik.h"

#define KEIN 0xff
#define LIGRETTO_MAX_PLAETZE 4
#define LIGRETTO_MAX_CENTER 16

enum { PHASE_PLAY, PHASE_ROUND_END, PHASE_GAME_END };
enum { SOURCE_LIGRETTO = 0, SOURCE_ROW = 1, SOURCE_TALON = 2 };
enum { MOVE_PLAY = 0, MOVE_FLIP = 1, MOVE_STUCK = 2, MOVE_READY = 3 };

typedef struct {
  u8 ligretto_n;
  u8 ligretto[10];

  u8 row[5]; /* Bis zu 5 Slots, ungenutzte sind KEIN */

  u8 hand_n;
  u8 hand[30];

  u8 talon_n;
  u8 talon[30];

  u8 played;
  u8 stuck;
  u8 idle_flips;
  u8 ready;
} Player;

typedef struct {
  u8 id;
  u8 suit;
  u8 count; /* 1..10 */
} CenterPile;

typedef struct {
  u8 phase;
  u8 seats;
  u8 round;
  u8 goal_kind; /* 0: 'r', 1: 'p' */
  u8 goal_n;    /* 1, 3, 5, 50, 99 */
  u8 flip_count; /* 1 oder 3 */

  u8 next_pile_id;
  u8 center_n;
  CenterPile center[LIGRETTO_MAX_CENTER];
  u8 cleared_count;

  Player players[LIGRETTO_MAX_PLAETZE];
  s16 scores[LIGRETTO_MAX_PLAETZE];

  Zufall rng;
} Ligretto;

static u8 row_size_for(u8 seats) {
  if (seats <= 2) return 5;
  if (seats == 3) return 4;
  return 3;
}

static void deal_player(Ligretto *p, u8 seat) {
  Player *pl = &p->players[seat];
  u8 deck[40];
  u8 i, s;
  u8 r_size = row_size_for(p->seats);

  for (i = 0; i < 40; i++) deck[i] = i;

  /* Fisher-Yates shuffle wie Rng.shuffle */
  for (i = 39; i > 0; i--) {
    u8 j = (u8)zufall_bis(&p->rng, i + 1);
    u8 tmp = deck[i];
    deck[i] = deck[j];
    deck[j] = tmp;
  }

  pl->ligretto_n = 10;
  for (i = 0; i < 10; i++) pl->ligretto[i] = deck[i];

  for (i = 0; i < 5; i++) {
    if (i < r_size) pl->row[i] = deck[10 + i];
    else pl->row[i] = KEIN;
  }

  pl->hand_n = 40 - 10 - r_size;
  for (i = 0; i < pl->hand_n; i++) pl->hand[i] = deck[10 + r_size + i];

  pl->talon_n = 0;
  pl->played = 0;
  pl->stuck = 0;
  pl->idle_flips = 0;
  pl->ready = 0;
}

static void start_round_ligretto(Ligretto *p) {
  u8 s;
  for (s = 0; s < p->seats; s++) deal_player(p, s);
  p->center_n = 0;
  p->cleared_count = 0;
  p->round++;
  p->phase = PHASE_PLAY;
}

static u8 is_game_over(const Ligretto *p) {
  u8 s;
  if (p->goal_kind == 0) {
    return p->round >= p->goal_n;
  }
  for (s = 0; s < p->seats; s++) {
    if (p->scores[s] >= (s16)p->goal_n) return 1;
  }
  return 0;
}

static void end_round_ligretto(Ligretto *p) {
  u8 s;
  for (s = 0; s < p->seats; s++) {
    s16 pts = (s16)p->players[s].played - 2 * (s16)p->players[s].ligretto_n;
    p->scores[s] += pts;
    p->players[s].stuck = 0;
    p->players[s].idle_flips = 0;
    p->players[s].ready = 0;
  }
  p->phase = is_game_over(p) ? PHASE_GAME_END : PHASE_ROUND_END;
}

static void unjam_ligretto(Ligretto *p) {
  u8 s, i;
  for (s = 0; s < p->seats; s++) {
    Player *pl = &p->players[s];
    if (pl->ligretto_n > 1) {
      u8 top = pl->ligretto[0];
      for (i = 0; i < pl->ligretto_n - 1; i++) pl->ligretto[i] = pl->ligretto[i + 1];
      pl->ligretto[pl->ligretto_n - 1] = top;
    }
    if (pl->talon_n > 0) {
      u8 top = pl->talon[--pl->talon_n];
      pl->hand[pl->hand_n++] = top;
    }
    pl->stuck = 0;
    pl->idle_flips = 0;
  }
}

/* ------------------------------------------------------------------ Regeln */

static void ligretto_aufbauen(u8 *stand, const u8 *optionen, u8 plaetze, const char *seed) {
  Ligretto *p = (Ligretto *)stand;
  u8 s, i;

  p->seats = plaetze;
  if (p->seats < 2) p->seats = 2;
  if (p->seats > LIGRETTO_MAX_PLAETZE) p->seats = LIGRETTO_MAX_PLAETZE;

  /* Option 0: goal */
  /* 0: r1, 1: r3, 2: r5, 3: p50, 4: p99 */
  if (optionen[0] == 0) { p->goal_kind = 0; p->goal_n = 1; }
  else if (optionen[0] == 1) { p->goal_kind = 0; p->goal_n = 3; }
  else if (optionen[0] == 2) { p->goal_kind = 0; p->goal_n = 5; }
  else if (optionen[0] == 3) { p->goal_kind = 1; p->goal_n = 50; }
  else { p->goal_kind = 1; p->goal_n = 99; }

  /* Option 1: flip */
  /* 0: three, 1: one */
  p->flip_count = (optionen[1] == 1) ? 1 : 3;

  p->round = 1;
  p->next_pile_id = 0;
  p->center_n = 0;
  p->cleared_count = 0;

  for (s = 0; s < LIGRETTO_MAX_PLAETZE; s++) {
    p->scores[s] = 0;
  }

  zufall_strom(&p->rng, seed, "ligretto");

  for (s = 0; s < p->seats; s++) {
    deal_player(p, s);
  }

  p->phase = PHASE_PLAY;
}

static u8 ligretto_ergebnis(const u8 *stand, u8 *sieger) {
  const Ligretto *p = (const Ligretto *)stand;
  s16 best;
  u8 s, mask = 0, count = 0;

  if (p->phase != PHASE_GAME_END) return ERGEBNIS_LAEUFT;

  best = p->scores[0];
  for (s = 1; s < p->seats; s++) {
    if (p->scores[s] > best) best = p->scores[s];
  }

  for (s = 0; s < p->seats; s++) {
    if (p->scores[s] == best) {
      mask |= (1 << s);
      count++;
    }
  }

  *sieger = mask;
  if (count == p->seats) return ERGEBNIS_REMIS;
  return ERGEBNIS_SIEG;
}

static u8 ligretto_am_zug(const u8 *stand) {
  const Ligretto *p = (const Ligretto *)stand;
  u8 s;

  if (p->phase == PHASE_PLAY) {
    for (s = 0; s < p->seats; s++) {
      if (!p->players[s].stuck) return s;
    }
    return 0;
  }
  if (p->phase == PHASE_ROUND_END) {
    for (s = 0; s < p->seats; s++) {
      if (!p->players[s].ready) return s;
    }
  }
  return PLATZ_KEIN;
}

static u8 card_at(const Player *pl, u8 source_kind, u8 slot) {
  if (source_kind == SOURCE_LIGRETTO) return pl->ligretto_n > 0 ? pl->ligretto[0] : KEIN;
  if (source_kind == SOURCE_TALON) return pl->talon_n > 0 ? pl->talon[pl->talon_n - 1] : KEIN;
  return pl->row[slot];
}

static u8 can_flip(const Player *pl) {
  return pl->hand_n > 0 || pl->talon_n > 1;
}

static u16 ligretto_zuege(const u8 *stand, Zug *liste) {
  const Ligretto *p = (const Ligretto *)stand;
  u8 actor = ligretto_am_zug(stand);
  u16 n = 0;
  const Player *pl;
  u8 r_size, src_idx, c, suit, val, pile_idx;

  if (actor == PLATZ_KEIN || p->phase == PHASE_GAME_END) return 0;

  pl = &p->players[actor];

  if (p->phase == PHASE_ROUND_END) {
    if (!pl->ready) {
      liste[0].n = 2;
      liste[0].b[0] = actor;
      liste[0].b[1] = MOVE_READY;
      return 1;
    }
    return 0;
  }

  if (pl->stuck) return 0;

  r_size = row_size_for(p->seats);

  /* Alle Quellen in fester Reihenfolge: Ligretto, Reihe, Talon */
  for (src_idx = 0; src_idx < 1 + r_size + 1; src_idx++) {
    u8 kind, slot = 0;
    if (src_idx == 0) {
      kind = SOURCE_LIGRETTO;
    } else if (src_idx <= r_size) {
      kind = SOURCE_ROW;
      slot = src_idx - 1;
    } else {
      kind = SOURCE_TALON;
    }

    c = card_at(pl, kind, slot);
    if (c == KEIN) continue;

    suit = c / 10;
    val = (c % 10) + 1;

    if (val == 1) {
      /* Neuer Stapel: pile = 0xff (null) */
      liste[n].n = 5;
      liste[n].b[0] = actor;
      liste[n].b[1] = MOVE_PLAY;
      liste[n].b[2] = kind;
      liste[n].b[3] = slot;
      liste[n].b[4] = 0xff;
      n++;
    } else {
      for (pile_idx = 0; pile_idx < p->center_n; pile_idx++) {
        if (p->center[pile_idx].suit == suit && p->center[pile_idx].count == val - 1) {
          liste[n].n = 5;
          liste[n].b[0] = actor;
          liste[n].b[1] = MOVE_PLAY;
          liste[n].b[2] = kind;
          liste[n].b[3] = slot;
          liste[n].b[4] = p->center[pile_idx].id;
          n++;
        }
      }
    }
  }

  if (can_flip(pl)) {
    liste[n].n = 2;
    liste[n].b[0] = actor;
    liste[n].b[1] = MOVE_FLIP;
    n++;
  }

  liste[n].n = 2;
  liste[n].b[0] = actor;
  liste[n].b[1] = MOVE_STUCK;
  n++;

  return n;
}

static u8 ligretto_ziehen(u8 *stand, const Zug *zug) {
  Ligretto *p = (Ligretto *)stand;
  u8 actor = zug->b[0];
  u8 type = zug->b[1];
  Player *pl = &p->players[actor];
  u8 s, i;

  if (type == MOVE_READY) {
    pl->ready = 1;
    for (s = 0; s < p->seats; s++) {
      if (!p->players[s].ready) return KLANG_KLICK;
    }
    start_round_ligretto(p);
    return KLANG_START;
  }

  if (type == MOVE_STUCK) {
    pl->stuck = 1;
    for (s = 0; s < p->seats; s++) {
      if (!p->players[s].stuck) return KLANG_KLICK;
    }
    unjam_ligretto(p);
    return KLANG_KLICK;
  }

  if (type == MOVE_FLIP) {
    u8 take;
    if (pl->hand_n == 0) {
      for (i = 0; i < pl->talon_n; i++) pl->hand[i] = pl->talon[i];
      pl->hand_n = pl->talon_n;
      pl->talon_n = 0;
    }
    take = pl->hand_n < p->flip_count ? pl->hand_n : p->flip_count;
    for (i = 0; i < take; i++) pl->talon[pl->talon_n + i] = pl->hand[i];
    pl->talon_n += take;
    for (i = 0; i < pl->hand_n - take; i++) pl->hand[i] = pl->hand[take + i];
    pl->hand_n -= take;
    pl->idle_flips++;
    return KLANG_KARTE;
  }

  if (type == MOVE_PLAY) {
    u8 kind = zug->b[2];
    u8 slot = zug->b[3];
    u8 wanted_pile = zug->b[4];
    u8 card = card_at(pl, kind, slot);
    u8 suit = card / 10;
    u8 val = (card % 10) + 1;
    u8 target_pile_id = 0xff;
    u8 pile_idx;

    if (kind == SOURCE_LIGRETTO) {
      for (i = 0; i < pl->ligretto_n - 1; i++) pl->ligretto[i] = pl->ligretto[i + 1];
      pl->ligretto_n--;
    } else if (kind == SOURCE_TALON) {
      pl->talon_n--;
    } else {
      if (pl->ligretto_n > 0) {
        pl->row[slot] = pl->ligretto[0];
        for (i = 0; i < pl->ligretto_n - 1; i++) pl->ligretto[i] = pl->ligretto[i + 1];
        pl->ligretto_n--;
      } else {
        pl->row[slot] = KEIN;
      }
    }
    pl->played++;

    /* Zielstapel ermitteln */
    if (val == 1) {
      target_pile_id = 0xff;
    } else {
      /* Prüfen, ob wanted_pile passt */
      if (wanted_pile != 0xff) {
        for (pile_idx = 0; pile_idx < p->center_n; pile_idx++) {
          if (p->center[pile_idx].id == wanted_pile && p->center[pile_idx].suit == suit && p->center[pile_idx].count == val - 1) {
            target_pile_id = wanted_pile;
            break;
          }
        }
      }
      if (target_pile_id == 0xff) {
        /* Erster passender Stapel */
        for (pile_idx = 0; pile_idx < p->center_n; pile_idx++) {
          if (p->center[pile_idx].suit == suit && p->center[pile_idx].count == val - 1) {
            target_pile_id = p->center[pile_idx].id;
            break;
          }
        }
      }
    }

    if (target_pile_id == 0xff) {
      pile_idx = p->center_n++;
      p->center[pile_idx].id = p->next_pile_id++;
      p->center[pile_idx].suit = suit;
      p->center[pile_idx].count = 1;
    } else {
      for (pile_idx = 0; pile_idx < p->center_n; pile_idx++) {
        if (p->center[pile_idx].id == target_pile_id) {
          p->center[pile_idx].count++;
          break;
        }
      }
    }

    /* Abräumen bei 10 */
    if (p->center[pile_idx].count >= 10) {
      for (i = pile_idx; i < p->center_n - 1; i++) {
        p->center[i] = p->center[i + 1];
      }
      p->center_n--;
      p->cleared_count += 10;
    }

    /* stuck / idle_flips für alle zurücksetzen */
    for (s = 0; s < p->seats; s++) {
      if (p->players[s].stuck || p->players[s].idle_flips > 0) {
        p->players[s].stuck = 0;
        p->players[s].idle_flips = 0;
      }
    }

    if (pl->ligretto_n == 0) {
      end_round_ligretto(p);
      return KLANG_ENDE;
    }

    return KLANG_KARTE;
  }

  return KLANG_KLICK;
}

/* ------------------------------------------------------------------ Bot */

static Zug bot_plays[32];

static void ligretto_bot(const u8 *stand, u8 stufe, Zufall *z, Zug *zug) {
  const Ligretto *p = (const Ligretto *)stand;
  u8 actor = ligretto_am_zug(stand);
  const Player *pl;
  u16 plays_n = 0;
  u8 r_size, src_idx, c, suit, val, pile_idx;
  u8 oversight = (stufe == STUFE_LEICHT) ? 35 : (stufe == STUFE_MITTEL) ? 12 : 0;
  u8 cards, can_fl, cycle;

  if (actor == PLATZ_KEIN) return;
  pl = &p->players[actor];

  if (p->phase == PHASE_ROUND_END) {
    zug->n = 2;
    zug->b[0] = actor;
    zug->b[1] = MOVE_READY;
    return;
  }

  r_size = row_size_for(p->seats);

  /* Play-Züge sammeln */
  for (src_idx = 0; src_idx < 1 + r_size + 1; src_idx++) {
    u8 kind, slot = 0;
    if (src_idx == 0) kind = SOURCE_LIGRETTO;
    else if (src_idx <= r_size) { kind = SOURCE_ROW; slot = src_idx - 1; }
    else kind = SOURCE_TALON;

    c = card_at(pl, kind, slot);
    if (c == KEIN) continue;

    suit = c / 10;
    val = (c % 10) + 1;

    if (val == 1) {
      bot_plays[plays_n].n = 5;
      bot_plays[plays_n].b[0] = actor;
      bot_plays[plays_n].b[1] = MOVE_PLAY;
      bot_plays[plays_n].b[2] = kind;
      bot_plays[plays_n].b[3] = slot;
      bot_plays[plays_n].b[4] = 0xff;
      plays_n++;
    } else {
      for (pile_idx = 0; pile_idx < p->center_n; pile_idx++) {
        if (p->center[pile_idx].suit == suit && p->center[pile_idx].count == val - 1) {
          bot_plays[plays_n].n = 5;
          bot_plays[plays_n].b[0] = actor;
          bot_plays[plays_n].b[1] = MOVE_PLAY;
          bot_plays[plays_n].b[2] = kind;
          bot_plays[plays_n].b[3] = slot;
          bot_plays[plays_n].b[4] = p->center[pile_idx].id;
          plays_n++;
        }
      }
    }
  }

  /* Oversight filtern */
  if (plays_n > 0 && oversight > 0) {
    u16 filtered_n = 0;
    u16 i;
    for (i = 0; i < plays_n; i++) {
      if ((zufall_bis(z, 100)) >= oversight) {
        bot_plays[filtered_n++] = bot_plays[i];
      }
    }
    plays_n = filtered_n;
  }

  if (plays_n > 0) {
    /* Priorität: ligretto (rank 3), row (rank 2), talon (rank 1) */
    u8 best_rank = 0;
    u16 best_count = 0;
    u16 i;
    for (i = 0; i < plays_n; i++) {
      u8 r = (bot_plays[i].b[2] == SOURCE_LIGRETTO) ? 3 : (bot_plays[i].b[2] == SOURCE_ROW) ? 2 : 1;
      if (r > best_rank) {
        best_rank = r;
        best_count = 1;
      } else if (r == best_rank) {
        best_count++;
      }
    }
    {
      u16 pick = (u16)zufall_bis(z, best_count);
      u16 cur = 0;
      for (i = 0; i < plays_n; i++) {
        u8 r = (bot_plays[i].b[2] == SOURCE_LIGRETTO) ? 3 : (bot_plays[i].b[2] == SOURCE_ROW) ? 2 : 1;
        if (r == best_rank) {
          if (cur == pick) {
            *zug = bot_plays[i];
            return;
          }
          cur++;
        }
      }
    }
  }

  cards = pl->hand_n + pl->talon_n;
  can_fl = can_flip(pl);
  cycle = (cards + p->flip_count - 1) / p->flip_count + 1;
  if (can_fl && pl->idle_flips < cycle) {
    zug->n = 2;
    zug->b[0] = actor;
    zug->b[1] = MOVE_FLIP;
    return;
  }

  zug->n = 2;
  zug->b[0] = actor;
  zug->b[1] = MOVE_STUCK;
}

/* ------------------------------------------------------------------ Prüfmodus */

static u16 ligretto_ausgeben(const u8 *stand, u8 *puffer) {
  const Ligretto *p = (const Ligretto *)stand;
  u16 n = 0;
  u8 s, i;

  puffer[n++] = p->phase;
  puffer[n++] = p->round;
  puffer[n++] = p->next_pile_id;

  for (s = 0; s < p->seats; s++) {
    const Player *pl = &p->players[s];
    puffer[n++] = pl->ligretto_n;
    for (i = 0; i < pl->ligretto_n; i++) puffer[n++] = pl->ligretto[i];

    for (i = 0; i < 5; i++) puffer[n++] = pl->row[i];

    puffer[n++] = pl->talon_n;
    for (i = 0; i < pl->talon_n; i++) puffer[n++] = pl->talon[i];

    puffer[n++] = pl->hand_n;
    for (i = 0; i < pl->hand_n; i++) puffer[n++] = pl->hand[i];

    puffer[n++] = pl->played;
    puffer[n++] = pl->stuck;
    puffer[n++] = pl->idle_flips;
    puffer[n++] = pl->ready;

    puffer[n++] = (u8)(p->scores[s] & 0xff);
    puffer[n++] = (u8)((p->scores[s] >> 8) & 0xff);
  }

  puffer[n++] = p->center_n;
  for (i = 0; i < p->center_n; i++) {
    puffer[n++] = p->center[i].id;
    puffer[n++] = p->center[i].suit;
    puffer[n++] = p->center[i].count;
  }

  puffer[n++] = p->cleared_count;

  /* RNG: 4 x u32 */
  for (i = 0; i < 4; i++) {
    u32 v = p->rng.s[i];
    puffer[n++] = (u8)(v & 0xff);
    puffer[n++] = (u8)((v >> 8) & 0xff);
    puffer[n++] = (u8)((v >> 16) & 0xff);
    puffer[n++] = (u8)((v >> 24) & 0xff);
  }

  return n;
}

/* ------------------------------------------------------------------ Oberfläche */

/*
 * Felder:
 * 0: Blitzstapel (Ligretto)
 * 1..5: Reihe (Slots 0..4)
 * 6: Talon
 * 7: Hand (Umblättern)
 * 8: Festhängen
 * 9: Bereit
 */
enum {
  FELD_LIGRETTO = 0,
  FELD_ROW_0 = 1,
  FELD_ROW_1 = 2,
  FELD_ROW_2 = 3,
  FELD_ROW_3 = 4,
  FELD_ROW_4 = 5,
  FELD_TALON = 6,
  FELD_FLIP = 7,
  FELD_STUCK = 8,
  FELD_READY = 9,
  LIGRETTO_FELDER_ANZAHL = 10
};

static void ligretto_gitter(const u8 *stand, u8 *breite, u8 *hoehe) {
  (void)stand;
  *breite = 7;
  *hoehe = 2;
}

static u8 ligretto_feld_an(const u8 *stand, u8 x, u8 y) {
  const Ligretto *p = (const Ligretto *)stand;
  if (p->phase == PHASE_ROUND_END) return FELD_READY;
  if (y == 0) {
    if (x == 0) return FELD_LIGRETTO;
    if (x <= 5) return FELD_ROW_0 + (x - 1);
    return FELD_TALON;
  }
  if (x <= 2) return FELD_FLIP;
  return FELD_STUCK;
}

static u8 ligretto_felder(const u8 *stand, const Zug *zug, u8 *f) {
  (void)stand;
  if (zug->b[1] == MOVE_READY) {
    f[0] = FELD_READY;
    return 1;
  }
  if (zug->b[1] == MOVE_FLIP) {
    f[0] = FELD_FLIP;
    return 1;
  }
  if (zug->b[1] == MOVE_STUCK) {
    f[0] = FELD_STUCK;
    return 1;
  }
  if (zug->b[1] == MOVE_PLAY) {
    u8 kind = zug->b[2];
    if (kind == SOURCE_LIGRETTO) f[0] = FELD_LIGRETTO;
    else if (kind == SOURCE_TALON) f[0] = FELD_TALON;
    else f[0] = FELD_ROW_0 + zug->b[3];
    return 1;
  }
  return 0;
}

static const u8 FARBEN_PAL[4] = { PAL_ROT, PAL_GELB, PAL_BRETT_MARKE, PAL_BLAU };
static const char FARB_BUCHSTABE[4] = { 'R', 'G', 'U', 'B' };

static void zeige_karte(u8 x, u8 y, u8 c) {
  if (c == KEIN) {
    text(x, y, "---", PAL_GRAU);
  } else {
    u8 s = c / 10;
    u8 v = (c % 10) + 1;
    kachel(x, y, FARB_BUCHSTABE[s], FARBEN_PAL[s]);
    zahl(x + 1, y, v, 2, FARBEN_PAL[s]);
  }
}

static void ligretto_zeichnen(const u8 *stand, const u8 *markierung, u8 aktiv) {
  const Ligretto *p = (const Ligretto *)stand;
  u8 i, s;
  const Player *ich = &p->players[0];
  const Player *bot = &p->players[1];

  bild_leeren();
  tafel(1, 3, 30, 22);

  /* Gegner (oben) */
  text(3, 4, "Gegner:", PAL_GRAU);
  text(11, 4, "Blitz:", PAL_GRAU);
  zahl(18, 4, bot->ligretto_n, 2, PAL_TEXT);
  if (bot->ligretto_n > 0) zeige_karte(21, 4, bot->ligretto[0]);

  text(3, 5, "Reihe:", PAL_GRAU);
  for (i = 0; i < 5; i++) {
    if (bot->row[i] != KEIN) zeige_karte(10 + i * 4, 5, bot->row[i]);
  }

  text(3, 6, "Talon:", PAL_GRAU);
  if (bot->talon_n > 0) zeige_karte(10, 6, bot->talon[bot->talon_n - 1]);
  text(16, 6, "Hand:", PAL_GRAU);
  zahl(22, 6, bot->hand_n, 2, PAL_TEXT);
  if (bot->stuck) text(26, 6, "STOP", PAL_ROT);

  /* Mitte (Center Piles) */
  text_mitte(8, "Mitte", PAL_GELB);
  for (i = 0; i < p->center_n && i < 10; i++) {
    u8 cx = 3 + (i % 5) * 5;
    u8 cy = 10 + (i / 5) * 2;
    u8 s = p->center[i].suit;
    u8 v = p->center[i].count;
    kachel(cx, cy, FARB_BUCHSTABE[s], FARBEN_PAL[s]);
    zahl(cx + 1, cy, v, 2, FARBEN_PAL[s]);
  }

  /* Eigener Bereich (unten) */
  text(3, 15, "Du:", PAL_GELB);
  text(7, 15, "Blitz", PAL_TEXT);
  text(13, 15, "Reihe", PAL_TEXT);
  text(26, 15, "Talon", PAL_TEXT);

  /* Eigene Karten */
  /* Ligretto */
  if (ich->ligretto_n > 0) zeige_karte(7, 16, ich->ligretto[0]);
  else text(7, 16, "000", PAL_GRAU);
  zahl(7, 17, ich->ligretto_n, 2, PAL_GRAU);

  /* Reihe */
  for (i = 0; i < 5; i++) {
    if (ich->row[i] != KEIN) zeige_karte(11 + i * 3, 16, ich->row[i]);
  }

  /* Talon */
  if (ich->talon_n > 0) zeige_karte(26, 16, ich->talon[ich->talon_n - 1]);
  else text(26, 16, "---", PAL_GRAU);
  text(26, 17, "Hand", PAL_GRAU);
  zahl(29, 17, ich->hand_n, 2, PAL_GRAU);

  /* Aktionen */
  text(5, 19, "[Umblättern]", PAL_TEXT);
  text(18, 19, "[Festgefahren]", PAL_TEXT);

  /* Cursor-Markierungen */
  if (aktiv) {
    if (markierung[FELD_LIGRETTO] & MARK_CURSOR) kachel(6, 16, K_PFEIL, PAL_GELB);
    for (i = 0; i < 5; i++) {
      if (markierung[FELD_ROW_0 + i] & MARK_CURSOR) kachel(10 + i * 3, 16, K_PFEIL, PAL_GELB);
    }
    if (markierung[FELD_TALON] & MARK_CURSOR) kachel(25, 16, K_PFEIL, PAL_GELB);
    if (markierung[FELD_FLIP] & MARK_CURSOR) kachel(4, 19, K_PFEIL, PAL_GELB);
    if (markierung[FELD_STUCK] & MARK_CURSOR) kachel(17, 19, K_PFEIL, PAL_GELB);
    if (markierung[FELD_READY] & MARK_CURSOR) text_mitte(21, "A: Bereit für nächste Runde", PAL_GELB);
  }

  /* Punkte / Runde */
  text(3, 22, "Runde", PAL_GRAU);
  zahl(9, 22, p->round, 2, PAL_TEXT);
  text(14, 22, "Punkte:", PAL_GRAU);
  zahl(22, 22, (u16)p->scores[0], 3, PAL_GELB);
  text(26, 22, ":", PAL_GRAU);
  zahl(28, 22, (u16)p->scores[1], 3, PAL_TEXT);
}

/* ------------------------------------------------------------------ Steckbrief */

static const char *const LIGRETTO_ANLEITUNG[] = {
  "Alle spielen gleichzeitig: Legt eure oberste Blitzkarte, Karten der Reihe oder die oberste Talonkarte in die Mitte.",
  "In der Mitte beginnt jeder Stapel mit 1 und wächst in gleicher Farbe bis 10. Volle Stapel werden abgeräumt.",
  "Wer seinen Blitzstapel leert, beendet die Runde. Punkte: +1 je gelegter Karte, -2 je verbliebener Blitzkarte.",
  0,
};

static const char *const OPTION_GOAL_WERTE[] = { "1 Runde", "3 Runden", "5 Runden", "50 Punkte", "99 Punkte" };
static const char *const OPTION_FLIP_WERTE[] = { "Je drei", "Einzeln" };

static const Option LIGRETTO_OPTIONEN[] = {
  { "Spieldauer", OPTION_GOAL_WERTE, 5, 1 },
  { "Handkarten", OPTION_FLIP_WERTE, 2, 0 },
};

static const char *const PLATZ_NAMEN[] = { "Spieler 1", "Spieler 2", "Spieler 3", "Spieler 4" };
static const u8 PLATZ_PALETTEN[] = { PAL_ROT, PAL_BLAU, PAL_GELB, PAL_BRETT_MARKE };

const Spiel spiel_ligretto = {
  "Kartenblitz",
  LIGRETTO_ANLEITUNG,
  "✚ Wahl · A Zug",
  PLATZ_NAMEN,
  PLATZ_PALETTEN,
  2, 4,
  0,
  LIGRETTO_OPTIONEN,
  2,
  FARBEN_KARTEN,
  ligretto_aufbauen,
  ligretto_am_zug,
  ligretto_zuege,
  ligretto_ziehen,
  ligretto_ergebnis,
  ligretto_bot,
  ligretto_ausgeben,
  ligretto_gitter,
  ligretto_feld_an,
  ligretto_felder,
  ligretto_zeichnen,
  0, 0,
  0,
  0,
  0,
};
