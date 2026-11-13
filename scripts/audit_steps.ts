// Step-level check of every figure schema (man and lady):
//   dir    – the stepping foot goes the way its description says (fwd / bwd / side, L left, R right)
//   foot   – two weight steps in a row on the same foot (without a tap / point in between)
//   weight – after a weight step the dancer doesn't stand on the stepping foot
//   count  – number of chart steps differs from the timing
//   start  – first foot differs from the syllabus start
//   spread – feet further apart than a stride / crossed feet on the wrong side
// Run: npm run audit:steps   (-v prints every finding)
import { FIGURES, getDance } from "../src/data";
import { chartSteps, norm180, type FloorStep } from "../src/floor";
import { parseTiming } from "../src/timing";
import { figureGeometry, liveFeet, type FeetState, type Partner } from "../src/playerGeometry";

type Finding = { id: string; name: string; kind: string; what: string };
const out: Finding[] = [];
const verbose = process.argv.includes("-v");
const only = process.argv.find((a) => a.startsWith("--kind="))?.slice(7);
const NO_WEIGHT = /w\/o weight|without weight|\btap\b|\bpoint|\bbrush|\bflick|\bkick/i;
const deg = (x: number, y: number) => (Math.atan2(y, x) * 180) / Math.PI;

function checkPartner(fig: (typeof FIGURES)[number], who: string, p: Partner, st: FeetState[], steps: FloorStep[]) {
  const add = (kind: string, what: string) => out.push({ id: fig.id, name: fig.en ?? fig.cs, kind, what: `${who} ${what}` });
  let lastWeightFoot: string | null = null;
  steps.forEach((s, i) => {
    const d = s.desc.toLowerCase();
    const f = p.feet[i];
    if (!f) return;
    const prev = st[i];
    const now = st[i + 1];
    const foot = f.foot;
    const noW = NO_WEIGHT.test(d);
    // --- direction of the stepping foot relative to the body before the step
    if (foot && now && !now.transfer && !/cross|close|in place|recover|swivel|pivot|spin|replace|together|feet|both/.test(d)) {
      // where the foot lands relative to the supporting (other) foot
      const from = now[foot === "L" ? "R" : "L"];
      const to = now[foot];
      const dx = to.x - from.x;
      const dy = to.y - from.y;
      const len = Math.hypot(dx, dy);
      const bodyBefore = i === 0 ? p.start.face : p.feet[i - 1].bodyFace;
      // the chart's own direction of the step (after turns before the step)
      const ref = f.face;
      if (len > 0.12) {
        // the turn may happen before, on or after the step: any of the facings may apply
        const rels = [ref, bodyBefore, f.bodyFace].map((r) => norm180(deg(dx, dy) - r));
        const rel = rels[0];
        const main = (["fwd", "bwd", "side"] as const)
          .map((k) => ({ k, at: d.search(k === "fwd" ? /\bfwd\b|forward/ : k === "bwd" ? /\bbwd\b|\bback\b/ : /\bside\b/) }))
          .filter((x) => x.at >= 0)
          .sort((a, b) => a.at - b.at)[0]?.k;
        const fits = (r: number) =>
          main === "fwd" ? Math.abs(r) < 75 : main === "bwd" ? Math.abs(r) > 105 : main === "side" ? (foot === "L" ? r > 15 && r < 165 : r < -15 && r > -165) : true;
        const ok = rels.some(fits);
        if (main && !ok) add("dir", `step ${i + 1} "${s.desc}": foot goes ${rel.toFixed(0)}° from its facing (body ${norm180(bodyBefore).toFixed(0)}°)`);
      }
    }
    // --- feet alternate (weight steps)
    if (foot && !noW) {
      if (lastWeightFoot === foot && !/in place|recover|replace|weight|swivel|pivot|spin|hop|jump|chug|kick|ball|bounce|feet|both/.test(d) && !/w\/o weight|tap|point|flick|kick|brush/i.test(steps[i - 1]?.desc ?? ""))
        add("foot", `steps ${i}–${i + 1}: two weight steps on ${foot}F ("${steps[i - 1]?.desc}" → "${s.desc}")`);
      lastWeightFoot = foot;
      if (now && !now[foot].weight && !(now[foot].load && now[foot].load! > 0.5)) add("weight", `step ${i + 1} "${s.desc}": weight not on the stepping foot`);
    }
    // --- stride
    if (now) {
      const spread = Math.hypot(now.L.x - now.R.x, now.L.y - now.R.y);
      if (spread > 1.1) add("spread", `step ${i + 1}: feet ${spread.toFixed(2)} m apart`);
    }
  });
}

for (const fig of FIGURES) {
  if (!fig.floor?.steps.length) continue;
  const dance = getDance(fig.dance);
  const man = chartSteps(fig);
  const lady = (fig.floor.ladySteps ?? []).slice(0, Math.max(man.length, 1));
  const g = figureGeometry(fig, dance, man, lady);
  if (process.argv.includes("--solo")) {
    // each partner alone (no couple placement): tells chart problems from placement ones
    const gm = figureGeometry(fig, dance, man, []);
    checkPartner(fig, "man", gm.m, liveFeet(gm.m, man), man);
    continue;
  }
  checkPartner(fig, "man", g.m, liveFeet(g.m, man), man);
  if (g.l && lady.length) checkPartner(fig, "lady", g.l, liveFeet(g.l, lady), lady);
  // timing count
  const timing = fig.syllabus?.timing;
  if (timing && dance) {
    const n = parseTiming(timing, dance).length;
    if (n && Math.abs(n - man.length) > 0) out.push({ id: fig.id, name: fig.en ?? "", kind: "count", what: `${man.length} chart steps, timing "${timing}" has ${n}` });
  }
  // start foot
  const sf = fig.syllabus?.start?.match(/\b(RF|LF)\b/)?.[1];
  const cf = man[0]?.desc.match(/\b(RF|LF)\b/)?.[1];
  if (sf && cf && sf !== cf) out.push({ id: fig.id, name: fig.en ?? "", kind: "start", what: `syllabus starts ${sf}, chart ${cf} ("${man[0].desc}")` });
}

const kinds = new Map<string, Set<string>>();
for (const f of out) {
  if (!kinds.has(f.kind)) kinds.set(f.kind, new Set());
  kinds.get(f.kind)!.add(f.id);
}
for (const f of out) if (verbose && (!only || f.kind === only)) console.log(`${f.kind.padEnd(7)} ${f.id.padEnd(13)} ${f.name.slice(0, 28).padEnd(28)} ${f.what}`);
console.log(Object.fromEntries([...kinds].map(([k, v]) => [k, `${out.filter((f) => f.kind === k).length} findings / ${v.size} figures`])));
