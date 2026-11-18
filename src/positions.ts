// Couple positions of chart steps, cleaned. The charts' position column comes from OCR
// and holds glued positions ("L Side Same R Side Same"), misread words ("Ex Open Opr",
// "L Side L Angie"), movement words ("Turn toL Diag Opp", "Towards Close Opp") and
// sentences ("Man moves around Lady … finish Open Opp"). Everything that uses positions
// (player, plan, Czech names) gets the clean form: known positions joined by " then ".

/** Misread or glued words → the real ones (applied word by word, case-insensitive). */
const WORD_FIX: [RegExp, string][] = [
  [/\b(?:ciose|cose)\b/gi, "Close"],
  [/\b3ack\b/gi, "Back"],
  [/\bK(?= Diag\b)/g, "R"],
  [/\btol(?=\s)/g, "to L"],
  [/\bto(?=[LR]\b)/g, "to "],
  [/\bpassing through .*$/i, ""],
  [/\b(Diag|Side) towards (?=[LR] Angle)/g, "$1 "],
  [/\bClosed(?= (?:Same|Opp)\b)/g, "Close"],
  [/\bsame\b/g, "Same"],
  [/\bTurnto/gi, "Turn to "],
  [/\bLl\b/g, "L"],
  [/\bin(?=[LR]\b)/g, "in "],
  [/\bLSideL\b/g, "L Side L"],
  [/\bOpen(?=[LR]\b)/g, "Open "],
  [/\bAng(?:ie|ele|ele|ola|ole|alo|le)\b|\bAnele\b|\bAnola\b|\bAnole\b|\bAnalo\b|\bAnola\b/gi, "Angle"],
  [/\bSid(?:al|a)\b/gi, "Side"],
  [/\b(?:Camo|Sama)\b/gi, "Same"],
  [/\bFaliaway\b/gi, "Fallaway"],
  [/\bPron\b/g, "Prom"],
  [/\bRight(?= R Angle)/g, ""],
  [/\bther\.?(?=\s)|\bthe(?= [A-Z])/g, "then"],
  [/\bDiag\./gi, "Diag"],
  [/\bOpp\./gi, "Opp"],
  [/\bSame\./gi, "Same"],
];

/** A word that should be "Open" (before Opp / Same / Prom …) or "Opp" (after Open). */
const GARBLED = /^(?:Oper|Opr|Onn|Oon|Ono|Ope|Opt|Oop|Ooo|Ann|Opry|Op;|Op|Oper:?|Ope:|Dpen|Onen|Oven|Anan|Oven)[^A-Za-z]*$/i;

function fixGarbled(s: string): string {
  const w = s.split(/\s+/);
  for (let i = 0; i < w.length; i++) {
    if (!GARBLED.test(w[i]) && !/^(Opp|Open)[^A-Za-z\s]+$/i.test(w[i])) continue;
    const next = w[i + 1] ?? "";
    const prev = w[i - 1] ?? "";
    if (/^(Opp|Same|Prom|Cnt|Fallaway|Fall|Opr|Onn|Ono|Ooo|Ann)/i.test(next) || /^(Dpen|Onen|Oven|Anan)/i.test(w[i])) w[i] = "Open";
    else if (/^(Open|Close|Diag|Side|Oper|Oven|Ex)$/i.test(prev) || /^Opp/i.test(w[i])) w[i] = "Opp";
    else w[i] = /^Oper$/i.test(w[i]) ? "Open" : "Opp";
  }
  return w.join(" ");
}

const STANDARD =
  "Outside Partner Promenade Position|Outside Partner Position|Partner Outside(?: Position)?|Closed Position|Counter Promenade Position|Promenade Position|Fallaway Position|Wing Position|Contra Position|\\bPP\\b|\\bCPP\\b";
const QUAL = "(?:(?:Back|Ex|Close|Open|Fan)\\s+)*(?:[LR]\\s+)?(?:(?:Side|Diag)\\s+)?";
const CORE = "(?:Same|Opp|[LR] Angle|Cnt Prom|Prom|Fallaway|Fall)\\b";
const ANY = new RegExp(`(${STANDARD})|\\b(${QUAL}${CORE})`, "g");

const cache = new Map<string, string | undefined>();

/** The clean couple position of a chart step, or undefined when none can be read. */
export function cleanPosition(raw: string | undefined | null): string | undefined {
  if (!raw) return undefined;
  const hit = cache.get(raw);
  if (hit !== undefined || cache.has(raw)) return hit;
  let s = raw.replace(/[“”"!¢)(]+/g, " ").replace(/\s+/g, " ").trim();
  // "any position", "according to the preceding figure": no position to draw
  let out: string | undefined;
  if (!/any Same Position|According|^This figure|^May start/i.test(s)) {
    for (const [re, to] of WORD_FIX) s = s.replace(re, to);
    s = fixGarbled(s);
    // "Turn Close Same then turn Close Same", "Ex Open Opp then turn Close L Angle"
    s = s.replace(/\bClosed Position\b/g, "§C§").replace(/\bI §C§/g, "§C§");
    const parts: string[] = [];
    for (const m of s.replace(/§C§/g, "Closed Position").matchAll(ANY)) {
      let p = (m[1] ?? m[2]).replace(/\s+/g, " ").trim();
      p = p.replace(/\bFall$/, "Fallaway").replace(/^(Partner Outside)(?: Position)?$/, "Outside Partner Position");
      // a bare "Opp" / "Same" glued to the word before belongs to it ("R Angle Opp")
      if (/^(Opp|Same)$/.test(p) && parts.length) continue;
      if (parts[parts.length - 1] !== p) parts.push(p);
    }
    // a lone "Opp" read from noise is no position
    out = parts.length && !(parts.length === 1 && /^(Opp|Same)$/.test(parts[0]) && s !== parts[0]) ? parts.join(" then ") : undefined;
  }
  cache.set(raw, out);
  return out;
}
