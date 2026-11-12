// Typed access to the generated figure database (src/data/figures.json).
import raw from "./data/figures.json";
import type { FloorData } from "./floor";

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

export const FIGURES: Figure[] = db.figures.map((f) => (bookCharts[f.id] ? { ...f, floor: bookCharts[f.id] } : f));

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
