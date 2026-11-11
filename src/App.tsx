// App shell: header, tabs and a tiny hash router.
//   #/figures            figure browser (filters kept in query: ?dance=&cls=&q=&legal=1)
//   #/figures/<figId>    browser with the figure detail open
//   #/routines           routine list
//   #/routines/<id>      routine editor
//   #/about              sources and disclaimer
import { useCallback, useEffect, useState } from "react";
import { getFigure, type ClassId, type Figure } from "./data";
import { useI18n } from "./i18n";
import { useRoutines } from "./routines";
import { useTheme, type ThemeChoice } from "./theme";
import { FigureBrowser, type Filters } from "./components/FigureBrowser";
import { FigureDetail } from "./components/FigureDetail";
import { RoutineList } from "./components/RoutineList";
import { RoutineEditor } from "./components/RoutineEditor";
import { Help } from "./components/Help";
import { FigureFinder } from "./components/FigureFinder";

interface Route {
  page: "figures" | "finder" | "routines" | "about";
  id?: string;
  filters: Filters;
}

function parseHash(): Route {
  const [path, query = ""] = window.location.hash.replace(/^#\/?/, "").split("?");
  const [page, id] = path.split("/");
  const p = new URLSearchParams(query);
  const filters: Filters = {
    q: p.get("q") ?? "",
    dance: p.get("dance") ?? "",
    cls: (["E", "D", "C", "B"].includes(p.get("cls") ?? "") ? p.get("cls") : "") as ClassId | "",
    onlyLegal: p.get("legal") === "1",
  };
  const known = page === "routines" || page === "about" || page === "finder" ? page : "figures";
  return { page: known, id: id ? decodeURIComponent(id) : undefined, filters };
}

function buildHash(r: Route): string {
  const p = new URLSearchParams();
  if (r.page === "figures") {
    if (r.filters.q) p.set("q", r.filters.q);
    if (r.filters.dance) p.set("dance", r.filters.dance);
    if (r.filters.cls) p.set("cls", r.filters.cls);
    if (r.filters.onlyLegal) p.set("legal", "1");
  }
  const qs = p.toString();
  return `#/${r.page}${r.id ? "/" + encodeURIComponent(r.id) : ""}${qs ? "?" + qs : ""}`;
}

export default function App() {
  const { t, lang, setLang } = useI18n();
  const api = useRoutines();
  const { theme, setTheme } = useTheme();
  const [route, setRoute] = useState<Route>(parseHash);
  // Figure opened from the routine editor (shown as overlay without changing the route).
  const [overlayFig, setOverlayFig] = useState<Figure | null>(null);

  useEffect(() => {
    const onHash = () => setRoute(parseHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const go = useCallback((r: Route, replace = false) => {
    const hash = buildHash(r);
    if (replace) history.replaceState(null, "", hash);
    else history.pushState(null, "", hash);
    setRoute(r);
  }, []);

  useEffect(() => {
    document.title = t("appTitle");
  }, [t]);

  const openFig = route.page === "figures" && route.id ? getFigure(route.id) : undefined;
  const routine = route.page === "routines" && route.id ? api.routines.find((r) => r.id === route.id) : undefined;
  const closeDetail = useCallback(() => go({ ...route, id: undefined }), [go, route]);

  const tabs: [Route["page"], string][] = [
    ["figures", t("tabFigures")],
    ["finder", t("tabFinder")],
    ["routines", t("tabRoutines")],
    ["about", t("tabAbout")],
  ];

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="logo-mark" aria-hidden>
            f
          </span>
          <div>
            <div className="brand-title">{t("appTitle")}</div>
            <div className="brand-sub">{t("appSubtitle")}</div>
          </div>
        </div>
        <nav className="tabs" aria-label="main">
          {tabs.map(([page, label]) => (
            <button
              key={page}
              className={`tab ${route.page === page ? "active" : ""}`}
              onClick={() => go({ page, filters: route.filters })}
            >
              {label}
              {page === "routines" && api.routines.length > 0 && (
                <span className="tab-count">{api.routines.length}</span>
              )}
            </button>
          ))}
        </nav>
        <div className="seg" role="group" aria-label={t("theme")}>
          {(
            [
              ["auto", "◐", t("themeAuto")],
              ["light", "☀", t("themeLight")],
              ["dark", "☾", t("themeDark")],
            ] as [ThemeChoice, string, string][]
          ).map(([value, icon, label]) => (
            <button
              key={value}
              className={theme === value ? "active" : ""}
              onClick={() => setTheme(value)}
              aria-pressed={theme === value}
              aria-label={label}
              title={label}
            >
              {icon}
            </button>
          ))}
        </div>
        <div className="seg" role="group" aria-label="Language">
          {(["cs", "en"] as const).map((l) => (
            <button key={l} className={lang === l ? "active" : ""} onClick={() => setLang(l)} aria-pressed={lang === l}>
              {l.toUpperCase()}
            </button>
          ))}
        </div>
      </header>

      <main className="content">
        {route.page === "figures" && (
          <FigureBrowser
            filters={route.filters}
            setFilters={(filters) => go({ ...route, filters }, true)}
            onOpen={(fig) => go({ ...route, id: fig.id })}
          />
        )}
        {route.page === "routines" &&
          (routine ? (
            <RoutineEditor
              routine={routine}
              api={api}
              onBack={() => go({ page: "routines", filters: route.filters })}
              onOpenFigure={setOverlayFig}
            />
          ) : (
            <RoutineList api={api} onOpen={(id) => go({ page: "routines", id, filters: route.filters })} />
          ))}
        {route.page === "about" && <Help />}
        {route.page === "finder" && <FigureFinder onOpen={setOverlayFig} />}
      </main>

      {openFig && (
        <FigureDetail
          fig={openFig}
          onClose={closeDetail}
          onOpenFigure={(f) => go({ ...route, id: f.id })}
          routinesApi={api}
          cls={route.filters.cls}
        />
      )}
      {overlayFig && (
        <FigureDetail
          fig={overlayFig}
          onClose={() => setOverlayFig(null)}
          onOpenFigure={setOverlayFig}
          routinesApi={api}
          cls={routine?.cls ?? ""}
        />
      )}
    </div>
  );
}
