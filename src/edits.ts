// Hand edits of step charts made by the owner in the figure editor (dev server only).
// Stored in src/data/edits.json (committed, public): only the facts the owner typed
// (foot + direction, counts, alignments, angles, turns, positions) – never book wording.
//
// A role edit is the final list of steps. Each entry either keeps a step of the
// underlying chart (`from` = its index) with some fields changed (`set`) or removed
// (`unset`), or is a new step (no `from`, `set` = the whole step). Steps of the chart
// that are not listed are deleted. Patching by field keeps the edit small and lets it
// work on both the public chart and the richer local one.
import type { FloorData, FloorStep } from "./floor";

/** Fields the editor can change. */
export const EDIT_FIELDS = ["desc", "timing", "align", "face", "end", "body", "moving", "rot", "turn", "span", "pos"] as const;
export type EditField = (typeof EDIT_FIELDS)[number];
export const NUMERIC_FIELDS: ReadonlySet<EditField> = new Set(["face", "end", "body", "moving", "rot", "span"]);

export type StepPatch = Partial<Pick<FloorStep, EditField>>;

export interface StepRef {
  from?: number;
  set?: StepPatch;
  unset?: EditField[];
}

export interface RoleEdit {
  /** Number of steps of the chart the edit was made against (detects a changed chart). */
  baseLen: number;
  steps: StepRef[];
}

export interface FigureEdit {
  man?: RoleEdit;
  lady?: RoleEdit;
  /** Own timing of the whole figure (replaces the syllabus timing in the player and plan). */
  timing?: string;
  /** Owner's note what was fixed. */
  note?: string;
  updated?: string;
}

export type EditsFile = Record<string, FigureEdit>;

/** A step in the editor, remembering which chart step it came from. */
export interface EditRow {
  from?: number;
  step: FloorStep;
}

const pick = (s: Partial<FloorStep>): StepPatch => {
  const out: Record<string, unknown> = {};
  for (const k of EDIT_FIELDS) if (s[k] !== undefined) out[k] = s[k];
  return out as StepPatch;
};

/** Rows of a role: the chart with the edit applied (or the chart as it is). */
export function expandRole(base: FloorStep[], edit: RoleEdit | undefined): EditRow[] {
  if (!edit) return base.map((step, i) => ({ from: i, step }));
  const rows: EditRow[] = [];
  for (const ref of edit.steps) {
    if (ref.from !== undefined) {
      const orig = base[ref.from];
      if (!orig) continue; // the chart got shorter
      const step: FloorStep = { ...orig, ...(ref.set ?? {}) };
      for (const k of ref.unset ?? []) delete (step as Partial<FloorStep>)[k];
      // The book's wording of the alignment no longer matches a changed alignment.
      if (ref.set && ("align" in ref.set || "face" in ref.set)) delete step.alignText;
      rows.push({ from: ref.from, step });
    } else {
      rows.push({ step: { desc: "", align: "", turn: "", ...(ref.set ?? {}) } });
    }
  }
  return rows;
}

const same = (a: unknown, b: unknown) => a === b || (a === undefined && b === "") || (a === "" && b === undefined);

/** Smallest role edit turning `base` into `rows`, or undefined when nothing changed. */
export function diffRole(base: FloorStep[], rows: EditRow[]): RoleEdit | undefined {
  const steps: StepRef[] = rows.map(({ from, step }) => {
    if (from === undefined || !base[from]) return { set: pick(step) };
    const orig = base[from];
    const set: Record<string, unknown> = {};
    const unset: EditField[] = [];
    for (const k of EDIT_FIELDS) {
      if (same(orig[k], step[k])) continue;
      if (step[k] === undefined || step[k] === "") {
        if (NUMERIC_FIELDS.has(k) || k === "timing" || k === "pos") unset.push(k);
        else set[k] = "";
      } else set[k] = step[k];
    }
    const ref: StepRef = { from };
    if (Object.keys(set).length) ref.set = set as StepPatch;
    if (unset.length) ref.unset = unset;
    return ref;
  });
  const untouched = steps.length === base.length && steps.every((r, i) => r.from === i && !r.set && !r.unset);
  return untouched ? undefined : { baseLen: base.length, steps };
}

/** The chart with the owner's edit applied. */
export function applyEdit(floor: FloorData | undefined, title: string, edit: FigureEdit): FloorData | undefined {
  if (!edit.man && !edit.lady) return floor;
  const base: FloorData = floor ?? { title, url: "", source: "checked", steps: [], preceding: [], following: [] };
  const out: FloorData = { ...base };
  if (edit.man) out.steps = expandRole(base.steps, edit.man).map((r) => r.step);
  if (edit.lady) {
    const lady = expandRole(base.ladySteps ?? [], edit.lady).map((r) => r.step);
    if (lady.length) out.ladySteps = lady;
    else delete out.ladySteps;
  }
  return out;
}
