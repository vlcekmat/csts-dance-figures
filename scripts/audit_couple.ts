// Audit of what the figure player draws, frame by frame (incl. smooth playback):
//   dir      – a dancer turns against the chart's direction
//   onlyone  – in a closed hold one partner turns and the other one doesn't
//   twist    – a foot points far from the body (feet twisted)
//   onefoot  – during a step one foot turns much more than the other (a spin on one foot only)
//   tangle   – the partners run into each other (bodies / feet overlapping, paths crossing)
//   finish   – the figure ends in another couple position than the syllabus says
// Run: npm run audit:couple [-- -v] [--kind=dir|onlyone|twist|tangle|finish]
import { FIGURES, getDance } from "../src/data";
import { chartSteps, norm180, relativeFacing } from "../src/floor";
import { closeHold, couplePose, feetBetween, figureGeometry, ladyOffset, liveFeet, promenadeSide, signedTurn, turnSign, type FeetState } from "../src/playerGeometry";
import { positionOf } from "../src/timing";

const args = process.argv.slice(2);
const verbose = args.includes("-v");
const only = args.find((a) => a.startsWith("--kind="))?.slice(7);
const KINDS = ["dir", "onlyone", "twist", "onefoot", "tangle", "finish"] as const;
type Kind = (typeof KINDS)[number];
const found: { id: string; kind: Kind; what: string }[] = [];
let checked = 0;
let steps = 0;

const endOf = (pos: string) => (pos.split(/\s+(?:to|then)\s+(?=[A-Za-z])/).pop() ?? "").trim();
const chartSign = (st: { rot?: number; turn: string } | undefined) => {
  if (!st) return 0;
  const t = st.rot ?? signedTurn(st.turn);
  if (t !== null && Math.abs(t) > 1) return Math.sign(t);
  return turnSign(st.turn);
};
const segCross = (a: P, b: P, c: P, d: P) => {
  const o = (p: P, q: P, r: P) => (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
  return o(a, b, c) * o(a, b, d) < 0 && o(c, d, a) * o(c, d, b) < 0;
};
type P = { x: number; y: number };

for (const fig of FIGURES) {
  if (!fig.floor?.steps.length) continue;
  const dance = getDance(fig.dance);
  const man = chartSteps(fig);
  const lady = (fig.floor.ladySteps ?? []).slice(0, Math.max(man.length, 1));
  const geo = figureGeometry(fig, dance, man, lady);
  checked++;
  const latin = dance?.discipline === "latin";
  const seen = new Set<string>();
  const add = (kind: Kind, what: string) => {
    // one finding per kind and step
    const key = `${kind}|${what.split(":")[0]}`;
    if (seen.has(key)) return;
    seen.add(key);
    found.push({ id: fig.id, kind, what });
  };
  const mF = liveFeet(geo.m, man);
  const lF = geo.l ? liveFeet(geo.l, lady) : null;
  const n = geo.m.feet.length;
  steps += n;
  let pos = positionOf(fig.syllabus?.start) ?? man[0]?.pos ?? "";
  for (let k = 0; k < n; k++) {
    const stepPos = man[k]?.pos || pos;
    const holdPos = man[k]?.pos || man[k - 1]?.pos || "";
    pos = stepPos;
    const s = `step ${k + 1}`;
    // --- direction of turn
    for (const [who, p, chart] of [["man", geo.m, man], ["lady", geo.l, lady]] as const) {
      const f = p?.feet[k];
      if (!f || f.turn === undefined) continue;
      const sign = chartSign(chart[k]);
      if (sign && Math.abs(f.turn) > 45 && Math.sign(f.turn) !== sign) add("dir", `${s}: ${who} turns ${f.turn.toFixed(0)}° but the chart says ${sign < 0 ? "R" : "L"} ("${chart[k]?.turn}")`);
    }
    // --- one partner turns, the other doesn't (closed hold)
    const mt = geo.m.feet[k]?.turn;
    const lt = geo.l?.feet[k]?.turn;
    // (standard: body contact; latin "close" holds let the lady turn under the arm)
    const prevPos = k > 0 ? man[k - 1]?.pos || "" : positionOf(fig.syllabus?.start) ?? stepPos;
    const r0 = relativeFacing(prevPos);
    const r1 = relativeFacing(stepPos);
    const expect = mt !== undefined ? mt + (r0 !== null && r1 !== null ? norm180(r1 - r0) : 0) : 0;
    if (!latin && mt !== undefined && lt !== undefined && closeHold(holdPos) && closeHold(stepPos) && Math.abs(expect - lt) > 75)
      add("onlyone", `${s}: man turns ${mt.toFixed(0)}°, lady ${lt.toFixed(0)}° (expected about ${expect.toFixed(0)}°) in "${endOf(holdPos)}"`);
    // --- how much each foot turns during the step (sampled like the player)
    for (const [who, st] of [["man", mF], ["lady", lF]] as const) {
      if (!st || !st[k + 1]) continue;
      const rot = { L: 0, R: 0 };
      let prev = st[k];
      for (let j = 1; j <= 20; j++) {
        const cur = j === 20 ? st[k + 1] : feetBetween(st[k], st[k + 1], j / 20);
        for (const side of ["L", "R"] as const) rot[side] += norm180(cur[side].face - prev[side].face);
        prev = cur;
      }
      if (Math.abs(rot.L - rot.R) > 150) add("onefoot", `${s}: ${who}'s L foot turns ${rot.L.toFixed(0)}°, R foot ${rot.R.toFixed(0)}°`);
    }
    // --- frames
    let prevM: P | null = null;
    let prevL: P | null = null;
    for (const t of [0, 0.25, 0.5, 0.75, 1]) {
      const pose = t === 1 ? couplePose(geo, man, k + 1, 0) : couplePose(geo, man, k, t);
      const fm: FeetState = t === 1 ? mF[k + 1] : feetBetween(mF[k], mF[k + 1], t);
      const fl: FeetState | null = lF && lF[k + 1] ? (t === 1 ? lF[k + 1] : feetBetween(lF[k], lF[k + 1], t)) : null;
      for (const [who, b, ft] of [["man", pose.m, fm], ["lady", pose.l, fl]] as const) {
        if (!b || !ft) continue;
        for (const side of ["L", "R"] as const) {
          const foot = ft[side];
          const off = Math.abs(norm180(foot.face - b.face));
          const moving = ft.moved === side && t > 0 && t < 1;
          if (off > 110 && !moving) add("twist", `${s}: ${who}'s ${side} foot points ${off.toFixed(0)}° from the body (t=${t})`);
        }
        if (t === 1 && Math.abs(norm180(ft.L.face - ft.R.face)) > 130) add("twist", `${s}: ${who}'s feet ${Math.abs(norm180(ft.L.face - ft.R.face)).toFixed(0)}° apart`);
      }
      if (pose.l && fl) {
        const d = Math.hypot(pose.l.x - pose.m.x, pose.l.y - pose.m.y);
        if (d < 0.2) add("tangle", `${s}: bodies ${d.toFixed(2)} m apart (t=${t})`);
        // feet standing on the same spot (not while one of them is in the air)
        if (t === 0 || t === 1)
          for (const a of ["L", "R"] as const)
            for (const c of ["L", "R"] as const) {
              const fd = Math.hypot(fm[a].x - fl[c].x, fm[a].y - fl[c].y);
              if (fd < 0.08) add("tangle", `${s}: man's ${a} and lady's ${c} foot on the same spot (${fd.toFixed(2)} m, t=${t})`);
            }
        if (prevM && prevL && segCross(prevM, pose.m, prevL, pose.l)) add("tangle", `${s}: the partners walk through each other`);
        prevM = { x: pose.m.x, y: pose.m.y };
        prevL = { x: pose.l.x, y: pose.l.y };
      }
    }
  }
  // --- finish position
  const fin = positionOf(fig.syllabus?.finish);
  const last = geo.m.feet[n - 1];
  const lastL = geo.l?.feet[n - 1];
  if (fin && last && lastL) {
    const rel = relativeFacing(fin);
    const relFace = norm180(lastL.bodyFace - last.bodyFace);
    if (rel !== null && Math.abs(norm180(relFace - rel)) > 50)
      add("finish", `ends with the lady facing ${relFace.toFixed(0)}° from the man, "${fin}" wants ${rel}°`);
    const o = ladyOffset(fin, latin);
    const prom = promenadeSide(fin);
    const right = Math.sin(((last.bodyFace - 90) * Math.PI) / 180) * (lastL.by - last.by) + Math.cos(((last.bodyFace - 90) * Math.PI) / 180) * (lastL.bx - last.bx);
    const want = prom ? prom * 0.45 : o.right;
    if (Math.abs(want) >= 0.25 && Math.sign(right) !== Math.sign(want))
      add("finish", `ends with the lady on his ${right > 0 ? "right" : "left"}, "${fin}" puts her on his ${want > 0 ? "right" : "left"}`);
  }
}

const shown = found.filter((f) => !only || f.kind === only);
if (verbose || only) for (const f of shown) console.log(`${f.id.padEnd(13)} ${f.kind.padEnd(8)} ${f.what}`);
const figs = (k: Kind) => new Set(found.filter((f) => f.kind === k).map((f) => f.id)).size;
console.log(`\n${checked} figures, ${steps} steps.`);
for (const k of KINDS) console.log(`${k.padEnd(8)} ${String(found.filter((f) => f.kind === k).length).padStart(4)} findings in ${String(figs(k)).padStart(3)} figures`);
