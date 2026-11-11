// Create / edit a user-defined figure. Start and finish are entered as foot +
// direction + position and stored in the WDSF text format, so the foot and
// position checks of the routine editor work for custom figures too.
import { useEffect, useState } from "react";
import { DANCES, getDance } from "../data";
import { useI18n } from "../i18n";
import { formatBars, parseTiming, totalBeats } from "../timing";
import { type CustomFigure, type StepEnd, type Travel } from "../customFigures";
import { HoldPicker } from "./HoldPicker";
import { POSITIONS } from "../glossary";
import { Glossed } from "./Glossary";
import { TimingStrip } from "./TimingStrip";
import { TimingExplain } from "./TimingBreakdown";

const DIRS = ["fwd", "bwd", "to side", "diag fwd", "diag bwd", "closes", "in place"];

interface Props {
  initial: CustomFigure;
  /** Dance can't be changed (e.g. when adding from a routine). */
  lockDance?: boolean;
  onSave: (c: CustomFigure) => void;
  onCancel: () => void;
  onDelete?: () => void;
}

export function CustomFigureForm({ initial, lockDance, onSave, onCancel, onDelete }: Props) {
  const { t, lang, barsWord } = useI18n();
  const [c, setC] = useState<CustomFigure>(initial);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const dance = getDance(c.dance);
  const latin = dance.discipline === "latin";
  // Standard dances get the standard positions, latin the latin ones.
  const positionOptions = POSITIONS.filter((p) => !!p.latin === latin && p.en !== "Diag. R Angle");
  const steps = c.timing.trim() ? parseTiming(c.timing, dance) : [];
  const beats = totalBeats(steps);
  const nameOk = c.cs.trim().length > 0;
  const timingOk = steps.length > 0 && beats > 0;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onCancel();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  const set = (patch: Partial<CustomFigure>) => setC((x) => ({ ...x, ...patch }));
  // Czech plural: 1 krok, 2–4 kroky, 5+ kroků.
  const stepsWord = (n: number) =>
    lang === "en" ? (n === 1 ? "step" : "steps") : n === 1 ? "krok" : n >= 2 && n <= 4 ? "kroky" : "kroků";
  const insert = (sym: string) => set({ timing: c.timing + sym });

  const endFields = (which: "start" | "finish") => {
    const e = c[which];
    const upd = (patch: Partial<StepEnd>) => set({ [which]: { ...e, ...patch } } as Partial<CustomFigure>);
    return (
      <fieldset className="end-fields">
        <legend>{which === "start" ? t("start") : t("finish")}</legend>
        <label className="field">
          <span>{t("cfFoot")}</span>
          <select value={e.foot} onChange={(ev) => upd({ foot: ev.target.value as StepEnd["foot"] })}>
            <option value="">–</option>
            <option value="RF">{lang === "cs" ? "Pn (RF)" : "RF"}</option>
            <option value="LF">{lang === "cs" ? "Ln (LF)" : "LF"}</option>
          </select>
        </label>
        <label className="field">
          <span>{t("cfDir")}</span>
          <select value={e.dir} onChange={(ev) => upd({ dir: ev.target.value })}>
            <option value="">–</option>
            {DIRS.map((d) => (
              <option key={d} value={d}>
                {t(`dir_${d.replace(/ /g, "_")}` as never)}
              </option>
            ))}
          </select>
        </label>
        <label className="field grow">
          <span>{t("cfPos")}</span>
          <select
            value={positionOptions.some((p) => p.en === e.pos) || !e.pos ? e.pos : "__other"}
            onChange={(ev) => upd({ pos: ev.target.value === "__other" ? e.pos || " " : ev.target.value })}
          >
            <option value="">–</option>
            {positionOptions.map((p) => (
              <option key={p.en} value={p.en}>
                {lang === "cs" ? `${p.cs} (${p.en})` : p.en}
              </option>
            ))}
            <option value="__other">{t("cfPosOther")}</option>
          </select>
        </label>
        {e.pos && !positionOptions.some((p) => p.en === e.pos) && (
          <label className="field grow">
            <span>{t("cfPosOther")}</span>
            <input value={e.pos.trim()} onChange={(ev) => upd({ pos: ev.target.value })} />
          </label>
        )}
      </fieldset>
    );
  };

  return (
    <div className="overlay" onClick={onCancel}>
      <aside className="drawer" role="dialog" aria-modal="true" aria-labelledby="cf-title" onClick={(e) => e.stopPropagation()}>
        <header className="drawer-head">
          <div>
            <div className="eyebrow">{t("customFigure")}</div>
            <h2 id="cf-title">{c.cs || t("cfNew")}</h2>
          </div>
          <button className="icon-btn" onClick={onCancel} aria-label={t("close")}>
            ✕
          </button>
        </header>

        <form
          className="cf-form"
          onSubmit={(e) => {
            e.preventDefault();
            if (nameOk && timingOk) onSave({ ...c, cs: c.cs.trim(), en: c.en?.trim() || undefined, timing: c.timing.trim() });
          }}
        >
          <section className="drawer-section">
            <p className="callout small">{t("cfLegalHint")}</p>
            <label className="field">
              <span>{t("cfNameCs")} *</span>
              <input value={c.cs} onChange={(e) => set({ cs: e.target.value })} required autoFocus />
            </label>
            <label className="field">
              <span>{t("cfNameEn")}</span>
              <input value={c.en ?? ""} onChange={(e) => set({ en: e.target.value })} />
            </label>
            <label className="field">
              <span>{t("dance")}</span>
              <select value={c.dance} disabled={lockDance} onChange={(e) => set({ dance: e.target.value, startHold: undefined, finishHold: undefined })}>
                {DANCES.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d[lang]}
                  </option>
                ))}
              </select>
            </label>
          </section>

          <section className="drawer-section">
            <label className="field">
              <span>{t("timing")} *</span>
              <input
                value={c.timing}
                onChange={(e) => set({ timing: e.target.value })}
                placeholder={dance.units.S === 2 && dance.discipline === "standard" && dance.beatsPerBar === 4 ? "SQQ" : dance.beatsPerBar === 3 ? "123" : "2 3 4&1"}
                className="timing-input wide"
                aria-invalid={!!c.timing && !timingOk}
              />
            </label>
            <div className="chips cf-symbols" aria-label={t("cfInsert")}>
              {["S", "Q", "&", "a", "1", "2", "3", "4", " ", "(", ")"].map((sym) => (
                <button key={sym} type="button" className="chip" onClick={() => insert(sym)}>
                  {sym === " " ? "␣" : sym}
                </button>
              ))}
              <button type="button" className="chip" onClick={() => set({ timing: c.timing.slice(0, -1) })}>
                ⌫
              </button>
            </div>
            {timingOk ? (
              <>
                <p className="small">
                  {steps.length} {stepsWord(steps.length)}, {formatBars(beats, dance.beatsPerBar)} {barsWord(beats, dance.beatsPerBar)} ({dance.meter})
                </p>
                <TimingStrip dance={dance} segments={[{ key: "preview", steps }]} />
                <TimingExplain dance={dance} timing={c.timing} />
              </>
            ) : (
              c.timing && <p className="small warn-text">{t("cfTimingBad")}</p>
            )}
          </section>

          <section className="drawer-section">
            {endFields("start")}
            {endFields("finish")}
            <p className="small muted">{t("cfEndsHint")}</p>
          </section>

          {latin && (
            <section className="drawer-section">
              <HoldPicker
                label={t("holdStart")}
                value={c.startHold ?? null}
                base={null}
                allowed={[]}
                any
                onChange={(k) => set({ startHold: k === c.startHold ? undefined : k })}
              />
              <HoldPicker
                label={t("holdFinish")}
                value={c.finishHold ?? c.startHold ?? null}
                base={null}
                allowed={[]}
                any
                onChange={(k) => set({ finishHold: k })}
              />
            </section>
          )}

          <section className="drawer-section">
            <fieldset className="travel-fields">
              <legend>{t("cfTravel")}</legend>
              {(["spot", "small", "travel"] as Travel[]).map((tr) => (
                <label key={tr} className="check">
                  <input type="radio" name="travel" checked={c.travel === tr} onChange={() => set({ travel: tr })} />
                  {t(`cfTravel_${tr}` as never)}
                </label>
              ))}
            </fieldset>
            <p className="small muted">
              <Glossed text={t("lodExplain")} />
            </p>
            <label className="field">
              <span>{t("cfNote")}</span>
              <textarea rows={3} value={c.note ?? ""} onChange={(e) => set({ note: e.target.value })} />
            </label>
            <label className="field">
              <span>{t("cfVideo")}</span>
              <input type="url" placeholder="https://www.youtube.com/watch?v=…" value={c.videoUrl ?? ""} onChange={(e) => set({ videoUrl: e.target.value })} />
            </label>
          </section>

          <footer className="drawer-foot cf-actions">
            <div className="chips">
              <button type="submit" className="btn primary" disabled={!nameOk || !timingOk}>
                {t("cfSave")}
              </button>
              <button type="button" className="btn" onClick={onCancel}>
                {t("cfCancel")}
              </button>
              {onDelete &&
                (confirmDelete ? (
                  <button type="button" className="btn danger" onClick={onDelete}>
                    {t("confirmDelete")}
                  </button>
                ) : (
                  <button type="button" className="btn" onClick={() => setConfirmDelete(true)}>
                    {t("delete")}
                  </button>
                ))}
            </div>
            {(!nameOk || !timingOk) && <p className="small muted">{t("cfRequired")}</p>}
          </footer>
        </form>
      </aside>
    </div>
  );
}
