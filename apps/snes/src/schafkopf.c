/*
 * Schafkopf für Brett & Blatt 16 (Stufe 5) nach packages/games/schafkopf/src/rules.ts.
 * 4 Spieler, langes (32 Karten) oder kurzes (24 Karten) Blatt.
 * Sauspiel (Rufspiel auf Sau), Solo, Wenz, Geier, Ramsch.
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
  PHASE_SCHAFKOPF_BIDDING,
  PHASE_SCHAFKOPF_DECLARE,
  PHASE_SCHAFKOPF_DOUBLING,
  PHASE_SCHAFKOPF_PLAY,
  PHASE_SCHAFKOPF_ROUND_OVER,
  PHASE_SCHAFKOPF_PASSED_OUT
};

enum {
  SCHAFKOPF_SAUSPIEL = 0,
  SCHAFKOPF_WENZ = 1,
  SCHAFKOPF_SOLO = 2,
  SCHAFKOPF_GEIER = 3,
  SCHAFKOPF_FARBWENZ = 4,
  SCHAFKOPF_BETTEL = 5,
  SCHAFKOPF_RAMSCH = 6
};

static const u8 SCHAFKOPF_DECK_LONG[32] = {
  /* C: 7, 8, 9, 10, B, D, K, A */
  6, 7, 8, 9, 10, 11, 12, 0,
  /* D: 7, 8, 9, 10, B, D, K, A */
  19, 20, 21, 22, 23, 24, 25, 13,
  /* H: 7, 8, 9, 10, B, D, K, A */
  32, 33, 34, 35, 36, 37, 38, 26,
  /* S: 7, 8, 9, 10, B, D, K, A */
  45, 46, 47, 48, 49, 50, 51, 39
};

static const u8 SCHAFKOPF_DECK_SHORT[24] = {
  /* C: 9, 10, B, D, K, A */
  8, 9, 10, 11, 12, 0,
  /* D: 9, 10, B, D, K, A */
  21, 22, 23, 24, 25, 13,
  /* H: 9, 10, B, D, K, A */
  34, 35, 36, 37, 38, 26,
  /* S: 9, 10, B, D, K, A */
  47, 48, 49, 50, 51, 39
};

typedef struct {
  u8 player_count;
  u8 total_games;
  u8 game_number;
  u8 dealer_seat;
  u8 active_seats[4];

  u8 sheet; /* 0: lang (32), 1: kurz (24) */
  u8 cards_per_player; /* 8 oder 6 */
  u8 doubling_enabled;
  u8 if_all_pass; /* 0: redeal, 1: ramsch */

  u8 phase;
  u8 hand_n[4];
  u8 hands[4][8];

  /* Bidding */
  u8 bidding_turn; /* 0..3 */
  u8 bids_n;
  u8 bids_seat[4];
  u8 bids_type[4];

  /* Ansage */
  u8 declarer_seat;
  u8 partner_seat;
  u8 partner_revealed;
  u8 has_contract;
  u8 contract_type;
  u8 contract_called_suit; /* 0: C, 1: D, 3: S (nie H) */
  u8 contract_trump_suit;
  u8 contract_tout;

  /* Verdopplung */
  u8 multiplier;
  u8 doubler_count;
  u8 doublers[4];

  /* Spielverlauf */
  u8 leader_seat;
  u8 called_suit_played;
  u8 trick_n;
  StichKarte current_trick[4];

  u8 declarer_eyes;
  u8 opponent_eyes;

  s16 scores[4];
  u8 bidding_winner_type;
  Zufall rng;
} SchafkopfState;

static u8 schafkopf_contract_rank(u8 typ) {
  switch (typ) {
    case 0: return 1; /* sauspiel */
    case 1: return 3; /* wenz */
    case 2: return 5; /* solo */
    case 3: return 3; /* geier */
    case 4: return 4; /* farbwenz */
    case 5: return 2; /* bettel */
    case 6: return 1; /* ramsch */
    default: return 0;
  }
}

static void schafkopf_karten_verteilen(SchafkopfState *s) {
  u8 deck[32];
  u8 deck_size;
  u8 i, p;

  deck_size = s->sheet ? 24 : 32;
  if (s->sheet) {
    memcpy(deck, SCHAFKOPF_DECK_SHORT, 24);
  } else {
    memcpy(deck, SCHAFKOPF_DECK_LONG, 32);
  }

  for (i = deck_size - 1; i > 0; i--) {
    u16 j = zufall_bis(&s->rng, i + 1);
    u8 t = deck[i];
    deck[i] = deck[j];
    deck[j] = t;
  }

  for (p = 0; p < 4; p++) {
    memcpy(s->hands[p], deck + p * s->cards_per_player, s->cards_per_player);
    s->hand_n[p] = s->cards_per_player;
  }

  s->phase = PHASE_SCHAFKOPF_BIDDING;
  s->bidding_turn = 0;
  s->bids_n = 0;
  memset(s->bids_seat, 0, sizeof(s->bids_seat));
  memset(s->bids_type, 0, sizeof(s->bids_type));

  s->declarer_seat = KEIN;
  s->partner_seat = KEIN;
  s->partner_revealed = 0;
  s->has_contract = 0;
  s->contract_type = 0;
  s->contract_called_suit = 0;
  s->contract_trump_suit = FARBE_H;
  s->contract_tout = 0;
  s->bidding_winner_type = 0;
  s->called_suit_played = 0;

  s->multiplier = 1;
  s->doubler_count = 0;
  memset(s->doublers, 0, sizeof(s->doublers));

  s->leader_seat = (s->dealer_seat + 1) % 4;
  s->called_suit_played = 0;
  s->trick_n = 0;
  memset(s->current_trick, 0, sizeof(s->current_trick));
  s->declarer_eyes = 0;
  s->opponent_eyes = 0;
}

static void schafkopf_setup(u8 *stand, const u8 *opt, u8 seats, const char *seed) {
  SchafkopfState *s = (SchafkopfState *)stand;
  u8 i;

  memset(s, 0, sizeof(SchafkopfState));
  s->player_count = 4;
  s->total_games = (opt && opt[1] == 0) ? 4 : (opt && opt[1] == 1) ? 8 : 16;
  s->game_number = 1;
  s->dealer_seat = 0;
  for (i = 0; i < 4; i++) s->active_seats[i] = i;

  s->sheet = (opt && opt[0] == 1) ? 1 : 0;
  s->cards_per_player = s->sheet ? 6 : 8;

  zufall_strom(&s->rng, seed, "main");
  schafkopf_karten_verteilen(s);
}

static u8 schafkopf_am_zug(const u8 *stand) {
  const SchafkopfState *s = (const SchafkopfState *)stand;
  if (s->game_number > s->total_games) return PLATZ_KEIN;
  if (s->phase == PHASE_SCHAFKOPF_ROUND_OVER || s->phase == PHASE_SCHAFKOPF_PASSED_OUT) {
    return s->active_seats[0];
  }
  if (s->phase == PHASE_SCHAFKOPF_BIDDING) {
    return (s->dealer_seat + 1 + s->bidding_turn) % 4;
  }
  if (s->phase == PHASE_SCHAFKOPF_DECLARE) {
    return s->declarer_seat;
  }
  if (s->phase == PHASE_SCHAFKOPF_PLAY) {
    if (s->trick_n == 0) return s->leader_seat;
    u8 last = s->current_trick[s->trick_n - 1].spieler;
    return (last + 1) % 4;
  }
  return PLATZ_KEIN;
}

static StichVertrag schafkopf_vertrag(const SchafkopfState *s) {
  StichVertrag v;
  memset(&v, 0, sizeof(v));

  if (!s->has_contract || s->contract_type == SCHAFKOPF_SAUSPIEL) {
    v.spieltyp = KONTRAKT_SCHAFKOPF_SAUSPIEL;
    v.trumpf_farbe = FARBE_H;
    v.gerufen_farbe = s->contract_called_suit;
  } else if (s->contract_type == SCHAFKOPF_SOLO) {
    v.spieltyp = KONTRAKT_SCHAFKOPF_SOLO;
    v.trumpf_farbe = s->contract_trump_suit;
  } else if (s->contract_type == SCHAFKOPF_WENZ) {
    v.spieltyp = KONTRAKT_SCHAFKOPF_WENZ;
    v.trumpf_farbe = STICH_KEIN;
  } else if (s->contract_type == SCHAFKOPF_GEIER) {
    v.spieltyp = KONTRAKT_SCHAFKOPF_GEIER;
    v.trumpf_farbe = STICH_KEIN;
  } else if (s->contract_type == SCHAFKOPF_FARBWENZ) {
    v.spieltyp = KONTRAKT_SCHAFKOPF_FARBWENZ;
    v.trumpf_farbe = s->contract_trump_suit;
  } else if (s->contract_type == SCHAFKOPF_BETTEL) {
    v.spieltyp = KONTRAKT_SCHAFKOPF_BETTEL;
    v.trumpf_farbe = STICH_KEIN;
  } else if (s->contract_type == SCHAFKOPF_RAMSCH) {
    v.spieltyp = KONTRAKT_SCHAFKOPF_RAMSCH;
    v.trumpf_farbe = FARBE_H;
  }

  return v;
}

static u16 schafkopf_zuege(const u8 *stand, Zug *liste) {
  const SchafkopfState *s = (const SchafkopfState *)stand;
  u16 anzahl = 0;
  u8 p = schafkopf_am_zug(stand);
  if (p == PLATZ_KEIN) return 0;

  if (s->phase == PHASE_SCHAFKOPF_ROUND_OVER || s->phase == PHASE_SCHAFKOPF_PASSED_OUT) {
    liste[0].n = 1; liste[0].b[0] = 6; /* nextGame */
    return 1;
  }

  if (s->phase == PHASE_SCHAFKOPF_BIDDING) {
    /* Passen (0) */
    liste[anzahl].n = 1; liste[anzahl].b[0] = 0; anzahl++;
    /* Spiele ansagen (1, typ) - Standard: Sauspiel (0), Wenz (1), Solo (2) */
    u8 t;
    for (t = 0; t <= 2; t++) {
      liste[anzahl].n = 2; liste[anzahl].b[0] = 1; liste[anzahl].b[1] = t; anzahl++;
    }
    return anzahl;
  }

  if (s->phase == PHASE_SCHAFKOPF_DECLARE) {
    if (s->bidding_winner_type == SCHAFKOPF_SAUSPIEL) {
      /* Rufbare Säue: C(0), S(3), D(1) (Reihenfolge in TS: C, S, D).
       * Regel: Spieler muss mindestens eine Karte dieser Farbe haben, darf die Sau aber nicht selbst haben!
       */
      u8 suits[3] = {FARBE_C, FARBE_S, FARBE_D};
      u8 si;
      u8 hn = s->hand_n[p];
      for (si = 0; si < 3; si++) {
        u8 suit = suits[si];
        u8 sau_karte = suit * 13; /* Ass */
        u8 has_sau = 0;
        u8 has_other = 0;
        u8 i;
        for (i = 0; i < hn; i++) {
          u8 c = s->hands[p][i];
          if ((c % 52) / 13 == suit) {
            if (c == sau_karte) has_sau = 1;
            else has_other = 1;
          }
        }
        if (!has_sau && has_other) {
          liste[anzahl].n = 5; liste[anzahl].b[0] = 2; liste[anzahl].b[1] = SCHAFKOPF_SAUSPIEL;
          liste[anzahl].b[2] = suit; liste[anzahl].b[3] = FARBE_H; liste[anzahl].b[4] = 0;
          anzahl++;
        }
      }
      if (anzahl == 0) {
        /* Fallback: Solo in allen 4 Farben */
        u8 f;
        for (f = 0; f < 4; f++) {
          liste[anzahl].n = 5; liste[anzahl].b[0] = 2; liste[anzahl].b[1] = SCHAFKOPF_SOLO;
          liste[anzahl].b[2] = 0; liste[anzahl].b[3] = f; liste[anzahl].b[4] = 0;
          anzahl++;
        }
      }
      return anzahl;
    } else if (s->bidding_winner_type == SCHAFKOPF_WENZ) {
      liste[anzahl].n = 5; liste[anzahl].b[0] = 2; liste[anzahl].b[1] = SCHAFKOPF_WENZ;
      liste[anzahl].b[2] = 0; liste[anzahl].b[3] = FARBE_H; liste[anzahl].b[4] = 0;
      anzahl++;
      liste[anzahl].n = 5; liste[anzahl].b[0] = 2; liste[anzahl].b[1] = SCHAFKOPF_WENZ;
      liste[anzahl].b[2] = 0; liste[anzahl].b[3] = FARBE_H; liste[anzahl].b[4] = 1;
      anzahl++;
      return anzahl;
    } else {
      /* Solo */
      u8 f, tout;
      for (f = 0; f < 4; f++) {
        for (tout = 0; tout <= 1; tout++) {
          liste[anzahl].n = 5; liste[anzahl].b[0] = 2; liste[anzahl].b[1] = SCHAFKOPF_SOLO;
          liste[anzahl].b[2] = 0; liste[anzahl].b[3] = f; liste[anzahl].b[4] = tout;
          anzahl++;
        }
      }
      return anzahl;
    }
  }

  if (s->phase == PHASE_SCHAFKOPF_PLAY) {
    StichVertrag v = schafkopf_vertrag(s);
    u8 mask[8];
    u8 hn = s->hand_n[p];
    u8 i;
    stich_erlaubte_karten(s->hands[p], hn, s->current_trick, s->trick_n, &v, mask);

    u8 is_partner = (s->contract_type == SCHAFKOPF_SAUSPIEL && s->partner_seat == p);
    u8 sau_karte = s->contract_called_suit * 13; /* Ass */

    u8 has_sau = 0;
    u8 cards_of_called_suit = 0;
    if (is_partner) {
      for (i = 0; i < hn; i++) {
        if (s->hands[p][i] == sau_karte) has_sau = 1;
        if (stich_effektive_farbe(s->hands[p][i], &v) == s->contract_called_suit) {
          cards_of_called_suit++;
        }
      }
    }

    for (i = 0; i < hn; i++) {
      if (mask[i]) {
        u8 c = s->hands[p][i];
        if (is_partner) {
          /* Schmierverbot: Die Rufsau darf nicht abgeworfen werden, solange die Ruffarbe noch nicht angespielt wurde */
          if (!s->called_suit_played && c == sau_karte && s->trick_n > 0) {
            u8 lead_suit = stich_effektive_farbe(s->current_trick[0].karte, &v);
            if (lead_suit != s->contract_called_suit) {
              continue;
            }
          }
          /* Rufsau-Pflicht bei Anspiel der Ruffarbe */
          if (s->trick_n > 0) {
            u8 lead_suit = stich_effektive_farbe(s->current_trick[0].karte, &v);
            if (lead_suit == s->contract_called_suit && has_sau) {
              u8 min_run = s->sheet ? 3 : 4;
              if (!s->called_suit_played && cards_of_called_suit >= min_run) {
                /* Davonlaufen erlaubt: beliebige Karte der Farbe */
              } else {
                /* Sonst MUSS die Rufsau fallen */
                if (c != sau_karte) {
                  continue;
                }
              }
            }
          }
        }
        liste[anzahl].n = 2;
        liste[anzahl].b[0] = 5; /* play */
        liste[anzahl].b[1] = c;
        anzahl++;
      }
    }
    if (anzahl == 0) {
      for (i = 0; i < hn; i++) {
        if (mask[i]) {
          liste[anzahl].n = 2;
          liste[anzahl].b[0] = 5; /* play */
          liste[anzahl].b[1] = s->hands[p][i];
          anzahl++;
        }
      }
    }
    return anzahl;
  }

  return 0;
}

static void schafkopf_finish_game(SchafkopfState *s) {
  u8 decl = s->declarer_seat;
  u8 part = s->partner_seat;
  u8 is_sauspiel = (s->contract_type == SCHAFKOPF_SAUSPIEL);
  u8 won = 0;

  if (s->contract_tout) {
    won = (s->hand_n[0] == 0 && s->opponent_eyes == 0);
  } else {
    won = (s->declarer_eyes >= 61);
  }

  u16 base_val = is_sauspiel ? 10 : 50;
  u8 schneider = (!s->contract_tout && (s->opponent_eyes <= 30 || s->declarer_eyes <= 30)) ? 10 : 0;
  u16 game_pts = (base_val + schneider) * (s->contract_tout ? 2 : 1) * s->multiplier;

  if (is_sauspiel) {
    u8 p;
    for (p = 0; p < 4; p++) {
      if (p == decl || p == part) {
        s->scores[p] += won ? (s16)game_pts : -((s16)game_pts);
      } else {
        s->scores[p] += won ? -((s16)game_pts) : (s16)game_pts;
      }
    }
  } else {
    u8 p;
    for (p = 0; p < 4; p++) {
      if (p == decl) {
        s->scores[p] += won ? (s16)(3 * game_pts) : -((s16)(3 * game_pts));
      } else {
        s->scores[p] += won ? -((s16)game_pts) : (s16)game_pts;
      }
    }
  }
  s->partner_revealed = 1;
  s->phase = PHASE_SCHAFKOPF_ROUND_OVER;
}

static u8 schafkopf_ziehen(u8 *stand, const Zug *zug) {
  SchafkopfState *s = (SchafkopfState *)stand;
  u8 typ = zug->b[0];

  if (typ == 6) { /* nextGame */
    s->game_number++;
    s->dealer_seat = (s->dealer_seat + 1) % 4;
    schafkopf_karten_verteilen(s);
    return KLANG_START;
  }

  if (s->phase == PHASE_SCHAFKOPF_BIDDING) {
    u8 p = schafkopf_am_zug(stand);
    if (typ == 1) {
      s->bids_seat[s->bids_n] = p;
      s->bids_type[s->bids_n] = zug->b[1];
      s->bids_n++;
    }
    s->bidding_turn++;
    if (s->bidding_turn >= 4) {
      /* Bieten beendet */
      if (s->bids_n == 0) {
        if (s->if_all_pass) {
          /* Ramsch */
          s->phase = PHASE_SCHAFKOPF_PLAY;
          s->has_contract = 1;
          s->contract_type = SCHAFKOPF_RAMSCH;
          s->leader_seat = (s->dealer_seat + 1) % 4;
        } else {
          s->phase = PHASE_SCHAFKOPF_PASSED_OUT;
        }
        return KLANG_ENDE;
      }
      /* Höchstes Gebot ermitteln: Wenn mehrere gleich hoch, gewinnt das frühere Gebot */
      u8 best_seat = s->bids_seat[0];
      u8 best_type = s->bids_type[0];
      u8 best_rank = schafkopf_contract_rank(best_type);
      u8 i;
      for (i = 1; i < s->bids_n; i++) {
        u8 r = schafkopf_contract_rank(s->bids_type[i]);
        if (r > best_rank) {
          best_rank = r;
          best_type = s->bids_type[i];
          best_seat = s->bids_seat[i];
        }
      }
      s->declarer_seat = best_seat;
      s->bidding_winner_type = best_type;
      s->phase = PHASE_SCHAFKOPF_DECLARE;
    }
    return KLANG_KLICK;
  }

  if (s->phase == PHASE_SCHAFKOPF_DECLARE) {
    if (typ == 2) {
      s->has_contract = 1;
      s->contract_type = zug->b[1];
      s->contract_called_suit = zug->b[2];
      s->contract_trump_suit = zug->b[3];
      s->contract_tout = zug->b[4];

      if (s->contract_type == SCHAFKOPF_SAUSPIEL) {
        /* Partner ermitteln (wer hat das Ass der Ruffarbe?) */
        u8 target_sau = s->contract_called_suit * 13;
        u8 p, i;
        for (p = 0; p < 4; p++) {
          for (i = 0; i < s->hand_n[p]; i++) {
            if (s->hands[p][i] == target_sau) {
              s->partner_seat = p;
              break;
            }
          }
        }
      }

      s->phase = PHASE_SCHAFKOPF_PLAY;
      s->leader_seat = (s->dealer_seat + 1) % 4;
      return KLANG_SETZEN;
    }
  }

  if (s->phase == PHASE_SCHAFKOPF_PLAY) {
    if (typ == 5) {
      u8 p = schafkopf_am_zug(stand);
      u8 card = zug->b[1];
      u8 i;

      /* Karte entfernen mit Verschiebung (Reihenfolge bewahren wie TS) */
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

      /* Partner aufgedeckt wenn Rufsau gespielt */
      if (s->contract_type == SCHAFKOPF_SAUSPIEL) {
        if (card == s->contract_called_suit * 13) {
          s->partner_revealed = 1;
        }
        StichVertrag v = schafkopf_vertrag(s);
        if (s->trick_n == 1 && stich_effektive_farbe(card, &v) == s->contract_called_suit) {
          s->called_suit_played = 1;
        }
      }

      if (s->trick_n < 4) {
        return KLANG_KARTE;
      }

      /* Stich auswerten */
      StichVertrag v = schafkopf_vertrag(s);
      u8 win_idx = stich_gewinner(s->current_trick, 4, &v);
      u8 winner = s->current_trick[win_idx].spieler;
      u8 points = stich_augen(s->current_trick[0].karte) +
                  stich_augen(s->current_trick[1].karte) +
                  stich_augen(s->current_trick[2].karte) +
                  stich_augen(s->current_trick[3].karte);

      u8 is_decl_party = (winner == s->declarer_seat || (s->contract_type == SCHAFKOPF_SAUSPIEL && winner == s->partner_seat));
      if (is_decl_party) {
        s->declarer_eyes += points;
      } else {
        s->opponent_eyes += points;
      }

      s->trick_n = 0;
      u8 decided = (s->contract_tout && winner != s->declarer_seat);

      if (s->hand_n[0] == 0 || decided) {
        schafkopf_finish_game(s);
        return KLANG_ENDE;
      }

      s->leader_seat = winner;
      return KLANG_KARTE;
    }
  }

  return KLANG_KLICK;
}

static u8 schafkopf_ergebnis(const u8 *stand, u8 *sieger) {
  const SchafkopfState *s = (const SchafkopfState *)stand;
  if (s->game_number <= s->total_games) {
    return ERGEBNIS_LAEUFT;
  }
  if (s->phase == PHASE_SCHAFKOPF_PASSED_OUT) {
    *sieger = 0;
    return ERGEBNIS_REMIS;
  }

  s16 max_score = -30000;
  u8 i;
  for (i = 0; i < 4; i++) {
    if (s->scores[i] > max_score) {
      max_score = s->scores[i];
    }
  }
  u8 count = 0;
  u8 best_p = 0;
  for (i = 0; i < 4; i++) {
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

static void schafkopf_bot_zug(const u8 *stand, u8 stufe, Zufall *z, Zug *zug) {
  u16 n = schafkopf_zuege(stand, zugliste);
  if (n == 0) return;
  if (stufe == STUFE_LEICHT || n == 1) {
    *zug = zugliste[zufall_bis(z, n)];
    return;
  }

  const SchafkopfState *s = (const SchafkopfState *)stand;
  u8 p = schafkopf_am_zug(stand);

  if (s->phase == PHASE_SCHAFKOPF_PLAY) {
    StichVertrag v = schafkopf_vertrag(s);
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
    StichKarte sim[4];
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

static u16 schafkopf_ausgeben(const u8 *stand, u8 *puffer) {
  const SchafkopfState *s = (const SchafkopfState *)stand;
  u16 p = 0;
  u8 i, seat;

  puffer[p++] = s->player_count;
  puffer[p++] = s->total_games;
  puffer[p++] = s->game_number;
  puffer[p++] = s->dealer_seat;
  puffer[p++] = s->sheet;
  puffer[p++] = s->phase;
  puffer[p++] = s->bidding_turn;
  puffer[p++] = s->declarer_seat;
  puffer[p++] = s->partner_seat;
  puffer[p++] = s->partner_revealed;
  puffer[p++] = s->has_contract;
  puffer[p++] = s->contract_type;
  puffer[p++] = s->contract_called_suit;
  puffer[p++] = s->contract_trump_suit;
  puffer[p++] = s->multiplier;

  for (seat = 0; seat < 4; seat++) {
    puffer[p++] = s->hand_n[seat];
    for (i = 0; i < s->hand_n[seat]; i++) puffer[p++] = s->hands[seat][i];
  }

  puffer[p++] = s->leader_seat;
  puffer[p++] = s->trick_n;
  for (i = 0; i < s->trick_n; i++) {
    puffer[p++] = s->current_trick[i].spieler;
    puffer[p++] = s->current_trick[i].karte;
  }

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

static void schafkopf_gitter(const u8 *stand, u8 *b, u8 *h) {
  *b = 8;
  *h = 1;
}

static u8 schafkopf_feld_an(const u8 *stand, u8 x, u8 y) {
  return x;
}

static u8 schafkopf_felder(const u8 *stand, const Zug *zug, u8 *f) {
  f[0] = zug->b[1];
  return 1;
}

static void schafkopf_zeichnen(const u8 *stand, const u8 *markierung, u8 aktiv) {
  const SchafkopfState *s = (const SchafkopfState *)stand;
  u8 p = schafkopf_am_zug(stand);
  karten_farben_laden();
  flaeche_leeren(0, 0, 32, 28);

  text(2, 1, "Schafkopf", PAL_TEXT);
  char buf[32];
  sprintf(buf, "Runde %d/%d", s->game_number, s->total_games);
  text(20, 1, buf, PAL_TEXT);

  if (s->phase == PHASE_SCHAFKOPF_PLAY) {
    sprintf(buf, "Augen: %d / %d", s->declarer_eyes, s->opponent_eyes);
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
    for (i = 0; i < hn && i < 8; i++) {
      u8 c = s->hands[p][i];
      karten_franzoesisch(2 + i * 3, 20, (c % 52) / 13, ((c % 52) % 13) + 1, 1, PAL_BRETT);
    }
  }
}

const Spiel spiel_schafkopf = {
  "Schafkopf",
  (const char *const[]){
    "Bayerischer Schafkopf für 4 Spieler.",
    "",
    "Sauspiel (Rufspiel auf die Sau), Solo,",
    "Wenz, Geier und Ramsch.",
    0
  },
  "A Karte / Ansage",
  (const char *const[]){"Vorhand", "Mittelhand", "Hinterhand", "Geber"},
  (const u8[]){PAL_ROT, PAL_BLAU, PAL_GELB, PAL_GRAU},
  4, 4,
  1,
  (const Option[]){
    {"Blatt", (const char *const[]){"Lang (32)", "Kurz (24)"}, 2, 0},
    {"Runden", (const char *const[]){"4 Spiele", "8 Spiele", "16 Spiele"}, 3, 1},
  },
  2,
  FARBEN_KARTEN,
  schafkopf_setup,
  schafkopf_am_zug,
  schafkopf_zuege,
  schafkopf_ziehen,
  schafkopf_ergebnis,
  schafkopf_bot_zug,
  schafkopf_ausgeben,
  schafkopf_gitter,
  schafkopf_feld_an,
  schafkopf_felder,
  schafkopf_zeichnen,
  0, 0, 0, 0
};
