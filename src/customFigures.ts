// User-defined figures (typically for classes B/A/M with free choreography).
// Stored in localStorage next to routines and converted to the same Figure
// shape as catalog figures, so routines, timing, checks and the floor plan
// work with them unchanged.
import { useCallback, useEffect, useState } from "react";
import { setCustomFigures, type Figure } from "./data";

export type Travel = "spot" | "small" | "travel";

export interface StepEnd {
  foot: "RF" | "LF" | "";
  /** "fwd", "bwd", "to side", "closes", "in place" … */
  dir: string;
  /** Couple position, e.g. "Closed Position", "Open Opp." */
  pos: string;
}

export interface CustomFigure {
  id: string; // "custom-…"
  dance: string;
  cs: string;
  en?: string;
  timing: string;
  start: StepEnd;
  finish: StepEnd;
  startHold?: string;
  finishHold?: string;
  travel: Travel;
  note?: string;
  videoUrl?: string;
  updatedAt: number;
}

const KEY = "csts-custom-figures-v1";

const DIR_CS: Record<string, string> = {
  fwd: "vpřed",
  bwd: "vzad",
  "to side": "stranou",
  closes: "přisouvá",
  "in place": "na místě",
  "diag fwd": "diagonálně vpřed",
  "diag bwd": "diagonálně vzad",
};

/** "RF fwd (Closed Position)" — same format as the WDSF Syllabus, so the parsers work. */
export function endText(e: StepEnd, cs = false): string {
  const foot = cs ? (e.foot === "RF" ? "Pn" : e.foot === "LF" ? "Ln" : "") : e.foot;
  const dir = cs ? (DIR_CS[e.dir] ?? e.dir) : e.dir;
  const main = [foot, dir].filter(Boolean).join(" ");
  return e.pos ? `${main} (${e.pos})`.trim() : main;
}

export const TRAVEL_FACTOR: Record<Travel, number> = { spot: 0, small: 0.35, travel: 1 };

/** Convert to the Figure shape used everywhere in the app. */
export function toFigure(c: CustomFigure): Figure {
  return {
    id: c.id,
    dance: c.dance,
    no: 0,
    en: c.en || null,
    cs: c.cs,
    classes: [], // not in the catalog: legal only in classes B/A/M
    wdsfRef: null,
    plamRef: null,
    custom: true,
    customTravel: TRAVEL_FACTOR[c.travel],
    customNote: c.note,
    customVideo: c.videoUrl,
    syllabus: {
      section: "",
      title: c.en || c.cs,
      start: endText(c.start),
      finish: endText(c.finish),
      startCs: endText(c.start, true),
      finishCs: endText(c.finish, true),
      timing: c.timing,
      altTimings: [],
      notes: [],
      holds:
        c.startHold || c.finishHold
          ? { start: c.startHold, finish: c.finishHold ?? c.startHold, alts: [] }
          : undefined,
    },
  };
}

function load(): CustomFigure[] {
  try {
    const raw = localStorage.getItem(KEY);
    const v = raw ? JSON.parse(raw) : [];
    return Array.isArray(v) ? v.filter(isCustomFigure) : [];
  } catch {
    return [];
  }
}

export function isCustomFigure(v: unknown): v is CustomFigure {
  const c = v as CustomFigure;
  return !!c && typeof c.id === "string" && c.id.startsWith("custom-") && typeof c.cs === "string" && typeof c.dance === "string";
}

export const newCustomId = () => "custom-" + Math.random().toString(36).slice(2, 9) + Date.now().toString(36);

export function emptyCustom(dance: string): CustomFigure {
  return {
    id: newCustomId(),
    dance,
    cs: "",
    en: "",
    timing: "",
    start: { foot: "", dir: "", pos: "" },
    finish: { foot: "", dir: "", pos: "" },
    travel: "travel",
    updatedAt: Date.now(),
  };
}

// The registry in data.ts must be filled before the first render that looks
// figures up, so it is initialised synchronously here.
const initial = load();
setCustomFigures(initial.map(toFigure));

export function useCustomFigures() {
  const [list, setList] = useState<CustomFigure[]>(initial);

  useEffect(() => {
    setCustomFigures(list.map(toFigure));
    try {
      localStorage.setItem(KEY, JSON.stringify(list));
    } catch {
      /* storage full or unavailable */
    }
  }, [list]);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === KEY) setList(load());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const save = useCallback((c: CustomFigure) => {
    const item = { ...c, updatedAt: Date.now() };
    // Update the registry right away so the routine that adds it can resolve it.
    setList((l) => {
      const next = l.some((x) => x.id === c.id) ? l.map((x) => (x.id === c.id ? item : x)) : [...l, item];
      setCustomFigures(next.map(toFigure));
      return next;
    });
  }, []);

  const remove = useCallback((id: string) => setList((l) => l.filter((x) => x.id !== id)), []);

  /** Add imported figures, keeping existing ones with the same id. */
  const addMany = useCallback((items: CustomFigure[]) => {
    setList((l) => {
      const next = [...l, ...items.filter((i) => !l.some((x) => x.id === i.id))];
      setCustomFigures(next.map(toFigure));
      return next;
    });
  }, []);

  const get = useCallback((id: string) => list.find((x) => x.id === id), [list]);

  return { list, save, remove, addMany, get };
}

export type CustomApi = ReturnType<typeof useCustomFigures>;
