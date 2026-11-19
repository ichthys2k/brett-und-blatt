/*
 * Brett & Blatt 16 – der Rahmen: Titel, Hauptmenü, Spielvorbereitung, Partie, Ergebnis,
 * Statistik. Die Spiele selbst stehen hinter der Schnittstelle in spiel.h.
 */
#include <snes.h>
#include "bild.h"
#include "eingabe.h"
#include "klang.h"
#include "pruef.h"
#include "speicher.h"
#include "spiel.h"
#include "zufall.h"

#define VERSION_TEXT "Version 1.0 · November 2026"

const Spiel *const spiele[SPIELE_ANZAHL] = {
  &spiel_tic_tac_toe, &spiel_vier, &spiel_reversi, &spiel_gomoku, &spiel_uttt,
  &spiel_muehle, &spiel_dame, &spiel_teiler, &spiel_kniffel, &spiel_maexle,
  &spiel_paare, &spiel_ludo, &spiel_domino, &spiel_mauer, &spiel_zielzahl,
  &spiel_elevens, &spiel_solitaire, &spiel_mau_mau, &spiel_uno, &spiel_peter,
  &spiel_quartett, &spiel_president, &spiel_speed, &spiel_ligretto, &spiel_poker,
  &spiel_skat, &spiel_schafkopf, &spiel_doppelkopf, &spiel_binokel, &spiel_chess,
  &spiel_go
};

/* spielstand und zugliste liegen in Bank $7F (ram.asm). */

u8 zug_gleich(const Zug *a, const Zug *b) {
  u8 i;
  if (a->n != b->n) return 0;
  for (i = 0; i < a->n; i++)
    if (a->b[i] != b->b[i]) return 0;
  return 1;
}

/* Erlaubte Züge und Zusatzzüge zusammen in `zugliste`. */
u16 alle_zuege(const Spiel *spiel, const u8 *stand) {
  u16 n = spiel->zuege(stand, zugliste);
  if (spiel->zusatz) n += spiel->zusatz(stand, zugliste + n);
  return n;
}

u8 zug_erlaubt(const Spiel *spiel, const u8 *stand, const Zug *zug) {
  u16 n = alle_zuege(spiel, stand);
  u16 i;
  u8 frei;
  for (i = 0; i < n; i++)
    if (zug_gleich(&zugliste[i], zug)) return 1;
  if (!spiel->erlaubt) return 0;
  frei = spiel->erlaubt(stand, zug);
  return frei;
}

void zug_zufaellig(const Spiel *spiel, const u8 *stand, Zufall *z, Zug *zug) {
  u16 n = spiel->zuege(stand, zugliste);
  *zug = zugliste[zufall_bis(z, n)];
}

/* ------------------------------------------------------------------ Teilnehmer und Einstellungen */

/* Controller 3–5 brauchen den Multitap (Super Multitap / MultiPlayer 5). */
enum { T_CONTROLLER_1, T_CONTROLLER_2, T_CONTROLLER_3, T_CONTROLLER_4, T_CONTROLLER_5, T_BOT_LEICHT, T_BOT_MITTEL, T_BOT_SCHWER, T_ANZAHL };
static const char *const TEILNEHMER_NAMEN[T_ANZAHL] = {"Controller 1", "Controller 2", "Controller 3", "Controller 4", "Controller 5", "Bot leicht", "Bot mittel", "Bot schwer"};
#define IST_BOT(t) ((t) >= T_BOT_LEICHT)
#define BOT_STUFE(t) ((t) - T_BOT_LEICHT)

static const u8 PARTIEN_WAHL[3] = {1, 3, 5};

/* Einstellungen der Spielvorbereitung (bleiben bis zum Ausschalten erhalten). */
static u8 teilnehmer[PLAETZE_MAX] = {T_CONTROLLER_1, T_BOT_MITTEL, T_BOT_MITTEL, T_BOT_MITTEL, T_BOT_MITTEL, T_BOT_MITTEL};
static u8 spieler[SPIELE_ANZAHL];
static u8 partien_index;
static u8 seiten_tauschen = 1;
static u8 optionen[SPIELE_ANZAHL][OPTIONEN_MAX];

/* Laufende Partie – der Rahmentest (test/snes.test.ts) liest Cursor und Auswahl mit. */
u8 cursor_x, cursor_y;
u8 folge[FOLGE_MAX];
u8 folge_n;
static u8 markierung[FELDER_MAX];
static Zufall partie_zufall;
static u8 platz_teilnehmer[PLAETZE_MAX];
static char partie_seed[SEED_MAX];

/* ------------------------------------------------------------------ Hilfen */

static void kopfzeile(const char *titel) {
  bild_leeren();
  tafel(1, 0, 30, 3);
  text_mitte(1, titel, PAL_GELB);
}

static void fusszeile(const char *hinweis) {
  flaeche_leeren(0, 26, 32, 1);
  text_mitte(26, hinweis, PAL_GRAU);
}

#define MENUE_LINKS 0xfd
#define MENUE_RECHTS 0xfe
#define MENUE_ZURUECK 0xff

/* Senkrechtes Menü mit Pfeil, Bildlauf und L/R-Blättern. Gibt die Wahl zurück, oder MENUE_… */
static u8 menue(u8 x, u8 y, const char *const *eintraege, u8 anzahl, u8 wahl, u8 abstand, u8 erlaubt_lr) {
  u8 i, oben = 0, neu_zeichnen = 1, fenster = 18;
  u16 t;
  if (anzahl <= fenster) fenster = anzahl;
  if (wahl >= anzahl) wahl = 0;
  if (wahl >= fenster) oben = wahl - fenster + 1;
  while (1) {
    if (wahl < oben) { oben = wahl; neu_zeichnen = 1; }
    if (wahl >= oben + fenster) { oben = wahl - fenster + 1; neu_zeichnen = 1; }
    if (neu_zeichnen) {
      for (i = 0; i < fenster; i++) {
        u8 idx = oben + i;
        kachel(x, y + i * abstand, idx == wahl ? K_PFEIL : 0, PAL_GELB);
        flaeche_leeren(x + 2, y + i * abstand, 24, 1);
        text(x + 2, y + i * abstand, eintraege[idx], idx == wahl ? PAL_GELB : PAL_TEXT);
      }
      if (anzahl > fenster) {
        u8 seite = (oben + fenster - 1) / fenster + 1;
        u8 seiten = (anzahl + fenster - 1) / fenster;
        flaeche_leeren(2, y + fenster, 28, 1);
        text(11, y + fenster, "Seite", PAL_GRAU);
        zahl(17, y + fenster, seite, 1, PAL_GRAU);
        text(18, y + fenster, "/", PAL_GRAU);
        zahl(19, y + fenster, seiten, 1, PAL_GRAU);
      }
      neu_zeichnen = 0;
    }
    bild_warten();
    if (pruef_angefordert()) pruef_schleife();
    t = tasten_alle();
    if (t & KEY_UP) {
      if (wahl >= oben && wahl < oben + fenster) {
        kachel(x, y + (wahl - oben) * abstand, 0, PAL_GELB);
        text(x + 2, y + (wahl - oben) * abstand, eintraege[wahl], PAL_TEXT);
      }
      wahl = wahl == 0 ? anzahl - 1 : wahl - 1;
      klang_spielen(KLANG_KLICK);
      if (wahl < oben || wahl >= oben + fenster) neu_zeichnen = 1;
      else {
        kachel(x, y + (wahl - oben) * abstand, K_PFEIL, PAL_GELB);
        text(x + 2, y + (wahl - oben) * abstand, eintraege[wahl], PAL_GELB);
      }
    }
    if (t & KEY_DOWN) {
      if (wahl >= oben && wahl < oben + fenster) {
        kachel(x, y + (wahl - oben) * abstand, 0, PAL_GELB);
        text(x + 2, y + (wahl - oben) * abstand, eintraege[wahl], PAL_TEXT);
      }
      wahl = wahl == anzahl - 1 ? 0 : wahl + 1;
      klang_spielen(KLANG_KLICK);
      if (wahl < oben || wahl >= oben + fenster) neu_zeichnen = 1;
      else {
        kachel(x, y + (wahl - oben) * abstand, K_PFEIL, PAL_GELB);
        text(x + 2, y + (wahl - oben) * abstand, eintraege[wahl], PAL_GELB);
      }
    }
    if ((t & KEY_R) && anzahl > fenster) {
      if (oben + fenster < anzahl) {
        oben += fenster;
        if (oben + fenster > anzahl) oben = anzahl - fenster;
        wahl = oben;
        neu_zeichnen = 1;
        klang_spielen(KLANG_KLICK);
      } else if (wahl < anzahl - 1) {
        wahl = anzahl - 1;
        neu_zeichnen = 1;
        klang_spielen(KLANG_KLICK);
      }
    }
    if ((t & KEY_L) && anzahl > fenster) {
      if (oben > 0) {
        oben = oben > fenster ? oben - fenster : 0;
        wahl = oben;
        neu_zeichnen = 1;
        klang_spielen(KLANG_KLICK);
      } else if (wahl > 0) {
        wahl = 0;
        neu_zeichnen = 1;
        klang_spielen(KLANG_KLICK);
      }
    }
    if (erlaubt_lr && (t & KEY_LEFT)) {
      klang_spielen(KLANG_KLICK);
      return MENUE_LINKS;
    }
    if (erlaubt_lr && (t & KEY_RIGHT)) {
      klang_spielen(KLANG_KLICK);
      return MENUE_RECHTS;
    }
    if (t & (KEY_A | KEY_START)) {
      klang_spielen(KLANG_KLICK);
      return wahl;
    }
    if (t & KEY_B) return MENUE_ZURUECK;
  }
}

static void warte_auf_a_oder_b(void) {
  while (!(tasten_alle() & (KEY_A | KEY_B | KEY_START))) bild_warten();
}

/* ------------------------------------------------------------------ Titel */

static void titel(void) {
  u16 bild = 0;
  musik_stoppen();
  bild_leeren();
  tafel(1, 3, 30, 12);
  karte((BILD_B - TITEL_B) / 2, 5, KARTE_TITEL, TITEL_B, TITEL_H, PAL_GELB);
  karte((BILD_B - TITEL_16_B) / 2, 8, KARTE_TITEL_16, TITEL_16_B, TITEL_16_H, PAL_ROT);
  text_mitte(12, "Freie Spielesammlung", PAL_TEXT);
  text_mitte(23, "spiele.lipponer.de", PAL_GRAU);
  text_mitte(25, "AGPL-3.0 · CC BY-SA 4.0", PAL_GRAU);
  text_mitte(26, VERSION_TEXT, PAL_GRAU);
  while (1) {
    flaeche_leeren(0, 18, 32, 1);
    if ((bild & 32) == 0) text_mitte(18, "Start drücken", PAL_TEXT);
    bild_warten();
    if (pruef_angefordert()) pruef_schleife();
    if (tasten_alle() & (KEY_START | KEY_A)) break;
    bild++;
  }
  klang_spielen(KLANG_START);
  tasten_loslassen();
}

/* ------------------------------------------------------------------ Anleitung, Über, Statistik */

static void anleitung(const Spiel *spiel) {
  u8 y = 5, i;
  kopfzeile(spiel->name);
  tafel(1, 3, 30, 23);
  text(3, y, "So wird gespielt", PAL_GELB);
  y += 2;
  for (i = 0; spiel->anleitung[i]; i++) y += text_umbruch(3, y, 26, spiel->anleitung[i], PAL_TEXT) + 1;
  text_umbruch(3, y, 26, spiel->bedienung, PAL_GRAU);
  fusszeile("A oder B: zurück");
  tasten_loslassen();
  warte_auf_a_oder_b();
  klang_spielen(KLANG_KLICK);
}

static void ueber(void) {
  kopfzeile("Über Brett & Blatt 16");
  tafel(1, 3, 30, 22);
  text_umbruch(3, 5, 26, "Brett & Blatt ist eine freie Spielesammlung im Browser. Diese Fassung läuft auf dem Super Nintendo und in Emulatoren.", PAL_TEXT);
  text(3, 11, "Spiele im Browser:", PAL_GELB);
  text(3, 12, "spiele.lipponer.de", PAL_TEXT);
  text(3, 14, "Quellcode (AGPL-3.0):", PAL_GELB);
  text(3, 15, "github.com/ichthys2k/", PAL_TEXT);
  text(3, 16, "brett-und-blatt", PAL_TEXT);
  text(3, 18, "Gebaut mit PVSnesLib.", PAL_GRAU);
  text(3, 19, "Schrift: font8x8 (gemeinfrei).", PAL_GRAU);
  text(3, 20, "Kein Nintendo-Produkt.", PAL_GRAU);
  text(3, 22, VERSION_TEXT, PAL_GRAU);
  fusszeile("A oder B: zurück");
  tasten_loslassen();
  warte_auf_a_oder_b();
  klang_spielen(KLANG_KLICK);
}

static void statistik(void) {
  static const char *const STUFEN_NAMEN[STUFEN] = {"leicht", "mittel", "schwer"};
  const SpielStatistik *s;
  u8 nr = 0, y = 7, t;
  u16 tasten;
  while (1) {
    kopfzeile("Statistik");
    tafel(1, 3, 30, 22);
    s = &speicher.spiele[nr];
    kachel(3, 5, Z_PFEIL_LINKS, PAL_GRAU);
    text_mitte(5, spiele[nr]->name, PAL_GELB);
    kachel(28, 5, Z_PFEIL_RECHTS, PAL_GRAU);
    text(3, y + 1, "Partien gesamt", PAL_TEXT);
    zahl(23, y + 1, s->partien, 5, PAL_TEXT);
    text(3, y + 2, "nur Menschen", PAL_TEXT);
    zahl(23, y + 2, s->hotseat, 5, PAL_TEXT);
    text(3, y + 4, "Gegen Bot  Sieg Remis Nied.", PAL_GRAU);
    for (t = 0; t < STUFEN; t++) {
      text(3, y + 5 + t, STUFEN_NAMEN[t], PAL_TEXT);
      zahl(12, y + 5 + t, s->gegen_bot[t][BILANZ_SIEG], 4, PAL_TEXT);
      zahl(18, y + 5 + t, s->gegen_bot[t][BILANZ_REMIS], 4, PAL_TEXT);
      zahl(24, y + 5 + t, s->gegen_bot[t][BILANZ_NIEDERLAGE], 4, PAL_TEXT);
    }
    fusszeile("✚ Spiel · B zurück · Y löschen");
    tasten_loslassen();
    while (1) {
      bild_warten();
      tasten = tasten_alle();
      if (tasten & (KEY_A | KEY_B | KEY_START)) {
        klang_spielen(KLANG_KLICK);
        return;
      }
      if (tasten & (KEY_LEFT | KEY_RIGHT | KEY_L | KEY_R | KEY_Y)) break;
    }
    if (tasten & KEY_LEFT) {
      nr = nr == 0 ? SPIELE_ANZAHL - 1 : nr - 1;
      klang_spielen(KLANG_KLICK);
      continue;
    }
    if (tasten & KEY_RIGHT) {
      nr = nr == SPIELE_ANZAHL - 1 ? 0 : nr + 1;
      klang_spielen(KLANG_KLICK);
      continue;
    }
    if (tasten & KEY_L) {
      nr = nr >= 5 ? nr - 5 : SPIELE_ANZAHL + nr - 5;
      klang_spielen(KLANG_KLICK);
      continue;
    }
    if (tasten & KEY_R) {
      nr = (nr + 5) % SPIELE_ANZAHL;
      klang_spielen(KLANG_KLICK);
      continue;
    }
    // Rückfrage vor dem Löschen (alle Spiele).
    tafel(4, 10, 24, 7);
    flaeche_leeren(5, 11, 22, 5);
    text_mitte(12, "Alles löschen?", PAL_GELB);
    text_mitte(14, "Y: ja · B: nein", PAL_TEXT);
    tasten_loslassen();
    while (1) {
      bild_warten();
      tasten = tasten_alle();
      if (tasten & KEY_Y) {
        speicher_loeschen();
        klang_spielen(KLANG_ENDE);
        break;
      }
      if (tasten & (KEY_B | KEY_A)) break;
    }
  }
}

static void musikbox(void) {
  u8 pl = 0, wahl = 0, i, nr, akt, laeuft, aktiv;
  u16 tasten;
  akt = musik_aktuell();
  if (akt < MUSIK_ANZAHL) {
    pl = musik_playlist[akt];
    wahl = akt - pl * 5;
  }
  while (1) {
    akt = musik_aktuell();
    laeuft = musik_laeuft();
    aktiv = musik_aktiv();
    kopfzeile("Musikbox");
    tafel(1, 3, 30, 22);
    kachel(3, 5, Z_PFEIL_LINKS, PAL_GRAU);
    text_mitte(5, musik_playlist_namen[pl], PAL_GELB);
    kachel(28, 5, Z_PFEIL_RECHTS, PAL_GRAU);
    for (i = 0; i < 5; i++) {
      nr = pl * 5 + i;
      kachel(3, 8 + i * 2, i == wahl ? K_PFEIL : 0, PAL_GELB);
      zahl(5, 8 + i * 2, nr + 1, 2, PAL_GRAU);
      text(7, 8 + i * 2, ".", PAL_GRAU);
      text(9, 8 + i * 2, musik_namen[nr], i == wahl ? PAL_GELB : PAL_TEXT);
      if (laeuft && akt == nr) text(27, 8 + i * 2, "*", PAL_GELB);
    }
    text(3, 19, "Musik:", PAL_GRAU);
    text(10, 19, aktiv ? "An" : "Aus", aktiv ? PAL_GELB : PAL_TEXT);
    text(3, 21, "Läuft:", PAL_GRAU);
    if (laeuft && akt < MUSIK_ANZAHL) {
      text(10, 21, musik_namen[akt], PAL_TEXT);
    } else {
      text(10, 21, "Stille", PAL_GRAU);
    }
    fusszeile("A spielen · X aus · B zurück");
    tasten_loslassen();
    while (1) {
      bild_warten();
      tasten = tasten_alle();
      if (tasten & KEY_B) {
        klang_spielen(KLANG_KLICK);
        return;
      }
      if (tasten & (KEY_UP | KEY_DOWN | KEY_LEFT | KEY_RIGHT | KEY_L | KEY_R | KEY_A | KEY_START | KEY_X)) break;
    }
    if (tasten & KEY_UP) {
      wahl = wahl == 0 ? 4 : wahl - 1;
      klang_spielen(KLANG_KLICK);
    } else if (tasten & KEY_DOWN) {
      wahl = wahl == 4 ? 0 : wahl + 1;
      klang_spielen(KLANG_KLICK);
    } else if (tasten & (KEY_LEFT | KEY_L)) {
      pl = pl == 0 ? PLAYLIST_ANZAHL - 1 : pl - 1;
      wahl = 0;
      klang_spielen(KLANG_KLICK);
    } else if (tasten & (KEY_RIGHT | KEY_R)) {
      pl = pl == PLAYLIST_ANZAHL - 1 ? 0 : pl + 1;
      wahl = 0;
      klang_spielen(KLANG_KLICK);
    } else if (tasten & (KEY_A | KEY_START)) {
      if (!musik_aktiv()) musik_umschalten();
      musik_spielen(pl * 5 + wahl);
    } else if (tasten & KEY_X) {
      musik_umschalten();
      klang_spielen(KLANG_KLICK);
    }
  }
}

/* ------------------------------------------------------------------ Spielvorbereitung */

/* Wert mit Pfeilen: ◀ in Spalte 14, Wert ab 16 (höchstens 12 Zeichen), ▶ in Spalte 29. */
static void wert_zeigen(u8 y, const char *wert, u8 aktiv) {
  flaeche_leeren(14, y, 16, 1);
  kachel(14, y, Z_PFEIL_LINKS, aktiv ? PAL_GELB : PAL_GRAU);
  text(16, y, wert, aktiv ? PAL_GELB : PAL_TEXT);
  kachel(29, y, Z_PFEIL_RECHTS, aktiv ? PAL_GELB : PAL_GRAU);
}

/*
 * Zeilen: Spielerzahl (wenn wählbar), je Platz der Teilnehmer, Partien, Plätze tauschen,
 * Optionen …, Anleitung, Los. Alle einzeilig ab Zeile 5, damit auch sechs Plätze und viele
 * Optionen auf den Bildschirm passen.
 */
enum { Z_SPIELER, Z_PLATZ, Z_PARTIEN, Z_TAUSCH, Z_OPTION, Z_ANLEITUNG, Z_LOS };
static u8 zeilen_art[24], zeilen_nr[24];

/* Name und Farbe eines Platzes je nach Spielerzahl (Spiel.platz_farbe, sonst der Platz selbst). */
static u8 akt_spieler; /* Spielerzahl der gewählten Partie (setzt die Vorbereitung) */
static u8 farbe(const Spiel *spiel, u8 platz) {
  u8 f;
  if (!spiel->platz_farbe) return platz;
  f = spiel->platz_farbe(akt_spieler, platz);
  return f;
}

static u8 zeilen_bauen(const Spiel *spiel, u8 n) {
  u8 z = 0, i;
  if (spiel->plaetze_min < spiel->plaetze_max) zeilen_art[z++] = Z_SPIELER;
  for (i = 0; i < n; i++) {
    zeilen_art[z] = Z_PLATZ;
    zeilen_nr[z++] = i;
  }
  zeilen_art[z++] = Z_PARTIEN;
  if (n > 1) zeilen_art[z++] = Z_TAUSCH;
  for (i = 0; i < spiel->optionen_anzahl; i++) {
    zeilen_art[z] = Z_OPTION;
    zeilen_nr[z++] = i;
  }
  zeilen_art[z++] = Z_ANLEITUNG;
  zeilen_art[z++] = Z_LOS;
  return z;
}

/* Gibt 1 zurück, wenn die Partie beginnen soll, 0 für zurück zum Menü. */
static u8 vorbereitung(u8 spiel_nr) {
  static const char *const PARTIEN_TEXT[3] = {"1", "3", "5"};
  static const char *const ZAHLEN[7] = {"0", "1", "2", "3", "4", "5", "6"};
  const Spiel *spiel = spiele[spiel_nr];
  u8 zeilen = zeilen_bauen(spiel, spieler[spiel_nr]);
  u8 zeile = zeilen - 1;
  u8 i, y, o, art, n;
  u16 t;
  s8 schritt;
  const Option *opt;
  while (1) {
    kopfzeile(spiel->name);
    tafel(1, 3, 30, 22);
    tasten_loslassen();
    while (1) {
      akt_spieler = spieler[spiel_nr];
      for (i = 0; i < zeilen; i++) {
        y = 5 + i;
        art = zeilen_art[i];
        kachel(3, y, i == zeile ? K_PFEIL : 0, PAL_GELB);
        flaeche_leeren(5, y, 9, 1);
        if (art == Z_SPIELER) {
          text(5, y, "Spieler", PAL_TEXT);
          wert_zeigen(y, ZAHLEN[spieler[spiel_nr]], i == zeile);
        } else if (art == Z_PLATZ) {
          n = zeilen_nr[i];
          text(5, y, spiel->platz_namen[farbe(spiel, n)], spiel->platz_paletten[farbe(spiel, n)]);
          wert_zeigen(y, TEILNEHMER_NAMEN[teilnehmer[n]], i == zeile);
        } else if (art == Z_PARTIEN) {
          text(5, y, "Partien", PAL_TEXT);
          wert_zeigen(y, PARTIEN_TEXT[partien_index], i == zeile);
        } else if (art == Z_TAUSCH) {
          text(5, y, "Plätze", PAL_TEXT);
          wert_zeigen(y, seiten_tauschen ? "tauschen" : "behalten", i == zeile);
        } else if (art == Z_OPTION) {
          opt = &spiel->optionen[zeilen_nr[i]];
          text(5, y, opt->name, PAL_TEXT);
          wert_zeigen(y, opt->werte[optionen[spiel_nr][zeilen_nr[i]]], i == zeile);
        } else if (art == Z_ANLEITUNG) {
          text(5, y, "Anleitung", i == zeile ? PAL_GELB : PAL_TEXT);
        } else {
          text(5, y, "Los geht's!", i == zeile ? PAL_GELB : PAL_TEXT);
        }
      }
      fusszeile("✚ ändern · A wählen · B zurück");
      bild_warten();
      t = tasten_alle();
      schritt = 0;
      if (t & KEY_UP) zeile = zeile == 0 ? zeilen - 1 : zeile - 1;
      if (t & KEY_DOWN) zeile = zeile == zeilen - 1 ? 0 : zeile + 1;
      if (t & KEY_LEFT) schritt = -1;
      if (t & (KEY_RIGHT | KEY_A)) schritt = 1;
      if (t & (KEY_UP | KEY_DOWN)) klang_spielen(KLANG_KLICK);
      if (t & KEY_B) return 0;
      // Start beginnt die Partie aus jeder Zeile.
      if (t & KEY_START) return 1;
      if (!schritt) continue;
      klang_spielen(KLANG_KLICK);
      art = zeilen_art[zeile];
      if (art == Z_SPIELER) {
        n = spieler[spiel_nr] + schritt;
        if (n < spiel->plaetze_min) n = spiel->plaetze_max;
        if (n > spiel->plaetze_max) n = spiel->plaetze_min;
        spieler[spiel_nr] = n;
        zeilen = zeilen_bauen(spiel, n);
        break;
      } else if (art == Z_PLATZ) {
        n = zeilen_nr[zeile];
        teilnehmer[n] = (teilnehmer[n] + T_ANZAHL + schritt) % T_ANZAHL;
      } else if (art == Z_PARTIEN) {
        partien_index = (partien_index + 3 + schritt) % 3;
      } else if (art == Z_TAUSCH) {
        seiten_tauschen ^= 1;
      } else if (art == Z_OPTION) {
        o = zeilen_nr[zeile];
        opt = &spiel->optionen[o];
        optionen[spiel_nr][o] = (optionen[spiel_nr][o] + opt->anzahl + schritt) % opt->anzahl;
      } else if (art == Z_ANLEITUNG) {
        if (t & KEY_A) {
          anleitung(spiel);
          break;
        }
      } else if (t & KEY_A) {
        return 1;
      }
    }
  }
}

/* ------------------------------------------------------------------ Partie */

static void platz_text(const Spiel *spiel, u8 y, u8 platz, const char *nachsatz) {
  platz = farbe(spiel, platz);
  u8 n = text_laenge(spiel->platz_namen[platz]) + text_laenge(nachsatz);
  // Zu lang für eine Zeile (z. B. „Spieler 1 ist dran (Controller 1)“): ohne Klammer.
  if (n > BILD_B) {
    nachsatz = " ist dran";
    n = text_laenge(spiel->platz_namen[platz]) + text_laenge(nachsatz);
  }
  u8 x = n >= BILD_B ? 0 : (BILD_B - n) / 2;
  flaeche_leeren(0, y, 32, 1);
  x += text(x, y, spiel->platz_namen[platz], spiel->platz_paletten[platz]);
  text(x, y, nachsatz, PAL_TEXT);
}

/* „ ist dran (Controller 3)“ */
static char dran_text[32];
static const char *dran(u8 port) {
  static const char VORNE[] = " ist dran (Controller ";
  u8 i;
  for (i = 0; VORNE[i]; i++) dran_text[i] = VORNE[i];
  dran_text[i++] = '1' + port;
  dran_text[i++] = ')';
  dran_text[i] = 0;
  return dran_text;
}

/* Vor einem Zug mit verdeckten Informationen: Bildschirm leeren, bis der richtige Mensch übernimmt. */
static void wechselbildschirm(const Spiel *spiel, u8 platz, u8 port) {
  bild_leeren();
  tafel(3, 8, 26, 11);
  platz_text(spiel, 10, platz, " ist dran");
  text_mitte(13, TEILNEHMER_NAMEN[port], PAL_TEXT);
  text_mitte(16, "A: weiter", PAL_GRAU);
  tasten_loslassen();
  while (!(tasten_neu(port) & KEY_A)) bild_warten();
}

/* Pausenmenü. Gibt 1 zurück, wenn die Partie abgebrochen werden soll. */
static u8 pause(void) {
  const char *eintraege[4];
  u8 wahl = 0, aktiv;
  while (1) {
    aktiv = musik_aktiv();
    eintraege[0] = "Weiter";
    eintraege[1] = "Zum Hauptmenü";
    eintraege[2] = aktiv ? "Musik: An" : "Musik: Aus";
    eintraege[3] = "Nächstes Stück";
    tafel(4, 7, 24, 13);
    flaeche_leeren(5, 8, 22, 11);
    text_mitte(8, "Pause", PAL_GELB);
    tasten_loslassen();
    wahl = menue(7, 10, (const char *const *)eintraege, 4, wahl, 2, 0);
    tasten_loslassen();
    if (wahl == 2) {
      musik_umschalten();
      continue;
    }
    if (wahl == 3) {
      musik_naechstes();
      continue;
    }
    return wahl == 1;
  }
}

/* Siege je Teilnehmer der Vorbereitung als „1 : 0“ bzw. „1 · 0 · 2“ ab Spalte x. */
static void siege_zeigen(u8 x, u8 y, u8 n, const u8 *siege) {
  u8 i;
  for (i = 0; i < n; i++) {
    if (i) text(x - 1, y, n == 2 ? ":" : "·", PAL_GRAU);
    zahl(x, y, siege[i], 1, PAL_TEXT);
    x += 3;
  }
}

static void partie_bild(const Spiel *spiel, u8 nummer, u8 anzahl, const u8 *siege, u8 n) {
  kopfzeile(spiel->name);
  flaeche_leeren(0, 25, 32, 1);
  if (anzahl > 1) {
    text(1, 25, "Partie", PAL_GRAU);
    zahl(8, 25, nummer + 1, 1, PAL_GRAU);
    text(10, 25, "von", PAL_GRAU);
    zahl(14, 25, anzahl, 1, PAL_GRAU);
    if (n > 1) siege_zeigen(18, 25, n, siege);
  }
}

/*
 * Auswahl eines Zugs über Felder: Bei jedem Schritt sind die Felder wählbar, mit denen ein
 * erlaubter Zug weitergeht, der mit der bisherigen Folge beginnt. Ist die Folge eines Zugs
 * vollständig und kein anderer geht weiter, ist der Zug gewählt.
 */
static u8 felder_puffer[FOLGE_MAX];

/* Markiert Cursor, gewählte und mögliche nächste Felder. Gibt den Index eines vollständigen Zugs
 * zurück, wenn die Folge genau einen Zug ohne Fortsetzung trifft, sonst 0xffff. */
static u16 markieren(const Spiel *spiel, u16 n) {
  u16 i, fertig = 0xffff;
  u8 k, laenge, passt, weiter = 0;
  for (i = 0; i < FELDER_MAX; i++) markierung[i] = 0;
  for (i = 0; i < n; i++) {
    laenge = spiel->felder(spielstand, &zugliste[i], felder_puffer);
    if (laenge < folge_n) continue;
    passt = 1;
    for (k = 0; k < folge_n; k++)
      if (felder_puffer[k] != folge[k]) passt = 0;
    if (!passt) continue;
    if (laenge == folge_n) fertig = i;
    else {
      markierung[felder_puffer[folge_n]] |= MARK_ZIEL;
      weiter = 1;
    }
  }
  for (k = 0; k < folge_n; k++) markierung[folge[k]] |= MARK_GEWAEHLT;
  k = spiel->feld_an(spielstand, cursor_x, cursor_y);
  if (k != FELD_KEIN) markierung[k] |= MARK_CURSOR;
  return weiter ? 0xffff : fertig;
}

/* Bewegt den Cursor in eine Richtung bis zum nächsten Feld (mit Umlauf). */
static void cursor_bewegen(const Spiel *spiel, s8 dx, s8 dy) {
  u8 b, h, x = cursor_x, y = cursor_y, schritte;
  spiel->gitter(spielstand, &b, &h);
  for (schritte = 0; schritte < 16; schritte++) {
    x = (x + b + dx) % b;
    y = (y + h + dy) % h;
    if (spiel->feld_an(spielstand, x, y) != FELD_KEIN) {
      cursor_x = x;
      cursor_y = y;
      return;
    }
  }
}

/* Wartet auf die Wahl eines Menschen. Gibt 1 zurück, wenn `zug` gesetzt ist, 0 bei Abbruch. */
static u8 mensch_waehlt(const Spiel *spiel, u8 port, Zug *zug, u8 nummer, u8 anzahl, const u8 *siege, u8 platz, u8 n_plaetze) {
  u16 n = alle_zuege(spiel, spielstand);
  u16 tasten, fertig;
  u8 feld, ziel;
  folge_n = 0;
  if (spiel->feld_an(spielstand, cursor_x, cursor_y) == FELD_KEIN) cursor_bewegen(spiel, 1, 0);
  markieren(spiel, n);
  spiel->zeichnen(spielstand, markierung, 1);
  while (1) {
    bild_warten();
    tasten = tasten_neu(port);
    if (tasten_alle() & KEY_START) {
      if (pause()) return 0;
      partie_bild(spiel, nummer, anzahl, siege, n_plaetze);
      platz_text(spiel, 3, platz, dran(port));
      fusszeile("A: wählen · Start: Pause");
      markieren(spiel, n);
      spiel->zeichnen(spielstand, markierung, 1);
      continue;
    }
    if (!tasten) continue;
    if (tasten & KEY_LEFT) cursor_bewegen(spiel, -1, 0);
    if (tasten & KEY_RIGHT) cursor_bewegen(spiel, 1, 0);
    if (tasten & KEY_UP) cursor_bewegen(spiel, 0, -1);
    if (tasten & KEY_DOWN) cursor_bewegen(spiel, 0, 1);
    if (tasten & KEY_B) {
      if (folge_n > 0) folge_n--;
    }
    if (tasten & KEY_A) {
      feld = spiel->feld_an(spielstand, cursor_x, cursor_y);
      markieren(spiel, n);
      ziel = 0;
      if (feld != FELD_KEIN) ziel = markierung[feld] & MARK_ZIEL;
      if (ziel && folge_n < FOLGE_MAX) {
        folge[folge_n++] = feld;
        fertig = markieren(spiel, n);
        if (fertig != 0xffff) {
          *zug = zugliste[fertig];
          return 1;
        }
      }
    }
    if (tasten & (STEUERKREUZ | KEY_A | KEY_B)) klang_spielen(KLANG_KLICK);
    markieren(spiel, n);
    spiel->zeichnen(spielstand, markierung, 1);
  }
}

/* Spielt eine Partie. Gibt ERGEBNIS_… zurück (Gewinner als Bitmaske in *sieger) oder 0xff bei Abbruch. */
static u8 eine_partie(u8 spiel_nr, u8 n, u8 nummer, u8 anzahl, const u8 *siege, u8 *sieger) {
  const Spiel *spiel = spiele[spiel_nr];
  u8 platz, t, port, ergebnis, menschen = 0, zuletzt = PLATZ_KEIN;
  u16 i;
  Zug zug;

  seed_aus_zahl(partie_seed, eingabe_unruhe);
  zufall_strom(&partie_zufall, partie_seed, "bots");
  spiel->aufbauen(spielstand, optionen[spiel_nr], n, partie_seed);
  cursor_x = spiel->cursor_x;
  cursor_y = spiel->cursor_y;
  if (spiel->feld_an(spielstand, cursor_x, cursor_y) == FELD_KEIN) cursor_bewegen(spiel, 1, 0);
  brett_farben(spiel->brett_farben);
  partie_bild(spiel, nummer, anzahl, siege, n);
  for (i = 0; i < FELDER_MAX; i++) markierung[i] = 0;
  for (platz = 0; platz < n; platz++)
    if (!IST_BOT(platz_teilnehmer[platz])) menschen++;

  while (1) {
    platz = spiel->am_zug(spielstand);
    if (platz == PLATZ_KEIN) break;
    t = platz_teilnehmer[platz];
    if (IST_BOT(t)) {
      for (i = 0; i < FELDER_MAX; i++) markierung[i] = 0;
      spiel->zeichnen(spielstand, markierung, 0);
      platz_text(spiel, 3, platz, " überlegt …");
      fusszeile("Start: Pause");
      // Kurz warten, damit man den Zug des Bots mitverfolgen kann.
      for (i = 0; i < 24; i++) {
        bild_warten();
        if (tasten_alle() & KEY_START) {
          if (pause()) return 0xff;
        }
      }
      spiel->bot(spielstand, BOT_STUFE(t), &partie_zufall, &zug);
    } else {
      port = t;
      // Verdeckte Informationen am selben Fernseher: vor jedem Wechsel zwischen Menschen wegschauen lassen.
      if (spiel->verdeckt && menschen > 1 && platz != zuletzt) {
        wechselbildschirm(spiel, platz, port);
        partie_bild(spiel, nummer, anzahl, siege, n);
      }
      zuletzt = platz;
      platz_text(spiel, 3, platz, dran(port));
      fusszeile("A: wählen · Start: Pause");
      if (!mensch_waehlt(spiel, port, &zug, nummer, anzahl, siege, platz, n)) return 0xff;
    }
    if (!zug_erlaubt(spiel, spielstand, &zug)) continue;
    klang_spielen(spiel->ziehen(spielstand, &zug));
    for (i = 0; i < FELDER_MAX; i++) markierung[i] = 0;
    spiel->zeichnen(spielstand, markierung, 0);
    bild_warten();
  }
  *sieger = 0;
  ergebnis = spiel->ergebnis(spielstand, sieger);
  for (i = 0; i < FELDER_MAX; i++) markierung[i] = 0;
  spiel->zeichnen(spielstand, markierung, 0);
  return ergebnis;
}

/*
 * Statistik: „nur Menschen“, wenn keine Bots mitspielen; gegen Bots die Bilanz des einzigen
 * Menschen gegen die stärkste Bot-Stufe am Tisch.
 */
static void statistik_eintragen(u8 spiel_nr, u8 n, u8 ergebnis, u8 sieger) {
  SpielStatistik *s = &speicher.spiele[spiel_nr];
  u8 menschen = 0, mensch = 0, stufe = 0, bots = 0, p, bilanz, t;
  s->partien++;
  for (p = 0; p < n; p++) {
    t = platz_teilnehmer[p];
    if (IST_BOT(t)) {
      bots++;
      if (BOT_STUFE(t) > stufe) stufe = BOT_STUFE(t);
    } else {
      menschen++;
      mensch = p;
    }
  }
  if (menschen > 1 && !bots) s->hotseat++;
  if (menschen == 1 && bots) {
    if (ergebnis == ERGEBNIS_REMIS) bilanz = BILANZ_REMIS;
    else if (ergebnis == ERGEBNIS_SIEG && (sieger & (1 << mensch))) bilanz = BILANZ_SIEG;
    else bilanz = BILANZ_NIEDERLAGE;
    s->gegen_bot[stufe][bilanz]++;
  }
  speicher_sichern();
}

/* Stand der Serie in zwei Zeilen: Überschrift und Siege je Teilnehmer. */
static void serienstand(u8 letzte, u8 nummer, u8 anzahl, const u8 *siege, u8 n) {
  const char *a = TEILNEHMER_NAMEN[teilnehmer[0]];
  const char *b = TEILNEHMER_NAMEN[teilnehmer[1]];
  u8 x = (BILD_B - (text_laenge(a) + text_laenge(b) + 7)) / 2;
  if (letzte) {
    text_mitte(24, "Endstand", PAL_GRAU);
  } else {
    // „Nach Partie 1 von 3“ – 19 Zeichen, mittig ab Spalte 6.
    text(6, 24, "Nach Partie", PAL_GRAU);
    zahl(18, 24, nummer + 1, 1, PAL_GRAU);
    text(20, 24, "von", PAL_GRAU);
    zahl(24, 24, anzahl, 1, PAL_GRAU);
  }
  if (n == 2) {
    x += text(x, 25, a, PAL_TEXT) + 1;
    zahl(x, 25, siege[0], 1, PAL_GELB);
    text(x + 2, 25, ":", PAL_GRAU);
    zahl(x + 4, 25, siege[1], 1, PAL_GELB);
    text(x + 6, 25, b, PAL_TEXT);
  } else if (n > 2) {
    text(6, 25, "Siege", PAL_GRAU);
    siege_zeigen(13, 25, n, siege);
  }
}

/* Text zum Ergebnis in Zeile 3. */
static void ergebnis_text(const Spiel *spiel, u8 ergebnis, u8 sieger, u8 n) {
  u8 p, anzahl = 0, erster = 0;
  for (p = 0; p < n; p++) {
    if (!(sieger & (1 << p))) continue;
    if (!anzahl) erster = p;
    anzahl++;
  }
  flaeche_leeren(0, 3, 32, 1);
  if (ergebnis == ERGEBNIS_SIEG && anzahl == 1) platz_text(spiel, 3, erster, n == 1 ? " hat es geschafft!" : " gewinnt!");
  else if (ergebnis == ERGEBNIS_SIEG) text_mitte(3, "Gleichstand an der Spitze", PAL_TEXT);
  else if (ergebnis == ERGEBNIS_VERLOREN) text_mitte(3, "Leider verloren", PAL_TEXT);
  else text_mitte(3, "Unentschieden", PAL_TEXT);
}

/* Eine Serie aus 1, 3 oder 5 Partien; mit „Plätze tauschen“ rücken die Teilnehmer je Partie einen Platz weiter. */
static void serie(u8 spiel_nr) {
  const Spiel *spiel = spiele[spiel_nr];
  u8 n = spieler[spiel_nr];
  u8 anzahl = PARTIEN_WAHL[partien_index];
  u8 siege[PLAETZE_MAX];
  u8 nummer = 0, versatz = 0, ergebnis, sieger = 0, p, letzte, mensch_gewinnt, menschen;
  u16 t;
  musik_fuer_spiel(spiel_nr, eingabe_unruhe);
  for (p = 0; p < PLAETZE_MAX; p++) siege[p] = 0;
  while (1) {
    // Platz p spielt Teilnehmer (p + versatz) mod n.
    for (p = 0; p < n; p++) platz_teilnehmer[p] = teilnehmer[(p + versatz) % n];
    ergebnis = eine_partie(spiel_nr, n, nummer, anzahl, siege, &sieger);
    if (ergebnis == 0xff) return;
    statistik_eintragen(spiel_nr, n, ergebnis, sieger);
    mensch_gewinnt = menschen = 0;
    for (p = 0; p < n; p++) {
      if (!IST_BOT(platz_teilnehmer[p])) menschen++;
      if (ergebnis != ERGEBNIS_SIEG) continue;
      if (!(sieger & (1 << p))) continue;
      // Siege zählen je Teilnehmer der Vorbereitung, nicht je Platz – sonst verwirrt der Tausch.
      siege[(p + versatz) % n]++;
      if (!IST_BOT(platz_teilnehmer[p])) mensch_gewinnt = 1;
    }
    letzte = nummer + 1 >= anzahl;
    ergebnis_text(spiel, ergebnis, sieger, n);
    // Fanfare, wenn ein Mensch gewinnt oder nur Bots spielen; sonst der leise Abschluss.
    t = KLANG_ENDE;
    if (ergebnis == ERGEBNIS_SIEG) {
      if (mensch_gewinnt) t = KLANG_SIEG;
      if (menschen == 0) t = KLANG_SIEG;
    }
    klang_spielen(t);
    flaeche_leeren(0, 24, 32, 2);
    if (anzahl > 1) serienstand(letzte, nummer, anzahl, siege, n);
    fusszeile(letzte ? "A: noch einmal · B: Menü" : "A: nächste Partie · B: Menü");
    tasten_loslassen();
    while (1) {
      bild_warten();
      t = tasten_alle();
      if (t & (KEY_A | KEY_START)) break;
      if (t & KEY_B) return;
    }
    klang_spielen(KLANG_KLICK);
    if (letzte) {
      nummer = 0;
      for (p = 0; p < PLAETZE_MAX; p++) siege[p] = 0;
      versatz = 0;
    } else {
      nummer++;
      if (seiten_tauschen) versatz = (versatz + 1) % n;
    }
  }
}

/* ------------------------------------------------------------------ Hauptmenü */

/* Kategorien im Hauptmenü (entsprechen der Reihenfolge in spiele[]). */
enum { KAT_ALLE, KAT_BRETT, KAT_FAMILIE, KAT_KARTEN, KAT_STICH, KAT_ANZAHL };
static const char *const KAT_NAMEN[KAT_ANZAHL] = {
  "Alle (31)",
  "Brettspiele (7)",
  "Würfel & Familie (8)",
  "Kartenspiele (10)",
  "Stich- & Denksport (6)"
};
static const u8 KAT_START[KAT_ANZAHL] = { 0, 0, 7, 15, 25 };
static const u8 KAT_ENDE[KAT_ANZAHL] = { SPIELE_ANZAHL, 7, 15, 25, SPIELE_ANZAHL };

/*
 * Der Startcode von PVSnesLib löscht nur den Variablenbereich der ersten Quelldatei. Darum setzt
 * jedes Modul seine Variablen ohne Startwert hier ausdrücklich.
 */
static void variablen_start(void) {
  u8 i, o;
  partien_index = 0;
  cursor_x = cursor_y = 0;
  folge_n = 0;
  for (i = 0; i < PLAETZE_MAX; i++) platz_teilnehmer[i] = 0;
  for (i = 0; i < SPIELE_ANZAHL; i++) {
    for (o = 0; o < OPTIONEN_MAX; o++) optionen[i][o] = o < spiele[i]->optionen_anzahl ? spiele[i]->optionen[o].standard : 0;
    // Standard: zwei Plätze, wenn möglich.
    o = 2;
    if (o < spiele[i]->plaetze_min) o = spiele[i]->plaetze_min;
    if (o > spiele[i]->plaetze_max) o = spiele[i]->plaetze_max;
    spieler[i] = o;
  }
  eingabe_start();
  pruef_start();
}

int main(void) {
  static const char *eintraege[SPIELE_ANZAHL + 3];
  static u8 eintrag_ziel[SPIELE_ANZAHL + 3];
  u8 wahl = 0, kategorie = KAT_ALLE, anzahl, ziel, i;
  variablen_start();
  klang_start();
  bild_start();
  speicher_laden();
  titel();
  while (1) {
    anzahl = 0;
    for (i = KAT_START[kategorie]; i < KAT_ENDE[kategorie]; i++) {
      eintraege[anzahl] = spiele[i]->name;
      eintrag_ziel[anzahl] = i;
      anzahl++;
    }
    eintraege[anzahl] = "Musikbox";
    eintrag_ziel[anzahl] = SPIELE_ANZAHL + 2;
    anzahl++;
    eintraege[anzahl] = "Statistik";
    eintrag_ziel[anzahl] = SPIELE_ANZAHL;
    anzahl++;
    eintraege[anzahl] = "Über Brett & Blatt 16";
    eintrag_ziel[anzahl] = SPIELE_ANZAHL + 1;
    anzahl++;
    if (wahl >= anzahl) wahl = 0;

    kopfzeile("Brett & Blatt 16");
    tafel(1, 3, 30, 22);
    kachel(3, 4, Z_PFEIL_LINKS, PAL_GRAU);
    text_mitte(4, KAT_NAMEN[kategorie], PAL_GELB);
    kachel(28, 4, Z_PFEIL_RECHTS, PAL_GRAU);
    fusszeile("✚ Wahl · L/R Seite · A los");
    tasten_loslassen();
    wahl = menue(4, 5, (const char *const *)eintraege, anzahl, wahl, 1, 1);
    tasten_loslassen();
    if (wahl == MENUE_LINKS) {
      kategorie = kategorie == 0 ? KAT_ANZAHL - 1 : kategorie - 1;
      wahl = 0;
    } else if (wahl == MENUE_RECHTS) {
      kategorie = kategorie == KAT_ANZAHL - 1 ? 0 : kategorie + 1;
      wahl = 0;
    } else if (wahl == MENUE_ZURUECK) {
      titel();
      wahl = 0;
      kategorie = KAT_ALLE;
    } else {
      ziel = eintrag_ziel[wahl];
      if (ziel < SPIELE_ANZAHL) {
        if (vorbereitung(ziel)) serie(ziel);
      } else if (ziel == SPIELE_ANZAHL) {
        statistik();
      } else if (ziel == SPIELE_ANZAHL + 1) {
        ueber();
      } else if (ziel == SPIELE_ANZAHL + 2) {
        musikbox();
      }
    }
  }
  return 0;
}
