#include "klang.h"

extern char klang_klick, klang_klick_ende, klang_setzen, klang_setzen_ende, klang_start_brr, klang_start_ende;
extern char klang_sieg, klang_sieg_ende, klang_ende_brr, klang_ende_ende;
extern char klang_wuerfeln, klang_wuerfeln_ende;
extern char klang_karte, klang_karte_ende;

static brrsamples samples[KLANG_ANZAHL];
static u8 bereit;

/* Die WAV-Dateien haben 16 kHz; Tonhöhe 8 (8 × 2 kHz) spielt sie in Originalgeschwindigkeit. */
#define TONHOEHE 8

void klang_start(void) {
  bereit = 0;
  spcBoot();
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
  bereit = 1;
}

void klang_spielen(u8 klang) {
  if (bereit && klang < KLANG_ANZAHL) spcPlaySound(klang);
}

void klang_bedienen(void) {
  if (bereit) spcProcess();
}
