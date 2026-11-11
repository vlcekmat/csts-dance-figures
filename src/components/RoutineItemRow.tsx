// One figure in a routine: name, timing choice, variant (part / start / finish)
// and personal note. The variant panel offers the options found in the
// WDSF Syllabus notes plus a custom step range (flagged when not allowed).
import { useState } from "react";
import { figureNames, type ClassId, type Dance, type Figure } from "../data";
import { useI18n, type StringKey } from "../i18n";
import type { RoutineItem } from "../routines";
import { formatBars, totalBeats } from "../timing";
import { partLabel, type ResolvedItem, type VariantChoice } from "../variants";
import { getHold, localizePositions } from "../glossary";
import { AIMS, EXPLICIT_AIMS, alignLabel, eighths, figureAlignment, norm180, startsBacking, turnHintOf, type Aim } from "../floor";
import { ClassBadges } from "./ClassBadges";
import { HoldPicker } from "./HoldPicker";

interface Props {
  /** Wall the figure is danced on (floor plan), 0–3. */
  wallSide?: number;
  /** The wall was set by the user at this figure. */
  wallManual?: boolean;
  /** An automatic corner was inserted before this figure. */
  wallAuto?: boolean;
  /** Rotation actually applied by the floor plan (resolves an aim). */
  appliedRotate?: number;
  /** Jump to the floor plan and rotate this figure there. */
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
  onRemove: () => void;
  onOpen: () => void;
}

export function RoutineItemRow(props: Props) {
  const { wallSide, wallManual, wallAuto, appliedRotate, onEditInPlan, progressive, index, count, item, fig, dance, cls, resolved, classLegal, onChange, onMove, onRemove, onOpen } = props;
  const { t, lang, barsWord } = useI18n();
  const [open, setOpen] = useState(false);
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

  // --- timing options (basic + alternatives from notes) ---
  const timingOptions = syl ? [syl.timing, ...syl.altTimings].filter((v, i, a) => v && a.indexOf(v) === i) : [];
  const timingIsCustom = item.timing !== undefined && !timingOptions.includes(item.timing);

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

  const holds = syl?.holds;
  if (variant.startHold || variant.finishHold) {
    const sh = getHold(resolved.startHold);
    const fh = getHold(resolved.finishHold);
    chips.push(
      `${t("holdsTitle")}: ${sh ? sh[lang] : "?"}${fh && fh.key !== sh?.key ? ` → ${fh[lang]}` : ""}`,
    );
  }

  // Alignment (only figures with a step chart that gives alignments).
  const alignBase = figureAlignment(fig, { from: resolved.from, to: resolved.isPart ? resolved.to : undefined });
  const alignNow = figureAlignment(fig, {
    from: resolved.from,
    to: resolved.isPart ? resolved.to : undefined,
    rotate: appliedRotate ?? variant.rotate,
    extraTurn: variant.extraTurn,
  });
  const backing = startsBacking(alignBase?.start ?? null);
  // Wall names for the aim labels: on a long wall the wall ahead is short, the opposite one long.
  const onLong = (wallSide ?? 0) % 2 === 0;
  const aimLabel = (a: Aim) =>
    EXPLICIT_AIMS.includes(a)
      ? t(`aim_${a}` as StringKey)
      : `${t(backing ? "aimBacking" : "aimFacing")} ${t(`aim_${a}` as StringKey, {
      aheadGen: t(onLong ? "wallShortGen" : "wallLongGen"),
      oppGen: t(onLong ? "wallLongGen" : "wallShortGen"),
      aheadAcc: t(onLong ? "wallShortAcc" : "wallLongAcc"),
      oppAcc: t(onLong ? "wallLongAcc" : "wallShortAcc"),
    })}`;
  const alignMode = variant.aim ?? (variant.rotate || variant.extraTurn ? "custom" : "");
  const baseTurn = alignBase ? norm180(alignBase.end - alignBase.start) : 0;
  const turnDir = Math.abs(baseTurn) < 10 ? turnHintOf(fig.en) : baseTurn < 0 ? -1 : 1;
  if (variant.aim) chips.push(`${t("alignChip")}: ${aimLabel(variant.aim)}`);
  else if (variant.rotate) chips.push(`${t("alignChip")}: ${t(variant.rotate > 0 ? "alignByLeft" : "alignByRight", { n: eighths(variant.rotate) })}`);
  if (variant.extraTurn)
    chips.push(
      `${t("alignTurn")}: ${
        turnDir === 0
          ? t(variant.extraTurn > 0 ? "alignByLeft" : "alignByRight", { n: eighths(variant.extraTurn) })
          : t(Math.sign(variant.extraTurn) === Math.sign(turnDir) ? "alignMore" : "alignLess", { n: eighths(variant.extraTurn) })
      }`,
    );

  const hasOptions =
    parts.length > 0 ||
    (variants.starts?.length ?? 0) > 0 ||
    (variants.finishes?.length ?? 0) > 0 ||
    !!(holds && (holds.alts.length || holds.any)) ||
    !!alignBase;
  const illegal = !classLegal || !resolved.partAllowed;

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
        {progressive && wallSide !== undefined && (
          <span className={`wall-chip ${wallManual || item.wall !== undefined ? "manual" : ""}`} title={t("wallLabel")}>
            ▭ {t(`wall${(((wallSide % 4) + 4) % 4)}` as StringKey)}
            {wallAuto ? ` · ${t("wallCornerBefore")}` : ""}
            {item.wall !== undefined ? ` · ${t("wallManualShort")}` : ""}
          </span>
        )}
        {onEditInPlan && (
          <button type="button" className="link-btn small plan-edit-link" onClick={onEditInPlan}>
            ⟲ {t("planRotateOpen")}
          </button>
        )}
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
          <select
            value={timingIsCustom ? "__custom" : (item.timing ?? syl?.timing ?? "")}
            onChange={(e) => {
              const v = e.target.value;
              onChange({
                timing: v === "__custom" ? resolved.timingText || syl?.timing || "" : v === syl?.timing ? undefined : v,
              });
            }}
            aria-label={t("timing")}
          >
            {timingOptions.map((o, i) => (
              <option key={o} value={o}>
                {o}
                {i === 0 ? ` (${t("primaryTiming")})` : ""}
              </option>
            ))}
            <option value="__custom">{t("customTiming")}</option>
          </select>
          {timingIsCustom && (
            <input
              className="timing-input"
              value={item.timing}
              onChange={(e) => onChange({ timing: e.target.value })}
              aria-label={t("customTiming")}
            />
          )}
          {resolved.isPart && <code className="timing">{resolved.timingText}</code>}
          <span className="muted small">
            {formatBars(beats, dance.beatsPerBar)} {barsWord(beats, dance.beatsPerBar)}
          </span>
        </div>

        <button
          className={`variant-toggle ${hasOptions ? "has" : ""}`}
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
        >
          {open ? "▾" : "▸"} {t("editVariant")}
          {hasOptions && !open && <span className="muted small"> ({t("variantsAvailable")})</span>}
        </button>

        {open && (
          <div className="variant-panel">
            {progressive && wallSide !== undefined && (
              <label className="field">
                <span>{t("wallLabel")}</span>
                <select
                  value={item.wall ?? ""}
                  onChange={(e) => onChange({ wall: e.target.value === "" ? undefined : +e.target.value })}
                >
                  <option value="">{t("wallAuto", { wall: t(`wall${(((wallSide % 4) + 4) % 4)}` as StringKey) })}</option>
                  {[0, 1, 2, 3].map((w) => (
                    <option key={w} value={w}>
                      {t(`wall${w}` as StringKey)}
                    </option>
                  ))}
                </select>
              </label>
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
              <select
                value={variant.start ?? ""}
                onChange={(e) => setVariant({ start: e.target.value === "" ? undefined : +e.target.value })}
              >
                <option value="">
                  {localizePositions((lang === "cs" ? syl?.startCs : syl?.start) ?? "", lang)} ({t("primaryTiming")})
                </option>
                {(variants.starts ?? []).map((s, i) => (
                  <option key={i} value={i}>
                    {localizePositions(lang === "cs" ? s.descCs : s.desc, lang)}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>{t("finish")}</span>
              <select
                value={variant.finish ?? ""}
                onChange={(e) => setVariant({ finish: e.target.value === "" ? undefined : +e.target.value })}
              >
                <option value="">
                  {resolved.isPart && resolved.to < resolved.totalSteps
                    ? t("finishOfPart", { step: String(resolved.to), pos: localizePositions(resolved.finishPos ?? "?", lang) })
                    : `${localizePositions((lang === "cs" ? syl?.finishCs : syl?.finish) ?? "", lang)} (${t("primaryTiming")})`}
                </option>
                {(variants.finishes ?? []).map((f, i) => (
                  <option key={i} value={i}>
                    {localizePositions(f.position, lang)}
                  </option>
                ))}
              </select>
            </label>

            {alignBase && (
              <fieldset className="align-fields">
                <legend>{t("alignTitle")}</legend>
                <label className="field">
                  <span>{t("alignStartAt")}</span>
                  <select
                    value={alignMode}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v === "") setVariant({ aim: undefined, rotate: undefined, extraTurn: undefined });
                      else if (v === "custom") setVariant({ aim: undefined });
                      else setVariant({ aim: v as Aim, rotate: undefined });
                    }}
                  >
                    <option value="">
                      {t("alignAsChart")}: {alignBase ? alignLabel(alignBase.start, lang) : ""}
                    </option>
                    {progressive &&
                      AIMS.map((a) => (
                        <option key={a} value={a}>
                          {aimLabel(a)}
                        </option>
                      ))}
                    <option value="custom">{t("alignCustom")}</option>
                  </select>
                </label>
                {onEditInPlan && (
                  <button type="button" className="btn small plan-edit-btn" onClick={onEditInPlan}>
                    ⟲ {t("planRotateOpen")}
                  </button>
                )}
                <details className="align-detail" open={alignMode === "custom"}>
                  <summary>{t("alignDetail")}</summary>
                <label className="field">
                  <span>{t("alignRotate")}</span>
                  <select
                    value={variant.rotate ?? 0}
                    onChange={(e) => setVariant({ rotate: +e.target.value || undefined })}
                  >
                    {[135, 90, 45, 0, -45, -90, -135].map((deg) => (
                      <option key={deg} value={deg}>
                        {deg === 0
                          ? t("alignAsChart")
                          : t(deg > 0 ? "alignByLeft" : "alignByRight", { n: eighths(deg) })}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>{t("alignTurn")}</span>
                  <select
                    value={variant.extraTurn ?? 0}
                    onChange={(e) => setVariant({ extraTurn: +e.target.value || undefined })}
                  >
                    {[2, 1, 0, -1, -2].map((k) => {
                      // "more" follows the figure's own turn direction (natural = right).
                      const deg = k * 45 * (turnDir < 0 ? -1 : 1);
                      return (
                        <option key={k} value={deg}>
                          {k === 0
                            ? t("alignAsChart")
                            : turnDir === 0
                              ? t(deg > 0 ? "alignByLeft" : "alignByRight", { n: eighths(deg) })
                              : t(k > 0 ? "alignMore" : "alignLess", { n: eighths(deg) })}
                        </option>
                      );
                    })}
                  </select>
                </label>
                </details>
                {alignNow && (
                  <p className="small">
                    {t("start")}: <strong>{alignLabel(alignNow.start, lang)}</strong> → {t("finish")}:{" "}
                    <strong>{alignLabel(alignNow.end, lang)}</strong>
                  </p>
                )}
                {(variant.rotate || variant.extraTurn) && (
                  <button type="button" className="btn small align-reset" onClick={() => setVariant({ rotate: undefined, extraTurn: undefined })}>
                    ↺ {t("alignReset")}
                  </button>
                )}
                <p className="small muted">{t("alignHint")}</p>
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

        <input
          className="note-input"
          placeholder={t("myNote")}
          value={item.note ?? ""}
          onChange={(e) => onChange({ note: e.target.value })}
          aria-label={t("noteLabel")}
        />
        {progressive && index < count - 1 && (
          <label className="check small corner-check">
            <input type="checkbox" checked={!!item.corner} onChange={(e) => onChange({ corner: e.target.checked || undefined })} />
            {t("cornerAfter")}
          </label>
        )}
      </div>
      <div className="item-actions">
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
