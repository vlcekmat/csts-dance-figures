// Geometry of the figure player: where the man and the lady stand and face on
// every step (shared by the FigurePlayer component and scripts/audit_figures.ts).
import type { Dance, Figure } from "./data";
import {
  relativeFacing,
  STEP_BY_DANCE,
  STEP_METRES,
  norm180,
  parseAlign,
  stepVector,
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
  /** How far the couple's placement moved this partner from their own chart (metres). */
  shift?: { x: number; y: number };
  /** The foot crosses behind / in front of the other one. */
  cross?: "behind" | "front";
  /** Signed turn of the body on this step (degrees, + = left), incl. turns beyond a half turn. */
  turn?: number;
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
    const bx = ox + b.x * stepM;
    const by = oy + b.y * stepM;
    const d = steps[i].desc.toLowerCase();
    // A crossed foot ("LF crosses behind RF", "RF crosses in front of LF") lands on the
    // other foot's side, a little behind / in front of it.
    const crossed = /\bcross/.test(d) && !/across/.test(d);
    let ox2 = 0;
    let oy2 = 0;
    if (side) {
      // In CBMP / outside partner / "across" the foot is placed across, onto the body's line.
      const sideOff = crossed ? -0.05 : /cbmp|across|outside partner/.test(d) ? 0 : FOOT_OFFSET;
      const fwdOff = crossed ? (/behind|back/.test(d) ? -0.1 : /front/.test(d) ? 0.08 : 0) : 0;
      // relative to the body (a crossed foot follows the body, not the foot's own direction)
      const ref = crossed ? bodyFace : face;
      ox2 = Math.cos(rad(ref + side)) * sideOff + Math.cos(rad(ref)) * fwdOff;
      oy2 = Math.sin(rad(ref + side)) * sideOff + Math.sin(rad(ref)) * fwdOff;
    }
    // A foot placed without weight (pointed, tapped, kicked …) reaches out the way the
    // step goes while the body stays: it isn't drawn under the body.
    if (/w\/o weight|without weight|pointed|\btap|\bkick|\bflick/.test(d) && !/clos|cross|brush|in place/.test(d)) {
      const v = stepVector(steps[i].desc.replace(/w\/o weight|without weight/gi, ""), b.stepFacing ?? face);
      if (v.len > 0) {
        const reach = Math.min(0.45, v.len * stepM * 0.6);
        ox2 += Math.cos(rad(v.angle)) * reach;
        oy2 += Math.sin(rad(v.angle)) * reach;
      }
    }
    return {
      n: b.n,
      foot,
      face,
      bodyFace,
      cross: crossed ? (/behind|back/.test(d) ? "behind" : "front") : undefined,
      x: bx + ox2,
      y: by + oy2,
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
  return /clos|promenade|\bpp\b|outside partner|partner outside|\bop\b|fallaway|wing|contra/.test(p);
}

/** Signed amount of turn of a chart step (degrees, + = left), or null. */
export function signedTurn(text: string | undefined): number | null {
  if (!text) return null;
  // alternatives ("1/2 or 3/8 to L"): the first amount, with the side written at the end
  if (/\bor\b/i.test(text)) {
    const side = text.match(/\bto\s*(?:the\s*)?([LR])(?![a-df-z])/i)?.[1] ?? "";
    text = text.split(/\bor\b/i)[0] + (side && !/\b[LR]\b|toL|toR/i.test(text.split(/\bor\b/i)[0]) ? ` to ${side}` : "");
  }
  let total = 0;
  let found = false;
  // whole turns ("1 turn R", "2 turns to L")
  const whole = text.match(/(?<![\d/])(\d+)\s*(?:full\s*)?turns?\s*(?:to\s*)?([LR])?/i);
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

/** Direction of a chart step's turn from its text ("Com. to turn to R", "1/4 L"): -1 right, +1 left, 0 unknown. */
export function turnSign(text: string | undefined): -1 | 0 | 1 {
  if (!text) return 0;
  const m = text.match(/(?:to\s*(?:the\s+)?|\b)(R|L|right|left)(?:\b|(?=e\/o))/i);
  if (!m) return 0;
  return /^r/i.test(m[1]) ? -1 : 1;
}

/**
 * Signed turn of a dancer on one step (degrees, + = left) from the facing before and
 * after it. The facings alone only give the shorter way round; the chart decides the
 * direction (and full turns): its amount when it fits, else its direction for turns
 * beyond about a quarter, else the partner's / the figure's direction for about a half.
 */
export function stepTurn(from: number, to: number, step: FloorStep | undefined, fallback: -1 | 0 | 1 = 0): number {
  const d = norm180(to - from);
  const t = step?.rot ?? signedTurn(step?.turn);
  if (t !== null && Math.abs(t) > 1 && Math.abs(norm180(from + t - to)) < 30) return d + 360 * Math.round((t - d) / 360);
  const sign = t !== null && Math.abs(t) > 1 ? (Math.sign(t) as -1 | 1) : turnSign(step?.turn);
  if (sign && Math.abs(d) > 100 && Math.sign(d) !== sign) return d + 360 * sign;
  if (!sign && fallback && Math.abs(d) > 150 && Math.sign(d) !== fallback) return d + 360 * fallback;
  return d;
}

/** Fill in `turn` of every footprint (figure's direction `hint` for undecided half turns). */
function withTurns(p: Partner, steps: FloorStep[], fallback: (i: number) => -1 | 0 | 1): Partner {
  let face = p.start.face;
  const feet = p.feet.map((f, i) => {
    const turn = stepTurn(face, f.bodyFace, steps[i], fallback(i));
    face = f.bodyFace;
    return { ...f, turn };
  });
  return { start: p.start, feet };
}

/** Body of a partner after step i (0 = start): position and facing. */
export function bodyAfter(p: Partner, i: number): { x: number; y: number; face: number } {
  const f = p.feet[Math.min(i, p.feet.length) - 1];
  return f ? { x: f.bx, y: f.by, face: f.bodyFace } : { x: p.start.x, y: p.start.y, face: p.start.face };
}

/** Body after step k, part of the way (t = 0–1) to step k + 1, turning the step's way. */
export function bodyAt(p: Partner, k: number, t: number): { x: number; y: number; face: number } {
  const a = bodyAfter(p, k);
  if (!t || k >= p.feet.length) return a;
  const b = bodyAfter(p, k + 1);
  const f = p.feet[k];
  const d = norm180(b.face - a.face);
  // the stored turn applies when it leads to this facing (a routine may re-place a figure)
  const turn = f.turn !== undefined && Math.abs(norm180(f.turn - d)) < 1 ? f.turn : d;
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, face: a.face + turn * t };
}

/**
 * Both bodies after step k, part of the way to step k + 1. In a closed hold the couple
 * turns around its common centre: both move along an arc (the line between them turns
 * with the couple) instead of straight lines.
 */
export function couplePose(geo: { m: Partner; l: Partner | null }, man: FloorStep[], k: number, t: number) {
  const m = bodyAt(geo.m, k, t);
  const l = geo.l ? bodyAt(geo.l, k, t) : null;
  if (!t || !l || !geo.l || k >= geo.m.feet.length || k >= geo.l.feet.length) return { m, l };
  if (!closeHold(man[k]?.pos || man[k - 1]?.pos || "")) return passBy(geo.m, geo.l, k, t, m, l);
  const ma = bodyAfter(geo.m, k);
  const mb = bodyAfter(geo.m, k + 1);
  const la = bodyAfter(geo.l, k);
  const lb = bodyAfter(geo.l, k + 1);
  const ang = (x: number, y: number) => (Math.atan2(y, x) * 180) / Math.PI;
  const aA = ang(la.x - ma.x, la.y - ma.y);
  const aB = ang(lb.x - mb.x, lb.y - mb.y);
  let dv = norm180(aB - aA);
  // the line between them turns the couple's way (the man's turn on this step)
  const full = geo.m.feet[k].turn ?? norm180(mb.face - ma.face);
  dv += 360 * Math.round((full - dv) / 360);
  const lenA = Math.hypot(la.x - ma.x, la.y - ma.y);
  const lenB = Math.hypot(lb.x - mb.x, lb.y - mb.y);
  const len = lenA + (lenB - lenA) * t;
  const cx = (ma.x + la.x) / 2 + ((mb.x + lb.x - (ma.x + la.x)) / 2) * t;
  const cy = (ma.y + la.y) / 2 + ((mb.y + lb.y - (ma.y + la.y)) / 2) * t;
  const a = ((aA + dv * t) * Math.PI) / 180;
  return {
    m: { ...m, x: cx - (Math.cos(a) * len) / 2, y: cy - (Math.sin(a) * len) / 2 },
    l: { ...l, x: cx + (Math.cos(a) * len) / 2, y: cy + (Math.sin(a) * len) / 2 },
  };
}

/**
 * Partners changing sides without a hold (underarm turns, spot turns, crossing over)
 * would walk straight through each other: they pass by instead – the one who moves
 * more curves round the other, keeping at least a body's width between them.
 */
function passBy(
  pm: Partner,
  pl: Partner,
  k: number,
  t: number,
  m: { x: number; y: number; face: number },
  l: { x: number; y: number; face: number },
) {
  const MIN = 0.32;
  const ma = bodyAfter(pm, k);
  const mb = bodyAfter(pm, k + 1);
  const la = bodyAfter(pl, k);
  const lb = bodyAfter(pl, k + 1);
  // relative position lady − man along the step: r(t) = r0 + t·v
  const r0 = { x: la.x - ma.x, y: la.y - ma.y };
  const v = { x: lb.x - mb.x - r0.x, y: lb.y - mb.y - r0.y };
  const vv = v.x * v.x + v.y * v.y;
  if (vv < 1e-4) return { m, l };
  const ts = Math.max(0, Math.min(1, -(r0.x * v.x + r0.y * v.y) / vv));
  const c = { x: r0.x + ts * v.x, y: r0.y + ts * v.y };
  const dc = Math.hypot(c.x, c.y);
  if (dc >= MIN || ts <= 0 || ts >= 1) return { m, l };
  // pass on the side of the closest approach (the lady's right when straight through)
  const lv = Math.sqrt(vv);
  const n = dc > 0.01 ? { x: c.x / dc, y: c.y / dc } : { x: v.y / lv, y: -v.x / lv };
  const h = (MIN - dc) / Math.max(0.3, Math.sin(Math.PI * ts));
  const bump = h * Math.sin(Math.PI * t);
  const lm = Math.hypot(mb.x - ma.x, mb.y - ma.y);
  const ll = Math.hypot(lb.x - la.x, lb.y - la.y);
  const kl = ll + lm > 0.01 ? ll / (ll + lm) : 0.5;
  return {
    m: { ...m, x: m.x - n.x * bump * (1 - kl), y: m.y - n.y * bump * (1 - kl) },
    l: { ...l, x: l.x + n.x * bump * kl, y: l.y + n.y * bump * kl },
  };
}

export function ladyOffset(pos: string, latin: boolean): { fwd: number; right: number } {
  // Couple position at the end of the step ("Closed Position to Promenade Position" -> PP).
  // Distances (metres, centre to centre) keep the partners' shoulders from overlapping.
  const parts = pos.toLowerCase().split(/\s+(?:to|then)\s+(?=[a-z])/);
  const p = parts[parts.length - 1] ?? "";
  if (/counter prom|\bcpp\b|cnt prom/.test(p)) return latin ? { fwd: 0.3, right: -0.6 } : { fwd: 0.2, right: -0.45 };
  if (/promenade|\bpp\b|prom\b/.test(p)) return latin ? { fwd: 0.3, right: 0.6 } : { fwd: 0.2, right: 0.45 };
  if (/fallaway/.test(p)) return { fwd: 0.05, right: 0.45 };
  // Outside partner is always on the partner's right side: the lady stands further to
  // the man's right than in closed position (his right foot passes outside her right).
  if (/outside partner|partner outside|(?:^|\s)op(?:\s|$)/.test(p)) return { fwd: 0.3, right: 0.27 };
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

/**
 * Some lady's charts carry the man's alignment (she "faces wall" like him although
 * they stand facing each other). Traced as given, she walks the opposite way and the
 * couple's averaged path gets teeth. When most steps in a facing position show it,
 * turn her alignments round.
 */
export function fixLadyFacing(man: FloorStep[], lady: FloorStep[]): FloorStep[] {
  const FACING = /clos|opp|open|outside|wing/i;
  const NOT = /prom|shadow|tandem|side|fan|fallaway/i;
  let same = 0;
  let compared = 0;
  man.forEach((m, i) => {
    const l = lady[i];
    const pos = (m.pos ?? "").split(/\s+then\s+/).pop() ?? "";
    if (!l || m.face === undefined || l.face === undefined || !FACING.test(pos) || NOT.test(pos)) return;
    compared++;
    if (Math.abs(norm180(l.face - m.face)) < 60) same++;
  });
  const flip = (v: number | undefined) => (v === undefined ? undefined : norm180(v + 180));
  const flipStep = (l: FloorStep) => ({ ...l, face: flip(l.face), end: flip(l.end), body: flip(l.body) });
  if (compared >= 2 && same * 2 >= compared) return lady.map(flipStep);
  // single steps in a closed hold where she would face the same way as the man
  return lady.map((l, i) => {
    const m = man[i];
    const pos = (m?.pos ?? "").split(/\s+then\s+/).pop() ?? "";
    if (!m || m.face === undefined || l.face === undefined) return l;
    if (!/^(closed|close opp)/i.test(pos.trim())) return l;
    return Math.abs(norm180(l.face - m.face)) < 60 ? flipStep(l) : l;
  });
}

export { relativeFacing } from "./floor";

/** Footprints and body positions of both partners (figure frame, or placed by `tr`). */
export function coupleGeometry(
  cfg: { stepM: number; hint: -1 | 0 | 1; latin: boolean; startPos: string },
  man: FloorStep[],
  lady: FloorStep[],
  tr: TraceOpts = {},
): { m: Partner; l: Partner | null } {
  const { stepM, hint, latin, startPos } = cfg;
  lady = fixLadyFacing(man, lady);
  // Her alignments are only usable together with his: without his (latin charts give
  // only turn amounts) she is placed relative to him.
  const manHasFaces = man.some((st) => st.face !== undefined || parseAlign(st.align) !== null);
  if (!manHasFaces) lady = lady.map((st) => ({ ...st, align: "", face: undefined, end: undefined, body: undefined, moving: undefined }));
  const hasLady = lady.length > 0;
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
  const traceLady = (steps: FloorStep[]) =>
    footprints(steps, stepM, lx, ly, (-hint || 0) as -1 | 0 | 1, ladyCharted ? null : norm180(f + 180), {
      ...tr,
      rotate: ladyCharted ? tr.rotate : 0,
    });
  let traced = hasLady ? traceLady(lady) : null;
  // The couple position says which way she faces relative to him (facing him, the same
  // way, at a right angle). Where her chart clearly disagrees (her alignment written
  // from his side, latin turn amounts adding up differently) her facing is set by the
  // position BEFORE her steps are traced – so "fwd" goes where she really goes and the
  // placement doesn't have to drag her steps sideways.
  if (traced) {
    const rot = ladyCharted ? (tr.rotate ?? 0) : 0;
    const n = lady.length;
    let carry = 0;
    let prevFace = traced.start.face;
    let pos = startPos;
    let changed = false;
    const fixed = lady.map((st, i) => {
      pos = man[i]?.pos || pos;
      const mf = m.feet[i];
      const lf = traced!.feet[i];
      if (!mf || !lf) return st;
      const want = (p: string) => {
        const rel = relativeFacing(p);
        if (rel === null) return carry;
        const d = norm180(mf.bodyFace + rel - (lf.bodyFace + carry));
        return Math.abs(d) > 60 ? norm180(carry + d) : carry;
      };
      let corr = want(pos);
      // Her chart turns one way and the position would turn her the other way: latin
      // charts often name the new position one step later than the turn – use it.
      const t = st.rot ?? signedTurn(st.turn);
      // (only a real amount of turn: "starts to turn" doesn't say enough)
      const sign = t !== null && Math.abs(t) >= 45 ? Math.sign(t) : 0;
      const turnOf = (c: number) => norm180(lf.bodyFace + c - prevFace);
      if (sign && corr !== carry && Math.abs(turnOf(corr)) > 30 && Math.sign(turnOf(corr)) !== sign && man[i + 1]?.pos) {
        const next = want(man[i + 1].pos!);
        if (!(Math.abs(turnOf(next)) > 30 && Math.sign(turnOf(next)) !== sign)) corr = next;
      }
      carry = corr;
      prevFace = lf.bodyFace + corr;
      if (Math.abs(corr) < 1) return st;
      changed = true;
      const sh = (v: number | undefined) => (v === undefined ? undefined : norm180(v + corr));
      if (st.face !== undefined) return { ...st, face: sh(st.face), end: sh(st.end), body: sh(st.body), moving: sh(st.moving) };
      // no alignment of her own: give the step the corrected facing (chart frame)
      const extra = n > 1 ? ((tr.extraTurn ?? 0) * i) / (n - 1) : (tr.extraTurn ?? 0);
      return { ...st, align: "", face: norm180(lf.face - rot - extra + corr), end: undefined, body: undefined };
    });
    if (changed) traced = traceLady(fixed);
  }
  if (!traced) return { m, l: null };
  // Where the partners stand. In a closed hold (closed, PP, outside partner, close
  // opposing …) they keep the couple position and turn around their common centre;
  // apart / without hold (open, side by side, fan, spot turns) each dances on their
  // own path and turns around their own axis. Corrections carry over to later steps.
  const offsetVec = (pos: string, face: number, ladyFace?: number, feetFace?: number) => {
    // Promenade: the couple forms a "V" opening to where they travel – the lady stands
    // beside the man (his right, CPP his left), measured from the middle of their facings.
    const prom = promenadeSide(pos);
    if (prom && ladyFace !== undefined) {
      // beside the man (his right in PP, left in CPP), measured from where his feet point
      // (his feet's direction when it is close to his body's – latin turn amounts may differ)
      const dir = feetFace !== undefined && Math.abs(norm180(feetFace - face)) <= 60 ? feetFace : face;
      const side = (latin ? 0.6 : 0.45) * prom;
      return {
        x: Math.cos(rad(dir - 90)) * side + Math.cos(rad(dir)) * 0.08,
        y: Math.sin(rad(dir - 90)) * side + Math.sin(rad(dir)) * 0.08,
      };
    }
    const o = ladyOffset(pos, latin);
    return {
      x: Math.cos(rad(face)) * o.fwd + Math.cos(rad(face - 90)) * o.right,
      y: Math.sin(rad(face)) * o.fwd + Math.sin(rad(face - 90)) * o.right,
    };
  };
  const moveTo = (f: Foot, bx: number, by: number): Foot => ({
    ...f,
    bx,
    by,
    x: bx + (f.x - f.bx),
    y: by + (f.y - f.by),
    shift: { x: bx - f.bx, y: by - f.by },
  });
  let dm = { x: 0, y: 0 };
  let dl = { x: 0, y: 0 };
  let lastPos = startPos;
  const mFeet: Foot[] = [];
  const lFeet: Foot[] = [];
  const count = Math.max(m.feet.length, traced.feet.length);
  /** A weight transfer ("in place", "recover" …): the feet don't move, so the dancer is pinned. */
  const TRANSFER = /\bin place|\brecover|replace weight|weight (?:to|on)\b/i;
  /** How much a partner moves on step i by their own chart (0 for a weight transfer). */
  const ownLen = (p: { start: { x: number; y: number }; feet: Foot[] }, i: number) => {
    const chart = p === m ? man : lady;
    if (TRANSFER.test(chart[i]?.desc ?? "") && !/w\/o weight|without weight/i.test(chart[i]?.desc ?? "")) return 0;
    const a = i === 0 ? p.start : { x: p.feet[i - 1].bx, y: p.feet[i - 1].by };
    const b = p.feet[i];
    return b ? Math.hypot(b.bx - a.x, b.by - a.y) : 0;
  };
  /**
   * A couple position is a small region, not a point: the lady may stand a few degrees
   * further round and a little nearer or further. The nearest spot of that region to
   * where the partners' own steps take them is used (smaller corrections).
   */
  const TOL_ANG = 15;
  const TOL_LEN = 0.15;
  const nearestRel = (o: { x: number; y: number }, r: { x: number; y: number }) => {
    const lo = Math.hypot(o.x, o.y);
    const lr = Math.hypot(r.x, r.y);
    if (lo < 0.1 || lr < 0.01) return o;
    const ao = Math.atan2(o.y, o.x);
    const ar = Math.atan2(r.y, r.x);
    const d = norm180(((ar - ao) * 180) / Math.PI);
    const th = ao + (Math.max(-TOL_ANG, Math.min(TOL_ANG, d)) * Math.PI) / 180;
    const len = Math.max(lo * (1 - TOL_LEN), Math.min(lo * (1 + TOL_LEN), lr));
    return { x: Math.cos(th) * len, y: Math.sin(th) * len };
  };
  /**
   * Put the lady at `rel` from the man, starting from where their own steps take them
   * (`pm`, `pl`). The difference is split by weights 1/(step length)²: the partner who
   * hardly moves keeps their place, the one taking a step absorbs the correction.
   */
  const share = (pm: { x: number; y: number }, pl: { x: number; y: number }, rel0: { x: number; y: number }, lm: number, ll: number) => {
    const rel = nearestRel(rel0, { x: pl.x - pm.x, y: pl.y - pm.y });
    const D = { x: rel.x - (pl.x - pm.x), y: rel.y - (pl.y - pm.y) };
    const wm = 1 / (lm + 0.05) ** 2;
    const wl = 1 / (ll + 0.05) ** 2;
    const km = wl / (wm + wl);
    const kl = wm / (wm + wl);
    return { nm: { x: pm.x - km * D.x, y: pm.y - km * D.y }, nl: { x: pl.x + kl * D.x, y: pl.y + kl * D.y } };
  };
  /**
   * Keep a step its own: the placement may lengthen or shorten a step and bend it a
   * little, but not turn it more than CONE degrees or shrink it below a part of its
   * length (a still partner may be moved only a little). What doesn't fit is reached
   * on the following steps (the next correction starts from where the dancer is).
   */
  const prevBody = (arr: Foot[], start: { x: number; y: number }) =>
    arr.length ? { x: arr[arr.length - 1].bx, y: arr[arr.length - 1].by } : { x: start.x, y: start.y };
  const CONE = 45;
  const LAG_TIGHT = 0;
  const LAG = 0.15;
  const keepStep = (prev: { x: number; y: number }, own: { x: number; y: number }, want: { x: number; y: number }, lag = LAG) => {
    const v = { x: own.x - prev.x, y: own.y - prev.y };
    const c = { x: want.x - own.x, y: want.y - own.y };
    const lv = Math.hypot(v.x, v.y);
    const ok = (t: number) => {
      const w = { x: v.x + c.x * t, y: v.y + c.y * t };
      const lw = Math.hypot(w.x, w.y);
      if (lv < 0.1) return lw <= Math.max(0.25, lv + 0.05);
      if (lw < 0.4 * lv) return false;
      return (v.x * w.x + v.y * w.y) / (lv * lw) >= Math.cos((CONE * Math.PI) / 180);
    };
    if (ok(1)) return want;
    let lo = 0;
    let hi = 1;
    for (let k = 0; k < 12; k++) {
      const mid = (lo + hi) / 2;
      if (ok(mid)) lo = mid;
      else hi = mid;
    }
    // ... but the partner may lag behind the position only a little
    const lc = Math.hypot(c.x, c.y);
    const t = lc > 0 ? Math.max(lo, 1 - lag / lc) : lo;
    return { x: own.x + c.x * t, y: own.y + c.y * t };
  };
  for (let i = 0; i < count; i++) {
    const mf = m.feet[i];
    let lf = traced.feet[i];
    lastPos = man[i]?.pos || lastPos;
    const mx = mf ? mf.bx + dm.x : mFeet[mFeet.length - 1]?.bx ?? 0;
    const my = mf ? mf.by + dm.y : mFeet[mFeet.length - 1]?.by ?? 0;
    const lx2 = lf ? lf.bx + dl.x : lFeet[lFeet.length - 1]?.bx ?? 0;
    const ly2 = lf ? lf.by + dl.y : lFeet[lFeet.length - 1]?.by ?? 0;
    // Positions that say where the lady stands (in front, beside, behind …): she is put
    // there; otherwise (unknown position) the partners keep their own directions.
    const placed = closeHold(lastPos) || /opp|open|fan|side|shadow|tandem|diag|prom|fallaway|wing|outside|angle/i.test(lastPos);
    // Facing each other (closed / opposing positions): she faces him at the end of the
    // step – her own turn amounts (latin charts) would drift apart from his.
    const endPos = (lastPos.split(/\s+(?:to|then)\s+(?=[A-Za-z])/).pop() ?? "").trim().toLowerCase();
    if (mf && lf && /^(closed|close opp|open opp|ex(?:tended)?\.? open opp|opp)\b/.test(endPos) && !/same|fallaway|prom/.test(endPos)) {
      const delta = norm180(mf.bodyFace + 180 - lf.bodyFace);
      if (Math.abs(delta) > 20) {
        lf = { ...lf, bodyFace: norm180(mf.bodyFace + 180), face: norm180(lf.face + delta) };
      }
    }
    if (placed && mf && lf) {
      const o = offsetVec(lastPos, mf.bodyFace, lf.bodyFace, mf.face);
      // The lady must end up at `o` from the man. The change needed is shared by the
      // partners by how much each of them steps: the one who stays in place (heel turn,
      // closing step) stays put and the other one takes the correction into the step –
      // nobody is carried, so the supporting feet stay on the floor.
      const sh = share({ x: mx, y: my }, { x: lx2, y: ly2 }, o, ownLen(m, i), ownLen(traced, i));
      // In a closed hold the partners can't be apart even for a moment (they turn as
      // one): exact placement. Otherwise each keeps their step and catches up later.
      const tight = closeHold(lastPos);
      const lag = tight ? LAG_TIGHT : LAG;
      const nm = keepStep(prevBody(mFeet, m.start), { x: mx, y: my }, sh.nm, lag);
      const nl = keepStep(prevBody(lFeet, traced.start), { x: lx2, y: ly2 }, sh.nl, lag);
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
      const sh = share({ x: mx, y: my }, { x: lx2, y: ly2 }, { x: (dx / dist) * want, y: (dy / dist) * want }, ownLen(m, i), ownLen(traced, i));
      const nm = keepStep(prevBody(mFeet, m.start), { x: mx, y: my }, sh.nm);
      const nl = keepStep(prevBody(lFeet, traced.start), { x: lx2, y: ly2 }, sh.nl);
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
  const mOut = withTurns({ start: m.start, feet: mFeet }, man, () => hint);
  // the lady turns the couple's way: her chart's direction, else the man's on that step
  const lOut = withTurns({ start: lStart, feet: lFeet }, lady, (i) => {
    const mt = mOut.feet[i]?.turn ?? 0;
    return Math.abs(mt) > 30 ? (Math.sign(mt) as -1 | 1) : hint;
  });
  return { m: mOut, l: lOut };
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
  /** Crossed behind / in front of the other foot (until it moves again). */
  cross?: "behind" | "front";
  /** Share of the weight on this foot (0–1), for smooth weight transfers. */
  load?: number;
}
/** Both feet of a dancer after a step (index 0 = starting position). */
export interface FeetState {
  L: FootState;
  R: FootState;
  /** The foot that moved on this step (null at the start or when unknown). */
  moved: "L" | "R" | null;
  /** The step only transfers the weight (the foot doesn't travel). */
  transfer?: boolean;
  /** Signed body turn on this step (degrees, + = left): the feet swivel the same way. */
  turn?: number;
}

/** Steps that put the foot down without taking the weight. */
const NO_WEIGHT = /w\/o weight|without weight|\btap\b|\bpoint|\bbrush|\bflick|\bkick|\bheld\b/i;

/**
 * Live feet of a dancer through the figure: on every step only the stepping foot
 * moves (to its footprint); the other foot stays where it is and swivels with the
 * body's turn (pivots, spins). The weight goes onto the stepping foot unless the
 * step is a tap, point, kick … without weight.
 */
export function liveFeet(p: Partner, steps: FloorStep[]): FeetState[] {
  // The foot points the step's way when it lands; a foot that ends up far from where
  // the body faces was turned on (pivot, spin, heel turn): it follows the body, keeping
  // only a natural turnout.
  // A step turned on (spin, pivot: the chart gives the facing after it, or the step
  // itself turns a quarter or more) ends with the foot under the turned body.
  const landFace = (f: Foot, st: FloorStep | undefined) => {
    const diff = norm180(f.face - f.bodyFace);
    const spun = st?.end !== undefined || Math.abs(f.turn ?? 0) >= 90;
    if (spun && Math.abs(diff) > 20) return f.bodyFace + Math.sign(diff) * 20;
    return Math.abs(diff) > 90 ? f.bodyFace + Math.sign(diff) * 30 : f.face;
  };
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
    const d = norm180(f.bodyFace - bodyFace);
    const turn = f.turn !== undefined && Math.abs(norm180(f.turn - d)) < 1 ? f.turn : d;
    const next: FeetState = { L: { ...cur.L }, R: { ...cur.R }, moved: f.foot, turn };
    if (f.foot) {
      const other = f.foot === "L" ? "R" : "L";
      const noWeight = NO_WEIGHT.test(steps[i]?.desc ?? "");
      const was = cur[f.foot];
      // Weight transfer: "RF in place", "Recover LF" … – the foot stays where it is.
      const desc = steps[i]?.desc ?? "";
      next.transfer = !noWeight && (/\bin place|\brecover|replace weight|weight (?:to|on)\b/i.test(desc) || Math.hypot(f.x - was.x, f.y - was.y) < 0.06);
      // Only the stepping foot travels: it lands where the step (and the couple's
      // placement) puts it. The supporting foot stays on the floor and only swivels
      // with the body's turn.
      next[f.foot] = next.transfer
        ? { ...was, face: was.face + turn, weight: true, cross: undefined }
        : { x: f.x, y: f.y, face: landFace(f, steps[i]), weight: !noWeight, cross: f.cross };
      next[other] = { ...next[other], face: next[other].face + turn, weight: noWeight ? true : false };
      if (!next.transfer) {
        // The couple's placement goes into where the stepping foot lands (the
        // partners share it by how much each of them steps – see coupleGeometry).
        // A placement correction bigger than a stride would leave the supporting foot
        // impossibly far behind: then it is drawn up (the only case it moves).
        const MAX = 1.3;
        const o = next[other];
        const nf = next[f.foot];
        const dist = Math.hypot(o.x - nf.x, o.y - nf.y);
        if (dist > MAX) {
          next[other] = { ...o, x: nf.x + ((o.x - nf.x) / dist) * MAX, y: nf.y + ((o.y - nf.y) / dist) * MAX };
        }
      }
      // (a weight transfer keeps both feet where they are)
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
  // The stepping foot turns the shorter way – unless the body turns more than a
  // quarter the other way on this step (then it swivels round with the body).
  const lerpA = (x: number, y: number) => {
    let d = norm180(y - x);
    // a spin / pivot: the foot turns with the body, the same way and as far (full turns too)
    const bt = b.turn ?? 0;
    if (Math.abs(bt) > 90) d += 360 * Math.round((bt - d) / 360);
    return x + d * t;
  };
  const res: FeetState = { L: { ...a.L }, R: { ...a.R }, moved: b.moved, transfer: b.transfer, turn: b.turn };
  // The weight flows over during the step: gradually for a weight transfer, mostly
  // when the foot lands for a real step.
  const flow = b.transfer ? t : Math.max(0, Math.min(1, (t - 0.45) / 0.45));
  const load = (f: FootState) => (f.load ?? (f.weight ? 1 : 0));
  for (const k of ["L", "R"] as const) {
    const fa = a[k];
    const fb = b[k];
    if (b.moved === k) {
      // quadratic curve through a point pulled towards the supporting foot
      const o = a[k === "L" ? "R" : "L"];
      const mx = (fa.x + fb.x) / 2;
      const my = (fa.y + fb.y) / 2;
      const cx = mx + (o.x - mx) * 0.35;
      const cy = my + (o.y - my) * 0.35;
      const u = 1 - t;
      res[k] = {
        x: u * u * fa.x + 2 * u * t * cx + t * t * fb.x,
        y: u * u * fa.y + 2 * u * t * cy + t * t * fb.y,
        face: lerpA(fa.face, fb.face),
        // the weight arrives when the foot lands
        weight: t > 0.6 ? fb.weight : false,
        cross: t > 0.6 ? fb.cross : undefined,
        load: load(fa) + (load(fb) - load(fa)) * flow,
      };
    } else {
      res[k] = {
        x: fa.x + (fb.x - fa.x) * t,
        y: fa.y + (fb.y - fa.y) * t,
        face: fa.face + (fb.face - fa.face) * t,
        weight: b.moved ? (t > 0.6 ? fb.weight : true) : fb.weight,
        cross: fa.cross,
        load: load(fa) + (load(fb) - load(fa)) * flow,
      };
    }
  }
  return res;
}
