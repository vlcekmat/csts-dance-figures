// Editor of one routine: ordered figure list with timing choice, legality and
// variant-aware foot / position checks, totals and a rhythm strip of the whole routine.
import { useEffect, useMemo, useRef, useState } from "react";
import {
  CLASSES,
  DANCES,
  allFigures,
  danceInClass,
  figureNames,
  fold,
  searchText,
  getDance,
  getFigure,
  isLegal,
  type ClassId,
  type Figure,
} from "../data";
import { useI18n } from "../i18n";
import { downloadJson, newId, type Routine, type RoutineItem, type RoutinesApi } from "../routines";
import { ROUND_RANGE, formatBars, formatSeconds, tempoRange, totalBeats } from "../timing";
import { connect, partLabel, resolveItem } from "../variants";
import { RoutineItemRow } from "./RoutineItemRow";
import { buildPlan } from "../plan";
import { useCustom } from "./CustomFigureHost";
import { Glossed } from "./Glossary";
import { FloorPlan } from "./FloorPlan";
import { holdName, localizePositions } from "../glossary";
import { DEFAULT_START, ROOM_PRESETS, STEP_BY_DANCE, allowedExtra, eighths, figureAlignment, hasFloor, norm180, turnOptions, alignLabel } from "../floor";
import { TimingStrip, type StripSegment } from "./TimingStrip";

/** Is the hold named for this figure by the syllabus (base, notes, or "any")? */
function holdAllowedFor(fig: Figure, k: string): boolean {
  const h = fig.syllabus?.holds;
  if (!h) return false;
  return !!h.any || h.start === k || h.finish === k || h.alts.includes(k);
}

interface Props {
  routine: Routine;
  api: RoutinesApi;
  onBack: () => void;
  onOpenFigure: (fig: Figure) => void;
}

export function RoutineEditor({ routine, api, onBack, onOpenFigure }: Props) {
  const { t, lang, barsWord } = useI18n();
  const dance = getDance(routine.dance);
  const custom = useCustom();
  const [pickerQ, setPickerQ] = useState("");
  const [showIllegal, setShowIllegal] = useState(false);

  const patch = (fn: (r: Routine) => Routine) => api.update(routine.id, fn);
  const setItems = (fn: (items: RoutineItem[]) => RoutineItem[]) =>
    patch((r) => ({ ...r, items: fn(r.items) }));

  // Resolve figures and timing once per render.
  const rows = routine.items
    .map((item) => {
      const fig = getFigure(item.figureId);
      if (!fig) return null;
      const timing = item.timing ?? fig.syllabus?.timing ?? "";
      const resolved = resolveItem(fig, dance, timing, item.variant);
      const classLegal = isLegal(fig, routine.cls);
      return {
        item,
        fig,
        resolved,
        steps: resolved.steps,
        beats: totalBeats(resolved.steps),
        classLegal,
        // Cutting a figure freely is not allowed in syllabus-restricted classes.
        legal: classLegal && (routine.cls === "B" || resolved.partAllowed),
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);

  const beats = rows.reduce((s, r) => s + r.beats, 0);
  const tempo = tempoRange(dance);
  // Loop visualisation (rail, strip marker, repetitions in the plan) can be hidden;
  // the end → start check stays.
  const showLoop = !!routine.loop && !routine.loopHidden && routine.items.length > 1;
  // Figure the routine continues with after its end (clamped if figures were removed).
  const loopTo = Math.min(Math.max(routine.loopTo ?? 0, 0), Math.max(routine.items.length - 1, 0));
  // Dances that travel around the floor (corners / floor plan make sense).
  const progressive = !["chacha", "rumba", "jive"].includes(routine.dance);
  // Floor plan (progressive dances): shared by the list (walls, aims) and the drawing.
  const [repeat, setRepeat] = useState<number | "round">(showLoop ? "round" : 1);
  // Figure selected for manual rotation in the floor plan.
  const [selectedUid, setSelectedUid] = useState<string | null>(null);
  const editInPlan = (uid: string) => {
    setSelectedUid(uid);
    requestAnimationFrame(() => document.getElementById("floor-plan")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };
  useEffect(() => {
    // Turning the loop visualisation on shows a whole competition round.
    setRepeat(showLoop ? "round" : 1);
  }, [showLoop]);
  const room = routine.room ?? { preset: "medium" as const, ...ROOM_PRESETS.medium };
  const stepCm = routine.stepCm ?? Math.round((STEP_BY_DANCE[routine.dance] ?? 0.85) * 100);
  const plan = useMemo(
    () =>
      progressive && rows.length
        ? buildPlan({
            dance,
            lang,
            items: rows.map((r) => ({
              key: r.item.uid,
              fig: r.fig,
              resolved: r.resolved,
              corner: !!r.item.corner,
              extraTurn: allowedExtra(r.fig, r.item.variant?.extraTurn),
              wall: r.item.wall,
            })),
            room,
            start: routine.start ?? DEFAULT_START,
            stepCm,
            reps: showLoop ? repeat : 1,
            loopTo,
            loop: !!routine.loop,
          })
        : null,
    // rows are rebuilt every render; the routine object is the real dependency
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [routine, dance, lang, repeat, showLoop, loopTo, progressive],
  );
  /** First-pass plan segment of a routine row (wall, resolved rotation). */
  const planSeg = (row: { item: RoutineItem }) => plan?.segments.find((sg) => sg.key === `${row.item.uid}#0`);
  const anyAlignChange = routine.items.some((it) => it.variant?.extraTurn);
  const resetAllAlignment = () =>
    setItems((items) =>
      items.map((it) => {
        if (!it.variant) return it;
        const { extraTurn: _e, ...rest } = it.variant;
        void _e;
        return { ...it, variant: Object.keys(rest).length ? rest : undefined };
      }),
    );
  /** "26–28 s" or "1:05–1:10" (unit written once). */
  const secondsRange = (a: number, b: number) => {
    const ra = Math.round(a);
    const rb = Math.round(b);
    if (ra === rb) return formatSeconds(a);
    return ra < 60 && rb < 60 ? `${ra}–${rb} s` : `${formatSeconds(a)}–${formatSeconds(b)}`;
  };
  // Repetitions per round, with one decimal ("2,4").
  const fmtTimes = (n: number) => (Math.round(n * 10) / 10).toLocaleString(lang === "cs" ? "cs-CZ" : "en-GB");
  const illegalCount = rows.filter((r) => !r.legal).length;


  // Position / hold changes between consecutive figures.
  const changes = rows.map((r, i) => {
    if (i === 0) return null;
    const c = connect(rows[i - 1].fig, rows[i - 1].resolved, r.fig, r.resolved);
    return { pos: c.posOk === false, hold: c.holdOk === false };
  });
  const changeCount = changes.filter((c) => c && (c.pos || c.hold)).length;

  const segments: StripSegment[] = rows.map((r, i) => ({
    change: changes[i] ?? undefined,
    key: r.item.uid,
    label:
      figureNames(r.fig, lang).main +
      (r.resolved.isPart ? ` (${partLabel(r.resolved.from, r.resolved.to, t("toEnd"))})` : ""),
    steps: r.steps,
    illegal: !r.legal,
  }));

  const pickerFigures = useMemo(() => {
    const terms = fold(pickerQ).split(/\s+/).filter(Boolean);
    // The user's own figures are always listed (marked) so they can be found
    // even in syllabus classes, where they are not legal.
    return allFigures().filter(
      (f) =>
        f.dance === routine.dance &&
        (f.custom || showIllegal || isLegal(f, routine.cls)) &&
        terms.every((term) => fold(`${searchText(f)} ${f.no}`).includes(term)),
    );
  }, [pickerQ, showIllegal, routine.dance, routine.cls, custom.api.list]);

  const move = (idx: number, delta: number) =>
    setItems((items) => {
      const next = [...items];
      const [it] = next.splice(idx, 1);
      next.splice(idx + delta, 0, it);
      return next;
    });

  // Drag & drop (pointer events: works with mouse and touch): reorder the
  // routine, or drag a figure from the picker to a place in the routine.
  const listRef = useRef<HTMLOListElement>(null);
  const [drag, setDrag] = useState<{
    /** Index being moved, or null when a new figure comes from the picker. */
    from: number | null;
    /** Insert position (index in the list without the dragged item); null = outside the list. */
    over: number | null;
    label?: string;
    x: number;
    y: number;
  } | null>(null);

  /** Insert index for a pointer position, or null when not over the routine list. */
  const dropIndex = (ev: PointerEvent, from: number | null): number | null => {
    const list = listRef.current;
    if (!list) return null;
    const box = list.getBoundingClientRect();
    if (ev.clientX < box.left - 40 || ev.clientX > box.right + 40 || ev.clientY < box.top - 60 || ev.clientY > box.bottom + 80)
      return null;
    let target = 0;
    ([...list.children] as HTMLElement[]).forEach((el, i) => {
      if (i === from) return;
      const r = el.getBoundingClientRect();
      if (r.top + r.height / 2 < ev.clientY) target++;
    });
    return target;
  };

  const runDrag = (from: number | null, label: string | undefined, onDrop: (over: number) => void, e: React.PointerEvent) => {
    let over: number | null = from;
    setDrag({ from, over, label, x: e.clientX, y: e.clientY });
    const onMove = (ev: PointerEvent) => {
      over = dropIndex(ev, from);
      setDrag({ from, over, label, x: ev.clientX, y: ev.clientY });
      // Scroll the page when dragging near the window edge.
      if (ev.clientY < 60) window.scrollBy(0, -14);
      else if (ev.clientY > window.innerHeight - 60) window.scrollBy(0, 14);
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      setDrag(null);
      if (over !== null) onDrop(over);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  };

  const startDrag = (from: number) => (e: React.PointerEvent) => {
    e.preventDefault();
    runDrag(from, undefined, (over) => over !== from && move(from, over - from), e);
  };

  /** Drag a figure from the picker: starts after the pointer moved a bit (a click still adds it). */
  const suppressClick = useRef(false);
  const startPickerDrag = (fig: Figure, handle: boolean) => (e: React.PointerEvent) => {
    if (!handle && e.pointerType !== "mouse") return; // touch: only the handle drags, the list scrolls
    if (e.button !== 0) return;
    if (handle) e.preventDefault();
    const x0 = e.clientX;
    const y0 = e.clientY;
    const label = figureNames(fig, lang).main;
    const insert = (over: number) =>
      setItems((items) => {
        const next = [...items];
        next.splice(over, 0, { uid: newId(), figureId: fig.id });
        return next;
      });
    if (handle) {
      runDrag(null, label, insert, e);
      return;
    }
    const pending = (ev: PointerEvent) => {
      if (Math.hypot(ev.clientX - x0, ev.clientY - y0) < 8) return;
      cleanup();
      suppressClick.current = true;
      runDrag(null, label, insert, ev as unknown as React.PointerEvent);
    };
    const cleanup = () => {
      window.removeEventListener("pointermove", pending);
      window.removeEventListener("pointerup", cleanup);
    };
    window.addEventListener("pointermove", pending);
    window.addEventListener("pointerup", cleanup);
  };

  const updateItem = (uid: string, patchItem: Partial<RoutineItem>) =>
    setItems((items) => items.map((it) => (it.uid === uid ? { ...it, ...patchItem } : it)));

  type Row = (typeof rows)[number];

  /** Facing at the start / end in the floor plan, relative to the LOD of the figure's wall. */
  const planFace = (row: Row) => {
    const sg = planSeg(row);
    if (!sg) return undefined;
    const rel = (f: number | null) => (f === null ? null : norm180(f - sg.side * 90));
    return { start: rel(sg.startFace), end: rel(sg.endFace), offChart: sg.offChart, autoTurn: sg.autoTurn };
  };

  /**
   * Checks between two consecutive figures (also used for "end → start" when
   * the routine is repeated): foot, position, hold and alignment, with
   * one-click fixes where the syllabus offers a variant.
   */
  const renderTransition = (prev: Row, r: Row, loop = false) => {
    const c = connect(prev.fig, prev.resolved, r.fig, r.resolved);
    // Alignment: the next figure starts facing where the previous one ended. If
    // that is not the alignment its chart gives, the couple dances it off the
    // technique – fixable only by turning the previous figure differently
    // within the range its technique allows.
    const nf = planFace(r);
    const na = figureAlignment(r.fig, { from: r.resolved.from, to: r.resolved.isPart ? r.resolved.to : undefined });
    const off = nf && na ? nf.offChart : 0;
    const alignOk = !nf || !na || nf.start === null ? null : Math.abs(off) < 22.5;
    const prevRange = prev.fig.floor?.turnRange;
    const prevExtra = allowedExtra(prev.fig, prev.item.variant?.extraTurn) ?? 0;
    const fixExtra = Math.round((prevExtra - off) / 45) * 45;
    const canFix = alignOk === false && !!prevRange && fixExtra !== prevExtra && turnOptions(prevRange).includes(fixExtra);
    const hasChange = c.posOk === false || c.holdOk === false || alignOk === false;
    return (
                    <div className={`transition ${hasChange ? "has-change" : ""} ${loop ? "loop" : ""}`}>
                      {loop && <div className="loop-title">↺ {t("loopTitleTo", { n: String(loopTo + 1), name: figureNames(r.fig, lang).main })}</div>}
                      {hasChange && (
                        <div className="change-badges">
                          {c.posOk === false && <span className="change-badge pos">⇄ {t("changePosition")}</span>}
                          {c.holdOk === false && <span className="change-badge hold">✋ {t("changeHold")}</span>}
                          {alignOk === false && <span className="change-badge align">↻ {t("changeAlign")}</span>}
                        </div>
                      )}
                      <div className={c.footOk === false ? "warn" : c.footOk ? "ok" : ""} title={t("footHint")}>
                        {c.footOk === false
                          ? `⚠ ${t("footWarn", { prev: c.prevFoot!, next: c.nextFoot! })}`
                          : c.footOk
                            ? `↓ ${t("footOk")} (${c.prevFoot} → ${c.nextFoot})`
                            : `↓ ${t("footUnknown")}`}
                      </div>
                      <div className={c.posOk === false ? "warn" : "muted"}>
                        <Glossed
                          text={localizePositions(
                            t("positionLine", { prev: c.prevPos ?? "?", next: c.nextPos ?? "?" }),
                            lang,
                          )}
                        />
                      </div>
                      {nf && na && nf.start !== null && (
                        <div className={alignOk === false ? "warn" : "muted"}>
                          {alignOk === false
                            ? `⚠ ${t("alignLineOff", { here: alignLabel(nf.start, lang), chart: alignLabel(na.start, lang) })}`
                            : t("alignLineOk", { here: alignLabel(nf.start, lang) })}
                        </div>
                      )}
                      {(c.prevHold || c.nextHold) && (
                        <div className={c.holdOk === false ? "warn" : "muted"}>
                          {t("holdLine", { prev: holdName(c.prevHold, lang), next: holdName(c.nextHold, lang) })}
                        </div>
                      )}
                      {c.fixPrevFinish !== undefined && (
                        <button
                          className="fix-btn"
                          onClick={() =>
                            updateItem(prev.item.uid, {
                              variant: { ...prev.item.variant, finish: c.fixPrevFinish },
                            })
                          }
                        >
                          {t("fixPrev", {
                            pos: localizePositions(prev.fig.syllabus!.variants!.finishes![c.fixPrevFinish].position, lang),
                          })}
                        </button>
                      )}
                      {c.fixNextStart !== undefined && (
                        <button
                          className="fix-btn"
                          onClick={() =>
                            updateItem(r.item.uid, { variant: { ...r.item.variant, start: c.fixNextStart } })
                          }
                        >
                          {t("fixNext", {
                            pos:
                              localizePositions(
                                lang === "cs"
                                  ? r.fig.syllabus!.variants!.starts![c.fixNextStart].descCs
                                  : r.fig.syllabus!.variants!.starts![c.fixNextStart].desc,
                                lang,
                              ),
                          })}
                        </button>
                      )}
                      {c.holdOk === false && c.prevHold && holdAllowedFor(r.fig, c.prevHold) && (
                        <button
                          className="fix-btn"
                          onClick={() =>
                            updateItem(r.item.uid, { variant: { ...r.item.variant, startHold: c.prevHold! } })
                          }
                        >
                          {t("fixHoldNext", { hold: holdName(c.prevHold, lang) })}
                        </button>
                      )}
                      {c.holdOk === false &&
                        c.nextHold &&
                        !(c.prevHold && holdAllowedFor(r.fig, c.prevHold)) &&
                        holdAllowedFor(prev.fig, c.nextHold) && (
                          <button
                            className="fix-btn"
                            onClick={() =>
                              updateItem(prev.item.uid, {
                                variant: { ...prev.item.variant, finishHold: c.nextHold! },
                              })
                            }
                          >
                            {t("fixHoldPrev", { hold: holdName(c.nextHold, lang) })}
                          </button>
                        )}
                      {canFix && (
                        <button
                          className="fix-btn"
                          onClick={() =>
                            updateItem(prev.item.uid, { variant: { ...prev.item.variant, extraTurn: fixExtra || undefined } })
                          }
                        >
                          {t("alignFixPrevTurn", {
                            dir: fixExtra === 0 ? t("alignAsChart") : t(fixExtra > 0 ? "alignByLeft" : "alignByRight", { n: eighths(fixExtra) }),
                          })}
                        </button>
                      )}
                    </div>
                  );
  };

  return (
    <div className="editor">
      <div className="editor-head">
        <button className="link-btn" onClick={onBack}>
          ← {t("back")}
        </button>
        <input
          className="title-input"
          value={routine.name}
          onChange={(e) => patch((r) => ({ ...r, name: e.target.value }))}
          aria-label={t("routineName")}
        />
        <div className="filter-row">
          <label className="field">
            <span>{t("dance")}</span>
            <select
              value={routine.dance}
              onChange={(e) => patch((r) => ({ ...r, dance: e.target.value }))}
              disabled={routine.items.length > 0}
            >
              {DANCES.map((d) => (
                <option key={d.id} value={d.id}>
                  {d[lang]}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>{t("classLabel")}</span>
            <select
              value={routine.cls}
              onChange={(e) => patch((r) => ({ ...r, cls: e.target.value as ClassId }))}
            >
              {CLASSES.map((c) => (
                <option key={c} value={c}>
                  {c === "B" ? t("classB") : c}
                </option>
              ))}
            </select>
          </label>
          <button
            className="btn"
            onClick={() =>
              // Include the user's own figures the routine uses, so it can be imported elsewhere.
              downloadJson(`${routine.name || "routine"}.json`, {
                routines: [routine],
                customFigures: custom.api.list.filter((c) => routine.items.some((i) => i.figureId === c.id)),
              })
            }
          >
            {t("export")}
          </button>
          {anyAlignChange && (
            <button className="btn" onClick={resetAllAlignment} title={t("alignResetAllHint")}>
              ↺ {t("alignResetAll")}
            </button>
          )}
          <button className="btn" onClick={() => window.print()}>
            {t("print")}
          </button>
        </div>
      </div>

      {rows.length > 1 && (
        <div className="loop-row">
          <label className="check loop-check">
            <input type="checkbox" checked={!!routine.loop} onChange={(e) => patch((r0) => ({ ...r0, loop: e.target.checked || undefined }))} />
            {t("loopToggle")}
          </label>
          {routine.loop && (
            <label className="field loop-to">
              <span>{t("loopToLabel")}</span>
              <select value={loopTo} onChange={(e) => patch((r0) => ({ ...r0, loopTo: +e.target.value || undefined }))}>
                {rows.map((r, i) => (
                  <option key={r.item.uid} value={i}>
                    {i + 1}. {figureNames(r.fig, lang).main}
                  </option>
                ))}
              </select>
            </label>
          )}
          {routine.loop && !progressive && (
            // Without a floor plan the toggle stays here; otherwise it lives next to the plan.
            <button
              type="button"
              className="btn small"
              onClick={() => patch((r0) => ({ ...r0, loopHidden: r0.loopHidden ? undefined : true }))}
              aria-pressed={!routine.loopHidden}
            >
              {routine.loopHidden ? t("loopShow") : t("loopHide")}
            </button>
          )}
        </div>
      )}
      {!danceInClass(routine.dance, routine.cls) && (
        <p className="callout warn">{t("notDancedInClass")}</p>
      )}

      <div className="summary">
        <div className="stat">
          <div className="stat-value">{rows.length}</div>
          <div className="stat-label">{t("figures")}</div>
        </div>
        <div className="stat">
          <div className="stat-value">{formatBars(beats, dance.beatsPerBar)}</div>
          <div className="stat-label">
            {barsWord(beats, dance.beatsPerBar)} ({dance.meter})
          </div>
        </div>
        {tempo && beats > 0 && (
          <>
            <div className="stat">
              {/* Faster music = shorter routine: [fastest tempo, slowest tempo]. */}
              <div className="stat-value">{secondsRange(((beats / dance.beatsPerBar) * 60) / tempo[1], ((beats / dance.beatsPerBar) * 60) / tempo[0])}</div>
              <div className="stat-label">{t("durationAt", { tempo: dance.tempo })}</div>
            </div>
            <div className="stat">
              <div className="stat-value">
                {fmtTimes(ROUND_RANGE[0] / (((beats / dance.beatsPerBar) * 60) / tempo[1]))}–
                {fmtTimes(ROUND_RANGE[1] / (((beats / dance.beatsPerBar) * 60) / tempo[0]))}×
              </div>
              <div className="stat-label">{t("perRound")}</div>
            </div>
          </>
        )}
        <div className={`stat ${illegalCount ? "bad" : "good"}`}>
          <div className="stat-value">{illegalCount ? `✗ ${illegalCount}` : "✓"}</div>
          <div className="stat-label">
            {illegalCount
              ? `${t("illegalCount")} ${routine.cls === "B" ? t("classB") : routine.cls}`
              : `${t("legalAll")} ${routine.cls === "B" ? t("classB") : routine.cls}`}
          </div>
        </div>
      </div>

      {changeCount > 0 && (
        <p className="callout warn small">
          ⇄ {changeCount} {t("changesTitle")}
        </p>
      )}

      {rows.length > 0 && (
        <section className="card">
          <h3>{t("rhythmStrip")}</h3>
          <TimingStrip dance={dance} segments={segments} beatWidth={26} loop={showLoop} loopTo={loopTo} />
          <p className="small muted">{t("timingLegend")}</p>
        </section>
      )}

      {progressive && rows.length > 0 && (
        <FloorPlan
          dance={dance}
          plan={plan!}
          loop={showLoop}
          loopEnabled={!!routine.loop && rows.length > 1}
          onToggleLoopVisual={() => patch((r0) => ({ ...r0, loopHidden: r0.loopHidden ? undefined : true }))}
          repeat={repeat}
          onRepeatChange={setRepeat}
          start={routine.start ?? DEFAULT_START}
          onStartChange={(start) => patch((r0) => ({ ...r0, start }))}
          room={room}
          onRoomChange={(room) => patch((r0) => ({ ...r0, room }))}
          stepCm={stepCm}
          onStepChange={(stepCm) => patch((r0) => ({ ...r0, stepCm }))}
          firstChartFace={rows[0] ? (figureAlignment(rows[0].fig, { from: rows[0].resolved.from, to: rows[0].resolved.isPart ? rows[0].resolved.to : undefined })?.start ?? null) : null}
          selectedKey={selectedUid}
          onSelect={setSelectedUid}
        />
      )}

      <div className="editor-cols">
        <section className="card items">
          {rows.length === 0 && <p className="empty">{t("emptyRoutine")}</p>}
          <ol ref={listRef} className={`item-list ${showLoop ? "looped" : ""} ${drag?.from === null && drag.over !== null ? "drop-target" : ""}`}>
            {rows.map((r, idx) => {
              const prev = idx > 0 ? rows[idx - 1] : null;

              return (
                <li
                  key={r.item.uid}
                  className={[
                    showLoop && idx >= loopTo
                      ? `in-loop ${idx === loopTo ? "loop-start" : ""} ${idx === rows.length - 1 ? "loop-end" : ""}`
                      : "",
                    drag?.from === idx ? "dragging" : "",
                    drag && drag.over !== null && drag.from !== null && drag.over === idx && drag.from !== idx
                      ? drag.over < drag.from ? "drop-before" : "drop-after"
                      : "",
                    // a new figure from the picker goes before item `over` (or after the last one)
                    drag && drag.from === null && drag.over !== null
                      ? drag.over === idx ? "drop-before" : drag.over === rows.length && idx === rows.length - 1 ? "drop-after" : ""
                      : "",
                  ]
                    .join(" ")
                    .trim() || undefined}
                >
                  {prev && renderTransition(prev, r)}
                  <RoutineItemRow
                    progressive={progressive}
                    index={idx}
                    count={rows.length}
                    item={r.item}
                    fig={r.fig}
                    dance={dance}
                    cls={routine.cls}
                    resolved={r.resolved}
                    wallSide={planSeg(r)?.side}
                    wallManual={planSeg(r)?.manualWall}
                    wallAuto={!!planSeg(r)?.autoCorner}
                    planFace={planFace(r)}
                    onEditInPlan={progressive && (hasFloor(r.fig) || !!r.fig.floor?.follows) ? () => editInPlan(r.item.uid) : undefined}
                    classLegal={r.classLegal || routine.cls === "B"}
                    onChange={(patchItem) => updateItem(r.item.uid, patchItem)}
                    onMove={(delta) => move(idx, delta)}
                    onDragStart={startDrag(idx)}
                    onRemove={() => setItems((items) => items.filter((it) => it.uid !== r.item.uid))}
                    onInsertAfter={(figureId) =>
                      setItems((items) => {
                        const next = [...items];
                        next.splice(idx + 1, 0, { uid: newId(), figureId });
                        return next;
                      })
                    }
                    onOpen={() => onOpenFigure(r.fig)}
                  />
                </li>
              );
            })}
          </ol>
          {routine.loop && rows.length > 1 && renderTransition(rows[rows.length - 1], rows[loopTo] ?? rows[0], true)}
        </section>

        <aside className="card picker">
          <div className="row-between">
            <h3>{t("addFigure")}</h3>
            <button
              className="btn small"
              onClick={() =>
                custom.create(routine.dance, { lockDance: true, onSaved: (c) => api.addFigure(routine.id, c.id) })
              }
            >
              + {t("addCustom")}
            </button>
          </div>
          <input
            className="search"
            type="search"
            placeholder={t("searchShort")}
            aria-label={t("search")}
            value={pickerQ}
            onChange={(e) => setPickerQ(e.target.value)}
          />
          {routine.cls !== "B" && (
            <label className="check">
              <input type="checkbox" checked={showIllegal} onChange={(e) => setShowIllegal(e.target.checked)} />
              {t("showAll")}
            </label>
          )}
          <ul className="picker-list">
            {pickerFigures.map((f) => {
              const { main } = figureNames(f, lang);
              const legal = isLegal(f, routine.cls);
              return (
                <li key={f.id} className={legal ? "" : "illegal"}>
                  <button
                    type="button"
                    className="icon-btn drag-handle"
                    onPointerDown={startPickerDrag(f, true)}
                    aria-label={t("dragToRoutine")}
                    title={t("dragToRoutine")}
                  >
                    ⠿
                  </button>
                  <button
                    className="picker-add"
                    onPointerDown={startPickerDrag(f, false)}
                    onClick={() => {
                      if (suppressClick.current) {
                        suppressClick.current = false;
                        return;
                      }
                      api.addFigure(routine.id, f.id);
                    }}
                    title={t("addToRoutine")}
                  >
                    <span className="plus">{f.custom ? "★" : "+"}</span>
                    <span className="picker-name">{main}</span>
                    {f.syllabus?.timing && <code className="timing small">{f.syllabus.timing}</code>}
                  </button>
                  <button className="icon-btn" onClick={() => onOpenFigure(f)} aria-label={t("details")}>
                    ⓘ
                  </button>
                </li>
              );
            })}
          </ul>
        </aside>
      </div>
      {drag && drag.from === null && drag.label && (
        <div className={`drag-ghost ${drag.over === null ? "outside" : ""}`} style={{ left: drag.x + 12, top: drag.y + 12 }} aria-hidden>
          + {drag.label}
        </div>
      )}
    </div>
  );
}
