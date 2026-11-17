// Floor plan of a routine, computed once in the routine editor and shared by
// the figure list (which wall a figure is on, its resolved alignment) and the
// FloorPlan drawing.
import { figureNames, type Dance, type Figure, type Lang } from "./data";
import {
  chartSteps,
  hasFloor,
  relativeFacing,
  simulateRoutine,
  travelFactor,
  turnHintOf,
  turnOptions,
  type FloorStep,
  type RoomSize,
  type SimItem,
  type SimResult,
  type StartSpot,
} from "./floor";
import { positionOf, tempoBpm, totalBeats } from "./timing";
import { normPosition, type ResolvedItem } from "./variants";
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
  /** No automatic corner before this figure. */
  noCorner?: boolean;
  /** Couple position chosen by the user at the start / end of the figure (syllabus
   * alternative or own), and the start alternative's first step ("RF fwd in CBMP in OP"). */
  positions?: { start?: string; finish?: string; startDesc?: string };
}

const SPLIT = /\s+(?:to|then)\s+(?=[A-Za-z])/;

/**
 * The figure's steps danced from / into another couple position than the chart's:
 * the chart's first position (as long as it lasts) becomes the chosen start position,
 * its last one the chosen finish position. The player and the plan place the lady by
 * these positions.
 */
export function withPositions(steps: FloorStep[], pos: PlanInput["positions"], lady = false): FloorStep[] {
  if (!pos || !steps.length || (!pos.start && !pos.finish)) return steps;
  const out = steps.map((st) => ({ ...st }));
  // The lady walks forward beside him in promenade but backward when facing him: when
  // the chosen position changes that, her steps in the changed part change direction.
  const flips = (from: string, to: string) => {
    const a = relativeFacing(from);
    const b = relativeFacing(to);
    return lady && a !== null && b !== null && Math.abs(Math.abs(a - b) - 90) < 1 && (Math.abs(a) === 180 || Math.abs(b) === 180);
  };
  const flipDir = (st: FloorStep) => {
    st.desc = st.desc
      .replace(/\b(fwd|forward|bwd|back)\b/gi, (w) => (/^f/i.test(w) ? "bwd" : "fwd"))
      .replace(/\s+and across(?: body)?/i, "")
      .replace(/\bin PP\b/i, "");
    st.face = undefined;
    st.align = "";
  };
  const same = (a?: string, b?: string) => !!a && !!b && normPosition(a) === normPosition(b);
  if (pos.start) {
    const first = (out[0].pos ?? "").split(SPLIT)[0];
    const flip = flips(first, pos.start);
    if (!first) out[0].pos = pos.start;
    else
      for (const st of out) {
        const parts = (st.pos ?? "").split(SPLIT);
        if (!same(parts[0], first)) break;
        if (flip) flipDir(st);
        if (parts.length > 1) {
          st.pos = [pos.start, ...parts.slice(1)].join(" then ");
          break;
        }
        st.pos = pos.start;
      }
    const sd = pos.startDesc;
    const foot = (d: string) => d.match(/\b(RF|LF)\b/)?.[1];
    if (sd && foot(sd) && foot(sd) === foot(out[0].desc)) out[0].desc = sd;
  }
  if (pos.finish) {
    const lastParts = (out[out.length - 1].pos ?? "").split(SPLIT);
    const last = lastParts[lastParts.length - 1];
    const flip = flips(last, pos.finish);
    if (!last) out[out.length - 1].pos = pos.finish;
    else
      for (let i = out.length - 1; i >= 0; i--) {
        const parts = (out[i].pos ?? "").split(SPLIT);
        if (!same(parts[parts.length - 1], last)) break;
        if (flip && parts.length === 1) flipDir(out[i]);
        if (parts.length > 1) {
          out[i].pos = [...parts.slice(0, -1), pos.finish].join(" then ");
          break;
        }
        out[i].pos = pos.finish;
      }
  }
  return out;
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
    const cut = <T,>(a: T[]) => a.slice(it.resolved.from - 1, it.resolved.isPart ? it.resolved.to : undefined);
    const all = withPositions(cut(chartSteps(it.fig)), it.positions);
    const steps = hasFloor(it.fig) || it.fig.floor?.follows ? all : null;
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
        ? withPositions(it.fig.floor.ladySteps.slice(it.resolved.from - 1, it.resolved.isPart ? it.resolved.to : undefined), { ...it.positions, startDesc: undefined }, true)
        : null,
      wall: it.wall,
      noCorner: it.noCorner,
      startPos: it.positions?.start ?? (it.resolved.from <= 1 ? (positionOf(it.fig.syllabus?.start) ?? undefined) : undefined),
      counts: it.resolved.steps.map((st) => ({ label: st.label, beats: st.beats })),
      animSteps: all.length ? all : undefined,
      animLady: it.fig.floor?.ladySteps?.length ? withPositions(cut(it.fig.floor.ladySteps), { ...it.positions, startDesc: undefined }, true) : null,
      latin: dance.discipline === "latin",
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
      all.push({ ...it, wall: undefined, noCorner: undefined, key: `${it.key}#${r}`, label: `${it.label} (${r + 1}.×)` });
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
      counts: prep.steps.map((_, i) => ({ label: String(i + 1), beats: 1 })),
      latin: dance.discipline === "latin",
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
