// Sanity check of the figure player schemas for every figure: partner distance per
// couple position, facing jumps without a charted turn, figures danced on the spot
// that travel, lady drifting away. Run: npm run audit
import { FIGURES, getDance } from "../src/data";
import { chartSteps, norm180 } from "../src/floor";
import { closeHold, figureGeometry, signedTurn } from "../src/playerGeometry";

const ON_SPOT = /spot|in place|stationary|underarm|natural top|alemana|maypole|volta spot|turkish|hockey|fan\b|swivel/i;
type Issue = { id: string; name: string; what: string };
const issues: Issue[] = [];
let checked = 0;

for (const fig of FIGURES) {
  if (!fig.floor?.steps.length) continue;
  const dance = getDance(fig.dance);
  const man = chartSteps(fig);
  const lady = (fig.floor.ladySteps ?? []).slice(0, Math.max(man.length, 1));
  const { m, l } = figureGeometry(fig, dance, man, lady);
  checked++;
  const add = (what: string) => issues.push({ id: fig.id, name: fig.en ?? fig.cs, what });
  let pos = "";
  m.feet.forEach((mf, i) => {
    pos = man[i]?.pos || pos;
    const lf = l?.feet[i];
    if (lf) {
      const d = Math.hypot(lf.bx - mf.bx, lf.by - mf.by);
      const close = closeHold(pos);
      if (close && (d < 0.15 || d > 0.75)) add(`step ${i + 1}: partners ${d.toFixed(2)} m apart in "${pos}"`);
      if (!close && d > 2.2) add(`step ${i + 1}: partners ${d.toFixed(2)} m apart ("${pos || "?"}")`);
    }
    if (i > 0) {
      const prev = m.feet[i - 1];
      const jump = Math.abs(norm180(mf.bodyFace - prev.bodyFace));
      const t = man[i]?.rot ?? man[i - 1]?.rot ?? signedTurn(man[i]?.turn) ?? signedTurn(man[i - 1]?.turn);
      if (jump > 100 && (t === null || Math.abs(t) < jump - 60)) add(`step ${i + 1}: man turns ${jump.toFixed(0)}° without a charted turn`);
    }
  });
  const last = m.feet[m.feet.length - 1];
  const travel = last ? Math.hypot(last.bx - m.start.x, last.by - m.start.y) : 0;
  if (ON_SPOT.test(fig.en ?? "") && travel > 1.6) add(`man travels ${travel.toFixed(1)} m in a figure danced around one spot`);
}

const byDance = new Map<string, number>();
for (const i of issues) byDance.set(i.id.split("-")[0], (byDance.get(i.id.split("-")[0]) ?? 0) + 1);
for (const i of issues) console.log(`${i.id.padEnd(14)} ${i.name.slice(0, 32).padEnd(32)} ${i.what}`);
console.log(`\n${checked} figures checked, ${issues.length} issues`, Object.fromEntries(byDance));
