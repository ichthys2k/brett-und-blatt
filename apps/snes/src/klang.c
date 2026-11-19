#include "klang.h"
#include "spiel.h"

extern char SOUNDBANK__0, SOUNDBANK__1;

extern char klang_klick, klang_klick_ende, klang_setzen, klang_setzen_ende, klang_start_brr, klang_start_ende;
extern char klang_sieg, klang_sieg_ende, klang_ende_brr, klang_ende_ende;
extern char klang_wuerfeln, klang_wuerfeln_ende;
extern char klang_karte, klang_karte_ende;

const char *const musik_playlist_namen[PLAYLIST_ANZAHL] = {
  "Denkraum",
  "Kartentisch",
  "Patience",
  "Spielabend"
};

const char *const musik_namen[MUSIK_ANZAHL] = {
  "Herbstbibliothek",
  "Bedenkzeit",
  "Holzbrett",
  "Nachtpartie",
  "Stille Züge",
  "Cafe am Markt",
  "Gemischtes Blatt",
  "Sonntagsrunde",
  "Stich für Stich",
  "Wohnzimmerlicht",
  "Regennachmittag",
  "Kartenhaus",
  "Morgentee",
  "Wolkenzug",
  "Kerzenschein",
  "Würfelglück",
  "Volle Fahrt",
  "Kunterbunt",
  "Seegang",
  "Siegertreppchen"
};

const u8 musik_playlist[MUSIK_ANZAHL] = {
  PLAYLIST_DENKRAUM,    PLAYLIST_DENKRAUM,    PLAYLIST_DENKRAUM,    PLAYLIST_DENKRAUM,    PLAYLIST_DENKRAUM,
  PLAYLIST_KARTENTISCH, PLAYLIST_KARTENTISCH, PLAYLIST_KARTENTISCH, PLAYLIST_KARTENTISCH, PLAYLIST_KARTENTISCH,
  PLAYLIST_PATIENCE,    PLAYLIST_PATIENCE,    PLAYLIST_PATIENCE,    PLAYLIST_PATIENCE,    PLAYLIST_PATIENCE,
  PLAYLIST_SPIELABEND,  PLAYLIST_SPIELABEND,  PLAYLIST_SPIELABEND,  PLAYLIST_SPIELABEND,  PLAYLIST_SPIELABEND
};

/* Zuordnung der 31 Spiele (Reihenfolge wie in spiele[] in main.c) zu den 4 Stimmungen aus music.json. */
static const u8 SPIEL_PLAYLIST[SPIELE_ANZAHL] = {
  PLAYLIST_SPIELABEND,  /* 0: Tic-Tac-Toe */
  PLAYLIST_SPIELABEND,  /* 1: Vier gewinnt */
  PLAYLIST_DENKRAUM,    /* 2: Reversi */
  PLAYLIST_DENKRAUM,    /* 3: Gomoku */
  PLAYLIST_SPIELABEND,  /* 4: Ultimate Tic-Tac-Toe */
  PLAYLIST_DENKRAUM,    /* 5: Mühle */
  PLAYLIST_DENKRAUM,    /* 6: Dame */
  PLAYLIST_DENKRAUM,    /* 7: Teilergitter */
  PLAYLIST_SPIELABEND,  /* 8: Kniffel */
  PLAYLIST_SPIELABEND,  /* 9: Mäxle */
  PLAYLIST_KARTENTISCH, /* 10: Paare */
  PLAYLIST_SPIELABEND,  /* 11: Mensch ärgere dich nicht */
  PLAYLIST_SPIELABEND,  /* 12: Domino */
  PLAYLIST_DENKRAUM,    /* 13: Zahlenmauer */
  PLAYLIST_DENKRAUM,    /* 14: Zielzahl */
  PLAYLIST_KARTENTISCH, /* 15: Elfer raus */
  PLAYLIST_PATIENCE,    /* 16: Solitaire */
  PLAYLIST_KARTENTISCH, /* 17: Mau-Mau */
  PLAYLIST_KARTENTISCH, /* 18: Uno */
  PLAYLIST_KARTENTISCH, /* 19: Schwarzer Peter */
  PLAYLIST_KARTENTISCH, /* 20: Quartett */
  PLAYLIST_KARTENTISCH, /* 21: Arschloch / Präsident */
  PLAYLIST_KARTENTISCH, /* 22: Speed */
  PLAYLIST_SPIELABEND,  /* 23: Ligretto */
  PLAYLIST_KARTENTISCH, /* 24: Poker */
  PLAYLIST_KARTENTISCH, /* 25: Skat */
  PLAYLIST_KARTENTISCH, /* 26: Schafkopf */
  PLAYLIST_KARTENTISCH, /* 27: Doppelkopf */
  PLAYLIST_KARTENTISCH, /* 28: Binokel */
  PLAYLIST_DENKRAUM,    /* 29: Schach */
  PLAYLIST_DENKRAUM     /* 30: Go */
};

static brrsamples samples[KLANG_ANZAHL];
static u8 bereit;
static u8 musik_an;
static u8 aktuelles_stueck;
static u8 stueck_laeuft;

/* Die WAV-Dateien haben 16 kHz; Tonhöhe 8 (8 × 2 kHz) spielt sie in Originalgeschwindigkeit. */
#define TONHOEHE 8
/* Musik etwas dezenter als die Effekte, damit Züge und Fanfaren klar hörbar bleiben. */
#define MUSIK_LAUTSTAERKE 150

void klang_start(void) {
  bereit = 0;
  musik_an = 1;
  aktuelles_stueck = 0xff;
  stueck_laeuft = 0;
  spcBoot();
  /* Mehrere Soundbank-Bänke müssen in umgekehrter Reihenfolge angemeldet werden. */
  spcSetBank(&SOUNDBANK__1);
  spcSetBank(&SOUNDBANK__0);
  // Puffer im Klangspeicher für das gerade gespielte Sample (Blöcke zu 256 Byte, größtes etwa 6 KB).
  spcAllocateSoundRegion(32);
  // spcPlaySound(i) liest den Eintrag i ab dem zuletzt eingetragenen vorwärts (je 8 Byte).
  // Darum rückwärts eintragen: Zuletzt kommt samples[0], dann ist Index i = samples[i].
  spcSetSoundEntry(15, 8, TONHOEHE, &klang_karte_ende - &klang_karte, (u8 *)&klang_karte, &samples[KLANG_KARTE]);
  spcSetSoundEntry(15, 8, TONHOEHE, &klang_wuerfeln_ende - &klang_wuerfeln, (u8 *)&klang_wuerfeln, &samples[KLANG_WUERFELN]);
  spcSetSoundEntry(15, 8, TONHOEHE, &klang_ende_ende - &klang_ende_brr, (u8 *)&klang_ende_brr, &samples[KLANG_ENDE]);
  spcSetSoundEntry(15, 8, TONHOEHE, &klang_sieg_ende - &klang_sieg, (u8 *)&klang_sieg, &samples[KLANG_SIEG]);
  spcSetSoundEntry(15, 8, TONHOEHE, &klang_start_ende - &klang_start_brr, (u8 *)&klang_start_brr, &samples[KLANG_START]);
  spcSetSoundEntry(15, 8, TONHOEHE, &klang_setzen_ende - &klang_setzen, (u8 *)&klang_setzen, &samples[KLANG_SETZEN]);
  spcSetSoundEntry(15, 8, TONHOEHE, &klang_klick_ende - &klang_klick, (u8 *)&klang_klick, &samples[KLANG_KLICK]);
  spcSetModuleVolume(MUSIK_LAUTSTAERKE);
  bereit = 1;
}

void klang_spielen(u8 klang) {
  if (bereit && klang < KLANG_ANZAHL) spcPlaySound(klang);
}

void klang_bedienen(void) {
  if (bereit) spcProcess();
}

void musik_spielen(u8 nr) {
  if (!bereit || nr >= MUSIK_ANZAHL) return;
  aktuelles_stueck = nr;
  if (!musik_an) return;
  if (stueck_laeuft) spcStop();
  spcLoad(nr);
  spcSetModuleVolume(MUSIK_LAUTSTAERKE);
  spcPlay(0);
  stueck_laeuft = 1;
}

void musik_stoppen(void) {
  if (!bereit) return;
  if (stueck_laeuft) {
    spcStop();
    stueck_laeuft = 0;
  }
}

void musik_fuer_spiel(u8 spiel_nr, u16 zufall) {
  u8 pl, basis, versatz, nr;
  if (spiel_nr >= SPIELE_ANZAHL) return;
  pl = SPIEL_PLAYLIST[spiel_nr];
  basis = pl * 5;
  versatz = (u8)(zufall % 5);
  nr = basis + versatz;
  if (nr == aktuelles_stueck) nr = basis + ((versatz + 1) % 5);
  musik_spielen(nr);
}

void musik_naechstes(void) {
  u8 basis, nr;
  if (aktuelles_stueck >= MUSIK_ANZAHL) {
    nr = 0;
  } else {
    basis = (aktuelles_stueck / 5) * 5;
    nr = basis + ((aktuelles_stueck - basis + 1) % 5);
  }
  musik_an = 1;
  musik_spielen(nr);
}

void musik_umschalten(void) {
  if (musik_an) {
    musik_an = 0;
    musik_stoppen();
  } else {
    musik_an = 1;
    if (aktuelles_stueck < MUSIK_ANZAHL) musik_spielen(aktuelles_stueck);
    else musik_spielen(0);
  }
}

u8 musik_aktiv(void) {
  return musik_an;
}

u8 musik_aktuell(void) {
  return aktuelles_stueck;
}

u8 musik_laeuft(void) {
  return stueck_laeuft;
}
