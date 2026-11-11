// Detail panel of one figure: names, legality, syllabus description, timing and videos.
import { Fragment, useEffect, useState } from "react";
import { figureNames, getDance, getFigure, type ClassId, type Figure } from "../data";
import { chartSteps, type FigureLink } from "../floor";
import { useI18n } from "../i18n";
import { formatBars, parseTiming, totalBeats } from "../timing";
import type { RoutinesApi } from "../routines";
import { describeFigure } from "../describe";
import { allowedHolds, getHold, localizePositions, localizeStep, localizeTurn } from "../glossary";
import { ClassBadges } from "./ClassBadges";
import { useCustom } from "./CustomFigureHost";
import { Glossed } from "./Glossary";
import { HoldIcon } from "./HoldPicker";
import { TimingBreakdown, TimingExplain } from "./TimingBreakdown";
import { TimingStrip } from "./TimingStrip";
import { FigureFloor } from "./FloorPlan";

interface Props {
  fig: Figure;
  onClose: () => void;
  /** Open another figure (links in preceding/following lists). */
  onOpenFigure: (fig: Figure) => void;
  routinesApi: RoutinesApi;
  cls: ClassId | "";
}

/** YouTube video id from a watch / share / shorts URL, or null. */
function youtubeId(url: string): string | null {
  const m = url.match(/(?:youtu\.be\/|[?&]v=|\/shorts\/|\/embed\/)([\w-]{11})/);
  return m ? m[1] : null;
}

export function FigureDetail({ fig, onClose, onOpenFigure, routinesApi, cls }: Props) {
  const custom = useCustom();
  const { t, lang, barsWord } = useI18n();
  const dance = getDance(fig.dance);
  const syl = fig.syllabus;
  const [videoIdx, setVideoIdx] = useState(0);
  const [added, setAdded] = useState<string | null>(null);

  useEffect(() => {
    setVideoIdx(0);
    setAdded(null);
  }, [fig.id]);

  // Close on Escape.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const main = lang === "cs" || !fig.en ? fig.cs : fig.en;
  const sub = fig.en ? (lang === "cs" ? fig.en : fig.cs) : null;
  const steps = syl?.timing ? parseTiming(syl.timing, dance) : [];
  const beats = totalBeats(steps);
  const video = fig.videos?.[videoIdx];
  const ytQuery = encodeURIComponent(fig.videos?.[0]?.query ?? `${dance.en} ${fig.en ?? fig.cs}`);
  const sameDanceRoutines = routinesApi.routines.filter((r) => r.dance === fig.dance);
  const allowed = allowedHolds(syl?.holds);
  // Note sentences that talk about holds, shown as the source of the alternatives.
  const holdNotes = (syl?.notes ?? [])
    .flatMap((n) => n.text.split(/(?<=\.)\s+/))
    .filter((x) => /\bhold\b|\b[LR]H to [LR]H\b/i.test(x));

  const addTo = (routineId: string, name: string) => {
    routinesApi.addFigure(routineId, fig.id);
    setAdded(name);
  };

  const addToNew = () => {
    const r = routinesApi.create({
      name: `${dance[lang]} – ${t("newRoutine").toLowerCase()}`,
      dance: fig.dance,
      cls: cls || "C",
    });
    addTo(r.id, r.name);
  };

  return (
    <div className="overlay" onClick={onClose}>
      <aside
        className="drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="fig-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="drawer-head">
          <div className="head-id">
            <span className={`bib ${dance.discipline} ${fig.custom ? "custom" : ""}`} title={fig.custom ? t("customFigure") : t("catalogNo")}>
              {fig.custom ? "★" : fig.no}
            </span>
            <div>
              <div className="eyebrow">{dance[lang]}</div>
              <h2 id="fig-title">{main}</h2>
              {sub && <div className="subname">{sub}</div>}
              {(fig.aliases?.cs?.length || fig.aliases?.en?.length) && (
                <div className="aliases small">
                  {t("alsoKnownAs")}:{" "}
                  {[...(fig.aliases?.[lang] ?? []), ...(fig.aliases?.[lang === "cs" ? "en" : "cs"] ?? [])].join(", ")}
                </div>
              )}
            </div>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label={t("close")}>
            ✕
          </button>
        </header>

        <section className="drawer-section description">
          <h3>{t("description")}</h3>
          {describeFigure(fig, lang).map((para, i) => (
            <p key={i}>
              <Glossed text={para} />
            </p>
          ))}
          {fig.customNote && <p className="custom-note">{fig.customNote}</p>}
          {syl && !fig.custom && <p className="small muted">{t("descriptionHint")}</p>}
        </section>

        {fig.custom ? (
          <section className="drawer-section">
            <p className="callout warn small">{t("customIllegal")}</p>
            <button className="btn" onClick={() => custom.edit(fig.id, { onDeleted: onClose })}>
              ✎ {t("edit")}
            </button>
          </section>
        ) : (
        <section className="drawer-section">
          <div className="row-between">
            <span className="muted">{t("legalIn")}</span>
            <ClassBadges fig={fig} highlight={cls} />
          </div>
          <p className="small muted">{t("freeChoreo")}</p>
          {(fig.noteCs || fig.noteEn) && (
            <p className="callout">{lang === "cs" ? fig.noteCs : fig.noteEn}</p>
          )}
        </section>
        )}

        {syl ? (
          <section className="drawer-section">
            <dl className="facts">
              <dt>{t("start")}</dt>
              <dd>
                <Glossed text={localizePositions(lang === "cs" ? syl.startCs : syl.start, lang)} />
              </dd>
              <dt>{t("finish")}</dt>
              <dd>
                <Glossed text={localizePositions(lang === "cs" ? syl.finishCs : syl.finish, lang)} />
              </dd>
              <dt>{t("timing")}</dt>
              <dd>
                <code className="timing">
                  <Glossed text={syl.timing} groups={["timing"]} />
                </code>
                {beats > 0 && (
                  <span className="muted small">
                    {" "}
                    = {formatBars(beats, dance.beatsPerBar)} {barsWord(beats, dance.beatsPerBar)} ({dance.meter})
                  </span>
                )}
              </dd>
              {syl.altTimings.length > 0 && (
                <>
                  <dt>{t("altTimings")}</dt>
                  <dd>
                    {syl.altTimings.map((a) => (
                      <code key={a} className="timing alt">
                        {a}
                      </code>
                    ))}
                  </dd>
                </>
              )}
            </dl>
            {lang === "cs" && <p className="small muted">{t("startFinishCsHint")}</p>}
            {steps.length > 0 && (
              <>
                <TimingStrip dance={dance} segments={[{ key: fig.id, steps }]} />
                <TimingExplain dance={dance} timing={syl.timing} />
                <details className="breakdown-details">
                  <summary>{t("timingDetail")}</summary>
                  <TimingBreakdown dance={dance} steps={steps} />
                </details>
              </>
            )}
            {syl.holds && (
              <>
                <h3>{t("holdsTitle")}</h3>
                {(syl.holds.start || syl.holds.finish) && (
                  <div className="hold-summary">
                    {(
                      [
                        [t("holdStart"), syl.holds.start],
                        [t("holdFinish"), syl.holds.finish],
                      ] as [string, string | undefined][]
                    )
                      .filter(([, key]) => key)
                      .map(([label, key]) => {
                        const h = getHold(key);
                        return (
                          <div key={label} className="hold-card">
                            <HoldIcon hold={h} size={64} />
                            <div>
                              <div className="small muted">{label}</div>
                              <strong>{h ? h[lang] : "?"}</strong> <span className="muted small">{h?.wdsf}</span>
                              <div className="small">{h ? (lang === "cs" ? h.descCs : h.descEn) : ""}</div>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                )}
                {allowed.multiple && (
                  <div className="allowed-holds">
                    <div className="small muted">
                      {allowed.any ? t("holdsAnyTitle") : t("holdsAllowedTitle", { n: String(allowed.keys.length) })}
                    </div>
                    <ul className="allowed-hold-list">
                      {allowed.keys.map((k) => {
                        const h = getHold(k)!;
                        const fromNotes = k !== syl.holds!.start && k !== syl.holds!.finish;
                        return (
                          <li key={k} className={fromNotes ? "from-notes" : ""}>
                            <HoldIcon hold={h} size={52} />
                            <span className="hold-name">{h[lang]}</span>
                            <span className="hold-wdsf">{h.wdsf}</span>
                            <span className={`hold-badge ${fromNotes ? "alt" : ""}`}>
                              {fromNotes ? t("fromNotes") : t("primaryTiming")}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                    {holdNotes.length > 0 && (
                      <ul className="notes small" lang="en">
                        {holdNotes.map((n, i) => (
                          <li key={i}>
                            <Glossed text={n} />
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </>
            )}
            {syl.variants && Object.keys(syl.variants).length > 0 && (
              <>
                <h3>{t("variantsTitle")}</h3>
                <dl className="facts">
                  {syl.variants.parts && (
                    <>
                      <dt>{t("allowedParts")}</dt>
                      <dd>
                        {syl.variants.parts
                          .map((p) => `${t("stepsWord")} ${p.from}–${p.to ?? t("toEnd")}`)
                          .join(", ")}
                      </dd>
                    </>
                  )}
                  {syl.variants.starts && (
                    <>
                      <dt>{t("altStarts")}</dt>
                      <dd>
                        <Glossed text={localizePositions(syl.variants.starts.map((v) => (lang === "cs" ? v.descCs : v.desc)).join("; "), lang)} />
                      </dd>
                    </>
                  )}
                  {syl.variants.finishes && (
                    <>
                      <dt>{t("altFinishes")}</dt>
                      <dd>
                        <Glossed text={localizePositions(syl.variants.finishes.map((v) => v.position).join("; "), lang)} />
                      </dd>
                    </>
                  )}
                </dl>
              </>
            )}
            {syl.seeAlso && (
              <p className="small muted">
                {t("seeAlso")}: {syl.seeAlso}
              </p>
            )}
            {syl.notes.length > 0 && (
              <>
                <h3>
                  {t("notes")} <span className="muted small">{t("notesOriginal")}</span>
                </h3>
                <ul className="notes" lang="en">
                  {syl.notes.map((n, i) => (
                    <li key={i}>
                      {n.topic && <strong>{n.topic}: </strong>}
                      <Glossed text={n.text} />
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>
        ) : (
          <section className="drawer-section">
            <p className="muted">{t("noSyllabus")}</p>
          </section>
        )}

        {fig.floor && fig.floor.steps.length > 0 && (
          <section className="drawer-section">
            <h3>{t("stepChart")}</h3>
            <FigureFloor fig={fig} />
            <div className="breakdown-scroll">
              <table className="breakdown chart">
                <thead>
                  <tr>
                    <th scope="col">{t("chartStep")}</th>
                    <th scope="col">{t("chartDesc")}</th>
                    {fig.floor.steps.some((x) => x.align) && <th scope="col">{t("chartAlign")}</th>}
                    <th scope="col">{t("chartTurn")}</th>
                  </tr>
                </thead>
                <tbody>
                  {fig.floor.steps.map((st, i) => (
                    <tr key={i} className={i >= chartSteps(fig).length ? "next-step" : ""} title={i >= chartSteps(fig).length ? t("chartNextStep") : undefined}>
                      <td>{i + 1}</td>
                      <td lang={lang}>
                        <Glossed text={localizeStep(st.desc, lang)} />
                      </td>
                      {fig.floor!.steps.some((x) => x.align) && (
                        <td>
                          <Glossed text={st.align} />
                        </td>
                      )}
                      <td lang={lang}>{st.turn && st.turn !== "--" ? localizeTurn(st.turn, lang) : ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {(fig.floor.preceding.length > 0 || fig.floor.following.length > 0) && (
              <dl className="facts small">
                {(
                  [
                    [t("precedes"), fig.floor.preceding],
                    [t("follows"), fig.floor.following],
                  ] as [string, FigureLink[]][]
                )
                  .filter(([, list]) => list.length > 0)
                  .map(([label, list]) => (
                    <Fragment key={label}>
                      <dt>{label}</dt>
                      <dd>
                        <ul className="fig-links">
                          {list.map((l, i) => {
                            const target = l.id ? getFigure(l.id) : undefined;
                            const note = l.note ? <span className="muted" lang="en"> ({l.note})</span> : null;
                            return (
                              <li key={i}>
                                {target ? (
                                  <button className="link-btn" onClick={() => onOpenFigure(target)}>
                                    {figureNames(target, lang).main}
                                  </button>
                                ) : (
                                  <span className="muted" lang="en" title={t("notInCatalog")}>
                                    {l.name} <span className="not-in-catalog">({t("notInCatalogShort")})</span>
                                  </span>
                                )}
                                {note}
                              </li>
                            );
                          })}
                        </ul>
                      </dd>
                    </Fragment>
                  ))}
              </dl>
            )}
            <p className="small muted">
              {t("chartSource")}{" "}
              <a href={fig.floor.url} target="_blank" rel="noreferrer">
                {fig.floor.title} ↗
              </a>
            </p>
          </section>
        )}

        <section className="drawer-section">
          <h3>{t("videos")}</h3>
          {fig.customVideo &&
            (youtubeId(fig.customVideo) ? (
              <div className="video">
                <iframe
                  src={`https://www.youtube-nocookie.com/embed/${youtubeId(fig.customVideo)}`}
                  title={main}
                  loading="lazy"
                  allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                  allowFullScreen
                />
              </div>
            ) : (
              <p>
                <a href={fig.customVideo} target="_blank" rel="noreferrer">
                  {fig.customVideo} ↗
                </a>
              </p>
            ))}
          {video ? (
            <>
              <div className="video">
                <iframe
                  src={`https://www.youtube-nocookie.com/embed/${video.id}`}
                  title={video.title}
                  loading="lazy"
                  allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                  allowFullScreen
                />
              </div>
              <ul className="video-list">
                {fig.videos!.map((v, i) => (
                  <li key={v.id}>
                    <button
                      className={`link-btn ${i === videoIdx ? "active" : ""}`}
                      onClick={() => setVideoIdx(i)}
                    >
                      {v.title}
                    </button>
                    <span className="muted small">
                      {" "}
                      {v.channel}
                      {v.length && `, ${v.length}`}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
          {!fig.custom && <p className="small muted">{t("videosHint")}</p>}
          <a
            className="small"
            href={`https://www.youtube.com/results?search_query=${ytQuery}`}
            target="_blank"
            rel="noreferrer"
          >
            {t("searchYoutube")} ↗
          </a>
        </section>

        {!fig.custom && (
        <section className="drawer-section">
          <h3>{t("literature")}</h3>
          <dl className="facts small">
            <dt>{t("catalogNo")}</dt>
            <dd>{fig.no}</dd>
            {syl && (
              <>
                <dt>{t("syllabusSection")}</dt>
                <dd>{syl.section}</dd>
              </>
            )}
            {fig.wdsfRef && (
              <>
                <dt>{t("wdsfRef")}</dt>
                <dd>{fig.wdsfRef}</dd>
              </>
            )}
            {fig.plamRef && (
              <>
                <dt>{t("plamRef")}</dt>
                <dd>{fig.plamRef}</dd>
              </>
            )}
            {fig.polkaRef && (
              <>
                <dt>{t("polkaRef")}</dt>
                <dd>{fig.polkaRef}</dd>
              </>
            )}
          </dl>
        </section>
        )}

        <footer className="drawer-foot">
          <div className="small muted">{t("addToRoutine")}:</div>
          <div className="chips">
            {sameDanceRoutines.map((r) => (
              <button key={r.id} className="chip" onClick={() => addTo(r.id, r.name)}>
                + {r.name}
              </button>
            ))}
            <button className="chip primary" onClick={addToNew}>
              + {t("newRoutine")}
            </button>
          </div>
          {added && (
            <div className="toast" role="status">
              ✓ {t("addedTo")} „{added}“
            </div>
          )}
        </footer>
      </aside>
    </div>
  );
}
