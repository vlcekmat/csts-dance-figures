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
- Chosen start / finish position of a routine figure (syllabus alternative or own) goes into the steps: `plan.ts withPositions` replaces the chart's first (last) position run, the start alternative's desc becomes step 1, and the lady's fwd/bwd flip when promenade ↔ facing (closed/OP). SimItem.startPos = chosen; plan arrows use `relativeFacing` (now in floor.ts).
- Czech position names: `localizePositions` builds latin names from parts (`PART_POS`: open/close, L/R, side/diag, opp/same/angle → "levé stranové postavení, kolmo vlevo"), "then"/"to" → "→"; own-position list uses WDSF latin terms.
- Couple offsets (`ladyOffset`): closed = in front slightly to his right; OUTSIDE PARTNER = further to his RIGHT (OP is always on the partner's right side; was wrongly left before 2026-11); PP beside him on his right; wing / CPP on his left. `op` only as a separate word (OCR "Open Op¢" ≠ OP). audit_figures checks OP angle and PP V-facing.
- `coupleGeometry`: footprints for man and lady (TraceOpts rotate/extraTurn/scales/initialFacing).
  Lady fixes: `fixLadyFacing` (her chart carries his alignment → flip all when majority in facing
  positions; single closed-position steps flipped); without man's alignments her alignments are
  dropped (relative placement only). Missing lady chart in routines ⇒ `mirrorSteps` (estimated, "*").
- Lady's facing set by the couple position BEFORE her steps are traced (`relativeFacing`: opp/closed 180, same/shadow 0, L Angle −90, R Angle +90, PP/fallaway +90 (man DW, lady DC), CPP −90): where her traced facing differs > 60° her chart faces are shifted (carried on) and she is retraced – so her "fwd" goes where she really goes.
- Placement per step: the partners' own chart positions (+ previous corrections) are moved so the lady is exactly at the position's offset; the needed change is split by weights 1/(own step length + 0.05)² (`share`), a weight transfer counts as length 0 (pinned). The target is the nearest spot of a tolerance region around the position offset (±15°, ±15 % distance, `nearestRel`). Outside a closed hold each step stays its own (`keepStep`: ≤ 45° off its own direction, ≥ 40 % of its length, a still partner moves ≤ 0.25 m) and may lag behind the position by ≤ 0.15 m (caught up on later steps); closed hold = exact. CBMP / outside partner / across steps put the foot on the body line. So whoever stands / transfers stays, the stepping partner absorbs it (no partner is carried). Apart positions: same split towards the position's distance.
- (older notes) Placement per step (positions that say where she stands: closed/opp/open/fan/side/shadow/tandem/
  diag/prom/fallaway/wing/outside/angle): offset by `ladyOffset` around the couple centre;
  promenade beside him by his feet direction (if within 60° of body); in opposing positions she is
  turned to face him. Still partner = axis (heel turns); both still ⇒ the couple rotates around its
  centre (small "teeth" accepted). Feet keep the placement `shift`, so the supporting foot moves
  with the dancer.
- `liveFeet`: only the stepping foot travels (lands on the placed footprint); the supporting foot stays and swivels; weight transfers never move the feet. Only exception: feet > 1.3 m apart ⇒ supporting foot drawn up. `npm run audit:feet` counts sliding feet (last: 5 of 4596 steps; 3644 before 2026-11). Both feet per state, weight booleans + `load`, `transfer` (desc in place/recover… or
  foot didn't move), crossed feet (`cross` behind/front placed on the other side).
  `feetBetween` animates the stepping foot
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
  Last: dir 119 / spread 68 / foot 53 / count 13 / start 4. audit: 17, teeth: 119, feet: 5 sliding.
- `npm run audit:teeth`: back-and-forth teeth vs the raw chart (MINLEG env). Last ~133 (67 ≥ 0.25 m).
- `scripts/check_alignment.py`: standard start/end alignment vs summed turns (27 suspicious, book quirks).
Remaining findings are mostly book/OCR gaps (missing rows) or real sharp moves (spins, twists, rolls).

## Turn direction, poses, positions (2026-11-18)
- `stepTurn` (playerGeometry) = one signed turn per step and partner (`Foot.turn`): chart amount when it fits,
  else the chart's direction for |turn| > 100°, else partner's / figure's direction for ~½ turns. Body (`bodyAt`),
  supporting-foot swivel (`liveFeet`), stepping foot (`feetBetween`) and the closed-hold arc (`couplePose`) all use it.
- `couplePose(geo, man, k, t)` replaces the player's own body interpolation (shared with the audit);
  `passBy`: partners changing sides without hold curve round each other (min 0.32 m).
- `liveFeet`: a landing foot > 90° from the body follows the body (pivot); weight transfers swivel too.
- `signedTurn`: "1/2 turn" is not "2 turns"; "1/2 or 3/8" takes the first; same fix in build_data `fact_turn`.
- Lady's position-forced facing: when it turns her against her charted amount, the next step's position is used
  (latin charts name the new position one step late).
- `src/positions.ts cleanPosition`: OCR position column cleaned at load (data.ts), last step without a position
  gets the syllabus finish. `stepTimingOf`: bracketed counts ("1 (23)") are steps when the chart has them.
- `npm run audit:couple` (dir / onlyone / twist / tangle / finish). After this pass: 21 / 19 / 0 / 22 / 6
  (before: 88 / 37 / 148 / 227 / 32 with the same audit).
- Czech: `localizeAlign` for the alignment column; startCs/finishCs go through `localizeStep`; holdName cs w/o English.
