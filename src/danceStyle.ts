// Character of each dance for the player: how the body travels within a step's time
// (swing, staccato, late weight of latin hip action …) and the vertical action
// (rise & fall, samba bounce, jive pulse) drawn as the dancer growing / sinking.
import type { Dance } from "./data";

export interface DanceStyle {
  /** Progress of the body / stepping foot over the step's time (0–1 → 0–1). */
  ease: (t: number) => number;
  /** Height of the dancer (−1 lowered … 1 risen) at a moment of the bar:
   *  `beat` = beats since the bar's first beat, `stepT` = progress of the current step. */
  height: (beat: number, beatsPerBar: number, stepT: number, stepBeats: number) => number;
  /** Short Czech / English description shown in the player. */
  cs: string;
  en: string;
}

const clamp = (x: number) => Math.max(0, Math.min(1, x));
const smooth = (t: number) => t * t * (3 - 2 * t);
const easeOut = (t: number) => 1 - (1 - t) ** 3;

/** Rise & fall over a bar: lowered at the start of the bar, up from the end of beat 1,
 *  lowering at the end of the bar (waltz 1-2-3, foxtrot / quickstep S-Q-Q). */
const riseFall = (beat: number, bpb: number) => {
  const p = (((beat % bpb) + bpb) % bpb) / bpb; // 0–1 through the bar
  if (p < 0.2) return -1 + 2 * smooth(p / 0.2) * 0.5; // down → start rising
  if (p < 0.45) return smooth((p - 0.2) / 0.25); // rising
  if (p < 0.85) return 1; // up
  return 1 - 2 * smooth((p - 0.85) / 0.15); // lowering at the end of the bar
};

/** Samba bounce: knees flex between the beats and straighten on the beat. */
const bounce = (beat: number) => {
  const f = ((beat % 1) + 1) % 1;
  return Math.cos(f * 2 * Math.PI) * 0.8;
};

const STYLES: Record<string, DanceStyle> = {
  standardSwing: {
    ease: smooth,
    height: (beat, bpb) => riseFall(beat, bpb),
    cs: "švih, zdvih a pokles",
    en: "swing, rise and fall",
  },
  viennese: {
    ease: smooth,
    height: (beat, bpb) => 0.5 * riseFall(beat, bpb),
    cs: "plynulá rotace, mírný zdvih",
    en: "continuous rotation, slight rise",
  },
  tango: {
    // staccato: the step is taken quickly, then the couple holds
    ease: (t) => easeOut(clamp(t / 0.45)),
    height: () => -0.4,
    cs: "staccato, bez zdvihu, nízko",
    en: "staccato, no rise, low",
  },
  paso: {
    ease: (t) => easeOut(clamp(t / 0.55)),
    height: (_b, _bpb, stepT) => 0.3 - 0.3 * Math.sin(stepT * Math.PI),
    cs: "pochod, ostré kroky",
    en: "march, sharp steps",
  },
  samba: {
    ease: (t) => t,
    height: (beat) => bounce(beat),
    cs: "pružení (bounce) na každou dobu",
    en: "bounce on every beat",
  },
  rumba: {
    // the leg reaches first, the weight (body) arrives late – hip action
    ease: (t) => smooth(clamp((t - 0.25) / 0.75)),
    height: (_b, _bpb, stepT) => -0.25 * Math.sin(stepT * Math.PI),
    cs: "pomalé, váha přichází pozdě (práce boků)",
    en: "slow, weight arrives late (hip action)",
  },
  chacha: {
    ease: (t) => smooth(clamp((t - 0.15) / 0.85)),
    height: (_b, _bpb, stepT) => -0.2 * Math.sin(stepT * Math.PI),
    cs: "úderné kroky, práce boků",
    en: "crisp steps, hip action",
  },
  jive: {
    ease: (t) => easeOut(clamp(t / 0.7)),
    height: (beat) => 0.6 * bounce(beat),
    cs: "pružné, odpérované kroky",
    en: "bouncy, springy steps",
  },
  polka: {
    ease: (t) => easeOut(clamp(t / 0.8)),
    height: (beat) => 0.5 * bounce(beat),
    cs: "poskočné kroky",
    en: "hopping steps",
  },
};

export function danceStyle(dance: Dance | undefined): DanceStyle {
  const id = dance?.id ?? "";
  if (id === "tango") return STYLES.tango;
  if (id === "viennese") return STYLES.viennese;
  if (id in STYLES) return STYLES[id];
  return dance?.discipline === "latin" ? STYLES.chacha : STYLES.standardSwing;
}

/** Beat of the bar the figure starts on (0 = first beat): cha-cha "2 3 4&1" starts on 2. */
export function startBeat(labels: string[], digitBeats: number): number {
  const first = labels[0] ?? "";
  const d = /^\d$/.test(first) ? +first : 1;
  return (d - 1) * digitBeats;
}

/** Duration of a step in beats as a fraction: 0.75 → "¾", 1.5 → "1½". */
export function beatsLabel(b: number): string {
  const whole = Math.floor(b + 1e-6);
  const f = b - whole;
  const fr: [number, string][] = [[0.25, "¼"], [0.5, "½"], [0.75, "¾"], [1 / 3, "⅓"], [2 / 3, "⅔"]];
  const hit = fr.find(([v]) => Math.abs(v - f) < 0.02);
  if (f < 0.02) return String(whole);
  return (whole ? String(whole) : "") + (hit ? hit[1] : f.toFixed(2));
}
