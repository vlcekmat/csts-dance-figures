// "Teeth" in the figure schemas: the body path of a partner goes one way and
// straight back (or jumps sideways and back) although the steps don't. Compares the
// final player geometry with the raw traced path of each partner's own chart.
// Run: npm run audit:teeth
import { FIGURES, getDance } from "../src/data";
import { STEP_BY_DANCE, STEP_METRES, chartSteps, tracePath, turnHintOf } from "../src/floor";
import { figureGeometry, type Partner } from "../src/playerGeometry";

type P = { x: number; y: number };
const ang = (a: P, b: P) => Math.atan2(b.y - a.y, b.x - a.x);
const len = (a: P, b: P) => Math.hypot(b.x - a.x, b.y - a.y);

/** Indices i where the path goes a -> b -> c with a sharp reversal (both legs long enough). */
function teeth(pts: P[], minLeg = 0.12, minAngle = 125): number[] {
  const out: number[] = [];
  for (let i = 1; i + 1 < pts.length; i++) {
    const l1 = len(pts[i - 1], pts[i]);
    const l2 = len(pts[i], pts[i + 1]);
    if (l1 < minLeg || l2 < minLeg) continue;
    let d = Math.abs(((ang(pts[i], pts[i + 1]) - ang(pts[i - 1], pts[i])) * 180) / Math.PI) % 360;
    if (d > 180) d = 360 - d;
    if (d > minAngle) out.push(i);
  }
  return out;
}

const bodyPts = (p: Partner): P[] => [p.start, ...p.feet.map((f) => ({ x: f.bx, y: f.by }))];

let n = 0;
const rows: string[] = [];
const verbose = process.argv.includes("-v");
for (const fig of FIGURES) {
  if (!fig.floor?.steps.length) continue;
  const dance = getDance(fig.dance);
  const man = chartSteps(fig);
  const lady = (fig.floor.ladySteps ?? []).slice(0, Math.max(man.length, 1));
  const g = figureGeometry(fig, dance, man, lady);
  const stepM = STEP_BY_DANCE[fig.dance] ?? STEP_METRES;
  const raw = (steps: typeof man, hint: -1 | 0 | 1) =>
    tracePath(steps, 0, 0, 0, hint, 0, null).map((p) => ({ x: p.x * stepM, y: p.y * stepM }));
  const hint = turnHintOf(fig.en);
  const rm = new Set(teeth(raw(man, hint)));
  const rl = new Set(lady.length ? teeth(raw(lady, (-hint || 0) as -1 | 0 | 1)) : []);
  const tm = teeth(bodyPts(g.m)).filter((i) => !rm.has(i));
  const tl = g.l ? teeth(bodyPts(g.l)).filter((i) => !rl.has(i)) : [];
  if (tm.length || tl.length) {
    n++;
    rows.push(`${fig.id.padEnd(14)} ${(fig.en ?? "").slice(0, 34).padEnd(34)} man@${tm.join(",") || "-"} lady@${tl.join(",") || "-"}`);
  }
  if (verbose && (rm.size || rl.size)) rows.push(`   (chart itself: man@${[...rm].join(",") || "-"} lady@${[...rl].join(",") || "-"})`);
}
console.log(rows.join("\n"));
console.log(`${n} figures with artificial teeth`);
