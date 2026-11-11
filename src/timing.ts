// Parsing of WDSF timing notation ("12&3", "SQQ", "2 3 4&1", "SaS", "QQ QaQ")
// into individual steps with durations measured in beats.
import type { Dance, Figure } from "./data";

export interface Step {
  /** Symbol as written in the timing, e.g. "S", "Q", "2", "&", "a". */
  label: string;
  /** Duration in beats. */
  beats: number;
  /** Held / optional beats written in parentheses, e.g. "1 (23)". */
  held?: boolean;
  /** Original text of this step incl. separators, so a slice can be printed back. */
  raw: string;
}

/** Print steps back as a timing string ("123 123" -> slice -> "123"). */
export function stepsToText(steps: Step[]): string {
  return steps.map((s) => s.raw).join("").replace(/\s+/g, " ").trim();
}

/**
 * Keep only the timing expression itself:
 *  - "123 (12&3 Lady)" -> "123"  (parenthesised remarks containing words are dropped)
 *  - "2&3 (or 4&1)"    -> "2&3"
 *  - "2 3 4.1 or 2&3 4.1" -> "2 3 4.1" (first alternative)
 */
export function cleanTiming(timing: string): string {
  // Parentheses containing any letter other than the timing symbols S, Q, a
  // are remarks ("Lady", "or ...") and are dropped; "(23)" / "(Q)" are kept.
  let t = timing.replace(/\([^)]*[b-zA-PRT-Z][^)]*\)/g, " ");
  t = t.split(/\bor\b/)[0];
  return t.replace(/\s+/g, " ").trim();
}

/** Split a timing string into steps with durations in beats. */
export function parseTiming(timing: string, dance: Dance): Step[] {
  const t = cleanTiming(timing);
  const steps: Step[] = [];
  let held = false;
  let joinNext = false; // "4.1" — the digit after "." extends the previous step
  let prefix = ""; // separators waiting for the next step's raw text

  const attach = (ch: string) => {
    const last = steps[steps.length - 1];
    if (last) last.raw += ch;
    else prefix += ch;
  };

  for (const ch of t) {
    if (ch === "(") {
      held = true;
      attach(ch);
      continue;
    }
    if (ch === ")") {
      held = false;
      attach(ch);
      continue;
    }
    if (ch === "." || ch === "-" || ch === "–") {
      joinNext = true;
      attach(ch);
      continue;
    }
    if (ch === " ") {
      prefix += " ";
      continue;
    }

    const prev = steps[steps.length - 1];
    let base: number | null = null;
    if (/[0-9]/.test(ch)) base = dance.units.digit;
    else if (ch === "S") base = dance.units.S;
    else if (ch === "Q") base = dance.units.Q;

    if (base !== null) {
      if ((joinNext || held) && prev) {
        // Continuation of the previous step (e.g. "4.1" or "1 (23)").
        prev.beats += base;
        prev.raw += prefix + ch;
        if (held) prev.held = true;
      } else {
        steps.push({ label: ch, beats: base, raw: prefix + ch });
      }
      prefix = "";
      joinNext = false;
      continue;
    }
    if (ch === "&" || ch === "a" || ch === "e") {
      // "&" takes half of the previous step, "a" a quarter (Samba "SaS", Jive "QaQ").
      const share = ch === "&" ? 0.5 : 0.25;
      if (prev && !held) {
        const stolen = prev.beats * share;
        prev.beats -= stolen;
        steps.push({ label: ch, beats: stolen, raw: prefix + ch });
      } else {
        steps.push({ label: ch, beats: 0, held, raw: prefix + ch });
      }
      prefix = "";
    }
  }
  return steps;
}

export function totalBeats(steps: Step[]): number {
  return steps.reduce((s, x) => s + x.beats, 0);
}

/** Tempo range [slowest, fastest] in bars per minute, e.g. "28–30" -> [28, 30]. */
export function tempoRange(dance: Dance): [number, number] | null {
  const nums = dance.tempo.split(/[–-]/).map(Number).filter((n) => !Number.isNaN(n) && n > 0);
  if (!nums.length) return null;
  return [Math.min(...nums), Math.max(...nums)];
}

/** Length of a competition round in seconds (WDSF / ČSTS: music 1:30–2:00). */
export const ROUND_RANGE: [number, number] = [90, 120];

/** Midpoint of a tempo range like "28–30" in bars per minute. */
export function tempoBpm(dance: Dance): number | null {
  const nums = dance.tempo.split(/[–-]/).map(Number).filter((n) => !Number.isNaN(n) && n > 0);
  if (!nums.length) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

/** Format a beat count as bars, e.g. 6 beats in 4/4 -> "1½". */
export function formatBars(beats: number, beatsPerBar: number): string {
  const bars = beats / beatsPerBar;
  const whole = Math.floor(bars + 1e-9);
  const frac = bars - whole;
  const fracs: [number, string][] = [
    [0.25, "¼"], [1 / 3, "⅓"], [0.5, "½"], [2 / 3, "⅔"], [0.75, "¾"],
  ];
  if (frac < 0.01) return String(whole);
  const hit = fracs.find(([v]) => Math.abs(v - frac) < 0.02);
  if (hit) return (whole ? String(whole) : "") + hit[1];
  return bars.toFixed(2);
}

export function formatSeconds(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.round(sec - m * 60);
  return m ? `${m}:${String(s).padStart(2, "0")}` : `${s} s`;
}

// --- Figure transitions --------------------------------------------------------

export type Foot = "RF" | "LF";

/** Foot the figure starts on (Man), or null when ambiguous ("RF or LF"). */
export function startFoot(fig: Figure): Foot | null {
  const s = fig.syllabus?.start ?? "";
  const feet = s.match(/\b(RF|LF)\b/g);
  if (!feet || /\bor\b/.test(s.split("(")[0])) return null;
  return feet[0] as Foot;
}

/** Foot carrying the weight at the end of the figure (Man), or null if unknown. */
export function finishWeightFoot(fig: Figure): Foot | null {
  const f = fig.syllabus?.finish ?? "";
  const explicit = f.match(/weight on (RF|LF)/i);
  if (explicit) return explicit[1].toUpperCase() as Foot;
  const first = f.match(/\b(RF|LF)\b/);
  if (!first || /\bor\b/.test(f.split("(")[0])) return null;
  const foot = first[1] as Foot;
  if (/w\/o weight|without weight/i.test(f)) return foot === "RF" ? "LF" : "RF";
  return foot;
}

/** Couple position written in parentheses, e.g. "(Closed Position)". */
export function positionOf(text: string | undefined): string | null {
  const m = text?.match(/\(([^)]*)\)\s*$/);
  // Latin descriptions add the hold after a semicolon: "(Close Opp.; Normal Hold)".
  return m ? m[1].split(";")[0].trim() || null : null;
}

export interface TransitionCheck {
  ok: boolean | null; // null = cannot tell
  prevFoot: Foot | null;
  nextFoot: Foot | null;
}

/** Foot continuity: after finishing with weight on LF the next figure should start RF. */
export function checkTransition(prev: Figure, next: Figure): TransitionCheck {
  const prevFoot = finishWeightFoot(prev);
  const nextFoot = startFoot(next);
  if (!prevFoot || !nextFoot) return { ok: null, prevFoot, nextFoot };
  return { ok: prevFoot !== nextFoot, prevFoot, nextFoot };
}

// --- Counting ------------------------------------------------------------------

export interface CountedStep extends Step {
  /** 1-based step number within the figure. */
  n: number;
  /** Count as a dancer says it, e.g. "1", "2&", "3a". */
  count: string;
  /** 1-based bar number (relative to the figure start). */
  bar: number;
}

/**
 * Place each step on the musical grid. Latin figures written in numbers start
 * on the beat they name ("2 3 4&1" starts on beat 2); everything else starts
 * on beat 1 of the bar.
 */
export function countSteps(steps: Step[], dance: Dance): CountedStep[] {
  const bpb = dance.beatsPerBar;
  const first = steps[0]?.label ?? "";
  let pos = /^[0-9]$/.test(first) && dance.units.digit === 1 ? (parseInt(first, 10) - 1) % bpb : 0;
  const startBar = Math.floor(pos / bpb);
  return steps.map((s, i) => {
    const bar = Math.floor(pos / bpb + 1e-9);
    const inBar = pos - bar * bpb;
    const beat = Math.floor(inBar + 1e-9);
    const frac = inBar - beat;
    const suffix = frac < 0.01 ? "" : Math.abs(frac - 0.5) < 0.01 ? "&" : Math.abs(frac - 0.75) < 0.01 ? "a" : Math.abs(frac - 0.25) < 0.01 ? "e" : "+";
    const out = { ...s, n: i + 1, count: `${beat + 1}${suffix}`, bar: bar - startBar + 1 };
    pos += s.beats;
    return out;
  });
}

/** Beats as a fraction string: 0.75 -> "¾", 1.5 -> "1½". */
export function formatBeats(beats: number): string {
  const whole = Math.floor(beats + 1e-9);
  const frac = beats - whole;
  const map: [number, string][] = [[0.25, "¼"], [0.5, "½"], [0.75, "¾"]];
  const f = map.find(([v]) => Math.abs(v - frac) < 0.02)?.[1] ?? (frac > 0.01 ? frac.toFixed(2).slice(1) : "");
  return (whole || !f ? String(whole) : "") + f;
}
