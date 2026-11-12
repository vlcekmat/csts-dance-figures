// Minimal bilingual (Czech / English) support without external libraries.
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Lang } from "./data";

const STRINGS = {
  appTitle: { cs: "Katalog figur ČSTS", en: "ČSTS Figure Catalog" },
  appSubtitle: { cs: "Databáze figur a návody", en: "Figure database and guides" },
  tabFigures: { cs: "Figury", en: "Figures" },
  tabRoutines: { cs: "Sestavy", en: "Routines" },
  tabAbout: { cs: "Nápověda", en: "Help" },
  description: { cs: "Popis", en: "Description" },
  alsoKnownAs: { cs: "Známá také jako", en: "Also known as" },
  descriptionHint: {
    cs: "Popis je sestavený z údajů WDSF Syllabu. Technika krok po kroku (postavení nohou, otočení, zdvih a klesání) je v technických příručkách WDSF.",
    en: "Assembled from the WDSF Syllabus. Step-by-step technique (footwork, turn, rise and fall) is in the WDSF technique books.",
  },
  timingDetail: { cs: "Rozpis rytmizace", en: "Timing breakdown" },
  stepCol: { cs: "Krok", en: "Step" },
  symbolCol: { cs: "Zápis", en: "Symbol" },
  countCol: { cs: "Počítání", en: "Count" },
  lengthCol: { cs: "Délka", en: "Length" },
  heldShort: { cs: "výdrž", en: "held" },
  timingBar: { cs: "Takt {meter} má {n} doby.", en: "A {meter} bar has {n} beats." },
  timingSQ: {
    cs: "S (slow, pomalá) = {s}, Q (quick, rychlá) = {q}.",
    en: "S (slow) = {s}, Q (quick) = {q}.",
  },
  timingDigits: { cs: "Každá číslice je jeden krok na danou dobu taktu.", en: "Each digit is one step on that beat of the bar." },
  timingAmp: { cs: "& je krok mezi dobami – dělí předchozí dobu na poloviny.", en: "& is a step between beats – it splits the previous beat in half." },
  timingA: { cs: "a je krok na poslední čtvrtině doby (předchozí krok trvá ¾).", en: "a is a step on the last quarter of the beat (the previous step lasts ¾)." },
  timingHeld: { cs: "Závorka znamená výdrž: na tyto doby se nekročí.", en: "Brackets mean a hold: no step is taken on those beats." },
  timingDot: { cs: "Tečka spojuje doby jednoho kroku (4.1 = krok trvá doby 4 a 1).", en: "A dot joins beats of one step (4.1 = the step lasts beats 4 and 1)." },
  holdsTitle: { cs: "Držení", en: "Hold" },
  holdLegend: {
    cs: "Pohled shora: plná postava = muž, obrysová (zlatá) = žena, špička ukazuje, kam postava míří, modrý bod = spojené ruce, čárkovaně = ruka muže na zádech ženy.",
    en: "Top view: filled figure = man, outlined (gold) = lady, the point shows where they face, blue dot = joined hands, dashed = man's hand on the lady's back.",
  },
  holdsAllowedTitle: { cs: "Syllabus povoluje tato držení ({n}):", en: "The syllabus allows these holds ({n}):" },
  holdsAnyTitle: { cs: "Poznámky povolují libovolné vhodné držení, např.:", en: "The notes allow any appropriate hold, e.g.:" },
  startTitle: { cs: "Začátek sestavy", en: "Start of the routine" },
  startShort: { cs: "začátek", en: "start" },
  startSide: { cs: "Stěna", en: "Wall" },
  startSide0: { cs: "dlouhá stěna 1 – dole ({m} m)", en: "long wall 1 – bottom ({m} m)" },
  startSide1: { cs: "krátká stěna 1 – vpravo ({m} m)", en: "short wall 1 – right ({m} m)" },
  startSide2: { cs: "dlouhá stěna 2 – nahoře ({m} m)", en: "long wall 2 – top ({m} m)" },
  startSide3: { cs: "krátká stěna 2 – vlevo ({m} m)", en: "short wall 2 – left ({m} m)" },
  startAlong: { cs: "Vzdálenost od rohu (po LOD)", en: "Distance from the corner (along LOD)" },
  startDist: { cs: "Vzdálenost od stěny", en: "Distance from the wall" },
  startHint: { cs: "Kliknutím do plánku posuneš začátek podél zvolené stěny (stěna se nemění).", en: "Click into the plan to move the start along the chosen wall (the wall stays)." },
  startReset: { cs: "Výchozí začátek", en: "Default start" },
  loopToggle: { cs: "Sestava se tančí dokola – navázat konec na začátek", en: "The routine is repeated – connect the end to the start" },
  loopHide: { cs: "Skrýt vizualizaci tančení dokola", en: "Hide the repeat visualisation" },
  loopShow: { cs: "Zobrazit vizualizaci tančení dokola", en: "Show the repeat visualisation" },
  changeAlign: { cs: "Mimo směrování techniky", en: "Off the technique alignment" },
  alignResetAll: { cs: "Resetovat směrování", en: "Reset alignment" },
  alignResetAllHint: { cs: "Vrátí míru otočení všech figur v sestavě podle techniky", en: "Restores the technique's amount of turn of all figures in the routine" },
  loopBack: { cs: "znovu od 1. figury", en: "again from figure 1" },
  loopBackTo: { cs: "znovu od {n}. figury", en: "again from figure {n}" },
  loopStartHere: { cs: "Sem se sestava vrací po svém konci", en: "The routine returns here after its end" },
  loopToLabel: { cs: "Po konci pokračovat figurou", en: "After the end continue with" },
  loopTitleTo: { cs: "Navázání konce sestavy na {n}. figuru ({name})", en: "End of the routine → figure {n} ({name})" },
  loopRail: { cs: "dokola", en: "repeat" },
  loopTitle: { cs: "Navázání konce sestavy na začátek", en: "End of the routine → start" },
  repeatLabel: { cs: "Opakování sestavy v plánku", en: "Repetitions in the plan" },
  repeatRound: { cs: "celé soutěžní kolo (1:30)", en: "a whole competition round (1:30)" },
  alignTitle: { cs: "Směrování", en: "Alignment" },
  planHelp: { cs: "Jak číst plánek", en: "How to read the plan" },
  planRotateHint: {
    cs: "Vybraná figura je v plánku zvýrazněná i se svou dráhou po krocích. Figuru vybereš i kliknutím na její číslo.",
    en: "The selected figure is highlighted with its step path. You can also select a figure by clicking its number.",
  },
  playerTitle: { cs: "Přehrávání figury", en: "Figure playback" },
  playerRole: { cs: "Kroky", en: "Steps" },
  roleMan: { cs: "Pán", en: "Man" },
  roleLady: { cs: "Dáma", en: "Lady" },
  roleBoth: { cs: "Oba", en: "Both" },
  roleManShort: { cs: "P", en: "M" },
  roleLadyShort: { cs: "D", en: "L" },
  playerStart: { cs: "Na začátek", en: "To the start" },
  playerPrev: { cs: "Předchozí krok", en: "Previous step" },
  playerNext: { cs: "Další krok", en: "Next step" },
  playerPlay: { cs: "Přehrát", en: "Play" },
  playerPause: { cs: "Pauza", en: "Pause" },
  playerSpeed: { cs: "Rychlost přehrávání", en: "Playback speed" },
  playerSmooth: { cs: "plynule", en: "smooth" },
  playerTempo: { cs: "soutěžní tempo", en: "competition tempo" },
  playerStep: { cs: "Krok", en: "Step" },
  playerStartPos: { cs: "Výchozí postavení", en: "Starting position" },
  playerStepN: { cs: "Krok {n} z {of}", en: "Step {n} of {of}" },
  playerCount: { cs: "doba", en: "count" },
  playerPosition: { cs: "postavení", en: "position" },
  playerHint: {
    cs: "Pohled shora podle grafů techniky WDSF: ovál = ramena partnera, trojúhelník = kam stojí čelem (P = pán, D = dáma). Obrys = levá noha, plná = pravá. Vzájemná vzdálenost partnerů je jen schematická.",
    en: "Top view from the WDSF technique charts: oval = the partner's shoulders, triangle = where they face (M = man, L = lady). Outline = left foot, filled = right. The distance between partners is schematic.",
  },
  playerHintManOnly: {
    cs: "Pohled shora na kroky pána (dámské kroky pro tuto figuru nejsou k dispozici): ovál = ramena, trojúhelník = kam stojí čelem. Obrys = levá noha, plná = pravá.",
    en: "Top view of the man's steps (no lady's chart is available for this figure): oval = shoulders, triangle = facing. Outline = left foot, filled = right.",
  },
  planShowFigure: { cs: "Ukázat v plánku", en: "Show in the plan" },
  planSelClose: { cs: "Zavřít", en: "Close" },
  alignChart: { cs: "Podle techniky WDSF", en: "WDSF technique" },
  alignHere: { cs: "V sestavě", en: "In the routine" },
  alignFollows: {
    cs: "Směrování závisí na předchozí figuře – figura pokračuje tam, kam předchozí skončila.",
    en: "The alignment depends on the previous figure – it continues where the previous one ended.",
  },
  alignOffChart: {
    cs: "Figura tu začíná jinak natočená, než uvádí technika ({dir}). Katalog ČSTS natočení celých figur jen doporučuje, ale zkontroluj napojení.",
    en: "The figure starts turned differently than the technique gives ({dir}). The ČSTS catalog only recommends the alignment of whole figures, but check the connection.",
  },
  alignOffChartShort: { cs: "mimo směrování techniky ({dir})", en: "off the technique alignment ({dir})" },
  alignTurnAuto: { cs: "automaticky podle navazující figury ({turn})", en: "automatic, to connect to the next figure ({turn})" },
  alignTurnRule: { cs: "Povoleno", en: "Allowed" },
  alignTurnWdsf: { cs: "Podle techniky WDSF", en: "WDSF technique" },
  alignTurnChoreoGroup: { cs: "Podle choreografie (mimo WDSF)", en: "By the choreography (outside WDSF)" },
  alignChoreoChip: { cs: "podle choreografie", en: "by the choreography" },
  alignChoreoNote: {
    cs: "Otočení podle choreografie se liší od techniky WDSF. Katalog ČSTS (bod 2) bere natočení figur a velikost rotací jako doporučení.",
    en: "This turn by the choreography differs from the WDSF technique. The ČSTS catalog (point 2) treats figure alignment and amount of rotation as recommendations.",
  },
  alignTurnFixed: {
    cs: "Míru otočení technika u této figury neumožňuje měnit.",
    en: "The technique gives no alternative amount of turn for this figure.",
  },
  alignLineOk: { cs: "Směrování: navazuje – {here}", en: "Alignment: continues – {here}" },
  alignLineOff: {
    cs: "Směrování: navazuje {here}, technika figury uvádí {chart}",
    en: "Alignment: continues {here}, the figure's technique gives {chart}",
  },
  alignFixPrevTurn: { cs: "Otočení předchozí figury: {dir}", en: "Previous figure's turn: {dir}" },
  startFace: { cs: "Začátek sestavy – kam muž stojí čelem", en: "Start of the routine – man's facing" },
  startFaceChart: { cs: "podle první figury ({dir})", en: "as the first figure ({dir})" },
  wall0: { cs: "dlouhá stěna 1 (dole)", en: "long wall 1 (bottom)" },
  wall1: { cs: "krátká stěna 1 (vpravo)", en: "short wall 1 (right)" },
  wall2: { cs: "dlouhá stěna 2 (nahoře)", en: "long wall 2 (top)" },
  wall3: { cs: "krátká stěna 2 (vlevo)", en: "short wall 2 (left)" },
  wallLabel: { cs: "Stěna, podél které figuru tančíš", en: "Wall the figure is danced along" },
  wallAuto: { cs: "automaticky – {wall}", en: "automatic – {wall}" },
  wallCornerBefore: { cs: "roh před figurou", en: "corner before" },
  wallManualShort: { cs: "nastaveno ručně", en: "set manually" },
  alignTurn: { cs: "Množství otočení", en: "Amount of turn" },
  alignAsChart: { cs: "podle techniky", en: "as in the technique" },
  alignByLeft: { cs: "o {n} vlevo", en: "{n} to the left" },
  alignByRight: { cs: "o {n} vpravo", en: "{n} to the right" },
  alignMore: { cs: "přetočit o {n}", en: "overturn by {n}" },
  alignLess: { cs: "podtočit o {n}", en: "underturn by {n}" },
  holdStart: { cs: "Držení na začátku", en: "Hold at the start" },
  holdFinish: { cs: "Držení na konci", en: "Hold at the finish" },
  fromNotes: { cs: "z poznámek", en: "from notes" },
  holdNotInNotes: { cs: "– syllabus toto držení u figury nezmiňuje, ověř v technické příručce.", en: "– the syllabus does not mention this hold for the figure; check the technique book." },
  holdAny: { cs: "Poznámky dovolují libovolné vhodné držení.", en: "The notes allow any appropriate hold." },
  holdLine: { cs: "Držení: {prev} → {next}", en: "Hold: {prev} → {next}" },
  changePosition: { cs: "Změna postavení", en: "Position change" },
  changeHold: { cs: "Změna držení", en: "Hold change" },
  changesTitle: { cs: "změn postavení/držení", en: "position/hold changes" },
  fixHoldNext: { cs: "Začít tuto figuru v držení „{hold}“", en: "Start this figure in “{hold}”" },
  fixHoldPrev: { cs: "Ukončit předchozí figuru v držení „{hold}“", en: "Finish the previous figure in “{hold}”" },
  glossary: { cs: "Slovníček zkratek", en: "Glossary" },
  cornerAfter: { cs: "Po této figuře je roh parketu", en: "A corner of the floor follows this figure" },
  floorPlan: { cs: "Plánek na parketu", en: "Floor plan" },
  floorHint: {
    cs: "Dráha muže krok po kroku (tečky = jednotlivé kroky), spočítaná z grafů techniky WDSF: každá figura navazuje tam, kam předchozí dotančila, a otáčí se podle techniky. Šipky na začátku figury ukazují, kam stojí čelem pán (plná šipka) a partnerka (čárkovaná s prázdným hrotem). Pohyb po linii tance (LOD, proti směru hodinových ručiček). Délka kroku se nastavuje posuvníkem, směr kroků podle techniky. Když pár dojde k čelní stěně, linie tance se v rohu automaticky otočí; vlastní rohy označíš u figury „Po této figuře je roh parketu“. Skutečná délka kroků se liší podle páru a tempa.",
    en: "The man's path step by step (dots = steps), computed from the WDSF technique charts: every figure continues where the previous one ended and turns as the technique says. Arrows at the start of each figure show where the man (solid arrow) and the lady (dashed, hollow head) face. Travelling along the line of dance (anticlockwise). Step length is set with the slider, step directions follow the chart alignments. When the couple reaches the end wall, the line of dance turns at the corner automatically; mark your own with “A corner of the floor follows this figure”. Real step length depends on the couple and tempo.",
  },
  floorCentre: { cs: "střed", en: "centre" },
  floorWall: { cs: "stěna", en: "wall" },
  endsMidBar: { cs: "Figura končí uprostřed taktu", en: "The figure ends in the middle of a bar" },
  onSpot: { cs: "na místě", en: "on the spot" },
  floorAutoCorner: { cs: "roh (automaticky)", en: "corner (automatic)" },
  stepLength: { cs: "Délka kroku", en: "Step length" },
  stepLengthReset: { cs: "Výchozí ({cm} cm)", en: "Default ({cm} cm)" },
  stepLengthHint: {
    cs: "Délka plného kroku vpřed/vzad vašeho páru. Výchozí hodnota odpovídá soutěžnímu páru v daném tanci; boční kroky se počítají kratší, přísuny bez posunu.",
    en: "Length of a full forward/backward step of your couple. The default matches a competing couple in this dance; side steps are shorter, closes don't travel.",
  },
  roomSize: { cs: "Velikost sálu", en: "Room size" },
  room_small: { cs: "Malý", en: "Small" },
  room_medium: { cs: "Střední", en: "Medium" },
  room_large: { cs: "Velký", en: "Large" },
  room_custom: { cs: "Vlastní", en: "Custom" },
  roomLength: { cs: "Délka (m)", en: "Length (m)" },
  roomWidth: { cs: "Šířka (m)", en: "Width (m)" },
  roomFits: { cs: "Sestava se vejde do sálu {w} × {l} m.", en: "The routine fits a {w} × {l} m room." },
  roomOverflow: {
    cs: "Sestava v tomto sále vyjede za parket u figur č. {list}. Zkus jiný roh nebo kratší figury.",
    en: "In this room the routine leaves the floor at figure(s) {list}. Try another corner or shorter figures.",
  },
  floorCorner: { cs: "roh", en: "corner" },
  floorFigure: { cs: "Pohyb po parketu", en: "Movement on the floor" },
  floorMissing: {
    cs: "Figury označené * nemají graf kroků – jsou zakreslené přerušovaně podle charakteru figury: na místě (kroužek), s malým posunem, nebo postupově po LOD podle počtu taktů.",
    en: "Figures marked * have no step chart – drawn dashed by the kind of figure: on the spot (ring), small move, or travelling along LOD by number of bars.",
  },
  stepChart: { cs: "Graf kroků", en: "Step chart" },
  chartStep: { cs: "Krok", en: "Step" },
  chartNextStep: { cs: "První krok následující figury (uvádí ho graf, do figury nepatří)", en: "First step of the following figure (shown by the chart, not part of this figure)" },
  chartDesc: { cs: "Noha a směr", en: "Foot & direction" },
  chartAlign: { cs: "Směrování", en: "Alignment" },
  chartTurn: { cs: "Otočení", en: "Turn" },
  chartSourceWdsf: {
    cs: "Zdroj: technická příručka WDSF – {dance}, str. {page} (kroky pána a dámy, směrování, otočení, postavení).",
    en: "Source: WDSF technique book – {dance}, p. {page} (man's and lady's steps, alignment, turn, couple position).",
  },
  chartPos: { cs: "Postavení", en: "Couple position" },
  chartSourceChecked: {
    cs: "Kroky a směrování pána podle techniky WDSF.",
    en: "Man's steps and alignments according to the WDSF technique.",
  },
  chartMoreAt: { cs: "Podrobný popis (technika ISTD):", en: "Detailed description (ISTD technique):" },
  chartSource: {
    cs: "Zdroj: dancecentral.info (technika ISTD – v detailech se může lišit od WDSF). Úplný popis s prací nohou a zdvihem na webu:",
    en: "Source: dancecentral.info (ISTD technique – details may differ from WDSF). Full description incl. footwork and rise & fall:",
  },
  notInCatalog: { cs: "Tato figura není v katalogu ČSTS.", en: "This figure is not in the ČSTS catalog." },
  notInCatalogShort: { cs: "mimo katalog", en: "not in catalog" },
  precedes: { cs: "Může předcházet", en: "Preceding figures" },
  follows: { cs: "Může následovat", en: "Following figures" },
  floorLongSide: { cs: "dlouhá strana", en: "long side" },
  floorShortSide: { cs: "krátká strana", en: "short side" },
  glossaryHint: {
    cs: "Podtržené zkratky v aplikaci jdou rozkliknout – vysvětlení se zobrazí dole na obrazovce.",
    en: "Underlined abbreviations can be tapped – the explanation appears at the bottom of the screen.",
  },
  howTiming: { cs: "Jak číst rytmizaci", en: "How to read timing" },
  howTimingText: {
    cs: "Rytmizace říká, na jakou dobu hudby připadá každý krok. Ve standardních tancích se zapisuje pomocí S (slow) a Q (quick) nebo čísly dob (waltz 1 2 3). V latině jsou čísla dob taktu – cha-cha „2 3 4&1“ začíná na druhou dobu. Detail každé figury obsahuje rozpis krok po kroku.",
    en: "Timing tells you on which beat of the music each step is taken. Standard dances use S (slow) and Q (quick) or beat numbers (waltz 1 2 3). Latin uses beat numbers – cha cha “2 3 4&1” starts on beat 2. Each figure's detail has a step-by-step breakdown.",
  },
  groupFeet: { cs: "Nohy, ruce, tělo", en: "Feet, hands, body" },
  groupDirection: { cs: "Směry", en: "Directions" },
  groupPosition: { cs: "Postavení", en: "Positions" },
  groupHold: { cs: "Držení", en: "Holds" },
  groupTiming: { cs: "Rytmizace", en: "Timing" },
  groupOther: { cs: "Ostatní", en: "Other" },
  theme: { cs: "Vzhled", en: "Theme" },
  themeAuto: { cs: "Podle systému", en: "System" },
  themeLight: { cs: "Světlý", en: "Light" },
  themeDark: { cs: "Tmavý", en: "Dark" },
  search: { cs: "Hledat figuru (i jiným názvem)…", en: "Search figures (any name)…" },
  searchShort: { cs: "Hledat figuru…", en: "Search figures…" },
  allDances: { cs: "Všechny tance", en: "All dances" },
  standard: { cs: "Standardní tance", en: "Standard" },
  latin: { cs: "Latinskoamerické tance", en: "Latin" },
  other: { cs: "Ostatní", en: "Other" },
  classLabel: { cs: "Třída", en: "Class" },
  anyClass: { cs: "Libovolná", en: "Any" },
  classB: { cs: "B/A/M", en: "B/A/M" },
  onlyLegal: { cs: "Jen povolené ve třídě", en: "Only legal in class" },
  results: { cs: "figur", en: "figures" },
  noResults: { cs: "Nic nenalezeno.", en: "Nothing found." },
  legalIn: { cs: "Povoleno ve třídách", en: "Allowed in classes" },
  freeChoreo: {
    cs: "Ve třídách B, A a M katalog figury neomezuje.",
    en: "Classes B, A and M are not restricted by the catalog.",
  },
  notDancedInClass: {
    cs: "Tento tanec se ve zvolené třídě netančí.",
    en: "This dance is not danced in the selected class.",
  },
  start: { cs: "Začátek", en: "Start" },
  finish: { cs: "Konec", en: "Finish" },
  timing: { cs: "Rytmizace", en: "Timing" },
  altTimings: { cs: "Alternativní rytmizace", en: "Alternative timings" },
  notes: { cs: "Poznámky WDSF Syllabus", en: "WDSF Syllabus notes" },
  notesOriginal: { cs: "(originální anglické znění – závazné)", en: "" },
  startFinishCsHint: {
    cs: "Popis kroků M. Názvy postavení a držení jsou v originále WDSF.",
    en: "Man's steps.",
  },
  bars: { cs: "taktů", en: "bars" },
  beats: { cs: "dob", en: "beats" },
  literature: { cs: "Literatura", en: "References" },
  catalogNo: { cs: "Číslo v katalogu ČSTS", en: "ČSTS catalog no." },
  wdsfRef: { cs: "WDSF", en: "WDSF" },
  plamRef: { cs: "Plamínek, Landsfeld", en: "Plamínek, Landsfeld" },
  polkaRef: { cs: "Polka, ČSTS 2017", en: "Polka, ČSTS 2017" },
  syllabusSection: { cs: "WDSF Syllabus, oddíl", en: "WDSF Syllabus section" },
  seeAlso: { cs: "Popis převzat z", en: "Description taken from" },
  videos: { cs: "Ukázková videa", en: "Example videos" },
  videosHint: {
    cs: "Videa jsou vyhledána automaticky na YouTube – ne vždy musí přesně odpovídat figuře.",
    en: "Videos were found automatically on YouTube and may not always match the figure exactly.",
  },
  searchYoutube: { cs: "Hledat další na YouTube", en: "Search more on YouTube" },
  noSyllabus: {
    cs: "Pro tuto figuru není v WDSF Syllabu popis. Polka vychází z materiálu Polka, ČSTS 2017.",
    en: "The WDSF Syllabus has no description for this figure. Polka is based on 'Polka', ČSTS 2017.",
  },
  addToRoutine: { cs: "Přidat do sestavy", en: "Add to routine" },
  addedTo: { cs: "Přidáno do", en: "Added to" },
  newRoutine: { cs: "Nová sestava", en: "New routine" },
  close: { cs: "Zavřít", en: "Close" },
  remarks: { cs: "Poznámky katalogu", en: "Catalog remarks" },
  // Custom figures
  customFigure: { cs: "Vlastní figura", en: "Custom figure" },
  addCustom: { cs: "Vlastní figura", en: "Custom figure" },
  customBadge: { cs: "vlastní", en: "custom" },
  customIllegal: {
    cs: "Vlastní figura není v katalogu ČSTS – povolená jen ve třídách B, A a M.",
    en: "A custom figure is not in the ČSTS catalog – allowed only in classes B, A and M.",
  },
  cfNew: { cs: "Nová vlastní figura", en: "New custom figure" },
  cfLegalHint: {
    cs: "Vlastní figury slouží hlavně pro třídy B, A a M, kde katalog figury neomezuje. Ve třídách E, D a C je aplikace označí jako nepovolené.",
    en: "Custom figures are meant mainly for classes B, A and M, where the catalog doesn't restrict figures. In classes E, D and C they are marked as not allowed.",
  },
  cfNameCs: { cs: "Název česky", en: "Czech name" },
  cfNameEn: { cs: "Název anglicky (volitelně)", en: "English name (optional)" },
  cfInsert: { cs: "Vložit symbol", en: "Insert symbol" },
  cfSteps: { cs: "kroků", en: "steps" },
  cfTimingBad: { cs: "Rytmizaci se nepodařilo přečíst – použij S, Q, číslice, & a a.", en: "Couldn't read the timing – use S, Q, digits, & and a." },
  cfFoot: { cs: "Noha (M)", en: "Foot (man)" },
  cfDir: { cs: "Směr", en: "Direction" },
  cfPos: { cs: "Postavení", en: "Position" },
  cfPosOther: { cs: "Jiné postavení…", en: "Other position…" },
  dir_fwd: { cs: "vpřed", en: "forward" },
  dir_bwd: { cs: "vzad", en: "backward" },
  dir_to_side: { cs: "stranou", en: "to side" },
  dir_diag_fwd: { cs: "diagonálně vpřed", en: "diagonally forward" },
  dir_diag_bwd: { cs: "diagonálně vzad", en: "diagonally backward" },
  dir_closes: { cs: "přísun", en: "closes" },
  dir_in_place: { cs: "na místě", en: "in place" },
  cfEndsHint: {
    cs: "Začátek a konec slouží ke kontrole navazování nohou a postavení v sestavě. U konce zadej nohu, na které je váha.",
    en: "Start and finish are used to check foot and position continuity in routines. For the finish, give the foot carrying the weight.",
  },
  cfTravel: { cs: "Pohyb po parketu", en: "Movement on the floor" },
  cfTravel_spot: { cs: "na místě", en: "on the spot" },
  cfTravel_small: { cs: "malý posun", en: "small move" },
  cfTravel_travel: { cs: "postupová – posouvá se po LOD", en: "travelling – moves along LOD" },
  lodExplain: {
    cs: "LOD (Line of Dance, linie tance) je směr, kterým se páry ve standardních tancích, sambě, pasodoble a polce pohybují kolem sálu: proti směru hodinových ručiček, podél stěn. „Po LOD“ tedy znamená, že figura posouvá pár dál po obvodu parketu.",
    en: "LOD (Line of Dance) is the direction in which couples travel around the room in standard dances, samba, paso doble and polka: anticlockwise, along the walls. “Along LOD” means the figure moves the couple on around the floor.",
  },
  cfNote: { cs: "Poznámka / popis provedení", en: "Note / how to dance it" },
  cfVideo: { cs: "Odkaz na video", en: "Video link" },
  cfSave: { cs: "Uložit figuru", en: "Save figure" },
  cfCancel: { cs: "Zrušit", en: "Cancel" },
  cfRequired: { cs: "Vyplň název a rytmizaci.", en: "Fill in the name and the timing." },
  edit: { cs: "Upravit", en: "Edit" },
  // Figure finder
  tabFinder: { cs: "Najít figuru", en: "Find a figure" },
  finderTitle: { cs: "Jak se ta figura jmenuje?", en: "What is that figure called?" },
  finderIntro: {
    cs: "Vyplň, co si z figury pamatuješ – stačí cokoliv. Výsledky se řadí podle shody a u každého uvidíš, co sedí a co ne. Počítají se i varianty povolené syllabem (např. figura, která může končit v promenádě).",
    en: "Fill in whatever you remember about the figure. Results are ranked by match and show what fits and what doesn't. Variants allowed by the syllabus count too (e.g. a figure that may end in promenade).",
  },
  fdDontKnow: { cs: "nevím", en: "don't know" },
  fdPrev: { cs: "Co jsi tančil před ní", en: "Figure danced before it" },
  fdPrevHint: {
    cs: "Z předchozí figury odvodím, kterou nohou a z jakého postavení figura začíná (pokud to nezadáš sám).",
    en: "The previous figure tells which foot and position the figure starts from (unless you set them yourself).",
  },
  fdFoot: { cs: "Noha (muž)", en: "Foot (man)" },
  fdDir: { cs: "Směr", en: "Direction" },
  fd_fwd: { cs: "vpřed", en: "forward" },
  fd_bwd: { cs: "vzad", en: "backward" },
  fd_side: { cs: "stranou", en: "to side" },
  fd_place: { cs: "na místě / přísun", en: "in place / close" },
  fdSteps: { cs: "Kroky po sobě", en: "Steps in order" },
  fdStepsHint: {
    cs: "Popiš první kroky figury (muž). Porovnávají se s grafy kroků, které jsou u standardních tanců a části latiny.",
    en: "Describe the first steps (man). They are compared with step charts, available for standard dances and part of latin.",
  },
  fdAddStep: { cs: "Přidat krok", en: "Add step" },
  fdWeight: { cs: "Váha na konci", en: "Weight at the end" },
  fdMore: { cs: "Délka, otáčení, pohyb", en: "Length, turn, travel" },
  fdBars: { cs: "Počet taktů", en: "Bars" },
  fdStepCount: { cs: "Počet kroků", en: "Number of steps" },
  fdTurn: { cs: "Otáčení", en: "Turn" },
  fdTurn_R: { cs: "vpravo", en: "to the right" },
  fdTurn_L: { cs: "vlevo", en: "to the left" },
  fdTurn_none: { cs: "bez otáčky", en: "no turn" },
  fdSpot: { cs: "na místě", en: "on the spot" },
  fdTravel: { cs: "postupuje po LOD", en: "travels along LOD" },
  fdKeywords: { cs: "Klíčová slova", en: "Keywords" },
  fdKeywordsPh: { cs: "např. zášvih, lock, botafogo…", en: "e.g. whisk, lock, botafogo…" },
  fdReset: { cs: "Vymazat vše", en: "Clear all" },
  fdResults: { cs: "Nejbližší figury", en: "Closest figures" },
  fdEmpty: {
    cs: "Zatím nic nevíme – začni třeba nohou a směrem prvního kroku.",
    en: "Nothing entered yet – start with the foot and direction of the first step.",
  },
  fdResultsHint: {
    cs: "~ znamená, že pro tuto figuru chybí údaj (např. graf kroků), takže se počítá napůl. Klikni na figuru pro detail.",
    en: "~ means the figure lacks the data (e.g. a step chart), so it counts half. Click a figure for details.",
  },
  fdScore: { cs: "Shoda se zadáním", en: "Match with your answers" },
  fr_startFoot: { cs: "začíná nohou {foot}", en: "starts with {foot}" },
  fr_startDir: { cs: "první krok {dir}", en: "first step {dir}" },
  fr_startPos: { cs: "začíná v postavení {pos}", en: "starts in {pos}" },
  fr_steps: { cs: "kroky: shoda {ok} z {n}", en: "steps: {ok} of {n} match" },
  fr_firstStepMiss: { cs: "první krok neodpovídá začátku figury", en: "the first step doesn't match the figure's start" },
  fr_noChart: { cs: "kroky nelze porovnat (chybí graf)", en: "steps can't be compared (no chart)" },
  fr_finishPos: { cs: "končí v postavení {pos}", en: "finishes in {pos}" },
  fr_finishPosVariant: { cs: "může končit v postavení {pos} (varianta ze syllabu)", en: "may finish in {pos} (syllabus variant)" },
  fr_finishFoot: { cs: "končí s váhou na {foot}", en: "finishes with weight on {foot}" },
  fr_bars: { cs: "délka {n} taktů", en: "{n} bars long" },
  fr_stepCount: { cs: "{n} kroků", en: "{n} steps" },
  fr_turn: { cs: "otáčí {dir}", en: "turns {dir}" },
  fr_travel: { cs: "pohyb: {t}", en: "movement: {t}" },
  fr_startHold: { cs: "začíná v držení {hold}", en: "starts in {hold}" },
  fr_finishHold: { cs: "končí v držení {hold}", en: "finishes in {hold}" },
  fr_holdVariant: { cs: "držení {hold} je povolená varianta", en: "{hold} is an allowed variant" },
  fr_keywords: { cs: "odpovídá klíčovým slovům", en: "matches the keywords" },
  fr_part: { cs: "jen část figury: kroky {from}–{to} (povolená část)", en: "only part of the figure: steps {from}–{to} (allowed part)" },
  fr_footUnknown: { cs: "nohu nelze ověřit", en: "foot unknown" },
  fr_dirUnknown: { cs: "směr nelze ověřit", en: "direction unknown" },
  fr_posUnknown: { cs: "postavení nelze ověřit", en: "position unknown" },
  fr_lenUnknown: { cs: "délku nelze ověřit", en: "length unknown" },
  fr_turnUnknown: { cs: "otáčení nelze ověřit", en: "turn unknown" },
  fr_holdUnknown: { cs: "držení nelze ověřit", en: "hold unknown" },
  // Routines
  routines: { cs: "Moje sestavy", en: "My routines" },
  noRoutines: {
    cs: "Zatím nemáš žádnou sestavu. Vytvoř první!",
    en: "You have no routines yet. Create the first one!",
  },
  routineName: { cs: "Název sestavy", en: "Routine name" },
  dance: { cs: "Tanec", en: "Dance" },
  delete: { cs: "Smazat", en: "Delete" },
  confirmDelete: { cs: "Opravdu smazat?", en: "Really delete?" },
  duplicate: { cs: "Duplikovat", en: "Duplicate" },
  back: { cs: "Zpět", en: "Back" },
  addFigure: { cs: "Přidat figuru", en: "Add figure" },
  emptyRoutine: {
    cs: "Sestava je prázdná – přidej figury z nabídky vpravo.",
    en: "The routine is empty – add figures from the panel.",
  },
  total: { cs: "Celkem", en: "Total" },
  durationAt: { cs: "délka sestavy při tempu {tempo} taktů/min (standard ČSTS/WDSF)", en: "routine length at {tempo} bars/min (ČSTS/WDSF standard)" },
  perRound: { cs: "opakování za soutěžní kolo (hudba 1:30–2:00)", en: "repetitions per competition round (music 1:30–2:00)" },
  barsPerMin: { cs: "taktů/min", en: "bars/min" },
  legalAll: { cs: "Všechny figury jsou povolené ve třídě", en: "All figures are legal in class" },
  illegalCount: { cs: "nepovolené figury ve třídě", en: "figures not legal in class" },
  illegal: { cs: "Nepovoleno ve třídě", en: "Not legal in class" },
  footOk: { cs: "Navazuje", en: "Connects" },
  footWarn: {
    cs: "Zkontroluj navázání: konec s váhou na {prev}, další figura začíná {next}",
    en: "Check the connection: finish with weight on {prev}, next figure starts {next}",
  },
  footHint: {
    cs: "Odhad podle popisu začátku a konce figur ve WDSF Syllabu (kroky M). Nezohledňuje všechny povolené alternativy z poznámek.",
    en: "Estimated from the WDSF Syllabus start/finish descriptions (Man's steps). Alternatives allowed in the notes are not considered.",
  },
  footUnknown: { cs: "Navázání nelze automaticky ověřit", en: "Connection can't be checked automatically" },
  editVariant: { cs: "Varianta figury", en: "Figure variant" },
  variantsAvailable: { cs: "syllabus nabízí varianty", en: "syllabus offers variants" },
  partOfFigure: { cs: "Část figury", en: "Part of the figure" },
  wholeFigure: { cs: "Celá figura", en: "Whole figure" },
  stepsWord: { cs: "kroky", en: "steps" },
  toEnd: { cs: "konec", en: "end" },
  customPart: { cs: "Vlastní rozsah kroků…", en: "Custom step range…" },
  fromStep: { cs: "Od kroku", en: "From step" },
  toStep: { cs: "Do kroku", en: "To step" },
  partNotAllowed: {
    cs: "Tuto část figury syllabus nepovoluje (figury se nesmí volně krátit).",
    en: "The syllabus does not allow this part of the figure (figures may not be cut freely).",
  },
  estimatedHint: {
    cs: "Noha na začátku/konci části je odhad (kroky se počítají střídavě).",
    en: "The foot at the start/end of the part is estimated (steps assumed to alternate).",
  },
  finishOfPart: { cs: "Konec po kroku {step} ({pos})", en: "End after step {step} ({pos})" },
  variantNotes: { cs: "Všechny poznámky WDSF k této figuře", en: "All WDSF notes for this figure" },
  positionLine: { cs: "Postavení: {prev} → {next}", en: "Position: {prev} → {next}" },
  fixPrev: { cs: "Ukončit předchozí figuru v „{pos}“", en: "Finish the previous figure in “{pos}”" },
  fixNext: { cs: "Začít tuto figuru: {pos}", en: "Start this figure: {pos}" },
  variantsTitle: { cs: "Povolené varianty", en: "Allowed variants" },
  altStarts: { cs: "Může začít", en: "May start" },
  altFinishes: { cs: "Může končit v", en: "May finish in" },
  allowedParts: { cs: "Lze tančit jen část", en: "Only part may be danced" },
  moveUp: { cs: "Posunout nahoru", en: "Move up" },
  moveDown: { cs: "Posunout dolů", en: "Move down" },
  nextOptions: { cs: "Možnosti pokračování", en: "What can follow" },
  nextOptionAdd: { cs: "Vložit za tuto figuru", en: "Insert after this figure" },
  dragHint: { cs: "Přetáhni na jiné místo v sestavě", en: "Drag to another place in the routine" },
  dragToRoutine: { cs: "Přetáhni do sestavy na zvolené místo", en: "Drag into the routine at the chosen place" },
  remove: { cs: "Odebrat", en: "Remove" },
  customTiming: { cs: "Vlastní…", en: "Custom…" },
  primaryTiming: { cs: "základní", en: "basic" },
  export: { cs: "Exportovat", en: "Export" },
  import: { cs: "Importovat", en: "Import" },
  importFailed: { cs: "Soubor se nepodařilo načíst.", en: "Could not read the file." },
  print: { cs: "Tisk", en: "Print" },
  figures: { cs: "figur", en: "figures" },
  rhythmStrip: { cs: "Rytmický průběh", en: "Rhythm overview" },
  bar: { cs: "Takt", en: "Bar" },
  details: { cs: "Detail", en: "Details" },
  pickFigure: { cs: "Vyber figuru", en: "Pick a figure" },
  showAll: { cs: "Zobrazit i nepovolené", en: "Show illegal too" },
  noteLabel: { cs: "Poznámka", en: "Note" },
  myNote: { cs: "Vlastní poznámka…", en: "Your note…" },
  // About
  aboutText: {
    cs: "Data figur a tříd pochází z Katalogu figur ČSTS (příloha SC02 Soutěžního řádu). Začátky, konce, rytmizace, držení a poznámky jsou převzaty z WDSF Syllabu, na který katalog odkazuje. Kroky a směrování pána ve standardních tancích odpovídají technice WDSF; u ostatních figur pochází grafy z dancecentral.info (technika ISTD). Ukázková videa jsou automaticky vyhledaná na YouTube. Sestavy se ukládají jen v tomto prohlížeči – pro zálohu nebo přenos použij export.",
    en: "Figures and classes come from the ČSTS Figure Catalog (appendix SC02 of the Competition Rules). Start, finish, timing, holds and notes come from the WDSF Syllabus referenced by the catalog. The man's steps and alignments in the standard dances follow the WDSF technique; other charts come from dancecentral.info (ISTD technique). Example videos were found automatically on YouTube. Routines are stored in this browser only – use export to back them up or move them.",
  },
  aboutBinding: {
    cs: "Závazné je vždy znění katalogu ČSTS a technických příruček WDSF. Tato aplikace je pomůcka.",
    en: "The ČSTS catalog and the WDSF technique books are always binding. This app is only a helper.",
  },
  sources: { cs: "Zdroje", en: "Sources" },
  timingLegend: {
    cs: "S = pomalá, Q = rychlá, & / a = dělená doba, (…) = výdrž",
    en: "S = slow, Q = quick, & / a = split beat, (…) = held",
  },
} as const;

export type StringKey = keyof typeof STRINGS;

interface I18n {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: StringKey, vars?: Record<string, string>) => string;
  /** "1 takt", "2 takty", "5 taktů", "1½ taktu" / "1 bar", "2 bars". */
  barsWord: (beats: number, beatsPerBar: number) => string;
  /** "1 doba", "2 doby", "5 dob", "½ doby" / "beat", "beats". */
  beatsWord: (beats: number) => string;
}

const Ctx = createContext<I18n | null>(null);

function initialLang(): Lang {
  try {
    const saved = localStorage.getItem("lang");
    if (saved === "cs" || saved === "en") return saved;
  } catch {
    /* storage unavailable */
  }
  return navigator.language?.startsWith("cs") || navigator.language?.startsWith("sk") ? "cs" : "en";
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>(initialLang);
  useEffect(() => {
    document.documentElement.lang = lang;
    try {
      localStorage.setItem("lang", lang);
    } catch {
      /* storage unavailable */
    }
  }, [lang]);
  const t = (key: StringKey, vars?: Record<string, string>) => {
    let s: string = STRINGS[key][lang];
    if (vars) for (const [k, v] of Object.entries(vars)) s = s.replace(`{${k}}`, v);
    return s;
  };
  const barsWord = (beats: number, beatsPerBar: number) => {
    const bars = beats / beatsPerBar;
    const whole = Number.isInteger(Math.round(bars * 1000) / 1000);
    if (lang === "en") return bars === 1 ? "bar" : "bars";
    if (!whole) return "taktu"; // Czech uses genitive singular for fractions
    if (bars === 1) return "takt";
    if (bars >= 2 && bars <= 4) return "takty";
    return "taktů";
  };
  const beatsWord = (beats: number) => {
    if (lang === "en") return beats === 1 ? "beat" : "beats";
    if (!Number.isInteger(Math.round(beats * 1000) / 1000)) return "doby";
    if (beats === 1) return "doba";
    if (beats >= 2 && beats <= 4) return "doby";
    return "dob";
  };
  return <Ctx.Provider value={{ lang, setLang, t, barsWord, beatsWord }}>{children}</Ctx.Provider>;
}

export function useI18n(): I18n {
  const v = useContext(Ctx);
  if (!v) throw new Error("useI18n must be used inside I18nProvider");
  return v;
}
