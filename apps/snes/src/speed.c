/*
 * Speed für Brett & Blatt 16 – nach packages/games/speed/src/rules.ts.
 * 2 Spieler, 52 Karten, Echtzeit-Ablage auf 2 Mittelstapel mit +/- 1 Wert.
 *
 * Karten (0..51):
 *   card = suit * 13 + (rank - 1)
 *   suit: 0: Kreuz, 1: Karo, 2: Herz, 3: Pik
 *   rank: 1..13 (1: Ass, 2..10, 11: Bube, 12: Dame, 13: König)
 *
 * Züge:
 *   [0, Karte, Stapel] – Karte auf Ablagestapel (0 oder 1) legen
 *   [1, 0]             – Festhängen ("stuck")
 *   [2, 0]             – Karte nachziehen (bei manuellem Nachziehen)
 *   [3, 0]             – Bereit für nächste Runde
 */
#include "spiel.h"
#include "bild.h"
#include "klang.h"
#include "karten.h"
#include "../res/grafik.h"

#define KEIN 0xff

enum { PHASE_PLAY, PHASE_ROUND_END, PHASE_GAME_END };

typedef struct {
  u8 phase;
  u8 seats;
  u8 round;
  u8 max_wins; /* 1 (r1), 2 (b3), 3 (b5) */

  /* Optionen */
  u8 draw_mode; /* 0: auto, 1: manual */
  u8 wrap;      /* 1: Ass rund (K-A-2), 0: nicht */

  /* Spieler */
  u8 hand_n[2];
  u8 hands[2][5];
  u8 draw_n[2];
  u8 draw[2][32];
  u8 stuck[2];
  u8 ready[2];
  u8 wins[2];

  /* Stapel */
  u8 piles_n;       /* 2 */
  u8 pile_n[2];
  u8 piles[2][52];

  /* Seitenstapel */
  u8 side_n[2];
  u8 sides[2][26];

  Zufall rng;
} Speed;

static u8 card_rank(u8 card) {
  return (card % 13) + 1;
}

static u8 card_suit(u8 card) {
  return card / 13;
}

static u8 fits(u8 card, u8 top, u8 wrap) {
  u8 r1 = card_rank(card);
  u8 r2 = card_rank(top);
  u8 diff = (r1 > r2) ? (r1 - r2) : (r2 - r1);
  return (diff == 1) || (wrap && diff == 12);
}

static void deal_speed(Speed *p) {
  u8 deck[52];
  u8 i, s;

  for (i = 0; i < 52; i++) deck[i] = i;

  for (i = 51; i > 0; i--) {
    u8 j = (u8)zufall_bis(&p->rng, i + 1);
    u8 tmp = deck[i];
    deck[i] = deck[j];
    deck[j] = tmp;
  }

  /* 2 Spieler:
   * P0: 5 Hand, 15 Draw
   * P1: 5 Hand, 15 Draw
   * Side 0: 5
   * Side 1: 5
   * Pile 0: 1
   * Pile 1: 1
   */
  p->hand_n[0] = 5;
  for (i = 0; i < 5; i++) p->hands[0][i] = deck[i];

  p->draw_n[0] = 15;
  for (i = 0; i < 15; i++) p->draw[0][i] = deck[5 + i];

  p->hand_n[1] = 5;
  for (i = 0; i < 5; i++) p->hands[1][i] = deck[20 + i];

  p->draw_n[1] = 15;
  for (i = 0; i < 15; i++) p->draw[1][i] = deck[25 + i];

  p->side_n[0] = 5;
  for (i = 0; i < 5; i++) p->sides[0][i] = deck[40 + i];

  p->side_n[1] = 5;
  for (i = 0; i < 5; i++) p->sides[1][i] = deck[45 + i];

  p->piles_n = 2;
  p->pile_n[0] = 1;
  p->piles[0][0] = deck[50];

  p->pile_n[1] = 1;
  p->piles[1][0] = deck[51];

  for (s = 0; s < 2; s++) {
    p->stuck[s] = 0;
    p->ready[s] = 0;
  }
}

static void unjam_speed(Speed *p) {
  u8 i;

  if (p->draw_mode == 1) {
    /* Manual draw: try to fill hands first */
    u8 drew = 0;
    u8 s;
    for (s = 0; s < 2; s++) {
      while (p->hand_n[s] < 5 && p->draw_n[s] > 0) {
        u8 card = p->draw[s][0];
        u8 j;
        for (j = 0; j < p->draw_n[s] - 1; j++) p->draw[s][j] = p->draw[s][j + 1];
        p->draw_n[s]--;
        p->hands[s][p->hand_n[s]++] = card;
        drew = 1;
      }
    }
    if (drew) {
      p->stuck[0] = 0;
      p->stuck[1] = 0;
      return;
    }
  }

  if (p->side_n[0] == 0 && p->side_n[1] == 0) {
    /* Reshuffle piles into sides */
    u8 rest[52];
    u8 rest_n = 0;
    u8 s;
    for (s = 0; s < 2; s++) {
      u8 j;
      for (j = 0; j < p->pile_n[s] - 1; j++) {
        rest[rest_n++] = p->piles[s][j];
      }
      p->piles[s][0] = p->piles[s][p->pile_n[s] - 1];
      p->pile_n[s] = 1;
    }
    for (i = rest_n - 1; i > 0; i--) {
      u8 j = (u8)zufall_bis(&p->rng, i + 1);
      u8 tmp = rest[i];
      rest[i] = rest[j];
      rest[j] = tmp;
    }
    {
      u8 half = (rest_n + 1) / 2;
      p->side_n[0] = half;
      for (i = 0; i < half; i++) p->sides[0][i] = rest[i];
      p->side_n[1] = rest_n - half;
      for (i = 0; i < p->side_n[1]; i++) p->sides[1][i] = rest[half + i];
    }
  }

  for (i = 0; i < 2; i++) {
    u8 side_idx = i;
    u8 card = KEIN;
    if (p->side_n[side_idx] > 0) {
      card = p->sides[side_idx][0];
      {
        u8 j;
        for (j = 0; j < p->side_n[side_idx] - 1; j++) p->sides[side_idx][j] = p->sides[side_idx][j + 1];
        p->side_n[side_idx]--;
      }
    } else if (p->side_n[1 - side_idx] > 0) {
      card = p->sides[1 - side_idx][0];
      {
        u8 j;
        for (j = 0; j < p->side_n[1 - side_idx] - 1; j++) p->sides[1 - side_idx][j] = p->sides[1 - side_idx][j + 1];
        p->side_n[1 - side_idx]--;
      }
    }
    if (card != KEIN) {
      p->piles[i][p->pile_n[i]++] = card;
    }
  }

  p->stuck[0] = 0;
  p->stuck[1] = 0;
}

static void end_round_speed(Speed *p, u8 winner) {
  p->wins[winner]++;
  p->ready[0] = 0;
  p->ready[1] = 0;
  if (p->wins[winner] >= p->max_wins) {
    p->phase = PHASE_GAME_END;
  } else {
    p->phase = PHASE_ROUND_END;
  }
}

static void start_round_speed(Speed *p) {
  p->round++;
  deal_speed(p);
  p->phase = PHASE_PLAY;
}

/* ------------------------------------------------------------------ Regeln */

static void speed_aufbauen(u8 *stand, const u8 *optionen, u8 plaetze, const char *seed) {
  Speed *p = (Speed *)stand;
  (void)plaetze;

  p->seats = 2;
  p->round = 1;
  p->max_wins = (optionen[0] == 1) ? 2 : 1; /* b3 oder r1 */
  p->draw_mode = (optionen[1] == 1) ? 1 : 0; /* manual oder auto */
  p->wrap = (optionen[2] == 1) ? 0 : 1;      /* 0: wrap off, 1: wrap on */

  p->wins[0] = 0;
  p->wins[1] = 0;

  zufall_strom(&p->rng, seed, "speed");
  deal_speed(p);
  p->phase = PHASE_PLAY;
}

static u8 speed_ergebnis(const u8 *stand, u8 *sieger) {
  const Speed *p = (const Speed *)stand;
  if (p->phase != PHASE_GAME_END) return ERGEBNIS_LAEUFT;
  if (p->wins[0] >= p->max_wins) {
    *sieger = 1;
    return ERGEBNIS_SIEG;
  }
  if (p->wins[1] >= p->max_wins) {
    *sieger = 2;
    return ERGEBNIS_SIEG;
  }
  return ERGEBNIS_REMIS;
}

static u8 speed_am_zug(const u8 *stand) {
  const Speed *p = (const Speed *)stand;
  u8 dummy;
  if (speed_ergebnis(stand, &dummy) != ERGEBNIS_LAEUFT) return PLATZ_KEIN;
  if (p->phase == PHASE_PLAY) {
    if (!p->stuck[0]) return 0;
    if (!p->stuck[1]) return 1;
    return 0;
  }
  if (p->phase == PHASE_ROUND_END) {
    if (!p->ready[0]) return 0;
    if (!p->ready[1]) return 1;
  }
  return PLATZ_KEIN;
}

static u16 speed_zuege(const u8 *stand, Zug *liste) {
  const Speed *p = (const Speed *)stand;
  u8 actor = speed_am_zug(stand);
  u16 n = 0;
  u8 i, pile;

  if (actor == PLATZ_KEIN) return 0;

  if (p->phase == PHASE_ROUND_END) {
    liste[0].n = 2;
    liste[0].b[0] = 3;
    liste[0].b[1] = 0;
    return 1;
  }

  /* Legen */
  for (i = 0; i < p->hand_n[actor]; i++) {
    u8 card = p->hands[actor][i];
    for (pile = 0; pile < p->piles_n; pile++) {
      u8 top = p->piles[pile][p->pile_n[pile] - 1];
      if (fits(card, top, p->wrap)) {
        liste[n].n = 3;
        liste[n].b[0] = 0;
        liste[n].b[1] = card;
        liste[n].b[2] = pile;
        n++;
      }
    }
  }

  /* Nachziehen bei Hand-Modus */
  if (p->draw_mode == 1 && p->hand_n[actor] < 5 && p->draw_n[actor] > 0) {
    liste[n].n = 2;
    liste[n].b[0] = 2;
    liste[n].b[1] = 0;
    n++;
  }

  /* Stuck */
  liste[n].n = 2;
  liste[n].b[0] = 1;
  liste[n].b[1] = 0;
  n++;

  return n;
}

static u8 speed_ziehen(u8 *stand, const Zug *zug) {
  Speed *p = (Speed *)stand;
  u8 actor = speed_am_zug(stand);
  u8 typ = zug->b[0];

  if (actor == PLATZ_KEIN) return KLANG_KLICK;

  if (typ == 3) {
    /* Ready */
    p->ready[actor] = 1;
    if (p->ready[0] && p->ready[1]) start_round_speed(p);
    return KLANG_KLICK;
  }

  if (typ == 2) {
    /* Draw */
    if (p->draw_n[actor] > 0) {
      u8 card = p->draw[actor][0];
      u8 i;
      for (i = 0; i < p->draw_n[actor] - 1; i++) p->draw[actor][i] = p->draw[actor][i + 1];
      p->draw_n[actor]--;
      p->hands[actor][p->hand_n[actor]++] = card;
    }
    return KLANG_KARTE;
  }

  if (typ == 1) {
    /* Stuck */
    p->stuck[actor] = 1;
    if (p->stuck[0] && p->stuck[1]) unjam_speed(p);
    return KLANG_KLICK;
  }

  if (typ == 0) {
    /* Play */
    u8 card = zug->b[1];
    u8 pile = zug->b[2];
    u8 i;

    /* Remove from hand */
    for (i = 0; i < p->hand_n[actor]; i++) {
      if (p->hands[actor][i] == card) {
        u8 j;
        for (j = i; j < p->hand_n[actor] - 1; j++) p->hands[actor][j] = p->hands[actor][j + 1];
        p->hand_n[actor]--;
        break;
      }
    }

    /* Place on pile */
    p->piles[pile][p->pile_n[pile]++] = card;

    /* Auto draw */
    if (p->draw_mode == 0) {
      while (p->hand_n[actor] < 5 && p->draw_n[actor] > 0) {
        u8 drawn = p->draw[actor][0];
        u8 j;
        for (j = 0; j < p->draw_n[actor] - 1; j++) p->draw[actor][j] = p->draw[actor][j + 1];
        p->draw_n[actor]--;
        p->hands[actor][p->hand_n[actor]++] = drawn;
      }
    }

    p->stuck[0] = 0;
    p->stuck[1] = 0;

    if (p->hand_n[actor] == 0 && p->draw_n[actor] == 0) {
      end_round_speed(p, actor);
    }

    return KLANG_KARTE;
  }

  return KLANG_KLICK;
}

/* ------------------------------------------------------------------ Bot */

static void speed_bot(const u8 *stand, u8 stufe, Zufall *z, Zug *zug) {
  u16 anzahl = speed_zuege(stand, zugliste);
  u16 i;

  if (anzahl == 0) return;

  if (stufe == STUFE_LEICHT && zufall_bis(z, 10) < 3) {
    u16 w = zufall_bis(z, anzahl);
    *zug = zugliste[w];
    return;
  }

  /* Bevorzuge play-Züge vor Draw oder Stuck */
  for (i = 0; i < anzahl; i++) {
    if (zugliste[i].b[0] == 0) {
      *zug = zugliste[i];
      return;
    }
  }

  /* Bei Manual Draw: Ziehen wenn möglich */
  for (i = 0; i < anzahl; i++) {
    if (zugliste[i].b[0] == 2) {
      *zug = zugliste[i];
      return;
    }
  }

  /* Sonst Stuck oder Ready */
  *zug = zugliste[0];
}

/* ------------------------------------------------------------------ Prüfmodus */

static u16 speed_ausgeben(const u8 *stand, u8 *puffer) {
  const Speed *p = (const Speed *)stand;
  u16 n = 0;
  u8 s, i;

  puffer[n++] = p->phase;
  puffer[n++] = p->round;
  puffer[n++] = p->wins[0];
  puffer[n++] = p->wins[1];
  puffer[n++] = p->stuck[0];
  puffer[n++] = p->stuck[1];
  puffer[n++] = p->ready[0];
  puffer[n++] = p->ready[1];

  for (s = 0; s < 2; s++) {
    puffer[n++] = p->pile_n[s];
    for (i = 0; i < p->pile_n[s]; i++) puffer[n++] = p->piles[s][i];
  }

  for (s = 0; s < 2; s++) {
    puffer[n++] = p->side_n[s];
    for (i = 0; i < p->side_n[s]; i++) puffer[n++] = p->sides[s][i];
  }

  for (s = 0; s < 2; s++) {
    puffer[n++] = p->hand_n[s];
    for (i = 0; i < p->hand_n[s]; i++) puffer[n++] = p->hands[s][i];
    puffer[n++] = p->draw_n[s];
    for (i = 0; i < p->draw_n[s]; i++) puffer[n++] = p->draw[s][i];
  }

  for (i = 0; i < 4; i++) {
    u32 v = p->rng.s[i];
    puffer[n++] = v & 0xff;
    puffer[n++] = (v >> 8) & 0xff;
    puffer[n++] = (v >> 16) & 0xff;
    puffer[n++] = (v >> 24) & 0xff;
  }

  return n;
}

/* ------------------------------------------------------------------ Oberfläche */

static void speed_gitter(const u8 *stand, u8 *breite, u8 *hoehe) {
  u16 z = speed_zuege(stand, zugliste);
  *breite = 1;
  *hoehe = (z > 10) ? 10 : ((z == 0) ? 1 : z);
}

static u8 speed_feld_an(const u8 *stand, u8 x, u8 y) {
  (void)stand;
  (void)x;
  return y;
}

static u8 speed_felder(const u8 *stand, const Zug *zug, u8 *felder) {
  u16 z = speed_zuege(stand, zugliste);
  u16 i;
  for (i = 0; i < z; i++) {
    if (zug_gleich(&zugliste[i], zug)) {
      felder[0] = (i < 10) ? i : 0;
      return 1;
    }
  }
  return 0;
}

static void speed_zeichnen(const u8 *stand, const u8 *markierung, u8 aktiv) {
  const Speed *p = (const Speed *)stand;
  u8 i;
  (void)aktiv;
  (void)markierung;

  flaeche_leeren(0, 0, 32, 28);
  text(2, 2, "SPEED (ECHTZEIT)", PAL_GELB);
  text(22, 2, "Runde:", PAL_TEXT);
  zahl(29, 2, p->round, 2, PAL_GELB);

  /* Gegner oben */
  text(2, 4, "Gegner Hand:", PAL_TEXT);
  zahl(15, 4, p->hand_n[1], 2, PAL_TEXT);
  text(18, 4, "Draw:", PAL_TEXT);
  zahl(24, 4, p->draw_n[1], 2, PAL_TEXT);

  /* Mittelstapel */
  text(4, 9, "Seite 1", PAL_GRAU);
  zahl(5, 15, p->side_n[0], 2, PAL_TEXT);

  text(11, 9, "Stapel 1", PAL_TEXT);
  if (p->pile_n[0] > 0) {
    u8 c = p->piles[0][p->pile_n[0] - 1];
    karten_zahl(11, 11, card_suit(c), card_rank(c), 1, PAL_BRETT);
  }

  text(18, 9, "Stapel 2", PAL_TEXT);
  if (p->pile_n[1] > 0) {
    u8 c = p->piles[1][p->pile_n[1] - 1];
    karten_zahl(18, 11, card_suit(c), card_rank(c), 1, PAL_BRETT);
  }

  text(25, 9, "Seite 2", PAL_GRAU);
  zahl(26, 15, p->side_n[1], 2, PAL_TEXT);

  /* Eigene Hand unten */
  text(2, 18, "Deine Hand:", PAL_TEXT);
  text(18, 18, "Vorrat:", PAL_TEXT);
  zahl(26, 18, p->draw_n[0], 2, PAL_TEXT);

  for (i = 0; i < p->hand_n[0]; i++) {
    u8 c = p->hands[0][i];
    u8 x = 2 + i * 4;
    u8 y = 20;
    karten_zahl(x, y, card_suit(c), card_rank(c), 1, PAL_BRETT);
  }
}

/* ------------------------------------------------------------------ Steckbrief */

static const char *const ANLEITUNG[] = {
  "Lege Handkarten passend (+/-1 Wert)",
  "auf einen der beiden Mittelstapel.",
  "Ass passt auf 2 oder Koenig.",
  "Wer keine Zuege hat, meldet 'Stuck'.",
  "Sind beide stuck, decken neue",
  "Karten von den Seitenstapeln auf.",
  "Wer zuerst alle Karten los ist, siegt!",
  0
};

static const char *const OPT_GOAL[] = {"1 Runde", "Best of 3"};
static const char *const OPT_DRAW[] = {"Automatisch", "Von Hand"};
static const char *const OPT_WRAP[] = {"Ass rund (K-A)", "Kein Umbruch"};

static const Option OPTIONEN[] = {
  {"Ziel", OPT_GOAL, 2, 0},
  {"Nachziehen", OPT_DRAW, 2, 0},
  {"Ass rund", OPT_WRAP, 2, 0},
};

static const char *const PLATZ_NAMEN[] = {"Spieler 1", "Spieler 2"};
static const u8 PLATZ_PALETTEN[] = {PAL_ROT, PAL_BLAU};

const Spiel spiel_speed = {
  "Speed",
  ANLEITUNG,
  "A Karte legen",
  PLATZ_NAMEN,
  PLATZ_PALETTEN,
  2, 2,
  0, /* nicht verdeckt, offene Hände am gemeinsamen Bildschirm */
  OPTIONEN,
  3,
  FARBEN_KARTEN,
  speed_aufbauen,
  speed_am_zug,
  speed_zuege,
  speed_ziehen,
  speed_ergebnis,
  speed_bot,
  speed_ausgeben,
  speed_gitter,
  speed_feld_an,
  speed_felder,
  speed_zeichnen,
  0, 0,
};
