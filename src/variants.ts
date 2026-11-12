// Resolves a routine item (figure + chosen variant) into what the routine needs:
// the steps actually danced, start/finish foot and couple position, and whether
// the chosen part of the figure is allowed by the WDSF Syllabus notes.
import type { Dance, Figure } from "./data";
import {
  finishWeightFoot,
  parseTiming,
  positionOf,
  startFoot,
  stepsToText,
  type Foot,
  type Step,
} from "./timing";

export interface VariantChoice {
  /** Danced part of the figure; omitted = whole figure. to=null means "to the end". */
  part?: { from: number; to: number | null };
  /** Index into syllabus.variants.starts; omitted = basic start. */
  start?: number;
  /** Index into syllabus.variants.finishes; omitted = basic finish. */
  finish?: number;
  /** Under-/overturn within the range the technique allows (degrees, + = more to the left). */
  extraTurn?: number;
  /** Hold keys (glossary.ts); omitted = hold from the syllabus. */
  startHold?: string;
  finishHold?: string;
}

export interface ResolvedItem {
  steps: Step[];
  /** Timing text of the danced steps. */
  timingText: string;
  totalSteps: number;
  /** Effective step range, 1-based inclusive. */
  from: number;
  to: number;
  isPart: boolean;
  /** Part matches one allowed in the syllabus notes (always true for the whole figure). */
  partAllowed: boolean;
  startFoot: Foot | null;
  startPos: string | null;
  finishFoot: Foot | null;
  finishPos: string | null;
  startHold: string | null;
  finishHold: string | null;
  /** Chosen holds are named by the syllabus for this figure (or "any hold" is allowed). */
  holdsAllowed: boolean;
  /** True when foot/position were derived by counting steps (less reliable). */
  estimated: boolean;
}

const other = (f: Foot): Foot => (f === "RF" ? "LF" : "RF");

/** Foot of the n-th step (1-based), assuming feet alternate on every step. */
function footOfStep(first: Foot | null, n: number): Foot | null {
  if (!first) return null;
  return n % 2 === 1 ? first : other(first);
}

/** Position from an alternative start description: "RF fwd in CBMP in Outside Partner Position". */
function positionFromDesc(desc: string): string | null {
  const idx = desc.toLowerCase().lastIndexOf(" in ");
  const tail = idx >= 0 ? desc.slice(idx + 4) : desc.toLowerCase().startsWith("in ") ? desc.slice(3) : null;
  if (!tail) return null;
  return tail.split(/\s+with\s+/i)[0].trim() || null;
}

/**
 * Couple position on a chart step of the WDSF book. A cell like "Closed Position
 * to Promenade Position" or "Close Opp then Open Opp" changes during the step:
 * `at` picks the position at its start or end.
 */
export function bookPosition(fig: Figure, step: number, at: "start" | "end"): string | null {
  const pos = fig.floor?.source === "wdsf" ? fig.floor.steps[step - 1]?.pos : undefined;
  if (!pos || /depend/i.test(pos)) return null;
  const parts = pos.split(/\s+(?:to|then)\s+(?=[A-Z])/);
  const p = (at === "start" ? parts[0] : parts[parts.length - 1]).replace(/\s+at\b.*$/i, "").trim();
  return p || null;
}

/** Foot that takes a chart step of the WDSF book (the weight ends on it). */
function bookFoot(fig: Figure, step: number): Foot | null {
  const st = fig.floor?.source === "wdsf" ? fig.floor.steps[step - 1] : undefined;
  if (!st || /w\/o weight|without weight/i.test(st.desc)) return null;
  const m = st.desc.match(/\b(RF|LF)\b/);
  return m ? (m[1] as Foot) : null;
}

export function resolveItem(fig: Figure, dance: Dance, timing: string, choice: VariantChoice = {}): ResolvedItem {
  const all = timing ? parseTiming(timing, dance) : [];
  const total = all.length;
  const syl = fig.syllabus;
  const variants = syl?.variants ?? {};

  // --- which steps are danced ---
  let from = 1;
  let to = total;
  if (choice.part) {
    from = Math.max(1, choice.part.from);
    to = choice.part.to === null ? total : Math.min(total, choice.part.to);
  }
  // A timing shorter than the figure (e.g. an alternative timing that applies
  // only to the part) is used as-is instead of being sliced again.
  const sliceable = choice.part && total >= (choice.part.to ?? choice.part.from);
  const steps = sliceable ? all.slice(from - 1, to) : all;
  const isPart = !!choice.part && (from > 1 || to < total);
  const partAllowed =
    !choice.part ||
    !isPart ||
    (variants.parts ?? []).some((p) => p.from === choice.part!.from && p.to === choice.part!.to);

  // --- start ---
  const baseStartFoot = startFoot(fig);
  let sFoot = baseStartFoot;
  let sPos = positionOf(syl?.start);
  let estimated = false;
  if (from > 1) {
    sFoot = bookFoot(fig, from) ?? footOfStep(baseStartFoot, from);
    sPos = bookPosition(fig, from, "start") ?? sPos;
    estimated = !bookFoot(fig, from) || !bookPosition(fig, from, "start");
  } else if (!sPos) {
    sPos = bookPosition(fig, 1, "start");
  }
  const startAlt = choice.start !== undefined ? variants.starts?.[choice.start] : undefined;
  if (startAlt) {
    const m = startAlt.desc.match(/\b(RF|LF)\b/);
    if (m) sFoot = m[1] as Foot;
    sPos = positionFromDesc(startAlt.desc) ?? sPos;
  }

  // --- finish ---
  let fFoot = finishWeightFoot(fig);
  // Many standard finishes ("LF closes to RF") omit the position: the couple
  // stays in the position the figure started in.
  let fPos = positionOf(syl?.finish) ?? positionOf(syl?.start);
  if (isPart && to < total) {
    fFoot = bookFoot(fig, to) ?? footOfStep(baseStartFoot, to);
    fPos = bookPosition(fig, to, "end") ?? fPos;
    estimated = estimated || !bookFoot(fig, to) || !bookPosition(fig, to, "end");
  } else if (!positionOf(syl?.finish)) {
    // The syllabus finish often names no position: the book's last step does.
    fPos = bookPosition(fig, total, "end") ?? fPos;
  }
  const finishAlt = choice.finish !== undefined ? variants.finishes?.[choice.finish] : undefined;
  if (finishAlt) fPos = finishAlt.position;

  // --- holds ---
  const h = syl?.holds;
  const startHold = choice.startHold ?? h?.start ?? null;
  // If the hold doesn't change during the figure, a changed start hold carries through.
  const finishHold =
    choice.finishHold ?? (choice.startHold && h?.start === h?.finish ? choice.startHold : (h?.finish ?? null));
  const holdOk = (k: string | null) =>
    !k || !h || h.any || k === h.start || k === h.finish || h.alts.includes(k);
  const holdsAllowed = holdOk(choice.startHold ?? null) && holdOk(choice.finishHold ?? null);

  return {
    steps,
    timingText: stepsToText(steps),
    startHold,
    finishHold,
    holdsAllowed,
    totalSteps: total,
    from,
    to,
    isPart,
    partAllowed,
    startFoot: sFoot,
    startPos: sPos,
    finishFoot: fFoot,
    finishPos: fPos,
    estimated,
  };
}

// --- Couple position comparison ---------------------------------------------

/** Normalise a position name so "PP", "Prom Pos" and "Promenade Position" compare equal. */
export function normPosition(p: string | null | undefined): string | null {
  if (!p) return null;
  let s = p.toLowerCase().split(/[;]|\bwith\b/)[0];
  s = s
    .replace(/\bprom\.?\s*pos\.?/g, "promenade position")
    .replace(/\bp\.?p\.?\b/g, "promenade position")
    .replace(/\bopp(osing|osition)?\.?/g, "opp")
    .replace(/\bpos(ition)?\.?/g, "")
    .replace(/\bclose\b(?! opp)/g, "closed")
    .replace(/[^a-z ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  // Outside Partner and Wing are danced in the closed hold: treat as compatible.
  if (/^(closed|outside partner|op|wing|cbmp)/.test(s)) return "closed";
  return s;
}

export interface Connection {
  footOk: boolean | null;
  posOk: boolean | null;
  prevFoot: Foot | null;
  nextFoot: Foot | null;
  prevPos: string | null;
  nextPos: string | null;
  holdOk: boolean | null;
  prevHold: string | null;
  nextHold: string | null;
  /** Index of a finish variant of the previous figure that would match the next start. */
  fixPrevFinish?: number;
  /** Index of a start variant of the next figure that would match the previous finish. */
  fixNextStart?: number;
}

export function connect(prevFig: Figure, prev: ResolvedItem, nextFig: Figure, next: ResolvedItem): Connection {
  const footOk = prev.finishFoot && next.startFoot ? prev.finishFoot !== next.startFoot : null;
  const a = normPosition(prev.finishPos);
  const b = normPosition(next.startPos);
  const posOk = a && b ? a === b : null;
  const holdOk = prev.finishHold && next.startHold ? prev.finishHold === next.startHold : null;
  const res: Connection = {
    holdOk,
    prevHold: prev.finishHold,
    nextHold: next.startHold,
    footOk,
    posOk,
    prevFoot: prev.finishFoot,
    nextFoot: next.startFoot,
    prevPos: prev.finishPos,
    nextPos: next.startPos,
  };
  if (posOk === false) {
    const fin = prevFig.syllabus?.variants?.finishes ?? [];
    const i = fin.findIndex((f) => normPosition(f.position) === b);
    if (i >= 0) res.fixPrevFinish = i;
    const st = nextFig.syllabus?.variants?.starts ?? [];
    const j = st.findIndex((s) => normPosition(positionFromDesc(s.desc)) === a);
    if (j >= 0) res.fixNextStart = j;
  }
  return res;
}

/** Human label of a part: "1–3" or "2–konec". */
export function partLabel(from: number, to: number | null, endWord: string): string {
  return `${from}–${to === null ? endWord : to}`;
}
