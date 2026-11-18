/*
 * Doppelkopf für Brett & Blatt 16 (Stufe 5) nach packages/games/doppelkopf/src/rules.ts.
 * 4 Spieler, 48 Karten (doppeltes Blatt 9, 10, B, D, K, A).
 * Normalspiel mit Kreuz-Damen-Partei, Vorbehalte/Soli (Damen, Buben, Farbsolo, Fleischlos),
 * Re- und Kontra-Partei, 2. Dulle sticht die 1.
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
  PHASE_DOKO_RESERVATIONS,
  PHASE_DOKO_CHOOSE_SOLO,
  PHASE_DOKO_PLAY,
  PHASE_DOKO_ROUND_OVER
};

enum {
  DOKO_NORMAL = 0,
  DOKO_HOCHZEIT = 1,
  DOKO_DAMENSOLO = 2,
  DOKO_BUBENSOLO = 3,
  DOKO_FARBSOLO = 4,
  DOKO_FLEISCHLOS = 5
};

static const u8 DOKO_DECK[48] = {
  /* Copy 1: C, D, H, S x (9, 10, B, D, K, A) */
  8, 9, 10, 11, 12, 0,
  21, 22, 23, 24, 25, 13,
  34, 35, 36, 37, 38, 26,
  47, 48, 49, 50, 51, 39,
  /* Copy 2: */
  60, 61, 62, 63, 64, 52,
  73, 74, 75, 76, 77, 65,
  86, 87, 88, 89, 90, 78,
  99, 100, 101, 102, 103, 91
};

typedef struct {
  u8 table_players;
  u8 total_games;
  u8 game_number;
  u8 dealer_seat;
  u8 active_seats[4];

  u8 phase;
  u8 hand_n[PLAETZE_MAX];
  u8 hands[PLAETZE_MAX][12];

  /* Vorbehalte */
  u8 reservation_turn; /* 0..3 */
  u8 reservations_n;
  u8 reservations_seat[4];

  /* Vertrag */
  u8 contract_type;
  u8 contract_trump_suit;
  u8 soloist;

  /* Teams */
  u8 re_count;
  u8 re_team[4];
  u8 hochzeit_trick_count;

  /* Stichspiel */
  u8 leader_seat;
  u8 trick_n;
  StichKarte current_trick[4];

  u8 re_eyes;
  u8 kontra_eyes;

  s16 scores[PLAETZE_MAX];
  Zufall rng;
} DokoState;

static void doko_karten_verteilen(DokoState *s) {
  u8 deck[48];
  u8 i, p;

  memcpy(deck, DOKO_DECK, 48);

  for (i = 47; i > 0; i--) {
    u16 j = zufall_bis(&s->rng, i + 1);
    u8 t = deck[i];
    deck[i] = deck[j];
    deck[j] = t;
  }

  /* 12 Karten an jeden der 4 aktiven Spieler */
  for (p = 0; p < 4; p++) {
    u8 seat = s->active_seats[p];
    memcpy(s->hands[seat], deck + p * 12, 12);
    s->hand_n[seat] = 12;
  }

  /* Re-Team ermitteln (wer Kreuz-Dame C12 = 11 oder 63 hält) */
  s->re_count = 0;
  for (p = 0; p < 4; p++) {
    u8 seat = s->active_seats[p];
    u8 j;
    for (j = 0; j < 12; j++) {
      u8 c = s->hands[seat][j] % 52;
      if (c == 11) { /* Kreuz Dame */
        s->re_team[s->re_count++] = seat;
        break;
      }
    }
  }

  s->phase = PHASE_DOKO_RESERVATIONS;
  s->reservation_turn = 0;
  s->reservations_n = 0;
  s->contract_type = DOKO_NORMAL;
  s->contract_trump_suit = FARBE_D;
  s->soloist = KEIN;
  s->leader_seat = s->active_seats[0]; /* Vorhand */
  s->trick_n = 0;
  s->re_eyes = 0;
  s->kontra_eyes = 0;
  s->hochzeit_trick_count = 0;
}

static void doko_setup(u8 *stand, const u8 *opt, u8 seats, const char *seed) {
  DokoState *s = (DokoState *)stand;
  u8 i;

  memset(s, 0, sizeof(DokoState));
  s->table_players = seats;
  s->total_games = (opt && opt[0] == 0) ? 4 : (opt && opt[0] == 1) ? 8 : 12;
  s->game_number = 1;
  s->dealer_seat = 0;

  for (i = 0; i < 4; i++) {
    s->active_seats[i] = (s->dealer_seat + 1 + i) % s->table_players;
  }

  zufall_strom(&s->rng, seed, "main");
  doko_karten_verteilen(s);
}

static u8 doko_am_zug(const u8 *stand) {
  const DokoState *s = (const DokoState *)stand;
  if (s->game_number > s->total_games) return PLATZ_KEIN;
  if (s->phase == PHASE_DOKO_ROUND_OVER) {
    return s->active_seats[0];
  }
  if (s->phase == PHASE_DOKO_RESERVATIONS) {
    return s->active_seats[s->reservation_turn];
  }
  if (s->phase == PHASE_DOKO_CHOOSE_SOLO) {
    return s->soloist;
  }
  if (s->phase == PHASE_DOKO_PLAY) {
    if (s->trick_n == 0) return s->leader_seat;
    u8 last = s->current_trick[s->trick_n - 1].spieler;
    u8 i;
    for (i = 0; i < 4; i++) {
      if (s->active_seats[i] == last) return s->active_seats[(i + 1) % 4];
    }
  }
  return PLATZ_KEIN;
}

static StichVertrag doko_vertrag(const DokoState *s) {
  StichVertrag v;
  memset(&v, 0, sizeof(v));
  v.dullen_zweite_sticht = 0;

  if (s->contract_type == DOKO_NORMAL || s->contract_type == DOKO_HOCHZEIT) {
    v.spieltyp = KONTRAKT_DOKO_NORMAL;
    v.trumpf_farbe = FARBE_D;
  } else if (s->contract_type == DOKO_DAMENSOLO) {
    v.spieltyp = KONTRAKT_DOKO_DAMENSOLO;
    v.trumpf_farbe = STICH_KEIN;
  } else if (s->contract_type == DOKO_BUBENSOLO) {
    v.spieltyp = KONTRAKT_DOKO_BUBENSOLO;
    v.trumpf_farbe = STICH_KEIN;
  } else if (s->contract_type == DOKO_FARBSOLO) {
    v.spieltyp = KONTRAKT_DOKO_FARBSOLO;
    v.trumpf_farbe = s->contract_trump_suit;
  } else if (s->contract_type == DOKO_FLEISCHLOS) {
    v.spieltyp = KONTRAKT_DOKO_FLEISCHLOS;
    v.trumpf_farbe = STICH_KEIN;
  }
  return v;
}

static u16 doko_zuege(const u8 *stand, Zug *liste) {
  const DokoState *s = (const DokoState *)stand;
  u16 anzahl = 0;
  u8 p = doko_am_zug(stand);
  if (p == PLATZ_KEIN) return 0;

  if (s->phase == PHASE_DOKO_ROUND_OVER) {
    liste[0].n = 1; liste[0].b[0] = 5; /* nextGame */
    return 1;
  }

  if (s->phase == PHASE_DOKO_RESERVATIONS) {
    liste[anzahl].n = 1; liste[anzahl].b[0] = 0; anzahl++; /* healthy */
    liste[anzahl].n = 1; liste[anzahl].b[0] = 1; anzahl++; /* reservation */
    return anzahl;
  }

  if (s->phase == PHASE_DOKO_CHOOSE_SOLO) {
    /* Hochzeit wenn beide Kreuz-Damen auf der Hand */
    u8 c_damen = 0, i;
    for (i = 0; i < s->hand_n[p]; i++) {
      if (s->hands[p][i] == 11 || s->hands[p][i] == 63) c_damen++;
    }
    if (c_damen == 2) {
      liste[anzahl].n = 3; liste[anzahl].b[0] = 2; liste[anzahl].b[1] = DOKO_HOCHZEIT; liste[anzahl].b[2] = FARBE_D; anzahl++;
    }
    liste[anzahl].n = 3; liste[anzahl].b[0] = 2; liste[anzahl].b[1] = DOKO_DAMENSOLO; liste[anzahl].b[2] = FARBE_D; anzahl++;
    liste[anzahl].n = 3; liste[anzahl].b[0] = 2; liste[anzahl].b[1] = DOKO_BUBENSOLO; liste[anzahl].b[2] = FARBE_D; anzahl++;
    liste[anzahl].n = 3; liste[anzahl].b[0] = 2; liste[anzahl].b[1] = DOKO_FLEISCHLOS; liste[anzahl].b[2] = FARBE_D; anzahl++;
    u8 f;
    for (f = 0; f < 4; f++) {
      liste[anzahl].n = 3; liste[anzahl].b[0] = 2; liste[anzahl].b[1] = DOKO_FARBSOLO; liste[anzahl].b[2] = f; anzahl++;
    }
    return anzahl;
  }

  if (s->phase == PHASE_DOKO_PLAY) {
    StichVertrag v = doko_vertrag(s);
    u8 mask[12];
    u8 hn = s->hand_n[p];
    u8 i;
    stich_erlaubte_karten(s->hands[p], hn, s->current_trick, s->trick_n, &v, mask);
    for (i = 0; i < hn; i++) {
      if (mask[i]) {
        liste[anzahl].n = 2;
        liste[anzahl].b[0] = 4; /* play */
        liste[anzahl].b[1] = s->hands[p][i];
        anzahl++;
      }
    }
    return anzahl;
  }

  return 0;
}

static u8 doko_ziehen(u8 *stand, const Zug *zug) {
  DokoState *s = (DokoState *)stand;
  u8 typ = zug->b[0];

  if (typ == 5) { /* nextGame */
    s->game_number++;
    u8 i;
    s->dealer_seat = (s->dealer_seat + 1) % s->table_players;
    for (i = 0; i < 4; i++) {
      s->active_seats[i] = (s->dealer_seat + 1 + i) % s->table_players;
    }
    doko_karten_verteilen(s);
    return KLANG_START;
  }

  if (s->phase == PHASE_DOKO_RESERVATIONS) {
    u8 p = doko_am_zug(stand);
    if (typ == 1) { /* reservation */
      s->reservations_seat[s->reservations_n++] = p;
    }
    s->reservation_turn++;
    if (s->reservation_turn >= 4) {
      if (s->reservations_n > 0) {
        s->soloist = s->reservations_seat[0];
        s->phase = PHASE_DOKO_CHOOSE_SOLO;
      } else {
        s->reservation_turn = 3;
        s->phase = PHASE_DOKO_PLAY;
      }
    }
    return KLANG_KLICK;
  }

  if (s->phase == PHASE_DOKO_CHOOSE_SOLO) {
    if (typ == 2) {
      s->contract_type = zug->b[1];
      s->contract_trump_suit = zug->b[2];
      s->re_count = 1;
      s->re_team[0] = s->soloist;
      s->phase = PHASE_DOKO_PLAY;
      return KLANG_SETZEN;
    }
  }

  if (s->phase == PHASE_DOKO_PLAY) {
    if (typ == 4) {
      u8 p = doko_am_zug(stand);
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

      if (s->trick_n < 4) {
        return KLANG_KARTE;
      }

      /* Stich auswerten */
      StichVertrag v = doko_vertrag(s);
      u8 win_idx = stich_gewinner(s->current_trick, 4, &v);
      u8 winner = s->current_trick[win_idx].spieler;
      u8 points = stich_augen(s->current_trick[0].karte) +
                  stich_augen(s->current_trick[1].karte) +
                  stich_augen(s->current_trick[2].karte) +
                  stich_augen(s->current_trick[3].karte);

      if (s->contract_type == DOKO_HOCHZEIT && s->re_count == 1) {
        s->hochzeit_trick_count++;
        if (winner != s->soloist) {
          s->re_team[s->re_count++] = winner;
        }
      }

      u8 is_re = 0;
      for (i = 0; i < s->re_count; i++) {
        if (s->re_team[i] == winner) {
          is_re = 1;
          break;
        }
      }

      if (is_re) s->re_eyes += points;
      else s->kontra_eyes += points;

      s->trick_n = 0;

      if (s->hand_n[s->active_seats[0]] == 0) {
        /* Spielende nach 12 Stichen */
        u8 re_won = (s->re_eyes > 120);
        u8 p_idx;
        for (p_idx = 0; p_idx < 4; p_idx++) {
          u8 seat = s->active_seats[p_idx];
          u8 is_seat_re = 0;
          for (i = 0; i < s->re_count; i++) {
            if (s->re_team[i] == seat) { is_seat_re = 1; break; }
          }
          if ((re_won && is_seat_re) || (!re_won && !is_seat_re)) {
            s->scores[seat] += 20;
          } else {
            s->scores[seat] -= 20;
          }
        }
        s->phase = PHASE_DOKO_ROUND_OVER;
        return KLANG_ENDE;
      }

      s->leader_seat = winner;
      return KLANG_KARTE;
    }
  }

  return KLANG_KLICK;
}

static u8 doko_ergebnis(const u8 *stand, u8 *sieger) {
  const DokoState *s = (const DokoState *)stand;
  if (s->game_number <= s->total_games) return ERGEBNIS_LAEUFT;

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

static void doko_bot_zug(const u8 *stand, u8 stufe, Zufall *z, Zug *zug) {
  u16 n = doko_zuege(stand, zugliste);
  if (n == 0) return;
  if (stufe == STUFE_LEICHT || n == 1) {
    *zug = zugliste[zufall_bis(z, n)];
    return;
  }
  *zug = zugliste[0];
}

static u16 doko_ausgeben(const u8 *stand, u8 *puffer) {
  const DokoState *s = (const DokoState *)stand;
  u16 p = 0;
  u8 i, seat;

  puffer[p++] = s->table_players;
  puffer[p++] = s->total_games;
  puffer[p++] = s->game_number;
  puffer[p++] = s->dealer_seat;
  puffer[p++] = s->phase;
  puffer[p++] = s->reservation_turn;
  puffer[p++] = s->contract_type;
  puffer[p++] = s->contract_trump_suit;
  puffer[p++] = (s->phase == PHASE_DOKO_PLAY || s->phase == PHASE_DOKO_ROUND_OVER) ? s->soloist : KEIN;

  puffer[p++] = s->re_count;
  for (i = 0; i < s->re_count; i++) puffer[p++] = s->re_team[i];

  for (seat = 0; seat < s->table_players; seat++) {
    puffer[p++] = s->hand_n[seat];
    for (i = 0; i < s->hand_n[seat]; i++) puffer[p++] = s->hands[seat][i];
  }

  puffer[p++] = s->leader_seat;
  puffer[p++] = s->trick_n;
  for (i = 0; i < s->trick_n; i++) {
    puffer[p++] = s->current_trick[i].spieler;
    puffer[p++] = s->current_trick[i].karte;
  }

  puffer[p++] = s->re_eyes;
  puffer[p++] = s->kontra_eyes;

  for (i = 0; i < 4; i++) {
    puffer[p++] = s->rng.s[i] & 0xff;
    puffer[p++] = (s->rng.s[i] >> 8) & 0xff;
    puffer[p++] = (s->rng.s[i] >> 16) & 0xff;
    puffer[p++] = (s->rng.s[i] >> 24) & 0xff;
  }

  return p;
}

static void doko_gitter(const u8 *stand, u8 *b, u8 *h) {
  *b = 12;
  *h = 1;
}

static u8 doko_feld_an(const u8 *stand, u8 x, u8 y) {
  return x;
}

static u8 doko_felder(const u8 *stand, const Zug *zug, u8 *f) {
  f[0] = zug->b[1];
  return 1;
}

static void doko_zeichnen(const u8 *stand, const u8 *markierung, u8 aktiv) {
  const DokoState *s = (const DokoState *)stand;
  u8 p = doko_am_zug(stand);
  karten_farben_laden();
  flaeche_leeren(0, 0, 32, 28);

  text(2, 1, "Doppelkopf", PAL_TEXT);
  char buf[32];
  sprintf(buf, "Runde %d/%d", s->game_number, s->total_games);
  text(20, 1, buf, PAL_TEXT);

  if (s->phase == PHASE_DOKO_PLAY) {
    sprintf(buf, "Re/Kontra: %d/%d", s->re_eyes, s->kontra_eyes);
    text(2, 4, buf, PAL_TEXT);

    u8 i;
    for (i = 0; i < s->trick_n; i++) {
      u8 c = s->current_trick[i].karte;
      karten_franzoesisch(8 + i * 4, 10, (c % 52) / 13, ((c % 52) % 13) + 1, 1, PAL_BRETT);
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

const Spiel spiel_doppelkopf = {
  "Doppelkopf",
  (const char *const[]){
    "Doppelkopf für 4 Spieler mit doppeltem Blatt.",
    "",
    "Kreuz-Damen-Partei, Vorbehalte/Soli,",
    "Re und Kontra.",
    0
  },
  "A Karte / Vorbehalt",
  (const char *const[]){"Vorhand", "Mittelhand", "Hinterhand", "Geber"},
  (const u8[]){PAL_ROT, PAL_BLAU, PAL_GELB, PAL_GRAU},
  4, 4,
  1,
  (const Option[]){
    {"Runden", (const char *const[]){"4 Spiele", "8 Spiele", "12 Spiele"}, 3, 1},
  },
  1,
  FARBEN_KARTEN,
  doko_setup,
  doko_am_zug,
  doko_zuege,
  doko_ziehen,
  doko_ergebnis,
  doko_bot_zug,
  doko_ausgeben,
  doko_gitter,
  doko_feld_an,
  doko_felder,
  doko_zeichnen,
  0, 0, 0, 0
};
