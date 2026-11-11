// Overview of saved routines with create / duplicate / delete / import / export.
import { useRef, useState } from "react";
import { CLASSES, DANCES, getDance, getFigure, type ClassId } from "../data";
import { useI18n } from "../i18n";
import { downloadJson, newId, parseImported, type RoutinesApi } from "../routines";
import { formatBars, totalBeats } from "../timing";
import { resolveItem } from "../variants";
import { useCustom } from "./CustomFigureHost";

interface Props {
  api: RoutinesApi;
  onOpen: (id: string) => void;
}

export function RoutineList({ api, onOpen }: Props) {
  const { t, lang, barsWord } = useI18n();
  const custom = useCustom();
  const [name, setName] = useState("");
  const [dance, setDance] = useState(DANCES[0].id);
  const [cls, setCls] = useState<ClassId>("C");
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const create = () => {
    const d = getDance(dance);
    const r = api.create({ name: name.trim() || `${d[lang]} ${cls}`, dance, cls });
    setName("");
    onOpen(r.id);
  };

  const onImport = async (file: File) => {
    const data = parseImported(await file.text());
    if (!data) setError(t("importFailed"));
    else {
      setError(null);
      custom.api.addMany(data.customFigures);
      api.addMany(data.routines);
    }
  };

  return (
    <div className="routines">
      <section className="card new-routine">
        <h2>{t("newRoutine")}</h2>
        <div className="filter-row">
          <label className="field grow">
            <span>{t("routineName")}</span>
            <input value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && create()} />
          </label>
          <label className="field">
            <span>{t("dance")}</span>
            <select value={dance} onChange={(e) => setDance(e.target.value)}>
              {DANCES.map((d) => (
                <option key={d.id} value={d.id}>
                  {d[lang]}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>{t("classLabel")}</span>
            <select value={cls} onChange={(e) => setCls(e.target.value as ClassId)}>
              {CLASSES.map((c) => (
                <option key={c} value={c}>
                  {c === "B" ? t("classB") : c}
                </option>
              ))}
            </select>
          </label>
          <button className="btn primary" onClick={create}>
            + {t("newRoutine")}
          </button>
        </div>
      </section>

      <div className="row-between">
        <h2>{t("routines")}</h2>
        <div className="chips">
          <button className="btn" onClick={() => fileRef.current?.click()}>
            {t("import")}
          </button>
          {api.routines.length > 0 && (
            <button
              className="btn"
              onClick={() => downloadJson("sestavy.json", { routines: api.routines, customFigures: custom.api.list })}
            >
              {t("export")}
            </button>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onImport(f);
              e.target.value = "";
            }}
          />
        </div>
      </div>
      {error && <p className="callout warn">{error}</p>}
      {api.routines.length === 0 && <p className="empty">{t("noRoutines")}</p>}

      <ul className="routine-cards">
        {api.routines.map((r) => {
          const d = getDance(r.dance);
          const beats = r.items.reduce((s, it) => {
            const fig = getFigure(it.figureId);
            if (!fig) return s;
            const timing = it.timing ?? fig.syllabus?.timing ?? "";
            return s + totalBeats(resolveItem(fig, d, timing, it.variant).steps);
          }, 0);
          const illegal = r.items.filter((it) => {
            const fig = getFigure(it.figureId);
            return fig && r.cls !== "B" && !fig.classes.includes(r.cls);
          }).length;
          return (
            <li key={r.id} className="routine-card">
              <button className="routine-open" onClick={() => onOpen(r.id)}>
                <div className="routine-name">{r.name}</div>
                <div className="muted small">
                  {d[lang]}, {t("classLabel").toLowerCase()} {r.cls === "B" ? t("classB") : r.cls}, {r.items.length}{" "}
                  {t("figures")}, {formatBars(beats, d.beatsPerBar)} {barsWord(beats, d.beatsPerBar)}
                </div>
                <div className={`small ${illegal ? "bad-text" : "good-text"}`}>
                  {illegal ? `✗ ${illegal} ${t("illegalCount")} ${r.cls}` : `✓ ${t("legalAll")} ${r.cls === "B" ? t("classB") : r.cls}`}
                </div>
              </button>
              <div className="chips">
                <button
                  className="btn small"
                  onClick={() =>
                    api.addMany([
                      {
                        ...r,
                        id: newId(),
                        name: `${r.name} (2)`,
                        items: r.items.map((i) => ({ ...i, uid: newId() })),
                        updatedAt: Date.now(),
                      },
                    ])
                  }
                >
                  {t("duplicate")}
                </button>
                {confirmId === r.id ? (
                  <button className="btn small danger" onClick={() => api.remove(r.id)}>
                    {t("confirmDelete")}
                  </button>
                ) : (
                  <button className="btn small" onClick={() => setConfirmId(r.id)}>
                    {t("delete")}
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
