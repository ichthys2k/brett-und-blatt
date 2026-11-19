# Brett & Blatt 16 – SNES-ROM. Werkzeugkette: werkzeuge/werkzeugkette.sh (setzt PVSNESLIB_HOME).
PVSNESLIB_HOME ?= $(HOME)/.cache/brett-und-blatt-snes/pvsneslib
export PVSNESLIB_HOME

export ROMNAME := brett-und-blatt-16
export ROMTITLE := BRETT UND BLATT 16
# ROM mit SRAM und Batterie, 2 KB SRAM für die Statistik
export CARTRIDGETYPE := 02
export SRAMSIZE := 01
export ROMSIZE := 0a
export ROMBANKS := 32

MUSIK_IT := \
	res/musik/00_herbstbibliothek.it res/musik/01_bedenkzeit.it res/musik/02_holzbrett.it \
	res/musik/03_nachtpartie.it res/musik/04_stille-zuege.it \
	res/musik/05_cafe-am-markt.it res/musik/06_gemischtes-blatt.it res/musik/07_sonntagsrunde.it \
	res/musik/08_stich-fuer-stich.it res/musik/09_wohnzimmerlicht.it \
	res/musik/10_regennachmittag.it res/musik/11_kartenhaus.it res/musik/12_morgentee.it \
	res/musik/13_wolkenzug.it res/musik/14_kerzenschein.it \
	res/musik/15_wuerfelglueck.it res/musik/16_volle-fahrt.it res/musik/17_kunterbunt.it \
	res/musik/18_seegang.it res/musik/19_siegertreppchen.it
AUDIOFILES := $(MUSIK_IT)
export SOUNDBANK := res/soundbank
SMCONVFLAGS := -s -o $(SOUNDBANK) -b 20

include $(PVSNESLIB_HOME)/devkitsnes/snes_rules

GRAFIK := res/kacheln_a.bin res/kacheln_b.bin res/karten.bin res/spielfarben.bin res/palette.bin res/grafik.h
SCHACH_GRAFIK := res/schach_bg.bin res/schach_bg_pal.bin res/schach_spr.bin res/schach_spr_pal.bin res/schach_grafik.h
KLAENGE := res/klick.brr res/setzen.brr res/start.brr res/sieg.brr res/ende.brr res/wuerfeln.brr res/karte.brr

.PHONY: all clean ressourcen
.DEFAULT_GOAL := all

all: ressourcen $(ROMNAME).sfc

ressourcen: $(GRAFIK) $(SCHACH_GRAFIK) $(KLAENGE) $(SOUNDBANK).asm

$(GRAFIK) &: werkzeuge/grafik.mjs werkzeuge/schrift8x8.mjs
	node werkzeuge/grafik.mjs res

$(SCHACH_GRAFIK) &: werkzeuge/schach_grafik.mjs
	node werkzeuge/schach_grafik.mjs res

res/%.wav: werkzeuge/klang.mjs
	node werkzeuge/klang.mjs res

$(MUSIK_IT) &: werkzeuge/musik.mjs
	node werkzeuge/musik.mjs res/musik

# Alle Objekte hängen von den erzeugten Dateien ab (Kachelnummern in grafik.h, Daten in data.asm, soundbank.h).
$(OFILES): $(GRAFIK) $(SCHACH_GRAFIK) $(KLAENGE) $(SOUNDBANK).asm $(wildcard src/*.h)

clean: cleanBuildRes cleanRom
	rm -rf res
