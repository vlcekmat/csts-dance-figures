// Typed access to the generated figure database (src/data/figures.json).
import raw from "./data/figures.json";
import type { FloorData } from "./floor";
import type { FigureAlt } from "./alternatives";
import editsRaw from "./data/edits.json";
import { applyEdit, type EditsFile, type FigureEdit } from "./edits";
import { cleanPosition } from "./positions";

export type Lang = "cs" | "en";
export type ClassId = "E" | "D" | "C" | "B";

export interface Remark {
  cs: string;
  en: string;
}

export interface Dance {
  id: string;
  abbr: string;
  discipline: "standard" | "latin" | "other";
  cs: string;
  en: string;
  meter: string;
  beatsPerBar: number;
  /** Tempo in bars per minute, e.g. "28–30" (empty when unknown). */
  tempo: string;
  /** Beat value of the timing symbols for this dance. */
  units: { digit: number; S: number; Q: number };
  remarks?: Remark[];
}

export interface SyllabusNote {
  topic: string;
  text: string;
}

/** A part of a figure allowed by the notes ("Steps 1-3 or 4-6 only may be used"). */
export interface PartOption {
  from: number;
  /** null = up to the last step ("May start from step 2"). */
  to: number | null;
  text: string;
}

/** Alternative start, e.g. "RF fwd in CBMP in Outside Partner Position". */
export interface StartOption {
  desc: string;
  descCs: string;
  text: string;
}

/** Alternative finish position, e.g. "Promenade Position". */
export interface FinishOption {
  position: string;
  text: string;
}

export interface Variants {
  parts?: PartOption[];
  starts?: StartOption[];
  finishes?: FinishOption[];
}

/** Holds from the syllabus (latin dances), as canonical keys (see glossary.ts). */
export interface HoldData {
  start?: string;
  finish?: string;
  /** Holds mentioned in the notes. */
  alts: string[];
  /** Notes allow "any appropriate hold". */
  any?: boolean;
}

export interface SyllabusInfo {
  section: string;
  title: string;
  start: string;
  finish: string;
  startCs: string;
  finishCs: string;
  timing: string;
  altTimings: string[];
  notes: SyllabusNote[];
  variants?: Variants;
  holds?: HoldData;
  seeAlso?: string;
}

export interface Video {
  id: string;
  title: string;
  channel: string;
  length: string;
  query: string;
}

export interface Figure {
  id: string;
  dance: string;
  no: number;
  en: string | null;
  cs: string;
  classes: string[];
  wdsfRef: string | null;
  plamRef: string | null;
  polkaRef?: string;
  noteCs?: string;
  noteEn?: string;
  syllabus?: SyllabusInfo;
  videos?: Video[];
  /** Step chart: WDSF technique book (local only) or dancecentral.info (ISTD based). */
  floor?: FloorData;
  /** Other ways of dancing the figure (syllabus notes; hand-checked ones with steps). */
  alternatives?: FigureAlt[];
  /** Other common names (WDSF brackets, ISTD names, Czech training slang). */
  aliases?: { en?: string[]; cs?: string[] };
  /** User-defined figure (not in the ČSTS catalog). */
  custom?: boolean;
  /** Custom figures: 0 on the spot … 1 travelling. */
  customTravel?: number;
  customNote?: string;
  customVideo?: string;
}

interface Database {
  sources: { catalog: string; syllabus: string };
  dances: Dance[];
  figures: Figure[];
}

const db = raw as unknown as Database;

export const SOURCES = db.sources;
export const DANCES: Dance[] = db.dances;
// Step charts from the WDSF technique books are copyrighted: they are generated
// into a local, git-ignored file and only used when it exists (local builds).
// The public site works with the WDSF Syllabus and dancecentral.info charts.
// (import.meta.glob exists under Vite; scripts bundled for Node audit the public data.)
const bookCharts = Object.values(
  typeof import.meta.glob === "function"
    ? import.meta.glob<{ default: Record<string, FloorData> }>("./data/technique.local.json", { eager: true })
    : {},
)[0]?.default ?? {};

/** Figures before the owner's hand edits (the figure editor diffs against these). */
const BASE_FIGURES: Figure[] = db.figures.map((f) => withCleanPositions(bookCharts[f.id] ? { ...f, floor: bookCharts[f.id] } : f));

/** Chart positions come from OCR: glued, misread, sentences – use the clean form. */
function withCleanPositions(f: Figure): Figure {
  if (!f.floor) return f;
  const clean = (steps: FloorData["steps"]) =>
    steps.map((st) => {
      const pos = cleanPosition(st.pos);
      if (pos === st.pos) return st;
      const out = { ...st, pos };
      if (!pos) delete out.pos;
      return out;
    });
  // A chart without a position on its last step ends where the syllabus says.
  const fin = cleanPosition(f.syllabus?.finish.match(/\(([^)]*)\)\s*$/)?.[1].split(";")[0]);
  const finish = (steps: FloorData["steps"]) => {
    const last = steps[steps.length - 1];
    if (!fin || !last || last.pos) return steps;
    return [...steps.slice(0, -1), { ...last, pos: fin }];
  };
  return {
    ...f,
    floor: {
      ...f.floor,
      steps: finish(clean(f.floor.steps)),
      ...(f.floor.ladySteps ? { ladySteps: finish(clean(f.floor.ladySteps)) } : {}),
    },
  };
}
const baseById = new Map(BASE_FIGURES.map((f) => [f.id, f]));
export const baseFigure = (id: string) => baseById.get(id);

/** The owner's hand edits of charts (src/data/edits.json). */
export const EDITS = editsRaw as unknown as EditsFile;

/** A figure with an edit applied (chart steps and own timing). */
export function withEdit(f: Figure, edit: FigureEdit | undefined): Figure {
  if (!edit) return f;
  const floor = applyEdit(f.floor, f.en ?? f.cs, edit);
  const syllabus = edit.timing && f.syllabus ? { ...f.syllabus, timing: edit.timing } : f.syllabus;
  return { ...f, floor, syllabus };
}

export const FIGURES: Figure[] = BASE_FIGURES.map((f) => withEdit(f, EDITS[f.id]));

/** True when the local WDSF technique-book charts are available. */
export const HAS_BOOK_CHARTS = Object.keys(bookCharts).length > 0;

const figureById = new Map(FIGURES.map((f) => [f.id, f]));
const danceById = new Map(DANCES.map((d) => [d.id, d]));

// User-defined figures are registered here by customFigures.ts so that
// getFigure() resolves them like catalog figures.
let customFigures: Figure[] = [];
const customById = new Map<string, Figure>();

export function setCustomFigures(list: Figure[]) {
  customFigures = list;
  customById.clear();
  for (const f of list) customById.set(f.id, f);
}

/** Catalog figures followed by the user's own figures. */
export const allFigures = (): Figure[] => [...FIGURES, ...customFigures];

export const getFigure = (id: string) => figureById.get(id) ?? customById.get(id);
export const getDance = (id: string) => danceById.get(id)!;

/** Competition classes offered in the UI. "B" stands for B/A/M (free choreography). */
export const CLASSES: ClassId[] = ["E", "D", "C", "B"];

/** Is the figure allowed in the given class? Classes B and higher are not restricted. */
export function isLegal(fig: Figure, cls: ClassId): boolean {
  return cls === "B" || fig.classes.includes(cls);
}

/** Is the dance danced at all in the given class (i.e. has any catalog figure for it)? */
export function danceInClass(danceId: string, cls: ClassId): boolean {
  if (cls === "B") return danceId !== "polka";
  return FIGURES.some((f) => f.dance === danceId && f.classes.includes(cls));
}

/** Lowest class in which the figure becomes available (E < D < C). */
export function lowestClass(fig: Figure): string {
  for (const c of ["E", "D", "C"]) if (fig.classes.includes(c)) return c;
  return "";
}

/** Primary display name in the chosen language, with the other one as subtitle. */
export function figureNames(fig: Figure, lang: Lang): { main: string; sub: string | null } {
  if (!fig.en) return { main: fig.cs, sub: null };
  return lang === "cs" ? { main: fig.cs, sub: fig.en } : { main: fig.en, sub: fig.cs };
}

/** All names of a figure joined for searching (catalog names + aliases). */
export function searchText(fig: Figure): string {
  return [fig.cs, fig.en ?? "", fig.syllabus?.title ?? "", ...(fig.aliases?.en ?? []), ...(fig.aliases?.cs ?? [])].join(" ");
}

/** Remove diacritics and lowercase, for accent-insensitive search. */
export function fold(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}
