// Glossary of abbreviations and terms used in the WDSF Syllabus and the ČSTS
// catalog, plus the catalogue of holds (labels, explanations, icon geometry).
import type { Lang } from "./data";

export interface Term {
  id: string;
  /** Regex source matching the term in running text (case-sensitive). */
  pattern: string;
  /** How the term is written, for the glossary list. */
  label: string;
  cs: string;
  en: string;
  group: "feet" | "direction" | "position" | "hold" | "timing" | "other";
}

export const TERMS: Term[] = [
  // Feet, hands, body
  { id: "RF", pattern: "\\bRF\\b", label: "RF", group: "feet", cs: "Right Foot – pravá noha (česky Pn).", en: "Right foot." },
  { id: "LF", pattern: "\\bLF\\b", label: "LF", group: "feet", cs: "Left Foot – levá noha (česky Ln).", en: "Left foot." },
  { id: "Pn", pattern: "\\bPn\\b", label: "Pn", group: "feet", cs: "Pravá noha (anglicky RF).", en: "Czech: right foot (RF)." },
  { id: "Ln", pattern: "\\bLn\\b", label: "Ln", group: "feet", cs: "Levá noha (anglicky LF).", en: "Czech: left foot (LF)." },
  { id: "RH", pattern: "\\bRH\\b", label: "RH", group: "feet", cs: "Right Hand – pravá ruka.", en: "Right hand." },
  { id: "LH", pattern: "\\bLH\\b", label: "LH", group: "feet", cs: "Left Hand – levá ruka.", en: "Left hand." },
  { id: "T", pattern: "\\bT(?= turned)", label: "T", group: "feet", cs: "Toe – špička. „T turned out“ = špička vytočená ven.", en: "Toe. “T turned out” = toe turned out." },
  { id: "Wt", pattern: "\\b[Ww]t\\b", label: "Wt", group: "feet", cs: "Weight – váha (přenesení váhy na nohu).", en: "Weight." },
  { id: "wo", pattern: "\\bw/o\\b", label: "w/o", group: "other", cs: "Without – bez (např. „w/o weight“ = bez přenesení váhy).", en: "Without (e.g. “w/o weight”)." },
  { id: "CBMP", pattern: "\\bCBMP\\b|\\bCMBP\\b", label: "CBMP", group: "position", cs: "Contrary Body Movement Position – postavení protipohybu: noha se klade vpřed nebo vzad přes linii druhé nohy, aniž by se tělo stáčelo. Typické pro kroky mimo partnera a v promenádě.", en: "Contrary Body Movement Position: the foot is placed across the line of the other foot without turning the body." },
  { id: "CBM", pattern: "\\bCBM\\b", label: "CBM", group: "position", cs: "Contrary Body Movement – protipohyb těla: otočení opačné strany těla směrem k pohybující se noze; zahajuje otáčky.", en: "Contrary Body Movement: turning the opposite side of the body towards the moving leg; initiates turns." },

  // Directions
  { id: "fwd", pattern: "\\b[Ff]wd\\b|\\bFFwd\\b", label: "fwd", group: "direction", cs: "Forward – vpřed.", en: "Forward." },
  { id: "bwd", pattern: "\\b[Bb]wd\\b", label: "bwd", group: "direction", cs: "Backward – vzad.", en: "Backward." },
  { id: "diag", pattern: "\\b[Dd]iag\\b\\.?", label: "diag.", group: "direction", cs: "Diagonal – diagonálně, šikmo.", en: "Diagonal(ly)." },
  { id: "LOD", pattern: "\\bLOD\\b", label: "LOD", group: "direction", cs: "Line of Dance – směr tance: proti směru hodinových ručiček kolem parketu.", en: "Line of Dance: anticlockwise around the floor." },
  { id: "alignCode", pattern: "\\b[FBP](?:LOD|DW|DC|W|C)(?:\\s?ag(?:ainst)?\\s?LOD)?\\b", label: "FDW, BLOD, PDC …", group: "direction", cs: "Směrování (alignment): první písmeno říká, jak je tělo natočené – F = facing (čelem), B = backing (zády), P = pointing (špička míří). Zbytek je směr: LOD = po linii tance, DW = diagonálně ke stěně, DC = diagonálně ke středu, W = ke stěně, C = ke středu, „ag LOD“ = proti linii tance.", en: "Alignment: first letter is the body orientation – F = facing, B = backing, P = pointing (foot). Then the direction: LOD, DW (diagonal to wall), DC (diagonal to centre), W (wall), C (centre), “ag LOD” = against LOD." },
  { id: "DC", pattern: "\\bDC\\b", label: "DC", group: "direction", cs: "Diagonal to Centre – diagonálně ke středu sálu.", en: "Diagonal to centre." },
  { id: "DW", pattern: "\\bDW\\b", label: "DW", group: "direction", cs: "Diagonal to Wall – diagonálně ke stěně.", en: "Diagonal to wall." },
  { id: "doP", pattern: "\\b(?:do|v) P\\b", label: "do P / v P", group: "direction", cs: "V českých názvech: doprava (vpravo).", en: "In Czech names: to the right." },
  { id: "doL", pattern: "\\b(?:do|v) L\\b", label: "do L / v L", group: "direction", cs: "V českých názvech: doleva (vlevo).", en: "In Czech names: to the left." },

  // Positions (standard)
  { id: "closed", pattern: "\\bClosed? Pos(?:ition)?\\.?", label: "Closed Position", group: "position", cs: "Zavřené postavení – partneři čelem k sobě v tanečním držení, žena mírně vpravo od muže.", en: "Closed position – partners facing each other in dance hold." },
  { id: "PP", pattern: "\\bPP\\b|\\bP\\.P\\.?|\\bProm(?:enade)?\\.? Pos(?:ition)?\\.?", label: "PP / Promenade Position", group: "position", cs: "Promenádní postavení – pár je otevřený do tvaru V, oba se pohybují stejným směrem (muž vlevo, žena vpravo).", en: "Promenade position – the couple opens into a V shape and moves in the same direction." },
  { id: "CPP", pattern: "\\bCPP\\b|\\bCounter Prom(?:enade)?\\b|\\bCnt Prom\\b", label: "CPP", group: "position", cs: "Counter Promenade Position – obrácené promenádní postavení (žena vlevo od muže).", en: "Counter promenade position – mirror of PP." },
  { id: "OP", pattern: "\\bOP\\b|\\bOutside Partner(?: Pos(?:ition)?)?", label: "OP / Outside Partner", group: "position", cs: "Outside Partner – postavení mimo partnera: krok vpřed vedle partnerky (obvykle po její pravé straně) místo mezi jejíma nohama.", en: "Outside partner – stepping beside the partner (usually on her right side)." },
  { id: "wing", pattern: "\\bWing Pos(?:ition)?", label: "Wing Position", group: "position", cs: "Postavení křídla – žena je po levém boku muže, v držení.", en: "Wing position – lady on the man's left side, in hold." },
  { id: "fallaway", pattern: "\\b(?:Close )?Fallaway\\b", label: "Fallaway", group: "position", cs: "Spádné postavení – promenádní postavení, ve kterém se oba pohybují vzad.", en: "Fallaway – promenade position moving backwards." },

  // Positions (latin)
  { id: "closeOpp", pattern: "\\bClose\\.? Opp(?:osing|osition)?\\.?(?: Pos(?:ition)?\\.?)?", label: "Close Opp.", group: "position", cs: "Close Opposing Position – uzavřené opoziční postavení: čelem k sobě v těsném kontaktu, obvykle v normálním držení.", en: "Close opposing position – facing each other, close together." },
  { id: "openOpp", pattern: "\\b(?:Ex\\.? )?Open Opp(?:osing|osition)?\\.?(?: Pos(?:ition)?\\.?)?", label: "Open Opp.", group: "position", cs: "Open Opposing Position – otevřené opoziční postavení: čelem k sobě, na vzdálenost natažených paží. „Ex.“ = rozšířené (extended).", en: "Open opposing position – facing each other at arm's length. “Ex.” = extended." },
  { id: "sideSame", pattern: "\\b(?:R|L|Right|Left) [Ss]ide\\.? [Ss]ame(?: Pos(?:ition)?\\.?)?", label: "R / L Side Same", group: "position", cs: "Right / Left Side Same Position – stranové postavení: žena stojí po pravém (levém) boku muže, oba čelem stejným směrem.", en: "Right/Left side same position – side by side facing the same way." },
  { id: "diagPos", pattern: "\\b(?:Back )?(?:R|L|Right|Left) (?:Back )?Diag\\.? ?(?:Opp|Same|R Angle|L Angle)\\.?(?: Pos(?:ition)?\\.?)?", label: "R / L Diag Opp. / Same", group: "position", cs: "Diagonální postavení – partneři jsou vůči sobě posunuti po diagonále (vpravo/vlevo); „Opp.“ = čelem k sobě, „Same“ = čelem stejným směrem, „R Angle“ = v pravém úhlu.", en: "Diagonal positions – partners offset diagonally; Opp. = facing, Same = same direction, R Angle = at a right angle." },
  { id: "fan", pattern: "\\b[Ff]an L Angle(?: [Pp]os(?:ition)?)?", label: "Fan L Angle", group: "position", cs: "Postavení vějíře – žena je po levé straně muže a stojí k němu v pravém úhlu (typicky po figuře Fan).", en: "Fan position – lady on the man's left, at a right angle to him." },
  { id: "opp", pattern: "\\bOpp\\.", label: "Opp.", group: "position", cs: "Opposing / opposition – čelem k sobě.", en: "Opposing – facing each other." },

  // Holds (details in HOLDS below)
  { id: "normalHold", pattern: "\\bNormal [Hh]old\\b", label: "Normal Hold", group: "hold", cs: "Normální (uzavřené) držení – levá ruka muže drží pravou ruku ženy, pravá ruka muže je na lopatce ženy.", en: "Normal hold – man's LH holds lady's RH, man's RH on her shoulder blade." },
  { id: "promHold", pattern: "\\bProm(?:enade)?\\.? [Hh]old\\b", label: "Promenade Hold", group: "hold", cs: "Promenádní držení – normální držení otevřené do promenádního postavení.", en: "Promenade hold – normal hold opened into promenade position." },
  { id: "handHold", pattern: "\\b[LR]H (?:to|TO) [LR]H(?: and [LR]H to [LR]H)?(?: [Hh]old)?", label: "LH to RH …", group: "hold", cs: "Držení za ruce: první je ruka muže, druhá ženy. „LH to RH“ = levá ruka muže drží pravou ruku ženy.", en: "Hand hold: man's hand first, lady's second. “LH to RH” = man's left hand holds lady's right hand." },
  { id: "shadowHold", pattern: "\\bShadow [Hh]old\\b", label: "Shadow Hold", group: "hold", cs: "Stínové držení – žena je před mužem nebo po jeho boku, oba čelem stejným směrem.", en: "Shadow hold – lady in front of / beside the man, both facing the same way." },
  { id: "noHold", pattern: "\\bw/o [Hh]old\\b|\\bno hold\\b", label: "w/o Hold", group: "hold", cs: "Bez držení.", en: "Without hold." },

  // Timing
  { id: "S", pattern: "(?<![A-Za-z])S(?=[SQa&\\s(]|$)", label: "S", group: "timing", cs: "Slow – pomalá doba. Ve standardních tancích (kromě tanga) = 2 doby, v tangu, sambě = 1 doba.", en: "Slow. 2 beats in most standard dances, 1 beat in tango and samba." },
  { id: "Q", pattern: "(?<![A-Za-z])Q(?=[SQa&\\s(]|$)", label: "Q", group: "timing", cs: "Quick – rychlá doba, polovina S (1 doba, v tangu a sambě ½ doby).", en: "Quick – half of a slow (1 beat; ½ in tango and samba)." },
  { id: "amp", pattern: "&", label: "&", group: "timing", cs: "„a“ – krok mezi dobami: dělí předchozí dobu na poloviny (např. 2&3).", en: "“and” – a step between beats, splitting the previous beat in half." },
  { id: "a", pattern: "(?<=[SQ0-9])a(?=[SQ0-9])", label: "a", group: "timing", cs: "Čtvrtinová doba: krok na poslední čtvrtině doby (samba „1a2“, jive „3a4“).", en: "Quarter beat: step on the last quarter of the beat (samba “1a2”, jive “3a4”)." },

  // Misc
  { id: "TSP", pattern: "\\bTSP\\b", label: "TSP", group: "other", cs: "Tango Specific Principles – specifické principy tanga (popsané v technické příručce WDSF).", en: "Tango Specific Principles (WDSF technique book)." },
  { id: "JSP", pattern: "\\bJSP\\b", label: "JSP", group: "other", cs: "Jive Specific Principles – specifické principy jive.", en: "Jive Specific Principles." },
  { id: "MCF", pattern: "\\bMCF\\b", label: "MCF", group: "other", cs: "Methods of Changing Feet – metody změny nohy.", en: "Methods of changing feet." },
];

const byId = new Map(TERMS.map((t) => [t.id, t]));
export const getTerm = (id: string) => byId.get(id);

// One combined regex with a named group per term; longer/more specific terms
// are listed first so e.g. "Close Opp." wins over "Opp.".
const ORDER = [...TERMS].sort((a, b) => b.pattern.length - a.pattern.length);
const COMBINED = new RegExp(ORDER.map((t) => `(?<${t.id.replace(/[^A-Za-z0-9]/g, "_")}>${t.pattern})`).join("|"), "g");
const groupToId = new Map(ORDER.map((t) => [t.id.replace(/[^A-Za-z0-9]/g, "_"), t.id]));

export interface Chunk {
  text: string;
  termId?: string;
}

/** Split text into plain chunks and recognised terms. */
export function splitTerms(text: string, groups?: Term["group"][]): Chunk[] {
  const out: Chunk[] = [];
  let last = 0;
  for (const m of text.matchAll(COMBINED)) {
    const name = Object.entries(m.groups ?? {}).find(([, v]) => v !== undefined)?.[0];
    const id = name ? groupToId.get(name) : undefined;
    const term = id ? byId.get(id) : undefined;
    if (!term || (groups && !groups.includes(term.group)) || m.index === undefined) continue;
    if (m.index > last) out.push({ text: text.slice(last, m.index) });
    out.push({ text: m[0], termId: term.id });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ text: text.slice(last) });
  return out;
}

// --- Holds ---------------------------------------------------------------------

export type HoldKey = "normal" | "promenade" | "lh-rh" | "rh-lh" | "rh-rh" | "lh-lh" | "double" | "shadow" | "none";

export interface HoldInfo {
  key: HoldKey;
  /** Name used in the WDSF texts. */
  wdsf: string;
  cs: string;
  en: string;
  descCs: string;
  descEn: string;
  /** Hand connections for the icon: [man's hand, lady's hand]. */
  links: ["L" | "R", "L" | "R"][];
  /** Couple stands close (body contact) in the icon. */
  close?: boolean;
  /** Both face the same direction (shadow). */
  same?: boolean;
}

export const HOLDS: HoldInfo[] = [
  { key: "normal", wdsf: "Normal Hold", cs: "Normální", en: "Normal", links: [["L", "R"]], close: true,
    descCs: "Uzavřené držení: levá ruka muže drží pravou ruku ženy, pravá ruka muže na lopatce ženy.",
    descEn: "Closed hold: man's LH holds lady's RH, man's RH on her shoulder blade." },
  { key: "promenade", wdsf: "Promenade Hold", cs: "Promenádní", en: "Promenade", links: [["L", "R"]], close: true,
    descCs: "Normální držení otevřené do promenády (tvar V).", descEn: "Normal hold opened into promenade (V shape)." },
  { key: "lh-rh", wdsf: "LH to RH", cs: "Levá – pravá", en: "Left – right", links: [["L", "R"]],
    descCs: "Levá ruka muže drží pravou ruku ženy.", descEn: "Man's left hand holds lady's right hand." },
  { key: "rh-lh", wdsf: "RH to LH", cs: "Pravá – levá", en: "Right – left", links: [["R", "L"]],
    descCs: "Pravá ruka muže drží levou ruku ženy.", descEn: "Man's right hand holds lady's left hand." },
  { key: "rh-rh", wdsf: "RH to RH", cs: "Pravá – pravá", en: "Right – right", links: [["R", "R"]],
    descCs: "Pravá ruka muže drží pravou ruku ženy (jako podání ruky).", descEn: "Man's right hand holds lady's right hand (handshake)." },
  { key: "lh-lh", wdsf: "LH to LH", cs: "Levá – levá", en: "Left – left", links: [["L", "L"]],
    descCs: "Levá ruka muže drží levou ruku ženy.", descEn: "Man's left hand holds lady's left hand." },
  { key: "double", wdsf: "LH to RH and RH to LH", cs: "Obě ruce", en: "Double hold", links: [["L", "R"], ["R", "L"]],
    descCs: "Dvojité držení: levá muže v pravé ženy a pravá muže v levé ženy.", descEn: "Double hold: man's LH to lady's RH and man's RH to lady's LH." },
  { key: "shadow", wdsf: "Shadow Hold", cs: "Stínové", en: "Shadow", links: [["L", "L"], ["R", "R"]], same: true,
    descCs: "Žena před mužem nebo po jeho boku, oba čelem stejným směrem.", descEn: "Lady in front of or beside the man, both facing the same way." },
  { key: "none", wdsf: "w/o Hold", cs: "Bez držení", en: "No hold", links: [],
    descCs: "Partneři se nedrží.", descEn: "Partners don't hold." },
];

const holdByKey = new Map(HOLDS.map((h) => [h.key, h]));
export const getHold = (k: string | null | undefined) => (k ? holdByKey.get(k as HoldKey) : undefined);

/**
 * All holds the syllabus allows for a figure: the start/finish holds plus
 * those mentioned in the notes. `any` = notes allow "any appropriate hold".
 */
export function allowedHolds(holds: { start?: string; finish?: string; alts: string[]; any?: boolean } | undefined) {
  if (!holds) return { keys: [] as HoldKey[], any: false, multiple: false };
  const keys: HoldKey[] = [];
  for (const k of [holds.start, holds.finish, ...holds.alts]) {
    if (k && getHold(k) && !keys.includes(k as HoldKey)) keys.push(k as HoldKey);
  }
  const any = !!holds.any;
  // Start ≠ finish is just the hold changing during the figure; only holds from
  // the notes (or "any hold") are real alternatives.
  const hasAlt = holds.alts.some((k) => k !== holds.start && k !== holds.finish && getHold(k));
  return { keys, any, multiple: any || hasAlt };
}

export function holdName(k: string | null | undefined, lang: Lang): string {
  const h = getHold(k);
  return h ? `${h[lang]} (${h.wdsf})` : "?";
}

// --- Couple positions: Czech names ------------------------------------------------
// Czech wording follows the ČSTS catalog ("Otevřené opoziční postavení" …).

export interface PositionName {
  en: string;
  cs: string;
  /** Regex source matching the WDSF spellings of the position. */
  pattern: string;
  latin?: boolean;
}

export const POSITIONS: PositionName[] = [
  { en: "Close Promenade", cs: "uzavřená promenáda", pattern: "Close (?:PP|Prom(?:enade)?\\.?(?: Pos(?:ition)?\\.?)?)", latin: true },
  { en: "Open Same Position", cs: "otevřené souběžné postavení", pattern: "Open Same(?: Pos(?:ition)?\\.?)?", latin: true },
  { en: "Close Same Position", cs: "uzavřené souběžné postavení", pattern: "Close Same(?: Pos(?:ition)?\\.?)?", latin: true },
  { en: "R Side Opp.", cs: "pravé stranové opoziční postavení", pattern: "(?:R|Right) Side\\.? Opp\\.?", latin: true },
  { en: "Open R Angle", cs: "otevřené postavení v pravém úhlu", pattern: "Open R Angle", latin: true },
  { en: "R Diagonal Same", cs: "pravé diagonální souběžné postavení", pattern: "R Diagonal Same(?: Pos(?:ition)?\\.?)?", latin: true },
  { en: "Closed Position", cs: "zavřené postavení", pattern: "Closed? Pos(?:ition)?\\.?" },
  { en: "Counter Promenade Position", cs: "obrácené promenádní postavení", pattern: "Counter Prom(?:enade)?\\.? Pos(?:ition)?\\.?|\\bCPP\\b" },
  { en: "Promenade Position", cs: "promenádní postavení", pattern: "Prom(?:enade)?\\.? Pos(?:i?tion)?\\.?|\\bP\\.?P\\.?(?=$|[\\s;,)])" },
  { en: "Outside Partner Position", cs: "postavení mimo partnera", pattern: "Outside Partner(?: Pos(?:ition)?\\.?)?|\\bOP Pos(?:ition)?" },
  { en: "Wing Position", cs: "postavení křídla", pattern: "Wing Pos(?:ition)?\\.?" },
  { en: "Close Fallaway", cs: "uzavřené spádné postavení", pattern: "Close Fallaway", latin: true },
  { en: "Fallaway Position", cs: "spádné postavení", pattern: "Fallaway(?: Pos(?:ition)?)?" },
  { en: "Close Opp.", cs: "uzavřené opoziční postavení", pattern: "Close\\.? Opp(?:osing|osition)?\\.?(?: Pos(?:ition)?\\.?)?", latin: true },
  { en: "Ex. Open Opp.", cs: "rozšířené otevřené opoziční postavení", pattern: "Ex(?:tended)?\\.? Open Opp(?:osing|osition)?\\.?(?: Pos(?:ition)?\\.?)?", latin: true },
  { en: "Open Opp.", cs: "otevřené opoziční postavení", pattern: "Open Opp(?:osing|osition)?\\.?(?: Pos(?:ition)?\\.?)?", latin: true },
  { en: "R Side Same", cs: "pravé stranové postavení", pattern: "(?:R|Right) [Ss]ide\\.? [Ss]ame(?: Pos(?:ition)?\\.?)?", latin: true },
  { en: "L Side Same", cs: "levé stranové postavení", pattern: "(?:L|Left) [Ss]ide\\.? [Ss]ame(?: Pos(?:ition)?\\.?)?", latin: true },
  { en: "Diag. R Angle", cs: "diagonální postavení v pravém úhlu", pattern: "(?:Back )?(?:R|L|Right|Left) (?:Back )?Diag\\.? ?(?:R|L) Angle(?: Pos(?:ition)?\\.?)?", latin: true },
  { en: "R Diag Opp.", cs: "pravé diagonální opoziční postavení", pattern: "(?:R|Right) Diag\\.? ?Opp\\.?", latin: true },
  { en: "L Diag Opp.", cs: "levé diagonální opoziční postavení", pattern: "(?:L|Left) Diag\\.? ?Opp\\.?", latin: true },
  { en: "R Diag Same", cs: "pravé diagonální souběžné postavení", pattern: "(?:Back )?(?:R|Right) Diag\\.? ?[Ss]ame", latin: true },
  { en: "L Diag Same", cs: "levé diagonální souběžné postavení", pattern: "(?:L|Left) Diag\\.? ?[Ss]ame", latin: true },
  { en: "Fan L Angle", cs: "postavení vějíře", pattern: "[Ff]an L Angle(?: [Pp]os(?:ition)?)?\\.?", latin: true },
  { en: "Close Promenade", cs: "uzavřená promenáda", pattern: "Close Prom(?:enade)?\\.?", latin: true },
  { en: "Open Promenade", cs: "otevřená promenáda", pattern: "(?:Ex\\.? )?Open Prom(?:enade)?\\.?", latin: true },
  { en: "Open CPP", cs: "otevřená obrácená promenáda", pattern: "Open CPP|Ex\\.? Open Cnt Prom", latin: true },
  { en: "Shadow Position", cs: "stínové postavení", pattern: "Shadow Pos(?:ition)?", latin: true },
  { en: "Tandem Position", cs: "tandemové postavení", pattern: "Tandem(?: Pos(?:ition)?)?", latin: true },
];

// Case-insensitive: the syllabus writes both "Promenade Position" and "Promenade position".
const POS_RE = new RegExp(POSITIONS.map((p) => `(${p.pattern})`).join("|"), "gi");

// Holds and small connecting words used in the syllabus start/finish texts.
// Order matters: longer phrases first.
const HOLD_CS: [RegExp, string][] = [
  [/\bHold:\s*according to the previous figure/gi, "držení podle předchozí figury"],
  [/\bpreceding figure\b/gi, "podle předchozí figury"],
  [/\bLH to RH (?:and|a) RH to LH(?: Hold)?/gi, "držení oběma rukama"],
  [/\b(?:with )?Both Hand Hold/gi, "s držením oběma rukama"],
  [/\bNormal Hold\b/gi, "normální držení"],
  [/\bProm(?:enade)?\.? Hold\b/gi, "promenádní držení"],
  [/\bShadow Hold\b/gi, "stínové držení"],
  [/\bw\/o Hold(?: hold)?\b|\bno hold\b/gi, "bez držení"],
  [/\bRelease LH (?:Hand )?Hold\b/gi, "levá ruka pouští držení"],
  [/\bRelease RH (?:Hand )?Hold\b/gi, "pravá ruka pouští držení"],
  [/\bRelease (?:Hand )?Hold\b/gi, "uvolnění držení"],
  [/\bRH releases (?:the )?Hold\b/gi, "pravá ruka pouští držení"],
  [/\bLH releases (?:the )?Hold\b/gi, "levá ruka pouští držení"],
  [/\bLH to RH(?: Hold)?/gi, "držení levá – pravá"],
  [/\bRH to LH(?: Hold)?/gi, "držení pravá – levá"],
  [/\bRH to RH(?: Hold)?/gi, "držení pravá – pravá"],
  [/\bLH to LH(?: Hold)?/gi, "držení levá – levá"],
  [/\bRH (?:of Man )?(?:on|to) Lady[’']s R shoulder\b/gi, "pravá ruka muže na pravém rameni ženy"],
  [/\bRH (?:of Man )?(?:on|to) Lady[’']s L shoulder blade\b/gi, "pravá ruka muže na levé lopatce ženy"],
  [/\bLady turns under Man[’']s LH\b/gi, "žena se otáčí pod levou rukou muže"],
  [/\bas a precede to\b/gi, "jako příprava na"],
  [/\bExt(?:ended)?\.?\s+(?=otevřen|uzavřen)/g, "rozšířené "],
  [/\bon (RF|LF)\b/g, "na $1"],
  [/\bClose (?=levé|pravé)/g, "uzavřené "],
];

// Step descriptions from the dancecentral.info charts ("LF to side and slightly back").
const STEP_CS: [RegExp, string][] = [
  [/\bcloses? to\b/gi, "přisouvá k"],
  [/\bbrushes? to\b/gi, "přitahuje k"],
  [/\boutside partner\b/gi, "mimo partnera"],
  [/\bHeel Turn\b/g, "otáčka na patě"],
  [/\bHeel Pull\b/g, "přitažení na patě"],
  [/\bToe Pivot\b/g, "pivot na špičce"],
  [/\bSlip Pivot\b/g, "skluzný pivot"],
  [/\bPivot\b/g, "pivot"],
  [/\bSwivel\b/g, "švih"],
  [/\bloosely\b/gi, "volně"],
  [/\band across\b/gi, "a napříč"],
  [/\bL side leading\b/g, "vedení levým bokem"],
  [/\bR side leading\b/g, "vedení pravým bokem"],
  [/\bpart weight\b/gi, "s částečnou váhou"],
  [/\bfeet close\b/gi, "chodidla k sobě"],
  [/\bfeet uncross\b/gi, "chodidla se rozkříží"],
  [/\bcrosses? behind\b/gi, "kříží za"],
  [/\bcrosses? in front of\b/gi, "kříží před"],
  [/\bto side\b/gi, "stranou"],
  [/\bslightly\b/gi, "mírně"],
  [/\b(?:fwd|forward)\b/gi, "vpřed"],
  [/\b(?:bwd|back|backward)\b/gi, "vzad"],
  [/\bdiag(?:onally)?\.?\b/gi, "diagonálně"],
  [/\bin place\b/gi, "na místě"],
  [/\brecover\b/gi, "váha zpět na"],
  [/\b(?:transfer|replace) weight to\b/gi, "přenést váhu na"],
  [/\bwithout weight\b|\bw\/o weight\b/gi, "bez váhy"],
  [/\bOP\b/g, "mimo partnera"],
  [/\bin (?=CBMP|CBM)/g, "v "],
  [/\btoe turned (?:in|out)\b/gi, (m: string) => (/in$/i.test(m) ? "špička vtočená" : "špička vytočená")] as unknown as [RegExp, string],
  [/\bmoving\b/gi, "pohyb"],
  [/\bleaning\b/gi, "s náklonem"],
  [/\bstrong step\b/gi, "výrazný krok"],
  [/\bsmall step\b/gi, "malý krok"],
  [/\bwith part weight\b/gi, "s částečnou váhou"],
  [/\bPP\b/g, "promenáda"],
  [/\band\b/g, "a"],
];

// Amount-of-turn column of the charts ("1/4 between 1 and 2", "starts to turn R").
const TURN_CS: [RegExp, string][] = [
  [/\bstarts? to turn\b/gi, "začíná točit"],
  [/\bthen\b/gi, "pak"],
  [/\bcontinue(?:s)? to turn\b/gi, "pokračuje v otáčení"],
  [/\bbody turns less\b/gi, "tělo točí méně"],
  [/\bbody completes (?:the )?turn\b/gi, "tělo dokončí otočení"],
  [/\bcompletes? (?:the )?turn\b/gi, "dokončí otočení"],
  [/\bno turn\b/gi, "bez otáčení"],
  [/\bbetween\b|\bbtwn\b/gi, "mezi"],
  [/\bover\b/gi, "během kroků"],
  [/\bon\b/gi, "na"],
  [/\bpreceding step\b/gi, "předchozím krokem"],
  [/\bto (?:the )?R\b|\bto right\b|\bR\b/g, "vpravo"],
  [/\bto (?:the )?L\b|\bto left\b|\bL\b/g, "vlevo"],
  [/\band\b/g, "a"],
  [/\bup to\b/gi, "až"],
];

/** Czech rendering of the chart's amount-of-turn text. */
export function localizeTurn(text: string, lang: Lang): string {
  if (lang !== "cs" || !text) return text;
  let out = text;
  for (const [re, rep] of TURN_CS) out = out.replace(re, rep);
  return out;
}

/** Czech rendering of a chart step description (feet, directions, positions, holds). */
export function localizeStep(text: string, lang: Lang): string {
  if (lang !== "cs" || !text) return text;
  let out = localizePositions(text, lang);
  for (const [re, rep] of STEP_CS) out = out.replace(re, rep);
  return out;
}

/**
 * Czech UI: replace WDSF position and hold names inside a text by Czech names.
 * English UI: text is returned unchanged.
 */
export function localizePositions(text: string, lang: Lang): string {
  if (lang !== "cs" || !text) return text;
  let out = text.replace(POS_RE, (...m) => {
    const idx = m.slice(1, POSITIONS.length + 1).findIndex((g) => g !== undefined);
    return idx >= 0 ? POSITIONS[idx].cs : m[0];
  });
  for (const [re, rep] of HOLD_CS) out = out.replace(re, rep);
  return out
    .replace(/\bRF\b/g, "Pn")
    .replace(/\bLF\b/g, "Ln")
    // "X to Y" between translated phrases means a change during the step.
    .replace(/(postavení|promenáda|držení) to (?=[a-zěščřžýáíéůúó])/g, "$1 → ")
    .replace(/\bwith (?=[a-zěščřžýáíéůúó])/g, "s ")
    .replace(/\bin (?!place\b)(?=[a-zěščřžýáíéůúó])/g, "v ")
    .replace(/\.;/g, ";");
}
