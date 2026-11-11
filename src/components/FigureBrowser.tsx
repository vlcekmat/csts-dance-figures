// Searchable, filterable list of all catalog figures grouped by dance.
import { useMemo } from "react";
import {
  CLASSES,
  DANCES,
  allFigures,
  danceInClass,
  figureNames,
  fold,
  getFigure,
  searchText,
  isLegal,
  type ClassId,
  type Figure,
} from "../data";
import { useI18n } from "../i18n";
import { ClassBadges } from "./ClassBadges";
import { useCustom } from "./CustomFigureHost";

export interface Filters {
  q: string;
  dance: string; // "" = all
  cls: ClassId | "";
  onlyLegal: boolean;
}

interface Props {
  filters: Filters;
  setFilters: (f: Filters) => void;
  onOpen: (fig: Figure) => void;
}

/** Match all whitespace-separated terms against Czech + English name and timing. */
function matches(fig: Figure, terms: string[]): boolean {
  if (!terms.length) return true;
  const hay = fold([searchText(fig), String(fig.no), fig.syllabus?.timing ?? ""].join(" "));
  return terms.every((t) => hay.includes(t));
}

export function FigureBrowser({ filters, setFilters, onOpen }: Props) {
  const { t, lang } = useI18n();
  const custom = useCustom();
  const set = (patch: Partial<Filters>) => setFilters({ ...filters, ...patch });

  const groups = useMemo(() => {
    const terms = fold(filters.q).split(/\s+/).filter(Boolean);
    return DANCES.filter((d) => !filters.dance || d.id === filters.dance)
      .map((d) => ({
        dance: d,
        figures: allFigures().filter(
          (f) =>
            f.dance === d.id &&
            matches(f, terms) &&
            (!filters.onlyLegal || !filters.cls || isLegal(f, filters.cls)),
        ),
      }))
      .filter((g) => g.figures.length > 0);
    // custom.api.list: re-run when the user's own figures change
  }, [filters, custom.api.list]);

  const count = groups.reduce((s, g) => s + g.figures.length, 0);
  const disciplines: [string, string][] = [
    ["standard", t("standard")],
    ["latin", t("latin")],
    ["other", t("other")],
  ];

  return (
    <div className="browser">
      <div className="filters">
        <input
          className="search"
          type="search"
          placeholder={t("search")}
          value={filters.q}
          onChange={(e) => set({ q: e.target.value })}
          aria-label={t("search")}
        />
        <div className="dance-chips" role="group" aria-label={t("dance")}>
          <button
            className={`chip ${filters.dance === "" ? "active" : ""}`}
            onClick={() => set({ dance: "" })}
          >
            {t("allDances")}
          </button>
          {disciplines.map(([disc]) =>
            DANCES.filter((d) => d.discipline === disc).map((d) => (
              <button
                key={d.id}
                className={`chip ${filters.dance === d.id ? "active" : ""} ${disc}`}
                onClick={() => set({ dance: filters.dance === d.id ? "" : d.id })}
              >
                <span className="abbr" aria-hidden>
                  {d.abbr}
                </span>
                {d[lang]}
              </button>
            )),
          )}
        </div>
        <div className="filter-row">
          <label className="field">
            <span>{t("classLabel")}</span>
            <select
              value={filters.cls}
              onChange={(e) => set({ cls: e.target.value as ClassId | "" })}
            >
              <option value="">{t("anyClass")}</option>
              {CLASSES.map((c) => (
                <option key={c} value={c}>
                  {c === "B" ? t("classB") : c}
                </option>
              ))}
            </select>
          </label>
          <label className={`check ${filters.cls ? "" : "disabled"}`}>
            <input
              type="checkbox"
              checked={filters.onlyLegal}
              disabled={!filters.cls}
              onChange={(e) => set({ onlyLegal: e.target.checked })}
            />
            {t("onlyLegal")}
          </label>
          <button className="btn small" onClick={() => custom.create(filters.dance || "waltz", { onSaved: (c) => onOpen(getFigure(c.id)!) })}>
            + {t("addCustom")}
          </button>
          <span className="muted small count">
            {count} {t("results")}
          </span>
        </div>
      </div>

      {count === 0 && <p className="empty">{t("noResults")}</p>}

      {groups.map(({ dance, figures }) => (
        <section key={dance.id} className="dance-group">
          <header className={`dance-title ${dance.discipline}`}>
            <h2>{dance[lang]}</h2>
            <span className="dance-meta">
              <span className="meter">{dance.meter}</span>
              {dance.tempo && (
                <span>
                  {dance.tempo} {t("barsPerMin")}
                </span>
              )}
            </span>
          </header>
          {filters.cls && !danceInClass(dance.id, filters.cls) && (
            <p className="callout warn small">{t("notDancedInClass")}</p>
          )}
          <ul className="fig-list">
            {figures.map((f) => {
              const { main, sub } = figureNames(f, lang);
              const illegal = filters.cls ? !isLegal(f, filters.cls) : false;
              return (
                <li key={f.id}>
                  <button className={`fig-row ${illegal ? "illegal" : ""}`} onClick={() => onOpen(f)}>
                    <span className={`bib small ${dance.discipline} ${f.custom ? "custom" : ""}`}>{f.custom ? "★" : f.no}</span>
                    <span className="fig-names">
                      <span className="fig-main">{main}</span>
                      {sub && <span className="fig-sub">{sub}</span>}
                      {(() => {
                        // Show which other name matched, so the hit makes sense.
                        const terms = fold(filters.q).split(/\s+/).filter(Boolean);
                        if (!terms.length) return null;
                        const own = fold(`${f.cs} ${f.en ?? ""}`);
                        if (terms.every((tm) => own.includes(tm))) return null;
                        const hit = [...(f.aliases?.[lang] ?? []), ...(f.aliases?.[lang === "cs" ? "en" : "cs"] ?? [])].find(
                          (a) => terms.some((tm) => fold(a).includes(tm)),
                        );
                        return hit ? (
                          <span className="fig-alias">
                            {t("alsoKnownAs")}: {hit}
                          </span>
                        ) : null;
                      })()}
                    </span>
                    {f.syllabus?.timing && <code className="timing">{f.syllabus.timing}</code>}
                    {f.custom ? (
                      <span className="custom-badge" title={t("customIllegal")}>
                        {t("customBadge")}
                      </span>
                    ) : (
                      <ClassBadges fig={f} highlight={filters.cls} />
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
          {dance.remarks && (!filters.dance || filters.dance === dance.id) && filters.dance && (
            <details className="remarks">
              <summary>{t("remarks")}</summary>
              {dance.remarks.map((r, i) => (
                <p key={i} className="small">
                  {r[lang]}
                </p>
              ))}
            </details>
          )}
        </section>
      ))}
    </div>
  );
}
