// Step-by-step playback of one figure: the man's and the lady's footprints
// (WDSF technique charts), where each partner stands and faces on every step
// and the couple position. Top view, LOD to the right, wall at the bottom.
import { useEffect, useMemo, useState } from "react";
import { getDance, type Dance, type Figure } from "../data";
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
import { closeHold, feetBetween, figureGeometry, liveFeet, partnerRelation, signedTurn, type FeetState, type Foot, type Partner } from "../playerGeometry";

type Role = "man" | "lady" | "both";

/** What the player plays: both partners' geometry and steps (one figure or a whole routine). */
export interface Track {
  m: Partner;
  l: Partner | null;
  man: FloorStep[];
  lady: FloorStep[];
  beats: number[];
  /** Count of each step ("S", "Q", "1", "&" …). */
  labels: string[];
  /** Couple position before the first step. */
  startPos: string;
  /** Per step: the lady's step is estimated (her chart is missing). */
  ladyEstimated?: boolean[];
  /** Routine: the figures (step ranges [from, to) ) and the wall per state (0 = start). */
  groups?: { no: string; label: string; from: number; to: number }[];
  side?: number[];
}

export function FigurePlayer({ fig }: { fig: Figure }) {
  const dance = getDance(fig.dance);
  const track = useMemo<Track>(() => {
    const man = chartSteps(fig);
    const lady = (fig.floor?.ladySteps ?? []).slice(0, Math.max(man.length, 1));
    const geo = figureGeometry(fig, dance, man, lady);
    const timing = fig.syllabus?.timing;
    const parsed = timing && dance ? parseTiming(timing, dance) : [];
    return {
      m: geo.m,
      l: geo.l,
      man,
      lady,
      beats: man.map((_, i) => parsed[i]?.beats ?? 1),
      labels: man.map((st, i) => st.timing || parsed[i]?.label || "·"),
      startPos: fig.syllabus?.start ?? man[0]?.pos ?? "",
    };
  }, [fig, dance]);
  return <StepPlayer track={track} dance={dance} resetKey={fig.id} />;
}

/** Step-by-step / smooth playback of a track. `room` = the track is placed in a room (routine). */
export function StepPlayer({
  track,
  dance,
  resetKey,
  room,
}: {
  track: Track;
  dance: Dance | undefined;
  resetKey: string;
  room?: { length: number; width: number };
}) {
  const { t, lang } = useI18n();
  const { man, lady } = track;
  const hasLady = !!track.l && lady.length > 0;
  const [role, setRole] = useState<Role>(hasLady ? "both" : "man");
  const [k, setK] = useState(0); // 0 = starting position, n = after step n
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(0.5);
  // Smooth playback: the partners glide between the steps instead of jumping.
  const [smooth, setSmooth] = useState(true);
  const [frac, setFrac] = useState(0); // progress from step k towards step k + 1 (0–1)
  // All footprints of the figure (a map) instead of only the current feet.
  const [trail, setTrail] = useState(false);
  const [follow, setFollow] = useState(true);
  const n = man.length;

  // Reset when the figure / routine changes.
  useEffect(() => {
    setK(0);
    setPlaying(false);
    setRole(hasLady ? "both" : "man");
  }, [resetKey, hasLady]);

  const geo = track;
  const mFeet = useMemo(() => liveFeet(track.m, man), [track, man]);
  const lFeet = useMemo(() => (track.l ? liveFeet(track.l, lady) : null), [track, lady]);

  // Playback: wait the step's duration at the competition tempo (scaled by speed).
  const beats = track.beats;
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
  const all = room
    ? [{ x: 0, y: 0 }, { x: room.length, y: room.width }]
    : [geo.m.start, ...geo.m.feet, ...(geo.l ? [geo.l.start, ...geo.l.feet] : [])];
  const margin = room ? 0.6 : 0.45;
  const minX = Math.min(...all.map((p) => p.x)) - margin;
  const maxX = Math.max(...all.map((p) => p.x)) + margin;
  const minY = Math.min(...all.map((p) => p.y)) - margin;
  const maxY = Math.max(...all.map((p) => p.y)) + margin;
  // Follow mode: a close-up that moves with the couple; else the whole figure.
  const S = follow ? 170 : Math.min(120, (room ? 640 : 560) / (maxX - minX));
  const VW = Math.max(320, (maxX - minX) * S + 60);
  const VH = Math.max(200, (maxY - minY) * S + 60);
  const ox = (VW - (maxX - minX) * S) / 2;
  const oy = (VH - (maxY - minY) * S) / 2;
  const X = (x: number) => ox + (x - minX) * S;
  const Y = (y: number) => VH - oy - (y - minY) * S;
  const footLen = 0.23 * S;
  const footW = 0.095 * S;
  const gridX: number[] = [];
  const gm = follow && !room ? 2.5 : 0; // the close-up may show the floor around the figure
  for (let g = Math.ceil((minX - gm) * 2) / 2; g <= maxX + gm; g += 0.5) gridX.push(g);
  const gridY: number[] = [];
  for (let g = Math.ceil((minY - gm) * 2) / 2; g <= maxY + gm; g += 0.5) gridY.push(g);

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

  const footPath = `M ${footLen / 2} 0 C ${footLen / 2} ${-footW / 2}, ${-footLen / 3} ${-footW / 2}, ${-footLen / 2} ${-footW / 3} L ${-footLen / 2} ${footW / 3} C ${-footLen / 3} ${footW / 2}, ${footLen / 2} ${footW / 2}, ${footLen / 2} 0 Z`;
  const footLetter = (f: "L" | "R") => (f === "L" ? "L" : lang === "cs" ? "P" : "R");

  /** All footprints (map of the figure), numbered; shown on request. */
  const renderTrail = (p: { feet: Foot[] }, who: "man" | "lady") =>
    p.feet.map((f) => (
      <g key={`${who}${f.n}`} transform={`translate(${X(f.x)} ${Y(f.y)}) rotate(${-f.face})`} className={`fp-print ${who} ${f.n <= k ? "done" : "future"}`}>
        <path d={footPath} />
        <text transform={`rotate(${f.face})`} y={4} textAnchor="middle" className="fp-print-num">{f.n}</text>
      </g>
    ));

  /** Step number as shown (within the figure in a routine). */
  const stepNo = (i: number) => {
    const g = track.groups?.find((gr) => i - 1 >= gr.from && i - 1 < gr.to);
    return g ? i - g.from : i;
  };
  /** Where the stepping foot lands on the next step (dashed outline). */
  const renderNext = (st: FeetState[] | null, who: "man" | "lady") => {
    if (!st || k >= n || frac > 0) return null;
    const nx = st[k + 1];
    if (!nx?.moved) return null;
    const f = nx[nx.moved];
    return (
      <g transform={`translate(${X(f.x)} ${Y(f.y)}) rotate(${-f.face})`} className={`fp-next ${who}`}>
        <path d={footPath} />
        <text transform={`rotate(${f.face})`} y={4} textAnchor="middle" className="fp-next-num">{stepNo(k + 1)}</text>
      </g>
    );
  };

  /** A dancer from above: both feet where they are now (filled = weight on it), shoulders, head. */
  const renderDancer = (b: { x: number; y: number; face: number }, feet: FeetState, who: "man" | "lady") => (
    <g className={`fp-dancer ${who}`}>
      <g transform={`translate(${X(b.x)} ${Y(b.y)}) rotate(${-b.face})`} className="fp-torso">
        <ellipse rx={0.1 * S} ry={0.23 * S} />
        <circle cx={0.02 * S} r={0.075 * S} className="fp-head" />
        <path d={`M ${0.1 * S} ${-0.05 * S} L ${0.17 * S} 0 L ${0.1 * S} ${0.05 * S} Z`} className="fp-nose" />
      </g>
      {(["L", "R"] as const).map((k2) => {
        const f = feet[k2];
        const moving = frac > 0 && feet.moved === k2;
        return (
          <g key={k2} transform={`translate(${X(f.x)} ${Y(f.y)}) rotate(${-f.face})`} className={`fp-live ${f.weight ? "weight" : "free"} ${moving ? "moving" : ""}`}>
            <path d={footPath} />
            <text transform={`rotate(${f.face})`} y={4} textAnchor="middle" className="fp-live-letter">{footLetter(k2)}</text>
          </g>
        );
      })}
      <text x={X(b.x)} y={Y(b.y) - 0.3 * S} textAnchor="middle" className="fp-dancer-name">
        {who === "man" ? t("roleMan") : t("roleLady")}
      </text>
    </g>
  );
  const feetNow = (st: FeetState[]) => (frac > 0 && k < n ? feetBetween(st[k], st[k + 1], frac) : st[Math.min(k, st.length - 1)]);
  /** Path travelled so far (solid) and still to go (faint). */
  const bodyLine = (p: { start: { x: number; y: number }; feet: Foot[] }, upto: { x: number; y: number }) => {
    const pts = [p.start, ...p.feet.map((f) => ({ x: f.bx, y: f.by }))];
    const done = [...pts.slice(0, k + 1), upto];
    return { done: done.map((q) => `${X(q.x)},${Y(q.y)}`).join(" "), all: pts.map((q) => `${X(q.x)},${Y(q.y)}`).join(" ") };
  };

  // The step shown in the text: while moving, the one being danced.
  const shown = frac > 0 && k < n ? k + 1 : k;
  const ms = shown > 0 ? man[shown - 1] : null;
  const ls = shown > 0 && hasLady ? lady[shown - 1] : null;
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

  // Routine: the figure being danced (while moving, the step in progress counts).
  const groupIdx = track.groups ? Math.max(0, track.groups.findIndex((g) => shown - 1 >= g.from && shown - 1 < g.to)) : -1;
  const group = track.groups ? track.groups[shown === 0 ? 0 : groupIdx] : undefined;
  /** Facing in words: in a room relative to the LOD of the current wall. */
  const alignText = (face: number) => alignLabel(norm180(face - 90 * (track.side?.[Math.min(shown, track.side.length - 1)] ?? 0)), lang);

  // Camera: centred on the couple (follow) or the whole figure.
  const cam = (() => {
    const pts = [showMan ? mBody : null, showLady ? lBody : null].filter((q): q is NonNullable<typeof q> => !!q);
    const cx = pts.reduce((a, q) => a + q.x, 0) / (pts.length || 1);
    const cy = pts.reduce((a, q) => a + q.y, 0) / (pts.length || 1);
    return { cx, cy };
  })();
  const view = follow
    ? { x: X(cam.cx) - 260, y: Y(cam.cy) - 170, w: 520, h: 340 }
    : { x: 0, y: 0, w: VW, h: VH };

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
            <input type="checkbox" checked={follow} onChange={(e) => setFollow(e.target.checked)} />
            {t("playerFollow")}
          </label>
          <label className="check small player-smooth">
            <input type="checkbox" checked={trail} onChange={(e) => setTrail(e.target.checked)} />
            {t("playerTrail")}
          </label>
          <label className="check small player-smooth">
            <input type="checkbox" checked={smooth} onChange={(e) => setSmooth(e.target.checked)} />
            {t("playerSmooth")}
          </label>
        </div>
      </div>

      <svg viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`} role="img" aria-label={t("floorFigure")} className={follow ? "follow" : ""}>
        {gridX.map((g) => (
          <line key={`gx${g}`} x1={X(g)} y1={Y(maxY + gm)} x2={X(g)} y2={Y(minY - gm)} className={`fp-grid ${Number.isInteger(g) ? "major" : ""}`} />
        ))}
        {gridY.map((g) => (
          <line key={`gy${g}`} x1={X(minX - gm)} y1={Y(g)} x2={X(maxX + gm)} y2={Y(g)} className={`fp-grid ${Number.isInteger(g) ? "major" : ""}`} />
        ))}

        {room && <rect x={X(0)} y={Y(room.width)} width={room.length * S} height={room.width * S} className="fp-room-walls" />}
        {(() => {
          const mLine = bodyLine(geo.m, mBody);
          const lLine = geo.l && lBody ? bodyLine(geo.l, lBody) : null;
          const hold = closeHold((k > 0 ? man[k - 1]?.pos : null) || man[0]?.pos || track.startPos || "");
          return (
            <>
              {showMan && <polyline points={mLine.all} className="fp-path man" />}
              {showLady && lLine && <polyline points={lLine.all} className="fp-path lady" />}
              {showMan && <polyline points={mLine.done} className="fp-path man done" />}
              {showLady && lLine && <polyline points={lLine.done} className="fp-path lady done" />}
              {trail && showMan && renderTrail(geo.m, "man")}
              {trail && showLady && geo.l && renderTrail(geo.l, "lady")}
              {showMan && renderNext(mFeet, "man")}
              {showLady && renderNext(lFeet, "lady")}
              {showMan && showLady && lBody && hold && (
                <line x1={X(mBody.x)} y1={Y(mBody.y)} x2={X(lBody.x)} y2={Y(lBody.y)} className="fp-hold" />
              )}
              {showMan && renderDancer(mBody, feetNow(mFeet), "man")}
              {showLady && lBody && lFeet && renderDancer(lBody, feetNow(lFeet), "lady")}
            </>
          );
        })()}
        <g transform={`translate(${view.x} ${view.y})`}>
          {!room && (
            <>
              <text x={12} y={20} className="fp-label strong">LOD →</text>
              <text x={view.w - 10} y={20} textAnchor="end" className="fp-label">↑ {t("floorCentre")}</text>
              {!follow && <line x1={6} y1={view.h - 4} x2={view.w - 6} y2={view.h - 4} className="fp-wall" />}
              <text x={view.w - 10} y={view.h - 10} textAnchor="end" className="fp-label">{t("floorWall")} ↓</text>
            </>
          )}
          <line x1={12} y1={view.h - 16} x2={12 + S} y2={view.h - 16} className="fp-scale" />
          <text x={16 + S} y={view.h - 12} className="fp-label">1 m</text>
        </g>
      </svg>

      {group && track.groups && (
        <ol className="player-timeline figures" aria-label={t("playerFigures")}>
          {track.groups.map((g, gi) => (
            <li key={gi}>
              <button
                className={g === group ? "active" : gi < groupIdx ? "done" : ""}
                onClick={() => { setPlaying(false); setK(g.from); }}
                title={g.label}
              >
                <span className="tl-n">{g.no}</span>
                <span className="tl-c">{g.label}</span>
              </button>
            </li>
          ))}
        </ol>
      )}
      <ol className="player-timeline" aria-label={t("playerStep")}>
        {!group && (
          <li>
            <button className={k === 0 && !frac ? "active" : k > 0 ? "done" : ""} onClick={() => { setPlaying(false); setK(0); }} title={t("playerStartPos")}>
              <span className="tl-n">0</span>
              <span className="tl-c">{t("playerStartShort")}</span>
            </button>
          </li>
        )}
        {man.map((_, i) =>
          group && (i < group.from || i >= group.to) ? null : (
            <li key={i}>
              <button
                className={(k === i + 1 && !frac) || (frac > 0 && k === i) ? "active" : i + 1 < k + (frac > 0 ? 1 : 0) ? "done" : ""}
                onClick={() => { setPlaying(false); setK(i + 1); }}
              >
                <span className="tl-n">{group ? i + 1 - group.from : i + 1}</span>
                <span className="tl-c">{track.labels[i] || "·"}</span>
              </button>
            </li>
          ),
        )}
      </ol>

      <div className="player-info" aria-live="polite">
        <div className="player-step">
          {group && (
            <strong className="player-fig">
              {group.no}. {group.label} ·{" "}
            </strong>
          )}
          {shown === 0 ? (
            <strong>{t("playerStartPos")}</strong>
          ) : group ? (
            <strong>
              {t("playerStepN", { n: String(shown - group.from), of: String(group.to - group.from) })}
              {track.labels[shown - 1] ? ` · ${t("playerCount")} ${track.labels[shown - 1]}` : ""}
            </strong>
          ) : (
            <strong>
              {t("playerStepN", { n: String(shown), of: String(n) })}
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
                <td>{alignText(mBody.face)}</td>
                <td>{ms?.turn ? <Glossed text={localizeTurn(ms.turn, lang)} /> : ""}</td>
                <td className="muted">{relText(ms ? partnerRelation(ms.desc, ms.pos ?? pos ?? "") : null)}</td>
              </tr>
            )}
            {showLady && lBody && (
              <tr>
                <th scope="row">{t("roleLady")}{track.ladyEstimated?.[shown - 1] ? " *" : ""}</th>
                <td><Glossed text={ls ? localizeStep(ls.desc, lang) : "–"} /></td>
                <td>{alignText(lBody.face)}</td>
                <td>{ls?.turn ? <Glossed text={localizeTurn(ls.turn, lang)} /> : ""}</td>
                <td className="muted">{relText(ls ? partnerRelation(ls.desc, ms?.pos ?? pos ?? "") : null)}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <figcaption className="small muted">
        {t(hasLady ? "playerHint" : "playerHintManOnly")}
        {track.ladyEstimated?.some(Boolean) ? ` ${t("playerLadyEstimated")}` : ""}
      </figcaption>
    </figure>
  );
}
