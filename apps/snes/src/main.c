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

#define VERSION_TEXT "Version 0.1 · November 2026"

const Spiel *const spiele[SPIELE_ANZAHL] = {&spiel_tic_tac_toe};

u8 zug_erlaubt(const Spiel *spiel, const u8 *stand, u16 zug) {
  static u16 liste[ZUEGE_MAX];
  u8 n = spiel->zuege(stand, liste);
  u8 i;
  for (i = 0; i < n; i++)
    if (liste[i] == zug) return 1;
  return 0;
}

/* ------------------------------------------------------------------ Teilnehmer */

enum { T_CONTROLLER_1, T_CONTROLLER_2, T_BOT_LEICHT, T_BOT_MITTEL, T_BOT_SCHWER, T_ANZAHL };
static const char *const TEILNEHMER_NAMEN[T_ANZAHL] = {"Controller 1", "Controller 2", "Bot leicht", "Bot mittel", "Bot schwer"};
#define IST_BOT(t) ((t) >= T_BOT_LEICHT)
#define BOT_STUFE(t) ((t) - T_BOT_LEICHT)

static const u8 PARTIEN_WAHL[3] = {1, 3, 5};

/* Einstellungen der Spielvorbereitung (bleiben bis zum Ausschalten erhalten). */
static u8 teilnehmer[PLAETZE_MAX] = {T_CONTROLLER_1, T_BOT_MITTEL};
static u8 partien_index;
static u8 seiten_tauschen = 1;

/* Laufende Partie – der Rahmentest (test/snes.test.ts) liest sie mit. */
u8 partie_stand[SPIELSTAND_GROESSE];
u16 partie_auswahl;
static Zufall partie_zufall;

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

/* Senkrechtes Menü mit Pfeil. Gibt die Wahl zurück oder 0xff bei B. */
static u8 menue(u8 x, u8 y, const char *const *eintraege, u8 anzahl, u8 wahl) {
  u8 i;
  u16 t;
  for (i = 0; i < anzahl; i++) text(x + 2, y + i * 2, eintraege[i], PAL_TEXT);
  while (1) {
    for (i = 0; i < anzahl; i++) {
      kachel(x, y + i * 2, i == wahl ? K_PFEIL : 0, PAL_GELB);
      text(x + 2, y + i * 2, eintraege[i], i == wahl ? PAL_GELB : PAL_TEXT);
    }
    bild_warten();
    if (pruef_angefordert()) pruef_schleife();
    t = tasten_alle();
    if (t & KEY_UP) {
      wahl = wahl == 0 ? anzahl - 1 : wahl - 1;
      klang_spielen(KLANG_KLICK);
    }
    if (t & KEY_DOWN) {
      wahl = wahl == anzahl - 1 ? 0 : wahl + 1;
      klang_spielen(KLANG_KLICK);
    }
    if (t & (KEY_A | KEY_START)) {
      klang_spielen(KLANG_KLICK);
      return wahl;
    }
    if (t & KEY_B) return 0xff;
  }
}

static void warte_auf_a_oder_b(void) {
  while (!(tasten_alle() & (KEY_A | KEY_B | KEY_START))) bild_warten();
}

/* ------------------------------------------------------------------ Titel */

static void titel(void) {
  u16 bild = 0;
  bild_leeren();
  tafel(1, 3, 30, 12);
  kachelblock((BILD_B - TITEL_B) / 2, 5, K_TITEL, TITEL_B, TITEL_H, PAL_GELB);
  kachelblock((BILD_B - TITEL_16_B) / 2, 8, K_TITEL_16, TITEL_16_B, TITEL_16_H, PAL_ROT);
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
  tafel(1, 3, 30, 22);
  text(3, y, "So wird gespielt", PAL_GELB);
  y += 2;
  for (i = 0; spiel->anleitung[i]; i++) y += text_umbruch(3, y, 26, spiel->anleitung[i], PAL_TEXT) + 1;
  y++;
  text(3, y, "✚ wählen · A setzen", PAL_GRAU);
  text(3, y + 1, "Start: Pause", PAL_GRAU);
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
  const SpielStatistik *s;
  u8 i, y;
  u16 t;
  static const char *const STUFEN_NAMEN[STUFEN] = {"leicht", "mittel", "schwer"};
  while (1) {
    kopfzeile("Statistik");
    tafel(1, 3, 30, 22);
    y = 5;
    for (i = 0; i < SPIELE_ANZAHL; i++) {
      s = &speicher.spiele[i];
      text(3, y, spiele[i]->name, PAL_GELB);
      text(3, y + 2, "Partien gesamt", PAL_TEXT);
      zahl(23, y + 2, s->partien, 5, PAL_TEXT);
      text(3, y + 3, "davon zu zweit", PAL_TEXT);
      zahl(23, y + 3, s->hotseat, 5, PAL_TEXT);
      text(3, y + 5, "Gegen Bot  Sieg Remis Nied.", PAL_GRAU);
      for (t = 0; t < STUFEN; t++) {
        text(3, y + 6 + t, STUFEN_NAMEN[t], PAL_TEXT);
        zahl(12, y + 6 + t, s->gegen_bot[t][BILANZ_SIEG], 4, PAL_TEXT);
        zahl(18, y + 6 + t, s->gegen_bot[t][BILANZ_REMIS], 4, PAL_TEXT);
        zahl(24, y + 6 + t, s->gegen_bot[t][BILANZ_NIEDERLAGE], 4, PAL_TEXT);
      }
      y += 11;
    }
    fusszeile("B: zurück · Y: löschen");
    tasten_loslassen();
    while (1) {
      bild_warten();
      t = tasten_alle();
      if (t & (KEY_A | KEY_B | KEY_START)) {
        klang_spielen(KLANG_KLICK);
        return;
      }
      if (t & KEY_Y) break;
    }
    // Rückfrage vor dem Löschen.
    tafel(4, 10, 24, 7);
    flaeche_leeren(5, 11, 22, 5);
    text_mitte(12, "Statistik löschen?", PAL_GELB);
    text_mitte(14, "Y: ja · B: nein", PAL_TEXT);
    tasten_loslassen();
    while (1) {
      bild_warten();
      t = tasten_alle();
      if (t & KEY_Y) {
        speicher_loeschen();
        klang_spielen(KLANG_ENDE);
        break;
      }
      if (t & (KEY_B | KEY_A)) break;
    }
  }
}

/* ------------------------------------------------------------------ Spielvorbereitung */

enum { ZEILE_PLATZ0, ZEILE_PLATZ1, ZEILE_PARTIEN, ZEILE_TAUSCH, ZEILE_ANLEITUNG, ZEILE_LOS, ZEILEN };

/* Wert mit Pfeilen: ◀ in Spalte 14, Wert ab 16 (höchstens 12 Zeichen), ▶ in Spalte 29. */
static void wert_zeigen(u8 y, const char *wert, u8 aktiv) {
  flaeche_leeren(14, y, 16, 1);
  kachel(14, y, Z_PFEIL_LINKS, aktiv ? PAL_GELB : PAL_GRAU);
  text(16, y, wert, aktiv ? PAL_GELB : PAL_TEXT);
  kachel(29, y, Z_PFEIL_RECHTS, aktiv ? PAL_GELB : PAL_GRAU);
}

/* Gibt 1 zurück, wenn die Partie beginnen soll, 0 für zurück zum Menü. */
static u8 vorbereitung(const Spiel *spiel) {
  static u8 zeile = ZEILE_LOS;
  u8 i, y;
  u16 t;
  s8 schritt;
  static const char *const PARTIEN_TEXT[3] = {"1", "3", "5"};
  kopfzeile(spiel->name);
  tafel(1, 4, 30, 18);
  text(3, 5, "Wer spielt?", PAL_GRAU);
  tasten_loslassen();
  while (1) {
    for (i = 0; i < ZEILEN; i++) {
      y = 7 + i * 2 + (i >= ZEILE_PARTIEN ? 1 : 0) + (i >= ZEILE_ANLEITUNG ? 1 : 0);
      kachel(3, y, i == zeile ? K_PFEIL : 0, PAL_GELB);
      switch (i) {
        case ZEILE_PLATZ0:
        case ZEILE_PLATZ1:
          text(5, y, spiel->platz_namen[i], spiel->platz_paletten[i]);
          wert_zeigen(y, TEILNEHMER_NAMEN[teilnehmer[i]], i == zeile);
          break;
        case ZEILE_PARTIEN:
          text(5, y, "Partien", PAL_TEXT);
          wert_zeigen(y, PARTIEN_TEXT[partien_index], i == zeile);
          break;
        case ZEILE_TAUSCH:
          text(5, y, "Seiten", PAL_TEXT);
          wert_zeigen(y, seiten_tauschen ? "tauschen" : "behalten", i == zeile);
          break;
        case ZEILE_ANLEITUNG:
          text(5, y, "Anleitung", i == zeile ? PAL_GELB : PAL_TEXT);
          break;
        case ZEILE_LOS:
          text(5, y, "Los geht's!", i == zeile ? PAL_GELB : PAL_TEXT);
          break;
      }
    }
    fusszeile("✚ ändern · A wählen · B zurück");
    bild_warten();
    t = tasten_alle();
    schritt = 0;
    if (t & KEY_UP) zeile = zeile == 0 ? ZEILEN - 1 : zeile - 1;
    if (t & KEY_DOWN) zeile = zeile == ZEILEN - 1 ? 0 : zeile + 1;
    if (t & KEY_LEFT) schritt = -1;
    if (t & (KEY_RIGHT | KEY_A)) schritt = 1;
    if (t & (KEY_UP | KEY_DOWN)) klang_spielen(KLANG_KLICK);
    if (t & KEY_B) return 0;
    // Start beginnt die Partie aus jeder Zeile.
    if (t & KEY_START) return 1;
    if (schritt) {
      klang_spielen(KLANG_KLICK);
      switch (zeile) {
        case ZEILE_PLATZ0:
        case ZEILE_PLATZ1:
          teilnehmer[zeile] = (teilnehmer[zeile] + T_ANZAHL + schritt) % T_ANZAHL;
          break;
        case ZEILE_PARTIEN:
          partien_index = (partien_index + 3 + schritt) % 3;
          break;
        case ZEILE_TAUSCH:
          seiten_tauschen ^= 1;
          break;
        case ZEILE_ANLEITUNG:
          if (t & KEY_A) {
            anleitung(spiel);
            return vorbereitung(spiel);
          }
          break;
        case ZEILE_LOS:
          if (t & KEY_A) return 1;
          break;
      }
    }
  }
}

/* ------------------------------------------------------------------ Partie */

static u8 platz_teilnehmer[PLAETZE_MAX];

static void platz_text(const Spiel *spiel, u8 y, u8 platz, const char *nachsatz) {
  u8 n = text_laenge(spiel->platz_namen[platz]) + text_laenge(nachsatz);
  u8 x = (BILD_B - n) / 2;
  flaeche_leeren(0, y, 32, 1);
  x += text(x, y, spiel->platz_namen[platz], spiel->platz_paletten[platz]);
  text(x, y, nachsatz, PAL_TEXT);
}

/* Vor einem Zug mit verdeckten Karten: Bildschirm leeren, bis der richtige Mensch übernimmt. */
static void wechselbildschirm(const Spiel *spiel, u8 platz, u8 port) {
  bild_leeren();
  tafel(3, 8, 26, 11);
  platz_text(spiel, 10, platz, " ist dran");
  text_mitte(13, port == 0 ? "Controller 1 nehmen" : "Controller 2 nehmen", PAL_TEXT);
  text_mitte(16, "A: Karten zeigen", PAL_GRAU);
  tasten_loslassen();
  while (!(tasten_neu(port) & KEY_A)) bild_warten();
}

/* Pausenmenü. Gibt 1 zurück, wenn die Partie abgebrochen werden soll. */
static u8 pause(void) {
  static const char *const EINTRAEGE[2] = {"Weiter", "Zum Hauptmenü"};
  u8 wahl;
  tafel(6, 9, 20, 9);
  flaeche_leeren(7, 10, 18, 7);
  text_mitte(10, "Pause", PAL_GELB);
  tasten_loslassen();
  wahl = menue(9, 12, EINTRAEGE, 2, 0);
  tasten_loslassen();
  return wahl == 1;
}

static void partie_bild(const Spiel *spiel, u8 nummer, u8 anzahl, const u8 *siege) {
  kopfzeile(spiel->name);
  tafel(6, 4, 20, 20);
  flaeche_leeren(0, 25, 32, 1);
  if (anzahl > 1) {
    text(1, 25, "Partie", PAL_GRAU);
    zahl(8, 25, nummer + 1, 1, PAL_GRAU);
    text(10, 25, "von", PAL_GRAU);
    zahl(14, 25, anzahl, 1, PAL_GRAU);
    text(18, 25, "Stand", PAL_GRAU);
    zahl(24, 25, siege[0], 2, PAL_TEXT);
    text(27, 25, ":", PAL_GRAU);
    zahl(29, 25, siege[1], 2, PAL_TEXT);
  }
}

/* Spielt eine Partie. Gibt ERGEBNIS_… zurück (Sieger in *sieger) oder 0xff bei Abbruch. */
static u8 eine_partie(const Spiel *spiel, u8 nummer, u8 anzahl, const u8 *siege, u8 *sieger) {
  u8 platz, t, port, ergebnis, menschen_port = 0xff, gleicher_controller = 0;
  u16 zug, tasten, alt;

  zufall_aus_zahl(&partie_zufall, eingabe_unruhe);
  spiel->aufbauen(partie_stand, &partie_zufall);
  partie_auswahl = spiel->auswahl_start;
  partie_bild(spiel, nummer, anzahl, siege);

  // Teilen sich zwei Menschen einen Controller, braucht ein verdecktes Spiel den Wechselbildschirm.
  for (platz = 0; platz < spiel->plaetze; platz++) {
    t = platz_teilnehmer[platz];
    if (IST_BOT(t)) continue;
    if (menschen_port == t) gleicher_controller = 1;
    menschen_port = t;
  }

  while (1) {
    platz = spiel->am_zug(partie_stand);
    if (platz == PLATZ_KEIN) break;
    t = platz_teilnehmer[platz];
    if (IST_BOT(t)) {
      spiel->zeichnen(partie_stand, partie_auswahl, 0);
      platz_text(spiel, 3, platz, " überlegt …");
      fusszeile("Start: Pause");
      // Kurz warten, damit man den Zug des Bots mitverfolgen kann.
      for (alt = 0; alt < 24; alt++) {
        bild_warten();
        if ((tasten_alle() & KEY_START) && pause()) return 0xff;
      }
      zug = spiel->bot(partie_stand, BOT_STUFE(t), &partie_zufall);
    } else {
      port = t;
      if (spiel->verdeckt && gleicher_controller) {
        wechselbildschirm(spiel, platz, port);
        partie_bild(spiel, nummer, anzahl, siege);
      }
      platz_text(spiel, 3, platz, port == 0 ? " ist dran (Controller 1)" : " ist dran (Controller 2)");
      fusszeile("A: setzen · Start: Pause");
      spiel->zeichnen(partie_stand, partie_auswahl, 1);
      zug = ZUG_KEIN;
      while (zug == ZUG_KEIN) {
        bild_warten();
        tasten = tasten_neu(port);
        if ((tasten_alle() & KEY_START)) {
          if (pause()) return 0xff;
          partie_bild(spiel, nummer, anzahl, siege);
          platz_text(spiel, 3, platz, port == 0 ? " ist dran (Controller 1)" : " ist dran (Controller 2)");
          fusszeile("A: setzen · Start: Pause");
          spiel->zeichnen(partie_stand, partie_auswahl, 1);
          continue;
        }
        if (!tasten) continue;
        alt = partie_auswahl;
        zug = spiel->bedienen(partie_stand, &partie_auswahl, tasten);
        if (alt != partie_auswahl) {
          klang_spielen(KLANG_KLICK);
          spiel->zeichnen(partie_stand, partie_auswahl, 1);
        }
      }
    }
    if (!zug_erlaubt(spiel, partie_stand, zug)) continue;
    klang_spielen(spiel->ziehen(partie_stand, zug));
    spiel->zeichnen(partie_stand, partie_auswahl, 0);
    bild_warten();
  }
  ergebnis = spiel->ergebnis(partie_stand, sieger);
  spiel->zeichnen(partie_stand, partie_auswahl, 0);
  return ergebnis;
}

static void statistik_eintragen(u8 spiel_nr, u8 ergebnis, u8 sieger) {
  SpielStatistik *s = &speicher.spiele[spiel_nr];
  u8 mensch = 0xff, bot = 0xff, p, bilanz;
  s->partien++;
  for (p = 0; p < PLAETZE_MAX; p++) {
    if (IST_BOT(platz_teilnehmer[p])) bot = p;
    else mensch = p;
  }
  if (mensch != 0xff && bot == 0xff) s->hotseat++;
  if (mensch != 0xff && bot != 0xff) {
    bilanz = ergebnis == ERGEBNIS_REMIS ? BILANZ_REMIS : sieger == mensch ? BILANZ_SIEG : BILANZ_NIEDERLAGE;
    s->gegen_bot[BOT_STUFE(platz_teilnehmer[bot])][bilanz]++;
  }
  speicher_sichern();
}

/* Stand der Serie in zwei Zeilen: Überschrift und „Controller 1 1 : 0 Bot mittel“. */
static void serienstand(u8 letzte, u8 nummer, u8 anzahl, const u8 *siege) {
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
  x += text(x, 25, a, PAL_TEXT) + 1;
  zahl(x, 25, siege[0], 1, PAL_GELB);
  text(x + 2, 25, ":", PAL_GRAU);
  zahl(x + 4, 25, siege[1], 1, PAL_GELB);
  text(x + 6, 25, b, PAL_TEXT);
}

/* Eine Serie aus 1, 3 oder 5 Partien. */
static void serie(u8 spiel_nr) {
  const Spiel *spiel = spiele[spiel_nr];
  u8 anzahl = PARTIEN_WAHL[partien_index];
  u8 siege[PLAETZE_MAX] = {0, 0};
  u8 nummer = 0, tausch = 0, ergebnis, sieger = PLATZ_KEIN, p, letzte;
  u16 t;
  while (1) {
    for (p = 0; p < spiel->plaetze; p++) platz_teilnehmer[p] = teilnehmer[p ^ tausch];
    ergebnis = eine_partie(spiel, nummer, anzahl, siege, &sieger);
    if (ergebnis == 0xff) return;
    statistik_eintragen(spiel_nr, ergebnis, sieger);
    // Siege zählen je Teilnehmer der Vorbereitung, nicht je Zeichen – sonst verwirrt der Seitentausch.
    if (ergebnis == ERGEBNIS_SIEG) siege[sieger ^ tausch]++;
    letzte = nummer + 1 >= anzahl;

    if (ergebnis == ERGEBNIS_SIEG) {
      platz_text(spiel, 3, sieger, " gewinnt!");
      klang_spielen(IST_BOT(platz_teilnehmer[sieger]) && !IST_BOT(platz_teilnehmer[sieger ^ 1]) ? KLANG_ENDE : KLANG_SIEG);
    } else {
      flaeche_leeren(0, 3, 32, 1);
      text_mitte(3, "Unentschieden", PAL_TEXT);
      klang_spielen(KLANG_ENDE);
    }
    flaeche_leeren(0, 24, 32, 2);
    if (anzahl > 1) serienstand(letzte, nummer, anzahl, siege);
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
      siege[0] = siege[1] = 0;
      tausch = 0;
    } else {
      nummer++;
      if (seiten_tauschen) tausch ^= 1;
    }
  }
}

/* ------------------------------------------------------------------ Hauptmenü */

/*
 * Der Startcode von PVSnesLib löscht nur den Variablenbereich der ersten Quelldatei. Darum setzt
 * jedes Modul seine Variablen ohne Startwert hier ausdrücklich.
 */
static void variablen_start(void) {
  u8 i;
  partien_index = 0;
  partie_auswahl = 0;
  for (i = 0; i < PLAETZE_MAX; i++) platz_teilnehmer[i] = 0;
  for (i = 0; i < SPIELSTAND_GROESSE; i++) partie_stand[i] = 0;
  eingabe_start();
  pruef_start();
}

int main(void) {
  static const char *const EINTRAEGE[3] = {"Tic-Tac-Toe", "Statistik", "Über Brett & Blatt 16"};
  u8 wahl = 0;
  variablen_start();
  klang_start();
  bild_start();
  speicher_laden();
  titel();
  while (1) {
    kopfzeile("Brett & Blatt 16");
    tafel(1, 4, 30, 14);
    text(4, 6, "Spiel wählen", PAL_GRAU);
    text_umbruch(3, 20, 26, "Weitere Spiele folgen: Vier in einer Reihe, Reversi, Würfelblock …", PAL_GRAU);
    fusszeile("✚ wählen · A bestätigen");
    tasten_loslassen();
    wahl = menue(4, 8, EINTRAEGE, 3, wahl);
    tasten_loslassen();
    if (wahl == 0) {
      if (vorbereitung(&spiel_tic_tac_toe)) serie(0);
    } else if (wahl == 1) {
      statistik();
    } else if (wahl == 2) {
      ueber();
    } else {
      titel();
      wahl = 0;
    }
  }
  return 0;
}
