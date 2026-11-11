// Step-by-step timing table: which count each step falls on and how long it
// lasts, plus a short explanation of what S / Q / & / a mean in this dance.
import type { Dance } from "../data";
import { useI18n } from "../i18n";
import { countSteps, formatBeats, type Step } from "../timing";

export function TimingExplain({ dance, timing }: { dance: Dance; timing: string }) {
  const { t, lang, beatsWord } = useI18n();
  const usesSQ = /[SQ]/.test(timing);
  const parts: string[] = [
    t("timingBar", { meter: dance.meter, n: String(dance.beatsPerBar) }),
  ];
  if (usesSQ) {
    parts.push(
      t("timingSQ", {
        s: `${formatBeats(dance.units.S)} ${beatsWord(dance.units.S)}`,
        q: `${formatBeats(dance.units.Q)} ${beatsWord(dance.units.Q)}`,
      }),
    );
  } else {
    parts.push(t("timingDigits"));
  }
  if (/&/.test(timing)) parts.push(t("timingAmp"));
  if (/a/.test(timing)) parts.push(t("timingA"));
  if (/\(/.test(timing)) parts.push(t("timingHeld"));
  if (/\./.test(timing)) parts.push(t("timingDot"));
  return <p className="small timing-explain" lang={lang}>{parts.join(" ")}</p>;
}

export function TimingBreakdown({ dance, steps }: { dance: Dance; steps: Step[] }) {
  const { t, beatsWord } = useI18n();
  const counted = countSteps(steps, dance);
  return (
    <div className="breakdown-scroll">
      <table className="breakdown">
        <thead>
          <tr>
            <th scope="col">{t("stepCol")}</th>
            <th scope="col">{t("symbolCol")}</th>
            <th scope="col">{t("countCol")}</th>
            <th scope="col">{t("lengthCol")}</th>
          </tr>
        </thead>
        <tbody>
          {counted.map((s, i) => (
            <tr key={i} className={i > 0 && counted[i - 1].bar !== s.bar ? "new-bar" : ""}>
              <td>{s.n}</td>
              <td>
                <code>{s.raw.trim()}</code>
              </td>
              <td>
                <span className="muted small">
                  {t("bar")} {s.bar},{" "}
                </span>
                <strong>{s.count}</strong>
              </td>
              <td>
                {formatBeats(s.beats)} {beatsWord(s.beats)}
                {s.held ? ` (${t("heldShort")})` : ""}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
