// Readable prose description of a figure, assembled from the catalog and the
// WDSF Syllabus data (start, finish, timing, holds, allowed variants). It does
// not invent technique the sources don't contain.
import { getDance, type Figure, type Lang } from "./data";
import { getHold, localizePositions } from "./glossary";
import { countSteps, formatBars, parseTiming, totalBeats } from "./timing";

function czSteps(n: number) {
  if (n === 1) return "krok";
  if (n >= 2 && n <= 4) return "kroky";
  return "kroků";
}

function czBars(bars: string) {
  if (bars === "1") return "takt";
  if (["2", "3", "4"].includes(bars)) return "takty";
  if (/[¼½¾⅓⅔]/.test(bars)) return "taktu";
  return "taktů";
}

function list(items: string[], lang: Lang) {
  const or = lang === "cs" ? " nebo " : " or ";
  if (items.length <= 1) return items.join("");
  return items.slice(0, -1).join(", ") + or + items[items.length - 1];
}

export function describeFigure(fig: Figure, lang: Lang): string[] {
  const dance = getDance(fig.dance);
  const syl = fig.syllabus;
  const name = lang === "cs" || !fig.en ? fig.cs : fig.en;
  const classes = fig.classes.join(", ");
  const out: string[] = [];

  if (fig.custom) {
    out.push(
      lang === "cs"
        ? `${name} je vlastní figura tance ${dance.cs}. Není v katalogu ČSTS, takže je povolená jen ve třídách B, A a M.`
        : `${name} is a custom ${dance.en} figure. It is not in the ČSTS catalog, so it is allowed only in classes B, A and M.`,
    );
  } else if (lang === "cs") {
    out.push(
      `${name} je figura tance ${dance.cs} (č. ${fig.no} v katalogu ČSTS), povolená ve třídách ${classes}` +
        (fig.dance === "polka" ? "." : "; ve třídách B, A a M bez omezení."),
    );
  } else {
    out.push(
      `${name} is a ${dance.en} figure (no. ${fig.no} in the ČSTS catalog), allowed in classes ${classes}` +
        (fig.dance === "polka" ? "." : "; unrestricted in classes B, A and M."),
    );
  }
  if (!syl) return out.map((para) => localizePositions(para, lang));

  // Start / finish (man's steps).
  out.push(
    lang === "cs"
      ? `Muž ji začíná krokem ${syl.startCs} a končí ${/^(váha|weight)/i.test(syl.finishCs) ? "s tím, že " + syl.finishCs : "krokem " + syl.finishCs}.`
      : `The man starts with ${syl.start} and finishes with ${syl.finish}.`,
  );

  // Timing.
  if (syl.timing) {
    const steps = parseTiming(syl.timing, dance);
    const beats = totalBeats(steps);
    const bars = formatBars(beats, dance.beatsPerBar);
    const counts = countSteps(steps, dance)
      .map((s) => s.count)
      .join(", ");
    out.push(
      lang === "cs"
        ? `Má ${steps.length} ${czSteps(steps.length)} a trvá ${bars} ${czBars(bars)} (${dance.meter}) s rytmizací ${syl.timing}; kroky připadají na doby ${counts}.`
        : `It has ${steps.length} steps and lasts ${bars} bar${bars === "1" ? "" : "s"} (${dance.meter}) with timing ${syl.timing}; the steps fall on counts ${counts}.`,
    );
    if (syl.altTimings.length) {
      out.push(
        lang === "cs"
          ? `Syllabus dovoluje i rytmizaci ${list(syl.altTimings, lang)}.`
          : `The syllabus also allows the timing ${list(syl.altTimings, lang)}.`,
      );
    }
  }

  // Holds (latin).
  const h = syl.holds;
  if (h?.start || h?.finish) {
    const s = getHold(h.start);
    const f = getHold(h.finish);
    // Czech phrase "v držení X" / "bez držení".
    const inHold = (x: typeof s) =>
      !x ? "" : x.key === "none" ? (lang === "cs" ? "bez držení (w/o Hold)" : "without hold") : lang === "cs" ? `v držení ${x.cs.toLowerCase()} (${x.wdsf})` : `in ${x.wdsf}`;
    if (s && f && s.key === f.key) {
      out.push(lang === "cs" ? `Tančí se ${inHold(s)}.` : `It is danced ${inHold(s)}.`);
    } else if (s && f) {
      out.push(lang === "cs" ? `Začíná ${inHold(s)} a končí ${inHold(f)}.` : `It starts ${inHold(s)} and finishes ${inHold(f)}.`);
    } else if (f) {
      out.push(lang === "cs" ? `Končí ${inHold(f)}.` : `It finishes ${inHold(f)}.`);
    } else if (s) {
      out.push(lang === "cs" ? `Začíná ${inHold(s)}.` : `It starts ${inHold(s)}.`);
    }
    const alts = h.alts.filter((k) => k !== h.start && k !== h.finish).map((k) => getHold(k)?.wdsf ?? k);
    if (h.any) out.push(lang === "cs" ? "Podle poznámek lze použít libovolné vhodné držení." : "The notes allow any appropriate hold.");
    else if (alts.length)
      out.push(lang === "cs" ? `Poznámky zmiňují i držení ${list(alts, lang)}.` : `The notes also mention ${list(alts, lang)}.`);
  }

  // Variants.
  const v = syl.variants;
  if (v?.parts?.length) {
    const parts = v.parts.map((p) => `${p.from}–${p.to ?? (lang === "cs" ? "konec" : "end")}`);
    out.push(
      lang === "cs"
        ? `Samostatně lze tančit jen kroky ${list(parts, lang)}; jinak se figura nesmí krátit.`
        : `Only steps ${list(parts, lang)} may be danced on their own; otherwise the figure may not be cut.`,
    );
  }
  if (v?.starts?.length) {
    const s = v.starts.map((x) => (lang === "cs" ? x.descCs : x.desc));
    out.push(lang === "cs" ? `Může začít také: ${s.join("; ")}.` : `It may also start: ${s.join("; ")}.`);
  }
  if (v?.finishes?.length) {
    const f = v.finishes.map((x) => x.position);
    out.push(lang === "cs" ? `Může končit také v ${list(f, lang)}.` : `It may also finish in ${list(f, lang)}.`);
  }
  if (syl.seeAlso) {
    out.push(lang === "cs" ? `Popis je převzat z: ${syl.seeAlso}.` : `Description taken from: ${syl.seeAlso}.`);
  }
  return out.map((para) => localizePositions(para, lang));
}
