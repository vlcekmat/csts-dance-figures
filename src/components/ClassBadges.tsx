// Small E / D / C badges showing in which classes a figure may be danced.
import type { ClassId, Figure } from "../data";

export function ClassBadges({ fig, highlight }: { fig: Figure; highlight?: ClassId | "" }) {
  const all = fig.dance === "polka" ? ["E", "D"] : ["E", "D", "C"];
  return (
    <span className="badges">
      {all.map((c) => {
        const on = fig.classes.includes(c);
        return (
          <span
            key={c}
            className={`badge ${on ? "on" : "off"} ${highlight === c ? "hl" : ""}`}
            aria-label={`${c}: ${on ? "✓" : "✗"}`}
          >
            {c}
          </span>
        );
      })}
    </span>
  );
}
