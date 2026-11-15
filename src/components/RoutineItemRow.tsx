// One figure in a routine: name, timing choice, variant (part / start / finish)
// and personal note. The variant panel offers the options found in the
// WDSF Syllabus notes plus a custom step range (flagged when not allowed).
import { useState } from "react";
import { figureNames, getFigure, isLegal, type ClassId, type Dance, type Figure } from "../data";
import { useI18n, type StringKey } from "../i18n";
import type { RoutineItem } from "../routines";
import { formatBars, totalBeats } from "../timing";
import { partLabel, type ResolvedItem, type VariantChoice } from "../variants";
import { getHold, localizePositions } from "../glossary";
import { alignLabel, eighths, figureAlignment, norm180, turnHintOf, turnOptions } from "../floor";
import { ClassBadges } from "./ClassBadges";
import { HoldPicker } from "./HoldPicker";
import { AltChoice, PositionChoice, TimingChoice } from "./FigureChoices";
import { altLabel } from "../alternatives";

interface Props {
  /** Facing of the man at the start / end in the floor plan (degrees relative to the LOD of wallSide). */
  planFace?: { start: number | null; end: number | null; offChart: number; autoTurn?: number };
  /** Jump to the figure in the floor plan. */
  onEditInPlan?: () => void;
  /** Dance travels around the floor (corner markers make sense). */
  progressive: boolean;
  index: number;
  count: number;
  item: RoutineItem;
  fig: Figure;
  dance: Dance;
  cls: ClassId;
  resolved: ResolvedItem;
  classLegal: boolean;
  onChange: (patch: Partial<RoutineItem>) => void;
  onMove: (delta: number) => void;
  /** Start dragging this figure to a new place (pointer on the drag handle). */
  onDragStart?: (e: React.PointerEvent) => void;
  onRemove: () => void;
  /** Insert a figure right after this one ("what can follow"). */
  onInsertAfter?: (figureId: string) => void;
  onOpen: () => void;
}

export function RoutineItemRow(props: Props) {
  const { planFace, onEditInPlan, progressive, index, count, item, fig, dance, cls, resolved, classLegal, onChange, onMove, onDragStart, onRemove, onOpen, onInsertAfter } = props;
  const { t, lang, barsWord } = useI18n();
  const [open, setOpen] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [nextOpen, setNextOpen] = useState(false);
  const { main, sub } = figureNames(fig, lang);
  const syl = fig.syllabus;
  const variants = syl?.variants ?? {};
  const variant: VariantChoice = item.variant ?? {};
  const beats = totalBeats(resolved.steps);

  const setVariant = (patch: Partial<VariantChoice>) => {
    const next = { ...variant, ...patch };
    // Drop empty keys so "whole figure / basic" is stored as no variant at all.
    (Object.keys(next) as (keyof VariantChoice)[]).forEach((k) => next[k] === undefined && delete next[k]);
    onChange({ variant: Object.keys(next).length ? next : undefined });
  };


  // --- part options ---
  const parts = variants.parts ?? [];
  const partKey = variant.part ? `${variant.part.from}-${variant.part.to ?? "end"}` : "";
  const knownPart = !variant.part || parts.some((p) => `${p.from}-${p.to ?? "end"}` === partKey);
  const partSelectValue = !variant.part ? "" : knownPart ? partKey : "__custom";

  // Summary chips shown in the collapsed row.
  const chips: string[] = [];
  if (variant.part) chips.push(`${t("stepsWord")} ${partLabel(resolved.from, variant.part.to === null ? null : resolved.to, t("toEnd"))}`);
  if (variant.start !== undefined && variants.starts?.[variant.start])
    chips.push(
      `${t("start")}: ${localizePositions(lang === "cs" ? variants.starts[variant.start].descCs : variants.starts[variant.start].desc, lang)}`,
    );
  if (variant.finish !== undefined && variants.finishes?.[variant.finish])
    chips.push(`${t("finish")}: ${localizePositions(variants.finishes[variant.finish].position, lang)}`);
  if (variant.startPosition) chips.push(`${t("start")}: ${localizePositions(variant.startPosition, lang)} (${t("positionOwnChip")})`);
  if (variant.finishPosition) chips.push(`${t("finish")}: ${localizePositions(variant.finishPosition, lang)} (${t("positionOwnChip")})`);

  // Chosen alternatives (other ways of dancing the figure).
  for (const id of variant.alts ?? []) {
    const a = fig.alternatives?.find((x) => x.id === id);
    if (a) chips.push(`${t("altChip")}: ${altLabel(a, lang, (k, v) => t(k as StringKey, v))}`);
  }
  const holds = syl?.holds;
  if (variant.startHold || variant.finishHold) {
    const sh = getHold(resolved.startHold);
    const fh = getHold(resolved.finishHold);
    chips.push(
      `${t("holdsTitle")}: ${sh ? sh[lang] : "?"}${fh && fh.key !== sh?.key ? ` → ${fh[lang]}` : ""}`,
    );
  }

  // Alignment: given by the technique (WDSF chart). The figure starts where the
  // previous one ended; the user may only change the amount of turn where the
  // technique allows it.
  const alignBase = figureAlignment(fig, { from: resolved.from, to: resolved.isPart ? resolved.to : undefined });
  const follows = !!fig.floor?.follows;
  const range = fig.floor?.turnRange;
  const baseTurn = alignBase ? norm180(alignBase.end - alignBase.start) : 0;
  const turnDir = Math.abs(baseTurn) < 10 ? turnHintOf(fig.en) : baseTurn < 0 ? -1 : 1;
  const turnLabel = (deg: number) =>
    deg === 0
      ? t("alignAsChart")
      : turnDir === 0
        ? t(deg > 0 ? "alignByLeft" : "alignByRight", { n: eighths(deg) })
        : t(Math.sign(deg) === Math.sign(turnDir) ? "alignMore" : "alignLess", { n: eighths(deg) });
  // A stored turn outside the allowed range (older data) is not applied.
  // undefined = automatic (the plan picks an allowed amount that connects to the next figure)
  const choreo = !!variant.choreo && variant.extraTurn !== undefined;
  const chosen = choreo
    ? variant.extraTurn
    : range && variant.extraTurn !== undefined && variant.extraTurn >= range.min && variant.extraTurn <= range.max
      ? variant.extraTurn
      : undefined;
  const autoTurn = chosen === undefined ? (planFace?.autoTurn ?? 0) : 0;
  const extra = chosen ?? autoTurn;
  if (extra) chips.push(`${t("alignTurn")}: ${turnLabel(extra)}${choreo ? ` (${t("alignChoreoChip")})` : ""}`);
  if (variant.startTurn)
    chips.push(`${t("startTurnLabel")}: ${t(variant.startTurn > 0 ? "alignByLeft" : "alignByRight", { n: eighths(variant.startTurn) })}`);
  if (variant.stepScales?.some((x) => x !== 1)) chips.push(t("stepLengthsChanged"));
  // Turns by the choreography: any 1/8 up to 1/2 either way, outside the WDSF range.
  const allowedTurns = range ? turnOptions(range) : [0];
  const choreoTurns = [180, 135, 90, 45, -45, -90, -135, -180].filter((d) => !allowedTurns.includes(d));
  const offChart = planFace?.offChart ?? 0;
  if (progressive && alignBase && Math.abs(offChart) >= 22.5)
    chips.push(`↻ ${t("alignOffChartShort", { dir: t(offChart > 0 ? "alignByLeft" : "alignByRight", { n: eighths(offChart) }) })}`);

  // Figures that can follow (from the step charts' "follows" lists), catalog ones only.
  const followers = (fig.floor?.following ?? [])
    .map((l) => ({ fig: l.id ? getFigure(l.id) : undefined, note: l.note }))
    .filter((x): x is { fig: Figure; note: string | undefined } => !!x.fig && x.fig.dance === fig.dance)
    .filter((x, i, a) => a.findIndex((y) => y.fig.id === x.fig.id && y.note === x.note) === i);

  const hasOptions =
    (fig.alternatives?.length ?? 0) > 0 ||
    parts.length > 0 ||
    (variants.starts?.length ?? 0) > 0 ||
    (variants.finishes?.length ?? 0) > 0 ||
    !!(holds && (holds.alts.length || holds.any)) ||
    !!alignBase ||
    follows;
  const illegal = !classLegal || !resolved.partAllowed || (!resolved.positionsAllowed && cls !== "B");

  return (
    <div className={`item ${illegal ? "illegal" : ""}`}>
      <span className={`bib small ${dance.discipline}`} title={fig.custom ? t("customFigure") : undefined}>
        {index + 1}
      </span>
      <div className="item-main">
        <button className="link-btn item-name" onClick={onOpen}>
          {main}
        </button>
        {sub && <div className="fig-sub">{sub}</div>}
        {fig.custom && <span className="custom-badge">★ {t("customBadge")}</span>}

        {!classLegal &&
          (fig.custom ? (
            <div className="illegal-msg">✗ {t("customIllegal")}</div>
          ) : (
            <div className="illegal-msg">
              ✗ {t("illegal")} {cls} <ClassBadges fig={fig} highlight={cls} />
            </div>
          ))}
        {!resolved.partAllowed && <div className="illegal-msg">✗ {t("partNotAllowed")}</div>}
        {!resolved.positionsAllowed && cls !== "B" && <div className="illegal-msg">✗ {t("positionNotAllowed")}</div>}

        {chips.length > 0 && (
          <div className="variant-chips">
            {chips.map((c) => (
              <span key={c} className="vchip">
                {c}
              </span>
            ))}
          </div>
        )}

        <div className="item-timing">
          <TimingChoice item={item} fig={fig} resolved={resolved} onChange={onChange} />
          {resolved.isPart && <code className="timing">{resolved.timingText}</code>}
          <span className="muted small">
            {formatBars(beats, dance.beatsPerBar)} {barsWord(beats, dance.beatsPerBar)}
          </span>
        </div>

        <div className="item-links">
          <button
            className={`variant-toggle ${hasOptions ? "has" : ""}`}
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            title={hasOptions ? t("variantsAvailable") : undefined}
          >
            {open ? "▾" : "▸"} {t("editVariant")}
            {(fig.alternatives?.length ?? 0) > 0 && !open && <span className="muted small"> · {t("altTitle").toLowerCase()} {fig.alternatives!.length}</span>}
          </button>
          {onEditInPlan && (
            <button type="button" className="link-btn small" onClick={onEditInPlan}>
              ⌖ {t("planShowFigure")}
            </button>
          )}
          {!item.note && !noteOpen && (
            <button type="button" className="link-btn small" onClick={() => setNoteOpen(true)}>
              + {t("noteAdd")}
            </button>
          )}
          {onInsertAfter && followers.length > 0 && (
            <button type="button" className="link-btn small" onClick={() => setNextOpen((o) => !o)} aria-expanded={nextOpen}>
              {nextOpen ? "▾" : "▸"} {t("nextOptions")} ({followers.length})
            </button>
          )}
        </div>

        {open && (
          <div className="variant-panel">
            {(fig.alternatives?.length ?? 0) > 0 && (
              <fieldset className="alt-fields">
                <legend>{t("altTitle")}</legend>
                <AltChoice item={item} fig={fig} onChange={onChange} />
              </fieldset>
            )}
            <label className="field">
              <span>{t("partOfFigure")}</span>
              <select
                value={partSelectValue}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === "") setVariant({ part: undefined });
                  else if (v === "__custom") setVariant({ part: { from: 1, to: resolved.totalSteps } });
                  else {
                    const p = parts.find((x) => `${x.from}-${x.to ?? "end"}` === v)!;
                    setVariant({ part: { from: p.from, to: p.to } });
                  }
                }}
              >
                <option value="">
                  {t("wholeFigure")} ({t("stepsWord")} 1–{resolved.totalSteps || "?"})
                </option>
                {parts.map((p) => (
                  <option key={`${p.from}-${p.to}`} value={`${p.from}-${p.to ?? "end"}`}>
                    {t("stepsWord")} {partLabel(p.from, p.to, t("toEnd"))}
                  </option>
                ))}
                <option value="__custom">{t("customPart")}</option>
              </select>
            </label>
            {partSelectValue === "__custom" && variant.part && (
              <div className="range-row">
                <label className="field">
                  <span>{t("fromStep")}</span>
                  <input
                    type="number"
                    min={1}
                    max={resolved.totalSteps}
                    value={variant.part.from}
                    onChange={(e) =>
                      setVariant({ part: { from: Math.max(1, +e.target.value || 1), to: variant.part!.to } })
                    }
                  />
                </label>
                <label className="field">
                  <span>{t("toStep")}</span>
                  <input
                    type="number"
                    min={variant.part.from}
                    max={resolved.totalSteps}
                    value={variant.part.to ?? resolved.totalSteps}
                    onChange={(e) =>
                      setVariant({ part: { from: variant.part!.from, to: Math.max(variant.part!.from, +e.target.value || 1) } })
                    }
                  />
                </label>
              </div>
            )}

            <label className="field">
              <span>{t("start")}</span>
              <PositionChoice which="start" discipline={dance.discipline === "latin" ? "latin" : "standard"} item={item} fig={fig} resolved={resolved} onChange={onChange} />
            </label>

            <label className="field">
              <span>{t("finish")}</span>
              <PositionChoice which="finish" discipline={dance.discipline === "latin" ? "latin" : "standard"} item={item} fig={fig} resolved={resolved} onChange={onChange} />
            </label>

            {(alignBase || follows) && (
              <fieldset className="align-fields">
                <legend>{t("alignTitle")}</legend>
                {follows ? (
                  <p className="small">{t("alignFollows")}</p>
                ) : (
                  alignBase && (
                    <p className="small">
                      {t("alignChart")}: <strong>{alignLabel(alignBase.start, lang)}</strong> →{" "}
                      <strong>{alignLabel(norm180(alignBase.end + extra), lang)}</strong>
                    </p>
                  )
                )}
                {progressive && planFace && planFace.start !== null && (
                  <p className="small">
                    {t("alignHere")}: <strong>{alignLabel(planFace.start, lang)}</strong>
                    {planFace.end !== null && (
                      <>
                        {" "}→ <strong>{alignLabel(planFace.end, lang)}</strong>
                      </>
                    )}
                  </p>
                )}
                {progressive && alignBase && Math.abs(offChart) >= 22.5 && (
                  <p className="small warn">
                    ⚠ {t("alignOffChart", { dir: t(offChart > 0 ? "alignByLeft" : "alignByRight", { n: eighths(offChart) }) })}
                  </p>
                )}
                {alignBase && (
                  <label className="field">
                    <span>{t("alignTurn")}</span>
                    <select
                      value={chosen === undefined ? "auto" : `${choreo ? "c" : "a"}${chosen}`}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (v === "auto") setVariant({ extraTurn: undefined, choreo: undefined });
                        else setVariant({ extraTurn: +v.slice(1), choreo: v[0] === "c" ? true : undefined });
                      }}
                    >
                      <option value="auto">
                        {range ? t("alignTurnAuto", { turn: turnLabel(autoTurn) }) : t("alignAsChart")}
                      </option>
                      <optgroup label={t("alignTurnWdsf")}>
                        {allowedTurns.map((deg) => (
                          <option key={deg} value={`a${deg}`}>
                            {turnLabel(deg)}
                          </option>
                        ))}
                      </optgroup>
                      <optgroup label={t("alignTurnChoreoGroup")}>
                        {choreoTurns.map((deg) => (
                          <option key={deg} value={`c${deg}`}>
                            {turnLabel(deg)}
                          </option>
                        ))}
                      </optgroup>
                    </select>
                    {range ? (
                      <span className="small muted">
                        {t("alignTurnRule")}: {lang === "cs" && range.noteCs ? range.noteCs : range.note}
                      </span>
                    ) : (
                      <span className="small muted">{t("alignTurnFixed")}</span>
                    )}
                    {choreo && <span className="small">ℹ {t("alignChoreoNote")}</span>}
                  </label>
                )}
                {onEditInPlan && (
                  <button type="button" className="btn small plan-edit-btn" onClick={onEditInPlan}>
                    ⌖ {t("planShowFigure")}
                  </button>
                )}
              </fieldset>
            )}

            {holds && (holds.start || holds.finish) && (
              <>
                <HoldPicker
                  label={t("holdStart")}
                  value={resolved.startHold}
                  base={holds.start ?? null}
                  allowed={holds.alts}
                  any={!!holds.any}
                  onChange={(k) => setVariant({ startHold: k })}
                />
                <HoldPicker
                  label={t("holdFinish")}
                  value={resolved.finishHold}
                  base={holds.finish ?? null}
                  allowed={holds.alts}
                  any={!!holds.any}
                  onChange={(k) => setVariant({ finishHold: k })}
                />
              </>
            )}

            {resolved.estimated && <p className="small muted">{t("estimatedHint")}</p>}

            {syl && syl.notes.length > 0 && (
              <details className="variant-notes">
                <summary>{t("variantNotes")}</summary>
                <ul className="notes" lang="en">
                  {syl.notes.map((n, i) => (
                    <li key={i}>
                      {n.topic && <strong>{n.topic}: </strong>}
                      {n.text}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        )}

        {(item.note || noteOpen) && (
        <input
          autoFocus={noteOpen && !item.note}
          className="note-input"
          placeholder={t("myNote")}
          value={item.note ?? ""}
          onChange={(e) => onChange({ note: e.target.value })}
          aria-label={t("noteLabel")}
        />
        )}
        {onInsertAfter && followers.length > 0 && nextOpen && (
          <div className="next-options">
            <div className="chips">
              {followers.map(({ fig: nf, note }) => (
                <button
                  key={nf.id + (note ?? "")}
                  type="button"
                  className={`btn small next-option ${isLegal(nf, cls) || cls === "B" ? "" : "illegal"}`}
                  onClick={() => onInsertAfter(nf.id)}
                  title={t("nextOptionAdd")}
                >
                  + {figureNames(nf, lang).main}
                  {note && <span className="muted"> ({note})</span>}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
      <div className="item-actions">
        {onDragStart && count > 1 && (
          <button
            type="button"
            className="icon-btn drag-handle"
            onPointerDown={onDragStart}
            aria-label={t("dragHint")}
            title={t("dragHint")}
          >
            ⠿
          </button>
        )}
        <button className="icon-btn" disabled={index === 0} onClick={() => onMove(-1)} aria-label={t("moveUp")} title={t("moveUp")}>
          ↑
        </button>
        <button
          className="icon-btn"
          disabled={index === count - 1}
          onClick={() => onMove(1)}
          aria-label={t("moveDown")}
          title={t("moveDown")}
        >
          ↓
        </button>
        <button className="icon-btn danger" onClick={onRemove} aria-label={t("remove")} title={t("remove")}>
          ✕
        </button>
      </div>
    </div>
  );
}
