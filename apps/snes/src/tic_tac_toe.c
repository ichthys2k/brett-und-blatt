/*
 * Tic-Tac-Toe für Brett & Blatt 16 – nach packages/games/tic-tac-toe/src/rules.ts.
 * Der Vergleichstest (test/snes.test.ts) spielt Zufallspartien hier und in der Web-App
 * und verlangt nach jedem Zug denselben Stand.
 */
#include "spiel.h"
#include "bild.h"
#include "klang.h"

typedef struct {
  u8 brett[9]; /* 0 leer, 1 Kreuz (Platz 0), 2 Kreis (Platz 1) */
  u8 zug;      /* Platz am Zug – wie `turn`, wechselt auch nach dem letzten Zug */
  u8 sieger;   /* Platz oder PLATZ_KEIN */
  u8 reihe[3]; /* Gewinnreihe, sonst PLATZ_KEIN */
  u8 belegt;
} Ttt;

/* Dieselbe Reihenfolge wie LINES in rules.ts – sie bestimmt, welche Reihe bei zwei Treffern gilt. */
static const u8 REIHEN[8][3] = {
  {0, 1, 2}, {3, 4, 5}, {6, 7, 8}, {0, 3, 6}, {1, 4, 7}, {2, 5, 8}, {0, 4, 8}, {2, 4, 6},
};

static void ttt_aufbauen(u8 *stand, Zufall *z) {
  Ttt *t = (Ttt *)stand;
  u8 i;
  (void)z;
  for (i = 0; i < 9; i++) t->brett[i] = 0;
  t->zug = 0;
  t->sieger = PLATZ_KEIN;
  t->reihe[0] = t->reihe[1] = t->reihe[2] = PLATZ_KEIN;
  t->belegt = 0;
}

static u8 ttt_ergebnis(const u8 *stand, u8 *sieger) {
  const Ttt *t = (const Ttt *)stand;
  if (t->sieger != PLATZ_KEIN) {
    if (sieger) *sieger = t->sieger;
    return ERGEBNIS_SIEG;
  }
  if (t->belegt == 9) return ERGEBNIS_REMIS;
  return ERGEBNIS_LAEUFT;
}

static u8 ttt_am_zug(const u8 *stand) {
  if (ttt_ergebnis(stand, 0) != ERGEBNIS_LAEUFT) return PLATZ_KEIN;
  return ((const Ttt *)stand)->zug;
}

static u8 ttt_zuege(const u8 *stand, u16 *zuege) {
  const Ttt *t = (const Ttt *)stand;
  u8 i, n = 0;
  if (ttt_ergebnis(stand, 0) != ERGEBNIS_LAEUFT) return 0;
  for (i = 0; i < 9; i++)
    if (t->brett[i] == 0) zuege[n++] = i;
  return n;
}

static u8 ttt_ziehen(u8 *stand, u16 zug) {
  Ttt *t = (Ttt *)stand;
  u8 zeichen = t->zug + 1;
  u8 r;
  t->brett[zug] = zeichen;
  t->belegt++;
  for (r = 0; r < 8; r++) {
    if (t->brett[REIHEN[r][0]] == zeichen && t->brett[REIHEN[r][1]] == zeichen && t->brett[REIHEN[r][2]] == zeichen) {
      t->sieger = t->zug;
      t->reihe[0] = REIHEN[r][0];
      t->reihe[1] = REIHEN[r][1];
      t->reihe[2] = REIHEN[r][2];
      break;
    }
  }
  t->zug ^= 1;
  return KLANG_SETZEN;
}

static u8 ttt_ausgeben(const u8 *stand, u8 *puffer) {
  const Ttt *t = (const Ttt *)stand;
  u8 i;
  for (i = 0; i < 9; i++) puffer[i] = t->brett[i] == 0 ? PLATZ_KEIN : t->brett[i] - 1;
  puffer[9] = t->zug;
  puffer[10] = t->sieger;
  puffer[11] = t->reihe[0];
  puffer[12] = t->reihe[1];
  puffer[13] = t->reihe[2];
  return 14;
}

/* ------------------------------------------------------------------ Bot */

/*
 * Die Suche rechnet mit Bitmasken (ein Bit je Feld), weil der 65816 mit 816-tcc langsam ist:
 * Die erste Fassung mit Feldern brauchte für die zweite Antwort sieben Sekunden.
 */
static const u16 BIT[9] = {1, 2, 4, 8, 16, 32, 64, 128, 256};
static const u16 LINIE[8] = {0x007, 0x038, 0x1c0, 0x049, 0x092, 0x124, 0x111, 0x054};
/* Reihen durch jedes Feld (Index in LINIE), mit 8 beendet. */
static const u8 LINIEN_DURCH[9][5] = {
  {0, 3, 6, 8, 8}, {0, 4, 8, 8, 8}, {0, 5, 7, 8, 8}, {1, 3, 8, 8, 8}, {1, 4, 6, 7, 8},
  {1, 5, 8, 8, 8}, {2, 3, 7, 8, 8}, {2, 4, 8, 8, 8}, {2, 5, 6, 8, 8},
};
/* Suchreihenfolge: Mitte, Ecken, Kanten – gute Züge zuerst, dann schneidet Alpha-Beta mehr ab. */
static const u8 REIHENFOLGE[9] = {4, 0, 2, 6, 8, 1, 3, 5, 7};

static u8 gewinnt(u16 eigen, u8 feld) {
  const u8 *l = LINIEN_DURCH[feld];
  u16 m;
  while (*l != 8) {
    m = LINIE[*l];
    if ((eigen & m) == m) return 1;
    l++;
  }
  return 0;
}

/* Feld, mit dem `eigen` sofort gewinnt, sonst 9. */
static u8 gewinnfeld(u16 eigen, u16 belegt) {
  u8 i;
  for (i = 0; i < 9; i++) {
    if (belegt & BIT[i]) continue;
    if (gewinnt(eigen | BIT[i], i)) return i;
  }
  return 9;
}

/* Negamax mit Alpha-Beta. Wert aus Sicht von `eigen` (am Zug): schnelle Siege zählen mehr. */
static s16 suche(u16 eigen, u16 gegner, u8 frei, s16 alpha, s16 beta) {
  s16 bester = -100;
  s16 wert;
  u8 k, i;
  u16 belegt = eigen | gegner;
  if (frei == 0) return 0;
  for (k = 0; k < 9; k++) {
    i = REIHENFOLGE[k];
    if (belegt & BIT[i]) continue;
    if (gewinnt(eigen | BIT[i], i)) return frei;
    wert = -suche(gegner, eigen | BIT[i], frei - 1, -beta, -alpha);
    if (wert > bester) {
      bester = wert;
      if (bester > alpha) alpha = bester;
      if (alpha >= beta) break;
    }
  }
  return bester;
}

static u16 zufaelliger_zug(const u8 *stand, Zufall *z) {
  u16 zuege[9];
  u8 n = ttt_zuege(stand, zuege);
  return zuege[zufall_bis(z, n)];
}

static u16 ttt_bot(const u8 *stand, u8 stufe, Zufall *z) {
  const Ttt *t = (const Ttt *)stand;
  u16 eigen = 0, gegner = 0, belegt;
  u8 i, k, n, frei;
  u16 beste[9];
  s16 wert, bester;
  for (i = 0; i < 9; i++) {
    if (t->brett[i] == t->zug + 1) eigen |= BIT[i];
    else if (t->brett[i]) gegner |= BIT[i];
  }
  belegt = eigen | gegner;
  frei = 9 - t->belegt;

  if (stufe == STUFE_SCHWER) {
    // Leeres Brett: Mitte oder Ecke – jeder erste Zug hält das Remis, so bleibt es abwechslungsreich.
    if (frei == 9) {
      static const u8 ERSTE[5] = {4, 0, 2, 6, 8};
      return ERSTE[zufall_bis(z, 5)];
    }
    // Antwort auf den ersten Zug aus der Eröffnungslehre: Mitte genommen → Ecke, sonst Mitte.
    // Beides hält das Remis; die volle Suche bräuchte hier Sekunden.
    if (frei == 8) {
      static const u8 ECKEN[4] = {0, 2, 6, 8};
      if (gegner == BIT[4]) return ECKEN[zufall_bis(z, 4)];
      return 4;
    }
    // Jeden Zug genau bewerten und unter den besten zufällig wählen.
    bester = -100;
    n = 0;
    for (k = 0; k < 9; k++) {
      i = REIHENFOLGE[k];
      if (belegt & BIT[i]) continue;
      wert = gewinnt(eigen | BIT[i], i) ? frei : -suche(gegner, eigen | BIT[i], frei - 1, -100, 100);
      if (wert > bester) {
        bester = wert;
        n = 0;
      }
      if (wert == bester) beste[n++] = i;
    }
    return beste[zufall_bis(z, n)];
  }

  // Leicht: jeder zweite Zug ist zufällig (wie in der Web-App).
  if (stufe == STUFE_LEICHT && zufall_halb(z)) return zufaelliger_zug(stand, z);
  // Mittel: gewinnen, sonst abwehren, sonst Mitte, sonst zufällig.
  i = gewinnfeld(eigen, belegt);
  if (i < 9) return i;
  i = gewinnfeld(gegner, belegt);
  if (i < 9) return i;
  if (!(belegt & BIT[4])) return 4;
  return zufaelliger_zug(stand, z);
}

/* ------------------------------------------------------------------ Oberfläche */

#define BRETT_X 7
#define BRETT_Y 5

static void ttt_zeichnen(const u8 *stand, u16 auswahl, u8 cursor) {
  const Ttt *t = (const Ttt *)stand;
  u8 i, pal;
  u16 bild;
  u8 laeuft = ttt_ergebnis(stand, 0) == ERGEBNIS_LAEUFT;
  for (i = 0; i < 9; i++) {
    pal = PAL_BRETT;
    if (t->sieger != PLATZ_KEIN && (t->reihe[0] == i || t->reihe[1] == i || t->reihe[2] == i)) pal = PAL_BRETT_SIEG;
    else if (cursor && laeuft && i == auswahl) pal = PAL_BRETT_AUSWAHL;
    if (t->brett[i] == 1) bild = K_FELD_KREUZ;
    else if (t->brett[i] == 2) bild = K_FELD_KREIS;
    else if (cursor && laeuft && i == auswahl) bild = t->zug == 0 ? K_FELD_GEIST_KREUZ : K_FELD_GEIST_KREIS;
    else bild = K_FELD_LEER;
    kachelblock(BRETT_X + (i % 3) * FELD_KACHELN, BRETT_Y + (i / 3) * FELD_KACHELN, bild, FELD_KACHELN, FELD_KACHELN, pal);
  }
}

static u16 ttt_bedienen(const u8 *stand, u16 *auswahl, u16 tasten) {
  const Ttt *t = (const Ttt *)stand;
  u8 x = *auswahl % 3;
  u8 y = *auswahl / 3;
  if (tasten & KEY_LEFT) x = x == 0 ? 2 : x - 1;
  if (tasten & KEY_RIGHT) x = x == 2 ? 0 : x + 1;
  if (tasten & KEY_UP) y = y == 0 ? 2 : y - 1;
  if (tasten & KEY_DOWN) y = y == 2 ? 0 : y + 1;
  *auswahl = y * 3 + x;
  if ((tasten & KEY_A) && t->brett[*auswahl] == 0) return *auswahl;
  return ZUG_KEIN;
}

/* ------------------------------------------------------------------ Steckbrief */

/* Wortlaut aus packages/games/tic-tac-toe/src/meta.ts (howToPlay); bild.c bricht die Zeilen um. */
static const char *const ANLEITUNG[] = {
  "Ihr setzt abwechselnd euer Zeichen (Kreuz oder Kreis) in ein freies Feld.",
  "Wer zuerst drei Zeichen in einer Reihe hat – waagerecht, senkrecht oder diagonal –, gewinnt.",
  "Ist das Feld voll ohne Dreierreihe, endet die Partie unentschieden.",
  0,
};
static const char *const PLATZ_NAMEN[] = {"Kreuz", "Kreis"};
static const u8 PLATZ_PALETTEN[] = {PAL_ROT, PAL_BLAU};

const Spiel spiel_tic_tac_toe = {
  "Tic-Tac-Toe",
  ANLEITUNG,
  PLATZ_NAMEN,
  PLATZ_PALETTEN,
  2,
  0,
  ttt_aufbauen,
  ttt_am_zug,
  ttt_zuege,
  ttt_ziehen,
  ttt_ergebnis,
  ttt_bot,
  ttt_ausgeben,
  ttt_zeichnen,
  ttt_bedienen,
  4,
};
