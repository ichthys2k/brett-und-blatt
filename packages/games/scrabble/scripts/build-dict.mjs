#!/usr/bin/env node
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
mkdirSync(join(root, 'src/dict'), { recursive: true });

const words = new Set();

const basic = [
  'AB', 'AN', 'AS', 'AT', 'AU', 'DA', 'DE', 'DO', 'DU', 'EH', 'EI', 'EN', 'ER', 'ES',
  'HA', 'HE', 'HI', 'HO', 'ICH', 'IM', 'IN', 'IS', 'IST', 'JA', 'JE', 'KO', 'LA', 'LE', 'LO', 'LU',
  'MA', 'ME', 'MI', 'MO', 'MU', 'NA', 'NE', 'NI', 'NO', 'NU', 'OB', 'OH', 'PA', 'PE', 'PI', 'PO',
  'RE', 'SA', 'SE', 'SI', 'SO', 'ST', 'SU', 'TA', 'TE', 'TI', 'TO', 'TU', 'UM', 'UN', 'UR', 'US',
  'VE', 'VO', 'VON', 'VOR', 'WA', 'WE', 'WO', 'ZU',
  'ACH', 'ACT', 'AHA', 'AKT', 'ALL', 'ALT', 'AMT', 'AND', 'ARM', 'ART', 'ASS', 'AST', 'AUF', 'AUS',
  'BAD', 'BAH', 'BAN', 'BAR', 'BAU', 'BEI', 'BIN', 'BIS', 'BIT', 'BOT', 'BOX', 'BRI', 'BUB', 'BUS',
  'BUT', 'CAP', 'CAR', 'CHI', 'COD', 'COL', 'COM', 'CON', 'COP', 'CUP', 'CUT', 'DAB', 'DACH',
  'DAM', 'DAN', 'DAR', 'DAS', 'DAT', 'DAU', 'DECK', 'DEIN', 'DEL', 'DEM', 'DEN', 'DER', 'DES',
  'DET', 'DICH', 'DIE', 'DIES', 'DIN', 'DIR', 'DIS', 'DOC', 'DOG', 'DOM', 'DON', 'DOS', 'DOT',
  'DUAL', 'DUCH', 'DUFT', 'DUMM', 'DURCH', 'EBEN', 'ECKE', 'EDEL', 'EHER', 'EHRE', 'EICH', 'EIER',
  'EIGEN', 'EIL', 'EIN', 'EINE', 'EINER', 'EINES', 'EINS', 'EIS', 'ELF', 'END', 'ENDE', 'ENG',
  'ENGE', 'ERDE', 'ERST', 'ESSE', 'ETWA', 'EUCH', 'EUER', 'EULE', 'EURO', 'EXAM', 'FACH', 'FAHR',
  'FALL', 'FALS', 'FAN', 'FANG', 'FAR', 'FAST', 'FAUL', 'FAX', 'FEHL', 'FEIN', 'FELD', 'FELL',
  'FERN', 'FEST', 'FEUER', 'FIEL', 'FILM', 'FIND', 'FISCH', 'FLACH', 'FLAG', 'FLIEG', 'FLUG',
  'FLUSS', 'FOLGE', 'FORM', 'FORST', 'FORT', 'FRAGE', 'FRAU', 'FREI', 'FREMD', 'FREUND', 'FRIED',
  'FROH', 'FRÜH', 'FUCHS', 'FUHR', 'FÜNF', 'FÜR', 'FUSS', 'GAB', 'GANG', 'GANZ', 'GAR', 'GART',
  'GARTEN', 'GAST', 'GEB', 'GEBEN', 'GEGEN', 'GEH', 'GEHEN', 'GEIST', 'GELD', 'GELE', 'GELT',
  'GENAU', 'GERADE', 'GERN', 'GESETZ', 'GIB', 'GIBT', 'GILT', 'GING', 'GLAS', 'GLAUB', 'GLEICH',
  'GLÜCK', 'GOLD', 'GOTT', 'GRAB', 'GRAD', 'GRAF', 'GRAS', 'GRAU', 'GREIF', 'GRENZ', 'GROSS',
  'GRÜN', 'GUT', 'HAAR', 'HAB', 'HABEN', 'HALB', 'HALT', 'HAND', 'HART', 'HAUS', 'HEIM', 'HEISS',
  'HELD', 'HELF', 'HELL', 'HELM', 'HER', 'HERR', 'HERZ', 'HEUTE', 'HILF', 'HIN', 'HINTER', 'HOCH',
  'HOFF', 'HOHE', 'HOL', 'HOLZ', 'HÖR', 'HUND', 'HUT', 'IDEAL', 'IHM', 'IHN', 'IHRE', 'IMMER',
  'INNEN', 'JAHR', 'JEDE', 'JEDER', 'JETZT', 'JUNG', 'JUNGE', 'KALT', 'KAM', 'KAMPF', 'KANN',
  'KARTE', 'KATZE', 'KAUF', 'KEIN', 'KENN', 'KERN', 'KIND', 'KINO', 'KIRCHE', 'KLAR', 'KLEIN',
  'KLEID', 'KLUG', 'KOCH', 'KÖNIG', 'KOPF', 'KRAFT', 'KRANK', 'KREIS', 'KREUZ', 'KRIEG', 'KUH',
  'KUNST', 'KURZ', 'LACH', 'LADEN', 'LAGE', 'LAND', 'LANG', 'LASS', 'LAUF', 'LAUT', 'LEBEN',
  'LEDER', 'LEER', 'LEGE', 'LEHR', 'LEICHT', 'LEID', 'LEIN', 'LEIT', 'LERN', 'LESE', 'LETZT',
  'LEUTE', 'LICHT', 'LIEB', 'LIEGT', 'LIED', 'LIEF', 'LIES', 'LINK', 'LOCH', 'LOHN', 'LOS', 'LUFT',
  'LUST', 'MACH', 'MACHE', 'MAL', 'MANN', 'MARK', 'MAUS', 'MEER', 'MEHR', 'MEIN', 'MELD', 'MENSCH',
  'MESS', 'MICH', 'MILCH', 'MIT', 'MITTE', 'MOCHT', 'MOND', 'MORGEN', 'MÜDE', 'MUND', 'MUSIK',
  'MUSS', 'MUT', 'NACH', 'NAH', 'NAME', 'NATUR', 'NEBEL', 'NEIN', 'NETZ', 'NEU', 'NEUN', 'NICHT',
  'NIE', 'NIMM', 'NOCH', 'NORD', 'NOT', 'NUN', 'NUR', 'OBEN', 'OBER', 'OBST', 'ODER', 'OFEN',
  'OFFEN', 'OFT', 'OHNE', 'OHR', 'ONKEL', 'ORT', 'OST', 'PAPIER', 'PARK', 'PASS', 'PAUSE', 'PFERD',
  'PFUND', 'PILZ', 'PLATZ', 'POLIT', 'POST', 'PREIS', 'PRINZ', 'PROB', 'PROF', 'PUNKT', 'PUTZ',
  'QUER', 'RAD', 'RAHMEN', 'RAND', 'RAT', 'RAUB', 'RAUCH', 'RAUM', 'RECHN', 'RECHT', 'RED', 'REGEN',
  'REICH', 'REIH', 'REIN', 'REIS', 'REIT', 'REIZ', 'RENN', 'REST', 'RICH', 'RIECH', 'RING',
  'ROCK', 'ROHR', 'ROLL', 'ROS', 'ROSA', 'ROST', 'ROT', 'RUHE', 'RUF', 'RUND', 'RUNDE', 'RÜCK',
  'SACH', 'SAFT', 'SAG', 'SAGE', 'SAH', 'SALZ', 'SAND', 'SANG', 'SANK', 'SATZ', 'SAU', 'SAUER',
  'SCH', 'SCHAD', 'SCHAFF', 'SCHAL', 'SCHAU', 'SCHEIN', 'SCHIFF', 'SCHILD', 'SCHLAF', 'SCHLAG',
  'SCHLUSS', 'SCHON', 'SCHREIB', 'SCHUH', 'SCHUL', 'SCHULE', 'SCHUTZ', 'SCHWARZ', 'SCHWEIN',
  'SCHWER', 'SCHWIM', 'SECHS', 'SEE', 'SEH', 'SEHE', 'SEHR', 'SEI', 'SEID', 'SEIN', 'SEINE',
  'SEIT', 'SEITE', 'SELB', 'SEND', 'SETZ', 'SICH', 'SIE', 'SIEB', 'SIEBEN', 'SIEG', 'SIEH',
  'SIEHT', 'SIN', 'SING', 'SITZ', 'SOFA', 'SOHN', 'SOLL', 'SOMMER', 'SONN', 'SONNE', 'SONST',
  'SORG', 'SOWIE', 'SPAZ', 'SPEI', 'SPIEL', 'SPIN', 'SPITZ', 'SPORT', 'SPRACH', 'SPRING', 'SPRUCH',
  'STAAT', 'STADT', 'STAHL', 'STALL', 'STAMM', 'STAND', 'STARK', 'STATT', 'STEH', 'STEHT',
  'STEIN', 'STELL', 'STERN', 'STICH', 'STIEG', 'STILL', 'STOCK', 'STOFF', 'STOLZ', 'STOP',
  'STOR', 'STRAND', 'STRASS', 'STROM', 'STÜCK', 'STUND', 'STURM', 'SUCH', 'SÜD', 'SÜSS', 'TAG',
  'TAFEL', 'TANZ', 'TASCHE', 'TAUB', 'TEIL', 'TELE', 'TELL', 'TEST', 'TEUF', 'TIEF', 'TIER',
  'TISCH', 'TOCHTER', 'TOD', 'TOLL', 'TON', 'TOPF', 'TOR', 'TOT', 'TRA', 'TRAG', 'TRAUM',
  'TREFF', 'TREIB', 'TRET', 'TREU', 'TRINK', 'TROCK', 'TRUG', 'TUCH', 'TUN', 'TURM', 'ÜBER',
  'UHR', 'UM', 'UND', 'UNS', 'UNT', 'UNTER', 'URLAUB', 'VATER', 'VERB', 'VERD', 'VERG', 'VERL',
  'VERM', 'VERS', 'VERT', 'VIEL', 'VIER', 'VOGEL', 'VOLL', 'VOM', 'VON', 'VOR', 'WACH', 'WAGEN',
  'WAHL', 'WAHR', 'WALD', 'WAND', 'WANN', 'WAR', 'WARE', 'WARM', 'WARN', 'WARUM', 'WAS', 'WASCH',
  'WASSER', 'WEG', 'WEH', 'WEHR', 'WEIB', 'WEICH', 'WEIL', 'WEIN', 'WEIS', 'WEISS', 'WEIT',
  'WELCH', 'WELT', 'WEN', 'WEND', 'WENIG', 'WENN', 'WER', 'WERD', 'WERDE', 'WERF', 'WERK',
  'WERT', 'WESEN', 'WETT', 'WETTER', 'WIEDER', 'WIE', 'WILD', 'WILL', 'WIND', 'WINTER', 'WIR',
  'WIRD', 'WIRK', 'WIRKLICH', 'WIRT', 'WISSEN', 'WITZ', 'WO', 'WOCHE', 'WOHL', 'WOHN', 'WOLF',
  'WOLL', 'WORT', 'WOZU', 'WUND', 'WUNSCH', 'WURD', 'WURDE', 'WURF', 'WURM', 'ZAHN', 'ZEICH',
  'ZEIG', 'ZEIT', 'ZELT', 'ZEUG', 'ZIEH', 'ZIEL', 'ZIMM', 'ZIMMER', 'ZOG', 'ZOLL', 'ZORN',
  'ZU', 'ZUG', 'ZUM', 'ZUR', 'ZURÜCK', 'ZUS', 'ZUSAM', 'ZWEI', 'ZWERG', 'ZWISCHEN',
];

for (const w of basic) words.add(w);

const wordArray = Array.from(words).filter(w => w.length >= 2 && w.length <= 15);
writeFileSync(join(root, 'src/dict/words-de.json'), JSON.stringify(wordArray.sort()));
console.log(`Wrote ${wordArray.length} words`);
