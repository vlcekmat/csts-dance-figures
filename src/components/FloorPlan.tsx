// Floor diagrams drawn from step-chart alignments.
//  - FigureFloor: the man's path for one figure, step by step (footprints).
//  - FloorPlan:   a whole routine placed in a room of real size (metres),
//                 travelling anticlockwise along the line of dance. The
//                 simulation itself is computed in plan.ts.

import type { Dance, Figure } from "../data";
import { useI18n, type StringKey } from "../i18n";
import { Glossed } from "./Glossary";
import {
  ROOM_PRESETS,
  STEP_BY_DANCE,
  STEP_METRES,
  chartSteps,
  eighths,
  hasFloor,
  spotOnSide,
  startPoint,
  tracePath,
  turnHintOf,
  type StartSpot,
} from "../floor";
import type { Plan } from "../plan";
import type { Room } from "../routines";


/** Point and direction halfway along a polyline (for a direction arrow). */
function midArrow(pts: { x: number; y: number }[]): { x: number; y: number; angle: number } | null {
  let total = 0;
  for (let i = 1; i < pts.length; i++) total += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
  if (total < 18) return null;
  let walked = 0;
  for (let i = 1; i < pts.length; i++) {
    const seg = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
    if (walked + seg >= total / 2) {
      const f = (total / 2 - walked) / seg;
      return {
        x: pts[i - 1].x + (pts[i].x - pts[i - 1].x) * f,
        y: pts[i - 1].y + (pts[i].y - pts[i - 1].y) * f,
        angle: (Math.atan2(pts[i].y - pts[i - 1].y, pts[i].x - pts[i - 1].x) * 180) / Math.PI,
      };
    }
    walked += seg;
  }
  return null;
}

function Arrowheads() {
  return (
    <defs>
      <marker id="fp-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
        <path d="M0,0 L10,5 L0,10 z" className="fp-arrowhead" />
      </marker>
    </defs>
  );
}

/**
 * One figure as footprints (top view, man's steps): every step is drawn as the
 * foot that takes it, turned to the charted alignment and placed beside the
 * line of weight (left foot to the left, right foot to the right), so closes
 * and side steps stay readable. Fixed scale with a 0.5 m grid.
 */
export function FigureFloor({ fig }: { fig: Figure }) {
  const { t } = useI18n();
  if (!fig.floor || !hasFloor(fig)) return null;
  const steps = chartSteps(fig);
  const body = tracePath(steps, 0, 0, 0, turnHintOf(fig.en));

  // Facing for every step (carry the last known alignment forward).
  let face = body.find((b) => b.facing !== null)?.facing ?? 0;
  const FOOT_OFFSET = 0.17; // metres from the line of weight (keeps closed feet apart)
  const stepM = STEP_BY_DANCE[fig.dance] ?? STEP_METRES;
  const feet = body.slice(1).map((b, i) => {
    if (b.facing !== null) face = b.facing;
    // The stepping foot is the first one named ("RF closes to LF" is a right-foot step).
    const m = steps[i].desc.match(/\b(RF|LF)\b/i);
    const foot = m ? (m[1].toUpperCase() === "LF" ? "L" : "R") : null;
    const side = foot === "L" ? 90 : foot === "R" ? -90 : 0;
    const a = ((face + side) * Math.PI) / 180;
    return {
      n: b.n,
      foot,
      face,
      x: b.x * stepM + (side ? Math.cos(a) * FOOT_OFFSET : 0),
      y: b.y * stepM + (side ? Math.sin(a) * FOOT_OFFSET : 0),
      bx: b.x * stepM,
      by: b.y * stepM,
    };
  });
  const start = { x: 0, y: 0 };

  // Fixed scale (max 110 px per metre), fit to 600 px width.
  const xs = [start.x, ...feet.map((f) => f.x)];
  const ys = [start.y, ...feet.map((f) => f.y)];
  const minX = Math.min(...xs) - 0.35;
  const maxX = Math.max(...xs) + 0.35;
  const minY = Math.min(...ys) - 0.35;
  const maxY = Math.max(...ys) + 0.35;
  const S = Math.min(110, 560 / (maxX - minX));
  const PADX = 40;
  const PADY = 36;
  const VW = Math.max(320, (maxX - minX) * S + 2 * PADX);
  const VH = Math.max(190, (maxY - minY) * S + 2 * PADY);
  const ox = (VW - (maxX - minX) * S) / 2;
  const oy = (VH - (maxY - minY) * S) / 2;
  const X = (x: number) => ox + (x - minX) * S;
  const Y = (y: number) => VH - oy - (y - minY) * S;

  // 0.5 m grid aligned to whole metres.
  const gridX: number[] = [];
  for (let g = Math.ceil(minX * 2) / 2; g <= maxX; g += 0.5) gridX.push(g);
  const gridY: number[] = [];
  for (let g = Math.ceil(minY * 2) / 2; g <= maxY; g += 0.5) gridY.push(g);

  const footLen = 0.23 * S;
  const footW = 0.095 * S;

  return (
    <figure className="floor figure-floor">
      <svg viewBox={`0 0 ${VW} ${VH}`} role="img" aria-label={t("floorFigure")}>
        <Arrowheads />
        {gridX.map((g) => (
          <line key={`gx${g}`} x1={X(g)} y1={0} x2={X(g)} y2={VH} className={`fp-grid ${Number.isInteger(g) ? "major" : ""}`} />
        ))}
        {gridY.map((g) => (
          <line key={`gy${g}`} x1={0} y1={Y(g)} x2={VW} y2={Y(g)} className={`fp-grid ${Number.isInteger(g) ? "major" : ""}`} />
        ))}
        {/* orientation: LOD to the right, wall at the bottom */}
        <line x1={12} y1={16} x2={72} y2={16} className="fp-lod" markerEnd="url(#fp-arrow)" />
        <text x={78} y={20} className="fp-label strong">LOD</text>
        <text x={VW - 10} y={20} textAnchor="end" className="fp-label">↑ {t("floorCentre")}</text>
        <line x1={6} y1={VH - 4} x2={VW - 6} y2={VH - 4} className="fp-wall" />
        <text x={VW - 10} y={VH - 10} textAnchor="end" className="fp-label">{t("floorWall")} ↓</text>
        <line x1={12} y1={VH - 16} x2={12 + S} y2={VH - 16} className="fp-scale" />
        <text x={16 + S} y={VH - 12} className="fp-label">1 m</text>

        {/* line of weight with arrows between steps */}
        <polyline
          points={[`${X(start.x)},${Y(start.y)}`, ...feet.map((f) => `${X(f.bx)},${Y(f.by)}`)].join(" ")}
          className="fp-weight"
        />
        {feet.map((f, i) => {
          const px = i === 0 ? start.x : feet[i - 1].bx;
          const py = i === 0 ? start.y : feet[i - 1].by;
          if (Math.hypot(f.bx - px, f.by - py) < 0.15) return null;
          return (
            <line
              key={`a${i}`}
              x1={X(px)}
              y1={Y(py)}
              x2={X(px + (f.bx - px) * 0.55)}
              y2={Y(py + (f.by - py) * 0.55)}
              className="fp-weight-arrow"
              markerEnd="url(#fp-arrow)"
            />
          );
        })}
        {/* start point (explained in the caption, no label so it can't cover a footprint) */}
        <circle cx={X(start.x)} cy={Y(start.y)} r={6} className="fp-start" />

        {/* footprints */}
        {feet.map((f) => (
          <g key={f.n} transform={`translate(${X(f.x)} ${Y(f.y)}) rotate(${-f.face})`}>
            <path
              d={`M ${footLen / 2} 0 C ${footLen / 2} ${-footW / 2}, ${-footLen / 3} ${-footW / 2}, ${-footLen / 2} ${-footW / 3} L ${-footLen / 2} ${footW / 3} C ${-footLen / 3} ${footW / 2}, ${footLen / 2} ${footW / 2}, ${footLen / 2} 0 Z`}
              className={`fp-foot ${f.foot === "L" ? "left" : f.foot === "R" ? "right" : ""}`}
            />
            <text transform={`rotate(${f.face})`} y={4} textAnchor="middle" className={`fp-foot-num ${f.foot === "R" ? "on-dark" : ""}`}>
              {f.n}
            </text>
          </g>
        ))}
      </svg>
      <figcaption className="small muted">{t("floorFigureHint")}</figcaption>
    </figure>
  );
}

const PRESETS: Room["preset"][] = ["small", "medium", "large", "custom"];

export function FloorPlan({
  dance,
  plan: sim,
  room,
  onRoomChange,
  stepCm,
  onStepChange,
  loop,
  loopEnabled = false,
  onToggleLoopVisual,
  repeat,
  onRepeatChange,
  start,
  onStartChange,
  selectedKey,
  onSelect,
  onRotate,
}: {
  dance: Dance;
  /** Simulation computed by the routine editor (see plan.ts). */
  plan: Plan;
  /** Routine item selected for manual rotation in the plan. */
  selectedKey?: string | null;
  onSelect?: (key: string | null) => void;
  /** Rotate the selected figure by `delta` degrees (+ = left) or reset it. */
  onRotate?: (key: string, delta: number | "reset") => void;
  /** Loop visualisation is shown (routine repeats and not hidden). */
  loop: boolean;
  /** The routine is set to repeat (the toggle is offered even when hidden). */
  loopEnabled?: boolean;
  onToggleLoopVisual?: () => void;
  repeat: number | "round";
  onRepeatChange: (r: number | "round") => void;
  start: StartSpot;
  onStartChange: (s: StartSpot | undefined) => void;
  room: Room;
  onRoomChange: (r: Room) => void;
  stepCm: number;
  onStepChange: (cm: number | undefined) => void;
}) {
  const { t } = useI18n();
  const baseLen = sim.baseLen;
  /** Figure number within the routine (the plan may contain repetitions). */
  const figNo = (n: number) => sim.nums[n - 1] ?? n;
  const selSeg = selectedKey ? sim.segments.find((sg) => sg.key === `${selectedKey}#0`) : undefined;

  // Room -> SVG: keep the real aspect ratio, x along the length, y up from the first long wall.
  const VW = 640;
  const pad = 28;
  const scale = (VW - 2 * pad) / room.length;
  const VH = room.width * scale + 2 * pad;
  const sx = (x: number) => pad + x * scale;
  const sy = (y: number) => VH - pad - y * scale;
  // Group consecutive figure starts that lie (almost) on the same spot.
  // Numbers only for the first pass; repetitions are drawn lighter without labels.
  const bibGroups = sim.segments.slice(0, baseLen).reduce<{ x: number; y: number; nums: number[] }[]>((acc, s) => {
    const st = s.pts[0];
    const last = acc[acc.length - 1];
    if (last && Math.hypot(st.x - last.x, st.y - last.y) < 0.4 && last.nums[last.nums.length - 1] === s.n - 1) {
      last.nums.push(s.n);
    } else acc.push({ x: st.x, y: st.y, nums: [s.n] });
    return acc;
  }, []);

  const setPreset = (preset: Room["preset"]) => {
    if (preset === "custom") onRoomChange({ ...room, preset });
    else onRoomChange({ preset, ...ROOM_PRESETS[preset] });
  };
  const setDim = (key: "length" | "width", v: number) => {
    const val = Math.min(60, Math.max(5, v || 0));
    onRoomChange({ ...room, preset: "custom", [key]: val });
  };

  // LOD arrows in the middle of each wall (anticlockwise).
  const lodArrows = [
    { x1: room.length * 0.42, y1: 0.6, x2: room.length * 0.58, y2: 0.6 },
    { x1: room.length - 0.6, y1: room.width * 0.4, x2: room.length - 0.6, y2: room.width * 0.6 },
    { x1: room.length * 0.58, y1: room.width - 0.6, x2: room.length * 0.42, y2: room.width - 0.6 },
    { x1: 0.6, y1: room.width * 0.6, x2: 0.6, y2: room.width * 0.4 },
  ];

  return (
    <section className="card" id="floor-plan">
      <h3>{t("floorPlan")}</h3>

      <div className="room-controls">
        <div className="chips" role="group" aria-label={t("roomSize")}>
          {PRESETS.map((pr) => (
            <button
              key={pr}
              className={`chip ${room.preset === pr ? "active" : ""}`}
              onClick={() => setPreset(pr)}
              aria-pressed={room.preset === pr}
            >
              {t(`room_${pr}` as StringKey)}
              {pr !== "custom" && (
                <span className="muted small">
                  {" "}
                  {ROOM_PRESETS[pr].width} × {ROOM_PRESETS[pr].length} m
                </span>
              )}
            </button>
          ))}
        </div>
        {room.preset === "custom" && (
          <div className="range-row room-dims">
            <label className="field">
              <span>{t("roomLength")}</span>
              <input
                type="number"
                min={5}
                max={60}
                step={0.5}
                value={room.length}
                onChange={(e) => setDim("length", parseFloat(e.target.value))}
              />
            </label>
            <label className="field">
              <span>{t("roomWidth")}</span>
              <input
                type="number"
                min={5}
                max={60}
                step={0.5}
                value={room.width}
                onChange={(e) => setDim("width", parseFloat(e.target.value))}
              />
            </label>
          </div>
        )}
      </div>

      {loopEnabled && (
        <div className="loop-visual">
          {loop && (
        <label className="field repeat-field">
          <span>{t("repeatLabel")}</span>
          <select value={String(repeat)} onChange={(e) => onRepeatChange(e.target.value === "round" ? "round" : +e.target.value)}>
            {[1, 2, 3, 4].map((n) => (
              <option key={n} value={n}>
                {n}×
              </option>
            ))}
            <option value="round">{t("repeatRound")}</option>
          </select>
        </label>
          )}
          <button type="button" className="btn small" onClick={onToggleLoopVisual} aria-pressed={loop}>
            {loop ? t("loopHide") : t("loopShow")}
          </button>
        </div>
      )}

      <fieldset className="start-fields">
        <legend>{t("startTitle")}</legend>
        <label className="field">
          <span>{t("startSide")}</span>
          <select value={start.side} onChange={(e) => onStartChange({ ...start, side: +e.target.value })}>
            {[0, 1, 2, 3].map((sd) => (
              <option key={sd} value={sd}>
                {t(`startSide${sd}` as StringKey, {
                  m: String(sd % 2 === 0 ? room.length : room.width),
                })}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>
            {t("startAlong")}: <strong>{start.along.toFixed(1)} m</strong>
          </span>
          <input
            type="range"
            min={0.5}
            max={(start.side % 2 === 0 ? room.length : room.width) - 0.5}
            step={0.5}
            value={start.along}
            onChange={(e) => onStartChange({ ...start, along: parseFloat(e.target.value) })}
          />
        </label>
        <label className="field">
          <span>
            {t("startDist")}: <strong>{start.dist.toFixed(1)} m</strong>
          </span>
          <input
            type="range"
            min={0.5}
            max={Math.min(room.width, room.length) / 2}
            step={0.25}
            value={start.dist}
            onChange={(e) => onStartChange({ ...start, dist: parseFloat(e.target.value) })}
          />
        </label>
        <p className="small muted">
          {t("startHint")}{" "}
          <button className="link-btn" onClick={() => onStartChange(undefined)}>
            {t("startReset")}
          </button>
        </p>
      </fieldset>

      <div className="step-length">
        <label className="field">
          <span>
            {t("stepLength")}: <strong>{stepCm} cm</strong>
          </span>
          <input
            type="range"
            min={40}
            max={120}
            step={5}
            value={stepCm}
            onChange={(e) => onStepChange(parseInt(e.target.value, 10))}
          />
        </label>
        {stepCm !== Math.round((STEP_BY_DANCE[dance.id] ?? STEP_METRES) * 100) && (
          <button className="btn small" onClick={() => onStepChange(undefined)}>
            {t("stepLengthReset", { cm: String(Math.round((STEP_BY_DANCE[dance.id] ?? STEP_METRES) * 100)) })}
          </button>
        )}
        <p className="small muted">{t("stepLengthHint")}</p>
      </div>

      {sim.overflow.length > 0 ? (
        <p className="callout bad">
          ✗ {t("roomOverflow", { list: [...new Set(sim.overflow.map(figNo))].join(", ") })}
        </p>
      ) : (
        <p className="callout good">✓ {t("roomFits", { w: String(room.width), l: String(room.length) })}</p>
      )}

      <figure className="floor">
        {selSeg && selectedKey && onRotate && (
          <div className="plan-rotate above" role="group" aria-label={t("planRotateTitle")}>
            <div className="plan-rotate-head">
              <span className={`bib small ${dance.discipline}`}>{figNo(selSeg.n)}</span>
              <strong>{selSeg.label.replace(/ \(\d+\.×\)$/, "")}</strong>
              <span className="muted small">
                {selSeg.rotate
                  ? t(selSeg.rotate > 0 ? "alignByLeft" : "alignByRight", { n: eighths(selSeg.rotate) })
                  : t("alignAsChart")}
              </span>
            </div>
            <div className="chips">
              <button className="btn small" onClick={() => onRotate(selectedKey, 90)}>↺↺ {t("alignByLeft", { n: "1/4" })}</button>
              <button className="btn small" onClick={() => onRotate(selectedKey, 45)}>↺ {t("alignByLeft", { n: "1/8" })}</button>
              <button className="btn small" onClick={() => onRotate(selectedKey, -45)}>↻ {t("alignByRight", { n: "1/8" })}</button>
              <button className="btn small" onClick={() => onRotate(selectedKey, -90)}>↻↻ {t("alignByRight", { n: "1/4" })}</button>
              <button className="btn small" onClick={() => onRotate(selectedKey, "reset")}>{t("alignAsChart")}</button>
              <button className="btn small primary" onClick={() => onSelect?.(null)}>{t("planRotateDone")}</button>
            </div>
            <p className="small muted">{t("planRotateHint")}</p>
          </div>
        )}
        <svg
          viewBox={`0 0 ${VW} ${VH}`}
          role="img"
          aria-label={t("floorPlan")}
          className="room-svg"
          onClick={(e) => {
            // Click in the room = new start spot (nearest wall decides the side).
            const box = e.currentTarget.getBoundingClientRect();
            const px = ((e.clientX - box.left) / box.width) * VW;
            const py = ((e.clientY - box.top) / box.height) * VH;
            const x = (px - pad) / scale;
            const y = (VH - pad - py) / scale;
            if (x < 0 || y < 0 || x > room.length || y > room.width) return;
            // The wall stays as chosen; the click only moves the spot along / away from it.
            onStartChange(spotOnSide(x, y, start.side, room));
          }}
        >
          <Arrowheads />
          <rect x={sx(0)} y={sy(room.width)} width={room.length * scale} height={room.width * scale} className="fp-room" />
          {/* 1 m grid */}
          {Array.from({ length: Math.floor(room.length) - 1 }, (_, i) => (
            <line key={`gx${i}`} x1={sx(i + 1)} y1={sy(0)} x2={sx(i + 1)} y2={sy(room.width)} className="fp-grid" />
          ))}
          {Array.from({ length: Math.floor(room.width) - 1 }, (_, i) => (
            <line key={`gy${i}`} x1={sx(0)} y1={sy(i + 1)} x2={sx(room.length)} y2={sy(i + 1)} className="fp-grid" />
          ))}
          {lodArrows.map((a, i) => (
            <line key={i} x1={sx(a.x1)} y1={sy(a.y1)} x2={sx(a.x2)} y2={sy(a.y2)} className="fp-lod" markerEnd="url(#fp-arrow)" />
          ))}
          <text x={sx(room.length / 2)} y={sy(room.width / 2) + 4} textAnchor="middle" className="fp-label">
            {t("floorCentre")} · {room.width} × {room.length} m
          </text>
          {sim.segments.map((s, i) => {
            // Simplified drawing: one straight line per figure, from where it
            // starts to where it ends (the end points are still exact).
            const first = s.pts[0];
            const last = s.pts[s.pts.length - 1];
            const screen = [
              { x: sx(first.x), y: sy(first.y) },
              { x: sx(last.x), y: sy(last.y) },
            ];
            const arrow = midArrow(screen);
            const st = s.pts[0];
                        return (
              <g
                key={s.key}
                className={`fp-seg seg${i % 2} ${s.estimated ? "estimated" : ""} ${
                  s.n > baseLen ? "rep-later" : ""
                }`}
              >
                <line x1={screen[0].x} y1={screen[0].y} x2={screen[1].x} y2={screen[1].y} className="fp-route" />
                {arrow && (
                  <path
                    d="M -5 -4.5 L 5 0 L -5 4.5 Z"
                    transform={`translate(${arrow.x} ${arrow.y}) rotate(${arrow.angle})`}
                    className="fp-route-arrow"
                  />
                )}
                {s.pts
                  .filter((p) => p.out)
                  .map((p, k) => (
                    <circle key={k} cx={sx(p.x)} cy={sy(p.y)} r={4} className="fp-out" />
                  ))}
                {s.onSpot && <circle cx={sx(st.x)} cy={sy(st.y)} r={16} className="fp-spot" />}
                {s.autoCorner && s.n <= baseLen && (
                  // Corner marker right above the figure it belongs to.
                  <text x={sx(st.x)} y={sy(st.y) - 16} textAnchor="middle" className="fp-label strong fp-corner">
                    ↰ {t("floorCorner")}
                  </text>
                )}
                <title>{`${s.n}. ${s.label}`}</title>
              </g>
            );
          })}
          {(() => {
            const p0 = startPoint(start, room);
            return (
              <g className="fp-start-mark">
                <circle cx={sx(p0.x)} cy={sy(p0.y)} r={17} />
                <text x={sx(p0.x)} y={sy(p0.y) + 31} textAnchor="middle" className="fp-label strong">
                  {t("startShort")}
                </text>
              </g>
            );
          })()}
                    {selSeg && (
            // The selected figure is drawn with its real step path.
            <polyline points={selSeg.pts.map((p) => `${sx(p.x)},${sy(p.y)}`).join(" ")} className="fp-selected-path" />
          )}
          {/* Figure numbers; figures starting on the same spot share one label ("1–4"). */}
          {bibGroups.map((g, i) => {
            const nums = g.nums.map(figNo);
            const label = nums.length > 2 ? `${nums[0]}–${nums[nums.length - 1]}` : nums.join(",");
            const w = Math.max(20, 9 + label.length * 6.5);
            return (
              <g
                key={`b${i}`}
                className={`fp-bib-group ${selSeg && g.nums.includes(selSeg.n) ? "selected" : ""}`}
                onClick={(e) => {
                  // Select the (last) figure of this label for manual rotation; don't move the start.
                  e.stopPropagation();
                  const seg = sim.segments[g.nums[g.nums.length - 1] - 1];
                  onSelect?.(seg ? seg.key.replace(/#\d+$/, "") : null);
                }}
              >
                <rect x={sx(g.x) - w / 2} y={sy(g.y) - 10} width={w} height={20} rx={10} className="fp-bib" />
                <text x={sx(g.x)} y={sy(g.y) + 4} textAnchor="middle" className="fp-num">
                  {label}
                </text>
              </g>
            );
          })}
          {/* scale bar: 2 m */}
          <line x1={sx(0.3)} y1={VH - 8} x2={sx(2.3)} y2={VH - 8} className="fp-scale" />
          <text x={sx(2.5)} y={VH - 4} className="fp-label">2 m</text>
        </svg>
      </figure>

      <ol className="floor-legend small">
        {sim.segments.slice(0, baseLen).map((s) => (
          <li key={s.key} className={s.estimated ? "muted" : ""}>
            {s.label.replace(/ \(\d+\.×\)$/, "")}
            {s.estimated ? " *" : ""}
            {s.onSpot ? ` (${t("onSpot")})` : ""}
            {s.autoCorner ? ` (${t("floorAutoCorner")})` : ""}
          </li>
        ))}
      </ol>

      <details className="plan-help small">
        <summary>{t("planHelp")}</summary>
        <p>
          <Glossed text={t("lodExplain")} />
        </p>
        <p className="muted">{t("floorHint")}</p>
        {sim.segments.some((s) => s.estimated) && <p className="muted">{t("floorMissing")}</p>}
      </details>
    </section>
  );
}
