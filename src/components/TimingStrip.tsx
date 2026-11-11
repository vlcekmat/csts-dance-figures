// Visual rhythm strip: one block per step, width proportional to its duration,
// with bar lines. Used for a single figure and for whole routines.
import type { Dance } from "../data";
import type { Step } from "../timing";
import { useI18n } from "../i18n";

export interface StripSegment {
  key: string;
  label?: string;
  steps: Step[];
  illegal?: boolean;
  /** Position and/or hold changes right before this segment. */
  change?: { pos: boolean; hold: boolean };
}

interface Props {
  dance: Dance;
  segments: StripSegment[];
  /** Pixels per beat; the strip scrolls horizontally when wider than its box. */
  beatWidth?: number;
  showBarNumbers?: boolean;
  /** The routine repeats: mark that the end goes back to figure `loopTo`. */
  loop?: boolean;
  /** Index of the figure the routine continues with (0 = first). */
  loopTo?: number;
}

export function TimingStrip({ dance, segments, beatWidth: baseWidth = 34, showBarNumbers = true, loop = false, loopTo = 0 }: Props) {
  const { t } = useI18n();
  const bpb = dance.beatsPerBar;
  let cursor = 0; // beats elapsed so far
  const totalBeats = segments.reduce((s, seg) => s + seg.steps.reduce((a, x) => a + x.beats, 0), 0);
  const bars = Math.ceil(totalBeats / bpb - 1e-9);
  const fullBars = Math.floor(totalBeats / bpb + 1e-9);
  const endsMidBar = totalBeats - fullBars * bpb > 1e-6;
  // Scale so the shortest step is still readable (tango / samba quicks are ½ beat,
  // "a" is ¼ beat), within a sensible maximum.
  const shortest = Math.min(
    ...segments.flatMap((sg) => sg.steps.map((x) => x.beats)).filter((b) => b > 0.01),
    1,
  );
  const beatWidth = Math.min(Math.max(baseWidth, 26 / shortest), baseWidth * 2.5);

  return (
    <div className="strip-scroll" role="img" aria-label={t("rhythmStrip")}>
      <div
        className={`strip ${dance.discipline}`}
        // --beat drives the beat grid drawn in CSS behind the steps.
        style={{
          width: Math.max(totalBeats * beatWidth, 40) + (loop ? 120 : 0),
          ["--beat" as string]: `${beatWidth}px`,
          // the beat grid stops at the end of the routine
          backgroundSize: loop ? `${totalBeats * beatWidth}px 100%` : undefined,
          backgroundRepeat: loop ? "no-repeat" : undefined,
        }}
      >
        {/* Bar lines and numbers are absolutely positioned on top of the blocks. */}
        {/* Bar lines only on real bar boundaries; numbers for every started bar. */}
        {Array.from({ length: fullBars + 1 }, (_, i) => (
          <div key={`bar${i}`} className="strip-bar" style={{ left: i * bpb * beatWidth }}>
            {showBarNumbers && i < bars && <span>{i + 1}</span>}
          </div>
        ))}
        {loop && loopTo > 0 && (
          <div
            className="strip-loop-start"
            style={{
              left:
                segments.slice(0, loopTo).reduce((sum, sg) => sum + sg.steps.reduce((a, x) => a + x.beats, 0), 0) *
                beatWidth,
            }}
            title={t("loopStartHere")}
          >
            ↺
          </div>
        )}
        {loop && (
          <div className="strip-loop" style={{ left: totalBeats * beatWidth }}>
            ↺ {t("loopBackTo", { n: String(loopTo + 1) })}
          </div>
        )}
        {endsMidBar && (
          // The figure ends inside a bar (e.g. Tango Tap "S&" = ½ bar): thin dashed end mark.
          <div className="strip-end" style={{ left: totalBeats * beatWidth }} title={t("endsMidBar")} />
        )}
        {segments.map((seg, si) => {
          const segStart = cursor;
          const blocks = seg.steps.map((st, i) => {
            const left = cursor * beatWidth;
            cursor += st.beats;
            return (
              <div
                key={i}
                className={`strip-step ${st.held ? "held" : ""} ${st.beats === 0 ? "zero" : ""} ${
                  st.label === "S" ? "slow" : ""
                }`}
                style={{ left, width: Math.max(st.beats * beatWidth, 6) }}
                title={`${st.label}: ${+st.beats.toFixed(2)} ${t("beats")}`}
              >
                {st.beats * beatWidth >= 12 ? st.label : ""}
              </div>
            );
          });
          return (
            <div key={seg.key} className={`strip-seg seg${si % 2} ${seg.illegal ? "illegal" : ""}`}>
              {seg.label && (
                <div
                  className="strip-seg-label"
                  style={{ left: segStart * beatWidth, width: (cursor - segStart) * beatWidth }}
                  title={seg.label}
                >
                  {seg.label}
                </div>
              )}
              {seg.change && (seg.change.pos || seg.change.hold) && (
                <div
                  className="strip-change"
                  style={{ left: segStart * beatWidth }}
                  title={[seg.change.pos ? t("changePosition") : "", seg.change.hold ? t("changeHold") : ""]
                    .filter(Boolean)
                    .join(", ")}
                >
                  {seg.change.pos ? "⇄" : ""}
                  {seg.change.hold ? "✋" : ""}
                </div>
              )}
              {blocks}
            </div>
          );
        })}
      </div>
    </div>
  );
}
