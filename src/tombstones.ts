// Deleted routines / own figures (id -> time of deletion), so a sync doesn't bring
// them back from another device that still has them.
const KEY = "csts-deleted-v1";

export function loadDeleted(): Record<string, number> {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "{}");
    return v && typeof v === "object" ? v : {};
  } catch {
    return {};
  }
}

export function saveDeleted(d: Record<string, number>) {
  try {
    localStorage.setItem(KEY, JSON.stringify(d));
  } catch {
    /* storage unavailable */
  }
}

export function markDeleted(id: string) {
  saveDeleted({ ...loadDeleted(), [id]: Date.now() });
}
