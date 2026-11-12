// Floor plan of a routine, computed once in the routine editor and shared by
// the figure list (which wall a figure is on, its resolved alignment) and the
// FloorPlan drawing.
import { figureNames, type Dance, type Figure, type Lang } from "./data";
import {
  chartSteps,
  hasFloor,
  simulateRoutine,
  travelFactor,
  turnHintOf,
  turnOptions,
  type RoomSize,
  type SimItem,
  type SimResult,
  type StartSpot,
} from "./floor";
import { tempoBpm, totalBeats } from "./timing";
import type { ResolvedItem } from "./variants";
import type { PrepDir, PrepStep } from "./routines";

export interface PlanInput {
  key: string;
  fig: Figure;
  resolved: ResolvedItem;
  corner: boolean;
  extraTurn?: number;
  startTurn?: number;
  stepScales?: number[];
  wall?: number;
}

export interface Plan extends SimResult {
  /** Figure number (1-based, in the routine) of every simulated segment. */
  nums: number[];
  /** Number of figures in one pass of the routine. */
  baseLen: number;
}

/** Typical length of a competition round (ČSTS/WDSF: 1:30–2:00). */
export const ROUND_SECONDS = 90;

export function buildPlan(opts: {
  dance: Dance;
  lang: Lang;
  items: PlanInput[];
  room: RoomSize;
  start: StartSpot;
  stepCm: number;
  /** Repetitions: a count, or "round" = fill a competition round. */
  reps: number | "round";
  loopTo: number;
  /** The routine is danced repeatedly (connect its end to the loop target). */
  loop?: boolean;
  /** Preparatory step before the first figure; `face` = the man's facing (relative to LOD). */
  /** Preparatory steps; `face` = man's facing at the start of the first figure. */
  prep?: { steps: PrepStep[]; face: number; label: string };
}): Plan {
  const { dance, lang, items, room, start, stepCm, reps, loopTo } = opts;
  const bpm = tempoBpm(dance) ?? 30;
  const simItems: SimItem[] = items.map((it) => {
    const bars = totalBeats(it.resolved.steps) / dance.beatsPerBar || 1;
    // Only charts with alignments (standard) are precise enough to trace;
    // latin charts give no alignment, so those figures use the travel class.
    // Charts that "follow the previous figure" have no alignments but are traced too.
    const steps = hasFloor(it.fig) || it.fig.floor?.follows
      ? chartSteps(it.fig).slice(it.resolved.from - 1, it.resolved.isPart ? it.resolved.to : undefined)
      : null;
    return {
      key: it.key,
      label: figureNames(it.fig, lang).main,
      dance: dance.id,
      steps,
      bars,
      seconds: (bars * 60) / bpm,
      cornerAfter: it.corner,
      turnHint: turnHintOf(it.fig.en),
      travel: travelFactor(it.fig),
      stepMetres: stepCm / 100,
      extraTurn: it.extraTurn,
      follows: !!it.fig.floor?.follows,
      startTurn: it.startTurn,
      stepScales: it.stepScales,
      // the user didn't choose an amount of turn: let the plan pick an allowed one
      autoTurnOptions:
        it.extraTurn === undefined && it.fig.floor?.turnRange ? turnOptions(it.fig.floor.turnRange) : undefined,
      ladySteps: steps && it.fig.floor?.ladySteps
        ? it.fig.floor.ladySteps.slice(it.resolved.from - 1, it.resolved.isPart ? it.resolved.to : undefined)
        : null,
      wall: it.wall,
    };
  });

  // Repetitions: the first pass is the whole routine, every further pass
  // starts again at the loop target figure.
  const from = Math.min(Math.max(loopTo, 0), Math.max(simItems.length - 1, 0));
  const loopPart = simItems.slice(from);
  const once = simItems.reduce((sum, it) => sum + it.seconds, 0) || 1;
  const partSec = loopPart.reduce((sum, it) => sum + it.seconds, 0) || 1;
  const count = reps === "round" ? 1 + Math.max(0, Math.ceil((ROUND_SECONDS - once) / partSec)) : reps;
  const all: SimItem[] = [];
  const nums: number[] = [];
  simItems.forEach((it, i) => {
    all.push({ ...it, key: `${it.key}#0`, label: count > 1 ? `${it.label} (1.×)` : it.label });
    nums.push(i + 1);
  });
  for (let r = 1; r < count; r++)
    loopPart.forEach((it, i) => {
      // Manual walls only apply to the first pass; repetitions follow the floor.
      all.push({ ...it, wall: undefined, key: `${it.key}#${r}`, label: `${it.label} (${r + 1}.×)` });
      nums.push(from + i + 1);
    });
  // Preparatory step: danced once before the first figure (number 0 = "P" in the plan).
  let wrap = opts.loop ? from : undefined;
  const prep = opts.prep && opts.prep.steps.length ? opts.prep : undefined;
  if (prep) {
    // One beat per step; each travels like a figure's step (direction relative to the facing).
    const DESC: Record<PrepDir, string> = {
      fwd: "fwd", bwd: "bwd", side: "to side", "fwd-side": "fwd and side", "bwd-side": "bwd and side", place: "in place",
    };
    const n = prep.steps.length;
    all.unshift({
      key: "prep#0",
      label: prep.label,
      dance: dance.id,
      steps: prep.steps.map((s) => ({ desc: `${s.foot} ${DESC[s.dir]}`, align: "", turn: "", face: prep.face + (s.turn ?? 0) })),
      stepScales: prep.steps.map((s) => s.size ?? 1),
      bars: n / dance.beatsPerBar,
      seconds: (60 / bpm / dance.beatsPerBar) * n,
      cornerAfter: false,
      stepMetres: stepCm / 100,
    });
    nums.unshift(0);
    if (wrap !== undefined) wrap += 1;
  }
  // A repeated routine: its (last) end connects to the loop target figure.
  return {
    ...simulateRoutine(all, room, start, wrap),
    nums,
    baseLen: (items.length || 1) + (prep ? 1 : 0),
  };
}
