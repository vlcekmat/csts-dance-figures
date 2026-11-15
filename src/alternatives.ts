// Alternatives of a figure: other ways of dancing it allowed by the WDSF
// Syllabus notes ("Steps 3-5 may be replaced by …", "Guapacha timing may be
// used", "May end in Open Opp. …"). Hand-checked ones ("exact") carry the
// changed steps for the man and the lady, so the chart, the player, the floor
// plan and the connection checks follow the alternative; the others describe
// the option (the steps shown stay the basic ones).
import type { Figure, Lang } from "./data";
import type { FloorStep } from "./floor";
import { localizePositions, localizeStep } from "./glossary";

/** Change of the step chart: one step changed, or steps a..b replaced. */
export type StepPatch =
  | ({ set: number } & Partial<FloorStep>)
  | { replace: [number, number]; steps: (Partial<FloorStep> & { desc: string })[] };

export interface FigureAlt {
  id: string;
  kind: "exact" | "guapacha" | "footChange" | "replace" | "swap" | "omit" | "repeat" | "position" | "timing" | "noHold" | "other";
  /** Syllabus sentence(s) the option comes from (English original). */
  text?: string;
  topic?: string;
  /** Who dances differently. */
  who?: "man" | "lady" | "both";
  /** Steps concerned (1-based, inclusive). */
  steps?: [number, number];
  /** The part of the figure that is replaced ("swap"), syllabus wording. */
  what?: string;
  /** What replaces the steps (syllabus wording, English). */
  by?: string;
  /** Couple position the option is danced in. */
  position?: string;
  // --- hand-checked alternatives ---
  cs?: string;
  en?: string;
  noteCs?: string;
  noteEn?: string;
  /** Timing of the whole figure when it changes (e.g. more steps). */
  timing?: string;
  /** Finish position (English term). */
  finish?: string;
  man?: StepPatch[];
  lady?: StepPatch[];
}

/** Steps (1-based) of the original chart a patch list touches. */
function touched(patches: StepPatch[] | undefined): Set<number> {
  const out = new Set<number>();
  for (const p of patches ?? []) {
    if ("set" in p) out.add(p.set);
    else for (let k = p.replace[0]; k <= p.replace[1]; k++) out.add(k);
  }
  return out;
}

/** Alternatives that can't be danced together (they change the same steps or the timing). */
export function altConflicts(a: FigureAlt, b: FigureAlt): boolean {
  if (a.id === b.id) return false;
  if (a.kind !== "exact" || b.kind !== "exact") return false;
  if (a.timing && b.timing) return true;
  for (const role of ["man", "lady"] as const) {
    const x = touched(a[role]);
    for (const k of touched(b[role])) if (x.has(k)) return true;
  }
  return false;
}

/** The chart with the patches applied (original numbering; replacements last, from the end). */
function patchSteps(steps: FloorStep[], patches: StepPatch[] | undefined): FloorStep[] {
  if (!patches?.length) return steps;
  const out = steps.map((s) => ({ ...s }));
  for (const p of patches) {
    if (!("set" in p)) continue;
    const { set, ...fields } = p;
    if (out[set - 1]) out[set - 1] = { ...out[set - 1], ...fields };
  }
  const reps = patches.filter((p): p is Extract<StepPatch, { replace: [number, number] }> => "replace" in p);
  reps.sort((a, b) => b.replace[0] - a.replace[0]);
  for (const p of reps) {
    const [a, b] = p.replace;
    const news: FloorStep[] = p.steps.map((s) => ({ align: "", turn: "", ...s }));
    out.splice(a - 1, b - a + 1, ...news);
  }
  return out;
}

/** Replace the position in "RF to side (Fan L Angle; LH to RH)". */
function withPosition(text: string, pos: string): string {
  return /\(([^;)]*)/.test(text) ? text.replace(/\(([^;)]*)/, `(${pos}`) : `${text} (${pos})`;
}

const cache = new WeakMap<Figure, Map<string, Figure>>();

/** The figure as danced with the chosen alternatives (the same object without any). */
export function applyAlternatives(fig: Figure, ids: string[] | undefined): Figure {
  const alts = (fig.alternatives ?? []).filter((a) => ids?.includes(a.id) && a.kind === "exact");
  if (!alts.length) return fig;
  const key = alts.map((a) => a.id).join("|");
  let byKey = cache.get(fig);
  if (!byKey) cache.set(fig, (byKey = new Map()));
  const hit = byKey.get(key);
  if (hit) return hit;
  let steps = fig.floor?.steps ?? [];
  let lady = fig.floor?.ladySteps ?? null;
  let syl = fig.syllabus;
  for (const a of alts) {
    steps = patchSteps(steps, a.man);
    if (lady) lady = patchSteps(lady, a.lady);
    if (syl && a.timing) syl = { ...syl, timing: a.timing, altTimings: [] };
    if (syl && a.finish) syl = { ...syl, finish: withPosition(syl.finish, a.finish), finishCs: withPosition(syl.finishCs, a.finish) };
  }
  const out: Figure = {
    ...fig,
    syllabus: syl,
    floor: fig.floor ? { ...fig.floor, steps, ladySteps: lady ?? undefined } : fig.floor,
  };
  byKey.set(key, out);
  return out;
}

/** Changes the steps (hand-checked alternative with a chart). */
export const altChangesSteps = (a: FigureAlt) => a.kind === "exact" && !!(a.man?.length || a.lady?.length || a.timing);

/** Short name of an alternative in the user's language. */
export function altLabel(a: FigureAlt, lang: Lang, tr: (key: string, vars?: Record<string, string>) => string): string {
  const steps = a.steps ? (a.steps[0] === a.steps[1] ? `${a.steps[0]}` : `${a.steps[0]}–${a.steps[1]}`) : "";
  const whoWord = a.who === "man" ? tr("altWhoMan") : a.who === "lady" ? tr("altWhoLady") : "";
  // "a Cha Cha Lockstep fwd (Man) and …" -> "Cha Cha Lockstep fwd"
  const by = (a.by ?? "")
    .replace(/^(?:an?|the)\s+/i, "")
    .split(/\s*\(|\s+and\s+steps?\b|,\s|\s+depending\b|\s+having\b|\s+to end\b|\s+in which\b/i)[0]
    .trim();
  switch (a.kind) {
    case "exact":
      return (lang === "cs" ? a.cs : a.en) ?? a.id;
    case "guapacha":
      return tr("altGuapacha");
    case "footChange":
      return tr("altFootChange");
    case "replace":
      return tr(steps.includes("–") ? "altReplaceSteps" : "altReplaceStep", { steps, by: localizeStep(by, lang) }) + (whoWord ? ` (${whoWord})` : "");
    case "swap":
      return tr("altSwap", { what: localizeStep(a.what ?? "", lang), by: localizeStep(by, lang) }) + (whoWord ? ` (${whoWord})` : "");
    case "omit":
      return tr("altOmit", { steps });
    case "repeat":
      return tr("altRepeat", { steps });
    case "position":
      return tr("altPosition", { pos: localizePositions(a.position ?? "", lang) });
    case "timing":
      return tr("altTiming") + (whoWord ? ` (${whoWord})` : "");
    case "noHold":
      return tr("altNoHold");
    default:
      return whoWord ? tr("altOtherWho", { who: whoWord }) : tr("altOther");
  }
}
