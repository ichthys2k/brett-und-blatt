/*
 * Quartett für Brett & Blatt 16 – nach packages/games/quartett/src/rules.ts.
 * Unterstützt Trumpf (Werte vergleichen) und Sammeln (nach Karten fragen) für 2–4 Spieler.
 * Kartenset: Tiere (32 Karten A1..H4, 5 Eigenschaften).
 *
 * Züge:
 *   Trumpf:  [0, Eigenschaft (0..4), 0, 0]
 *   Sammeln: [1, Zielspieler (0..seats-1), Karte (0..31), 0]
 */
#include "spiel.h"
#include "bild.h"
#include "klang.h"
#include "karten.h"
#include "../res/grafik.h"

#define KEIN 0xff

static const u32 quartett_werte[32][5] = {
  /* A1 Elefant */       { 6000, 650, 40, 65, 1 },
  /* A2 Giraffe */       { 1200, 450, 55, 25, 1 },
  /* A3 Loewe */         { 190, 200, 80, 14, 3 },
  /* A4 Nashorn */       { 2300, 380, 50, 45, 1 },
  /* B1 Hirsch */        { 160, 220, 65, 18, 1 },
  /* B2 Wildschwein */   { 100, 150, 48, 10, 6 },
  /* B3 Fuchs */         { 7, 70, 50, 5, 5 },
  /* B4 Braunbaer */     { 300, 230, 55, 25, 2 },
  /* C1 Rind */          { 700, 250, 40, 20, 1 },
  /* C2 Schwein */       { 200, 150, 17, 15, 11 },
  /* C3 Pferd */         { 500, 240, 70, 28, 1 },
  /* C4 Schaf */         { 70, 140, 40, 12, 2 },
  /* D1 Blauwal */       { 130000, 2500, 50, 85, 1 },
  /* D2 Schwertwal */    { 5500, 750, 55, 50, 1 },
  /* D3 Weisser Hai */   { 1100, 450, 56, 70, 8 },
  /* D4 Tuemmler */      { 300, 300, 35, 40, 1 },
  /* E1 Hund */          { 35, 110, 48, 12, 7 },
  /* E2 Katze */         { 4, 50, 48, 15, 4 },
  /* E3 Kaninchen */     { 2, 40, 50, 9, 6 },
  /* E4 Meerschwein */   { 1, 25, 10, 6, 3 },
  /* F1 Strauss */       { 120, 200, 70, 40, 8 },
  /* F2 Steinadler */    { 5, 85, 240, 25, 2 },
  /* F3 Wanderfalke */   { 1, 45, 320, 15, 3 },
  /* F4 Pinguin */       { 35, 115, 10, 20, 1 },
  /* G1 Tiger */         { 220, 220, 60, 15, 3 },
  /* G2 Panda */         { 100, 150, 30, 20, 1 },
  /* G3 Orang-Utan */    { 75, 130, 6, 40, 1 },
  /* G4 Komodowaran */   { 80, 260, 20, 30, 20 },
  /* H1 Eisbaer */       { 450, 230, 40, 25, 2 },
  /* H2 Walross */       { 1200, 330, 35, 35, 1 },
  /* H3 Rentier */       { 120, 190, 80, 15, 1 },
  /* H4 Polarfuchs */    { 4, 60, 50, 4, 8 },
};

static const char *const quartett_namen[32] = {
  "Elefant", "Giraffe", "Loewe", "Nashorn",
  "Hirsch", "Wildschwein", "Fuchs", "Braunbaer",
  "Rind", "Schwein", "Pferd", "Schaf",
  "Blauwal", "Schwertwal", "Hai", "Delfin",
  "Hund", "Katze", "Kaninchen", "Meerschwein",
  "Strauss", "Adler", "Falke", "Pinguin",
  "Tiger", "Panda", "Orang-Utan", "Waran",
  "Eisbaer", "Walross", "Rentier", "Polarfuchs"
};

static const char *const EIGENSCHAFTEN[5] = {
  "Gewicht", "Laenge", "Tempo", "Alter", "Junge"
};

static const char *const EINHEITEN[5] = {
  "kg", "cm", "km/h", "Jahre", ""
};

typedef struct {
  u8 card; /* 0..31 */
  u8 open; /* 0: verdeckt, 1: offen */
} QuartettStackCard;

typedef struct {
  u8 seat;
  u8 group; /* 0..7 */
} QuartettLaid;

typedef struct {
  u8 mode;        /* 0: trump, 1: collect */
  u8 seats;
  u8 turn;
  u8 finished;

  /* Trumpf */
  u8 round;
  u8 round_limit; /* 30, 15, 50, 0 = unlimited */
  u8 middle_n;
  u8 middle[32];
  u8 stack_n[PLAETZE_MAX];
  QuartettStackCard stacks[PLAETZE_MAX][32];

  /* Sammeln */
  u8 hand_n[PLAETZE_MAX];
  u8 hands[PLAETZE_MAX][32];
  u8 talon_n;
  u8 talon[32];
  u8 quartets_n;
  QuartettLaid quartets[8];

  /* Letzter Trick (für Anzeige) */
  u8 last_prop;
  u8 last_winner;
  u8 last_played_cards[PLAETZE_MAX];
  u8 last_played_seats[PLAETZE_MAX];
  u8 last_played_n;

  /* Bot-Gedächtnis für Sammeln */
  u8 known_holder[32]; /* KEIN oder seat */
} Quartett;

static u8 next_with_cards_stacks(const Quartett *q, u8 from) {
  u8 k;
  for (k = 1; k <= q->seats; k++) {
    u8 s = (from + k) % q->seats;
    if (q->stack_n[s] > 0) return s;
  }
  return KEIN;
}

static u8 next_with_cards_hands(const Quartett *q, u8 from) {
  u8 k;
  for (k = 1; k <= q->seats; k++) {
    u8 s = (from + k) % q->seats;
    if (q->hand_n[s] > 0) return s;
  }
  return KEIN;
}

static void hand_insert_sorted(Quartett *q, u8 seat, u8 card) {
  u8 n = q->hand_n[seat];
  u8 i = n;
  while (i > 0 && q->hands[seat][i - 1] > card) {
    q->hands[seat][i] = q->hands[seat][i - 1];
    i--;
  }
  q->hands[seat][i] = card;
  q->hand_n[seat] = n + 1;
}

static void lay_down(Quartett *q, u8 seat) {
  u8 g;
  for (g = 0; g < 8; g++) {
    u8 count = 0;
    u8 i;
    for (i = 0; i < q->hand_n[seat]; i++) {
      if (q->hands[seat][i] / 4 == g) count++;
    }
    if (count == 4) {
      u8 new_hand[32];
      u8 new_n = 0;
      for (i = 0; i < q->hand_n[seat]; i++) {
        if (q->hands[seat][i] / 4 != g) {
          new_hand[new_n++] = q->hands[seat][i];
        } else {
          q->known_holder[q->hands[seat][i]] = KEIN;
        }
      }
      for (i = 0; i < new_n; i++) q->hands[seat][i] = new_hand[i];
      q->hand_n[seat] = new_n;
      q->quartets[q->quartets_n].seat = seat;
      q->quartets[q->quartets_n].group = g;
      q->quartets_n++;
    }
  }
}

static void refill(Quartett *q, u8 seat);

static void draw_talon(Quartett *q, u8 seat) {
  if (q->talon_n == 0) return;
  {
    u8 card = q->talon[0];
    u8 i;
    for (i = 0; i < q->talon_n - 1; i++) q->talon[i] = q->talon[i + 1];
    q->talon_n--;
    hand_insert_sorted(q, seat, card);
    lay_down(q, seat);
    refill(q, seat);
  }
}

static void refill(Quartett *q, u8 seat) {
  if (q->hand_n[seat] > 0 || q->talon_n == 0) return;
  draw_talon(q, seat);
}

/* ------------------------------------------------------------------ Regeln */

static void quartett_aufbauen(u8 *stand, const u8 *optionen, u8 plaetze, const char *seed) {
  Quartett *q = (Quartett *)stand;
  u8 i, s;
  Zufall rng;
  u8 deck[32];

  q->mode = (optionen[0] == 1) ? 1 : 0;
  q->seats = plaetze;
  q->turn = 0;
  q->finished = 0;

  q->round = 0;
  q->round_limit = 30;
  if (optionen[1] == 1) q->round_limit = 15;
  else if (optionen[1] == 2) q->round_limit = 50;
  else if (optionen[1] == 3) q->round_limit = 0;

  q->middle_n = 0;
  for (s = 0; s < PLAETZE_MAX; s++) {
    q->stack_n[s] = 0;
    q->hand_n[s] = 0;
  }
  q->talon_n = 0;
  q->quartets_n = 0;
  q->last_prop = KEIN;
  q->last_winner = KEIN;
  q->last_played_n = 0;

  for (i = 0; i < 32; i++) {
    deck[i] = i;
    q->known_holder[i] = KEIN;
  }

  zufall_strom(&rng, seed, "karten");
  for (i = 31; i > 0; i--) {
    u8 j = (u8)zufall_bis(&rng, i + 1);
    u8 tmp = deck[i];
    deck[i] = deck[j];
    deck[j] = tmp;
  }

  if (q->mode == 0) {
    /* Trumpf: Alle 32 Karten gleichmäßig austeilen */
    for (i = 0; i < 32; i++) {
      u8 seat = i % plaetze;
      u8 idx = q->stack_n[seat]++;
      q->stacks[seat][idx].card = deck[i];
      q->stacks[seat][idx].open = 0;
    }
  } else {
    /* Sammeln */
    u8 hand_out = (plaetze <= 3) ? (7 * plaetze) : 32;
    for (i = 0; i < hand_out; i++) {
      u8 seat = i % plaetze;
      hand_insert_sorted(q, seat, deck[i]);
    }
    for (i = hand_out; i < 32; i++) {
      q->talon[q->talon_n++] = deck[i];
    }
    for (s = 0; s < plaetze; s++) {
      lay_down(q, s);
    }
    q->turn = next_with_cards_hands(q, plaetze - 1);
    if (q->turn == KEIN) q->turn = 0;
  }
}

static u8 quartett_ergebnis(const u8 *stand, u8 *sieger) {
  const Quartett *q = (const Quartett *)stand;
  u8 s;

  if (q->mode == 0) {
    /* Trumpf */
    u8 alive = 0;
    u8 alive_seat = 0;
    for (s = 0; s < q->seats; s++) {
      if (q->stack_n[s] > 0) {
        alive++;
        alive_seat = s;
      }
    }
    if (alive == 0) return ERGEBNIS_REMIS;
    if (alive == 1) {
      *sieger = (1 << alive_seat);
      return ERGEBNIS_SIEG;
    }
    if (q->round_limit > 0 && q->round >= q->round_limit) {
      u8 best = 0;
      u8 winners = 0;
      u8 win_mask = 0;
      for (s = 0; s < q->seats; s++) {
        if (q->stack_n[s] > best) best = q->stack_n[s];
      }
      for (s = 0; s < q->seats; s++) {
        if (q->stack_n[s] == best) {
          winners++;
          win_mask |= (1 << s);
        }
      }
      if (winners == q->seats) return ERGEBNIS_REMIS;
      *sieger = win_mask;
      return ERGEBNIS_SIEG;
    }
    return ERGEBNIS_LAEUFT;
  } else {
    /* Sammeln */
    if (q->quartets_n < 8) return ERGEBNIS_LAEUFT;
    {
      u8 counts[PLAETZE_MAX];
      u8 i, best = 0, winners = 0, win_mask = 0;
      for (s = 0; s < q->seats; s++) counts[s] = 0;
      for (i = 0; i < 8; i++) counts[q->quartets[i].seat]++;
      for (s = 0; s < q->seats; s++) {
        if (counts[s] > best) best = counts[s];
      }
      for (s = 0; s < q->seats; s++) {
        if (counts[s] == best) {
          winners++;
          win_mask |= (1 << s);
        }
      }
      if (winners == q->seats) return ERGEBNIS_REMIS;
      *sieger = win_mask;
      return ERGEBNIS_SIEG;
    }
  }
}

static u8 quartett_am_zug(const u8 *stand) {
  u8 dummy;
  if (quartett_ergebnis(stand, &dummy) != ERGEBNIS_LAEUFT) return PLATZ_KEIN;
  return ((const Quartett *)stand)->turn;
}

static u16 quartett_zuege(const u8 *stand, Zug *liste) {
  const Quartett *q = (const Quartett *)stand;
  u8 dummy;
  u8 actor = q->turn;
  u8 i;

  if (quartett_ergebnis(stand, &dummy) != ERGEBNIS_LAEUFT) return 0;

  if (q->mode == 0) {
    /* Trumpf: 5 Eigenschaften zur Auswahl */
    for (i = 0; i < 5; i++) {
      liste[i].n = 2;
      liste[i].b[0] = 0;
      liste[i].b[1] = i;
      liste[i].b[2] = 0;
      liste[i].b[3] = 0;
    }
    return 5;
  } else {
    /* Sammeln: Nach fehlenden Karten einer eigenen Gruppe fragen */
    u16 n = 0;
    u8 has_group[8];
    u8 has_card[32];
    u8 g, c, t;
    for (g = 0; g < 8; g++) has_group[g] = 0;
    for (c = 0; c < 32; c++) has_card[c] = 0;
    for (i = 0; i < q->hand_n[actor]; i++) {
      u8 card = q->hands[actor][i];
      has_group[card / 4] = 1;
      has_card[card] = 1;
    }
    for (c = 0; c < 32; c++) {
      if (has_group[c / 4] && !has_card[c]) {
        for (t = 0; t < q->seats; t++) {
          if (t != actor && q->hand_n[t] > 0) {
            liste[n].n = 3;
            liste[n].b[0] = 1;
            liste[n].b[1] = t;
            liste[n].b[2] = c;
            liste[n].b[3] = 0;
            n++;
          }
        }
      }
    }
    return n;
  }
}

static u8 quartett_ziehen(u8 *stand, const Zug *zug) {
  Quartett *q = (Quartett *)stand;
  u8 dummy;
  if (quartett_ergebnis(stand, &dummy) != ERGEBNIS_LAEUFT) return KLANG_KLICK;

  if (zug->b[0] == 0) {
    /* Trumpf */
    u8 prop = zug->b[1];
    u8 chooser = q->turn;
    u8 s, i;
    u8 plays_seat[PLAETZE_MAX];
    u8 plays_card[PLAETZE_MAX];
    u8 plays_n = 0;
    u32 best_val = 0;
    u8 best_seat = 0;
    u8 leaders_count = 0;

    if (prop >= 5) return KLANG_KLICK;

    for (s = 0; s < q->seats; s++) {
      if (q->stack_n[s] > 0) {
        u8 card = q->stacks[s][0].card;
        plays_seat[plays_n] = s;
        plays_card[plays_n] = card;
        plays_n++;
        for (i = 0; i < q->stack_n[s] - 1; i++) {
          q->stacks[s][i] = q->stacks[s][i + 1];
        }
        q->stack_n[s]--;
      }
    }

    q->last_prop = prop;
    q->last_played_n = plays_n;
    for (i = 0; i < plays_n; i++) {
      q->last_played_seats[i] = plays_seat[i];
      q->last_played_cards[i] = plays_card[i];
    }

    for (i = 0; i < plays_n; i++) {
      u32 val = quartett_werte[plays_card[i]][prop];
      if (i == 0 || val > best_val) {
        best_val = val;
        best_seat = plays_seat[i];
      }
    }

    for (i = 0; i < plays_n; i++) {
      u32 val = quartett_werte[plays_card[i]][prop];
      if (val == best_val) leaders_count++;
    }

    if (leaders_count == 1) {
      /* Ein Einzelsieger */
      u8 winner = best_seat;
      u8 won_cards[64];
      u8 won_n = 0;

      q->last_winner = winner;

      /* Reihenfolge: plays mit seat >= winner, dann seat < winner */
      for (i = 0; i < plays_n; i++) {
        if (plays_seat[i] >= winner) won_cards[won_n++] = plays_card[i];
      }
      for (i = 0; i < plays_n; i++) {
        if (plays_seat[i] < winner) won_cards[won_n++] = plays_card[i];
      }
      /* Mitte anhängen */
      for (i = 0; i < q->middle_n; i++) {
        won_cards[won_n++] = q->middle[i];
      }
      q->middle_n = 0;

      /* Gewonnene Karten unter den Stapel (offen) */
      for (i = 0; i < won_n; i++) {
        u8 idx = q->stack_n[winner]++;
        q->stacks[winner][idx].card = won_cards[i];
        q->stacks[winner][idx].open = 1;
      }
      q->turn = winner;
    } else {
      /* Gleichstand: Karten in die Mitte */
      q->last_winner = KEIN;
      for (i = 0; i < plays_n; i++) {
        q->middle[q->middle_n++] = plays_card[i];
      }
      if (q->stack_n[chooser] == 0) {
        u8 nxt = next_with_cards_stacks(q, chooser);
        q->turn = (nxt != KEIN) ? nxt : chooser;
      } else {
        q->turn = chooser;
      }
    }

    q->round++;
    return KLANG_KARTE;
  } else {
    /* Sammeln */
    u8 asker = q->turn;
    u8 target = zug->b[1];
    u8 card = zug->b[2];
    u8 got = 0;
    u8 i;

    for (i = 0; i < q->hand_n[target]; i++) {
      if (q->hands[target][i] == card) {
        got = 1;
        break;
      }
    }

    if (!got) {
      /* Niete: Asker zieht vom Stapel */
      draw_talon(q, asker);
      q->turn = target;
      q->known_holder[card] = KEIN;
    } else {
      /* Karte übergeben */
      u8 new_hand[32];
      u8 new_n = 0;
      for (i = 0; i < q->hand_n[target]; i++) {
        if (q->hands[target][i] != card) {
          new_hand[new_n++] = q->hands[target][i];
        }
      }
      for (i = 0; i < new_n; i++) q->hands[target][i] = new_hand[i];
      q->hand_n[target] = new_n;

      hand_insert_sorted(q, asker, card);
      q->known_holder[card] = asker;

      lay_down(q, asker);
      refill(q, target);
      refill(q, asker);

      if (q->hand_n[asker] > 0) {
        q->turn = asker;
      } else {
        u8 nxt = next_with_cards_hands(q, asker);
        q->turn = (nxt != KEIN) ? nxt : asker;
      }
    }
    return KLANG_KARTE;
  }
}

/* ------------------------------------------------------------------ Bot */

static void quartett_bot(const u8 *stand, u8 stufe, Zufall *z, Zug *zug) {
  const Quartett *q = (const Quartett *)stand;
  u16 anzahl = quartett_zuege(stand, zugliste);

  if (anzahl == 0) return;

  if (q->mode == 0) {
    /* Trumpf */
    u8 actor = q->turn;
    u8 own_card = q->stacks[actor][0].card;
    u8 p, best_p = 0;
    u16 best_score = 0;

    if (stufe == STUFE_LEICHT) {
      u16 w = zufall_bis(z, anzahl);
      *zug = zugliste[w];
      return;
    }

    /* Mittel/Schwer: Eigenschaft mit dem besten Rang auswählen */
    for (p = 0; p < 5; p++) {
      u32 my_val = quartett_werte[own_card][p];
      u16 score = 0;
      u8 c;
      for (c = 0; c < 32; c++) {
        if (c != own_card) {
          u32 other_val = quartett_werte[c][p];
          if (my_val > other_val) score += 2;
          else if (my_val == other_val) score += 1;
        }
      }
      if (score > best_score || p == 0) {
        best_score = score;
        best_p = p;
      }
    }

    zug->n = 2;
    zug->b[0] = 0;
    zug->b[1] = best_p;
    zug->b[2] = 0;
    zug->b[3] = 0;
  } else {
    /* Sammeln */
    u8 actor = q->turn;
    u16 i, best_idx = 0;
    s16 best_score = -1000;

    if (stufe == STUFE_LEICHT && zufall_bis(z, 10) < 3) {
      u16 w = zufall_bis(z, anzahl);
      *zug = zugliste[w];
      return;
    }

    for (i = 0; i < anzahl; i++) {
      u8 target = zugliste[i].b[1];
      u8 card = zugliste[i].b[2];
      u8 grp = card / 4;
      s16 score = 0;
      u8 j;

      /* Bevorzuge Gruppen, von denen man schon viele Karten hat */
      for (j = 0; j < q->hand_n[actor]; j++) {
        if (q->hands[actor][j] / 4 == grp) score += 10;
      }

      /* Wenn bekannt ist, dass Ziel die Karte hat: Riesenbonus! */
      if (q->known_holder[card] == target) {
        score += 100;
      }

      /* Ziele mit mehr Handkarten bevorzugen */
      score += q->hand_n[target];

      if (score > best_score) {
        best_score = score;
        best_idx = i;
      }
    }

    *zug = zugliste[best_idx];
  }
}

/* ------------------------------------------------------------------ Prüfmodus */

static u16 quartett_ausgeben(const u8 *stand, u8 *puffer) {
  const Quartett *q = (const Quartett *)stand;
  u16 n = 0;
  u8 s, i;

  puffer[n++] = q->mode;
  puffer[n++] = q->turn;

  if (q->mode == 0) {
    puffer[n++] = q->round;
    puffer[n++] = q->round_limit;
    puffer[n++] = q->middle_n;
    for (i = 0; i < q->middle_n; i++) puffer[n++] = q->middle[i];

    for (s = 0; s < q->seats; s++) {
      puffer[n++] = q->stack_n[s];
      for (i = 0; i < q->stack_n[s]; i++) {
        puffer[n++] = q->stacks[s][i].card;
        puffer[n++] = q->stacks[s][i].open;
      }
    }
  } else {
    puffer[n++] = q->talon_n;
    for (i = 0; i < q->talon_n; i++) puffer[n++] = q->talon[i];

    puffer[n++] = q->quartets_n;
    for (i = 0; i < q->quartets_n; i++) {
      puffer[n++] = q->quartets[i].seat;
      puffer[n++] = q->quartets[i].group;
    }

    for (s = 0; s < q->seats; s++) {
      puffer[n++] = q->hand_n[s];
      for (i = 0; i < q->hand_n[s]; i++) puffer[n++] = q->hands[s][i];
    }
  }

  return n;
}

/* ------------------------------------------------------------------ Oberfläche */

static void quartett_gitter(const u8 *stand, u8 *breite, u8 *hoehe) {
  const Quartett *q = (const Quartett *)stand;
  if (q->mode == 0) {
    *breite = 1;
    *hoehe = 5;
  } else {
    /* Sammeln: Liste möglicher Züge */
    u16 z = quartett_zuege(stand, zugliste);
    *breite = 1;
    *hoehe = (z > 12) ? 12 : ((z == 0) ? 1 : z);
  }
}

static u8 quartett_feld_an(const u8 *stand, u8 x, u8 y) {
  (void)stand;
  (void)x;
  return y;
}

static u8 quartett_felder(const u8 *stand, const Zug *zug, u8 *felder) {
  const Quartett *q = (const Quartett *)stand;
  if (q->mode == 0) {
    felder[0] = zug->b[1]; /* 0..4 */
    return 1;
  } else {
    u16 z = quartett_zuege(stand, zugliste);
    u16 i;
    for (i = 0; i < z; i++) {
      if (zugliste[i].b[1] == zug->b[1] && zugliste[i].b[2] == zug->b[2]) {
        felder[0] = (i < 12) ? i : 0;
        return 1;
      }
    }
    return 0;
  }
}

static void quartett_zeichnen(const u8 *stand, const u8 *markierung, u8 aktiv) {
  const Quartett *q = (const Quartett *)stand;
  u8 i, s;
  (void)aktiv;

  flaeche_leeren(0, 0, 32, 28);

  if (q->mode == 0) {
    /* Trumpf-Oberfläche */
    text(2, 2, "QUARTETT (TRUMPF)", PAL_GELB);
    text(22, 2, "Runde:", PAL_TEXT);
    zahl(29, 2, q->round + 1, 2, PAL_GELB);

    /* Stapel-Übersicht oben */
    for (s = 0; s < q->seats; s++) {
      u8 px = 2 + s * 7;
      text(px, 4, (s == 0) ? "Du:" : "S :", (s == q->turn) ? PAL_GELB : PAL_TEXT);
      if (s > 0) zahl(px + 1, 4, s + 1, 1, (s == q->turn) ? PAL_GELB : PAL_TEXT);
      zahl(px + 4, 4, q->stack_n[s], 2, PAL_TEXT);
    }

    if (q->middle_n > 0) {
      text(2, 6, "Mitte:", PAL_ROT);
      zahl(9, 6, q->middle_n, 2, PAL_ROT);
    }

    /* Eigene oberste Karte */
    if (q->stack_n[q->turn] > 0) {
      u8 card = q->stacks[q->turn][0].card;
      char id_buf[4];
      id_buf[0] = 'A' + (card / 4);
      id_buf[1] = '1' + (card % 4);
      id_buf[2] = ' ';
      id_buf[3] = 0;

      text(2, 8, id_buf, PAL_GELB);
      text(5, 8, quartett_namen[card], PAL_TEXT);

      /* 5 Eigenschaften */
      for (i = 0; i < 5; i++) {
        u8 y = 11 + i * 2;
        u8 mark = (markierung[i] & MARK_CURSOR);
        u8 pal = mark ? PAL_GELB : PAL_TEXT;
        u32 val = quartett_werte[card][i];

        text(2, y, mark ? ">" : " ", PAL_GELB);
        text(4, y, EIGENSCHAFTEN[i], pal);
        zahl(15, y, (u16)(val > 9999 ? 9999 : val), 4, pal);
        text(20, y, EINHEITEN[i], pal);
      }
    }
  } else {
    /* Sammeln-Oberfläche */
    text(2, 2, "QUARTETT (SAMMELN)", PAL_GELB);

    /* Spielerübersicht & Quartette */
    for (s = 0; s < q->seats; s++) {
      u8 q_cnt = 0;
      u8 px = 2 + s * 7;
      for (i = 0; i < q->quartets_n; i++) {
        if (q->quartets[i].seat == s) q_cnt++;
      }
      text(px, 4, (s == 0) ? "Du:" : "S :", (s == q->turn) ? PAL_GELB : PAL_TEXT);
      if (s > 0) zahl(px + 1, 4, s + 1, 1, (s == q->turn) ? PAL_GELB : PAL_TEXT);
      zahl(px + 4, 4, q->hand_n[s], 2, PAL_TEXT);
      text(px, 5, "Q:", PAL_GRAU);
      zahl(px + 3, 5, q_cnt, 1, PAL_GELB);
    }

    text(2, 7, "Talon:", PAL_TEXT);
    zahl(9, 7, q->talon_n, 2, PAL_TEXT);

    /* Eigene Handkarten unten */
    text(2, 18, "Deine Hand:", PAL_TEXT);
    for (i = 0; i < q->hand_n[0]; i++) {
      u8 c = q->hands[0][i];
      u8 x = 2 + (i % 8) * 3;
      u8 y = 20 + (i / 8) * 3;
      if (y + 3 <= 28) {
        karten_koerper(x, y, KARTEN_BLANKO, PAL_BRETT);
        {
          char id_buf[3];
          id_buf[0] = 'A' + (c / 4);
          id_buf[1] = '1' + (c % 4);
          id_buf[2] = 0;
          text(x, y + 1, id_buf, PAL_TEXT);
        }
      }
    }
  }
}

/* ------------------------------------------------------------------ Steckbrief */

static const char *const ANLEITUNG[] = {
  "Trumpf: Waehle den besten Wert",
  "deiner Karte. Wer den hoechsten",
  "Wert hat, gewinnt die Runde.",
  "",
  "Sammeln: Frage Mitspieler nach",
  "fehlenden Karten deiner Gruppen.",
  "Wer die meisten Quartette hat, siegt!",
  0
};

static const char *const OPT_MODE[] = {"Trumpf", "Sammeln"};
static const char *const OPT_ROUNDS[] = {"30 Runden", "15 Runden", "50 Runden", "Endlos"};

static const Option OPTIONEN[] = {
  {"Spielweise", OPT_MODE, 2, 0},
  {"Rundenlimit", OPT_ROUNDS, 4, 0},
};

static const char *const PLATZ_NAMEN[] = {"Spieler 1", "Spieler 2", "Spieler 3", "Spieler 4"};
static const u8 PLATZ_PALETTEN[] = {PAL_ROT, PAL_BLAU, PAL_GELB, PAL_GRAU};

const Spiel spiel_quartett = {
  "Quartett",
  ANLEITUNG,
  "A Auswaehlen",
  PLATZ_NAMEN,
  PLATZ_PALETTEN,
  2, 4,
  1, /* verdeckt */
  OPTIONEN,
  2,
  FARBEN_KARTEN,
  quartett_aufbauen,
  quartett_am_zug,
  quartett_zuege,
  quartett_ziehen,
  quartett_ergebnis,
  quartett_bot,
  quartett_ausgeben,
  quartett_gitter,
  quartett_feld_an,
  quartett_felder,
  quartett_zeichnen,
  0, 0,
};
