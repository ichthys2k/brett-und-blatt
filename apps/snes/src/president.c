/*
 * Präsident (Arschloch) für Brett & Blatt 16 – nach packages/games/president/src/rules.ts.
 * 2–4 Spieler, 32 oder 52 Karten, Rangfolge mit "2 hoch" oder Standard, Runden und Titel.
 *
 * Karten (0..51):
 *   card = suit * 13 + (rank - 1)
 *   suit: 0: C (Kreuz), 1: D (Karo), 2: H (Herz), 3: S (Pik)
 *   rank: 1..13 (1 = Ass, 2..10, 11: Bube, 12: Dame, 13: König)
 *
 * Züge:
 *   [0, Anzahl, Karte1, Karte2...] – Karten legen
 *   [1, 0]                         – Passen
 *   [2, Anzahl, Karte1, Karte2]    – Karten abgeben (Tauschphase)
 *   [3, 0]                         – Bereit für nächste Runde
 */
#include "spiel.h"
#include "bild.h"
#include "klang.h"
#include "karten.h"
#include "../res/grafik.h"

#define KEIN 0xff

enum { PHASE_PLAY, PHASE_EXCHANGE, PHASE_ROUND_END, PHASE_GAME_END };

typedef struct {
  u8 seat;
  u8 count;
  u8 cards[4];
} TrickPlay;

typedef struct {
  u8 low;
  u8 high;
  u8 count;
  u8 done;
  u8 up[2];
  u8 down[2];
} Swap;

typedef struct {
  u8 phase;
  u8 seats;
  u8 turn;
  u8 round;
  u8 max_rounds;

  /* Optionen */
  u8 deck_size;     /* 32 oder 52 */
  u8 two_high;      /* 1 wenn 2 die höchste Karte ist (bei 52 Karten) */
  u8 reenter;       /* 1 (Standard) */
  u8 same_skips;    /* 0 oder 1 */
  u8 eight_clears;  /* 0 oder 1 */
  u8 revolution;    /* 0 oder 1 */
  u8 reversed;      /* 1 wenn Rangfolge umgekehrt */

  u8 hand_n[PLAETZE_MAX];
  u8 hands[PLAETZE_MAX][52];

  u8 trick_n;
  TrickPlay trick[52];

  u8 passed[PLAETZE_MAX];
  u8 ready[PLAETZE_MAX];

  u8 finished_n;
  u8 finished[PLAETZE_MAX];
  u8 last_place[PLAETZE_MAX];

  s8 scores[PLAETZE_MAX];

  u8 swaps_n;
  Swap swaps[2];

  Zufall rng;
} President;

/* ------------------------------------------------------------------ Hilfsfunktionen */

static u8 card_suit(u8 card) {
  return card / 13;
}

static u8 card_rank(u8 card) {
  return (card % 13) + 1;
}

static u8 card_value(u8 card, u8 two_high, u8 deck_size) {
  u8 rank = card_rank(card);
  if (rank == 1) return 14; /* Ass */
  if (rank == 2 && two_high && deck_size == 52) return 15; /* 2 hoch */
  return rank;
}

static u8 beats(u8 a_val, u8 b_val, u8 reversed) {
  return reversed ? (a_val < b_val) : (a_val > b_val);
}

static void sort_cards(President *p, u8 *cards, u8 n) {
  u8 i, j;
  for (i = 0; i < n; i++) {
    for (j = i + 1; j < n; j++) {
      u8 c1 = cards[i];
      u8 c2 = cards[j];
      u8 v1 = card_value(c1, p->two_high, p->deck_size);
      u8 v2 = card_value(c2, p->two_high, p->deck_size);
      s8 diff = p->reversed ? (v2 - v1) : (v1 - v2);
      if (diff > 0 || (diff == 0 && c1 > c2)) {
        cards[i] = c2;
        cards[j] = c1;
      }
    }
  }
}

static u8 in_play(const President *p, u8 seat) {
  u8 i;
  if (p->hand_n[seat] == 0) return 0;
  for (i = 0; i < p->finished_n; i++) {
    if (p->finished[i] == seat) return 0;
  }
  return 1;
}

static u8 next_active(const President *p, u8 from, u8 skip_passed) {
  u8 step;
  for (step = 1; step <= p->seats; step++) {
    u8 seat = (from + step) % p->seats;
    if (in_play(p, seat) && !(skip_passed && p->passed[seat])) return seat;
  }
  return KEIN;
}

static s8 place_points(u8 place, u8 players) {
  if (place == 0) return 2;
  if (place == players - 1) return -2;
  if (players >= 4 && place == 1) return 1;
  if (players >= 4 && place == players - 2) return -1;
  return 0;
}

static Swap *pending_swap(President *p) {
  u8 i;
  for (i = 0; i < p->swaps_n; i++) {
    if (!p->swaps[i].done) return &p->swaps[i];
  }
  return 0;
}

static void deal(President *p) {
  u8 deck[52];
  u8 deck_cards = 0;
  u8 i, s;

  p->reversed = 0;

  if (p->deck_size == 52) {
    for (i = 0; i < 52; i++) deck[i] = i;
    deck_cards = 52;
  } else {
    /* 32 Karten: 1 (Ass), 7..13 */
    u8 suit, rank;
    for (suit = 0; suit < 4; suit++) {
      deck[deck_cards++] = suit * 13 + 0; /* Ass */
      for (rank = 7; rank <= 13; rank++) {
        deck[deck_cards++] = suit * 13 + (rank - 1);
      }
    }
  }

  for (i = deck_cards - 1; i > 0; i--) {
    u8 j = (u8)zufall_bis(&p->rng, i + 1);
    u8 tmp = deck[i];
    deck[i] = deck[j];
    deck[j] = tmp;
  }

  for (s = 0; s < p->seats; s++) p->hand_n[s] = 0;
  for (i = 0; i < deck_cards; i++) {
    u8 seat = i % p->seats;
    p->hands[seat][p->hand_n[seat]++] = deck[i];
  }
  for (s = 0; s < p->seats; s++) {
    sort_cards(p, p->hands[s], p->hand_n[s]);
    p->passed[s] = 0;
    p->ready[s] = 0;
  }

  p->trick_n = 0;
  p->finished_n = 0;
  p->reversed = 0;
  p->swaps_n = 0;
}

static u8 by_seat_place(const President *p, u8 place) {
  u8 s;
  for (s = 0; s < p->seats; s++) {
    if (p->last_place[s] == place) return s;
  }
  return 0;
}

static void end_round(President *p);

static void clear_trick(President *p, u8 winner) {
  u8 s;
  p->trick_n = 0;
  for (s = 0; s < p->seats; s++) p->passed[s] = 0;
  p->turn = in_play(p, winner) ? winner : next_active(p, winner, 0);
}

static void advance(President *p, u8 from, u8 skip) {
  u8 leader = p->trick[p->trick_n - 1].seat;
  u8 all_others_passed = 1;
  u8 s, turn;

  for (s = 0; s < p->seats; s++) {
    if (s != leader && in_play(p, s) && !p->passed[s]) {
      all_others_passed = 0;
      break;
    }
  }

  if (all_others_passed) {
    clear_trick(p, leader);
    return;
  }

  turn = next_active(p, from, 1);
  if (skip) {
    turn = next_active(p, turn, 1);
  }

  if (turn == leader || turn == KEIN) {
    clear_trick(p, leader);
    return;
  }

  p->turn = turn;
}

static void start_round(President *p) {
  u8 n = p->seats;
  p->round++;
  deal(p);

  /* Tauschpaare: Bettler (n-1) -> Präsident (0) */
  {
    u8 low = by_seat_place(p, n - 1);
    u8 high = by_seat_place(p, 0);
    u8 count = 2;
    u8 up1 = p->hands[low][p->hand_n[low] - 2];
    u8 up2 = p->hands[low][p->hand_n[low] - 1];
    p->hand_n[low] -= 2;
    p->hands[high][p->hand_n[high]++] = up1;
    p->hands[high][p->hand_n[high]++] = up2;
    sort_cards(p, p->hands[high], p->hand_n[high]);

    p->swaps[0].low = low;
    p->swaps[0].high = high;
    p->swaps[0].count = count;
    p->swaps[0].done = 0;
    p->swaps[0].up[0] = up1;
    p->swaps[0].up[1] = up2;
    p->swaps_n = 1;
  }

  if (n >= 4) {
    u8 low = by_seat_place(p, n - 2);
    u8 high = by_seat_place(p, 1);
    u8 count = 1;
    u8 up1 = p->hands[low][p->hand_n[low] - 1];
    p->hand_n[low] -= 1;
    p->hands[high][p->hand_n[high]++] = up1;
    sort_cards(p, p->hands[high], p->hand_n[high]);

    p->swaps[1].low = low;
    p->swaps[1].high = high;
    p->swaps[1].count = count;
    p->swaps[1].done = 0;
    p->swaps[1].up[0] = up1;
    p->swaps_n = 2;
  }

  p->phase = PHASE_EXCHANGE;
  p->turn = by_seat_place(p, n - 1);
}

static void end_round(President *p) {
  u8 n = p->seats;
  u8 s;

  for (s = 0; s < n; s++) {
    u8 found = 0;
    u8 i;
    for (i = 0; i < p->finished_n; i++) {
      if (p->finished[i] == s) { found = 1; break; }
    }
    if (!found) p->finished[p->finished_n++] = s;
  }

  for (s = 0; s < n; s++) {
    u8 seat = p->finished[s];
    s8 pts = place_points(s, n);
    p->scores[seat] += pts;
    p->last_place[seat] = s;
    p->ready[s] = 0;
  }

  p->trick_n = 0;
  p->phase = (p->round >= p->max_rounds) ? PHASE_GAME_END : PHASE_ROUND_END;
}

/* ------------------------------------------------------------------ Regeln */

static void president_aufbauen(u8 *stand, const u8 *optionen, u8 plaetze, const char *seed) {
  President *p = (President *)stand;
  u8 s;

  p->seats = plaetze;
  p->round = 1;
  p->max_rounds = (optionen[0] == 1) ? 5 : 3;
  p->deck_size = (optionen[1] == 1) ? 52 : (plaetze <= 5 ? 32 : 52);
  p->two_high = (optionen[1] == 1 && p->deck_size == 52) ? 1 : 0;
  p->reenter = 1;
  p->same_skips = 0;
  p->eight_clears = 0;
  p->revolution = 0;
  p->reversed = 0;

  if (optionen[2] == 1) {
    p->eight_clears = 1;
    p->revolution = 1;
  }

  for (s = 0; s < plaetze; s++) {
    p->scores[s] = 0;
    p->last_place[s] = KEIN;
  }

  zufall_strom(&p->rng, seed, "president");
  deal(p);

  /* Startspieler Runde 1: Wer die niedrigste Kreuzkarte hat */
  {
    u8 lowest_club = (p->deck_size == 32) ? 6 : (p->two_high ? 2 : 1); /* C7, C3, C2 */
    u8 target_card = 0 * 13 + lowest_club; /* suit 0 (C) */
    p->turn = 0;
    for (s = 0; s < plaetze; s++) {
      u8 i;
      for (i = 0; i < p->hand_n[s]; i++) {
        if (p->hands[s][i] == target_card) {
          p->turn = s;
          break;
        }
      }
    }
  }

  p->phase = PHASE_PLAY;
}

static u8 president_ergebnis(const u8 *stand, u8 *sieger) {
  const President *p = (const President *)stand;
  if (p->phase != PHASE_GAME_END) return ERGEBNIS_LAEUFT;
  {
    s8 best = -128;
    u8 s, win_mask = 0;
    for (s = 0; s < p->seats; s++) {
      if (p->scores[s] > best) best = p->scores[s];
    }
    for (s = 0; s < p->seats; s++) {
      if (p->scores[s] == best) {
        win_mask |= (1 << s);
      }
    }
    *sieger = win_mask;
    return ERGEBNIS_SIEG;
  }
}

static u8 president_am_zug(const u8 *stand) {
  const President *p = (const President *)stand;
  u8 dummy, s;
  if (president_ergebnis(stand, &dummy) != ERGEBNIS_LAEUFT) return PLATZ_KEIN;
  if (p->phase == PHASE_PLAY) return p->turn;
  if (p->phase == PHASE_EXCHANGE) {
    Swap *sw = pending_swap((President *)p);
    return sw ? sw->high : PLATZ_KEIN;
  }
  if (p->phase == PHASE_ROUND_END) {
    for (s = 0; s < p->seats; s++) {
      if (!p->ready[s]) return s;
    }
  }
  return PLATZ_KEIN;
}

static u16 president_zuege(const u8 *stand, Zug *liste) {
  const President *p = (const President *)stand;
  u8 actor = president_am_zug(stand);
  u16 n = 0;
  u8 i, j;

  if (actor == PLATZ_KEIN) return 0;

  if (p->phase == PHASE_ROUND_END) {
    liste[0].n = 2;
    liste[0].b[0] = 3;
    liste[0].b[1] = 0;
    return 1;
  }

  if (p->phase == PHASE_EXCHANGE) {
    Swap *sw = pending_swap((President *)p);
    u8 count = sw->count;
    if (count == 1) {
      for (i = 0; i < p->hand_n[actor]; i++) {
        liste[n].n = 3;
        liste[n].b[0] = 2;
        liste[n].b[1] = 1;
        liste[n].b[2] = p->hands[actor][i];
        n++;
      }
    } else if (count == 2) {
      for (i = 0; i < p->hand_n[actor]; i++) {
        for (j = i + 1; j < p->hand_n[actor]; j++) {
          liste[n].n = 4;
          liste[n].b[0] = 2;
          liste[n].b[1] = 2;
          liste[n].b[2] = p->hands[actor][i];
          liste[n].b[3] = p->hands[actor][j];
          n++;
        }
      }
    }
    return n;
  }

  /* PHASE_PLAY: Karten nach Rängen gruppieren */
  {
    u8 hand_len = p->hand_n[actor];
    const TrickPlay *top = (p->trick_n > 0) ? &p->trick[p->trick_n - 1] : 0;
    u8 top_val = top ? card_value(top->cards[0], p->two_high, p->deck_size) : 0;
    u8 top_cnt = top ? top->count : 0;

    i = 0;
    while (i < hand_len) {
      u8 v = card_value(p->hands[actor][i], p->two_high, p->deck_size);
      u8 start = i;
      while (i < hand_len && card_value(p->hands[actor][i], p->two_high, p->deck_size) == v) i++;
      u8 grp_cnt = i - start;

      if (top) {
        if (grp_cnt >= top_cnt) {
          if (beats(v, top_val, p->reversed) || (p->same_skips && v == top_val)) {
            liste[n].n = 2 + top_cnt;
            liste[n].b[0] = 0;
            liste[n].b[1] = top_cnt;
            for (j = 0; j < top_cnt; j++) liste[n].b[2 + j] = p->hands[actor][start + j];
            n++;
          }
        }
      } else {
        u8 len;
        for (len = 1; len <= grp_cnt; len++) {
          liste[n].n = 2 + len;
          liste[n].b[0] = 0;
          liste[n].b[1] = len;
          for (j = 0; j < len; j++) liste[n].b[2 + j] = p->hands[actor][start + j];
          n++;
        }
      }
    }

    if (top) {
      liste[n].n = 2;
      liste[n].b[0] = 1;
      liste[n].b[1] = 0;
      n++;
    }
  }

  return n;
}

static u8 president_ziehen(u8 *stand, const Zug *zug) {
  President *p = (President *)stand;
  u8 actor = president_am_zug(stand);
  u8 typ = zug->b[0];
  u8 i;

  if (actor == PLATZ_KEIN) return KLANG_KLICK;

  if (typ == 3) {
    /* Ready */
    p->ready[actor] = 1;
    u8 all_ready = 1;
    for (i = 0; i < p->seats; i++) if (!p->ready[i]) all_ready = 0;
    if (all_ready) start_round(p);
    return KLANG_KLICK;
  }

  if (typ == 2) {
    /* Give (Tausch) */
    Swap *sw = pending_swap(p);
    u8 count = zug->b[1];
    u8 c, j;
    for (c = 0; c < count; c++) {
      u8 card = zug->b[2 + c];
      /* Remove from actor */
      for (i = 0; i < p->hand_n[actor]; i++) {
        if (p->hands[actor][i] == card) {
          for (j = i; j < p->hand_n[actor] - 1; j++) p->hands[actor][j] = p->hands[actor][j + 1];
          p->hand_n[actor]--;
          break;
        }
      }
      /* Add to recipient */
      p->hands[sw->low][p->hand_n[sw->low]++] = card;
    }
    sort_cards(p, p->hands[actor], p->hand_n[actor]);
    sort_cards(p, p->hands[sw->low], p->hand_n[sw->low]);
    sw->done = 1;

    if (!pending_swap(p)) {
      p->phase = PHASE_PLAY;
      p->turn = by_seat_place(p, p->seats - 1);
    }
    return KLANG_KARTE;
  }

  if (typ == 1) {
    /* Pass */
    p->passed[actor] = 1;
    advance(p, actor, 0);
    return KLANG_KLICK;
  }

  if (typ == 0) {
    /* Play */
    u8 count = zug->b[1];
    u8 card_val = card_value(zug->b[2], p->two_high, p->deck_size);
    u8 same = 0;
    if (p->trick_n > 0) {
      same = (card_val == card_value(p->trick[p->trick_n - 1].cards[0], p->two_high, p->deck_size));
    }

    /* Remove cards from hand */
    for (i = 0; i < count; i++) {
      u8 card = zug->b[2 + i];
      u8 j;
      for (j = 0; j < p->hand_n[actor]; j++) {
        if (p->hands[actor][j] == card) {
          u8 k;
          for (k = j; k < p->hand_n[actor] - 1; k++) p->hands[actor][k] = p->hands[actor][k + 1];
          p->hand_n[actor]--;
          break;
        }
      }
    }

    /* Add to trick */
    p->trick[p->trick_n].seat = actor;
    p->trick[p->trick_n].count = count;
    for (i = 0; i < count; i++) p->trick[p->trick_n].cards[i] = zug->b[2 + i];
    p->trick_n++;

    if (p->reenter) {
      for (i = 0; i < p->seats; i++) p->passed[i] = 0;
    }

    if (p->revolution && count == 4) {
      p->reversed = !p->reversed;
      for (i = 0; i < p->seats; i++) sort_cards(p, p->hands[i], p->hand_n[i]);
    }

    if (p->hand_n[actor] == 0) {
      p->finished[p->finished_n++] = actor;
      u8 remaining = 0;
      for (i = 0; i < p->seats; i++) if (in_play(p, i)) remaining++;
      if (remaining <= 1) {
        end_round(p);
        return KLANG_KARTE;
      }
    }

    if (p->eight_clears && card_rank(zug->b[2]) == 8) {
      clear_trick(p, actor);
      return KLANG_KARTE;
    }

    advance(p, actor, same && p->same_skips);
    return KLANG_KARTE;
  }

  return KLANG_KLICK;
}

/* ------------------------------------------------------------------ Bot */

static void president_bot(const u8 *stand, u8 stufe, Zufall *z, Zug *zug) {
  const President *p = (const President *)stand;
  u16 anzahl = president_zuege(stand, zugliste);
  u16 i;

  if (anzahl == 0) return;

  if (p->phase == PHASE_ROUND_END) {
    *zug = zugliste[0];
    return;
  }

  if (stufe == STUFE_LEICHT && zufall_bis(z, 10) < 3) {
    u16 w = zufall_bis(z, anzahl);
    *zug = zugliste[w];
    return;
  }

  if (p->phase == PHASE_EXCHANGE) {
    /* Schwächste Karten abgeben (erste Züge haben die kleinsten Karten) */
    *zug = zugliste[0];
    return;
  }

  /* PHASE_PLAY */
  if (p->trick_n == 0) {
    /* Eröffnen: Am besten die kleinste Gruppe ganz spielen */
    /* Finde unter den play-Zügen denjenigen mit der größten Anzahl der ersten Gruppe */
    u16 best_idx = 0;
    u8 best_val = 255;
    for (i = 0; i < anzahl; i++) {
      if (zugliste[i].b[0] == 0) {
        u8 v = card_value(zugliste[i].b[2], p->two_high, p->deck_size);
        if (v < best_val) {
          best_val = v;
          best_idx = i;
        } else if (v == best_val && zugliste[i].b[1] > zugliste[best_idx].b[1]) {
          /* Gleicher Wert: Größere Anzahl bevorzugen */
          best_idx = i;
        }
      }
    }
    *zug = zugliste[best_idx];
  } else {
    /* Bedienen: Die schwächste passende Legung spielen */
    for (i = 0; i < anzahl; i++) {
      if (zugliste[i].b[0] == 0) {
        *zug = zugliste[i];
        return;
      }
    }
    /* Sonst Passen */
    *zug = zugliste[anzahl - 1];
  }
}

/* ------------------------------------------------------------------ Prüfmodus */

static u16 president_ausgeben(const u8 *stand, u8 *puffer) {
  const President *p = (const President *)stand;
  u16 n = 0;
  u8 s, i, j;

  puffer[n++] = p->phase;
  puffer[n++] = p->round;
  puffer[n++] = p->turn;
  puffer[n++] = p->reversed;

  for (s = 0; s < p->seats; s++) {
    puffer[n++] = (u8)(p->scores[s] + 128);
  }

  puffer[n++] = p->finished_n;
  for (i = 0; i < p->finished_n; i++) puffer[n++] = p->finished[i];

  for (s = 0; s < p->seats; s++) puffer[n++] = p->last_place[s];

  puffer[n++] = p->trick_n;
  for (i = 0; i < p->trick_n; i++) {
    puffer[n++] = p->trick[i].seat;
    puffer[n++] = p->trick[i].count;
    for (j = 0; j < p->trick[i].count; j++) puffer[n++] = p->trick[i].cards[j];
  }

  for (s = 0; s < p->seats; s++) puffer[n++] = p->passed[s];
  for (s = 0; s < p->seats; s++) puffer[n++] = p->ready[s];

  for (s = 0; s < p->seats; s++) {
    puffer[n++] = p->hand_n[s];
    for (i = 0; i < p->hand_n[s]; i++) puffer[n++] = p->hands[s][i];
  }

  puffer[n++] = p->swaps_n;
  for (i = 0; i < p->swaps_n; i++) {
    puffer[n++] = p->swaps[i].low;
    puffer[n++] = p->swaps[i].high;
    puffer[n++] = p->swaps[i].count;
    puffer[n++] = p->swaps[i].done;
  }

  return n;
}

/* ------------------------------------------------------------------ Oberfläche */

static void president_gitter(const u8 *stand, u8 *breite, u8 *hoehe) {
  u16 z = president_zuege(stand, zugliste);
  *breite = 1;
  *hoehe = (z > 14) ? 14 : ((z == 0) ? 1 : z);
}

static u8 president_feld_an(const u8 *stand, u8 x, u8 y) {
  (void)stand;
  (void)x;
  return y;
}

static u8 president_felder(const u8 *stand, const Zug *zug, u8 *felder) {
  u16 z = president_zuege(stand, zugliste);
  u16 i;
  for (i = 0; i < z; i++) {
    if (zug_gleich(&zugliste[i], zug)) {
      felder[0] = (i < 14) ? i : 0;
      return 1;
    }
  }
  return 0;
}

static void president_zeichnen(const u8 *stand, const u8 *markierung, u8 aktiv) {
  const President *p = (const President *)stand;
  u8 s, i;
  (void)aktiv;
  (void)markierung;

  flaeche_leeren(0, 0, 32, 28);
  text(2, 2, "PRAESIDENT", PAL_GELB);
  text(18, 2, "Runde:", PAL_TEXT);
  zahl(25, 2, p->round, 2, PAL_GELB);

  /* Spieler-Übersicht */
  for (s = 0; s < p->seats; s++) {
    u8 px = 2 + s * 7;
    text(px, 4, (s == 0) ? "Du:" : "S :", (s == p->turn) ? PAL_GELB : PAL_TEXT);
    if (s > 0) zahl(px + 1, 4, s + 1, 1, (s == p->turn) ? PAL_GELB : PAL_TEXT);
    zahl(px + 4, 4, p->hand_n[s], 2, PAL_TEXT);
  }

  /* Aktueller Stich in der Mitte */
  text(2, 7, "Stich:", PAL_TEXT);
  if (p->trick_n > 0) {
    const TrickPlay *top = &p->trick[p->trick_n - 1];
    text(9, 7, "von", PAL_GRAU);
    zahl(13, 7, top->seat + 1, 1, PAL_GELB);
    for (i = 0; i < top->count; i++) {
      u8 c = top->cards[i];
      u8 col = card_suit(c);
      u8 r = card_rank(c);
      u8 x = 2 + i * 3;
      u8 y = 9;
      karten_zahl(x, y, col, r, 1, PAL_BRETT);
    }
  } else {
    text(9, 7, "leer", PAL_GRAU);
  }

  /* Eigene Hand unten */
  text(2, 18, "Deine Hand:", PAL_TEXT);
  for (i = 0; i < p->hand_n[0]; i++) {
    u8 c = p->hands[0][i];
    u8 col = card_suit(c);
    u8 r = card_rank(c);
    u8 x = 2 + (i % 8) * 3;
    u8 y = 20 + (i / 8) * 3;
    if (y + 3 <= 28) {
      karten_zahl(x, y, col, r, 1, PAL_BRETT);
    }
  }
}

/* ------------------------------------------------------------------ Steckbrief */

static const char *const ANLEITUNG[] = {
  "Bedienung: Lege gleich viele Karten",
  "hoeheren Rangs oder passe.",
  "Wer zuerst alle Karten los ist,",
  "wird Praesident, der Letzte Bettler.",
  "In der naechsten Runde gibt der",
  "Bettler seine besten Karten ab!",
  0
};

static const char *const OPT_ROUNDS[] = {"3 Runden", "5 Runden"};
static const char *const OPT_DECK[] = {"32 Karten", "52 Karten (2 hoch)"};
static const char *const OPT_RULES[] = {"Standard", "Achter/Revolution"};

static const Option OPTIONEN[] = {
  {"Runden", OPT_ROUNDS, 2, 0},
  {"Blatt", OPT_DECK, 2, 0},
  {"Regeln", OPT_RULES, 2, 0},
};

static const char *const PLATZ_NAMEN[] = {"Spieler 1", "Spieler 2", "Spieler 3", "Spieler 4"};
static const u8 PLATZ_PALETTEN[] = {PAL_ROT, PAL_BLAU, PAL_GELB, PAL_GRAU};

const Spiel spiel_president = {
  "Praesident",
  ANLEITUNG,
  "A Karte legen",
  PLATZ_NAMEN,
  PLATZ_PALETTEN,
  2, 4,
  1, /* verdeckt */
  OPTIONEN,
  3,
  FARBEN_KARTEN,
  president_aufbauen,
  president_am_zug,
  president_zuege,
  president_ziehen,
  president_ergebnis,
  president_bot,
  president_ausgeben,
  president_gitter,
  president_feld_an,
  president_felder,
  president_zeichnen,
  0, 0,
};
