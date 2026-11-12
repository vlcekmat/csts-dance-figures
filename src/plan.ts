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
  type RoomSize,
  type SimItem,
  type SimResult,
  type StartSpot,
} from "./floor";
import { tempoBpm, totalBeats } from "./timing";
import type { ResolvedItem } from "./variants";

export interface PlanInput {
  key: string;
  fig: Figure;
  resolved: ResolvedItem;
  corner: boolean;
  extraTurn?: number;
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
  return { ...simulateRoutine(all, room, start), nums, baseLen: items.length || 1 };
}
