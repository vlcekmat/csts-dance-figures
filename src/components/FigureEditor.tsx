// Owner's chart editor (dev server only – lazy loaded behind import.meta.env.DEV).
// Edits the man's and lady's steps of a figure with a live player preview and saves
// them through the dev server into src/data/edits.json (see scripts/editorServer.js).
import { useEffect, useMemo, useState } from "react";
import { EDITS, FIGURES, baseFigure, figureNames, getDance, withEdit, type Figure } from "../data";
import { diffRole, expandRole, type EditField, type FigureEdit } from "../edits";
import { alignLabel, chartSteps, type FloorStep } from "../floor";
import { localizePositions, localizeStep } from "../glossary";
import { useI18n } from "../i18n";
import { mirrorSteps } from "../playerGeometry";
import { FigurePlayer } from "./FigurePlayer";

type Role = "man" | "lady";
interface Row {
  key: number;
  from?: number;
  step: FloorStep;
}

let uid = 0;
const toRows = (rows: { from?: number; step: FloorStep }[]): Row[] => rows.map((r) => ({ ...r, key: ++uid }));

const ANGLES: [EditField, string][] = [
  ["face", "edFace"],
  ["end", "edEnd"],
  ["body", "edBody"],
  ["moving", "edMoving"],
  ["rot", "edRot"],
];

async function post(url: string, data: unknown): Promise<{ ok?: boolean; error?: string; nothing?: boolean }> {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
  return res.json();
}

/** Number input that lets the user type "-" or "" without the value jumping. */
function NumInput({ value, onChange, title }: { value: number | undefined; onChange: (v: number | undefined) => void; title?: string }) {
  const [text, setText] = useState(value === undefined ? "" : String(value));
  useEffect(() => {
    setText((t) => (Number(t) === value && t !== "" ? t : value === undefined ? "" : String(value)));
  }, [value]);
  return (
    <input
      className="ed-num"
      inputMode="decimal"
      value={text}
      title={title}
      onChange={(e) => {
        const s = e.target.value.replace(",", ".");
        setText(s);
        if (s.trim() === "") onChange(undefined);
        else if (Number.isFinite(Number(s))) onChange(Number(s));
      }}
    />
  );
}

export default function FigureEditor({ figId, onBack, onOpen }: { figId?: string; onBack: () => void; onOpen: (id: string) => void }) {
  const { t, lang } = useI18n();
  const base = figId ? baseFigure(figId) : undefined;
  if (!base) return <EditList onOpen={onOpen} />;
  return <Editor key={base.id} base={base} onBack={onBack} t={t} lang={lang} />;
}

/** Figures with edits + publish. */
function EditList({ onOpen }: { onOpen: (id: string) => void }) {
  const { t, lang } = useI18n();
  const [q, setQ] = useState("");
  const [msg, setMsg] = useState("");
  const edited = Object.keys(EDITS);
  const found = q.trim().length > 1 ? FIGURES.filter((f) => `${f.id} ${f.cs} ${f.en ?? ""}`.toLowerCase().includes(q.toLowerCase())).slice(0, 30) : [];
  const line = (id: string) => {
    const f = FIGURES.find((x) => x.id === id);
    return f ? `${f.id} – ${figureNames(f, lang).main}` : id;
  };
  return (
    <section className="card ed-list">
      <h2>{t("edTitle")}</h2>
      <p className="muted small">{t("edIntro")}</p>
      <h3>{t("edEdited")} ({edited.length})</h3>
      {edited.length === 0 && <p className="muted">{t("edNone")}</p>}
      <ul>
        {edited.map((id) => (
          <li key={id}>
            <button className="link-btn" onClick={() => onOpen(id)}>
              {line(id)}
            </button>
            {EDITS[id].note && <span className="muted small"> – {EDITS[id].note}</span>}
          </li>
        ))}
      </ul>
      <PublishButton setMsg={setMsg} />
      {msg && <p className="small">{msg}</p>}
      <h3>{t("edFind")}</h3>
      <input className="ed-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="waltz-3, Natural Turn…" />
      <ul>
        {found.map((f) => (
          <li key={f.id}>
            <button className="link-btn" onClick={() => onOpen(f.id)}>
              {line(f.id)}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function PublishButton({ setMsg }: { setMsg: (s: string) => void }) {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  return (
    <button
      className="btn"
      disabled={busy}
      title={t("edPublishHint")}
      onClick={async () => {
        setBusy(true);
        setMsg(t("edPublishing"));
        try {
          const r = await post("/__edits/publish", {});
          setMsg(r.ok ? (r.nothing ? t("edNothingToPublish") : t("edPublished")) : `${t("edError")}: ${r.error}`);
        } catch (e) {
          setMsg(`${t("edError")}: ${e}`);
        }
        setBusy(false);
      }}
    >
      ⇪ {t("edPublish")}
    </button>
  );
}

function Editor({
  base,
  onBack,
  t,
  lang,
}: {
  base: Figure;
  onBack: () => void;
  t: ReturnType<typeof useI18n>["t"];
  lang: "cs" | "en";
}) {
  const saved = EDITS[base.id];
  const baseMan = base.floor?.steps ?? [];
  const baseLady = base.floor?.ladySteps ?? [];
  const initial = () => ({
    man: toRows(expandRole(baseMan, saved?.man)),
    lady: toRows(expandRole(baseLady, saved?.lady)),
    timing: saved?.timing ?? "",
    note: saved?.note ?? "",
  });
  const [state, setState] = useState(initial);
  const [role, setRole] = useState<Role>("man");
  const [msg, setMsg] = useState("");
  const dance = getDance(base.dance);
  const names = figureNames(base, lang);

  const draft: FigureEdit = useMemo(
    () => ({
      man: diffRole(baseMan, state.man),
      lady: diffRole(baseLady, state.lady),
      timing: state.timing.trim() || undefined,
      note: state.note.trim() || undefined,
    }),
    [state, baseMan, baseLady],
  );
  const hasEdit = !!(draft.man || draft.lady || draft.timing);
  const draftFig = useMemo(() => withEdit(base, draft), [base, draft]);
  const dirty = JSON.stringify(cleanUndef(draft)) !== (saved ? JSON.stringify(cleanUndef({ ...saved, updated: undefined })) : "{}");

  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (dirty) e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const rows = state[role];
  const baseSteps = role === "man" ? baseMan : baseLady;
  const shown = chartSteps(draftFig).length; // steps beyond the timing are cut in the player
  const setRows = (f: (r: Row[]) => Row[]) => setState((s) => ({ ...s, [role]: f(s[role]) }));
  const patch = (i: number, k: EditField, v: string | number | undefined) =>
    setRows((r) => r.map((row, j) => (j === i ? { ...row, step: { ...row.step, [k]: v } } : row)));
  const move = (i: number, d: number) =>
    setRows((r) => {
      const j = i + d;
      if (j < 0 || j >= r.length) return r;
      const out = [...r];
      [out[i], out[j]] = [out[j], out[i]];
      return out;
    });
  const insert = (i: number, step: FloorStep) => setRows((r) => [...r.slice(0, i), { key: ++uid, step }, ...r.slice(i)]);
  const remove = (i: number) => setRows((r) => r.filter((_, j) => j !== i));

  const positions = useMemo(() => {
    const set = new Set<string>();
    for (const f of FIGURES)
      if (getDance(f.dance)?.discipline === dance?.discipline)
        for (const s of [...(f.floor?.steps ?? []), ...(f.floor?.ladySteps ?? [])]) if (s.pos) set.add(s.pos);
    return [...set].sort();
  }, [dance]);
  const descs = useMemo(() => {
    const set = new Set<string>();
    for (const f of FIGURES) if (f.dance === base.dance) for (const s of [...(f.floor?.steps ?? []), ...(f.floor?.ladySteps ?? [])]) set.add(s.desc);
    return [...set].sort();
  }, [base.dance]);

  const save = async (edit: FigureEdit | null) => {
    setMsg(t("edSaving"));
    try {
      const r = await post("/__edits/save", { id: base.id, edit });
      // The dev server reloads the page with the new data after the file changes.
      setMsg(r.ok ? t("edSaved") : `${t("edError")}: ${r.error}`);
    } catch (e) {
      setMsg(`${t("edError")}: ${e}`);
    }
  };

  const changed = (row: Row, k: EditField) => {
    if (row.from === undefined) return true;
    const o = baseSteps[row.from];
    const a = o?.[k];
    const b = row.step[k];
    return !(a === b || ((a === undefined || a === "") && (b === undefined || b === "")));
  };
  const stale = [saved?.man && saved.man.baseLen !== baseMan.length, saved?.lady && saved.lady.baseLen !== baseLady.length].some(Boolean);

  return (
    <div className="editor">
      <div className="ed-head">
        <button className="btn small" onClick={onBack}>
          ← {t("edBack")}
        </button>
        <div>
          <div className="eyebrow">
            {dance?.[lang]} · {base.id} · {t("edTitle")}
          </div>
          <h2>{names.main}</h2>
          {names.sub && <div className="subname">{names.sub}</div>}
        </div>
      </div>

      {stale && <p className="callout small warn">{t("edStale")}</p>}

      <div className="ed-layout">
        <div className="ed-preview">
          {draftFig.floor && draftFig.floor.steps.length > 0 ? <FigurePlayer fig={draftFig} /> : <p className="muted">{t("edNoSteps")}</p>}
          <details className="ed-help small">
            <summary>{t("edAnglesHelp")}</summary>
            <p>{t("edAnglesText")}</p>
          </details>
        </div>

        <div className="ed-main">
          <div className="ed-figure-row">
            <label>
              {t("edTiming")}{" "}
              <input value={state.timing} placeholder={base.syllabus?.timing ?? ""} onChange={(e) => setState((s) => ({ ...s, timing: e.target.value }))} />
            </label>
            <label className="ed-note">
              {t("edNote")} <input value={state.note} onChange={(e) => setState((s) => ({ ...s, note: e.target.value }))} />
            </label>
          </div>

          <div className="seg" role="group">
            {(["man", "lady"] as const).map((r) => (
              <button key={r} className={role === r ? "active" : ""} onClick={() => setRole(r)}>
                {t(r === "man" ? "roleMan" : "roleLady")} ({state[r].length})
              </button>
            ))}
          </div>

          {role === "lady" && rows.length === 0 && state.man.length > 0 && (
            <p>
              <button className="btn small" onClick={() => setRows(() => toRows(mirrorSteps(state.man.map((r) => r.step)).map((step) => ({ step }))))}>
                {t("edMirror")}
              </button>
            </p>
          )}

          <div className="breakdown-scroll">
            <table className="breakdown ed-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>{t("chartDesc")}</th>
                  <th>{t("edCount")}</th>
                  <th>{t("chartAlign")}</th>
                  {ANGLES.map(([k, label]) => (
                    <th key={k} title={t(`${label}Hint` as Parameters<typeof t>[0])}>
                      {t(label as Parameters<typeof t>[0])}
                    </th>
                  ))}
                  <th>{t("chartTurn")}</th>
                  <th title={t("edSpanHint")}>{t("edSpan")}</th>
                  <th>{t("chartPos")}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => {
                  const s = row.step;
                  const cls = (k: EditField) => (changed(row, k) ? "changed" : "");
                  return (
                    <tr key={row.key} className={role === "man" && i >= shown ? "next-step" : ""}>
                      <td>
                        {i + 1}
                        {row.from === undefined && <span className="ed-new"> {t("edNew")}</span>}
                      </td>
                      <td className={cls("desc")}>
                        <input className="ed-desc" list="ed-descs" value={s.desc} onChange={(e) => patch(i, "desc", e.target.value)} />
                        <div className="muted small">{localizeStep(s.desc, lang)}</div>
                      </td>
                      <td className={cls("timing")}>
                        <input className="ed-short" value={s.timing ?? ""} onChange={(e) => patch(i, "timing", e.target.value || undefined)} />
                      </td>
                      <td className={cls("align")}>
                        <input className="ed-align" value={s.align} onChange={(e) => patch(i, "align", e.target.value)} />
                      </td>
                      {ANGLES.map(([k]) => (
                        <td key={k} className={cls(k)}>
                          <NumInput
                            value={s[k] as number | undefined}
                            onChange={(v) => patch(i, k, v)}
                            title={typeof s[k] === "number" && k !== "rot" ? alignLabel(s[k] as number, lang) : undefined}
                          />
                          {k === "face" && typeof s.face === "number" && <div className="muted small">{alignLabel(s.face, lang).replace(/ \(.*$/, "")}</div>}
                        </td>
                      ))}
                      <td className={cls("turn")}>
                        <input className="ed-turn" value={s.turn} onChange={(e) => patch(i, "turn", e.target.value)} />
                      </td>
                      <td className={cls("span")}>
                        <NumInput value={s.span} onChange={(v) => patch(i, "span", v)} />
                      </td>
                      <td className={cls("pos")}>
                        <input className="ed-pos" list="ed-positions" value={s.pos ?? ""} onChange={(e) => patch(i, "pos", e.target.value || undefined)} />
                        {s.pos && <div className="muted small">{localizePositions(s.pos, lang)}</div>}
                      </td>
                      <td className="ed-actions">
                        <button className="icon-btn" title={t("edUp")} disabled={i === 0} onClick={() => move(i, -1)}>
                          ↑
                        </button>
                        <button className="icon-btn" title={t("edDown")} disabled={i === rows.length - 1} onClick={() => move(i, 1)}>
                          ↓
                        </button>
                        <button className="icon-btn" title={t("edDuplicate")} onClick={() => insert(i + 1, { ...s })}>
                          ⧉
                        </button>
                        <button className="icon-btn" title={t("edInsert")} onClick={() => insert(i + 1, { desc: "", align: "", turn: "", pos: s.pos })}>
                          +
                        </button>
                        <button className="icon-btn danger" title={t("edDelete")} onClick={() => remove(i)}>
                          ✕
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <datalist id="ed-descs">
              {descs.map((d) => (
                <option key={d} value={d} />
              ))}
            </datalist>
            <datalist id="ed-positions">
              {positions.map((d) => (
                <option key={d} value={d} />
              ))}
            </datalist>
          </div>
          <p>
            <button className="btn small" onClick={() => insert(rows.length, { desc: "", align: "", turn: "", pos: rows[rows.length - 1]?.step.pos })}>
              + {t("edAddStep")}
            </button>
          </p>
          {role === "man" && rows.length > shown && <p className="muted small">{t("edCutNote", { n: String(shown) })}</p>}

          <div className="ed-bar">
            <button className="btn primary" disabled={!dirty} onClick={() => save(hasEdit || draft.note ? draft : null)}>
              {t("edSave")}
            </button>
            <button className="btn" disabled={!dirty} onClick={() => setState(initial())}>
              {t("edDiscard")}
            </button>
            <button
              className="btn"
              disabled={!saved && !hasEdit}
              onClick={() => {
                if (saved) save(null);
                else setState(initial());
              }}
              title={t("edResetHint")}
            >
              {t("edReset")}
            </button>
            <PublishButton setMsg={setMsg} />
            {dirty && <span className="ed-dirty small">● {t("edUnsaved")}</span>}
            {msg && <span className="small">{msg}</span>}
          </div>
        </div>
      </div>
    </div>
  );
}

function cleanUndef<T extends object>(o: T): T {
  return JSON.parse(JSON.stringify(o));
}
