// "Which figure is it?" — score catalog figures against what the dancer remembers
// (feet, directions, positions, length, turn, hold, travel, keywords). Every
// criterion is optional; each one that is set contributes points and a reason
// shown to the user (match / partial / mismatch).
import { allFigures, fold, getDance, isLegal, searchText, type ClassId, type Figure } from "./data";
import { chartSteps, travelFactor } from "./floor";
import { finishWeightFoot, parseTiming, positionOf, startFoot, totalBeats, type Foot } from "./timing";
import { normPosition } from "./variants";

export type Dir = "fwd" | "bwd" | "side" | "place";
export type TurnDir = "R" | "L" | "none";

export interface StepSpec {
  foot: Foot | "";
  dir: Dir | "";
}

export interface FinderQuery {
  dance: string;
  cls: ClassId | "";
  /** Previous figure id: derives the expected start foot and position. */
  prevId: string;
  startFoot: Foot | "";
  startDir: Dir | "";
  startPos: string;
  steps: StepSpec[];
  finishPos: string;
  finishFoot: Foot | "";
  /** Length in bars (0 = unknown). */
  bars: number;
  /** Number of steps (0 = unknown). */
  stepCount: number;
  turn: TurnDir | "";
  travel: "spot" | "travel" | "";
  startHold: string;
  finishHold: string;
  keywords: string;
}

export const emptyQuery = (dance = "waltz"): FinderQuery => ({
  dance,
  cls: "",
  prevId: "",
  startFoot: "",
  startDir: "",
  startPos: "",
  steps: [],
  finishPos: "",
  finishFoot: "",
  bars: 0,
  stepCount: 0,
  turn: "",
  travel: "",
  startHold: "",
  finishHold: "",
  keywords: "",
});

export type ReasonKind = "match" | "partial" | "miss";

export interface Reason {
  kind: ReasonKind;
  /** i18n key + variables, rendered by the UI. */
  key: string;
  vars?: Record<string, string>;
}

export interface FinderResult {
  fig: Figure;
  /** Best matching allowed part of the figure (steps, 1-based), undefined = whole figure. */
  part?: { from: number; to: number };
  /** 0–1 share of the points available for the criteria that were set. */
  score: number;
  reasons: Reason[];
}

/** Direction of a step description ("LF bwd and slightly to side" -> bwd). */
export function dirOf(text: string): Dir | null {
  // The direction named first is the main one: "LF to side and slightly fwd" is a side step,
  // "LF fwd and slightly to side" a forward step.
  const d = text.toLowerCase();
  const found: [number, Dir][] = [];
  const at = (re: RegExp, dir: Dir) => {
    const m = d.match(re);
    if (m && m.index !== undefined) found.push([m.index, dir]);
  };
  at(/\bfwd\b|forward|vpřed/, "fwd");
  at(/\bbwd\b|\bback\b|backward|vzad/, "bwd");
  at(/\bside\b|stranou/, "side");
  at(/closes|in place|weight|replace|transfer|na místě|přisouvá/, "place");
  if (!found.length) return null;
  return found.sort((a, b) => a[0] - b[0])[0][1];
}

function footOf(text: string): Foot | null {
  const m = text.match(/\b(RF|LF)\b/);
  return m ? (m[1] as Foot) : null;
}

/** All couple positions a figure may start / finish in (basic + syllabus variants). */
function startPositions(f: Figure): string[] {
  const out = [positionOf(f.syllabus?.start)];
  for (const s of f.syllabus?.variants?.starts ?? []) {
    const idx = s.desc.toLowerCase().lastIndexOf(" in ");
    out.push(idx >= 0 ? s.desc.slice(idx + 4) : null);
  }
  return out.map((p) => normPosition(p)).filter((p): p is string => !!p);
}

function finishPositions(f: Figure): { base: string | null; variants: string[] } {
  return {
    base: normPosition(positionOf(f.syllabus?.finish) ?? positionOf(f.syllabus?.start)),
    variants: (f.syllabus?.variants?.finishes ?? []).map((x) => normPosition(x.position)).filter((p): p is string => !!p),
  };
}

function startFeet(f: Figure): Foot[] {
  const feet = new Set<Foot>();
  const b = startFoot(f);
  if (b) feet.add(b);
  for (const s of f.syllabus?.variants?.starts ?? []) {
    const ft = footOf(s.desc);
    if (ft) feet.add(ft);
  }
  return [...feet];
}

/** Turn direction from the chart turn texts, then from the name. */
function turnOf(f: Figure, part?: { from: number; to: number }): TurnDir | null {
  const all = f.floor?.steps ?? [];
  const turns = (part ? all.slice(part.from - 1, part.to) : all).map((s) => s.turn).join(" ");
  // "starts to turn L", "1/4 to R", "turn to left"
  const r = /\b(?:to|turn(?:s|ing)?)(?: to)? (?:the )?(?:R|right)\b/i.test(turns);
  const l = /\b(?:to|turn(?:s|ing)?)(?: to)? (?:the )?(?:L|left)\b/i.test(turns);
  if (r && !l) return "R";
  if (l && !r) return "L";
  const name = `${f.en ?? ""} ${f.cs}`.toLowerCase();
  if (/natural|vpravo|\bto r\b|turning r|do p\b|v p\b/.test(name)) return "R";
  if (/reverse|vlevo|\bto l\b|turning l|do l\b|v l\b/.test(name)) return "L";
  const hasTurn = (f.floor?.steps ?? []).some((s) => /\d\s*\/\s*\d/.test(s.turn));
  if (f.floor && !hasTurn) return "none";
  return null;
}

/** Lengths in bars the figure can have (whole figure + allowed parts). */
function barOptions(f: Figure): number[] {
  const syl = f.syllabus;
  if (!syl?.timing) return [];
  const d = getDance(f.dance);
  const steps = parseTiming(syl.timing, d);
  // Allowed parts are scored separately (findFigures), so only the whole figure here.
  const out = [totalBeats(steps) / d.beatsPerBar];
  for (const alt of syl.altTimings) out.push(totalBeats(parseTiming(alt, d)) / d.beatsPerBar);
  return [...new Set(out.map((b) => Math.round(b * 4) / 4))];
}

function stepCounts(f: Figure): number[] {
  const syl = f.syllabus;
  if (!syl?.timing) return [];
  const steps = parseTiming(syl.timing, getDance(f.dance));
  return [steps.length];
}

/** The criteria actually set in a query (to tell "nothing entered yet"). */
export function activeCriteria(q: FinderQuery, prev?: Figure): number {
  return [
    q.startFoot || (prev && finishWeightFoot(prev)),
    q.startDir,
    q.startPos || (prev && positionOf(prev.syllabus?.finish)),
    q.steps.some((s) => s.foot || s.dir),
    q.finishPos,
    q.finishFoot,
    q.bars,
    q.stepCount,
    q.turn,
    q.travel,
    q.startHold,
    q.finishHold,
    q.keywords.trim(),
  ].filter(Boolean).length;
}

/** Allowed parts of a figure (syllabus notes) with a known step range. */
function partsOf(f: Figure, total: number): { from: number; to: number }[] {
  return (f.syllabus?.variants?.parts ?? [])
    .map((p) => ({ from: p.from, to: p.to ?? total }))
    .filter((p) => p.from >= 1 && p.to <= total && p.from <= p.to && !(p.from === 1 && p.to === total));
}

export function findFigures(q: FinderQuery, prev?: Figure): FinderResult[] {
  // Expected start from the previous figure: the other foot, same position.
  const prevFoot = prev ? finishWeightFoot(prev) : null;
  const wantFoot: Foot | "" = q.startFoot || (prevFoot ? (prevFoot === "RF" ? "LF" : "RF") : "");
  const startPosLabel = q.startPos || (prev ? (positionOf(prev.syllabus?.finish) ?? positionOf(prev.syllabus?.start) ?? "") : "");
  const wantStartPos = normPosition(startPosLabel);
  const terms = fold(q.keywords).split(/\s+/).filter(Boolean);

  const results: FinderResult[] = [];
  for (const f of allFigures()) {
    if (f.dance !== q.dance) continue;
    if (q.cls && !isLegal(f, q.cls)) continue;
    // Routines often use only an allowed part of a figure ("steps 1–3"): score the
    // whole figure and every allowed part, keep the best.
    const total = f.syllabus?.timing ? parseTiming(f.syllabus.timing, getDance(f.dance)).length : chartSteps(f).length;
    const options: ({ from: number; to: number } | undefined)[] = [undefined, ...partsOf(f, total)];
    let best: FinderResult | null = null;
    for (const part of options) {
      const r = scoreFigure(f, part, q, { wantFoot, wantStartPos, startPosLabel, terms });
      if (r && (!best || r.score > best.score + 1e-9)) best = r;
    }
    if (best) results.push(best);
  }
  return results.sort((a, b) => b.score - a.score || a.fig.no - b.fig.no);
}

function scoreFigure(
  f: Figure,
  part: { from: number; to: number } | undefined,
  q: FinderQuery,
  ctx: { wantFoot: Foot | ""; wantStartPos: string | null; startPosLabel: string; terms: string[] },
): FinderResult | null {
  const { wantFoot, wantStartPos, startPosLabel, terms } = ctx;
  const chartAll = chartSteps(f);
  const chart = part ? chartAll.slice(part.from - 1, part.to) : chartAll;
    let got = 0;
    let max = 0;
    const reasons: Reason[] = [];
    const add = (weight: number, kind: ReasonKind, key: string, vars?: Record<string, string>) => {
      max += weight;
      got += kind === "match" ? weight : kind === "partial" ? weight / 2 : 0;
      reasons.push({ kind, key, vars });
    };
    if (part) reasons.push({ kind: "match", key: "fr_part", vars: { from: String(part.from), to: String(part.to) } });

    // Start foot
    if (wantFoot) {
      const pf = part && chart[0] ? footOf(chart[0].desc) : null;
      const feet = part ? (pf ? [pf] : []) : startFeet(f);
      if (!feet.length) add(2, "partial", "fr_footUnknown");
      else add(2, feet.includes(wantFoot) ? "match" : "miss", "fr_startFoot", { foot: wantFoot });
    }
    // Start direction (from syllabus start text / first chart step)
    if (q.startDir) {
      const d = part
        ? chart[0] ? dirOf(chart[0].desc) : null
        : (dirOf(f.syllabus?.start ?? "") ?? (chart[0] ? dirOf(chart[0].desc) : null));
      if (!d) add(2, "partial", "fr_dirUnknown");
      else add(2, d === q.startDir ? "match" : "miss", "fr_startDir", { dir: q.startDir });
    }
    // Start position
    if (wantStartPos) {
      const pp = part ? normPosition(chart[0]?.pos) : null;
      const pos = part ? (pp ? [pp] : []) : startPositions(f);
      if (!pos.length) add(1.5, "partial", "fr_posUnknown");
      else add(1.5, pos.includes(wantStartPos) ? "match" : "miss", "fr_startPos", { pos: startPosLabel });
    }
    // Step sequence vs. chart
    const spec = q.steps.filter((s) => s.foot || s.dir);
    if (spec.length) {
      if (!chart.length) {
        // No chart: at least compare the first step with the syllabus start.
        const first = spec[0];
        const sf = startFoot(f);
        const sd = dirOf(f.syllabus?.start ?? "");
        const contradicts = (first.foot && sf && first.foot !== sf) || (first.dir && sd && first.dir !== sd);
        add(3, contradicts ? "miss" : "partial", contradicts ? "fr_firstStepMiss" : "fr_noChart");
      }
      else {
        let ok = 0;
        spec.forEach((s, i) => {
          const c = chart[i];
          if (!c) return;
          const footOk = !s.foot || footOf(c.desc) === s.foot;
          const dirOk = !s.dir || dirOf(c.desc) === s.dir;
          if (footOk && dirOk) ok++;
        });
        const share = ok / spec.length;
        add(3, share === 1 ? "match" : share >= 0.5 ? "partial" : "miss", "fr_steps", {
          ok: String(ok),
          n: String(spec.length),
        });
      }
    }
    // Finish position (basic or allowed variant)
    if (q.finishPos) {
      const want = normPosition(q.finishPos);
      const lastPos = part ? normPosition(chart[chart.length - 1]?.pos) : null;
      const fp = part ? { base: lastPos, variants: [] as string[] } : finishPositions(f);
      if (!fp.base && !fp.variants.length) add(2, "partial", "fr_posUnknown");
      else if (fp.base === want) add(2, "match", "fr_finishPos", { pos: q.finishPos });
      else if (want && fp.variants.includes(want)) add(2, "match", "fr_finishPosVariant", { pos: q.finishPos });
      else add(2, "miss", "fr_finishPos", { pos: q.finishPos });
    }
    // Finish foot
    if (q.finishFoot) {
      const ff = part ? (chart.length ? footOf(chart[chart.length - 1].desc) : null) : finishWeightFoot(f);
      if (!ff) add(1, "partial", "fr_footUnknown");
      else add(1, ff === q.finishFoot ? "match" : "miss", "fr_finishFoot", { foot: q.finishFoot });
    }
    // Length
    if (q.bars) {
      const opts = part ? partBars(f, part) : barOptions(f);
      if (!opts.length) add(1.5, "partial", "fr_lenUnknown");
      else if (opts.some((b) => Math.abs(b - q.bars) < 0.01)) add(1.5, "match", "fr_bars", { n: String(q.bars) });
      else if (opts.some((b) => Math.abs(b - q.bars) <= 0.5)) add(1.5, "partial", "fr_bars", { n: String(q.bars) });
      else add(1.5, "miss", "fr_bars", { n: String(q.bars) });
    }
    if (q.stepCount) {
      const opts = part ? [part.to - part.from + 1] : stepCounts(f);
      if (!opts.length) add(1, "partial", "fr_lenUnknown");
      else add(1, opts.includes(q.stepCount) ? "match" : opts.some((n) => Math.abs(n - q.stepCount) === 1) ? "partial" : "miss", "fr_stepCount", { n: String(q.stepCount) });
    }
    // Turn
    if (q.turn) {
      const tr = turnOf(f, part);
      if (!tr) add(1.5, "partial", "fr_turnUnknown");
      else add(1.5, tr === q.turn ? "match" : "miss", "fr_turn", { dir: q.turn });
    }
    // Travel
    if (q.travel) {
      const tf = travelFactor(f);
      const isSpot = tf === 0;
      add(1, (q.travel === "spot") === isSpot ? "match" : tf === 0.35 ? "partial" : "miss", "fr_travel", { t: q.travel });
    }
    // Holds
    const h = f.syllabus?.holds;
    if (q.startHold) {
      if (!h) add(1.5, "partial", "fr_holdUnknown");
      else if (h.start === q.startHold) add(1.5, "match", "fr_startHold", { hold: q.startHold });
      else if (h.any || h.alts.includes(q.startHold)) add(1.5, "match", "fr_holdVariant", { hold: q.startHold });
      else add(1.5, "miss", "fr_startHold", { hold: q.startHold });
    }
    if (q.finishHold) {
      if (!h) add(1.5, "partial", "fr_holdUnknown");
      else if (h.finish === q.finishHold) add(1.5, "match", "fr_finishHold", { hold: q.finishHold });
      else if (h.any || h.alts.includes(q.finishHold)) add(1.5, "match", "fr_holdVariant", { hold: q.finishHold });
      else add(1.5, "miss", "fr_finishHold", { hold: q.finishHold });
    }
    // Keywords (names, aliases)
    if (terms.length) {
      const hay = fold(searchText(f));
      const hits = terms.filter((t) => hay.includes(t)).length;
      add(2, hits === terms.length ? "match" : hits ? "partial" : "miss", "fr_keywords");
    }

    if (max === 0) return null;
    // (on a tie the whole figure wins: findFigures keeps the first best option)
    return { fig: f, part, score: got / max, reasons };
}

function partBars(f: Figure, part: { from: number; to: number }): number[] {
  const syl = f.syllabus;
  if (!syl?.timing) return [];
  const d = getDance(f.dance);
  const steps = parseTiming(syl.timing, d).slice(part.from - 1, part.to);
  return [Math.round((totalBeats(steps) / d.beatsPerBar) * 4) / 4];
}
