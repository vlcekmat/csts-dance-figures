// Choices of one routine figure shared by the routine list and the floor plan:
// timing (basic, alternatives, own) and the couple position at the start / end.
import type { Figure } from "../data";
import { useI18n } from "../i18n";
import type { RoutineItem } from "../routines";
import type { ResolvedItem, VariantChoice } from "../variants";
import { localizePositions } from "../glossary";

interface Props {
  item: RoutineItem;
  fig: Figure;
  resolved: ResolvedItem;
  onChange: (patch: Partial<RoutineItem>) => void;
}

/** Change the variant, dropping empty keys ("basic" = no variant stored). */
export function patchVariant(item: RoutineItem, patch: Partial<VariantChoice>): Partial<RoutineItem> {
  const next: VariantChoice = { ...(item.variant ?? {}), ...patch };
  (Object.keys(next) as (keyof VariantChoice)[]).forEach((k) => next[k] === undefined && delete next[k]);
  return { variant: Object.keys(next).length ? next : undefined };
}

export function TimingChoice({ item, fig, resolved, onChange, showSteps }: Props & { showSteps?: boolean }) {
  const { t } = useI18n();
  const syl = fig.syllabus;
  const options = syl ? [syl.timing, ...syl.altTimings].filter((v, i, a) => v && a.indexOf(v) === i) : [];
  const custom = item.timing !== undefined && !options.includes(item.timing);
  return (
    <>
      <select
        value={custom ? "__custom" : (item.timing ?? syl?.timing ?? "")}
        onChange={(e) => {
          const v = e.target.value;
          onChange({ timing: v === "__custom" ? resolved.timingText || syl?.timing || "" : v === syl?.timing ? undefined : v });
        }}
        aria-label={t("timing")}
      >
        {options.map((o, i) => (
          <option key={o} value={o}>
            {o}
            {i === 0 ? ` (${t("primaryTiming")})` : ""}
          </option>
        ))}
        <option value="__custom">{t("customTiming")}</option>
      </select>
      {custom && (
        <input className="timing-input" value={item.timing} onChange={(e) => onChange({ timing: e.target.value })} aria-label={t("customTiming")} />
      )}
      {showSteps && resolved.steps.length > 0 && (
        <span className="timing-steps" aria-label={t("timing")}>
          {resolved.steps.map((st, i) => (
            <span key={i} className={`timing-step ${st.held ? "held" : ""}`} title={`${i + resolved.from}`}>
              <span className="ts-n">{i + resolved.from}</span>
              <span className="ts-c">{st.label}</span>
            </span>
          ))}
        </span>
      )}
    </>
  );
}

/** Couple positions offered as an own choice (outside the syllabus). */
const POSITIONS: Record<"standard" | "latin", string[]> = {
  standard: [
    "Closed Position",
    "Promenade Position",
    "Counter Promenade Position",
    "Outside Partner",
    "Partner Outside",
    "Wing Position",
    "Fallaway Position",
  ],
  latin: [
    "Closed Position",
    "Open Position",
    "Fan Position",
    "Promenade Position",
    "Counter Promenade Position",
    "Left Side Position",
    "Right Side Position",
    "Shadow Position",
    "Tandem Position",
    "Open Counter Promenade Position",
  ],
};

export function PositionChoice({ item, fig, resolved, onChange, which, discipline }: Props & { which: "start" | "finish"; discipline: "standard" | "latin" }) {
  const { t, lang } = useI18n();
  const syl = fig.syllabus;
  const variants = syl?.variants ?? {};
  const variant = item.variant ?? {};
  const own = which === "start" ? variant.startPosition : variant.finishPosition;
  const idx = which === "start" ? variant.start : variant.finish;
  const value = own ? `pos:${own}` : (idx ?? "");
  const set = (v: string) => {
    const index = v === "" || v.startsWith("pos:") ? undefined : +v;
    const pos = v.startsWith("pos:") ? v.slice(4) : undefined;
    onChange(
      patchVariant(item, which === "start" ? { start: index, startPosition: pos } : { finish: index, finishPosition: pos }),
    );
  };
  const basic =
    which === "start"
      ? `${localizePositions((lang === "cs" ? syl?.startCs : syl?.start) ?? "", lang)} (${t("primaryTiming")})`
      : resolved.isPart && resolved.to < resolved.totalSteps
        ? t("finishOfPart", { step: String(resolved.to), pos: localizePositions(resolved.finishPos ?? "?", lang) })
        : `${localizePositions((lang === "cs" ? syl?.finishCs : syl?.finish) ?? "", lang)} (${t("primaryTiming")})`;
  const alts =
    which === "start"
      ? (variants.starts ?? []).map((s) => localizePositions(lang === "cs" ? s.descCs : s.desc, lang))
      : (variants.finishes ?? []).map((f) => localizePositions(f.position, lang));
  return (
    <select value={value} onChange={(e) => set(e.target.value)} aria-label={t(which === "start" ? "start" : "finish")} className={own ? "warn" : ""}>
      <option value="">{basic}</option>
      {alts.length > 0 && (
        <optgroup label={t("positionSyllabus")}>
          {alts.map((label, i) => (
            <option key={i} value={i}>
              {label}
            </option>
          ))}
        </optgroup>
      )}
      <optgroup label={t("positionOwn")}>
        {POSITIONS[discipline].map((p) => (
          <option key={p} value={`pos:${p}`}>
            {localizePositions(p, lang)}
          </option>
        ))}
      </optgroup>
    </select>
  );
}
