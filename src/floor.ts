// Floor geometry from step charts (dancecentral.info, ISTD based).
// Coordinates: x = line of dance (LOD), y = towards the centre of the room,
// so the wall is at negative y. Angles in degrees, 0 = LOD, +90 = centre.
import { getDance, type Figure } from "./data";
import { parseTiming } from "./timing";

export interface FloorStep {
  /** Foot + direction text, e.g. "RF fwd", "LF to side and slightly back". */
  desc: string;
  /** Alignment code, e.g. "FDW", "BLOD", "PDC". */
  align: string;
  /** Amount of turn text, e.g. "1/4 between 1-2". */
  turn: string;
}

/** A preceding/following figure named by the chart, linked to the catalog when possible. */
export interface FigureLink {
  /** Name as written by dancecentral.info. */
  name: string;
  /** Remark such as "at corner", "after 1-3". */
  note?: string;
  /** Catalog figure id, if the figure is in the ČSTS catalog. */
  id?: string;
}

export interface FloorData {
  title: string;
  url: string;
  steps: FloorStep[];
  preceding: FigureLink[];
  following: FigureLink[];
}

/** Default length of a full forward/backward step in metres. */
export const STEP_METRES = 0.85;

/**
 * Typical step length (metres) of a competing couple per dance. Real values
 * depend on the couple and tempo; the floor plan lets the user adjust it.
 */
export const STEP_BY_DANCE: Record<string, number> = {
  waltz: 0.85, tango: 0.7, viennese: 0.9, slowfox: 0.95, quickstep: 0.85,
  samba: 0.6, paso: 0.65, polka: 0.7, chacha: 0.5, rumba: 0.5, jive: 0.4,
};

/** Rough travel per bar for figures without a chart (metres along LOD). */
export const TRAVEL_PER_BAR: Record<string, number> = {
  waltz: 1.7, tango: 1.3, viennese: 2.6, slowfox: 2.1, quickstep: 2.1,
  samba: 1.1, paso: 1.1, polka: 1.6,
};

/** Room presets (metres): ČSTS minimums 12×16 / 13×20, large European floor 16×26. */
export const ROOM_PRESETS = {
  small: { length: 16, width: 12 },
  medium: { length: 20, width: 13 },
  large: { length: 26, width: 16 },
} as const;

const BASE_ANGLE: Record<string, number> = { LOD: 0, DW: -45, W: -90, DC: 45, C: 90 };

/**
 * Parse an alignment like "BDW", "Facing DC", "PDW against LOD" into the
 * direction the man's body faces (degrees), or null if not recognised.
 */
export function alignmentAngle(code: string): number | null {
  return parseAlign(code)?.angle ?? null;
}

/**
 * Like alignmentAngle, but also tells whether the orientation prefix
 * (facing / backing / pointing) was given. Charts sometimes write only "DC";
 * the caller then decides between facing and backing from the turn.
 */
export function parseAlign(code: string): { angle: number; explicit: boolean; moving: number | null } | null {
  // "FDW, moving LOD": the body faces DW but travels along LOD (promenade).
  const [primary, ...rest] = code.split(/[,;(]/);
  const movePart = rest.find((r) => /moving|travel/i.test(r));
  const moving = movePart ? parseAlignCore(movePart.replace(/moving|travel(?:l)?ing/gi, "facing"))?.angle ?? null : null;
  const cleaned = primary
    .replace(/\b(almost|nearly|slightly)\b/gi, "")
    .replace(/\bof (?:the )?new LOD\b/gi, "")
    .replace(/\bagainst the LOD\b/gi, "against LOD")
    .replace(/\bPointing to\b/gi, "Pointing");
  const core = parseAlignCore(cleaned);
  return core ? { ...core, moving } : null;
}

function parseAlignCore(code: string): { angle: number; explicit: boolean } | null {
  let s = code
    .toUpperCase()
    .replace(/[^A-Z ]/g, "")
    .replace(/\bDIAG(ONAL(LY)?)?( TO)?\b/g, "D")
    .replace(/\bCENT(RE|ER)\b/g, "C")
    .replace(/\bWALL\b/g, "W")
    .replace(/^BACK\b/, "BACKING")
    .replace(/^FACE\b/, "FACING")
    .replace(/ /g, "");
  let flip = 0;
  let explicit = false;
  if (/^(BACKING|BKG)/.test(s)) {
    flip = 180;
    explicit = true;
    s = s.replace(/^(BACKING|BKG)/, "");
  } else if (/^(FACING|FCG|POINTING|PTG)/.test(s)) {
    explicit = true;
    s = s.replace(/^(FACING|FCG|POINTING|PTG)/, "");
  } else if (/^[FBP](?=LOD|DW|DC|W|C)/.test(s)) {
    explicit = true;
    if (s[0] === "B") flip = 180;
    s = s.slice(1);
  }
  const against = /AG(AINST)?LOD$/.test(s);
  s = s.replace(/AG(AINST)?LOD$/, "");
  if (!(s in BASE_ANGLE)) return null;
  let a = BASE_ANGLE[s];
  // "DW against LOD" mirrors the direction across the wall-centre axis.
  if (against) a = s === "LOD" ? 180 : a > 0 ? 180 - a : -180 - a;
  return { angle: norm180(a + flip), explicit };
}

/** Normalise an angle to (-180, 180]. */
export function norm180(a: number): number {
  let x = ((a + 180) % 360 + 360) % 360 - 180;
  if (x === -180) x = 180;
  return x;
}

/** Amount of turn written in a chart cell ("1/4 between 1-2", "3/8 to L") in degrees, signed if direction given. */
export function parseTurn(text: string): { deg: number; sign: -1 | 0 | 1 } {
  const m = text.match(/(\d)\s*\/\s*(\d)/);
  const deg = m ? (parseInt(m[1], 10) / parseInt(m[2], 10)) * 360 : 0;
  const sign = /\bto (?:the )?R\b|\bR\b(?! side)|\bright\b/i.test(text)
    ? -1
    : /\bto (?:the )?L\b|\bL\b(?! side)|\bleft\b/i.test(text)
      ? 1
      : 0;
  return { deg, sign };
}

const rad = (d: number) => (d * Math.PI) / 180;

/** Direction (degrees) and length of the step's travel relative to the facing. */
export function stepVector(desc: string, facing: number): { angle: number; len: number } {
  const d = desc.toLowerCase();
  // The stepping foot is the first one named ("RF closes to LF" moves the right foot).
  const fm = d.match(/\b(rf|lf)\b/);
  const foot = fm ? (fm[1] === "lf" ? "L" : "R") : null;
  if (/\bclose|\bin place|\bweight|\bpivot\b(?!.*(fwd|back))/.test(d) && !/\bside\b/.test(d)) return { angle: facing, len: 0 };
  if (/\bside\b/.test(d)) {
    const side = foot === "L" ? 90 : -90;
    const tweak = /fwd|forward/.test(d) ? (foot === "L" ? -30 : 30) : /back|bwd/.test(d) ? (foot === "L" ? 30 : -30) : 0;
    return { angle: facing + side + tweak, len: 0.9 };
  }
  if (/\bback\b|\bbwd\b|backward/.test(d)) return { angle: facing + 180, len: 1 };
  if (/\bfwd\b|forward|across/.test(d)) return { angle: facing, len: 1 };
  return { angle: facing, len: 0.4 };
}

export interface PathPoint {
  x: number;
  y: number;
  /** 1-based step number in the figure. */
  n: number;
  facing: number | null;
}

/**
 * Trace the man's path for a figure starting at (x0, y0). `rotation` turns the
 * whole figure (used after a corner, where the LOD turns 90° to the left).
 */
/**
 * @param rotation  turns the whole figure (degrees, + = to the left): used after
 *                  a corner and for the user's "alignment of the whole figure".
 * @param extraTurn changes the amount of turn (degrees, + = more to the left),
 *                  spread evenly over the steps (under-/overturning).
 */
export function tracePath(
  steps: FloorStep[],
  x0 = 0,
  y0 = 0,
  rotation = 0,
  turnHint: -1 | 0 | 1 = 0,
  extraTurn = 0,
): PathPoint[] {
  const pts: PathPoint[] = [{ x: x0, y: y0, n: 0, facing: null }];
  let x = x0;
  let y = y0;
  let facing: number | null = null;
  let sign: -1 | 0 | 1 = turnHint;
  steps.forEach((s, i) => {
    const turn = parseTurn(s.turn);
    if (turn.sign) sign = turn.sign;
    const al = parseAlign(s.align);
    const prev = facing;
    if (!al && turn.deg > 0) {
      // Latin charts give no alignment, only the amount of turn: rotate by it.
      facing = (facing ?? 0) + (sign || 0) * turn.deg;
    }
    if (al) {
      if (al.explicit || prev === null) {
        facing = al.angle;
      } else {
        // Bare code ("DC"): facing or backing? Pick the one closer to where the
        // turn should bring the man.
        const expected = prev + (sign || 0) * (turn.deg || 0);
        const a1 = al.angle;
        const a2 = norm180(al.angle + 180);
        facing = Math.abs(norm180(a1 - expected)) <= Math.abs(norm180(a2 - expected)) ? a1 : a2;
      }
    }
    const f = facing ?? 0;
    // Side steps happen while turning: use the orientation half-way through.
    const d = s.desc.toLowerCase();
    const mid = prev !== null && /\bside\b/.test(d) ? norm180(prev + norm180(f - prev) / 2) : f;
    let v = stepVector(s.desc, mid);
    if (al?.moving !== null && al?.moving !== undefined && v.len > 0) {
      // Chart gives the travel direction explicitly ("moving LOD").
      v = { angle: al.moving, len: v.len };
    } else if (/\b(?:in )?pp\b|promenade/.test(d) && /\bfwd\b|forward|across/.test(d)) {
      // Forward steps in promenade travel towards the man's open (left) side:
      // about 45° left of where his body faces.
      v = { angle: f + 45, len: v.len };
    }
    // Under-/overturn: the extra turn grows linearly from the first to the last step.
    const extra = steps.length > 1 ? (extraTurn * i) / (steps.length - 1) : extraTurn;
    x += Math.cos(rad(v.angle + rotation + extra)) * v.len;
    y += Math.sin(rad(v.angle + rotation + extra)) * v.len;
    pts.push({ x, y, n: i + 1, facing: al || facing !== null ? f + rotation + extra : null });
  });
  return pts;
}

/** Turn direction suggested by the figure name: natural = right (-1), reverse = left (+1). */
export function turnHintOf(name: string | null | undefined): -1 | 0 | 1 {
  const n = (name ?? "").toLowerCase();
  if (/natural|to r(ight)?\b/.test(n)) return -1;
  if (/reverse|to l(eft)?\b/.test(n)) return 1;
  return 0;
}

// --- How much a figure travels -------------------------------------------------------
// Used for figures without a step chart. 0 = danced on the spot, 1 = progressive.

const STATIONARY = new RegExp(
  [
    "stationary", "in place", "\\bspot\\b", "basic movement", "side basic", "outside basic", "whisk",
    "\\brocks?\\b", "bounce", "foot change", "maypole", "underarm", "botafogos?\\b(?!.*travel)",
    "same foot", "dropped volta", "circular volta", "corta jaca", "spiral turn", "rolling off",
    "\\bdrag\\b", "sur place", "attack", "\\bhuit\\b", "separation", "coup de pique", "twists",
    "flamenco", "spanish lines", "left foot variation", "\\bpivot\\b", "\\btap\\b", "in – out", "in - out",
    "podtáčka", "obkročák(?! - rychlý)",
  ].join("|"),
  "i",
);
const SMALL = new RegExp(
  ["side samba", "criss cross", "side walk", "chasses? to", "samba whisk", "hesitation", "corte", "\\brej\\b", "rejdovačka", "kolečko"].join("|"),
  "i",
);
const TRAVEL = new RegExp(
  [
    "travel", "progressive", "\\bwalks?\\b", "\\bruns?\\b", "cruzado", "\\blocks?\\b", "\\broll\\b",
    "plait", "argentine", "carioca", "promenade", "la passe", "grand circle", "sixteen", "fallaway",
    "chasse cape", "farol", "fregolina", "banderillas", "spins? from", "\\bturn\\b",
    "otáčka", "přeměny v promenádě", "kvapík", "dvojpolka", "náskok", "přešvih",
  ].join("|"),
  "i",
);

/** 0 = on the spot, 0.35 = small displacement, 1 = travels along LOD. */
export function travelFactor(fig: Figure): number {
  if (fig.customTravel !== undefined) return fig.customTravel;
  const name = `${fig.en ?? ""} ${fig.cs}`;
  // Explicit "travelling"/"progressive" wins over the stationary keywords
  // ("Travelling Botafogo" travels, "Promenade to Counter Promenade Botafogos" does not).
  if (/travel|progressive/i.test(name)) return 1;
  if (STATIONARY.test(name)) return 0;
  if (SMALL.test(name)) return 0.35;
  if (TRAVEL.test(name)) return 1;
  // Standard dances progress by default; other dances default to a small move.
  return ["waltz", "tango", "viennese", "slowfox", "quickstep", "polka"].includes(fig.dance) ? 1 : 0.35;
}

/**
 * Chart steps of the figure itself. dancecentral.info charts often end with
 * the first step of the *following* figure (e.g. "RF fwd in CBMP, OP"); the
 * syllabus timing tells how many steps the figure really has.
 */
export function chartSteps(fig: Figure): FloorStep[] {
  const steps = fig.floor?.steps ?? [];
  const timing = fig.syllabus?.timing;
  if (!timing) return steps;
  const n = parseTiming(timing, getDance(fig.dance)).length;
  return n > 0 && steps.length > n ? steps.slice(0, n) : steps;
}

/** Any step chart (latin charts have no alignments but still describe the steps). */
export function hasChart(fig: Figure): boolean {
  return !!fig.floor && fig.floor.steps.length > 0;
}

export function hasFloor(fig: Figure): boolean {
  return !!fig.floor && fig.floor.steps.some((s) => parseAlign(s.align) !== null);
}

// --- Whole routine in a room ------------------------------------------------------

export interface RoomSize {
  length: number;
  width: number;
}

export interface SimItem {
  key: string;
  label: string;
  dance: string;
  /** Chart steps actually danced (already sliced to the chosen part), or null. */
  steps: FloorStep[] | null;
  /** Duration in seconds at competition tempo. */
  seconds: number;
  bars: number;
  /** User marked a corner after this figure. */
  cornerAfter: boolean;
  /** Turn direction hint from the figure name. */
  turnHint?: -1 | 0 | 1;
  /** For figures without a chart: 0 on the spot … 1 progressive. */
  travel?: number;
  /** Length of a full step in metres (default STEP_METRES). */
  stepMetres?: number;
  /** User alignment changes (degrees, + = left). */
  rotate?: number;
  extraTurn?: number;
  /** Aim the start of the figure at a place in the room (overrides rotate). */
  aim?: Aim;
  /** From this figure on, the couple dances along this wall (0–3). */
  wall?: number;
}

/**
 * Places in the room the man can aim at when a figure starts. "Ahead" is the
 * wall the current line of dance runs into, "opposite" the wall across the floor.
 */
export type Aim =
  | "corner"
  | "aheadMid"
  | "oppositeMid"
  | "aheadPerp"
  | "oppositePerp"
  | "faceCentre"
  | "backCentre";
export const AIMS: Aim[] = ["corner", "aheadMid", "oppositeMid", "aheadPerp", "oppositePerp", "faceCentre", "backCentre"];

/** Aims that state the man's orientation themselves (no automatic "backing" for backward figures). */
export const EXPLICIT_AIMS: Aim[] = ["faceCentre", "backCentre"];

export interface SimPoint {
  x: number;
  y: number;
  /** Seconds from the start of the routine. */
  t: number;
  out: boolean;
}

export interface SimSegment {
  /** Rotation actually applied (degrees, + = left), incl. an aim. */
  rotate: number;
  /** The wall was set by the user at this figure. */
  manualWall: boolean;
  /** Danced on the spot (no chart, stationary figure). */
  onSpot: boolean;
  key: string;
  label: string;
  n: number;
  pts: SimPoint[];
  estimated: boolean;
  /** A corner was inserted automatically before this figure. */
  autoCorner: boolean;
  cornerAfter: boolean;
  side: number;
  t0: number;
  t1: number;
}

export interface SimResult {
  segments: SimSegment[];
  /** Figure numbers (1-based) that leave the room. */
  overflow: number[];
  totalSeconds: number;
}

const MARGIN = 1.5; // metres kept from the end wall before turning a corner

/**
 * Where the routine starts: on which wall (0 = first long side, then
 * anticlockwise: 1 short, 2 long, 3 short), how far along it in the direction
 * of LOD, and how far from the wall (metres).
 */
export interface StartSpot {
  side: number;
  along: number;
  dist: number;
}

export const DEFAULT_START: StartSpot = { side: 0, along: 2.5, dist: 1.5 };

/** Room coordinates of a start spot. */
export function startPoint(sp: StartSpot, room: RoomSize): { x: number; y: number } {
  switch (sp.side % 4) {
    case 0: return { x: sp.along, y: sp.dist };
    case 1: return { x: room.length - sp.dist, y: sp.along };
    case 2: return { x: room.length - sp.along, y: room.width - sp.dist };
    default: return { x: sp.dist, y: room.width - sp.along };
  }
}

/** Start spot on a given wall for a clicked room point (the wall stays as chosen). */
export function spotOnSide(x: number, y: number, side: number, room: RoomSize): StartSpot {
  const s4 = ((side % 4) + 4) % 4;
  const along = [x, y, room.length - x, room.width - y][s4];
  const dist = [y, room.length - x, room.width - y, x][s4];
  return { side: s4, along: Math.round(along * 10) / 10, dist: Math.max(0.3, Math.round(dist * 10) / 10) };
}

/** Inverse of startPoint: the nearest wall decides the side. */
export function spotFromPoint(x: number, y: number, room: RoomSize): StartSpot {
  const d = [y, room.length - x, room.width - y, x];
  const side = d.indexOf(Math.min(...d));
  const along = [x, y, room.length - x, room.width - y][side];
  return { side, along: Math.round(along * 10) / 10, dist: Math.max(0.3, Math.round(d[side] * 10) / 10) };
}

/** Local (along LOD, towards centre) path of one figure, in metres. */
function localPath(item: SimItem, rotate = item.rotate ?? 0): { x: number; y: number }[] {
  if (item.steps) {
    const m = item.stepMetres ?? STEP_METRES;
    return tracePath(item.steps, 0, 0, rotate, item.turnHint ?? 0, item.extraTurn ?? 0).map((p) => ({
      x: p.x * m,
      y: p.y * m,
    }));
  }
  // Scale the per-bar travel with the chosen step length as well.
  const scale = (item.stepMetres ?? STEP_BY_DANCE[item.dance] ?? STEP_METRES) / (STEP_BY_DANCE[item.dance] ?? STEP_METRES);
  const len = item.bars * (TRAVEL_PER_BAR[item.dance] ?? 1.2) * (item.travel ?? 1) * scale;
  return [
    { x: 0, y: 0 },
    { x: len, y: 0 },
  ];
}

/** Distance from (x, y) to the end wall of the current side, along the LOD. */
function remaining(side: number, x: number, y: number, room: RoomSize): number {
  switch (side % 4) {
    case 0: return room.length - x;
    case 1: return room.width - y;
    case 2: return x;
    default: return y;
  }
}

/** Room point the aim refers to, for a couple travelling along `side`. */
function aimPoint(aim: Aim, side: number, room: RoomSize): { x: number; y: number } | null {
  const L = room.length;
  const W = room.width;
  const s4 = ((side % 4) + 4) % 4;
  if (aim === "corner") return [{ x: L, y: 0 }, { x: L, y: W }, { x: 0, y: W }, { x: 0, y: 0 }][s4];
  if (aim === "aheadMid") return [{ x: L, y: W / 2 }, { x: L / 2, y: W }, { x: 0, y: W / 2 }, { x: L / 2, y: 0 }][s4];
  if (aim === "oppositeMid") return [{ x: L / 2, y: W }, { x: 0, y: W / 2 }, { x: L / 2, y: 0 }, { x: L, y: W / 2 }][s4];
  if (aim === "faceCentre" || aim === "backCentre") return { x: L / 2, y: W / 2 }; // centre of the room
  return null; // perpendicular aims don't depend on a point
}

/** First charted facing of a figure (local frame, without user rotation). */
function baseStartFacing(item: SimItem): number | null {
  if (!item.steps) return null;
  const f = tracePath(item.steps, 0, 0, 0, item.turnHint ?? 0, item.extraTurn ?? 0)
    .slice(1)
    .find((p) => p.facing !== null)?.facing;
  return f === undefined || f === null ? null : f;
}

/** Does the figure start with the man backing its direction (e.g. "LF back, BDC")? */
export function startsBacking(baseFacing: number | null): boolean {
  return baseFacing !== null && Math.abs(norm180(baseFacing)) > 90;
}

/**
 * Rotation that makes the figure start aimed at the chosen place. A figure that
 * starts backing aims its back at it ("zády do rohu").
 */
function aimRotation(item: SimItem, x: number, y: number, side: number, room: RoomSize): number {
  const base = baseStartFacing(item);
  if (base === null || !item.aim) return item.rotate ?? 0;
  let local: number;
  if (item.aim === "aheadPerp") local = 0;
  else if (item.aim === "oppositePerp") local = 90;
  else {
    const pt = aimPoint(item.aim, side, room)!;
    const room0 = (Math.atan2(pt.y - y, pt.x - x) * 180) / Math.PI;
    local = room0 - (((side % 4) + 4) % 4) * 90;
  }
  // Centre aims say explicitly where the man faces; the others follow the figure
  // (a figure that starts backing turns its back to the target).
  const desired =
    item.aim === "faceCentre"
      ? local
      : item.aim === "backCentre"
        ? local + 180
        : startsBacking(base)
          ? local + 180
          : local;
  return norm180(desired - base);
}

/**
 * Place the routine in a room: figures follow the line of dance around the
 * floor (anticlockwise). Corners are taken where the user marked them, or
 * automatically when the next figure would run into the end wall.
 */
export function simulateRoutine(items: SimItem[], room: RoomSize, start: StartSpot = DEFAULT_START): SimResult {
  const p0 = startPoint(start, room);
  let x = p0.x;
  let y = p0.y;
  let side = start.side;
  let t = 0;
  let turnedJustNow = false;
  const segments: SimSegment[] = [];
  const overflow: number[] = [];

  items.forEach((item, i) => {
    let autoCorner = false;
    let manualWall = false;
    if (item.wall !== undefined && (((item.wall - side) % 4) + 4) % 4 !== 0) {
      // The user says: from this figure on we are on wall `item.wall`.
      side += (((item.wall - side) % 4) + 4) % 4;
      manualWall = true;
    } else if (item.wall === undefined) {
      const probe = localPath(item);
      const advance = Math.max(0, ...probe.map((p) => p.x));
      if (!turnedJustNow && advance > 0.3 && remaining(side, x, y, room) - advance < MARGIN) {
        side += 1;
        autoCorner = true;
      }
    }
    const rotate = item.aim ? aimRotation(item, x, y, side, room) : (item.rotate ?? 0);
    const local = localPath(item, rotate);
    const a = (side * Math.PI) / 2;
    const cos = Math.cos(a);
    const sin = Math.sin(a);
    const steps = local.length - 1 || 1;
    const t0 = t;
    const pts: SimPoint[] = local.map((p, k) => {
      const px = x + p.x * cos - p.y * sin;
      const py = y + p.x * sin + p.y * cos;
      const out = px < -0.3 || py < -0.3 || px > room.length + 0.3 || py > room.width + 0.3;
      return { x: px, y: py, t: t0 + (item.seconds * k) / steps, out };
    });
    if (pts.some((p) => p.out)) overflow.push(i + 1);
    const end = pts[pts.length - 1];
    x = end.x;
    y = end.y;
    t = t0 + item.seconds;
    segments.push({
      rotate,
      manualWall,
      onSpot: !item.steps && (item.travel ?? 1) === 0,
      key: item.key,
      label: item.label,
      n: i + 1,
      pts,
      estimated: !item.steps,
      autoCorner,
      cornerAfter: item.cornerAfter,
      side,
      t0,
      t1: t,
    });
    turnedJustNow = autoCorner || manualWall;
    if (item.cornerAfter) {
      side += 1;
      turnedJustNow = true;
    }
  });
  return { segments, overflow, totalSeconds: t };
}

// --- Alignment of a figure (start / finish) -------------------------------------

/** Start and finish facing (degrees, 0 = LOD, + = towards centre) of the man, or null without a chart. */
export function figureAlignment(
  fig: Figure,
  opts: { from?: number; to?: number; rotate?: number; extraTurn?: number } = {},
): { start: number; end: number } | null {
  if (!hasFloor(fig)) return null;
  const all = chartSteps(fig);
  const steps = all.slice((opts.from ?? 1) - 1, opts.to ?? undefined);
  if (!steps.length) return null;
  const pts = tracePath(steps, 0, 0, opts.rotate ?? 0, turnHintOf(fig.en), opts.extraTurn ?? 0).slice(1);
  const faces = pts.map((p) => p.facing).filter((f): f is number => f !== null);
  if (!faces.length) return null;
  return { start: norm180(faces[0]), end: norm180(faces[faces.length - 1]) };
}

const ALIGN_NAMES: [number, string, string, string][] = [
  // angle, code, Czech, English
  [0, "LOD", "po LOD", "along LOD"],
  [45, "DC", "diagonálně ke středu", "diagonal to centre"],
  [90, "C", "ke středu", "to centre"],
  [135, "DC ag. LOD", "diagonálně ke středu proti LOD", "diagonal to centre against LOD"],
  [180, "ag. LOD", "proti LOD", "against LOD"],
  [-135, "DW ag. LOD", "diagonálně ke stěně proti LOD", "diagonal to wall against LOD"],
  [-90, "W", "ke stěně", "to wall"],
  [-45, "DW", "diagonálně ke stěně", "diagonal to wall"],
];

/**
 * Describe a facing angle like a chart does: "čelem DW (FDW)" / "zády k LOD (BLOD)".
 * Facing directions towards the wall side of LOD read better as "backing" the opposite one.
 */
export function alignLabel(angle: number, lang: "cs" | "en"): string {
  const a = norm180(Math.round(angle / 22.5) * 22.5);
  const near = (target: number) => Math.abs(norm180(a - target));
  const best = ALIGN_NAMES.reduce((b, n) => (near(n[0]) < near(b[0]) ? n : b));
  const off = norm180(a - best[0]);
  // Prefer "backing X" for directions against LOD (dancers say "zády k LOD", not "čelem proti LOD").
  const backing = Math.abs(best[0]) > 90;
  const named = backing ? ALIGN_NAMES.reduce((b, n) => (near(norm180(n[0] + 180)) < near(norm180(b[0] + 180)) ? n : b)) : best;
  const code = (backing ? "B" : "F") + named[1].replace(/ ag\. LOD/, " ag.LOD").replace(/ /g, "");
  const name = lang === "cs" ? (backing ? `zády ${named[2].replace(/^po /, "k ")}` : `čelem ${named[2].replace(/^po /, "po ")}`) : `${backing ? "backing" : "facing"} ${named[3]}`;
  const between = Math.abs(off) > 1 ? (lang === "cs" ? " (zhruba)" : " (approx.)") : "";
  return `${name} (${code})${between}`;
}

/** Turn amount in eighths as text: 45 -> "1/8", 90 -> "1/4". */
export function eighths(deg: number): string {
  const n = Math.round(Math.abs(deg) / 45);
  const map: Record<number, string> = { 1: "1/8", 2: "1/4", 3: "3/8", 4: "1/2", 5: "5/8", 6: "3/4", 7: "7/8", 8: "1" };
  return map[n] ?? `${n}/8`;
}
