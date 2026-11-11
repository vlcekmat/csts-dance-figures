// Help page: how to read timing, glossary of abbreviations, holds, and sources.
import { SOURCES } from "../data";
import { HOLDS, TERMS, type Term } from "../glossary";
import { useI18n, type StringKey } from "../i18n";
import { HoldIcon } from "./HoldPicker";

const GROUPS: [Term["group"], StringKey][] = [
  ["feet", "groupFeet"],
  ["direction", "groupDirection"],
  ["position", "groupPosition"],
  ["timing", "groupTiming"],
  ["other", "groupOther"],
];

export function Help() {
  const { t, lang } = useI18n();
  return (
    <div className="help">
      <section className="card">
        <h2>{t("howTiming")}</h2>
        <p>{t("howTimingText")}</p>
        <table className="breakdown">
          <thead>
            <tr>
              <th scope="col">{t("symbolCol")}</th>
              <th scope="col">{t("description")}</th>
            </tr>
          </thead>
          <tbody>
            {TERMS.filter((x) => x.group === "timing").map((x) => (
              <tr key={x.id}>
                <td>
                  <code>{x.label}</code>
                </td>
                <td>{x[lang]}</td>
              </tr>
            ))}
            <tr>
              <td>
                <code>( )</code>
              </td>
              <td>{t("timingHeld")}</td>
            </tr>
            <tr>
              <td>
                <code>4.1</code>
              </td>
              <td>{t("timingDot")}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section className="card">
        <h2>{t("groupHold")}</h2>
        <p className="small muted">{t("holdLegend")}</p>
        <ul className="hold-list">
          {HOLDS.map((h) => (
            <li key={h.key}>
              <HoldIcon hold={h} size={96} />
              <div>
                <strong>{h[lang]}</strong> <span className="muted small">{h.wdsf}</span>
                <div className="small">{lang === "cs" ? h.descCs : h.descEn}</div>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="card">
        <h2>{t("glossary")}</h2>
        <p className="small muted">{t("glossaryHint")}</p>
        {GROUPS.map(([g, label]) => (
          <div key={g}>
            <h3>{t(label)}</h3>
            <dl className="glossary-list">
              {TERMS.filter((x) => x.group === g).map((x) => (
                <div key={x.id}>
                  <dt>{x.label}</dt>
                  <dd>{x[lang]}</dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </section>

      <section className="card about">
        <h2>{t("sources")}</h2>
        <p>{t("aboutText")}</p>
        <p className="callout">{t("aboutBinding")}</p>
        <ul>
          <li>
            {SOURCES.catalog} –{" "}
            <a href="https://www.csts.cz/cs/Files/GetFile/6816" target="_blank" rel="noreferrer">
              csts.cz
            </a>
          </li>
          <li>
            {SOURCES.syllabus} –{" "}
            <a href="https://www.worlddancesport.org/Rule/Competition/General/Syllabus" target="_blank" rel="noreferrer">
              worlddancesport.org
            </a>
          </li>
          <li>
            {t("stepChart")} –{" "}
            <a href="https://www.dancecentral.info" target="_blank" rel="noreferrer">
              dancecentral.info
            </a>
          </li>
          <li>YouTube</li>
        </ul>
      </section>
    </div>
  );
}
