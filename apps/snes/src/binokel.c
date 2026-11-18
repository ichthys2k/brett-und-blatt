/*
 * Binokel für Brett & Blatt 16 (Stufe 5) nach packages/games/binokel/src/rules.ts.
 * 3 oder 4 Spieler (am 4er-Tisch setzt der Geber aus).
 * 40 oder 48 Karten (doppeltes Blatt), Dabb (Drücken), Reizen, Melden,
 * Stechen mit Farb-, Überstich-, Trumpf- und Übertrumpfzwang.
 */
#include <string.h>
#include <stdio.h>
#include "spiel.h"
#include "bild.h"
#include "klang.h"
#include "karten.h"
#include "stich.h"
#include "res/grafik.h"

#define KEIN 0xff

enum {
  PHASE_BINOKEL_BIDDING,
  PHASE_BINOKEL_DISCARD,
  PHASE_BINOKEL_DECLARE,
  PHASE_BINOKEL_PLAY,
  PHASE_BINOKEL_ROUND_OVER,
  PHASE_BINOKEL_FINISHED
};

enum {
  KIND_NORMAL,
  KIND_DURCH,
  KIND_FOLD,
  KIND_PASSED_OUT
};

static const u8 BINOKEL_DECK_40[40] = {
  /* C: A, 10, K, O, U */
  0, 52, 9, 61, 12, 64, 11, 63, 10, 62,
  /* S: A, 10, K, O, U */
  13, 65, 22, 74, 25, 77, 24, 76, 23, 75,
  /* H: A, 10, K, O, U */
  26, 78, 35, 87, 38, 90, 37, 89, 36, 88,
  /* D: A, 10, K, O, U */
  39, 91, 48, 100, 51, 103, 50, 102, 49, 101
};

typedef struct {
  u8 seats;
  u8 total_games;
  u8 game_number;
  u8 dealer;
  u8 active_seats[3];

  u8 deck_size; /* 40 */
  u16 min_bid;
  u16 target_score;

  u8 phase;
  u8 hand_n[PLAETZE_MAX];
  u8 hands[PLAETZE_MAX][16];

  u8 dabb_n;
  u8 dabb[4];
  u8 pressed_n;
  u8 pressed[4];

  u16 bid;
  u8 bidder;
  u8 passed[PLAETZE_MAX];
  u8 speaker;
  u8 declarer;

  u8 trump; /* 0..3 oder KEIN */
  u8 durch;

  u16 melds[PLAETZE_MAX];
  u16 eyes[PLAETZE_MAX];
  u8 made_trick[PLAETZE_MAX];

  u8 leader;
  u8 trick_n;
  StichKarte current_trick[3];

  s16 scores[PLAETZE_MAX];
  Zufall rng;
} BinokelState;

static u16 binokel_melde_punkte(const u8 *hand, u8 hand_n, u8 trump) {
  u8 count[4][14];
  memset(count, 0, sizeof(count));
  u8 i;
  for (i = 0; i < hand_n; i++) {
    u8 c = hand[i];
    u8 f = (c % 52) / 13;
    u8 r = (c % 52) % 13 + 1;
    if (f < 4 && r <= 13) {
      count[f][r]++;
    }
  }

  u16 pts = 0;
  u8 leftover_pair[4];
  memset(leftover_pair, 0, sizeof(leftover_pair));

  /* Gruppe 1: Familien und Paare */
  u8 s;
  for (s = 0; s < 4; s++) {
    u8 is_trump = (trump != KEIN && s == trump);
    u8 fam = count[s][1];
    if (count[s][10] < fam) fam = count[s][10];
    if (count[s][13] < fam) fam = count[s][13];
    if (count[s][12] < fam) fam = count[s][12];
    if (count[s][11] < fam) fam = count[s][11];

    if (fam == 2 && is_trump) {
      pts += 1000;
    } else {
      pts += (u16)fam * (is_trump ? 150 : 100);
    }

    u8 k = count[s][13];
    u8 o = count[s][12];
    u8 min_ko = (k < o) ? k : o;
    u8 pairs = (min_ko > fam) ? (min_ko - fam) : 0;
    pts += (u16)pairs * (is_trump ? 40 : 20);
    if (pairs > 0) leftover_pair[s] = 1;
  }
  if (leftover_pair[0] && leftover_pair[1] && leftover_pair[2] && leftover_pair[3]) {
    pts += 100;
  }

  /* Gruppe 2: Gleiche Ränge */
  static const u8 RANKS[4] = {1, 13, 12, 11};
  static const u16 RANK_PTS[4] = {100, 80, 60, 40};
  u8 ri;
  for (ri = 0; ri < 4; ri++) {
    u8 r = RANKS[ri];
    u8 total = count[0][r] + count[1][r] + count[2][r] + count[3][r];
    if (total == 8) {
      pts += 1000;
    } else if (count[0][r] > 0 && count[1][r] > 0 && count[2][r] > 0 && count[3][r] > 0) {
      pts += RANK_PTS[ri];
    }
  }

  /* Gruppe 3: Binokel (S12 und D11) */
  u8 ober = count[1][12];
  u8 unter = count[3][11];
  if (ober >= 2 && unter >= 2) {
    pts += 300;
  } else if (ober >= 1 && unter >= 1) {
    pts += 40;
  }

  return pts;
}

static void binokel_finish_round(BinokelState *s, u8 kind) {
  u8 i;
  u8 decl = s->declarer;
  s16 points[PLAETZE_MAX];
  memset(points, 0, sizeof(points));

  if (kind == KIND_PASSED_OUT || decl == KEIN) {
    /* Keine Punkte */
  } else if (kind == KIND_FOLD) {
    u16 bonus = 50;
    for (i = 0; i < 3; i++) {
      u8 seat = s->active_seats[i];
      if (seat == decl) {
        points[seat] = -((s16)s->bid);
      } else {
        points[seat] = (s16)(s->melds[seat] + bonus);
      }
    }
  } else if (kind == KIND_DURCH) {
    u8 won = (s->hand_n[s->active_seats[0]] == 0 && s->eyes[decl] == (s->eyes[0] + s->eyes[1] + s->eyes[2]));
    points[decl] = won ? 1000 : -1000;
  } else {
    /* Normal */
    for (i = 0; i < 3; i++) {
      u8 seat = s->active_seats[i];
      if (seat != decl && s->made_trick[seat]) {
        points[seat] = (s16)(s->eyes[seat] + s->melds[seat]);
      }
    }
    u16 total = s->eyes[decl] + (s->made_trick[decl] ? s->melds[decl] : 0);
    if (total >= s->bid) {
      points[decl] = (s16)total;
    } else {
      points[decl] = -((s16)(2 * s->bid));
    }
  }

  u8 finished = 0;
  for (i = 0; i < 3; i++) {
    u8 seat = s->active_seats[i];
    s->scores[seat] += points[seat];
    if (kind != KIND_PASSED_OUT && s->scores[seat] >= (s16)s->target_score) {
      finished = 1;
    }
  }
  if (s->game_number >= 24) finished = 1;

  s->phase = finished ? PHASE_BINOKEL_FINISHED : PHASE_BINOKEL_ROUND_OVER;
}

static void binokel_karten_verteilen(BinokelState *s) {
  u8 deck[40];
  u8 i, p;

  memcpy(deck, BINOKEL_DECK_40, 40);

  for (i = 39; i > 0; i--) {
    u16 j = zufall_bis(&s->rng, i + 1);
    u8 t = deck[i];
    deck[i] = deck[j];
    deck[j] = t;
  }

  /* Dabb: 4 Karten */
  memcpy(s->dabb, deck, 4);
  s->dabb_n = 4;

  /* Restliche 36 Karten auf 3 aktive Spieler (je 12) */
  for (p = 0; p < 3; p++) {
    u8 seat = s->active_seats[p];
    memcpy(s->hands[seat], deck + 4 + p * 12, 12);
    s->hand_n[seat] = 12;
  }

  s->phase = PHASE_BINOKEL_BIDDING;
  s->bid = 0;
  s->bidder = KEIN;
  s->declarer = KEIN;
  memset(s->passed, 0, sizeof(s->passed));
  s->speaker = s->active_seats[0];
  s->leader = s->active_seats[0];
  s->trump = KEIN;
  s->durch = 0;
  s->pressed_n = 0;
  s->trick_n = 0;
  memset(s->melds, 0, sizeof(s->melds));
  memset(s->eyes, 0, sizeof(s->eyes));
  memset(s->made_trick, 0, sizeof(s->made_trick));
}

static void binokel_setup(u8 *stand, const u8 *opt, u8 seats, const char *seed) {
  BinokelState *s = (BinokelState *)stand;
  u8 i;

  memset(s, 0, sizeof(BinokelState));
  s->seats = seats;
  s->total_games = 12;
  s->game_number = 1;
  s->dealer = 0;
  s->deck_size = 40;
  s->min_bid = 150;
  s->target_score = 1000;

  for (i = 0; i < 3; i++) {
    s->active_seats[i] = (s->dealer + 1 + i) % s->seats;
  }

  zufall_strom(&s->rng, seed, "geben");
  binokel_karten_verteilen(s);
}

static u8 binokel_am_zug(const u8 *stand) {
  const BinokelState *s = (const BinokelState *)stand;
  if (s->phase == PHASE_BINOKEL_FINISHED) {
    return PLATZ_KEIN;
  }
  if (s->phase == PHASE_BINOKEL_ROUND_OVER) {
    return s->active_seats[0];
  }
  if (s->phase == PHASE_BINOKEL_BIDDING) {
    return s->speaker;
  }
  if (s->phase == PHASE_BINOKEL_DISCARD || s->phase == PHASE_BINOKEL_DECLARE) {
    return s->declarer;
  }
  if (s->phase == PHASE_BINOKEL_PLAY) {
    if (s->trick_n == 0) return s->leader;
    u8 last = s->current_trick[s->trick_n - 1].spieler;
    u8 i;
    for (i = 0; i < 3; i++) {
      if (s->active_seats[i] == last) return s->active_seats[(i + 1) % 3];
    }
  }
  return PLATZ_KEIN;
}

static StichVertrag binokel_vertrag(const BinokelState *s) {
  StichVertrag v;
  memset(&v, 0, sizeof(v));
  v.spieltyp = KONTRAKT_BINOKEL;
  v.trumpf_farbe = s->durch ? STICH_KEIN : s->trump;
  return v;
}

static u16 binokel_zuege(const u8 *stand, Zug *liste) {
  const BinokelState *s = (const BinokelState *)stand;
  u16 anzahl = 0;
  u8 p = binokel_am_zug(stand);
  if (p == PLATZ_KEIN) return 0;

  if (s->phase == PHASE_BINOKEL_ROUND_OVER) {
    liste[0].n = 1; liste[0].b[0] = 7; /* nextGame */
    return 1;
  }

  if (s->phase == PHASE_BINOKEL_BIDDING) {
    /* Passen */
    liste[anzahl].n = 1; liste[anzahl].b[0] = 1; anzahl++;
    /* Bieten mit Schritten [0, 10, 20, 50] */
    u16 next = (s->bid == 0) ? s->min_bid : s->bid + 10;
    static const u8 EXTRAS[4] = {0, 10, 20, 50};
    u8 e;
    for (e = 0; e < 4; e++) {
      u16 val = next + EXTRAS[e];
      if (val <= 2000) {
        liste[anzahl].n = 3;
        liste[anzahl].b[0] = 0;
        liste[anzahl].b[1] = val & 0xff;
        liste[anzahl].b[2] = (val >> 8) & 0xff;
        anzahl++;
      }
    }
    return anzahl;
  }

  if (s->phase == PHASE_BINOKEL_DISCARD) {
    /* 4 Karten drücken */
    u8 hn = s->hand_n[p];
    if (hn >= 4) {
      /* Erste Kombination als Zug anbieten */
      liste[anzahl].n = 5;
      liste[anzahl].b[0] = 2;
      liste[anzahl].b[1] = s->hands[p][hn - 4];
      liste[anzahl].b[2] = s->hands[p][hn - 3];
      liste[anzahl].b[3] = s->hands[p][hn - 2];
      liste[anzahl].b[4] = s->hands[p][hn - 1];
      anzahl++;
    }
    return anzahl;
  }

  if (s->phase == PHASE_BINOKEL_DECLARE) {
    /* Trumpf ansagen: C, S, H, D */
    u8 f;
    for (f = 0; f < 4; f++) {
      liste[anzahl].n = 2; liste[anzahl].b[0] = 3; liste[anzahl].b[1] = f; anzahl++;
    }
    /* Durch */
    liste[anzahl].n = 1; liste[anzahl].b[0] = 4; anzahl++;
    /* Abgehen */
    liste[anzahl].n = 1; liste[anzahl].b[0] = 5; anzahl++;
    return anzahl;
  }

  if (s->phase == PHASE_BINOKEL_PLAY) {
    StichVertrag v = binokel_vertrag(s);
    u8 mask[16];
    u8 hn = s->hand_n[p];
    u8 i;
    stich_erlaubte_karten(s->hands[p], hn, s->current_trick, s->trick_n, &v, mask);
    for (i = 0; i < hn; i++) {
      if (mask[i]) {
        liste[anzahl].n = 2;
        liste[anzahl].b[0] = 6; /* play */
        liste[anzahl].b[1] = s->hands[p][i];
        anzahl++;
      }
    }
    return anzahl;
  }

  return 0;
}

static u8 binokel_ziehen(u8 *stand, const Zug *zug) {
  BinokelState *s = (BinokelState *)stand;
  u8 typ = zug->b[0];

  if (typ == 7) { /* nextGame */
    s->game_number++;
    s->dealer = (s->dealer + 1) % s->seats;
    u8 i;
    for (i = 0; i < 3; i++) {
      s->active_seats[i] = (s->dealer + 1 + i) % s->seats;
    }
    binokel_karten_verteilen(s);
    return KLANG_START;
  }

  if (s->phase == PHASE_BINOKEL_BIDDING) {
    u8 p = s->speaker;
    if (typ == 1) { /* pass */
      s->passed[p] = 1;
    } else if (typ == 0) { /* bid */
      s->bid = zug->b[1] | ((u16)zug->b[2] << 8);
      s->bidder = p;
    }

    /* Prüfen wie viele noch im Reizen sind */
    u8 remaining = 0;
    u8 last_remaining = 0;
    u8 i;
    for (i = 0; i < 3; i++) {
      u8 seat = s->active_seats[i];
      if (!s->passed[seat]) {
        remaining++;
        last_remaining = seat;
      }
    }

    if (remaining == 0) {
      binokel_finish_round(s, KIND_PASSED_OUT);
      return KLANG_ENDE;
    }

    if (remaining == 1 && s->bidder != KEIN && !s->passed[s->bidder]) {
      s->declarer = s->bidder;
      /* Dabb zur Hand des Spielmachers hinzufügen */
      for (i = 0; i < s->dabb_n; i++) {
        s->hands[s->declarer][s->hand_n[s->declarer]++] = s->dabb[i];
      }
      s->phase = PHASE_BINOKEL_DISCARD;
      return KLANG_KARTE;
    }

    /* Nächster aktiver Sprecher */
    for (i = 0; i < 3; i++) {
      if (s->active_seats[i] == p) {
        u8 next_idx = (i + 1) % 3;
        while (s->passed[s->active_seats[next_idx]]) {
          next_idx = (next_idx + 1) % 3;
        }
        s->speaker = s->active_seats[next_idx];
        break;
      }
    }
    return KLANG_KLICK;
  }

  if (s->phase == PHASE_BINOKEL_DISCARD) {
    if (typ == 2) {
      u8 decl = s->declarer;
      u8 c1 = zug->b[1], c2 = zug->b[2], c3 = zug->b[3], c4 = zug->b[4];
      u8 new_hand[16];
      u8 new_n = 0;
      u8 i;
      for (i = 0; i < s->hand_n[decl]; i++) {
        u8 c = s->hands[decl][i];
        if (c != c1 && c != c2 && c != c3 && c != c4) {
          new_hand[new_n++] = c;
        }
      }
      memcpy(s->hands[decl], new_hand, new_n);
      s->hand_n[decl] = new_n;
      s->pressed[0] = c1; s->pressed[1] = c2; s->pressed[2] = c3; s->pressed[3] = c4;
      s->pressed_n = 4;
      s->phase = PHASE_BINOKEL_DECLARE;
      return KLANG_KARTE;
    }
  }

  if (s->phase == PHASE_BINOKEL_DECLARE) {
    if (typ == 3) { /* declareTrump */
      s->trump = zug->b[1];
      u8 p;
      for (p = 0; p < 3; p++) {
        u8 seat = s->active_seats[p];
        s->melds[seat] = binokel_melde_punkte(s->hands[seat], s->hand_n[seat], s->trump);
      }
      s->phase = PHASE_BINOKEL_PLAY;
      s->leader = s->active_seats[0];
      return KLANG_SETZEN;
    }
    if (typ == 4) { /* declareDurch */
      s->durch = 1;
      s->trump = KEIN;
      memset(s->melds, 0, sizeof(s->melds));
      s->phase = PHASE_BINOKEL_PLAY;
      s->leader = s->declarer;
      return KLANG_SETZEN;
    }
    if (typ == 5) { /* fold */
      u8 p;
      for (p = 0; p < 3; p++) {
        u8 seat = s->active_seats[p];
        if (seat == s->declarer) {
          s->melds[seat] = 0;
        } else {
          s->melds[seat] = binokel_melde_punkte(s->hands[seat], s->hand_n[seat], KEIN);
        }
      }
      binokel_finish_round(s, KIND_FOLD);
      return KLANG_ENDE;
    }
  }

  if (s->phase == PHASE_BINOKEL_PLAY) {
    if (typ == 6) { /* play */
      u8 p = binokel_am_zug(stand);
      u8 card = zug->b[1];
      u8 i;

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

      if (s->trick_n < 3) return KLANG_KARTE;

      StichVertrag v = binokel_vertrag(s);
      u8 win_idx = stich_gewinner(s->current_trick, 3, &v);
      u8 winner = s->current_trick[win_idx].spieler;
      u8 points = stich_augen(s->current_trick[0].karte) +
                  stich_augen(s->current_trick[1].karte) +
                  stich_augen(s->current_trick[2].karte);

      s->eyes[winner] += points;
      s->made_trick[winner] = 1;

      s->trick_n = 0;
      s->leader = winner;

      u8 done = (s->hand_n[s->active_seats[0]] == 0);
      u8 durch_lost = (s->durch && winner != s->declarer);

      if (durch_lost) {
        binokel_finish_round(s, KIND_DURCH);
        return KLANG_ENDE;
      }

      if (done) {
        if (!s->durch) {
          /* Letzter Stich: 10 Zusatzaugen */
          s->eyes[winner] += 10;
          /* Dabb-Augen zum Spielmacher */
          s->eyes[s->declarer] += stich_augen(s->pressed[0]) + stich_augen(s->pressed[1]) +
                                  stich_augen(s->pressed[2]) + stich_augen(s->pressed[3]);
        }
        binokel_finish_round(s, s->durch ? KIND_DURCH : KIND_NORMAL);
        return KLANG_ENDE;
      }

      return KLANG_KARTE;
    }
  }

  return KLANG_KLICK;
}

static u8 binokel_ergebnis(const u8 *stand, u8 *sieger) {
  const BinokelState *s = (const BinokelState *)stand;
  if (s->phase != PHASE_BINOKEL_FINISHED) {
    return ERGEBNIS_LAEUFT;
  }
  s16 max_score = -30000;
  u8 best_p = 0;
  u8 count = 0;
  u8 i;
  for (i = 0; i < s->seats; i++) {
    if (s->scores[i] > max_score) {
      max_score = s->scores[i];
      best_p = i;
      count = 1;
    } else if (s->scores[i] == max_score) {
      count++;
    }
  }
  if (count == 1) {
    *sieger = (1 << best_p);
    return ERGEBNIS_SIEG;
  }
  *sieger = 0;
  return ERGEBNIS_REMIS;
}

static void binokel_bot_zug(const u8 *stand, u8 stufe, Zufall *z, Zug *zug) {
  u16 n = binokel_zuege(stand, zugliste);
  if (n == 0) return;
  if (stufe == STUFE_LEICHT || n == 1) {
    *zug = zugliste[zufall_bis(z, n)];
    return;
  }

  const BinokelState *s = (const BinokelState *)stand;
  u8 p = binokel_am_zug(stand);

  if (s->phase == PHASE_BINOKEL_BIDDING) {
    /* Bis 250 mitbieten, sonst passen */
    u16 i;
    for (i = 0; i < n; i++) {
      if (zugliste[i].b[0] == 0) { /* bid */
        u16 val = zugliste[i].b[1] | ((u16)zugliste[i].b[2] << 8);
        if (val <= 250) {
          *zug = zugliste[i];
          return;
        }
      }
    }
    *zug = zugliste[0]; /* pass */
    return;
  }

  if (s->phase == PHASE_BINOKEL_DECLARE) {
    /* Trumpf mit bestem Meldewert wählen */
    u8 best_f = 0;
    u16 best_pts = 0;
    u8 f;
    for (f = 0; f < 4; f++) {
      u16 pts = binokel_melde_punkte(s->hands[p], s->hand_n[p], f);
      if (pts >= best_pts) {
        best_pts = pts;
        best_f = f;
      }
    }
    u16 i;
    for (i = 0; i < n; i++) {
      if (zugliste[i].b[0] == 3 && zugliste[i].b[1] == best_f) {
        *zug = zugliste[i];
        return;
      }
    }
    *zug = zugliste[0];
    return;
  }

  if (s->phase == PHASE_BINOKEL_PLAY) {
    StichVertrag v = binokel_vertrag(s);
    if (s->trick_n == 0) {
      /* Höchste Karte anspielen */
      u16 i;
      u16 best_idx = 0;
      u16 best_pwr = 0;
      for (i = 0; i < n; i++) {
        u8 c = zugliste[i].b[1];
        u16 pwr = stich_karte_staerke(c, &v);
        if (pwr > best_pwr) {
          best_pwr = pwr;
          best_idx = i;
        }
      }
      *zug = zugliste[best_idx];
      return;
    }

    /* Bedienen */
    u16 i;
    u16 win_idx = 0xffff;
    u16 low_idx = 0;
    u16 min_pwr = 1000;
    StichKarte sim[3];
    memcpy(sim, s->current_trick, sizeof(StichKarte) * s->trick_n);

    for (i = 0; i < n; i++) {
      u8 c = zugliste[i].b[1];
      sim[s->trick_n].spieler = p;
      sim[s->trick_n].karte = c;
      u8 w = stich_gewinner(sim, s->trick_n + 1, &v);
      if (sim[w].spieler == p) {
        win_idx = i;
      }
      u16 pwr = stich_karte_staerke(c, &v);
      if (pwr < min_pwr) {
        min_pwr = pwr;
        low_idx = i;
      }
    }
    if (win_idx != 0xffff) {
      *zug = zugliste[win_idx];
    } else {
      *zug = zugliste[low_idx];
    }
    return;
  }

  *zug = zugliste[0];
}

static u16 binokel_ausgeben(const u8 *stand, u8 *puffer) {
  const BinokelState *s = (const BinokelState *)stand;
  u16 p = 0;
  u8 i, seat;

  puffer[p++] = s->seats;
  puffer[p++] = s->total_games;
  puffer[p++] = s->game_number;
  puffer[p++] = s->dealer;
  puffer[p++] = s->deck_size;
  puffer[p++] = s->phase;
  puffer[p++] = s->speaker;
  puffer[p++] = s->bid & 0xff;
  puffer[p++] = (s->bid >> 8) & 0xff;
  puffer[p++] = s->bidder;
  puffer[p++] = s->declarer;
  puffer[p++] = s->trump;
  puffer[p++] = s->durch;

  puffer[p++] = s->dabb_n;
  for (i = 0; i < s->dabb_n; i++) puffer[p++] = s->dabb[i];
  puffer[p++] = s->pressed_n;
  for (i = 0; i < s->pressed_n; i++) puffer[p++] = s->pressed[i];

  for (seat = 0; seat < s->seats; seat++) {
    puffer[p++] = s->hand_n[seat];
    for (i = 0; i < s->hand_n[seat]; i++) puffer[p++] = s->hands[seat][i];
  }

  puffer[p++] = s->leader;
  puffer[p++] = s->trick_n;
  for (i = 0; i < s->trick_n; i++) {
    puffer[p++] = s->current_trick[i].spieler;
    puffer[p++] = s->current_trick[i].karte;
  }

  for (i = 0; i < 4; i++) {
    puffer[p++] = s->rng.s[i] & 0xff;
    puffer[p++] = (s->rng.s[i] >> 8) & 0xff;
    puffer[p++] = (s->rng.s[i] >> 16) & 0xff;
    puffer[p++] = (s->rng.s[i] >> 24) & 0xff;
  }

  return p;
}

static void binokel_gitter(const u8 *stand, u8 *b, u8 *h) {
  *b = 12;
  *h = 1;
}

static u8 binokel_feld_an(const u8 *stand, u8 x, u8 y) {
  return x;
}

static u8 binokel_felder(const u8 *stand, const Zug *zug, u8 *f) {
  f[0] = zug->b[1];
  return 1;
}

static void binokel_zeichnen(const u8 *stand, const u8 *markierung, u8 aktiv) {
  const BinokelState *s = (const BinokelState *)stand;
  u8 p = binokel_am_zug(stand);
  karten_farben_laden();
  flaeche_leeren(0, 0, 32, 28);

  text(2, 1, "Binokel", PAL_TEXT);
  char buf[32];
  sprintf(buf, "Runde %d/%d", s->game_number, s->total_games);
  text(20, 1, buf, PAL_TEXT);

  if (s->phase == PHASE_BINOKEL_PLAY) {
    sprintf(buf, "Augen: %d", s->eyes[s->declarer]);
    text(2, 4, buf, PAL_TEXT);

    u8 i;
    for (i = 0; i < s->trick_n; i++) {
      u8 c = s->current_trick[i].karte;
      karten_franzoesisch(10 + i * 4, 10, (c % 52) / 13, ((c % 52) % 13) + 1, 1, PAL_BRETT);
    }
  }

  if (p != PLATZ_KEIN) {
    u8 i;
    u8 hn = s->hand_n[p];
    for (i = 0; i < hn && i < 10; i++) {
      u8 c = s->hands[p][i];
      karten_franzoesisch(1 + i * 3, 20, (c % 52) / 13, ((c % 52) % 13) + 1, 1, PAL_BRETT);
    }
  }
}

const Spiel spiel_binokel = {
  "Binokel",
  (const char *const[]){
    "Schwäbisches Binokel für 3 Spieler.",
    "",
    "Reizen, Dabb drücken, Melden,",
    "Stichzwang mit Übertrumpfen.",
    0
  },
  "A Karte / Reizen",
  (const char *const[]){"Vorhand", "Mittelhand", "Hinterhand", "Vierter"},
  (const u8[]){PAL_ROT, PAL_BLAU, PAL_GELB, PAL_GRAU},
  3, 4,
  1,
  (const Option[]){
    {"Blatt", (const char *const[]){"40 Karten", "48 Karten"}, 2, 0},
  },
  1,
  FARBEN_KARTEN,
  binokel_setup,
  binokel_am_zug,
  binokel_zuege,
  binokel_ziehen,
  binokel_ergebnis,
  binokel_bot_zug,
  binokel_ausgeben,
  binokel_gitter,
  binokel_feld_an,
  binokel_felder,
  binokel_zeichnen,
  0, 0, 0, 0
};
