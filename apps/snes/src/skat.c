/*
 * Skat für Brett & Blatt 16 (Stufe 5) nach packages/games/skat/src/rules.ts.
 * 3 Spieler (am 3er-Tisch oder 4er-Tisch mit Geber pausierend).
 * 32 Karten, Reizen nach ISkO, Hand/Skat, Farbspiele, Grand und Null.
 */
#include <string.h>
#include "spiel.h"
#include "bild.h"
#include "klang.h"
#include "karten.h"
#include "stich.h"
#include "res/grafik.h"

#define KEIN 0xff

enum {
  PHASE_BIDDING,
  PHASE_SKAT_DECISION,
  PHASE_DISCARD,
  PHASE_DECLARE,
  PHASE_PLAY,
  PHASE_ROUND_OVER,
  PHASE_PASSED_OUT
};

enum {
  STAGE_MH_VH,
  STAGE_HH_WINNER,
  STAGE_DONE
};

enum {
  SKAT_FARBE_C = 0,
  SKAT_FARBE_S = 1,
  SKAT_FARBE_H = 2,
  SKAT_FARBE_D = 3,
  SKAT_GRAND = 4,
  SKAT_NULL = 5
};

static const u8 SKAT_DECK[32] = {
  /* C: 7, 8, 9, 10, B, D, K, A */
  6, 7, 8, 9, 10, 11, 12, 0,
  /* D: 7, 8, 9, 10, B, D, K, A */
  19, 20, 21, 22, 23, 24, 25, 13,
  /* H: 7, 8, 9, 10, B, D, K, A */
  32, 33, 34, 35, 36, 37, 38, 26,
  /* S: 7, 8, 9, 10, B, D, K, A */
  45, 46, 47, 48, 49, 50, 51, 39
};

/* Alle gültigen Reizwerte nach ISkO */
static const u16 REIZWERTE[] = {
  18, 20, 22, 23, 24, 27, 30, 33, 35, 36, 40, 44, 45, 46, 48, 50,
  54, 55, 59, 60, 63, 66, 70, 72, 77, 80, 81, 84, 88, 90, 96, 99,
  100, 108, 110, 117, 120, 121, 126, 130, 132, 135, 140, 143, 144,
  150, 153, 154, 156, 160, 162, 165, 168, 170, 176, 180, 187, 192,
  198, 204, 216, 240, 264, 288, 312, 336, 360, 384, 408, 432
};
#define REIZWERTE_ANZAHL (sizeof(REIZWERTE) / sizeof(REIZWERTE[0]))

static u16 naechster_reizwert(u16 aktueller) {
  u8 i;
  for (i = 0; i < REIZWERTE_ANZAHL; i++) {
    if (REIZWERTE[i] > aktueller) return REIZWERTE[i];
  }
  return aktueller + 1;
}

typedef struct {
  u8 table_players;
  u8 total_games;
  u8 game_number;
  u8 dealer_seat;
  u8 active_seats[3];

  u8 phase;
  u8 hand_n[PLAETZE_MAX];
  u8 hands[PLAETZE_MAX][12];

  u8 skat_n;
  u8 skat[2];
  u8 discarded_n;
  u8 discarded[2];

  u8 declarer_seat;
  u16 highest_bid;
  u16 current_bid_value;

  u8 bidding_stage;
  u8 bidding_speaker;
  u8 bidding_listener;
  u8 bidding_awaiting_answer;
  u8 passed_count;
  u8 passed_seats[3];

  /* Ansage */
  u8 has_declaration;
  u8 game_type; /* 0..5 */
  u8 decl_hand;
  u8 decl_schneider;
  u8 decl_schwarz;
  u8 decl_ouvert;

  /* Spielverlauf */
  u8 leader_seat;
  u8 trick_n;
  StichKarte current_trick[3];

  u8 declarer_tricks_count;
  u8 declarer_eyes;
  u8 opponent_eyes;

  s16 scores[PLAETZE_MAX];
  u8 decl_all_cards[12];
  Zufall rng;
} SkatState;

static void skat_karten_verteilen(SkatState *s) {
  u8 deck[32];
  u8 i, idx;

  memcpy(deck, SKAT_DECK, 32);

  /* Fisher-Yates Mischen */
  for (i = 31; i > 0; i--) {
    u16 j = zufall_bis(&s->rng, i + 1);
    u8 t = deck[i];
    deck[i] = deck[j];
    deck[j] = t;
  }

  memset(s->hand_n, 0, sizeof(s->hand_n));
  memset(s->hands, 0, sizeof(s->hands));
  memset(s->skat, 0, sizeof(s->skat));
  memset(s->discarded, 0, sizeof(s->discarded));
  s->discarded_n = 0;

  /* Austeilen: 3 je Spieler, 2 in den Skat, 4 je Spieler, 3 je Spieler */
  idx = 0;
  for (i = 0; i < 3; i++) {
    u8 p = s->active_seats[i];
    memcpy(s->hands[p] + s->hand_n[p], deck + idx, 3);
    s->hand_n[p] += 3;
    idx += 3;
  }
  memcpy(s->skat, deck + idx, 2);
  s->skat_n = 2;
  idx += 2;
  for (i = 0; i < 3; i++) {
    u8 p = s->active_seats[i];
    memcpy(s->hands[p] + s->hand_n[p], deck + idx, 4);
    s->hand_n[p] += 4;
    idx += 4;
  }
  for (i = 0; i < 3; i++) {
    u8 p = s->active_seats[i];
    memcpy(s->hands[p] + s->hand_n[p], deck + idx, 3);
    s->hand_n[p] += 3;
    idx += 3;
  }

  s->phase = PHASE_BIDDING;
  s->declarer_seat = KEIN;
  s->highest_bid = 0;
  s->current_bid_value = 0;
  s->bidding_stage = STAGE_MH_VH;
  s->bidding_speaker = s->active_seats[1]; /* Mittelhand */
  s->bidding_listener = s->active_seats[0]; /* Vorhand */
  s->bidding_awaiting_answer = 0;
  s->passed_count = 0;
  memset(s->passed_seats, 0, sizeof(s->passed_seats));
  s->has_declaration = 0;
  s->game_type = 0;
  s->decl_hand = 0;
  s->decl_schneider = 0;
  s->decl_schwarz = 0;
  s->decl_ouvert = 0;
  s->leader_seat = s->active_seats[0];
  s->trick_n = 0;
  memset(s->current_trick, 0, sizeof(s->current_trick));
  s->declarer_tricks_count = 0;
  s->declarer_eyes = 0;
  s->opponent_eyes = 0;
}

static void skat_setup(u8 *stand, const u8 *opt, u8 seats, const char *seed) {
  SkatState *s = (SkatState *)stand;
  u8 i;

  memset(s, 0, sizeof(SkatState));
  s->table_players = seats;
  s->total_games = (opt && opt[0] == 0) ? 3 : (opt && opt[0] == 1) ? 6 : 12;
  s->game_number = 1;
  s->dealer_seat = 0;

  for (i = 0; i < 3; i++) {
    s->active_seats[i] = (s->dealer_seat + 1 + i) % s->table_players;
  }

  zufall_strom(&s->rng, seed, "main");
  skat_karten_verteilen(s);
}

static u8 skat_am_zug(const u8 *stand) {
  const SkatState *s = (const SkatState *)stand;
  if (s->game_number > s->total_games) return PLATZ_KEIN;
  if (s->phase == PHASE_ROUND_OVER || s->phase == PHASE_PASSED_OUT) {
    return s->active_seats[0];
  }
  if (s->phase == PHASE_BIDDING) {
    return s->bidding_speaker;
  }
  if (s->phase == PHASE_SKAT_DECISION || s->phase == PHASE_DISCARD || s->phase == PHASE_DECLARE) {
    return s->declarer_seat;
  }
  if (s->phase == PHASE_PLAY) {
    if (s->trick_n == 0) return s->leader_seat;
    /* Nächster Spieler im Uhrzeigersinn nach dem letzten gelegten */
    u8 last = s->current_trick[s->trick_n - 1].spieler;
    u8 i;
    for (i = 0; i < 3; i++) {
      if (s->active_seats[i] == last) {
        return s->active_seats[(i + 1) % 3];
      }
    }
  }
  return PLATZ_KEIN;
}

static StichVertrag skat_vertrag(const SkatState *s) {
  StichVertrag v;
  memset(&v, 0, sizeof(v));
  if (!s->has_declaration || s->game_type == SKAT_GRAND) {
    v.spieltyp = KONTRAKT_SKAT_GRAND;
    v.trumpf_farbe = STICH_KEIN;
  } else if (s->game_type == SKAT_NULL) {
    v.spieltyp = KONTRAKT_SKAT_NULL;
    v.trumpf_farbe = STICH_KEIN;
  } else {
    v.spieltyp = KONTRAKT_SKAT_FARBE;
    /* SKAT_FARBE_C=0, S=1, H=2, D=3 -> FARBE_C=0, FARBE_D=1, FARBE_H=2, FARBE_S=3 */
    if (s->game_type == SKAT_FARBE_C) v.trumpf_farbe = FARBE_C;
    else if (s->game_type == SKAT_FARBE_D) v.trumpf_farbe = FARBE_D;
    else if (s->game_type == SKAT_FARBE_H) v.trumpf_farbe = FARBE_H;
    else v.trumpf_farbe = FARBE_S;
  }
  return v;
}

static u16 skat_zuege(const u8 *stand, Zug *liste) {
  const SkatState *s = (const SkatState *)stand;
  u16 anzahl = 0;
  u8 p = skat_am_zug(stand);
  if (p == PLATZ_KEIN) return 0;

  if (s->phase == PHASE_ROUND_OVER || s->phase == PHASE_PASSED_OUT) {
    liste[0].n = 1;
    liste[0].b[0] = 8; /* nextGame */
    return 1;
  }

  if (s->phase == PHASE_BIDDING) {
    if (s->bidding_awaiting_answer) {
      /* Hörer: Halten (1) oder Passen (2) */
      liste[anzahl].n = 1; liste[anzahl].b[0] = 1; anzahl++;
      liste[anzahl].n = 1; liste[anzahl].b[0] = 2; anzahl++;
      return anzahl;
    }
    /* Sprecher: Passen (2) oder Bieten (0, val_lo, val_hi) */
    liste[anzahl].n = 1; liste[anzahl].b[0] = 2; anzahl++;
    u16 min_bid = (s->current_bid_value == 0) ? 18 : naechster_reizwert(s->current_bid_value);
    u8 i;
    for (i = 0; i < REIZWERTE_ANZAHL; i++) {
      if (REIZWERTE[i] >= min_bid) {
        liste[anzahl].n = 3;
        liste[anzahl].b[0] = 0;
        liste[anzahl].b[1] = REIZWERTE[i] & 0xff;
        liste[anzahl].b[2] = (REIZWERTE[i] >> 8) & 0xff;
        anzahl++;
      }
    }
    return anzahl;
  }

  if (s->phase == PHASE_SKAT_DECISION) {
    liste[anzahl].n = 1; liste[anzahl].b[0] = 3; anzahl++; /* takeSkat */
    liste[anzahl].n = 1; liste[anzahl].b[0] = 4; anzahl++; /* playHand */
    return anzahl;
  }

  if (s->phase == PHASE_DISCARD) {
    u8 i, j;
    u8 hn = s->hand_n[p];
    for (i = 0; i < hn; i++) {
      for (j = i + 1; j < hn; j++) {
        liste[anzahl].n = 3;
        liste[anzahl].b[0] = 5;
        liste[anzahl].b[1] = s->hands[p][i];
        liste[anzahl].b[2] = s->hands[p][j];
        anzahl++;
      }
    }
    return anzahl;
  }

  if (s->phase == PHASE_DECLARE) {
    u8 is_hand = (s->skat_n == 2 && s->discarded_n == 0);
    u8 g;
    for (g = 0; g < 6; g++) {
      /* Normal */
      liste[anzahl].n = 3;
      liste[anzahl].b[0] = 6;
      liste[anzahl].b[1] = g;
      liste[anzahl].b[2] = is_hand ? 1 : 0;
      anzahl++;
      if (is_hand) {
        if (g == SKAT_NULL) {
          liste[anzahl].n = 3; liste[anzahl].b[0] = 6; liste[anzahl].b[1] = g;
          liste[anzahl].b[2] = 1 | 8; /* Hand + Ouvert */
          anzahl++;
        } else {
          liste[anzahl].n = 3; liste[anzahl].b[0] = 6; liste[anzahl].b[1] = g;
          liste[anzahl].b[2] = 1 | 2; /* Hand + Schneider */
          anzahl++;
          liste[anzahl].n = 3; liste[anzahl].b[0] = 6; liste[anzahl].b[1] = g;
          liste[anzahl].b[2] = 1 | 2 | 4; /* Hand + Schneider + Schwarz */
          anzahl++;
          liste[anzahl].n = 3; liste[anzahl].b[0] = 6; liste[anzahl].b[1] = g;
          liste[anzahl].b[2] = 1 | 2 | 4 | 8; /* Hand + Schneider + Schwarz + Ouvert */
          anzahl++;
        }
      } else if (g == SKAT_NULL) {
        liste[anzahl].n = 3; liste[anzahl].b[0] = 6; liste[anzahl].b[1] = g;
        liste[anzahl].b[2] = 8; /* Ouvert */
        anzahl++;
      }
    }
    return anzahl;
  }

  if (s->phase == PHASE_PLAY) {
    StichVertrag v = skat_vertrag(s);
    u8 mask[12];
    u8 hn = s->hand_n[p];
    u8 i;
    stich_erlaubte_karten(s->hands[p], hn, s->current_trick, s->trick_n, &v, mask);
    for (i = 0; i < hn; i++) {
      if (mask[i]) {
        liste[anzahl].n = 2;
        liste[anzahl].b[0] = 7;
        liste[anzahl].b[1] = s->hands[p][i];
        anzahl++;
      }
    }
    return anzahl;
  }

  return 0;
}

static u8 skat_has_card(const u8 cards[12], u8 c) {
  u8 i;
  for (i = 0; i < 12; i++) {
    if (cards[i] == c) return 1;
  }
  return 0;
}

static const u8 TRUMP_SUIT_CARDS[4][7] = {
  {0, 9, 12, 11, 8, 7, 6},        /* C: A, 10, K, D, 9, 8, 7 */
  {13, 22, 25, 24, 21, 20, 19},   /* D: A, 10, K, D, 9, 8, 7 */
  {26, 35, 38, 37, 34, 33, 32},   /* H: A, 10, K, D, 9, 8, 7 */
  {39, 48, 51, 50, 47, 46, 45}    /* S: A, 10, K, D, 9, 8, 7 */
};

static u8 skat_spitzen(const SkatState *s) {
  u8 order[11];
  u8 n = 4;
  u8 i;
  order[0] = 10; /* C */
  order[1] = 49; /* S */
  order[2] = 36; /* H */
  order[3] = 23; /* D */

  if (s->game_type != SKAT_GRAND) {
    u8 suit_idx;
    if (s->game_type == SKAT_FARBE_C) suit_idx = 0;
    else if (s->game_type == SKAT_FARBE_D) suit_idx = 1;
    else if (s->game_type == SKAT_FARBE_H) suit_idx = 2;
    else suit_idx = 3; /* S */
    for (i = 0; i < 7; i++) {
      order[4 + i] = TRUMP_SUIT_CARDS[suit_idx][i];
    }
    n = 11;
  }

  u8 mit = skat_has_card(s->decl_all_cards, order[0]);
  u8 count = 0;
  for (i = 0; i < n; i++) {
    if (skat_has_card(s->decl_all_cards, order[i]) == mit) {
      count++;
    } else {
      break;
    }
  }
  return count;
}

static u16 skat_spielwert(const SkatState *s) {
  if (s->game_type == SKAT_NULL) {
    if (s->decl_ouvert && s->decl_hand) return 59;
    if (s->decl_ouvert) return 46;
    if (s->decl_hand) return 35;
    return 23;
  }

  u8 spitzen = skat_spitzen(s);
  u8 mult = 1 + spitzen;
  if (s->decl_hand) mult++;
  if (s->decl_schneider || s->opponent_eyes <= 30) mult++;
  if (s->decl_schneider) mult++;
  if (s->decl_schwarz || s->declarer_tricks_count == 10) mult++;
  if (s->decl_schwarz) mult++;
  if (s->decl_ouvert) mult++;

  u8 base;
  if (s->game_type == SKAT_FARBE_D) base = 9;
  else if (s->game_type == SKAT_FARBE_H) base = 10;
  else if (s->game_type == SKAT_FARBE_S) base = 11;
  else if (s->game_type == SKAT_FARBE_C) base = 12;
  else base = 24; /* Grand */

  return (u16)base * mult;
}

static void skat_finish_game(SkatState *s) {
  u8 decl = s->declarer_seat;
  u8 is_null = (s->game_type == SKAT_NULL);
  u8 won = 0;
  u8 overbid = 0;

  s->declarer_eyes += stich_augen(s->skat[0]) + stich_augen(s->skat[1]);
  s->opponent_eyes = 120 - s->declarer_eyes;

  if (is_null) {
    won = (s->declarer_tricks_count == 0);
  } else {
    u8 needed = s->decl_schneider ? 90 : 61;
    won = (s->declarer_eyes >= needed);
    if (s->decl_schwarz && s->declarer_tricks_count != 10) won = 0;
  }

  u16 game_val = skat_spielwert(s);
  if (game_val < s->highest_bid) {
    won = 0;
    overbid = 1;
  }

  u8 base;
  if (s->game_type == SKAT_FARBE_D) base = 9;
  else if (s->game_type == SKAT_FARBE_H) base = 10;
  else if (s->game_type == SKAT_FARBE_S) base = 11;
  else if (s->game_type == SKAT_FARBE_C) base = 12;
  else if (s->game_type == SKAT_GRAND) base = 24;
  else base = 23; /* Null */

  s16 decl_diff = 0;
  s16 opp_diff = 0;

  if (won) {
    decl_diff = (s16)game_val + 50;
  } else {
    u16 loss_val = overbid ? (((s->highest_bid + base - 1) / base) * base) : game_val;
    decl_diff = -((s16)(2 * loss_val) + 50);
    opp_diff = 40;
  }

  s->scores[decl] += decl_diff;
  u8 p;
  for (p = 0; p < 3; p++) {
    u8 seat = s->active_seats[p];
    if (seat != decl) s->scores[seat] += opp_diff;
  }

  s->phase = PHASE_ROUND_OVER;
}

static u8 skat_ziehen(u8 *stand, const Zug *zug) {
  SkatState *s = (SkatState *)stand;
  u8 typ = zug->b[0];

  if (typ == 8) { /* nextGame */
    s->game_number++;
    u8 i;
    s->dealer_seat = (s->dealer_seat + 1) % s->table_players;
    for (i = 0; i < 3; i++) {
      s->active_seats[i] = (s->dealer_seat + 1 + i) % s->table_players;
    }
    skat_karten_verteilen(s);
    return KLANG_START;
  }

  if (s->phase == PHASE_BIDDING) {
    u8 vh = s->active_seats[0];
    u8 mh = s->active_seats[1];
    u8 hh = s->active_seats[2];
    u8 p = s->bidding_speaker;

    if (s->bidding_stage == STAGE_MH_VH) {
      if (typ == 2) { /* pass */
        s->passed_seats[s->passed_count++] = p;
        if (!s->bidding_awaiting_answer) {
          /* MH passt sofort -> HH sagt an VH */
          s->bidding_stage = STAGE_HH_WINNER;
          s->bidding_speaker = hh;
          s->bidding_listener = vh;
          s->bidding_awaiting_answer = 0;
        } else {
          /* VH passt als Hörer auf Gebot von MH -> HH sagt an MH */
          s->bidding_stage = STAGE_HH_WINNER;
          s->bidding_speaker = hh;
          s->bidding_listener = mh;
          s->bidding_awaiting_answer = 0;
        }
        return KLANG_KLICK;
      }
      if (typ == 0) { /* bid */
        u16 val = zug->b[1] | ((u16)zug->b[2] << 8);
        s->current_bid_value = val;
        s->highest_bid = val;
        s->bidding_speaker = s->bidding_listener;
        s->bidding_awaiting_answer = 1;
        return KLANG_SETZEN;
      }
      if (typ == 1) { /* hold */
        s->bidding_speaker = mh;
        s->bidding_awaiting_answer = 0;
        return KLANG_KLICK;
      }
    }

    if (s->bidding_stage == STAGE_HH_WINNER) {
      if (typ == 2) { /* pass */
        s->passed_seats[s->passed_count++] = p;
        u8 winner = s->bidding_awaiting_answer ? hh : s->bidding_listener;

        if (s->passed_count >= 3 || (s->passed_count >= 2 && s->highest_bid == 0)) {
          s->phase = PHASE_PASSED_OUT;
          return KLANG_ENDE;
        }

        s->phase = PHASE_SKAT_DECISION;
        s->declarer_seat = winner;
        if (s->highest_bid < 18) s->highest_bid = 18;
        memcpy(s->decl_all_cards, s->hands[winner], 10);
        s->decl_all_cards[10] = s->skat[0];
        s->decl_all_cards[11] = s->skat[1];
        s->bidding_stage = STAGE_DONE;
        return KLANG_KLICK;
      }
      if (typ == 0) { /* bid */
        u16 val = zug->b[1] | ((u16)zug->b[2] << 8);
        s->current_bid_value = val;
        s->highest_bid = val;
        s->bidding_speaker = s->bidding_listener;
        s->bidding_awaiting_answer = 1;
        return KLANG_SETZEN;
      }
      if (typ == 1) { /* hold */
        s->bidding_speaker = hh;
        s->bidding_awaiting_answer = 0;
        return KLANG_KLICK;
      }
    }
  }

  if (s->phase == PHASE_SKAT_DECISION) {
    if (typ == 3) { /* takeSkat */
      u8 decl = s->declarer_seat;
      s->hands[decl][s->hand_n[decl]++] = s->skat[0];
      s->hands[decl][s->hand_n[decl]++] = s->skat[1];
      s->phase = PHASE_DISCARD;
      return KLANG_KARTE;
    }
    if (typ == 4) { /* playHand */
      s->phase = PHASE_DECLARE;
      return KLANG_KLICK;
    }
  }

  if (s->phase == PHASE_DISCARD) {
    if (typ == 5) {
      u8 decl = s->declarer_seat;
      u8 c1 = zug->b[1];
      u8 c2 = zug->b[2];
      u8 new_hand[12];
      u8 new_n = 0;
      u8 i;
      for (i = 0; i < s->hand_n[decl]; i++) {
        u8 c = s->hands[decl][i];
        if (c != c1 && c != c2) {
          new_hand[new_n++] = c;
        }
      }
      memcpy(s->hands[decl], new_hand, new_n);
      s->hand_n[decl] = new_n;
      s->skat[0] = c1; s->skat[1] = c2;
      s->discarded[0] = c1; s->discarded[1] = c2;
      s->discarded_n = 2;
      s->phase = PHASE_DECLARE;
      return KLANG_KARTE;
    }
  }

  if (s->phase == PHASE_DECLARE) {
    if (typ == 6) {
      s->has_declaration = 1;
      s->game_type = zug->b[1];
      u8 flags = zug->b[2];
      s->decl_hand = (flags & 1) ? 1 : 0;
      s->decl_schneider = (flags & 2) ? 1 : 0;
      s->decl_schwarz = (flags & 4) ? 1 : 0;
      s->decl_ouvert = (flags & 8) ? 1 : 0;
      s->phase = PHASE_PLAY;
      s->leader_seat = s->active_seats[0];
      return KLANG_SETZEN;
    }
  }

  if (s->phase == PHASE_PLAY) {
    if (typ == 7) {
      u8 p = skat_am_zug(stand);
      u8 card = zug->b[1];
      u8 i;

      /* Karte aus Hand entfernen (Reihenfolge beibehalten wie TS filter) */
      for (i = 0; i < s->hand_n[p]; i++) {
        if (s->hands[p][i] == card) {
          u8 j;
          for (j = i; j < s->hand_n[p] - 1; j++) {
            s->hands[p][j] = s->hands[p][j + 1];
          }
          s->hand_n[p]--;
          break;
        }
      }

      s->current_trick[s->trick_n].spieler = p;
      s->current_trick[s->trick_n].karte = card;
      s->trick_n++;

      if (s->trick_n < 3) {
        return KLANG_KARTE;
      }

      /* Stich auswerten */
      StichVertrag v = skat_vertrag(s);
      u8 win_idx = stich_gewinner(s->current_trick, 3, &v);
      u8 winner = s->current_trick[win_idx].spieler;
      u8 points = stich_augen(s->current_trick[0].karte) +
                  stich_augen(s->current_trick[1].karte) +
                  stich_augen(s->current_trick[2].karte);

      u8 is_decl_win = (winner == s->declarer_seat);
      if (is_decl_win) {
        s->declarer_tricks_count++;
        s->declarer_eyes += points;
      } else {
        s->opponent_eyes += points;
      }

      s->trick_n = 0;

      /* Bei Nullspiel verliert Alleinspieler sofort bei erstem Stichgewinn */
      if (s->game_type == SKAT_NULL && is_decl_win) {
        skat_finish_game(s);
        return KLANG_ENDE;
      }

      /* Nach 10 Stichen ist die Runde beendet */
      if (s->hand_n[s->declarer_seat] == 0) {
        skat_finish_game(s);
        return KLANG_ENDE;
      }

      s->leader_seat = winner;
      return KLANG_KARTE;
    }
  }

  return KLANG_KLICK;
}

static u8 skat_ergebnis(const u8 *stand, u8 *sieger) {
  const SkatState *s = (const SkatState *)stand;
  if (s->game_number <= s->total_games) {
    return ERGEBNIS_LAEUFT;
  }
  if (s->phase == PHASE_PASSED_OUT) {
    *sieger = 0;
    return ERGEBNIS_REMIS;
  }

  /* Bei Serienende: Höchster Score gewinnt */
  s16 max_score = -30000;
  u8 i;
  for (i = 0; i < s->table_players; i++) {
    if (s->scores[i] > max_score) {
      max_score = s->scores[i];
    }
  }
  u8 count = 0;
  u8 best_p = 0;
  for (i = 0; i < s->table_players; i++) {
    if (s->scores[i] == max_score) {
      count++;
      best_p = i;
    }
  }
  if (count == 1) {
    *sieger = (1 << best_p);
    return ERGEBNIS_SIEG;
  }
  *sieger = 0;
  return ERGEBNIS_REMIS;
}

static void skat_bot_zug(const u8 *stand, u8 stufe, Zufall *z, Zug *zug) {
  u16 n = skat_zuege(stand, zugliste);
  if (n == 0) return;

  if (stufe == STUFE_LEICHT || n == 1) {
    *zug = zugliste[zufall_bis(z, n)];
    return;
  }

  const SkatState *s = (const SkatState *)stand;
  u8 p = skat_am_zug(stand);

  if (s->phase == PHASE_BIDDING) {
    /* Konservativ reizen: maximal 18 bieten / halten, sonst passen */
    u16 i;
    for (i = 0; i < n; i++) {
      if (zugliste[i].b[0] == 2) { /* Pass */
        if (s->current_bid_value >= 18) {
          *zug = zugliste[i];
          return;
        }
      }
    }
    /* 18 bieten wenn möglich */
    for (i = 0; i < n; i++) {
      if (zugliste[i].b[0] == 0) {
        u16 val = zugliste[i].b[1] | ((u16)zugliste[i].b[2] << 8);
        if (val == 18) {
          *zug = zugliste[i];
          return;
        }
      }
      if (zugliste[i].b[0] == 1) { /* Hold 18 */
        if (s->current_bid_value <= 18) {
          *zug = zugliste[i];
          return;
        }
      }
    }
    *zug = zugliste[0];
    return;
  }

  if (s->phase == PHASE_SKAT_DECISION) {
    *zug = zugliste[0]; /* takeSkat */
    return;
  }

  if (s->phase == PHASE_DISCARD) {
    u16 best_idx = 0;
    u8 min_eyes = 255;
    u16 i;
    for (i = 0; i < n; i++) {
      u8 e1 = stich_augen(zugliste[i].b[1]);
      u8 e2 = stich_augen(zugliste[i].b[2]);
      if (e1 + e2 < min_eyes) {
        min_eyes = e1 + e2;
        best_idx = i;
      }
    }
    *zug = zugliste[best_idx];
    return;
  }

  if (s->phase == PHASE_DECLARE) {
    u8 suit_counts[4];
    memset(suit_counts, 0, 4);
    u8 i;
    for (i = 0; i < s->hand_n[p]; i++) {
      u8 c = s->hands[p][i];
      suit_counts[(c % 52) / 13]++;
    }
    u8 best_g = SKAT_FARBE_C;
    u8 max_c = suit_counts[FARBE_C];
    if (suit_counts[FARBE_S] > max_c) { max_c = suit_counts[FARBE_S]; best_g = SKAT_FARBE_S; }
    if (suit_counts[FARBE_H] > max_c) { max_c = suit_counts[FARBE_H]; best_g = SKAT_FARBE_H; }
    if (suit_counts[FARBE_D] > max_c) { max_c = suit_counts[FARBE_D]; best_g = SKAT_FARBE_D; }

    for (i = 0; i < n; i++) {
      if (zugliste[i].b[1] == best_g) {
        *zug = zugliste[i];
        return;
      }
    }
    *zug = zugliste[0];
    return;
  }

  if (s->phase == PHASE_PLAY) {
    StichVertrag v = skat_vertrag(s);
    if (s->trick_n == 0) {
      u16 i;
      for (i = 0; i < n; i++) {
        u8 c = zugliste[i].b[1];
        if (stich_ist_trumpf(c, &v) || stich_augen(c) == 11) {
          *zug = zugliste[i];
          return;
        }
      }
      *zug = zugliste[0];
      return;
    }

    u16 i;
    u16 win_move = 0xffff;
    u16 low_move = 0;
    u8 min_pts = 255;
    StichKarte sim[3];
    memcpy(sim, s->current_trick, sizeof(StichKarte) * s->trick_n);

    for (i = 0; i < n; i++) {
      u8 c = zugliste[i].b[1];
      sim[s->trick_n].spieler = p;
      sim[s->trick_n].karte = c;
      u8 w = stich_gewinner(sim, s->trick_n + 1, &v);
      if (sim[w].spieler == p) {
        win_move = i;
      }
      u8 pts = stich_augen(c);
      if (pts < min_pts) {
        min_pts = pts;
        low_move = i;
      }
    }

    if (win_move != 0xffff) {
      *zug = zugliste[win_move];
    } else {
      *zug = zugliste[low_move];
    }
    return;
  }

  *zug = zugliste[0];
}

static u16 skat_ausgeben(const u8 *stand, u8 *puffer) {
  const SkatState *s = (const SkatState *)stand;
  u16 p = 0;
  u8 i, seat;

  puffer[p++] = s->table_players;
  puffer[p++] = s->total_games;
  puffer[p++] = s->game_number;
  puffer[p++] = s->dealer_seat;
  puffer[p++] = s->phase;
  puffer[p++] = s->declarer_seat;
  puffer[p++] = s->highest_bid & 0xff;
  puffer[p++] = (s->highest_bid >> 8) & 0xff;
  puffer[p++] = s->current_bid_value & 0xff;
  puffer[p++] = (s->current_bid_value >> 8) & 0xff;
  puffer[p++] = s->bidding_stage;
  puffer[p++] = s->bidding_speaker;
  puffer[p++] = s->bidding_listener;
  puffer[p++] = s->bidding_awaiting_answer;
  puffer[p++] = s->passed_count;

  for (i = 0; i < 3; i++) puffer[p++] = s->active_seats[i];
  puffer[p++] = s->skat_n;
  for (i = 0; i < s->skat_n; i++) puffer[p++] = s->skat[i];
  puffer[p++] = s->discarded_n;
  for (i = 0; i < s->discarded_n; i++) puffer[p++] = s->discarded[i];

  for (seat = 0; seat < s->table_players; seat++) {
    puffer[p++] = s->hand_n[seat];
    for (i = 0; i < s->hand_n[seat]; i++) puffer[p++] = s->hands[seat][i];
  }

  puffer[p++] = s->has_declaration;
  puffer[p++] = s->game_type;
  puffer[p++] = s->decl_hand | (s->decl_schneider << 1) | (s->decl_schwarz << 2) | (s->decl_ouvert << 3);
  puffer[p++] = s->leader_seat;
  puffer[p++] = s->trick_n;
  for (i = 0; i < s->trick_n; i++) {
    puffer[p++] = s->current_trick[i].spieler;
    puffer[p++] = s->current_trick[i].karte;
  }

  puffer[p++] = s->declarer_tricks_count;
  puffer[p++] = s->declarer_eyes;
  puffer[p++] = s->opponent_eyes;

  for (i = 0; i < 4; i++) {
    puffer[p++] = s->rng.s[i] & 0xff;
    puffer[p++] = (s->rng.s[i] >> 8) & 0xff;
    puffer[p++] = (s->rng.s[i] >> 16) & 0xff;
    puffer[p++] = (s->rng.s[i] >> 24) & 0xff;
  }

  return p;
}

static void skat_gitter(const u8 *stand, u8 *b, u8 *h) {
  *b = 10;
  *h = 1;
}

static u8 skat_feld_an(const u8 *stand, u8 x, u8 y) {
  return x;
}

static u8 skat_felder(const u8 *stand, const Zug *zug, u8 *f) {
  f[0] = zug->b[1];
  return 1;
}

static void skat_zeichnen(const u8 *stand, const u8 *markierung, u8 aktiv) {
  const SkatState *s = (const SkatState *)stand;
  u8 p = skat_am_zug(stand);
  karten_farben_laden();
  flaeche_leeren(0, 0, 32, 28);

  text(2, 1, "Skat", PAL_TEXT);
  char buf[32];
  sprintf(buf, "Runde %d/%d", s->game_number, s->total_games);
  text(20, 1, buf, PAL_TEXT);

  if (s->phase == PHASE_BIDDING) {
    text(2, 4, "Reizen:", PAL_TEXT);
    sprintf(buf, "Gebot: %d", s->highest_bid);
    text(2, 6, buf, PAL_TEXT);
  } else if (s->phase == PHASE_PLAY) {
    sprintf(buf, "Augen: %d / %d", s->declarer_eyes, s->opponent_eyes);
    text(2, 4, buf, PAL_TEXT);

    /* Ausgespielte Karten in der Mitte */
    u8 i;
    for (i = 0; i < s->trick_n; i++) {
      u8 c = s->current_trick[i].karte;
      karten_franzoesisch(10 + i * 4, 10, (c % 52) / 13, ((c % 52) % 13) + 1, 1, PAL_BRETT);
    }
  }

  /* Handkarten des aktiven Spielers */
  if (p != PLATZ_KEIN) {
    u8 i;
    u8 hn = s->hand_n[p];
    for (i = 0; i < hn && i < 10; i++) {
      u8 c = s->hands[p][i];
      karten_franzoesisch(2 + i * 3, 20, (c % 52) / 13, ((c % 52) % 13) + 1, 1, PAL_BRETT);
    }
  }
}

const Spiel spiel_skat = {
  "Skat",
  (const char *const[]){
    "Skat für 3 Spieler nach den Regeln der",
    "Internationalen Skatordnung (ISkO).",
    "",
    "Reizen, Skataufnahme oder Handspiel,",
    "Farbspiele, Grand und Null.",
    0
  },
  "A Karte / Ansage",
  (const char *const[]){"Vorhand", "Mittelhand", "Hinterhand", "Vierter"},
  (const u8[]){PAL_ROT, PAL_BLAU, PAL_GELB, PAL_GRAU},
  3, 4,
  1, /* verdeckte Hand */
  (const Option[]){
    {"Runden", (const char *const[]){"3 Spiele", "6 Spiele", "12 Spiele"}, 3, 2},
  },
  1,
  FARBEN_KARTEN,
  skat_setup,
  skat_am_zug,
  skat_zuege,
  skat_ziehen,
  skat_ergebnis,
  skat_bot_zug,
  skat_ausgeben,
  skat_gitter,
  skat_feld_an,
  skat_felder,
  skat_zeichnen,
  0, 0, 0, 0
};
