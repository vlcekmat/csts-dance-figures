// Visual hold chooser: each hold is a tile with a small top-down drawing of the
// couple (M = man, Ž/L = lady) and lines for the joined hands. Holds named in
// the syllabus for this figure are marked; others can still be chosen but are
// flagged as "not in the syllabus notes".
import { HOLDS, getHold, type HoldInfo, type HoldKey } from "../glossary";
import { useI18n } from "../i18n";

// --- Hold drawings ---------------------------------------------------------------
// Top-down view in SVG coordinates (y grows downwards). A dancer is drawn as a
// shoulder ellipse with a head and a small "nose" showing where they face.
// Angles: 0 = facing right, 90 = facing down. A dancer's left shoulder is at
// facing - 90°, the right shoulder at facing + 90°.

interface Dancer {
  x: number;
  y: number;
  /** Facing direction in degrees. */
  face: number;
}

interface Scene {
  man: Dancer;
  lady: Dancer;
  /** Joined hands: [man's hand, lady's hand, optional bend of the meeting point]. */
  hands: ["L" | "R", "L" | "R", number?][];
  /** Man's right hand on the lady's back (closed holds). */
  backHand?: boolean;
}

const SHOULDER = 8; // half shoulder width

const SCENES: Record<HoldKey, Scene> = {
  // Close together, lady slightly to the man's right; joined L–R hands raised to the side.
  normal: { man: { x: 28, y: 22, face: 0 }, lady: { x: 46, y: 29, face: 180 }, hands: [["L", "R", -9]], backHand: true },
  // Opened into a V: both turned towards the man's left / lady's right, travelling up.
  promenade: { man: { x: 26, y: 30, face: -45 }, lady: { x: 50, y: 30, face: -135 }, hands: [["L", "R", -12]], backHand: true },
  // Open: facing each other at arm's length.
  "lh-rh": { man: { x: 16, y: 24, face: 0 }, lady: { x: 64, y: 24, face: 180 }, hands: [["L", "R", -3]] },
  "rh-lh": { man: { x: 16, y: 24, face: 0 }, lady: { x: 64, y: 24, face: 180 }, hands: [["R", "L", 3]] },
  "rh-rh": { man: { x: 16, y: 24, face: 0 }, lady: { x: 64, y: 24, face: 180 }, hands: [["R", "R", 0]] },
  "lh-lh": { man: { x: 16, y: 24, face: 0 }, lady: { x: 64, y: 24, face: 180 }, hands: [["L", "L", 0]] },
  double: { man: { x: 16, y: 24, face: 0 }, lady: { x: 64, y: 24, face: 180 }, hands: [["L", "R", -3], ["R", "L", 3]] },
  // Lady in front of the man, both facing the same way; same hands joined.
  shadow: { man: { x: 26, y: 24, face: 0 }, lady: { x: 46, y: 24, face: 0 }, hands: [["L", "L", -4], ["R", "R", 4]] },
  none: { man: { x: 16, y: 24, face: 0 }, lady: { x: 64, y: 24, face: 180 }, hands: [] },
};

const rad = (d: number) => (d * Math.PI) / 180;

function shoulder(d: Dancer, side: "L" | "R") {
  const a = rad(d.face + (side === "L" ? -90 : 90));
  return { x: d.x + Math.cos(a) * SHOULDER, y: d.y + Math.sin(a) * SHOULDER };
}

function DancerShape({ d, lady }: { d: Dancer; lady?: boolean }) {
  const nose = { x: d.x + Math.cos(rad(d.face)) * 7.5, y: d.y + Math.sin(rad(d.face)) * 7.5 };
  return (
    <g className={lady ? "hold-lady" : "hold-man"}>
      <ellipse cx={d.x} cy={d.y} rx={4.2} ry={SHOULDER + 1.5} transform={`rotate(${d.face} ${d.x} ${d.y})`} />
      <circle cx={d.x} cy={d.y} r={3.6} className="hold-head" />
      <path
        d={`M ${nose.x} ${nose.y} L ${d.x + Math.cos(rad(d.face - 28)) * 4.6} ${d.y + Math.sin(rad(d.face - 28)) * 4.6} L ${d.x + Math.cos(rad(d.face + 28)) * 4.6} ${d.y + Math.sin(rad(d.face + 28)) * 4.6} Z`}
        className="hold-nose"
      />
    </g>
  );
}

/** Top-down drawing of a hold: filled figure = man, outlined figure = lady. */
export function HoldIcon({ hold, size = 56 }: { hold: HoldInfo | undefined; size?: number }) {
  if (!hold) return <svg viewBox="0 0 80 48" width={size} height={(size * 48) / 80} aria-hidden className="hold-icon" />;
  const sc = SCENES[hold.key];
  // Crop the view to the drawing so compact holds (normal, promenade) are as
  // large as the open ones; keep the 80:48 aspect ratio.
  const xs = [sc.man.x, sc.lady.x];
  const ys = [sc.man.y, sc.lady.y];
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
  const cy = (Math.min(...ys) + Math.max(...ys)) / 2 - (sc.hands.some(([, , b]) => (b ?? 0) < -6) ? 4 : 0);
  const w = Math.max(Math.max(...xs) - Math.min(...xs) + 28, (Math.max(...ys) - Math.min(...ys) + 30) / 0.6, 46);
  const h = w * 0.6;
  const vb = `${cx - w / 2} ${cy - h / 2} ${w} ${h}`;
  return (
    <svg viewBox={vb} width={size} height={(size * 48) / 80} aria-hidden className="hold-icon">
      {hold.key === "none" && <line x1={34} y1={24} x2={46} y2={24} className="hold-gap" />}
      {sc.hands.map(([mh, lh, bend = 0], i) => {
        const a = shoulder(sc.man, mh);
        const b = shoulder(sc.lady, lh);
        // Joined hands meet between the two shoulders, pushed sideways by `bend`.
        const m = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 + bend };
        return (
          <g key={i}>
            <polyline points={`${a.x},${a.y} ${m.x},${m.y}`} className="hold-arm man" />
            <polyline points={`${b.x},${b.y} ${m.x},${m.y}`} className="hold-arm lady" />
            <circle cx={m.x} cy={m.y} r={2.4} className="hold-hands" />
          </g>
        );
      })}
      {sc.backHand && (() => {
        // Man's right hand around the lady's back (to her left shoulder blade).
        const a = shoulder(sc.man, "R");
        const b = shoulder(sc.lady, "L");
        const back = { x: b.x + Math.cos(rad(sc.lady.face + 180)) * 3, y: b.y + Math.sin(rad(sc.lady.face + 180)) * 3 };
        return <path d={`M ${a.x} ${a.y} Q ${(a.x + back.x) / 2} ${Math.max(a.y, back.y) + 5} ${back.x} ${back.y}`} className="hold-arm man back" />;
      })()}
      <DancerShape d={sc.man} />
      <DancerShape d={sc.lady} lady />
    </svg>
  );
}

interface Props {
  label: string;
  value: string | null;
  /** Hold given by the syllabus start/finish description. */
  base: string | null;
  /** Holds mentioned in the notes as alternatives. */
  allowed: string[];
  /** Notes say "any appropriate hold". */
  any: boolean;
  onChange: (k: HoldKey | undefined) => void;
}

export function HoldPicker({ label, value, base, allowed, any, onChange }: Props) {
  const { t, lang } = useI18n();
  const ok = (k: string) => any || k === base || allowed.includes(k);
  const current = getHold(value);
  return (
    <fieldset className="hold-picker">
      <legend>{label}</legend>
      <div className="hold-grid">
        {HOLDS.map((h) => {
          const selected = value === h.key;
          return (
            <button
              key={h.key}
              type="button"
              className={`hold-tile ${selected ? "selected" : ""} ${ok(h.key) ? "allowed" : "other"}`}
              aria-pressed={selected}
              onClick={() => onChange(h.key === base ? undefined : h.key)}
              title={lang === "cs" ? h.descCs : h.descEn}
            >
              <HoldIcon hold={h} size={88} />
              <span className="hold-name">{h[lang]}</span>
              <span className="hold-wdsf">{h.wdsf}</span>
              {h.key === base && <span className="hold-badge">{t("primaryTiming")}</span>}
              {h.key !== base && allowed.includes(h.key) && <span className="hold-badge alt">{t("fromNotes")}</span>}
            </button>
          );
        })}
      </div>
      {current && (
        <p className="small">
          <strong>{current[lang]}:</strong> {lang === "cs" ? current.descCs : current.descEn}
          {!ok(current.key) && <span className="warn-text"> {t("holdNotInNotes")}</span>}
        </p>
      )}
      {any && <p className="small muted">{t("holdAny")}</p>}
      <p className="small muted">{t("holdLegend")}</p>
    </fieldset>
  );
}
