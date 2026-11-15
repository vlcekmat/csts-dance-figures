# Alignment, floor plan and player geometry

## tracePath (floor.ts) – one partner's body path in the figure's LOD frame
- Facing per step: explicit `face` (book), else parsed `align` (bare code → facing/backing chosen by
  expected turn), else latin turn amounts (`parseTurn`: fractions + "N turns"), with `span`
  spreading a turn evenly over N steps; "starts to turn X" over a span ≥ 3 without amount ⇒ 45°/step.
- `stepVector(desc, facing)`: main direction = first named (fwd/bwd/side), second bends 45° (20° if
  "slightly"), "diag" 20°, "small step" ×0.5, side ×0.9; close/brush/in place/weight/pivot ⇒ 0;
  crosses behind/in front ⇒ 0.2 sideways towards the crossing; unknown direction ⇒ 0.
- Length by count: & / a ×0.6, S ×1.1, Q ×0.9; user `stepScales`.
- Chasse: second side step with the same foot keeps the first one's line.
- `moving` (book "moving LOD") overrides the direction only for steps going roughly that way (<90°).
- PP forward steps travel 45° left of the body.
- Weight back onto the foot that stayed: "in place / recover / replace weight" after a step with the
  other foot ⇒ body returns to before the previous step; also a step with the other foot straight
  against the previous one (rock/check: cos < -0.7) ⇒ body returns.

## simulateRoutine (floor plan)
Continuity of facing between figures; first figure from `StartSpot.face` (else chart). Chart rotated
so its start matches where the previous figure ended (`offChart` flagged when beyond tolerance 22.5°,
PP start 50°). Automatic turn (`autoTurnOptions` from `turn_ranges`) absorbs a start offset or
connects to the next figure / loop target. Corners: near end wall (CORNER_ZONE 2.5 m) only if the
figure fits the next wall better; "corner by alignment"; manual `wall`. `startTurn`, choreo turns.
Each segment stores `placed` {item, x, y, rotate, init} for the routine animation.
Latin (chacha/rumba/jive) has no plan; `animSteps` still feed the animation.

## Player (playerGeometry.ts + FigurePlayer.tsx)
- `coupleGeometry`: footprints for man and lady (TraceOpts rotate/extraTurn/scales/initialFacing).
  Lady fixes: `fixLadyFacing` (her chart carries his alignment → flip all when majority in facing
  positions; single closed-position steps flipped); without man's alignments her alignments are
  dropped (relative placement only). Missing lady chart in routines ⇒ `mirrorSteps` (estimated, "*").
- Placement per step (positions that say where she stands: closed/opp/open/fan/side/shadow/tandem/
  diag/prom/fallaway/wing/outside/angle): offset by `ladyOffset` around the couple centre;
  promenade beside him by his feet direction (if within 60° of body); in opposing positions she is
  turned to face him. Still partner = axis (heel turns); both still ⇒ the couple rotates around its
  centre (small "teeth" accepted). Feet keep the placement `shift`, so the supporting foot moves
  with the dancer.
- `liveFeet`: only the stepping foot travels (lands on the placed footprint, so the couple placement goes into the step); the supporting foot stays and swivels. Exceptions: placement change since the previous step (`shift` delta) would turn the step > 80° off its chart direction ⇒ both feet carried; feet > 1.3 m apart ⇒ supporting foot drawn up; weight transfer keeps both feet unless the body is > 0.5 m off them. `npm run audit:feet` counts sliding feet (last: 337 of 4596 steps, was 3644). Both feet per state, weight booleans + `load`, `transfer` (desc in place/recover… or
  foot didn't move), crossed feet (`cross` behind/front placed on the other side), feet ≤ 0.95 m
  apart, feet kept under the body (>0.5 m off ⇒ shifted). `feetBetween` animates the stepping foot
  past the supporting one; weight flows (gradually for transfers).
- UI semantics: filled foot = weight share; dashed outline + number = next step; dotted line = foot
  travel; "⇄ váha" arrow = weight transfer; "✕ za/před" = crossed foot; "tělo ↺/↻" arc = body vs
  feet; line between partners = closed hold; follow camera (170 px/m, 520×340 view) by default.
- Smooth playback via rAF (`frac`), single smooth step (`until` ref), speeds 0.1/0.15/0.25/0.5/1×.
- Routine animation: `routineTrack(plan.segments.slice(0, baseLen), nums)` – same placement as the
  plan; groups per figure; alignment text relative to the wall (`side`).

## Audits (keep them green-ish, compare before/after)
- `npm run audit` (audit_figures.ts): partner distance, lady placement vs position, facing each
  other, turns without charted turn, travel in on-spot figures. Last: 14 findings.
- `npm run audit:steps`: dir (foot lands vs the supporting foot by desc), foot alternation, weight,
  count vs timing, start foot vs syllabus. `--solo` = man alone (chart vs placement problems).
  Last: dir 160 / spread 97 / foot 53 / count 13 / start 4 (dir and spread grew when the supporting foot stopped sliding: placement corrections now show in the step).
- `npm run audit:teeth`: back-and-forth teeth vs the raw chart (MINLEG env). Last ~133 (67 ≥ 0.25 m).
- `scripts/check_alignment.py`: standard start/end alignment vs summed turns (27 suspicious, book quirks).
Remaining findings are mostly book/OCR gaps (missing rows) or real sharp moves (spins, twists, rolls).
