/*
 * Eins! für Brett & Blatt 16 – nach packages/games/uno/src/rules.ts, 2–4 Spieler.
 * Klassisches Uno-Regelwerk mit 108 Karten (Rot, Gelb, Grün, Blau, Wild).
 *
 * Karten als 0..107 (entspricht c_1 bis c_108 im Classic-Deck):
 *   0..24:   Rot (0, 1..9 doppelt, Skip doppelt, Reverse doppelt, +2 doppelt)
 *   25..49:  Gelb (ebenso)
 *   50..74:  Grün (ebenso)
 *   75..99:  Blau (ebenso)
 *   100..103: Wild (Farbwahl)
 *   104..107: Wild Draw 4 (+4 Farbwahl)
 *
 * Züge (4 Bytes):
 *   [0, Karte, Wunschfarbe, CallUno] – Karte legen (Wunschfarbe 0..3 bei Wild sonst 0xff)
 *   [1, 0, 0, 0]                     – Karte(n) ziehen
 *   [2, 0, 0, 0]                     – Passen
 *   [3, Ziel, 0, 0]                  – Eins vergessen anfechten
 */
#include "spiel.h"
#include "bild.h"
#include "klang.h"
#include "karten.h"
#include "../res/grafik.h"

#define KEIN 0xff
#define UNO_TYPE_SKIP 10
#define UNO_TYPE_REVERSE 11
#define UNO_TYPE_DRAW2 12
#define UNO_TYPE_WILD 13
#define UNO_TYPE_WILD4 14

typedef struct {
  u8 seats;
  u8 turn;
  u8 winner;      /* KEIN oder 0..seats-1 */
  s8 direction;   /* 1 oder -1 */
  u8 active_color; /* 0: red, 1: yellow, 2: green, 3: blue */
  u8 pending_draw;
  u8 has_drawn;
  u8 uno_protection[PLAETZE_MAX];

  /* Optionen */
  u8 opt_stacking;   /* 0: same, 1: off */
  u8 opt_draw_rule;  /* 0: one, 1: untilMatch */
  u8 opt_call_uno;   /* 0: on, 1: off */

  u8 hand_n[PLAETZE_MAX];
  u8 hands[PLAETZE_MAX][108];

  u8 stock_n;
  u8 stock[108];

  u8 discard_n;
  u8 discard[108];

  Zufall rng;
} Uno;

static void uno_card_info(u8 index, u8 *color, u8 *type) {
  if (index < 100) {
    u8 offset;
    *color = index / 25;
    offset = index % 25;
    if (offset == 0) *type = 0;
    else if (offset <= 18) *type = 1 + (offset - 1) / 2;
    else if (offset <= 20) *type = UNO_TYPE_SKIP;
    else if (offset <= 22) *type = UNO_TYPE_REVERSE;
    else *type = UNO_TYPE_DRAW2;
  } else if (index < 104) {
    *color = 4; /* wild */
    *type = UNO_TYPE_WILD;
  } else {
    *color = 4; /* wild */
    *type = UNO_TYPE_WILD4;
  }
}

static u8 get_next_player(u8 current, s8 direction, u8 total, u8 steps) {
  s16 next = (s16)current + (s16)direction * (s16)steps;
  while (next < 0) next += total;
  return (u8)(next % total);
}

static u8 can_play_card(u8 card, u8 top_card, u8 active_color) {
  u8 c_col, c_type, top_col, top_type;
  uno_card_info(card, &c_col, &c_type);
  uno_card_info(top_card, &top_col, &top_type);

  if (c_col == 4) return 1; /* wild */
  if (c_col == active_color) return 1;
  if (c_type == top_type) return 1;
  return 0;
}

static u8 can_stack_card(u8 card, u8 top_card) {
  u8 c_col, c_type, top_col, top_type;
  uno_card_info(card, &c_col, &c_type);
  uno_card_info(top_card, &top_col, &top_type);
  return c_type == top_type;
}

static void uno_recycle(Uno *u) {
  u8 i, n;
  if (u->discard_n <= 1) return;
  n = u->discard_n - 1;
  for (i = 0; i < n; i++) {
    u->stock[i] = u->discard[i];
  }
  u->stock_n = n;
  u->discard[0] = u->discard[n];
  u->discard_n = 1;

  for (i = n - 1; i > 0; i--) {
    u16 j = zufall_bis(&u->rng, i + 1);
    u8 tmp = u->stock[i];
    u->stock[i] = u->stock[j];
    u->stock[j] = tmp;
  }
}

static u8 uno_draw_card(Uno *u) {
  if (u->stock_n == 0) uno_recycle(u);
  if (u->stock_n == 0) return KEIN;
  u->stock_n--;
  return u->stock[u->stock_n];
}

static void give_cards(Uno *u, u8 target, u8 count) {
  u8 i;
  for (i = 0; i < count; i++) {
    u8 c = uno_draw_card(u);
    if (c == KEIN) break;
    u->hands[target][u->hand_n[target]++] = c;
  }
}

/* ------------------------------------------------------------------ Regeln */

static void uno_aufbauen(u8 *stand, const u8 *optionen, u8 plaetze, const char *seed) {
  Uno *u = (Uno *)stand;
  u8 deck[108];
  u8 i, round, seat, deck_top;

  u->seats = plaetze < 2 ? 2 : (plaetze > PLAETZE_MAX ? PLAETZE_MAX : plaetze);
  u->turn = 0;
  u->winner = KEIN;
  u->direction = 1;
  u->pending_draw = 0;
  u->has_drawn = 0;
  for (seat = 0; seat < PLAETZE_MAX; seat++) {
    u->uno_protection[seat] = 0;
    u->hand_n[seat] = 0;
  }

  u->opt_stacking = optionen[0];
  u->opt_draw_rule = optionen[1];
  u->opt_call_uno = optionen[2];

  for (i = 0; i < 108; i++) deck[i] = i;

  zufall_strom(&u->rng, seed, "main");

  for (i = 107; i > 0; i--) {
    u16 j = zufall_bis(&u->rng, i + 1);
    u8 tmp = deck[i];
    deck[i] = deck[j];
    deck[j] = tmp;
  }

  /* Austeilen: 7 Runden, jeweils seat 0..seats-1: deck.pop() */
  deck_top = 108;
  for (round = 0; round < 7; round++) {
    for (seat = 0; seat < u->seats; seat++) {
      deck_top--;
      u->hands[seat][u->hand_n[seat]++] = deck[deck_top];
    }
  }

  /* Startkarte aufdecken (kein wildDraw4) */
  while (1) {
    u8 c, color, type;
    deck_top--;
    c = deck[deck_top];
    uno_card_info(c, &color, &type);
    if (type != UNO_TYPE_WILD4) {
      u->discard[0] = c;
      u->discard_n = 1;
      u->active_color = (color == 4) ? 0 : color;
      break;
    }
    for (i = deck_top; i > 0; i--) {
      deck[i] = deck[i - 1];
    }
    deck[0] = c;
    deck_top++;
  }

  u->stock_n = deck_top;
  for (i = 0; i < deck_top; i++) {
    u->stock[i] = deck[i];
  }
}

static u8 uno_am_zug(const u8 *stand) {
  const Uno *u = (const Uno *)stand;
  return u->winner != KEIN ? PLATZ_KEIN : u->turn;
}

static u16 uno_zuege(const u8 *stand, Zug *liste) {
  const Uno *u = (const Uno *)stand;
  u16 anzahl = 0;
  u8 actor, hand_count, top_card, will_have_one, i, s;

  if (u->winner != KEIN) return 0;
  actor = u->turn;
  hand_count = u->hand_n[actor];
  if (hand_count == 0) return 0;
  top_card = u->discard[u->discard_n - 1];
  will_have_one = (hand_count == 2) ? 1 : 0;

  /* 0. Eins vergessen anfechten */
  if (u->opt_call_uno == 0) { /* on */
    for (s = 0; s < u->seats; s++) {
      if (u->hand_n[s] == 1 && !u->uno_protection[s]) {
        liste[anzahl].n = 4;
        liste[anzahl].b[0] = 3; /* catchUno */
        liste[anzahl].b[1] = s;
        liste[anzahl].b[2] = 0;
        liste[anzahl].b[3] = 0;
        anzahl++;
      }
    }
  }

  /* 1. Ausstehende Strafkarten */
  if (u->pending_draw > 0) {
    if (u->opt_stacking == 0) { /* same */
      for (i = 0; i < hand_count; i++) {
        u8 c = u->hands[actor][i];
        if (can_stack_card(c, top_card)) {
          u8 color, type;
          uno_card_info(c, &color, &type);
          if (color == 4) {
            for (s = 0; s < 4; s++) {
              liste[anzahl].n = 4;
              liste[anzahl].b[0] = 0;
              liste[anzahl].b[1] = c;
              liste[anzahl].b[2] = s;
              liste[anzahl].b[3] = will_have_one;
              anzahl++;
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
    u8 c = u->hands[actor][i];
    if (!can_play_card(c, top_card, u->active_color)) continue;

    {
      u8 color, type;
      uno_card_info(c, &color, &type);
      if (color == 4) {
        for (s = 0; s < 4; s++) {
          liste[anzahl].n = 4;
          liste[anzahl].b[0] = 0;
          liste[anzahl].b[1] = c;
          liste[anzahl].b[2] = s;
          liste[anzahl].b[3] = will_have_one;
          anzahl++;
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
  }

  if (!u->has_drawn) {
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

static u8 uno_ziehen(u8 *stand, const Zug *zug) {
  Uno *u = (Uno *)stand;
  u8 actor = u->turn;
  u8 typ = zug->b[0];

  if (typ == 3) {
    /* catchUno */
    u8 target = zug->b[1];
    if (u->hand_n[target] == 1 && !u->uno_protection[target]) {
      give_cards(u, target, 2);
      u->uno_protection[target] = 1;
    }
    return KLANG_KLICK;
  }

  if (typ == 1) {
    /* draw */
    if (u->pending_draw > 0) {
      give_cards(u, actor, u->pending_draw);
      u->pending_draw = 0;
      u->has_drawn = 0;
      u->turn = get_next_player(actor, u->direction, u->seats, 1);
      return KLANG_KARTE;
    } else {
      u8 c = uno_draw_card(u);
      u8 top_card = u->discard[u->discard_n - 1];
      if (c != KEIN) {
        u->hands[actor][u->hand_n[actor]++] = c;
      }
      if (u->opt_draw_rule == 0) { /* one */
        u->has_drawn = 1;
        if (c == KEIN || !can_play_card(c, top_card, u->active_color)) {
          u->has_drawn = 0;
          u->turn = get_next_player(actor, u->direction, u->seats, 1);
        }
      } else { /* untilMatch */
        if (c != KEIN && can_play_card(c, top_card, u->active_color)) {
          u->has_drawn = 1;
        } else {
          u->turn = get_next_player(actor, u->direction, u->seats, 1);
        }
      }
      return KLANG_KARTE;
    }
  }

  if (typ == 2) {
    /* pass */
    u->has_drawn = 0;
    u->turn = get_next_player(actor, u->direction, u->seats, 1);
    return KLANG_KLICK;
  }

  if (typ == 0) {
    /* play */
    u8 card = zug->b[1];
    u8 color, type;
    u8 i, idx = KEIN;
    u8 steps = 1;

    uno_card_info(card, &color, &type);

    for (i = 0; i < u->hand_n[actor]; i++) {
      if (u->hands[actor][i] == card) {
        idx = i;
        break;
      }
    }
    if (idx != KEIN) {
      for (i = idx; i + 1 < u->hand_n[actor]; i++) {
        u->hands[actor][i] = u->hands[actor][i + 1];
      }
      u->hand_n[actor]--;
    }

    u->discard[u->discard_n++] = card;

    if (u->hand_n[actor] == 1) {
      u->uno_protection[actor] = zug->b[3];
    } else {
      u->uno_protection[actor] = 0;
    }

    /* Gewonnen, bevor Sonderfunktionen oder active_color aktualisiert werden */
    if (u->hand_n[actor] == 0) {
      u->winner = actor;
      return KLANG_SIEG;
    }

    if (color == 4) {
      if (zug->b[2] != 0xff) u->active_color = zug->b[2];
      else u->active_color = 0;
    } else {
      u->active_color = color;
    }

    u->has_drawn = 0;

    /* Sonderfunktionen */
    if (type == UNO_TYPE_SKIP) {
      steps = 2;
    } else if (type == UNO_TYPE_REVERSE) {
      if (u->seats == 2) {
        steps = 2;
      } else {
        u->direction = -u->direction;
        steps = 1;
      }
    } else if (type == UNO_TYPE_DRAW2) {
      if (u->opt_stacking == 0) { /* same */
        u->pending_draw += 2;
      } else {
        u8 victim = get_next_player(actor, u->direction, u->seats, 1);
        give_cards(u, victim, 2);
        steps = 2;
      }
    } else if (type == UNO_TYPE_WILD4) {
      if (u->opt_stacking == 0) { /* same */
        u->pending_draw += 4;
      } else {
        u8 victim = get_next_player(actor, u->direction, u->seats, 1);
        give_cards(u, victim, 4);
        steps = 2;
      }
    }

    u->turn = (steps == 0) ? actor : get_next_player(actor, u->direction, u->seats, steps);
    return KLANG_KARTE;
  }

  return KLANG_KLICK;
}

static u8 uno_ergebnis(const u8 *stand, u8 *sieger) {
  const Uno *u = (const Uno *)stand;
  if (u->winner != KEIN) {
    *sieger = (1 << u->winner);
    return ERGEBNIS_SIEG;
  }
  return ERGEBNIS_LAEUFT;
}

/* ------------------------------------------------------------------ Bot */

static u8 get_best_color(const Uno *u, u8 actor) {
  u8 counts[4];
  u8 i, best = 0, best_cnt = 0;
  for (i = 0; i < 4; i++) counts[i] = 0;
  for (i = 0; i < u->hand_n[actor]; i++) {
    u8 c = u->hands[actor][i];
    u8 col, typ;
    uno_card_info(c, &col, &typ);
    if (col < 4) counts[col]++;
  }
  for (i = 0; i < 4; i++) {
    if (counts[i] > best_cnt) {
      best = i;
      best_cnt = counts[i];
    }
  }
  return best;
}

static s16 score_play_move(const Uno *u, u8 actor, const Zug *z) {
  u8 card = z->b[1];
  u8 chosen = z->b[2];
  u8 col, typ;
  u8 best_col = get_best_color(u, actor);
  s16 score = 0;

  uno_card_info(card, &col, &typ);

  if (col == best_col) score += 10;
  if (col != 4) score += 5;
  if (typ == UNO_TYPE_SKIP || typ == UNO_TYPE_DRAW2) score += 8;
  if (chosen == best_col) score += 15;

  return score;
}

static void uno_bot(const u8 *stand, u8 stufe, Zufall *z, Zug *zug) {
  const Uno *u = (const Uno *)stand;
  u16 anzahl = uno_zuege(stand, zugliste);
  u16 i, best_idx = 0;
  s16 best_score = -30000;
  u8 play_count = 0;

  if (anzahl == 0) return;
  if (anzahl == 1) {
    *zug = zugliste[0];
    return;
  }

  /* Eins vergessen anfechten? */
  for (i = 0; i < anzahl; i++) {
    if (zugliste[i].b[0] == 3) {
      u8 chance = (stufe == STUFE_SCHWER) ? 100 : (stufe == STUFE_MITTEL ? 85 : 40);
      if (zufall_bis(z, 100) < chance) {
        *zug = zugliste[i];
        return;
      }
    }
  }

  /* Strafkarten stapeln */
  if (u->pending_draw > 0) {
    for (i = anzahl; i > 0; i--) {
      if (zugliste[i - 1].b[0] == 0) {
        *zug = zugliste[i - 1];
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

  for (i = 0; i < anzahl; i++) {
    if (zugliste[i].b[0] == 0) {
      s16 sc = score_play_move(u, u->turn, &zugliste[i]);
      if (sc > best_score) {
        best_score = sc;
        best_idx = i;
      }
    }
  }

  *zug = zugliste[best_idx];
}

/* ------------------------------------------------------------------ Prüfmodus */

static u16 uno_ausgeben(const u8 *stand, u8 *puffer) {
  const Uno *u = (const Uno *)stand;
  u16 p = 0;
  u8 s, i;

  puffer[p++] = u->seats;
  puffer[p++] = u->turn;
  puffer[p++] = u->winner;
  puffer[p++] = (u8)u->direction;
  puffer[p++] = u->active_color;
  puffer[p++] = u->pending_draw;
  puffer[p++] = u->has_drawn;

  puffer[p++] = u->discard_n;
  for (i = 0; i < u->discard_n; i++) puffer[p++] = u->discard[i];

  puffer[p++] = u->stock_n;
  for (i = 0; i < u->stock_n; i++) puffer[p++] = u->stock[i];

  for (s = 0; s < u->seats; s++) {
    puffer[p++] = u->hand_n[s];
    for (i = 0; i < u->hand_n[s]; i++) puffer[p++] = u->hands[s][i];
    puffer[p++] = u->uno_protection[s];
  }

  for (i = 0; i < 4; i++) {
    u32 v = u->rng.s[i];
    puffer[p++] = (u8)(v & 0xff);
    puffer[p++] = (u8)((v >> 8) & 0xff);
    puffer[p++] = (u8)((v >> 16) & 0xff);
    puffer[p++] = (u8)((v >> 24) & 0xff);
  }

  return p;
}

/* ------------------------------------------------------------------ Oberfläche */

static void uno_gitter(const u8 *stand, u8 *breite, u8 *hoehe) {
  const Uno *u = (const Uno *)stand;
  *breite = (u->hand_n[0] > 7) ? u->hand_n[0] : 7;
  *hoehe = 4;
}

static u8 uno_feld_an(const u8 *stand, u8 x, u8 y) {
  const Uno *u = (const Uno *)stand;
  if (y == 1) {
    if (x == 1) return 0; /* Talon */
    if (x == 5 && u->has_drawn) return 1; /* Passen */
  }
  if (y == 2) {
    if (x >= 1 && x <= 4) return 40 + (x - 1); /* Farbwahl Rot, Gelb, Grün, Blau */
  }
  if (y == 3) {
    if (x < u->hand_n[0]) return 2 + x;
  }
  return FELD_KEIN;
}

static u8 uno_felder(const u8 *stand, const Zug *zug, u8 *felder) {
  const Uno *u = (const Uno *)stand;
  u8 typ = zug->b[0];

  if (typ == 1) {
    felder[0] = 0;
    return 1;
  }
  if (typ == 2) {
    felder[0] = 1;
    return 1;
  }
  if (typ == 0) {
    u8 card = zug->b[1];
    u8 i;
    for (i = 0; i < u->hand_n[u->turn]; i++) {
      if (u->hands[u->turn][i] == card) {
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

static void uno_zeichnen(const u8 *stand, const u8 *markierung, u8 aktiv) {
  const Uno *u = (const Uno *)stand;
  u8 i, x, y;
  (void)aktiv;

  flaeche_leeren(0, 0, 32, 28);

  /* Gegner oben */
  if (u->seats >= 2) {
    u8 opp_n = u->hand_n[1];
    text(2, 2, "Gegner:", PAL_TEXT);
    zahl(9, 2, opp_n, 2, PAL_GELB);
    for (i = 0; i < opp_n && i < 10; i++) {
      karten_koerper(12 + i * 2, 1, KARTEN_RUECKEN, PAL_BRETT);
    }
  }

  /* Talon */
  text(4, 9, "Talon", (markierung[0] & MARK_CURSOR) ? PAL_GELB : PAL_TEXT);
  if (u->stock_n > 0) {
    karten_koerper(4, 11, KARTEN_RUECKEN, (markierung[0] & MARK_CURSOR) ? PAL_BRETT_AUSWAHL : PAL_BRETT);
    zahl(5, 15, u->stock_n, 2, PAL_TEXT);
  } else {
    karten_koerper(4, 11, KARTEN_LEER, (markierung[0] & MARK_CURSOR) ? PAL_BRETT_AUSWAHL : PAL_BRETT);
  }

  /* Ablage */
  text(11, 9, "Ablage", PAL_TEXT);
  if (u->discard_n > 0) {
    u8 c = u->discard[u->discard_n - 1];
    u8 col, typ;
    uno_card_info(c, &col, &typ);
    if (col < 4) {
      karten_zahl(11, 11, col, typ, 1, PAL_BRETT);
    } else {
      karten_koerper(11, 11, KARTEN_BLANKO, PAL_BRETT);
      text(12, 12, (typ == UNO_TYPE_WILD4) ? "+4" : "W", PAL_TEXT);
    }
  }

  /* Farbe */
  text(18, 10, "Farbe:", PAL_TEXT);
  {
    static const char *const FARBNAMEN[4] = {"Rot", "Gelb", "Gruen", "Blau"};
    static const u8 FARBPAL[4] = {PAL_ROT, PAL_GELB, PAL_TEXT, PAL_BLAU};
    if (u->active_color < 4) {
      text(25, 10, FARBNAMEN[u->active_color], FARBPAL[u->active_color]);
    }
  }

  if (u->pending_draw > 0) {
    text(18, 12, "Strafe:", PAL_ROT);
    zahl(26, 12, u->pending_draw, 2, PAL_ROT);
  }

  if (u->has_drawn) {
    u8 pal = (markierung[1] & MARK_CURSOR) ? PAL_GELB : PAL_TEXT;
    text(19, 15, "[PASSEN]", pal);
  }

  /* Farbwahl */
  for (i = 0; i < 4; i++) {
    u8 f = 40 + i;
    static const char *const K_FARB[4] = {"R", "G", "V", "B"};
    static const u8 K_PAL[4] = {PAL_ROT, PAL_GELB, PAL_TEXT, PAL_BLAU};
    if (markierung[f] & (MARK_ZIEL | MARK_CURSOR)) {
      text(18 + i * 2, 12, K_FARB[i], (markierung[f] & MARK_CURSOR) ? PAL_GELB : K_PAL[i]);
    }
  }

  /* Hand */
  text(2, 19, "Deine Hand:", PAL_TEXT);
  for (i = 0; i < u->hand_n[0]; i++) {
    u8 f = 2 + i;
    u8 pal = (markierung[f] & (MARK_GEWAEHLT | MARK_CURSOR)) ? PAL_BRETT_AUSWAHL : PAL_BRETT;
    x = 2 + i * 3;
    y = 21;
    if (x + 3 <= 31) {
      u8 c = u->hands[0][i];
      u8 col, typ;
      uno_card_info(c, &col, &typ);
      if (col < 4) {
        karten_zahl(x, y, col, typ, 1, pal);
      } else {
        karten_koerper(x, y, KARTEN_BLANKO, pal);
        text(x + 1, y + 1, (typ == UNO_TYPE_WILD4) ? "+4" : "W", PAL_TEXT);
      }
    }
  }
}

/* ------------------------------------------------------------------ Steckbrief */

static const char *const ANLEITUNG[] = {
  "Lege passend zur Farbe oder Zahl.",
  "Aussetzen: Naechster uebersprungen.",
  "Richtungswechsel: Kehrt Spiel um.",
  "+2 und +4: Strafkarten ziehen.",
  "Wer zuerst alle Karten ablegt, gewinnt!",
  0
};

static const char *const OPT_STACK[] = {"Gleiche", "Aus"};
static const char *const OPT_DRAW[] = {"1 Karte", "Bis passend"};
static const char *const OPT_UNO[] = {"An", "Aus"};

static const Option OPTIONEN[] = {
  {"Stapeln", OPT_STACK, 2, 0},
  {"Nachziehen", OPT_DRAW, 2, 0},
  {"Eins rufen", OPT_UNO, 2, 0},
};

static const char *const PLATZ_NAMEN[] = {"Spieler 1", "Spieler 2", "Spieler 3", "Spieler 4"};
static const u8 PLATZ_PALETTEN[] = {PAL_ROT, PAL_BLAU, PAL_GELB, PAL_GRAU};

const Spiel spiel_uno = {
  "Eins!",
  ANLEITUNG,
  "A Karte/Talon waehlen",
  PLATZ_NAMEN,
  PLATZ_PALETTEN,
  2, 4,
  1, /* verdeckt */
  OPTIONEN,
  3,
  FARBEN_KARTEN,
  uno_aufbauen,
  uno_am_zug,
  uno_zuege,
  uno_ziehen,
  uno_ergebnis,
  uno_bot,
  uno_ausgeben,
  uno_gitter,
  uno_feld_an,
  uno_felder,
  uno_zeichnen,
  1, 3,
};
