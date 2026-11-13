// The whole routine as one track for the step player: every figure's footprints
// placed in the room exactly as the floor plan places it (rotation, automatic
// turns, step lengths, corners, preparatory steps).
import { STEP_METRES, norm180, type FloorStep, type SimSegment } from "./floor";
import { coupleGeometry, ladyOffset, mirrorSteps, type Foot, type Partner } from "./playerGeometry";
import type { Track } from "./components/FigurePlayer";

const rad = (d: number) => (d * Math.PI) / 180;

/** Partner geometry in the figure's frame -> room (rotate by the wall, move to the start). */
function toRoom(p: Partner, x0: number, y0: number, side: number): Partner {
  const a = rad(side * 90);
  const c = Math.cos(a);
  const s = Math.sin(a);
  const pt = (x: number, y: number) => ({ x: x0 + x * c - y * s, y: y0 + x * s + y * c });
  const f = (v: number) => norm180(v + side * 90);
  const st = pt(p.start.x, p.start.y);
  return {
    start: { x: st.x, y: st.y, face: f(p.start.face) },
    feet: p.feet.map((ft) => {
      const q = pt(ft.x, ft.y);
      const b = pt(ft.bx, ft.by);
      return { ...ft, x: q.x, y: q.y, bx: b.x, by: b.y, face: f(ft.face), bodyFace: f(ft.bodyFace) };
    }),
  };
}

/** A figure without any chart: the couple walks along the plan's line, alternating feet. */
function walkAlong(seg: SimSegment, count: number, face: number, latin: boolean): { m: Partner; l: Partner; steps: FloorStep[] } {
  const n = Math.max(1, count);
  const a = seg.pts[0];
  const b = seg.pts[seg.pts.length - 1];
  const dir = Math.hypot(b.x - a.x, b.y - a.y) > 0.05 ? (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI : face;
  const mFeet: Foot[] = [];
  const lFeet: Foot[] = [];
  const o = ladyOffset("Closed Position", latin);
  const lo = { x: Math.cos(rad(dir)) * o.fwd + Math.cos(rad(dir - 90)) * o.right, y: Math.sin(rad(dir)) * o.fwd + Math.sin(rad(dir - 90)) * o.right };
  const steps: FloorStep[] = [];
  for (let i = 1; i <= n; i++) {
    const bx = a.x + ((b.x - a.x) * i) / n;
    const by = a.y + ((b.y - a.y) * i) / n;
    const foot = i % 2 ? "L" : "R";
    const sd = foot === "L" ? 90 : -90;
    mFeet.push({ n: i, foot, face: dir, bodyFace: dir, bx, by, x: bx + Math.cos(rad(dir + sd)) * 0.09, y: by + Math.sin(rad(dir + sd)) * 0.09 });
    const lf = foot === "L" ? "R" : "L";
    const lsd = lf === "L" ? 90 : -90;
    const lb = { x: bx + lo.x, y: by + lo.y };
    lFeet.push({ n: i, foot: lf, face: dir + 180, bodyFace: dir + 180, bx: lb.x, by: lb.y, x: lb.x + Math.cos(rad(dir + 180 + lsd)) * 0.09, y: lb.y + Math.sin(rad(dir + 180 + lsd)) * 0.09 });
    steps.push({ desc: "", align: "", turn: "" });
  }
  return {
    m: { start: { x: a.x, y: a.y, face: dir }, feet: mFeet },
    l: { start: { x: a.x + lo.x, y: a.y + lo.y, face: dir + 180 }, feet: lFeet },
    steps,
  };
}

/** Build the routine track from the plan's segments. `nums` = figure number per segment (0 = preparatory). */
export function routineTrack(segments: SimSegment[], nums: number[]): Track | null {
  const mStartFeet: Foot[] = [];
  const lStartFeet: Foot[] = [];
  const man: FloorStep[] = [];
  const lady: FloorStep[] = [];
  const beats: number[] = [];
  const labels: string[] = [];
  const groups: NonNullable<Track["groups"]> = [];
  const side: number[] = [];
  let mStart: Partner["start"] | null = null;
  let lStart: Partner["start"] | null = null;
  let face = 0; // man's facing in the room at the end of the previous figure
  const estimated: boolean[] = [];
  let segEstimated = false;
  let startPos = "";

  segments.forEach((seg, si) => {
    const it = seg.placed.item;
    const steps = it.steps ?? it.animSteps ?? null;
    const counts = it.counts ?? [];
    let m: Partner;
    let l: Partner;
    let ms: FloorStep[];
    let ls: FloorStep[];
    if (steps && steps.length) {
      const hasLady = !!(it.ladySteps?.length || it.animLady?.length);
      ls = hasLady ? ((it.ladySteps ?? it.animLady) as FloorStep[]).slice(0, steps.length) : mirrorSteps(steps);
      segEstimated = !hasLady;
      ms = steps;
      // Traced by the plan: its rotation and turn. Latin (not traced): continue from the facing.
      const tr = it.steps
        ? { rotate: seg.placed.rotate, extraTurn: it.extraTurn ?? 0, scales: it.stepScales, initialFacing: seg.placed.init }
        : { initialFacing: norm180(face - seg.side * 90) };
      const geo = coupleGeometry(
        { stepM: it.stepMetres ?? STEP_METRES, hint: it.turnHint ?? 0, latin: !!it.latin, startPos: it.startPos ?? steps[0]?.pos ?? "" },
        ms,
        ls,
        tr,
      );
      m = toRoom(geo.m, seg.placed.x, seg.placed.y, seg.side);
      l = toRoom(geo.l ?? geo.m, seg.placed.x, seg.placed.y, seg.side);
      if (!startPos) startPos = it.startPos ?? steps[0]?.pos ?? "";
    } else {
      const w = walkAlong(seg, counts.length || 2, face, !!it.latin);
      m = w.m;
      l = w.l;
      ms = w.steps;
      ls = w.steps;
      segEstimated = true;
    }
    if (!mStart) {
      mStart = m.start;
      lStart = l.start;
      side.push(seg.side);
    }
    const from = man.length;
    const count = Math.min(m.feet.length, l.feet.length, ms.length);
    for (let i = 0; i < count; i++) {
      mStartFeet.push({ ...m.feet[i], n: from + i + 1 });
      lStartFeet.push({ ...l.feet[i], n: from + i + 1 });
      man.push(ms[i]);
      lady.push(ls[i] ?? ms[i]);
      beats.push(counts[i]?.beats ?? 1);
      labels.push(counts[i]?.label ?? "·");
      side.push(seg.side);
      estimated.push(segEstimated);
    }
    if (count) face = m.feet[count - 1].bodyFace;
    const no = nums[si] === 0 ? "P" : String(nums[si] ?? si + 1);
    if (man.length > from) groups.push({ no, label: seg.label, from, to: man.length });
  });
  if (!mStart || !lStart || !man.length) return null;
  return {
    m: { start: mStart, feet: mStartFeet },
    l: { start: lStart, feet: lStartFeet },
    man,
    lady,
    beats,
    labels,
    startPos,
    ladyEstimated: estimated,
    groups,
    side,
  };
}
