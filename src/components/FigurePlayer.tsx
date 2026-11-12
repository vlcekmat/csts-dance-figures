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
import { parseTiming, tempoBpm } from "../timing";

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
function ladyOffset(pos: string, latin: boolean): { fwd: number; right: number } {
  // Couple position at the end of the step ("Closed Position to Promenade Position" -> PP).
  const parts = pos.toLowerCase().split(/\s+(?:to|then)\s+(?=[a-z])/);
  const p = parts[parts.length - 1] ?? "";
  if (/counter prom|\bcpp\b|cnt prom/.test(p)) return { fwd: 0.15, right: -0.35 };
  if (/promenade|\bpp\b|prom\b/.test(p)) return latin ? { fwd: 0.3, right: 0.6 } : { fwd: 0.12, right: 0.32 };
  if (/fallaway/.test(p)) return { fwd: 0, right: 0.32 };
  if (/outside partner|\bop\b/.test(p)) return { fwd: 0.3, right: -0.08 };
  if (/wing/.test(p)) return { fwd: 0.12, right: -0.32 };
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
    const off = ladyOffset(man[0]?.pos ?? "", latin);
    const f = m.start.face;
    const lx = Math.cos(rad(f)) * off.fwd + Math.cos(rad(f - 90)) * off.right;
    const ly = Math.sin(rad(f)) * off.fwd + Math.sin(rad(f - 90)) * off.right;
    const ladyCharted = lady.some((s) => parseAlign(s.align) !== null);
    const traced = hasLady ? footprints(lady, stepM, lx, ly, (-hint || 0) as -1 | 0 | 1, ladyCharted ? null : norm180(f + 180)) : null;
    // The lady's own chart gives her steps and where she faces; where she stands is
    // taken relative to the man from the couple position of each step, so the
    // partners stay together (different step sizes, heel turns …).
    const place = (x: number, y: number, face: number, pos: string) => {
      const o = ladyOffset(pos, latin);
      return {
        x: x + Math.cos(rad(face)) * o.fwd + Math.cos(rad(face - 90)) * o.right,
        y: y + Math.sin(rad(face)) * o.fwd + Math.sin(rad(face - 90)) * o.right,
      };
    };
    const l = traced
      ? {
          start: traced.start,
          feet: traced.feet.map((lf, i) => {
            const mf = m.feet[Math.min(i, m.feet.length - 1)];
            const pos = man[Math.min(i, man.length - 1)]?.pos ?? man[0]?.pos ?? "";
            const b = place(mf.bx, mf.by, mf.bodyFace, pos);
            const side = lf.foot === "L" ? 90 : lf.foot === "R" ? -90 : 0;
            const a = rad(lf.face + side);
            return { ...lf, bx: b.x, by: b.y, x: b.x + (side ? Math.cos(a) * 0.12 : 0), y: b.y + (side ? Math.sin(a) * 0.12 : 0) };
          }),
        }
      : null;
    return { m, l };
  }, [fig, man, lady, hasLady, dance]);

  // Playback: wait the step's duration at the competition tempo (scaled by speed).
  const beats = useMemo(() => {
    const timing = fig.syllabus?.timing;
    const parsed = timing && dance ? parseTiming(timing, dance) : [];
    return man.map((_, i) => parsed[i]?.beats ?? 1);
  }, [fig, dance, man]);
  useEffect(() => {
    if (!playing) return;
    if (k >= n) {
      setPlaying(false);
      return;
    }
    const bpm = (dance && tempoBpm(dance)) || 30;
    const beatsPerMin = bpm * (dance?.beatsPerBar ?? 4);
    const ms = ((beats[k] ?? 1) * 60000) / beatsPerMin / speed;
    const id = window.setTimeout(() => setK((v) => v + 1), Math.max(250, ms));
    return () => window.clearTimeout(id);
  }, [playing, k, n, beats, dance, speed]);

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
  const bodyAt = (p: { start: { x: number; y: number; face: number }; feet: Foot[] }) =>
    k === 0 ? { x: p.start.x, y: p.start.y, face: p.start.face } : { x: p.feet[k - 1].bx, y: p.feet[k - 1].by, face: p.feet[k - 1].bodyFace };

  const renderFeet = (p: { feet: Foot[] }, who: "man" | "lady") =>
    p.feet.map((f) => {
      const state = f.n === k ? "current" : f.n < k ? "done" : "future";
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
  const mBody = bodyAt(geo.m);
  const lBody = geo.l ? bodyAt(geo.l) : null;

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
