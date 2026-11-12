// Floor diagrams drawn from step-chart alignments.
//  - FloorPlan:   a whole routine placed in a room of real size (metres),
//                 travelling anticlockwise along the line of dance. The
//                 simulation itself is computed in plan.ts.

import type { Dance } from "../data";
import { useI18n, type StringKey } from "../i18n";
import { Glossed } from "./Glossary";
import { localizeStep } from "../glossary";
import {
  ROOM_PRESETS,
  STEP_BY_DANCE,
  STEP_METRES,
  alignLabel,
  spotOnSide,
  startPoint,
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
  firstChartFace,
  turnControl,
}: {
  dance: Dance;
  /** Simulation computed by the routine editor (see plan.ts). */
  plan: Plan;
  /** Routine item selected for manual rotation in the plan. */
  selectedKey?: string | null;
  onSelect?: (key: string | null) => void;
  /** Charted start facing of the first figure (relative to LOD), for the start direction default. */
  firstChartFace?: number | null;
  /** Amount of turn of the selected figure, adjustable right in the plan. */
  turnControl?: {
    /** WDSF range (degrees, + = left); null = only the charted amount. */
    range: { min: number; max: number } | null;
    /** The turn in use (chosen, or picked automatically). */
    value: number;
    /** True when the plan picks it automatically. */
    auto: boolean;
    onChange: (deg: number | "auto") => void;
    /** Turn at the start of the figure (degrees, + = left) and how far it starts off the chart. */
    startTurn: number;
    offChart: number;
    onStartTurn: (deg: number) => void;
    /** The figure's steps with the user's length of each. */
    steps: { label: string; desc: string; scale: number }[];
    onStepScale: (i: number, scale: number) => void;
  };
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
  const { t, lang } = useI18n();
  const baseLen = sim.baseLen;
  /** Figure number within the routine (the plan may contain repetitions). */
  /** Figure number within the routine ("P" = the preparatory step). */
  const figNo = (n: number): number | string => {
    const v = sim.nums[n - 1] ?? n;
    return v === 0 ? "P" : v;
  };
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
        <label className="field">
          <span>{t("startFace")}</span>
          <select
            value={start.face ?? ""}
            onChange={(e) => onStartChange({ ...start, face: e.target.value === "" ? undefined : +e.target.value })}
          >
            <option value="">
              {t("startFaceChart", { dir: firstChartFace === null || firstChartFace === undefined ? "?" : alignLabel(firstChartFace, lang) })}
            </option>
            {[0, 45, 90, 135, 180, -135, -90, -45].map((a) => (
              <option key={a} value={a}>
                {alignLabel(a, lang)}
              </option>
            ))}
          </select>
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
        {selSeg && selectedKey && (
          <div className="plan-rotate above" role="group">
            <div className="plan-rotate-head">
              <span className={`bib small ${dance.discipline}`}>{figNo(selSeg.n)}</span>
              <strong>{selSeg.label.replace(/ \(\d+\.×\)$/, "")}</strong>
              {selSeg.startFace !== null && (
                <span className="muted small">
                  {alignLabel(selSeg.startFace - selSeg.side * 90, lang)}
                  {selSeg.endFace !== null ? ` → ${alignLabel(selSeg.endFace - selSeg.side * 90, lang)}` : ""}
                </span>
              )}
              <button className="btn small" onClick={() => onSelect?.(null)}>{t("planSelClose")}</button>
            </div>
            {turnControl && <TurnDial control={turnControl} />}
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
            onStartChange({ ...spotOnSide(x, y, start.side, room), face: start.face });
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
            // The real path of the man's body, step by step.
            const screen = s.pts.map((p) => ({ x: sx(p.x), y: sy(p.y) }));
            const arrow = midArrow(screen);
            const st = s.pts[0];
                        return (
              <g
                key={s.key}
                className={`fp-seg seg${i % 2} ${s.estimated ? "estimated" : ""} ${
                  s.n > baseLen ? "rep-later" : ""
                }`}
              >
                <polyline points={screen.map((p) => `${p.x},${p.y}`).join(" ")} className="fp-route" />
                {screen.length > 2 &&
                  screen.slice(1, -1).map((p, k) => <circle key={`d${k}`} cx={p.x} cy={p.y} r={1.8} className="fp-route-dot" />)}
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
                {/* where the man (P) and the lady (D) face at the start of the figure */}
                {s.n <= baseLen &&
                  ([
                    ["man", s.startFace],
                    ["lady", s.ladyStartFace],
                  ] as const).map(([who, face]) =>
                    face === null ? null : (
                      <g
                        key={who}
                        transform={`translate(${sx(st.x)} ${sy(st.y)}) rotate(${-face})`}
                        className={`fp-facing ${who}`}
                      >
                        <line x1={0} y1={0} x2={15} y2={0} />
                        <path d="M 13 -4.5 L 21 0 L 13 4.5 Z" />
                      </g>
                    ),
                  )}
                {/* after the routine's last figure: where the partners face at its end */}
                {s.n === baseLen &&
                  ([
                    ["man", s.endFace],
                    ["lady", s.ladyEndFace],
                  ] as const).map(([who, face]) => {
                    const en = s.pts[s.pts.length - 1];
                    return face === null ? null : (
                      <g
                        key={`end-${who}`}
                        transform={`translate(${sx(en.x)} ${sy(en.y)}) rotate(${-face})`}
                        className={`fp-facing end ${who}`}
                      >
                        <line x1={0} y1={0} x2={15} y2={0} />
                        <path d="M 13 -4.5 L 21 0 L 13 4.5 Z" />
                      </g>
                    );
                  })}
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
                  // Select the (last) figure of this label; don't move the start.
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

/**
 * Amount-of-turn control of the selected figure: a slider that snaps to eighths of
 * a turn (−1/2 … +1/2), with the WDSF range marked; outside it = by the choreography.
 */
function TurnDial({
  control,
}: {
  control: {
    range: { min: number; max: number } | null;
    value: number;
    auto: boolean;
    onChange: (deg: number | "auto") => void;
    startTurn: number;
    offChart: number;
    onStartTurn: (deg: number) => void;
    steps: { label: string; desc: string; scale: number }[];
    onStepScale: (i: number, scale: number) => void;
  };
}) {
  const { t, lang } = useI18n();
  const { range, value, auto, onChange, startTurn, offChart, onStartTurn, steps, onStepScale } = control;
  const snap = (d: number) => Math.max(-180, Math.min(180, Math.round(d / 45) * 45));
  const lo = range?.min ?? 0;
  const hi = range?.max ?? 0;
  const inRange = value >= lo && value <= hi;
  const pct = (d: number) => ((d + 180) / 360) * 100;
  const label = (d: number) =>
    d === 0 ? t("alignAsChart") : t(d > 0 ? "alignByLeft" : "alignByRight", { n: ["1/8", "1/4", "3/8", "1/2"][Math.round(Math.abs(d) / 45) - 1] ?? "" });
  const set = (d: number) => onChange(Math.max(-180, Math.min(180, Math.round(d / 45) * 45)));
  return (
    <div className="turn-dial">
      <div className="turn-dial-head small">
        <strong>{t("alignTurn")}:</strong> {label(value)}
        {auto ? <span className="muted"> · {t("turnDialAuto")}</span> : !inRange ? <span className="warn"> · {t("alignChoreoChip")}</span> : null}
      </div>
      <div className="turn-dial-row">
        <button type="button" className="btn small" onClick={() => set(value + 45)} aria-label={t("alignByLeft", { n: "1/8" })}>
          ↺ 1/8
        </button>
        <div className="turn-dial-track">
          {/* WDSF range (the slider is mirrored: right = turning to the right) */}
          <span className="turn-dial-range" style={{ left: `${pct(-hi)}%`, width: `${Math.max(1.5, pct(hi) - pct(lo))}%` }} />
          <input
            type="range"
            min={-180}
            max={180}
            step={45}
            // the slider runs left-to-right = turning to the right
            value={-value}
            onChange={(e) => set(-+e.target.value)}
            aria-label={t("alignTurn")}
            list="turn-dial-ticks"
          />
          <datalist id="turn-dial-ticks">
            {[-180, -135, -90, -45, 0, 45, 90, 135, 180].map((d) => (
              <option key={d} value={d} />
            ))}
          </datalist>
          <div className="turn-dial-labels small muted">
            <span>{t("turnDialLeft")}</span>
            <span>0</span>
            <span>{t("turnDialRight")}</span>
          </div>
        </div>
        <button type="button" className="btn small" onClick={() => set(value - 45)} aria-label={t("alignByRight", { n: "1/8" })}>
          ↻ 1/8
        </button>
      </div>
      <div className="turn-dial-head small">
        <strong>{t("startTurnLabel")}:</strong> {label(startTurn)}
        {Math.abs(offChart) >= 22.5 && (
          <span className="warn"> · {t("startTurnOff", { dir: label(Math.round(-offChart / 45) * 45) })}</span>
        )}
      </div>
      <div className="turn-dial-row">
        <button type="button" className="btn small" onClick={() => onStartTurn(snap(startTurn + 45))}>↺ 1/8</button>
        <div className="turn-dial-track">
          <input
            type="range"
            min={-180}
            max={180}
            step={45}
            value={-startTurn}
            onChange={(e) => onStartTurn(snap(-+e.target.value))}
            aria-label={t("startTurnLabel")}
            list="turn-dial-ticks"
          />
        </div>
        <button type="button" className="btn small" onClick={() => onStartTurn(snap(startTurn - 45))}>↻ 1/8</button>
      </div>
      <div className="chips">
        {Math.abs(offChart) >= 22.5 && (
          <button type="button" className="btn small primary" onClick={() => onStartTurn(snap(startTurn - offChart))}>
            {t("startTurnStraighten")}
          </button>
        )}
        {startTurn !== 0 && (
          <button type="button" className="btn small" onClick={() => onStartTurn(0)}>
            {t("startTurnReset")}
          </button>
        )}
        <button type="button" className={`btn small ${auto ? "primary" : ""}`} onClick={() => onChange("auto")}>
          {t("turnDialAutoBtn")}
        </button>
        <button type="button" className="btn small" onClick={() => onChange(0)}>
          {t("alignAsChart")}
        </button>
      </div>
      {steps.length > 0 && (
        <details className="step-lengths">
          <summary className="small">{t("stepLengths")}</summary>
          <ol className="step-length-list">
            {steps.map((st, i) => (
              <li key={i} className="small">
                <span className="step-length-name">
                  {i + 1}. {st.desc ? localizeStep(st.desc, lang) : st.label}
                </span>
                <button type="button" className="icon-btn" onClick={() => onStepScale(i, st.scale - 0.1)} aria-label={t("stepShorter")} title={t("stepShorter")}>
                  −
                </button>
                <span className={`step-length-val ${st.scale !== 1 ? "changed" : ""}`}>{Math.round(st.scale * 100)} %</span>
                <button type="button" className="icon-btn" onClick={() => onStepScale(i, st.scale + 0.1)} aria-label={t("stepLonger")} title={t("stepLonger")}>
                  +
                </button>
              </li>
            ))}
          </ol>
        </details>
      )}
    </div>
  );
}
