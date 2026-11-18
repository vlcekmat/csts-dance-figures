// A variant of a figure for the player: another timing from the syllabus, only a part
// of the figure ("Steps 1-3 only"), another start / finish position. Built the same way
// as a routine item (resolveItem + withPositions), so it plays like it would in a routine.
import { getDance, type Figure } from "./data";
import { chartSteps } from "./floor";
import { withPositions } from "./plan";
import { resolveItem, type VariantChoice } from "./variants";

export interface PlayerChoice {
  /** Alternative timing (text from syllabus.altTimings). */
  timing?: string;
  /** Index into syllabus.variants.parts. */
  part?: number;
  /** Index into syllabus.variants.starts / finishes. */
  start?: number;
  finish?: number;
}

export const hasChoice = (c: PlayerChoice) => c.timing !== undefined || c.part !== undefined || c.start !== undefined || c.finish !== undefined;

export function variantFigure(fig: Figure, c: PlayerChoice): Figure {
  const syl = fig.syllabus;
  if (!hasChoice(c) || !syl || !fig.floor) return fig;
  const dance = getDance(fig.dance);
  const timing = c.timing ?? syl.timing;
  const p = c.part !== undefined ? syl.variants?.parts?.[c.part] : undefined;
  const choice: VariantChoice = { part: p ? { from: p.from, to: p.to } : undefined, start: c.start, finish: c.finish };
  const r = resolveItem(fig, dance, timing, choice);
  const startAlt = c.start !== undefined ? syl.variants?.starts?.[c.start] : undefined;
  const start = startAlt ? (r.startPos ?? undefined) : undefined;
  const finish = c.finish !== undefined ? (r.finishPos ?? undefined) : undefined;
  const pos = start || finish ? { start, finish, startDesc: startAlt?.desc } : undefined;
  const cut = <T,>(a: T[]) => a.slice(r.from - 1, r.isPart ? r.to : undefined);
  const withTiming: Figure = { ...fig, syllabus: { ...syl, timing } };
  const steps = withPositions(cut(chartSteps(withTiming)), pos);
  const lady = fig.floor.ladySteps?.length ? withPositions(cut(fig.floor.ladySteps), pos ? { ...pos, startDesc: undefined } : undefined, true) : undefined;
  // the timing of the danced steps; their own counts from the chart follow it
  const counts = r.steps.map((s) => s.label);
  return {
    ...fig,
    syllabus: {
      ...syl,
      timing: r.timingText || timing,
      // the player starts from the position before the first danced step
      start: r.startPos ? `${syl.start.replace(/\s*\([^)]*\)\s*$/, "")} (${r.startPos})` : syl.start,
    },
    floor: {
      ...fig.floor,
      steps: c.timing !== undefined ? steps.map((st, i) => ({ ...st, timing: counts[i] ?? st.timing })) : steps,
      ...(lady ? { ladySteps: c.timing !== undefined ? lady.map((st, i) => ({ ...st, timing: counts[i] ?? st.timing })) : lady } : {}),
    },
  };
}
