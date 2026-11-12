// Geometry of the figure player: where the man and the lady stand and face on
// every step (shared by the FigurePlayer component and scripts/audit_figures.ts).
import type { Dance, Figure } from "./data";
import {
  STEP_BY_DANCE,
  STEP_METRES,
  norm180,
  parseAlign,
  tracePath,
  turnHintOf,
  type FloorStep,
} from "./floor";
import { positionOf } from "./timing";


export interface Foot {
  n: number;
  foot: "L" | "R" | null;
  /** Direction of the footprint (the step). */
  face: number;
  /** Body facing after the step. */
  bodyFace: number;
  /** Footprint position (beside the line of weight). */
  x: number;
  y: number;
  /** Body position (on the line of weight). */
  bx: number;
  by: number;
}

const rad = (d: number) => (d * Math.PI) / 180;

/** Footprints of one partner. Coordinates in metres; (ox, oy) = starting body position. */
function footprints(
  steps: FloorStep[],
  stepM: number,
  ox: number,
  oy: number,
  hint: -1 | 0 | 1,
  initialFacing: number | null,
): { start: { x: number; y: number; face: number }; feet: Foot[] } {
  const body = tracePath(steps, 0, 0, 0, hint, 0, initialFacing);
  const first = body.find((b) => b.facing !== null);
  let face = first?.stepFacing ?? first?.facing ?? initialFacing ?? 0;
  const startFace = face;
  const FOOT_OFFSET = 0.12;
  const feet = body.slice(1).map((b, i) => {
    if (b.stepFacing !== null && b.stepFacing !== undefined) face = b.stepFacing;
    else if (b.facing !== null) face = b.facing;
    const bodyFace = b.body ?? b.facing ?? face;
    const m = steps[i].desc.match(/\b(RF|LF)\b/i);
    const foot = m ? (m[1].toUpperCase() === "LF" ? "L" : "R") : null;
    const side = foot === "L" ? 90 : foot === "R" ? -90 : 0;
    const a = rad(face + side);
    const bx = ox + b.x * stepM;
    const by = oy + b.y * stepM;
    return {
      n: b.n,
      foot,
      face,
      bodyFace,
      x: bx + (side ? Math.cos(a) * FOOT_OFFSET : 0),
      y: by + (side ? Math.sin(a) * FOOT_OFFSET : 0),
      bx,
      by,
    } as Foot;
  });
  return { start: { x: ox, y: oy, face: startFace }, feet };
}

/** Where the lady stands relative to the man at the start (metres, man's frame: fwd, to his right). */
/** +1 promenade (lady on the man's right), -1 counter promenade, 0 otherwise – at the end of the step. */
export function promenadeSide(pos: string): number {
  const parts = pos.toLowerCase().split(/\s+(?:to|then)\s+(?=[a-z])/);
  const p = parts[parts.length - 1] ?? "";
  if (/counter prom|\bcpp\b|cnt prom/.test(p)) return -1;
  if (/promenade|\bpp\b|\bprom\b/.test(p)) return 1;
  return 0;
}

/** Couple positions danced in a closed hold: the partners turn around their common centre. */
export function closeHold(pos: string): boolean {
  const parts = pos.toLowerCase().split(/\s+(?:to|then)\s+(?=[a-z])/);
  const p = parts[parts.length - 1] ?? "";
  if (/\bopen\b|ex\.? open|apart|\bfan\b|side same|side by side|shadow|tandem/.test(p)) return false;
  return /clos|promenade|\bpp\b|outside partner|\bop\b|fallaway|wing|contra/.test(p);
}

/** Signed amount of turn of a chart step (degrees, + = left), or null. */
export function signedTurn(text: string | undefined): number | null {
  if (!text) return null;
  let total = 0;
  let found = false;
  for (const m of text.matchAll(/(\d)\s*\/\s*(\d)\s*(?:turn\s*)?(?:to\s*)?(?:the\s*)?([LR])?(?![a-z])/gi)) {
    const side = m[3]?.toUpperCase() ?? (/\bR\b|right|toR/i.test(text) ? "R" : /\bL\b|left|toL/i.test(text) ? "L" : null);
    if (!side) return null;
    total += ((+m[1] / +m[2]) * 360) * (side === "L" ? 1 : -1);
    found = true;
  }
  return found ? total : null;
}

export function ladyOffset(pos: string, latin: boolean): { fwd: number; right: number } {
  // Couple position at the end of the step ("Closed Position to Promenade Position" -> PP).
  // Distances (metres, centre to centre) keep the partners' shoulders from overlapping.
  const parts = pos.toLowerCase().split(/\s+(?:to|then)\s+(?=[a-z])/);
  const p = parts[parts.length - 1] ?? "";
  if (/counter prom|\bcpp\b|cnt prom/.test(p)) return latin ? { fwd: 0.3, right: -0.6 } : { fwd: 0.2, right: -0.45 };
  if (/promenade|\bpp\b|prom\b/.test(p)) return latin ? { fwd: 0.3, right: 0.6 } : { fwd: 0.2, right: 0.45 };
  if (/fallaway/.test(p)) return { fwd: 0.05, right: 0.45 };
  if (/outside partner|\bop\b/.test(p)) return { fwd: 0.32, right: -0.15 };
  if (/wing/.test(p)) return { fwd: 0.2, right: -0.45 };
  if (/shadow/.test(p)) return { fwd: 0.35, right: 0.25 };
  if (/tandem/.test(p)) return { fwd: 0.4, right: 0 };
  if (/side by side|side-by-side/.test(p)) return { fwd: 0, right: 0.5 };
  if (/\bl(?:eft)? side\b/.test(p)) return { fwd: 0.1, right: -0.45 };
  if (/\br(?:ight)? side\b/.test(p)) return { fwd: 0.1, right: 0.45 };
  if (/fan/.test(p)) return { fwd: 0.6, right: -0.75 };
  if (/\bl(?:eft)? diag/.test(p)) return { fwd: 0.5, right: -0.45 };
  if (/\br(?:ight)? diag/.test(p)) return { fwd: 0.5, right: 0.45 };
  if (/ex(?:tended)?\.? open/.test(p)) return { fwd: 1.3, right: 0 };
  if (/open|apart/.test(p) || (latin && !/close/.test(p))) return { fwd: 0.9, right: 0 };
  return { fwd: latin ? 0.35 : 0.3, right: latin ? 0.05 : 0.12 };
}


export interface Partner {
  start: { x: number; y: number; face: number };
  feet: Foot[];
}

/** Footprints and body positions of both partners for a figure's chart. */
export function figureGeometry(
  fig: Figure,
  dance: Dance | undefined,
  man: FloorStep[],
  lady: FloorStep[],
): { m: Partner; l: Partner | null } {
  const hasLady = lady.length > 0;

  const stepM = STEP_BY_DANCE[fig.dance] ?? STEP_METRES;
  const hint = turnHintOf(fig.en);
  const latin = dance?.discipline === "latin";
  const charted = man.some((s) => parseAlign(s.align) !== null);
  const m = footprints(man, stepM, 0, 0, hint, charted ? null : 0);
  // The lady starts where the couple position puts her, facing the way her chart says
  // (or facing the man when the chart gives no alignment).
  // Position before the first step: the figure's start in the syllabus (the chart
  // gives the position after each step), else the first step's.
  const startPos = positionOf(fig.syllabus?.start) ?? man[0]?.pos ?? "";
  const off = ladyOffset(startPos, latin);
  const f = m.start.face;
  const lx = Math.cos(rad(f)) * off.fwd + Math.cos(rad(f - 90)) * off.right;
  const ly = Math.sin(rad(f)) * off.fwd + Math.sin(rad(f - 90)) * off.right;
  const ladyCharted = lady.some((s) => parseAlign(s.align) !== null);
  const traced = hasLady ? footprints(lady, stepM, lx, ly, (-hint || 0) as -1 | 0 | 1, ladyCharted ? null : norm180(f + 180)) : null;
  if (!traced) return { m, l: null };
  // Where the partners stand. In a closed hold (closed, PP, outside partner, close
  // opposing …) they keep the couple position and turn around their common centre;
  // apart / without hold (open, side by side, fan, spot turns) each dances on their
  // own path and turns around their own axis. Corrections carry over to later steps.
  const offsetVec = (pos: string, face: number, ladyFace?: number) => {
    // Promenade: the couple forms a "V" opening to where they travel – the lady stands
    // beside the man (his right, CPP his left), measured from the middle of their facings.
    const prom = promenadeSide(pos);
    if (prom && ladyFace !== undefined) {
      const mid = face + norm180(ladyFace - face) / 2;
      const side = (latin ? 0.6 : 0.45) * prom;
      return { x: Math.cos(rad(mid - 90)) * side, y: Math.sin(rad(mid - 90)) * side };
    }
    const o = ladyOffset(pos, latin);
    return {
      x: Math.cos(rad(face)) * o.fwd + Math.cos(rad(face - 90)) * o.right,
      y: Math.sin(rad(face)) * o.fwd + Math.sin(rad(face - 90)) * o.right,
    };
  };
  const moveTo = (f: Foot, bx: number, by: number): Foot => ({ ...f, bx, by, x: bx + (f.x - f.bx), y: by + (f.y - f.by) });
  let dm = { x: 0, y: 0 };
  let dl = { x: 0, y: 0 };
  let lastPos = startPos;
  const mFeet: Foot[] = [];
  const lFeet: Foot[] = [];
  const count = Math.max(m.feet.length, traced.feet.length);
  for (let i = 0; i < count; i++) {
    const mf = m.feet[i];
    const lf = traced.feet[i];
    lastPos = man[i]?.pos || lastPos;
    const mx = mf ? mf.bx + dm.x : mFeet[mFeet.length - 1]?.bx ?? 0;
    const my = mf ? mf.by + dm.y : mFeet[mFeet.length - 1]?.by ?? 0;
    const lx2 = lf ? lf.bx + dl.x : lFeet[lFeet.length - 1]?.bx ?? 0;
    const ly2 = lf ? lf.by + dl.y : lFeet[lFeet.length - 1]?.by ?? 0;
    if (closeHold(lastPos) && mf && lf) {
      const o = offsetVec(lastPos, mf.bodyFace, lf.bodyFace);
      const cx = (mx + lx2) / 2;
      const cy = (my + ly2) / 2;
      const nm = { x: cx - o.x / 2, y: cy - o.y / 2 };
      const nl = { x: cx + o.x / 2, y: cy + o.y / 2 };
      dm = { x: nm.x - mf.bx, y: nm.y - mf.by };
      dl = { x: nl.x - lf.bx, y: nl.y - lf.by };
      mFeet.push(moveTo(mf, nm.x, nm.y));
      lFeet.push(moveTo(lf, nl.x, nl.y));
    } else if (mf && lf) {
      // Apart / without hold: each turns around their own axis on their own path, but
      // they stay at the distance the couple position gives (arm's length in open
      // opposing …) instead of drifting apart when their step sizes differ.
      const o = ladyOffset(lastPos, latin);
      const want = Math.max(0.35, Math.hypot(o.fwd, o.right));
      const dx = lx2 - mx;
      const dy = ly2 - my;
      const dist = Math.hypot(dx, dy) || 1;
      const cx = (mx + lx2) / 2;
      const cy = (my + ly2) / 2;
      const nm = { x: cx - (dx / dist) * (want / 2), y: cy - (dy / dist) * (want / 2) };
      const nl = { x: cx + (dx / dist) * (want / 2), y: cy + (dy / dist) * (want / 2) };
      dm = { x: nm.x - mf.bx, y: nm.y - mf.by };
      dl = { x: nl.x - lf.bx, y: nl.y - lf.by };
      mFeet.push(moveTo(mf, nm.x, nm.y));
      lFeet.push(moveTo(lf, nl.x, nl.y));
    } else {
      if (mf) mFeet.push(moveTo(mf, mx, my));
      if (lf) lFeet.push(moveTo(lf, lx2, ly2));
    }
  }
  // Starting position in promenade: place the lady beside the man the same way.
  let lStart = traced.start;
  if (promenadeSide(startPos)) {
    const o = offsetVec(startPos, m.start.face, traced.start.face);
    lStart = { ...traced.start, x: m.start.x + o.x, y: m.start.y + o.y };
  }
  return { m: { start: m.start, feet: mFeet }, l: { start: lStart, feet: lFeet } };
}
