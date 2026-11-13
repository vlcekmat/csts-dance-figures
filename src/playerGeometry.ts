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
  tr: TraceOpts = {},
): { start: { x: number; y: number; face: number }; feet: Foot[] } {
  const body = tracePath(steps, 0, 0, tr.rotate ?? 0, hint, tr.extraTurn ?? 0, initialFacing, tr.scales ?? []);
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
  // whole turns ("1 turn R", "2 turns to L")
  const whole = text.match(/(\d+)\s*(?:full\s*)?turns?\s*(?:to\s*)?([LR])?/i);
  if (whole) {
    const side = whole[2]?.toUpperCase() ?? (/\bR\b|right|toR/i.test(text) ? "R" : /\bL\b|left|toL/i.test(text) ? "L" : null);
    if (side) {
      total += +whole[1] * 360 * (side === "L" ? 1 : -1);
      found = true;
    }
  }
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

/** How a chart is placed: the plan's rotation, under-/overturn and step lengths. */
export interface TraceOpts {
  rotate?: number;
  extraTurn?: number;
  scales?: number[];
  /** Facing before the first step when the chart has no alignment. */
  initialFacing?: number | null;
}

/** Footprints and body positions of both partners for a figure's chart. */
export function figureGeometry(
  fig: Figure,
  dance: Dance | undefined,
  man: FloorStep[],
  lady: FloorStep[],
): { m: Partner; l: Partner | null } {
  return coupleGeometry(
    {
      stepM: STEP_BY_DANCE[fig.dance] ?? STEP_METRES,
      hint: turnHintOf(fig.en),
      latin: dance?.discipline === "latin",
      // Position before the first step: the figure's start in the syllabus (the chart
      // gives the position after each step), else the first step's.
      startPos: positionOf(fig.syllabus?.start) ?? man[0]?.pos ?? "",
    },
    man,
    lady,
  );
}

/** The lady's steps when her chart is missing: the man's mirrored (other foot,
 * forward <-> backward), which holds for figures danced facing each other. */
export function mirrorSteps(man: FloorStep[]): FloorStep[] {
  const swap = (d: string) =>
    d
      .replace(/\b(LF|RF)\b/g, (m) => (m === "LF" ? "RF" : "LF"))
      .replace(/\b(fwd|bwd|back)\b/g, (m) => (m === "fwd" ? "bwd" : "fwd"));
  return man.map((s) => ({ ...s, desc: swap(s.desc), align: "", face: undefined, end: undefined, body: undefined, moving: undefined }));
}

/** Footprints and body positions of both partners (figure frame, or placed by `tr`). */
export function coupleGeometry(
  cfg: { stepM: number; hint: -1 | 0 | 1; latin: boolean; startPos: string },
  man: FloorStep[],
  lady: FloorStep[],
  tr: TraceOpts = {},
): { m: Partner; l: Partner | null } {
  const hasLady = lady.length > 0;
  const { stepM, hint, latin, startPos } = cfg;
  const charted = man.some((s) => s.face !== undefined || parseAlign(s.align) !== null);
  const m = footprints(man, stepM, 0, 0, hint, tr.initialFacing !== undefined ? tr.initialFacing : charted ? null : 0, tr);
  // The lady starts where the couple position puts her, facing the way her chart says
  // (or facing the man when the chart gives no alignment).
  const off = ladyOffset(startPos, latin);
  const f = m.start.face;
  const lx = Math.cos(rad(f)) * off.fwd + Math.cos(rad(f - 90)) * off.right;
  const ly = Math.sin(rad(f)) * off.fwd + Math.sin(rad(f - 90)) * off.right;
  const ladyCharted = lady.some((s) => s.face !== undefined || parseAlign(s.align) !== null);
  // her chart is in the same frame: the same rotation and turn; step lengths are the man's
  const traced = hasLady
    ? footprints(lady, stepM, lx, ly, (-hint || 0) as -1 | 0 | 1, ladyCharted ? null : norm180(f + 180), {
        ...tr,
        rotate: ladyCharted ? tr.rotate : 0,
      })
    : null;
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

/**
 * Where a step goes relative to the partner: into the partner (between the
 * partner's feet, closed hold), away from them, outside the partner (outside
 * partner / CBMP outside) or beside them (promenade). Null when not applicable.
 */
export function partnerRelation(desc: string, pos: string): "toward" | "away" | "outside" | "beside" | null {
  const d = desc.toLowerCase();
  const fwd = /\bfwd\b|forward/.test(d);
  const bwd = /\bbwd\b|\bback\b/.test(d);
  if (!fwd && !bwd) return null;
  if (/outside partner|\bop\b|outside/.test(d) || /outside partner/i.test(pos)) return "outside";
  if (promenadeSide(pos) !== 0 && fwd) return "beside";
  if (closeHold(pos)) return fwd ? "toward" : "away";
  return null;
}

/** Where one foot of a dancer is: position (m), direction, whether it holds the weight. */
export interface FootState {
  x: number;
  y: number;
  face: number;
  weight: boolean;
}
/** Both feet of a dancer after a step (index 0 = starting position). */
export interface FeetState {
  L: FootState;
  R: FootState;
  /** The foot that moved on this step (null at the start or when unknown). */
  moved: "L" | "R" | null;
}

/** Steps that put the foot down without taking the weight. */
const NO_WEIGHT = /w\/o weight|without weight|\btap\b|\bpoint|\bbrush|\bflick|\bkick/i;

/**
 * Live feet of a dancer through the figure: on every step only the stepping foot
 * moves (to its footprint); the other foot stays where it is and swivels with the
 * body's turn (pivots, spins). The weight goes onto the stepping foot unless the
 * step is a tap, point, kick … without weight.
 */
export function liveFeet(p: Partner, steps: FloorStep[]): FeetState[] {
  const OFF = 0.09;
  const s = p.start;
  const side = (sign: number): FootState => ({
    x: s.x + Math.cos(rad(s.face + 90 * sign)) * OFF,
    y: s.y + Math.sin(rad(s.face + 90 * sign)) * OFF,
    face: s.face,
    weight: false,
  });
  // At the start the weight is on the foot that does not step first.
  const firstFoot = p.feet.find((f) => f.foot)?.foot ?? "L";
  let cur: FeetState = { L: side(1), R: side(-1), moved: null };
  cur[firstFoot === "L" ? "R" : "L"].weight = true;
  const out: FeetState[] = [cur];
  let bodyFace = s.face;
  let bx = s.x;
  let by = s.y;
  p.feet.forEach((f, i) => {
    const turn = norm180(f.bodyFace - bodyFace);
    const next: FeetState = { L: { ...cur.L }, R: { ...cur.R }, moved: f.foot };
    if (f.foot) {
      const other = f.foot === "L" ? "R" : "L";
      const noWeight = NO_WEIGHT.test(steps[i]?.desc ?? "");
      next[f.foot] = { x: f.x, y: f.y, face: f.face, weight: !noWeight };
      // the supporting foot swivels with the body
      next[other] = { ...next[other], face: next[other].face + turn, weight: noWeight ? true : false };
    } else {
      // both feet / unknown: the whole dancer moves with the body
      const dx = f.bx - bx;
      const dy = f.by - by;
      for (const k of ["L", "R"] as const) next[k] = { ...next[k], x: next[k].x + dx, y: next[k].y + dy, face: next[k].face + turn };
    }
    out.push(next);
    cur = next;
    bodyFace = f.bodyFace;
    bx = f.bx;
    by = f.by;
  });
  return out;
}

/** Feet part of the way (t = 0–1) from one state to the next: the stepping foot
 * travels past the supporting foot (as in a real step), the other one swivels. */
export function feetBetween(a: FeetState, b: FeetState, t: number): FeetState {
  const lerpA = (x: number, y: number) => x + norm180(y - x) * t;
  const res: FeetState = { L: { ...a.L }, R: { ...a.R }, moved: b.moved };
  for (const k of ["L", "R"] as const) {
    const fa = a[k];
    const fb = b[k];
    if (b.moved === k) {
      // quadratic curve through a point pulled towards the supporting foot
      const o = a[k === "L" ? "R" : "L"];
      const mx = (fa.x + fb.x) / 2;
      const my = (fa.y + fb.y) / 2;
      const cx = mx + (o.x - mx) * 0.55;
      const cy = my + (o.y - my) * 0.55;
      const u = 1 - t;
      res[k] = {
        x: u * u * fa.x + 2 * u * t * cx + t * t * fb.x,
        y: u * u * fa.y + 2 * u * t * cy + t * t * fb.y,
        face: lerpA(fa.face, fb.face),
        // the weight arrives when the foot lands
        weight: t > 0.6 ? fb.weight : false,
      };
    } else {
      res[k] = {
        x: fa.x + (fb.x - fa.x) * t,
        y: fa.y + (fb.y - fa.y) * t,
        face: fa.face + (fb.face - fa.face) * t,
        weight: b.moved ? (t > 0.6 ? fb.weight : true) : fb.weight,
      };
    }
  }
  return res;
}
