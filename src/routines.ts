// Routine model + persistence in localStorage (per browser) with JSON export/import.
import { useCallback, useEffect, useState } from "react";
import type { ClassId } from "./data";
import type { VariantChoice } from "./variants";
import { isCustomFigure, type CustomFigure } from "./customFigures";

export interface RoutineItem {
  /** Unique id of this occurrence (a figure can appear several times). */
  uid: string;
  figureId: string;
  /** Timing override; undefined = the syllabus basic timing. */
  timing?: string;
  note?: string;
  /** Danced part / alternative start / alternative finish / holds. */
  variant?: VariantChoice;
  /** A corner of the floor follows this figure (floor plan of progressive dances). */
  corner?: boolean;
  /** From this figure on the couple is on this wall (0–3); overrides automatic corners. */
  wall?: number;
}

/** Ballroom used for the floor plan. Length runs along the first long side. */
export interface Room {
  preset: "small" | "medium" | "large" | "custom";
  length: number;
  width: number;
}

export interface Routine {
  room?: Room;
  /** Step length for the floor plan in cm (default depends on the dance). */
  stepCm?: number;
  /** The routine is danced repeatedly: its end must connect to its start. */
  loop?: boolean;
  /** Index of the figure the routine continues with after its end (default 0 = first). */
  loopTo?: number;
  /** Hide the loop visualisation (rail, strip marker, repetitions in the plan). */
  loopHidden?: boolean;
  /** Where the routine starts in the room (floor plan). */
  start?: { side: number; along: number; dist: number; face?: number };
  id: string;
  name: string;
  dance: string;
  cls: ClassId;
  items: RoutineItem[];
  updatedAt: number;
}

const KEY = "csts-routines-v1";

export const newId = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

function load(): Routine[] {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function save(routines: Routine[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(routines));
  } catch {
    /* storage full or unavailable: keep working in memory */
  }
}

/** Basic validation of imported data so a wrong file can't break the app. */
export function parseImported(text: string): { routines: Routine[]; customFigures: CustomFigure[] } | null {
  try {
    const data = JSON.parse(text);
    // Formats: [routine, …], routine, or { routines: […], customFigures: […] }.
    const list = Array.isArray(data) ? data : Array.isArray(data?.routines) ? data.routines : [data];
    const customFigures: CustomFigure[] = Array.isArray(data?.customFigures) ? data.customFigures.filter(isCustomFigure) : [];
    const ok = list.every(
      (r: Routine) => r && typeof r.name === "string" && typeof r.dance === "string" && Array.isArray(r.items),
    );
    if (!ok) return null;
    const routines = list.map((r: Routine) => ({
      id: newId(),
      name: r.name,
      dance: r.dance,
      cls: (["E", "D", "C", "B"].includes(r.cls) ? r.cls : "C") as ClassId,
      items: r.items
        .filter((i: RoutineItem) => i && typeof i.figureId === "string")
        .map((i: RoutineItem) => ({ ...i, uid: newId() })),
      updatedAt: Date.now(),
    }));
    return { routines, customFigures };
  } catch {
    return null;
  }
}

export function useRoutines() {
  const [routines, setRoutines] = useState<Routine[]>(load);

  useEffect(() => save(routines), [routines]);

  // Keep several open tabs in sync.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === KEY) setRoutines(load());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const create = useCallback((partial: Pick<Routine, "name" | "dance" | "cls">) => {
    const r: Routine = { ...partial, id: newId(), items: [], updatedAt: Date.now() };
    setRoutines((rs) => [r, ...rs]);
    return r;
  }, []);

  const update = useCallback((id: string, fn: (r: Routine) => Routine) => {
    setRoutines((rs) => rs.map((r) => (r.id === id ? { ...fn(r), updatedAt: Date.now() } : r)));
  }, []);

  const remove = useCallback((id: string) => {
    setRoutines((rs) => rs.filter((r) => r.id !== id));
  }, []);

  const addMany = useCallback((list: Routine[]) => {
    setRoutines((rs) => [...list, ...rs]);
  }, []);

  const addFigure = useCallback(
    (routineId: string, figureId: string) =>
      update(routineId, (r) => ({ ...r, items: [...r.items, { uid: newId(), figureId }] })),
    [update],
  );

  return { routines, create, update, remove, addMany, addFigure };
}

export type RoutinesApi = ReturnType<typeof useRoutines>;

export function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
