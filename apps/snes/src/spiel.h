/*
 * Die Spielschnittstelle von Brett & Blatt 16 – eine schlanke C-Fassung von `GameModule`
 * (packages/engine/src/types.ts). Regeln und Bot sind getrennt von der Oberfläche, damit der
 * Prüfmodus (pruef.c) sie ohne Bildschirm mit der Web-App vergleichen kann.
 *
 * Spielstand: ein fester Puffer (SPIELSTAND_GROESSE Bytes), in dem jedes Spiel seine eigene
 * Struktur ablegt.
 *
 * Züge: ein `Zug` sind bis zu ZUG_BYTES Bytes, deren Bedeutung das Spiel festlegt (`n` gültige
 * Bytes). Zwei Züge sind gleich, wenn ihre Bytes gleich sind. Der Vergleichstest übersetzt die
 * Züge der Web-App in dieselbe Form (test/spiele/<id>.ts).
 *
 * Bedienung: Jeder Zug ist eine Folge von Feldern, die man nacheinander mit dem Cursor wählt
 * (Tic-Tac-Toe: ein Feld; Mühle: von, nach, wegnehmen; Dame: Start und Sprungfelder). Den Cursor,
 * die Auswahl und die passenden nächsten Felder verwaltet der Rahmen (main.c); das Spiel sagt nur,
 * welches Feld an welcher Gitterstelle liegt, und zeichnet die Felder mit ihrer Markierung.
 */
#ifndef SPIEL_H
#define SPIEL_H

#include <snes.h>
#include "zufall.h"

#define SPIELSTAND_GROESSE 4096
#define ZUEGE_MAX 256
#define ZUG_BYTES 23
#define PLATZ_KEIN 0xff
#define PLAETZE_MAX 6
#define OPTIONEN_MAX 8
#define SEED_MAX 48
#define FELD_KEIN 0xff
#define FELDER_MAX 256
#define FOLGE_MAX 16

/* ERGEBNIS_VERLOREN: niemand gewinnt (allein gegen das Spiel verloren). */
enum { ERGEBNIS_LAEUFT, ERGEBNIS_SIEG, ERGEBNIS_REMIS, ERGEBNIS_VERLOREN };
enum { STUFE_LEICHT, STUFE_MITTEL, STUFE_SCHWER, STUFEN };

/* Markierung eines Feldes beim Zeichnen (Bits). */
#define MARK_CURSOR 1
#define MARK_GEWAEHLT 2
#define MARK_ZIEL 4

typedef struct {
  u8 n;
  u8 b[ZUG_BYTES];
} Zug;

typedef struct {
  const char *name;            /* höchstens 10 Zeichen */
  const char *const *werte;    /* Anzeigetexte, höchstens 12 Zeichen */
  u8 anzahl;
  u8 standard;
} Option;

typedef struct {
  /* Steckbrief */
  const char *name;
  const char *const *anleitung; /* Absätze, mit 0 beendet; bild.c bricht die Zeilen um */
  const char *bedienung;        /* Kurzhilfe für die Anleitung, z. B. „A setzen“ */
  const char *const *platz_namen; /* je möglichem Platz (plaetze_max Einträge) */
  const u8 *platz_paletten;
  u8 plaetze_min, plaetze_max;
  /** Verdeckte Informationen: Im Hot-Seat erscheint vor jedem Zug ein Wechselbildschirm. */
  u8 verdeckt;
  const Option *optionen;
  u8 optionen_anzahl;
  /** Drei Brettpaletten (Paletten 5–7) aus werkzeuge/grafik.mjs (FARBEN_…), beim Partiebeginn geladen. */
  u16 brett_farben;

  /* Regeln */
  /** Wie `setup(seats, options, seed)`: Zufall nur über zufall_strom(…, seed, „strom“) wie in der Web-App. */
  void (*aufbauen)(u8 *stand, const u8 *optionen, u8 plaetze, const char *seed);
  /** Wer am Zug ist, oder PLATZ_KEIN nach Spielende. */
  u8 (*am_zug)(const u8 *stand);
  /** Schreibt alle erlaubten Züge in `liste` (höchstens ZUEGE_MAX) und gibt ihre Zahl zurück. */
  u16 (*zuege)(const u8 *stand, Zug *liste);
  /** Führt einen erlaubten Zug aus und gibt den passenden Klang zurück (KLANG_…). */
  u8 (*ziehen)(u8 *stand, const Zug *zug);
  /** ERGEBNIS_…; bei einem Sieg stehen die Gewinner als Bitmaske (Bit = Platz) in `sieger`. */
  u8 (*ergebnis)(const u8 *stand, u8 *sieger);

  /* Bot: schreibt einen erlaubten Zug nach `zug`. */
  void (*bot)(const u8 *stand, u8 stufe, Zufall *z, Zug *zug);

  /* Prüfmodus: Spielstand in fester Form ausgeben, gibt die Länge zurück. */
  u16 (*ausgeben)(const u8 *stand, u8 *puffer);

  /* Oberfläche */
  /** Größe des Cursorgitters. */
  void (*gitter)(const u8 *stand, u8 *breite, u8 *hoehe);
  /** Feld an einer Gitterstelle oder FELD_KEIN. */
  u8 (*feld_an)(const u8 *stand, u8 x, u8 y);
  /** Die Felderfolge, mit der man einen Zug wählt. Gibt die Länge zurück. */
  u8 (*felder)(const u8 *stand, const Zug *zug, u8 *felder);
  /** Zeichnet das Spielfeld; `markierung[feld]` trägt MARK_… (Länge FELDER_MAX). */
  void (*zeichnen)(const u8 *stand, const u8 *markierung, u8 aktiv);
  /** Startstelle des Cursors. */
  u8 cursor_x, cursor_y;
  /**
   * Zusatzzüge (optional, sonst 0): erlaubt wie bei isLegal in der Web-App, aber nicht Teil von
   * legalMoves – etwa Würfel festhalten im Würfelblock. Bedienung und Prüfung kennen sie, die
   * verglichene Zugliste nicht.
   */
  u16 (*zusatz)(const u8 *stand, Zug *liste);
  /**
   * Name und Farbe eines Platzes hängen von der Spielerzahl ab (optional, sonst 0): gibt den Index
   * in platz_namen/platz_paletten zurück – etwa „Nicht ärgern!“ zu zweit mit Gelb und Rot.
   */
  u8 (*platz_farbe)(u8 plaetze, u8 platz);
  /**
   * Freie Eingaben (optional, sonst 0): erlaubt einen Zug wie isLegal, auch wenn er in keiner Liste
   * steht – etwa eine selbst ausgerechnete Rechenmauer. zug_erlaubt fragt es nach den Listen.
   */
  u8 (*erlaubt)(const u8 *stand, const Zug *zug);
  /** Optional: lädt spielspezifische BG-Kacheln (ab 0x100) und OAM-Sprites beim Partiebeginn. */
  void (*grafik_laden)(void);
  /** Optional: animiert einen Zug unmittelbar vor spiel->ziehen() (läuft nie im Prüfmodus). */
  void (*animieren)(const u8 *stand, const Zug *zug);
  /** 1: Spiel zeichnet Kopf- und Fußzeile selbst im Vollbild (z. B. Battle Chess). */
  u8 vollbild;
} Spiel;

extern const Spiel spiel_tic_tac_toe;
extern const Spiel spiel_vier;
extern const Spiel spiel_reversi;
extern const Spiel spiel_gomoku;
extern const Spiel spiel_uttt;
extern const Spiel spiel_muehle;
extern const Spiel spiel_dame;
extern const Spiel spiel_teiler;
extern const Spiel spiel_kniffel;
extern const Spiel spiel_maexle;
extern const Spiel spiel_paare;
extern const Spiel spiel_ludo;
extern const Spiel spiel_domino;
extern const Spiel spiel_mauer;
extern const Spiel spiel_zielzahl;
extern const Spiel spiel_elevens;
extern const Spiel spiel_solitaire;
extern const Spiel spiel_mau_mau;
extern const Spiel spiel_uno;
extern const Spiel spiel_peter;
extern const Spiel spiel_quartett;
extern const Spiel spiel_president;
extern const Spiel spiel_speed;
extern const Spiel spiel_ligretto;
extern const Spiel spiel_poker;
extern const Spiel spiel_skat;
extern const Spiel spiel_schafkopf;
extern const Spiel spiel_doppelkopf;
extern const Spiel spiel_binokel;
extern const Spiel spiel_chess;
extern const Spiel spiel_go;

#define SPIELE_ANZAHL 31
extern const Spiel *const spiele[SPIELE_ANZAHL];

/** Der gemeinsame Spielstand (Partie und Prüfmodus laufen nie gleichzeitig). Liegt wie die
 * Zugliste in Bank $7F (ram.asm) – Bank $7E ist mit den C-Variablen und PVSnesLib knapp. */
extern u8 spielstand[SPIELSTAND_GROESSE];
/** Gemeinsame Zugliste für den Rahmen und den Prüfmodus. */
extern Zug zugliste[ZUEGE_MAX];

/** Sind zwei Züge gleich? */
u8 zug_gleich(const Zug *a, const Zug *b);
/** Erlaubte Züge und Zusatzzüge zusammen in `zugliste`; gibt die Anzahl zurück. */
u16 alle_zuege(const Spiel *spiel, const u8 *stand);
/** Ist `zug` erlaubt (auch als Zusatzzug)? (Erzeugt die Liste in `zugliste` neu.) */
u8 zug_erlaubt(const Spiel *spiel, const u8 *stand, const Zug *zug);
/** Zufälliger erlaubter Zug (für die leichten Bots). */
void zug_zufaellig(const Spiel *spiel, const u8 *stand, Zufall *z, Zug *zug);
/** Bilder seit dem Einschalten (für Zeitbudgets der Bots). */
#define BILDER() (snes_vblank_count)

#endif
