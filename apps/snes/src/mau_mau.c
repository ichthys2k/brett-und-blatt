/*
 * Mau-Mau für Brett & Blatt 16 – nach packages/games/mau-mau/src/rules.ts, 2–4 Spieler.
 * Klassisches Ablegespiel mit 32 Karten (7, 8, 9, 10, Bube, Dame, König, Ass in 4 Farben).
 *
 * Karten als 0..51:
 *   Farbe = karte / 13 (0: Kreuz, 1: Karo, 2: Herz, 3: Pik)
 *   Rang  = (karte % 13) + 1 (1: Ass, 7..10, 11: Bube, 12: Dame, 13: König)
 *
 * Züge (4 Bytes):
 *   [0, Karte, Wunschfarbe, CallMau] – Karte legen (Wunschfarbe 0..3 bei Bube sonst 0xff)
 *   [1, 0, 0, 0]                     – Karte(n) ziehen
 *   [2, 0, 0, 0]                     – Passen
 *   [3, Ziel, 0, 0]                  – Mau vergessen anfechten
 */
#include "spiel.h"
#include "bild.h"
#include "klang.h"
#include "karten.h"
#include "../res/grafik.h"

#define KEIN 0xff
#define RANK_JACK 11
#define RANK_SEVEN 7
#define RANK_EIGHT 8
#define RANK_NINE 9
#define RANK_ACE 1

static const u8 MAU_MAU_DECK[32] = {
  /* Kreuz (suit 0) */
  6, 7, 8, 9, 10, 11, 12, 0,
  /* Karo (suit 1) */
  19, 20, 21, 22, 23, 24, 25, 13,
  /* Herz (suit 2) */
  32, 33, 34, 35, 36, 37, 38, 26,
  /* Pik (suit 3) */
  45, 46, 47, 48, 49, 50, 51, 39
};

typedef struct {
  u8 seats;
  u8 turn;
  u8 winner;      /* KEIN oder 0..seats-1 */
  s8 direction;   /* 1 oder -1 */
  u8 active_suit; /* 0..3 */
  u8 pending_draw;
  u8 has_drawn;
  u8 mau_protection[PLAETZE_MAX];

  /* Optionen */
  u8 opt_seven_stack;
  u8 opt_nine_reverse;
  u8 opt_ace_extra_turn;
  u8 opt_jack_on_everything;
  u8 opt_jack_on_jack;
  u8 opt_mau_call;
  u8 opt_draw_rule;

  u8 hand_n[PLAETZE_MAX];
  u8 hands[PLAETZE_MAX][32];

  u8 stock_n;
  u8 stock[32];

  u8 discard_n;
  u8 discard[32];

  Zufall rng;
} MauMau;

static u8 get_next_player(u8 current, s8 direction, u8 total, u8 steps) {
  s16 next = (s16)current + (s16)direction * (s16)steps;
  while (next < 0) next += total;
  return (u8)(next % total);
}

static u8 can_play_card(u8 card, u8 top_card, u8 active_suit, const MauMau *m) {
  u8 card_suit = card / 13;
  u8 card_rank = (card % 13) + 1;
  u8 top_rank = (top_card % 13) + 1;
  u8 top_is_jack = (top_rank == RANK_JACK);

  if (card_rank == RANK_JACK) {
    if (top_is_jack && m->opt_jack_on_jack == 0) return 0; /* forbidden */
    if (m->opt_jack_on_everything == 0) return 1; /* on */
    return (card_suit == active_suit || top_is_jack);
  }

  return (card_suit == active_suit || card_rank == top_rank);
}

static void mau_mau_recycle(MauMau *m) {
  u8 i, n;
  if (m->discard_n <= 1) return;
  n = m->discard_n - 1;
  for (i = 0; i < n; i++) {
    m->stock[i] = m->discard[i];
  }
  m->stock_n = n;
  m->discard[0] = m->discard[n];
  m->discard_n = 1;

  for (i = n - 1; i > 0; i--) {
    u16 j = zufall_bis(&m->rng, i + 1);
    u8 tmp = m->stock[i];
    m->stock[i] = m->stock[j];
    m->stock[j] = tmp;
  }
}

static u8 mau_mau_draw_card(MauMau *m) {
  if (m->stock_n == 0) mau_mau_recycle(m);
  if (m->stock_n == 0) return KEIN;
  m->stock_n--;
  return m->stock[m->stock_n];
}

static void give_cards(MauMau *m, u8 target, u8 count) {
  u8 i;
  for (i = 0; i < count; i++) {
    u8 c = mau_mau_draw_card(m);
    if (c == KEIN) break;
    m->hands[target][m->hand_n[target]++] = c;
  }
  if (m->hand_n[target] != 1) {
    m->mau_protection[target] = 0;
  }
}

/* ------------------------------------------------------------------ Regeln */

static void mau_mau_aufbauen(u8 *stand, const u8 *optionen, u8 plaetze, const char *seed) {
  MauMau *m = (MauMau *)stand;
  u8 deck[32];
  u8 i, round, seat, deck_top;

  m->seats = plaetze < 2 ? 2 : (plaetze > PLAETZE_MAX ? PLAETZE_MAX : plaetze);
  m->turn = 0;
  m->winner = KEIN;
  m->direction = 1;
  m->pending_draw = 0;
  m->has_drawn = 0;
  for (seat = 0; seat < PLAETZE_MAX; seat++) {
    m->mau_protection[seat] = 0;
    m->hand_n[seat] = 0;
  }

  m->opt_seven_stack = optionen[0];
  m->opt_nine_reverse = optionen[1];
  m->opt_ace_extra_turn = optionen[2];
  m->opt_jack_on_everything = optionen[3];
  m->opt_jack_on_jack = optionen[4];
  m->opt_mau_call = optionen[5];
  m->opt_draw_rule = optionen[6];

  for (i = 0; i < 32; i++) deck[i] = MAU_MAU_DECK[i];

  zufall_strom(&m->rng, seed, "main");

  for (i = 31; i > 0; i--) {
    u16 j = zufall_bis(&m->rng, i + 1);
    u8 tmp = deck[i];
    deck[i] = deck[j];
    deck[j] = tmp;
  }

  deck_top = 32;
  for (round = 0; round < 5; round++) {
    for (seat = 0; seat < m->seats; seat++) {
      deck_top--;
      m->hands[seat][m->hand_n[seat]++] = deck[deck_top];
    }
  }

  deck_top--;
  m->discard[0] = deck[deck_top];
  m->discard_n = 1;
  m->active_suit = m->discard[0] / 13;

  m->stock_n = deck_top;
  for (i = 0; i < deck_top; i++) {
    m->stock[i] = deck[i];
  }
}

static u8 mau_mau_am_zug(const u8 *stand) {
  const MauMau *m = (const MauMau *)stand;
  return m->winner != KEIN ? PLATZ_KEIN : m->turn;
}

static u16 mau_mau_zuege(const u8 *stand, Zug *liste) {
  const MauMau *m = (const MauMau *)stand;
  u16 anzahl = 0;
  u8 actor, hand_count, top_card, will_have_one, i, s;

  if (m->winner != KEIN) return 0;
  actor = m->turn;
  hand_count = m->hand_n[actor];
  if (hand_count == 0) return 0;
  top_card = m->discard[m->discard_n - 1];
  will_have_one = (hand_count == 2) ? 1 : 0;

  /* 0. Mau vergessen anfechten */
  if (m->opt_mau_call == 0) { /* on */
    for (s = 0; s < m->seats; s++) {
      if (m->hand_n[s] == 1 && !m->mau_protection[s]) {
        liste[anzahl].n = 4;
        liste[anzahl].b[0] = 3; /* catchMau */
        liste[anzahl].b[1] = s;
        liste[anzahl].b[2] = 0;
        liste[anzahl].b[3] = 0;
        anzahl++;
      }
    }
  }

  /* 1. Ausstehende 7er-Strafe */
  if (m->pending_draw > 0) {
    if (m->opt_seven_stack == 0) { /* on */
      for (i = 0; i < hand_count; i++) {
        u8 c = m->hands[actor][i];
        if (((c % 13) + 1) == RANK_SEVEN) {
          liste[anzahl].n = 4;
          liste[anzahl].b[0] = 0; /* play */
          liste[anzahl].b[1] = c;
          liste[anzahl].b[2] = 0xff;
          liste[anzahl].b[3] = will_have_one;
          anzahl++;
        }
      }
    }
    liste[anzahl].n = 4;
    liste[anzahl].b[0] = 1; /* draw */
    liste[anzahl].b[1] = 0;
    liste[anzahl].b[2] = 0;
    liste[anzahl].b[3] = 0;
    anzahl++;
    return anzahl;
  }

  /* 2. Normale Spielzüge */
  for (i = 0; i < hand_count; i++) {
    u8 c = m->hands[actor][i];
    if (!can_play_card(c, top_card, m->active_suit, m)) continue;

    if (((c % 13) + 1) == RANK_JACK) {
      if (hand_count == 1) {
        liste[anzahl].n = 4;
        liste[anzahl].b[0] = 0;
        liste[anzahl].b[1] = c;
        liste[anzahl].b[2] = 0xff;
        liste[anzahl].b[3] = will_have_one;
        anzahl++;
      } else {
        for (s = 0; s < 4; s++) {
          liste[anzahl].n = 4;
          liste[anzahl].b[0] = 0;
          liste[anzahl].b[1] = c;
          liste[anzahl].b[2] = s; /* chosenSuit */
          liste[anzahl].b[3] = will_have_one;
          anzahl++;
        }
      }
    } else {
      liste[anzahl].n = 4;
      liste[anzahl].b[0] = 0;
      liste[anzahl].b[1] = c;
      liste[anzahl].b[2] = 0xff;
      liste[anzahl].b[3] = will_have_one;
      anzahl++;
    }
  }

  if (!m->has_drawn) {
    liste[anzahl].n = 4;
    liste[anzahl].b[0] = 1; /* draw */
    liste[anzahl].b[1] = 0;
    liste[anzahl].b[2] = 0;
    liste[anzahl].b[3] = 0;
    anzahl++;
  } else {
    liste[anzahl].n = 4;
    liste[anzahl].b[0] = 2; /* pass */
    liste[anzahl].b[1] = 0;
    liste[anzahl].b[2] = 0;
    liste[anzahl].b[3] = 0;
    anzahl++;
  }

  return anzahl;
}

static u8 mau_mau_ziehen(u8 *stand, const Zug *zug) {
  MauMau *m = (MauMau *)stand;
  u8 actor = m->turn;
  u8 typ = zug->b[0];

  if (typ == 3) {
    /* catchMau */
    u8 target = zug->b[1];
    if (m->hand_n[target] == 1 && !m->mau_protection[target]) {
      give_cards(m, target, 2);
      m->mau_protection[target] = 1;
    }
    return KLANG_KLICK;
  }

  if (typ == 1) {
    /* draw */
    if (m->pending_draw > 0) {
      give_cards(m, actor, m->pending_draw);
      m->pending_draw = 0;
      m->has_drawn = 0;
      m->turn = get_next_player(actor, m->direction, m->seats, 1);
      return KLANG_KARTE;
    } else {
      u8 max_draws = (m->opt_draw_rule == 0) ? 1 : 32;
      u8 drawn_count = 0;
      u8 playable = 0;
      u8 top_card = m->discard[m->discard_n - 1];
      u8 i;
      for (i = 0; i < max_draws; i++) {
        u8 c = mau_mau_draw_card(m);
        if (c == KEIN) break;
        m->hands[actor][m->hand_n[actor]++] = c;
        drawn_count++;
        if (can_play_card(c, top_card, m->active_suit, m)) {
          playable = 1;
          break;
        }
      }
      if (drawn_count > 0) m->mau_protection[actor] = 0;
      if (!playable) {
        m->has_drawn = 0;
        m->turn = get_next_player(actor, m->direction, m->seats, 1);
      } else {
        m->has_drawn = 1;
      }
      return KLANG_KARTE;
    }
  }

  if (typ == 2) {
    /* pass */
    m->has_drawn = 0;
    m->turn = get_next_player(actor, m->direction, m->seats, 1);
    return KLANG_KLICK;
  }

  if (typ == 0) {
    /* play */
    u8 card = zug->b[1];
    u8 suit = card / 13;
    u8 rank = (card % 13) + 1;
    u8 i, idx = KEIN;
    u8 steps = 1;

    for (i = 0; i < m->hand_n[actor]; i++) {
      if (m->hands[actor][i] == card) {
        idx = i;
        break;
      }
    }
    if (idx != KEIN) {
      for (i = idx; i + 1 < m->hand_n[actor]; i++) {
        m->hands[actor][i] = m->hands[actor][i + 1];
      }
      m->hand_n[actor]--;
    }

    m->discard[m->discard_n++] = card;
    m->has_drawn = 0;

    if (rank == RANK_JACK) {
      if (zug->b[2] != 0xff) m->active_suit = zug->b[2];
      else m->active_suit = suit;
    } else {
      m->active_suit = suit;
    }

    if (m->hand_n[actor] == 1) {
      m->mau_protection[actor] = zug->b[3];
    } else {
      m->mau_protection[actor] = 0;
    }

    /* Gewonnen? */
    if (m->hand_n[actor] == 0) {
      m->winner = actor;
      return KLANG_SIEG;
    }

    /* Sonderkarten */
    if (rank == RANK_SEVEN) {
      if (m->opt_seven_stack == 0) { /* on */
        m->pending_draw += 2;
      } else { /* off */
        u8 victim = get_next_player(actor, m->direction, m->seats, 1);
        give_cards(m, victim, 2);
        steps = 2;
      }
    } else if (rank == RANK_EIGHT) {
      steps = 2;
    } else if (rank == RANK_NINE && m->opt_nine_reverse == 0) { /* on */
      if (m->seats == 2) {
        steps = 2;
      } else {
        m->direction = -m->direction;
        steps = 1;
      }
    } else if (rank == RANK_ACE && m->opt_ace_extra_turn == 1) { /* on */
      steps = 0;
    }

    m->turn = (steps == 0) ? actor : get_next_player(actor, m->direction, m->seats, steps);
    return KLANG_KARTE;
  }

  return KLANG_KLICK;
}

static u8 mau_mau_ergebnis(const u8 *stand, u8 *sieger) {
  const MauMau *m = (const MauMau *)stand;
  if (m->winner != KEIN) {
    *sieger = (1 << m->winner);
    return ERGEBNIS_SIEG;
  }
  return ERGEBNIS_LAEUFT;
}

/* ------------------------------------------------------------------ Bot */

static u8 get_best_suit(const MauMau *m, u8 actor) {
  u8 counts[4];
  u8 i, best = 0, best_cnt = 0;
  for (i = 0; i < 4; i++) counts[i] = 0;
  for (i = 0; i < m->hand_n[actor]; i++) {
    u8 c = m->hands[actor][i];
    if (((c % 13) + 1) != RANK_JACK) {
      counts[c / 13]++;
    }
  }
  for (i = 0; i < 4; i++) {
    if (counts[i] > best_cnt) {
      best = i;
      best_cnt = counts[i];
    }
  }
  return best;
}

static s16 score_play_move(const MauMau *m, u8 actor, const Zug *z, u8 level) {
  u8 card = z->b[1];
  u8 chosen = z->b[2];
  u8 rank = (card % 13) + 1;
  u8 suit = card / 13;
  u8 top_card = m->discard[m->discard_n - 1];
  u8 top_rank = (top_card % 13) + 1;
  u8 favourite = get_best_suit(m, actor);
  u8 opponent = get_next_player(actor, m->direction, m->seats, 1);
  u8 opp_cards = m->hand_n[opponent];
  s16 score = 0;

  if (suit == favourite) score += 8;
  if (rank == top_rank) score += 4;
  if (suit == m->active_suit) score += 3;

  if (rank == 7) score += 7;
  if (rank == 8) score += (opp_cards <= 2) ? 14 : 6;
  if (rank == 9 && m->opt_nine_reverse == 0) score += (m->seats == 2) ? 9 : 5;
  if (rank == 1 && m->opt_ace_extra_turn == 1) score += 7;

  if (rank == 11) {
    score -= 5;
    if (chosen == favourite) score += 8;
    if (m->hand_n[actor] <= 2) score += 10;
    if (m->hand_n[actor] == 1) score += 40;
  } else if (chosen != 0xff) {
    score -= 20;
  }

  if (m->hand_n[actor] == 1) score += 100;
  if (m->hand_n[actor] == 2) score += 6;

  if (level == STUFE_SCHWER) {
    if (opp_cards == 1 && (rank == 7 || rank == 8 || rank == 11)) score += 10;
    if (opp_cards == 1 && rank == 9 && m->seats == 2) score += 8;
    if (m->hand_n[actor] <= 3 && rank != 11) score += 3;
  }

  return score;
}

static void mau_mau_bot(const u8 *stand, u8 stufe, Zufall *z, Zug *zug) {
  const MauMau *m = (const MauMau *)stand;
  u16 anzahl = mau_mau_zuege(stand, zugliste);
  u16 i, best_idx = 0;
  s16 best_score = -30000;
  u8 play_count = 0;

  if (anzahl == 0) return;
  if (anzahl == 1) {
    *zug = zugliste[0];
    return;
  }

  /* Mau vergessen erwischen? */
  for (i = 0; i < anzahl; i++) {
    if (zugliste[i].b[0] == 3) {
      u8 chance = (stufe == STUFE_SCHWER) ? 100 : (stufe == STUFE_MITTEL ? 85 : 40);
      if (zufall_bis(z, 100) < chance) {
        *zug = zugliste[i];
        return;
      }
    }
  }

  /* Bei 7er Strafe: Play vor Draw */
  if (m->pending_draw > 0) {
    for (i = 0; i < anzahl; i++) {
      if (zugliste[i].b[0] == 0) {
        *zug = zugliste[i];
        return;
      }
    }
    for (i = 0; i < anzahl; i++) {
      if (zugliste[i].b[0] == 1) {
        *zug = zugliste[i];
        return;
      }
    }
    *zug = zugliste[0];
    return;
  }

  for (i = 0; i < anzahl; i++) {
    if (zugliste[i].b[0] == 0) play_count++;
  }

  if (play_count == 0) {
    for (i = 0; i < anzahl; i++) {
      if (zugliste[i].b[0] == 1 || zugliste[i].b[0] == 2) {
        *zug = zugliste[i];
        return;
      }
    }
    *zug = zugliste[0];
    return;
  }

  if (stufe == STUFE_LEICHT) {
    u16 target = zufall_bis(z, play_count);
    u8 c = 0;
    for (i = 0; i < anzahl; i++) {
      if (zugliste[i].b[0] == 0) {
        if (c == target) {
          *zug = zugliste[i];
          return;
        }
        c++;
      }
    }
  }

  /* Mittel / Schwer: Heuristik */
  for (i = 0; i < anzahl; i++) {
    if (zugliste[i].b[0] == 0) {
      s16 sc = score_play_move(m, m->turn, &zugliste[i], stufe);
      if (sc > best_score) {
        best_score = sc;
        best_idx = i;
      }
    }
  }

  *zug = zugliste[best_idx];
}

/* ------------------------------------------------------------------ Prüfmodus */

static u16 mau_mau_ausgeben(const u8 *stand, u8 *puffer) {
  const MauMau *m = (const MauMau *)stand;
  u16 p = 0;
  u8 s, i;

  puffer[p++] = m->seats;
  puffer[p++] = m->turn;
  puffer[p++] = m->winner;
  puffer[p++] = (u8)m->direction;
  puffer[p++] = m->active_suit;
  puffer[p++] = m->pending_draw;
  puffer[p++] = m->has_drawn;

  puffer[p++] = m->discard_n;
  for (i = 0; i < m->discard_n; i++) puffer[p++] = m->discard[i];

  puffer[p++] = m->stock_n;
  for (i = 0; i < m->stock_n; i++) puffer[p++] = m->stock[i];

  for (s = 0; s < m->seats; s++) {
    puffer[p++] = m->hand_n[s];
    for (i = 0; i < m->hand_n[s]; i++) puffer[p++] = m->hands[s][i];
    puffer[p++] = m->mau_protection[s];
  }

  /* RNG 16 Bytes Little-Endian */
  for (i = 0; i < 4; i++) {
    u32 v = m->rng.s[i];
    puffer[p++] = (u8)(v & 0xff);
    puffer[p++] = (u8)((v >> 8) & 0xff);
    puffer[p++] = (u8)((v >> 16) & 0xff);
    puffer[p++] = (u8)((v >> 24) & 0xff);
  }

  return p;
}

/* ------------------------------------------------------------------ Oberfläche */

static void mau_mau_gitter(const u8 *stand, u8 *breite, u8 *hoehe) {
  const MauMau *m = (const MauMau *)stand;
  *breite = (m->hand_n[0] > 7) ? m->hand_n[0] : 7;
  *hoehe = 4;
}

static u8 mau_mau_feld_an(const u8 *stand, u8 x, u8 y) {
  const MauMau *m = (const MauMau *)stand;
  if (y == 1) {
    if (x == 1) return 0; /* Talon */
    if (x == 5 && m->has_drawn) return 1; /* Passen */
  }
  if (y == 2) {
    /* Farbwahl (Kreuz, Karo, Herz, Pik) */
    if (x >= 1 && x <= 4) return 40 + (x - 1);
  }
  if (y == 3) {
    if (x < m->hand_n[0]) return 2 + x;
  }
  return FELD_KEIN;
}

static u8 mau_mau_felder(const u8 *stand, const Zug *zug, u8 *felder) {
  const MauMau *m = (const MauMau *)stand;
  u8 typ = zug->b[0];

  if (typ == 1) {
    felder[0] = 0; /* Talon */
    return 1;
  }
  if (typ == 2) {
    felder[0] = 1; /* Passen */
    return 1;
  }
  if (typ == 0) {
    u8 card = zug->b[1];
    u8 i;
    for (i = 0; i < m->hand_n[m->turn]; i++) {
      if (m->hands[m->turn][i] == card) {
        felder[0] = 2 + i;
        if (zug->b[2] != 0xff) {
          felder[1] = 40 + zug->b[2];
          return 2;
        }
        return 1;
      }
    }
  }
  return 0;
}

static void mau_mau_zeichnen(const u8 *stand, const u8 *markierung, u8 aktiv) {
  const MauMau *m = (const MauMau *)stand;
  u8 i, x, y;
  (void)aktiv;

  flaeche_leeren(0, 0, 32, 28);

  /* Gegnerhand oben (Spieler 1) */
  if (m->seats >= 2) {
    u8 opp = (m->seats == 2) ? 1 : 1;
    u8 opp_n = m->hand_n[opp];
    text(2, 2, "Gegner:", PAL_TEXT);
    zahl(9, 2, opp_n, 2, PAL_GELB);
    for (i = 0; i < opp_n && i < 10; i++) {
      karten_koerper(12 + i * 2, 1, KARTEN_RUECKEN, PAL_BRETT);
    }
  }

  /* Mitte: Talon links, Ablage rechts daneben */
  text(4, 9, "Talon", (markierung[0] & MARK_CURSOR) ? PAL_GELB : PAL_TEXT);
  if (m->stock_n > 0) {
    karten_koerper(4, 11, KARTEN_RUECKEN, (markierung[0] & MARK_CURSOR) ? PAL_BRETT_AUSWAHL : PAL_BRETT);
    zahl(5, 15, m->stock_n, 2, PAL_TEXT);
  } else {
    karten_koerper(4, 11, KARTEN_LEER, (markierung[0] & MARK_CURSOR) ? PAL_BRETT_AUSWAHL : PAL_BRETT);
  }

  text(11, 9, "Ablage", PAL_TEXT);
  if (m->discard_n > 0) {
    u8 c = m->discard[m->discard_n - 1];
    karten_franzoesisch(11, 11, c / 13, (c % 13) + 1, 1, PAL_BRETT);
  }

  /* Wunschfarbe anzeigen */
  text(18, 10, "Farbe:", PAL_TEXT);
  {
    u8 sym = (m->active_suit == 0) ? Z_KREUZ_BLATT : (m->active_suit == 1) ? Z_KARO : (m->active_suit == 2) ? Z_HERZ : Z_PIK;
    u8 pal = (m->active_suit == 1 || m->active_suit == 2) ? PAL_ROT : PAL_TEXT;
    kachel(25, 10, sym, pal);
  }

  /* Strafkarten */
  if (m->pending_draw > 0) {
    text(18, 12, "Strafe:", PAL_ROT);
    zahl(26, 12, m->pending_draw, 2, PAL_ROT);
  }

  /* Passen-Button wenn has_drawn */
  if (m->has_drawn) {
    u8 pal = (markierung[1] & MARK_CURSOR) ? PAL_GELB : PAL_TEXT;
    text(19, 15, "[PASSEN]", pal);
  }

  /* Farbwahl-Felder (wenn markiert als Ziel oder Cursor) */
  for (i = 0; i < 4; i++) {
    u8 f = 40 + i;
    u8 sym = (i == 0) ? Z_KREUZ_BLATT : (i == 1) ? Z_KARO : (i == 2) ? Z_HERZ : Z_PIK;
    u8 pal = (i == 1 || i == 2) ? PAL_ROT : PAL_TEXT;
    if (markierung[f] & (MARK_ZIEL | MARK_CURSOR)) {
      kachel(18 + i * 2, 12, sym, (markierung[f] & MARK_CURSOR) ? PAL_GELB : pal);
    }
  }

  /* Eigene Handkarten unten */
  text(2, 19, "Deine Hand:", PAL_TEXT);
  for (i = 0; i < m->hand_n[0]; i++) {
    u8 f = 2 + i;
    u8 pal = (markierung[f] & (MARK_GEWAEHLT | MARK_CURSOR)) ? PAL_BRETT_AUSWAHL : PAL_BRETT;
    x = 2 + i * 3;
    y = 21;
    if (x + 3 <= 31) {
      u8 c = m->hands[0][i];
      karten_franzoesisch(x, y, c / 13, (c % 13) + 1, 1, pal);
    }
  }
}

/* ------------------------------------------------------------------ Steckbrief */

static const char *const ANLEITUNG[] = {
  "Lege passend zur Farbe oder zum Wert.",
  "7: Naechster zieht 2 (stapelbar).",
  "8: Naechster setzt aus.",
  "9: Richtungswechsel.",
  "Bube: Wuenscht neue Farbe (auf alles).",
  "Wer zuerst alle Karten ablegt, gewinnt!",
  0
};

static const char *const OPT_SEVEN[] = {"An", "Aus"};
static const char *const OPT_NINE[] = {"An", "Aus"};
static const char *const OPT_ACE[] = {"Aus", "An"};
static const char *const OPT_JACK_ALL[] = {"An", "Aus"};
static const char *const OPT_JACK_JACK[] = {"Verboten", "Erlaubt"};
static const char *const OPT_MAU[] = {"An", "Aus"};
static const char *const OPT_DRAW[] = {"1 Karte", "Bis passend"};

static const Option OPTIONEN[] = {
  {"7er stapeln", OPT_SEVEN, 2, 0},
  {"9 = Richtung", OPT_NINE, 2, 0},
  {"Ass = noch", OPT_ACE, 2, 0},
  {"Bube frei", OPT_JACK_ALL, 2, 0},
  {"Bube auf Bube", OPT_JACK_JACK, 2, 0},
  {"Mau rufen", OPT_MAU, 2, 0},
  {"Nachziehen", OPT_DRAW, 2, 0},
};

static const char *const PLATZ_NAMEN[] = {"Spieler 1", "Spieler 2", "Spieler 3", "Spieler 4"};
static const u8 PLATZ_PALETTEN[] = {PAL_ROT, PAL_BLAU, PAL_GELB, PAL_GRAU};

const Spiel spiel_mau_mau = {
  "Mau-Mau",
  ANLEITUNG,
  "A Karte/Talon waehlen",
  PLATZ_NAMEN,
  PLATZ_PALETTEN,
  2, 4,
  1, /* verdeckt */
  OPTIONEN,
  7,
  FARBEN_KARTEN,
  mau_mau_aufbauen,
  mau_mau_am_zug,
  mau_mau_zuege,
  mau_mau_ziehen,
  mau_mau_ergebnis,
  mau_mau_bot,
  mau_mau_ausgeben,
  mau_mau_gitter,
  mau_mau_feld_an,
  mau_mau_felder,
  mau_mau_zeichnen,
  1, 3, /* Cursor Start */
};
