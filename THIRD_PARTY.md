# Fremde Bestandteile

Brett & Blatt steht unter der AGPL-3.0. Einige Bestandteile stammen von anderen und stehen unter eigenen, damit verträglichen Lizenzen. Ihre Hinweise müssen bei jeder Weitergabe erhalten bleiben.

## chess.js

Schachregeln für das Spiel Schach (`packages/games/chess`). https://github.com/jhlywa/chess.js

```
Copyright (c) 2025, Jeff Hlywa (jhlywa@gmail.com)
All rights reserved.

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are met:

1. Redistributions of source code must retain the above copyright notice,
   this list of conditions and the following disclaimer.
2. Redistributions in binary form must reproduce the above copyright notice,
   this list of conditions and the following disclaimer in the documentation
   and/or other materials provided with the distribution.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT OWNER OR CONTRIBUTORS BE
LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR
CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF
SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS
INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN
CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE)
ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE
POSSIBILITY OF SUCH DAMAGE.
```

Die Feldtabellen des Schach-Bots folgen der frei veröffentlichten „Simplified Evaluation Function“ von Tomasz Michniewski (Chess Programming Wiki).

## uqr

QR-Codes für Einladungen in Online-Räume (`apps/web`). https://github.com/unjs/uqr

```
MIT License

Copyright (c) Project Nayuki
Copyright (c) 2023 Anthony Fu <https://github.com/antfu>

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## german-wordlist

Wörterbuch für Wortgitter (`packages/games/scrabble/src/dict/dawg.ts`, gebaut mit `packages/games/scrabble/scripts/build-dict.mjs`): „german-wordlist“, die Wortliste des Spiels Tanglet. https://github.com/enz/german-wordlist (Stand Commit `1071d87`, 13.09.2026). Großgeschrieben, ß als SS, nur Wörter aus 2 bis 15 Buchstaben A–Z und ÄÖÜ.

Lizenz: CC0 1.0 Universal (gemeinfrei, keine Bedingungen). https://creativecommons.org/publicdomain/zero/1.0/

## Narrenhof-Porträts (KI-erzeugt)

Gegner-Porträts im Narrenhof (`packages/games/color-sorter/src/ui/portraits/*.webp`): **KI-erzeugt** mit dem Bildgenerator von Canva (Canva AI, „generate image“) nach eigenen Bildbeschreibungen, Oktober 2026. Jede Figur hat ein Grundbild (schmunzelnd) und zwei daraus abgeleitete Fassungen (lachend, Lachkrampf). Die Figuren sind eigene Erfindungen bzw. Gestalten aus gemeinfreien Fabeln und Märchen (Reineke Fuchs, Froschkönig u. a.).

Nach den Nutzungsbedingungen von Canva gehören die Ergebnisse dem Ersteller; sie stehen wie die übrigen Inhalte unter CC BY-SA 4.0 (Brett & Blatt). Hinweis gemäß Canva: Die Bilder sind KI-erzeugt.

## Bildkarten-Porträts (KI-erzeugt)

Bube, Dame und König des französischen Kartenbilds sowie Unter, Ober und König des deutschen Blatts (`packages/ui/src/cards/portraits/*.webp`, 24 Bilder): **KI-erzeugt** mit einem Gemini-Bildmodell (Google, „gemini-3.1-flash-image“) nach eigenen Bildbeschreibungen und mit einem Narrenhof-Porträt als Stilvorlage, November 2026. Auswahl und Zuschnitt durch Cornelius Lipponer; Werkzeuge in `scripts/grafik/`. Die Figuren sind eigene Erfindungen (Tiere in Königsgewändern), keine echten Personen.

Sie stehen wie die übrigen Inhalte unter CC BY-SA 4.0 (Brett & Blatt). Hinweis: Die Bilder sind KI-erzeugt; ob an ihnen ein Urheberrecht besteht, ist rechtlich nicht abschließend geklärt.

## Almendra

Zierschrift für Überschriften im Aussehen „Taverne“ (`apps/web`), über `@fontsource/almendra`. https://github.com/fontsource/font-files

```
Copyright (c) 2011-2012, Ana Sanfelippo (anasanfe@gmail.com), with Reserved Font Name 'Almendra' Almendra-Italic.ttf: Copyright (c) 2011-2012, Ana Sanfelippo (anasanfe@gmail.com), with Reserved Font Name 'Almendra' Almendra-Bold.ttf: Copyright (c) 2011-2012, Ana Sanfelippo (anasanfe@gmail.com), with Reserved Font Name 'Almendra' Almendra-BoldItalic.ttf: Copyright (c) 2011-2012, Ana Sanfelippo (anasanfe@gmail.com), with Reserved Font Name 'Almendra'

This Font Software is licensed under the SIL Open Font License, Version 1.1.
This license is copied below, and is also available with a FAQ at:
http://scripts.sil.org/OFL


-----------------------------------------------------------
SIL OPEN FONT LICENSE Version 1.1 - 26 February 2007
-----------------------------------------------------------

PREAMBLE
The goals of the Open Font License (OFL) are to stimulate worldwide
development of collaborative font projects, to support the font creation
efforts of academic and linguistic communities, and to provide a free and
open framework in which fonts may be shared and improved in partnership
with others.

The OFL allows the licensed fonts to be used, studied, modified and
redistributed freely as long as they are not sold by themselves. The
fonts, including any derivative works, can be bundled, embedded,
redistributed and/or sold with any software provided that any reserved
names are not used by derivative works. The fonts and derivatives,
however, cannot be released under any other type of license. The
requirement for fonts to remain under this license does not apply
to any document created using the fonts or their derivatives.

DEFINITIONS
"Font Software" refers to the set of files released by the Copyright
Holder(s) under this license and clearly marked as such. This may
include source files, build scripts and documentation.

"Reserved Font Name" refers to any names specified as such after the
copyright statement(s).

"Original Version" refers to the collection of Font Software components as
distributed by the Copyright Holder(s).

"Modified Version" refers to any derivative made by adding to, deleting,
or substituting -- in part or in whole -- any of the components of the
Original Version, by changing formats or by porting the Font Software to a
new environment.

"Author" refers to any designer, engineer, programmer, technical
writer or other person who contributed to the Font Software.

PERMISSION & CONDITIONS
Permission is hereby granted, free of charge, to any person obtaining
a copy of the Font Software, to use, study, copy, merge, embed, modify,
redistribute, and sell modified and unmodified copies of the Font
Software, subject to the following conditions:

1) Neither the Font Software nor any of its individual components,
in Original or Modified Versions, may be sold by itself.

2) Original or Modified Versions of the Font Software may be bundled,
redistributed and/or sold with any software, provided that each copy
contains the above copyright notice and this license. These can be
included either as stand-alone text files, human-readable headers or
in the appropriate machine-readable metadata fields within text or
binary files as long as those fields can be easily viewed by the user.

3) No Modified Version of the Font Software may use the Reserved Font
Name(s) unless explicit written permission is granted by the corresponding
Copyright Holder. This restriction only applies to the primary font name as
presented to the users.

4) The name(s) of the Copyright Holder(s) or the Author(s) of the Font
Software shall not be used to promote, endorse or advertise any
Modified Version, except to acknowledge the contribution(s) of the
Copyright Holder(s) and the Author(s) or with their explicit written
permission.

5) The Font Software, modified or unmodified, in part or in whole,
must be distributed entirely under this license, and must not be
distributed under any other license. The requirement for fonts to
remain under this license does not apply to any document created
using the Font Software.

TERMINATION
This license becomes null and void if any of the above conditions are
not met.

DISCLAIMER
THE FONT SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO ANY WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT
OF COPYRIGHT, PATENT, TRADEMARK, OR OTHER RIGHT. IN NO EVENT SHALL THE
COPYRIGHT HOLDER BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
INCLUDING ANY GENERAL, SPECIAL, INDIRECT, INCIDENTAL, OR CONSEQUENTIAL
DAMAGES, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
FROM, OUT OF THE USE OR INABILITY TO USE THE FONT SOFTWARE OR FROM
OTHER DEALINGS IN THE FONT SOFTWARE.
```
