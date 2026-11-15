// Feet that move when they shouldn't: on a step only the stepping foot travels; the
// supporting foot stays where it is (it may swivel). On a weight transfer no foot travels.
// Also reports how far the body ends up from the middle of the feet.
// Run: npm run audit:feet  (-v lists the steps)
import { FIGURES, getDance } from "../src/data";
import { chartSteps } from "../src/floor";
import { figureGeometry, liveFeet, type Partner } from "../src/playerGeometry";
import type { FloorStep } from "../src/floor";

const verbose = process.argv.includes("-v");
const TOL = Number(process.env.TOL ?? 0.03);
let steps = 0;
let slides = 0;
let slideSum = 0;
let maxSlide = 0;
let bodyOff = 0;
let bodyOffMax = 0;
const figs = new Set<string>();
const rows: string[] = [];
const check = (id: string, who: string, p: Partner, chart: FloorStep[]) => {
  const st = liveFeet(p, chart);
  for (let i = 1; i < st.length; i++) {
    const a = st[i - 1];
    const b = st[i];
    const f = p.feet[i - 1];
    if (!b.moved) continue;
    steps++;
    const still = b.transfer ? (["L", "R"] as const) : ([b.moved === "L" ? "R" : "L"] as const);
    for (const k of still) {
      const d = Math.hypot(b[k].x - a[k].x, b[k].y - a[k].y);
      if (d > TOL) {
        slides++;
        slideSum += d;
        maxSlide = Math.max(maxSlide, d);
        figs.add(id);
        if (verbose) rows.push(`${id} ${who} step ${i} (${chart[i - 1]?.desc}) ${k} slides ${d.toFixed(2)} m${b.transfer ? " [transfer]" : ""}`);
      }
    }
    const off = Math.hypot(f.bx - (b.L.x + b.R.x) / 2, f.by - (b.L.y + b.R.y) / 2);
    bodyOff += off;
    bodyOffMax = Math.max(bodyOffMax, off);
  }
};
for (const fig of FIGURES) {
  if (!fig.floor?.steps.length) continue;
  const man = chartSteps(fig);
  const lady = (fig.floor.ladySteps ?? []).slice(0, Math.max(man.length, 1));
  const g = figureGeometry(fig, getDance(fig.dance), man, lady);
  check(fig.id, "man", g.m, man);
  if (g.l) check(fig.id, "lady", g.l, lady);
}
if (verbose) console.log(rows.join("\n"));
console.log(
  `steps ${steps}, sliding feet ${slides} in ${figs.size} figures (avg ${(slideSum / (slides || 1)).toFixed(2)} m, max ${maxSlide.toFixed(2)} m); ` +
    `body off the feet: avg ${(bodyOff / (steps || 1)).toFixed(2)} m, max ${bodyOffMax.toFixed(2)} m`,
);
