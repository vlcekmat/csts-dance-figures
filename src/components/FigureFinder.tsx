// "Find the figure" helper: the dancer describes what they remember, results
// update live, each with the reasons why it matches or not.
import { useMemo, useState } from "react";
import { CLASSES, DANCES, allFigures, figureNames, getDance, getFigure, type ClassId, type Figure } from "../data";
import { activeCriteria, emptyQuery, findFigures, type Dir, type FinderQuery, type Reason, type StepSpec, type TurnDir } from "../finder";
import { HOLDS, POSITIONS, getHold, localizePositions } from "../glossary";
import { useI18n, type StringKey } from "../i18n";
import type { Foot } from "../timing";
import { HoldIcon } from "./HoldPicker";

const DIRS: Dir[] = ["fwd", "bwd", "side", "place"];
const BARS = [0.5, 1, 1.5, 2, 3, 4];

interface Props {
  onOpen: (fig: Figure) => void;
}

/** Chip group for a single choice; clicking the active chip clears it. */
function Choice<T extends string | number>({
  value,
  options,
  onChange,
  label,
}: {
  value: T | "";
  options: { v: T; label: string }[];
  onChange: (v: T | "") => void;
  label: string;
}) {
  return (
    <div className="chips" role="group" aria-label={label}>
      {options.map((o) => (
        <button
          key={String(o.v)}
          type="button"
          className={`chip ${value === o.v ? "active" : ""}`}
          aria-pressed={value === o.v}
          onClick={() => onChange(value === o.v ? "" : o.v)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function FigureFinder({ onOpen }: Props) {
  const { t, lang } = useI18n();
  const [q, setQ] = useState<FinderQuery>(() => emptyQuery());
  const set = (patch: Partial<FinderQuery>) => setQ((x) => ({ ...x, ...patch }));
  const dance = getDance(q.dance);
  const latin = dance.discipline === "latin";
  const prev = q.prevId ? getFigure(q.prevId) : undefined;

  const footOpts = (["LF", "RF"] as Foot[]).map((f) => ({ v: f, label: lang === "cs" ? (f === "RF" ? "Pravá (Pn)" : "Levá (Ln)") : f === "RF" ? "Right (RF)" : "Left (LF)" }));
  const dirOpts = DIRS.map((d) => ({ v: d, label: t(`fd_${d}` as StringKey) }));
  const positions = POSITIONS.filter((p) => !!p.latin === latin && p.en !== "Diag. R Angle");
  const posSelect = (value: string, onChange: (v: string) => void, label: string) => (
    <label className="field">
      <span>{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">{t("fdDontKnow")}</option>
        {positions.map((p) => (
          <option key={p.en} value={p.en}>
            {lang === "cs" ? `${p.cs} (${p.en})` : p.en}
          </option>
        ))}
      </select>
    </label>
  );
  const holdChoice = (value: string, onChange: (v: string) => void, label: string) => (
    <fieldset className="finder-holds">
      <legend>{label}</legend>
      <div className="finder-hold-grid">
        {HOLDS.map((h) => (
          <button
            key={h.key}
            type="button"
            className={`hold-tile ${value === h.key ? "selected" : ""}`}
            aria-pressed={value === h.key}
            onClick={() => onChange(value === h.key ? "" : h.key)}
          >
            <HoldIcon hold={h} size={64} />
            <span className="hold-name">{h[lang]}</span>
          </button>
        ))}
      </div>
    </fieldset>
  );

  const results = useMemo(() => findFigures(q, prev), [q, prev]);
  const active = activeCriteria(q, prev);
  const shown = results.filter((r) => r.score > 0).slice(0, 10);

  const reasonText = (r: Reason) => {
    const v = { ...(r.vars ?? {}) };
    if (v.foot) v.foot = lang === "cs" ? (v.foot === "RF" ? "Pn" : "Ln") : v.foot;
    if (v.dir) v.dir = v.dir === "R" || v.dir === "L" || v.dir === "none" ? t(`fdTurn_${v.dir}` as StringKey) : t(`fd_${v.dir}` as StringKey);
    if (v.pos) v.pos = localizePositions(v.pos, lang);
    if (v.hold) v.hold = getHold(v.hold)?.[lang] ?? v.hold;
    if (v.t) v.t = t(v.t === "spot" ? "fdSpot" : "fdTravel");
    return t(r.key as StringKey, v);
  };

  const updateStep = (i: number, patch: Partial<StepSpec>) =>
    set({ steps: q.steps.map((s, k) => (k === i ? { ...s, ...patch } : s)) });

  const prevOptions = allFigures().filter((f) => f.dance === q.dance);

  return (
    <div className="finder">
      <header className="finder-head">
        <h2>{t("finderTitle")}</h2>
        <p className="muted">{t("finderIntro")}</p>
      </header>

      <div className="finder-cols">
        <form className="card finder-form" onSubmit={(e) => e.preventDefault()}>
          <section>
            <h3>{t("dance")}</h3>
            <div className="dance-chips">
              {DANCES.filter((d) => d.id !== "polka").map((d) => (
                <button
                  key={d.id}
                  type="button"
                  className={`chip ${q.dance === d.id ? "active" : ""} ${d.discipline}`}
                  onClick={() => setQ({ ...emptyQuery(d.id), cls: q.cls, keywords: q.keywords })}
                >
                  <span className="abbr" aria-hidden>
                    {d.abbr}
                  </span>
                  {d[lang]}
                </button>
              ))}
            </div>
            <div className="filter-row">
              <label className="field">
                <span>{t("classLabel")}</span>
                <select value={q.cls} onChange={(e) => set({ cls: e.target.value as ClassId | "" })}>
                  <option value="">{t("anyClass")}</option>
                  {CLASSES.map((c) => (
                    <option key={c} value={c}>
                      {c === "B" ? t("classB") : c}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field grow">
                <span>{t("fdPrev")}</span>
                <select value={q.prevId} onChange={(e) => set({ prevId: e.target.value })}>
                  <option value="">{t("fdDontKnow")}</option>
                  {prevOptions.map((f) => (
                    <option key={f.id} value={f.id}>
                      {figureNames(f, lang).main}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {prev && <p className="small muted">{t("fdPrevHint")}</p>}
          </section>

          <section>
            <h3>{t("start")}</h3>
            <div className="finder-q">
              <span className="finder-label">{t("fdFoot")}</span>
              <Choice value={q.startFoot} options={footOpts} onChange={(v) => set({ startFoot: v })} label={t("fdFoot")} />
            </div>
            <div className="finder-q">
              <span className="finder-label">{t("fdDir")}</span>
              <Choice value={q.startDir} options={dirOpts} onChange={(v) => set({ startDir: v })} label={t("fdDir")} />
            </div>
            {posSelect(q.startPos, (v) => set({ startPos: v }), t("cfPos"))}
            {latin && holdChoice(q.startHold, (v) => set({ startHold: v }), t("holdStart"))}
          </section>

          <section>
            <h3>{t("fdSteps")}</h3>
            <p className="small muted">{t("fdStepsHint")}</p>
            <ol className="finder-steps">
              {q.steps.map((s, i) => (
                <li key={i}>
                  <span className="finder-step-no">{i + 1}.</span>
                  <Choice value={s.foot} options={footOpts} onChange={(v) => updateStep(i, { foot: v })} label={t("fdFoot")} />
                  <Choice value={s.dir} options={dirOpts} onChange={(v) => updateStep(i, { dir: v })} label={t("fdDir")} />
                  <button type="button" className="icon-btn" aria-label={t("remove")} onClick={() => set({ steps: q.steps.filter((_, k) => k !== i) })}>
                    ✕
                  </button>
                </li>
              ))}
            </ol>
            <button type="button" className="btn small" onClick={() => set({ steps: [...q.steps, { foot: "", dir: "" }] })}>
              + {t("fdAddStep")}
            </button>
          </section>

          <section>
            <h3>{t("finish")}</h3>
            {posSelect(q.finishPos, (v) => set({ finishPos: v }), t("cfPos"))}
            <div className="finder-q">
              <span className="finder-label">{t("fdWeight")}</span>
              <Choice value={q.finishFoot} options={footOpts} onChange={(v) => set({ finishFoot: v })} label={t("fdWeight")} />
            </div>
            {latin && holdChoice(q.finishHold, (v) => set({ finishHold: v }), t("holdFinish"))}
          </section>

          <section>
            <h3>{t("fdMore")}</h3>
            <div className="finder-q">
              <span className="finder-label">{t("fdBars")}</span>
              <Choice
                value={q.bars || ""}
                options={BARS.map((b) => ({ v: b, label: b === 0.5 ? "½" : b === 1.5 ? "1½" : String(b) }))}
                onChange={(v) => set({ bars: v === "" ? 0 : v })}
                label={t("fdBars")}
              />
            </div>
            <label className="field narrow">
              <span>{t("fdStepCount")}</span>
              <input
                type="number"
                min={0}
                max={40}
                value={q.stepCount || ""}
                onChange={(e) => set({ stepCount: Math.max(0, parseInt(e.target.value, 10) || 0) })}
              />
            </label>
            <div className="finder-q">
              <span className="finder-label">{t("fdTurn")}</span>
              <Choice
                value={q.turn}
                options={(["R", "L", "none"] as TurnDir[]).map((d) => ({ v: d, label: t(`fdTurn_${d}` as StringKey) }))}
                onChange={(v) => set({ turn: v })}
                label={t("fdTurn")}
              />
            </div>
            <div className="finder-q">
              <span className="finder-label">{t("cfTravel")}</span>
              <Choice
                value={q.travel}
                options={[
                  { v: "spot" as const, label: t("fdSpot") },
                  { v: "travel" as const, label: t("fdTravel") },
                ]}
                onChange={(v) => set({ travel: v })}
                label={t("cfTravel")}
              />
            </div>
            <label className="field">
              <span>{t("fdKeywords")}</span>
              <input value={q.keywords} placeholder={t("fdKeywordsPh")} onChange={(e) => set({ keywords: e.target.value })} />
            </label>
          </section>

          <button type="button" className="btn" onClick={() => setQ(emptyQuery(q.dance))}>
            {t("fdReset")}
          </button>
        </form>

        <section className="finder-results" aria-live="polite">
          <h3>
            {t("fdResults")} <span className="muted small">{dance[lang]}</span>
          </h3>
          {active === 0 ? (
            <p className="empty">{t("fdEmpty")}</p>
          ) : (
            <ol className="finder-list">
              {shown.map((r, i) => {
                const { main, sub } = figureNames(r.fig, lang);
                const pct = Math.round(r.score * 100);
                return (
                  <li key={r.fig.id} className={`finder-hit ${i === 0 && pct >= 70 ? "top" : ""}`}>
                    <button type="button" className="finder-hit-head" onClick={() => onOpen(r.fig)}>
                      <span className={`bib small ${dance.discipline} ${r.fig.custom ? "custom" : ""}`}>{r.fig.custom ? "★" : r.fig.no}</span>
                      <span className="fig-names">
                        <span className="fig-main">{main}</span>
                        {sub && <span className="fig-sub">{sub}</span>}
                      </span>
                      <span className="finder-score" title={t("fdScore")}>
                        <span className="finder-bar">
                          <span style={{ width: `${pct}%` }} />
                        </span>
                        {pct} %
                      </span>
                    </button>
                    <ul className="finder-reasons">
                      {r.reasons.map((rs, k) => (
                        <li key={k} className={rs.kind}>
                          {rs.kind === "match" ? "✓" : rs.kind === "partial" ? "~" : "✗"} {reasonText(rs)}
                        </li>
                      ))}
                    </ul>
                  </li>
                );
              })}
            </ol>
          )}
          {active > 0 && <p className="small muted">{t("fdResultsHint")}</p>}
        </section>
      </div>
    </div>
  );
}
