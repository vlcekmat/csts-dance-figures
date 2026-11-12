// Step-by-step playback of one figure: the man's and the lady's footprints
// (WDSF technique charts), where each partner stands and faces on every step
// and the couple position. Top view, LOD to the right, wall at the bottom.
import { useEffect, useMemo, useState } from "react";
import { getDance, type Figure } from "../data";
import { useI18n, type StringKey } from "../i18n";
import { Glossed } from "./Glossary";
import { localizePositions, localizeStep, localizeTurn } from "../glossary";
import {
  alignLabel,
  chartSteps,
  norm180,
  type FloorStep,
} from "../floor";
import { parseTiming, tempoBpm } from "../timing";
import { closeHold, figureGeometry, partnerRelation, signedTurn, type Foot } from "../playerGeometry";

type Role = "man" | "lady" | "both";

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

  const geo = useMemo(() => figureGeometry(fig, dance, man, lady), [fig, man, lady, dance]);

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
    const t = steps[k]?.rot ?? signedTurn(steps[k]?.turn);
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
  const relText = (r: ReturnType<typeof partnerRelation>) => (r ? t(`rel_${r}` as StringKey) : "");
  let mBody = bodyAt(geo.m, man);
  let lBody = geo.l ? bodyAt(geo.l, lady) : null;
  // In a closed hold the couple turns around its common centre: move both along an
  // arc (the line between them rotates with the man's turn) instead of straight lines.
  if (frac && lBody && geo.l && k < geo.m.feet.length && k < geo.l.feet.length && closeHold(man[k]?.pos || man[k - 1]?.pos || "")) {
    const ma = bodyAfter(geo.m, k);
    const mb = bodyAfter(geo.m, k + 1);
    const la = bodyAfter(geo.l, k);
    const lb = bodyAfter(geo.l, k + 1);
    const ang = (x: number, y: number) => (Math.atan2(y, x) * 180) / Math.PI;
    const aA = ang(la.x - ma.x, la.y - ma.y);
    const aB = ang(lb.x - mb.x, lb.y - mb.y);
    let dv = norm180(aB - aA);
    // keep the direction (and size) of the man's turn on this step
    const mTurn = mBody.face - ma.face;
    const full = frac ? mTurn / frac : 0;
    if (Math.abs(full) > 180 && Math.sign(dv) !== Math.sign(full)) dv += 360 * Math.sign(full);
    const lenA = Math.hypot(la.x - ma.x, la.y - ma.y);
    const lenB = Math.hypot(lb.x - mb.x, lb.y - mb.y);
    const len = lenA + (lenB - lenA) * frac;
    const cx = (ma.x + la.x) / 2 + (((mb.x + lb.x) - (ma.x + la.x)) / 2) * frac;
    const cy = (ma.y + la.y) / 2 + (((mb.y + lb.y) - (ma.y + la.y)) / 2) * frac;
    const a = ((aA + dv * frac) * Math.PI) / 180;
    mBody = { ...mBody, x: cx - (Math.cos(a) * len) / 2, y: cy - (Math.sin(a) * len) / 2 };
    lBody = { ...lBody, x: cx + (Math.cos(a) * len) / 2, y: cy + (Math.sin(a) * len) / 2 };
  }

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
                <td className="muted">{relText(ms ? partnerRelation(ms.desc, ms.pos ?? pos ?? "") : null)}</td>
              </tr>
            )}
            {showLady && lBody && (
              <tr>
                <th scope="row">{t("roleLady")}</th>
                <td><Glossed text={ls ? localizeStep(ls.desc, lang) : "–"} /></td>
                <td>{alignLabel(lBody.face, lang)}</td>
                <td>{ls?.turn ? <Glossed text={localizeTurn(ls.turn, lang)} /> : ""}</td>
                <td className="muted">{relText(ls ? partnerRelation(ls.desc, ms?.pos ?? pos ?? "") : null)}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <figcaption className="small muted">{t(hasLady ? "playerHint" : "playerHintManOnly")}</figcaption>
    </figure>
  );
}
