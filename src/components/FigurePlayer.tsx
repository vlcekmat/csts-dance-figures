// Step-by-step playback of one figure: the man's and the lady's footprints
// (WDSF technique charts), where each partner stands and faces on every step
// and the couple position. Top view, LOD to the right, wall at the bottom.
import { useEffect, useMemo, useState } from "react";
import { getDance, type Figure } from "../data";
import { useI18n } from "../i18n";
import { Glossed } from "./Glossary";
import { localizePositions, localizeStep, localizeTurn } from "../glossary";
import {
  STEP_BY_DANCE,
  STEP_METRES,
  alignLabel,
  chartSteps,
  norm180,
  parseAlign,
  tracePath,
  turnHintOf,
  type FloorStep,
} from "../floor";
import { parseTiming, positionOf, tempoBpm } from "../timing";

type Role = "man" | "lady" | "both";

interface Foot {
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
function promenadeSide(pos: string): number {
  const parts = pos.toLowerCase().split(/\s+(?:to|then)\s+(?=[a-z])/);
  const p = parts[parts.length - 1] ?? "";
  if (/counter prom|\bcpp\b|cnt prom/.test(p)) return -1;
  if (/promenade|\bpp\b|\bprom\b/.test(p)) return 1;
  return 0;
}

/** Couple positions danced in a closed hold: the partners turn around their common centre. */
function closeHold(pos: string): boolean {
  const parts = pos.toLowerCase().split(/\s+(?:to|then)\s+(?=[a-z])/);
  const p = parts[parts.length - 1] ?? "";
  if (/\bopen\b|ex\.? open|apart|\bfan\b|side same|side by side|shadow|tandem/.test(p)) return false;
  return /clos|promenade|\bpp\b|outside partner|\bop\b|fallaway|wing|contra/.test(p);
}

/** Signed amount of turn of a chart step (degrees, + = left), or null. */
function signedTurn(text: string | undefined): number | null {
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

function ladyOffset(pos: string, latin: boolean): { fwd: number; right: number } {
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

export function FigurePlayer({ fig }: { fig: Figure }) {
  const { t, lang } = useI18n();
  const dance = getDance(fig.dance);
  const man = useMemo(() => chartSteps(fig), [fig]);
  const lady = useMemo(() => (fig.floor?.ladySteps ?? []).slice(0, Math.max(man.length, 1)), [fig, man.length]);
  const hasLady = lady.length > 0;
  const [role, setRole] = useState<Role>(hasLady ? "both" : "man");
  const [k, setK] = useState(0); // 0 = starting position, n = after step n
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(0.5);
  // Smooth playback: the partners glide between the steps instead of jumping.
  const [smooth, setSmooth] = useState(true);
  const [frac, setFrac] = useState(0); // progress from step k towards step k + 1 (0–1)
  const n = man.length;

  // Reset when the figure changes.
  useEffect(() => {
    setK(0);
    setPlaying(false);
    setRole(hasLady ? "both" : "man");
  }, [fig.id, hasLady]);

  const geo = useMemo(() => {
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
  }, [fig, man, lady, hasLady, dance]);

  // Playback: wait the step's duration at the competition tempo (scaled by speed).
  const beats = useMemo(() => {
    const timing = fig.syllabus?.timing;
    const parsed = timing && dance ? parseTiming(timing, dance) : [];
    return man.map((_, i) => parsed[i]?.beats ?? 1);
  }, [fig, dance, man]);
  const stepMs = (i: number) => {
    const bpm = (dance && tempoBpm(dance)) || 30;
    const beatsPerMin = bpm * (dance?.beatsPerBar ?? 4);
    return Math.max(250, ((beats[i] ?? 1) * 60000) / beatsPerMin / speed);
  };
  useEffect(() => {
    if (!playing) setFrac(0);
  }, [playing]);
  useEffect(() => {
    if (!playing || !smooth) return;
    let raf = 0;
    let last = performance.now();
    let kk = k >= n ? 0 : k;
    let ff = 0;
    const tick = (now: number) => {
      ff += (now - last) / stepMs(kk);
      last = now;
      while (ff >= 1 && kk < n) {
        ff -= 1;
        kk += 1;
      }
      if (kk >= n) {
        setK(n);
        setFrac(0);
        setPlaying(false);
        return;
      }
      setK(kk);
      setFrac(ff);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, smooth, speed]);
  useEffect(() => {
    if (!playing || smooth) return;
    if (k >= n) {
      setPlaying(false);
      return;
    }
    const bpm = (dance && tempoBpm(dance)) || 30;
    const beatsPerMin = bpm * (dance?.beatsPerBar ?? 4);
    const ms = ((beats[k] ?? 1) * 60000) / beatsPerMin / speed;
    const id = window.setTimeout(() => setK((v) => v + 1), Math.max(250, ms));
    return () => window.clearTimeout(id);
  }, [playing, smooth, k, n, beats, dance, speed]);

  if (!n) return null;

  const showMan = role !== "lady";
  const showLady = role !== "man" && !!geo.l;
  const all = [
    geo.m.start,
    ...geo.m.feet,
    ...(geo.l ? [geo.l.start, ...geo.l.feet] : []),
  ];
  const minX = Math.min(...all.map((p) => p.x)) - 0.45;
  const maxX = Math.max(...all.map((p) => p.x)) + 0.45;
  const minY = Math.min(...all.map((p) => p.y)) - 0.45;
  const maxY = Math.max(...all.map((p) => p.y)) + 0.45;
  const S = Math.min(120, 560 / (maxX - minX));
  const VW = Math.max(320, (maxX - minX) * S + 60);
  const VH = Math.max(200, (maxY - minY) * S + 60);
  const ox = (VW - (maxX - minX) * S) / 2;
  const oy = (VH - (maxY - minY) * S) / 2;
  const X = (x: number) => ox + (x - minX) * S;
  const Y = (y: number) => VH - oy - (y - minY) * S;
  const footLen = 0.23 * S;
  const footW = 0.095 * S;
  const gridX: number[] = [];
  for (let g = Math.ceil(minX * 2) / 2; g <= maxX; g += 0.5) gridX.push(g);
  const gridY: number[] = [];
  for (let g = Math.ceil(minY * 2) / 2; g <= maxY; g += 0.5) gridY.push(g);

  /** Body of a partner after step k: position and facing. */
  const bodyAfter = (p: { start: { x: number; y: number; face: number }; feet: Foot[] }, i: number) =>
    i === 0 ? { x: p.start.x, y: p.start.y, face: p.start.face } : { x: p.feet[i - 1].bx, y: p.feet[i - 1].by, face: p.feet[i - 1].bodyFace };
  /** Body after step k, during smooth playback part of the way to step k + 1. */
  const bodyAt = (p: { start: { x: number; y: number; face: number }; feet: Foot[] }, steps: FloorStep[]) => {
    const a = bodyAfter(p, k);
    if (!frac || k >= p.feet.length) return a;
    const b = bodyAfter(p, k + 1);
    // Turn the way the chart says (direction and amount, incl. full turns), not
    // simply the shorter way round.
    let delta = norm180(b.face - a.face);
    const t = signedTurn(steps[k]?.turn);
    if (t !== null && Math.abs(t) > 1 && Math.abs(norm180(a.face + t - b.face)) < 30) delta = t;
    return { x: a.x + (b.x - a.x) * frac, y: a.y + (b.y - a.y) * frac, face: a.face + delta * frac };
  };

  const renderFeet = (p: { feet: Foot[] }, who: "man" | "lady") =>
    p.feet.map((f) => {
      const state = f.n === k || (frac > 0 && f.n === k + 1) ? "current" : f.n < k ? "done" : "future";
      return (
        <g key={`${who}${f.n}`} transform={`translate(${X(f.x)} ${Y(f.y)}) rotate(${-f.face})`} className={`fp-step ${state}`}>
          <path
            d={`M ${footLen / 2} 0 C ${footLen / 2} ${-footW / 2}, ${-footLen / 3} ${-footW / 2}, ${-footLen / 2} ${-footW / 3} L ${-footLen / 2} ${footW / 3} C ${-footLen / 3} ${footW / 2}, ${footLen / 2} ${footW / 2}, ${footLen / 2} 0 Z`}
            className={`fp-foot ${who} ${f.foot === "L" ? "left" : f.foot === "R" ? "right" : ""}`}
          />
          <text transform={`rotate(${f.face})`} y={4} textAnchor="middle" className={`fp-foot-num ${f.foot === "R" ? "on-dark" : ""}`}>
            {f.n}
          </text>
        </g>
      );
    });

  const renderBody = (b: { x: number; y: number; face: number }, who: "man" | "lady") => (
    <g transform={`translate(${X(b.x)} ${Y(b.y)}) rotate(${-b.face})`} className={`fp-body ${who}`}>
      {/* shoulders across the facing direction, nose = small triangle in front */}
      <ellipse rx={0.09 * S} ry={0.21 * S} />
      <path d={`M ${0.1 * S} ${-0.06 * S} L ${0.2 * S} 0 L ${0.1 * S} ${0.06 * S} Z`} />
      <text transform={`rotate(${b.face})`} y={4} textAnchor="middle" className="fp-body-label">
        {who === "man" ? t("roleManShort") : t("roleLadyShort")}
      </text>
    </g>
  );

  const ms = k > 0 ? man[k - 1] : null;
  const ls = k > 0 && hasLady ? lady[k - 1] : null;
  const pos = (ms ?? man[0])?.pos;
  const mBody = bodyAt(geo.m, man);
  const lBody = geo.l ? bodyAt(geo.l, lady) : null;

  return (
    <figure className="floor figure-floor player">
      <div className="player-bar" role="group" aria-label={t("playerTitle")}>
        {hasLady && (
          <div className="seg-toggle" role="radiogroup" aria-label={t("playerRole")}>
            {(["man", "lady", "both"] as Role[]).map((r) => (
              <button key={r} role="radio" aria-checked={role === r} className={role === r ? "active" : ""} onClick={() => setRole(r)}>
                {t(r === "man" ? "roleMan" : r === "lady" ? "roleLady" : "roleBoth")}
              </button>
            ))}
          </div>
        )}
        <div className="player-controls">
          <button className="icon-btn" onClick={() => { setPlaying(false); setK(0); }} aria-label={t("playerStart")} title={t("playerStart")}>⏮</button>
          <button className="icon-btn" disabled={k === 0} onClick={() => { setPlaying(false); setK((v) => Math.max(0, v - 1)); }} aria-label={t("playerPrev")} title={t("playerPrev")}>◀</button>
          <button
            className="btn small primary"
            onClick={() => {
              if (!playing && k >= n) setK(0);
              setPlaying((p) => !p);
            }}
          >
            {playing ? `⏸ ${t("playerPause")}` : `▶ ${t("playerPlay")}`}
          </button>
          <button className="icon-btn" disabled={k >= n} onClick={() => { setPlaying(false); setK((v) => Math.min(n, v + 1)); }} aria-label={t("playerNext")} title={t("playerNext")}>▶</button>
          <select value={speed} onChange={(e) => setSpeed(+e.target.value)} aria-label={t("playerSpeed")} title={t("playerSpeed")}>
            <option value={0.25}>0,25×</option>
            <option value={0.5}>0,5×</option>
            <option value={1}>1× ({t("playerTempo")})</option>
          </select>
          <label className="check small player-smooth">
            <input type="checkbox" checked={smooth} onChange={(e) => setSmooth(e.target.checked)} />
            {t("playerSmooth")}
          </label>
        </div>
        <input
          type="range"
          min={0}
          max={n}
          value={k}
          onChange={(e) => { setPlaying(false); setK(+e.target.value); }}
          aria-label={t("playerStep")}
          className="player-slider"
        />
      </div>

      <svg viewBox={`0 0 ${VW} ${VH}`} role="img" aria-label={t("floorFigure")}>
        {gridX.map((g) => (
          <line key={`gx${g}`} x1={X(g)} y1={0} x2={X(g)} y2={VH} className={`fp-grid ${Number.isInteger(g) ? "major" : ""}`} />
        ))}
        {gridY.map((g) => (
          <line key={`gy${g}`} x1={0} y1={Y(g)} x2={VW} y2={Y(g)} className={`fp-grid ${Number.isInteger(g) ? "major" : ""}`} />
        ))}
        <text x={12} y={20} className="fp-label strong">LOD →</text>
        <text x={VW - 10} y={20} textAnchor="end" className="fp-label">↑ {t("floorCentre")}</text>
        <line x1={6} y1={VH - 4} x2={VW - 6} y2={VH - 4} className="fp-wall" />
        <text x={VW - 10} y={VH - 10} textAnchor="end" className="fp-label">{t("floorWall")} ↓</text>
        <line x1={12} y1={VH - 16} x2={12 + S} y2={VH - 16} className="fp-scale" />
        <text x={16 + S} y={VH - 12} className="fp-label">1 m</text>

        {showMan && (
          <polyline points={[geo.m.start, ...geo.m.feet.map((f) => ({ x: f.bx, y: f.by }))].map((p) => `${X(p.x)},${Y(p.y)}`).join(" ")} className="fp-weight man" />
        )}
        {showLady && geo.l && (
          <polyline points={[geo.l.start, ...geo.l.feet.map((f) => ({ x: f.bx, y: f.by }))].map((p) => `${X(p.x)},${Y(p.y)}`).join(" ")} className="fp-weight lady" />
        )}
        {showMan && renderFeet(geo.m, "man")}
        {showLady && geo.l && renderFeet(geo.l, "lady")}
        {showMan && renderBody(mBody, "man")}
        {showLady && lBody && renderBody(lBody, "lady")}
      </svg>

      <div className="player-info" aria-live="polite">
        <div className="player-step">
          {k === 0 ? (
            <strong>{t("playerStartPos")}</strong>
          ) : (
            <strong>
              {t("playerStepN", { n: String(k), of: String(n) })}
              {ms?.timing ? ` · ${t("playerCount")} ${ms.timing}` : ""}
            </strong>
          )}
          {pos && (
            <span>
              {" "}· {t("playerPosition")}: <Glossed text={localizePositions(pos, lang)} />
            </span>
          )}
        </div>
        <table className="breakdown player-table">
          <tbody>
            {showMan && (
              <tr>
                <th scope="row">{t("roleMan")}</th>
                <td><Glossed text={ms ? localizeStep(ms.desc, lang) : "–"} /></td>
                <td>{alignLabel(mBody.face, lang)}</td>
                <td>{ms?.turn ? <Glossed text={localizeTurn(ms.turn, lang)} /> : ""}</td>
              </tr>
            )}
            {showLady && lBody && (
              <tr>
                <th scope="row">{t("roleLady")}</th>
                <td><Glossed text={ls ? localizeStep(ls.desc, lang) : "–"} /></td>
                <td>{alignLabel(lBody.face, lang)}</td>
                <td>{ls?.turn ? <Glossed text={localizeTurn(ls.turn, lang)} /> : ""}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <figcaption className="small muted">{t(hasLady ? "playerHint" : "playerHintManOnly")}</figcaption>
    </figure>
  );
}
