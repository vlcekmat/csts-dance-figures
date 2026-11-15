# History, decisions and open items

## What the user cares about (in their words, summarised)
- Precise alignment ("směrování") and steps first; the user dances E-class ballroom and checks the
  app against a known-correct waltz E routine (diagonal to wall start, Natural Turn, Closed Change,
  Progressive Chasse, Outside Change to PP towards the corner at the end of the long wall, Natural
  Turn 1–3, Back Whisk turned to the left, Open Natural …, loop back to figure 2). Changes must keep
  that routine sensible in the plan (`testE` on port 5200 mirrors it).
- Visual clarity of the player over physical exactness: "simplify small nuances if needed",
  but partners must stand correctly relative to each other, weight transfers must look different
  from steps, rocks must rock, crossed feet and body-vs-feet turn must be shown.
- Wants controls directly in the plan panel (turn dial, start turn, step lengths, timing,
  start/finish position) instead of scrolling; drag & drop incl. from the figure picker.
- Wants everything deployed after each finished change; reports in Czech, concise, honest.

## Feature timeline (latest last)
Catalog search & detail → routines, timing, legality → floor plan (walls, corners, loop, rooms,
start spot/direction, choreo turns, automatic turns, start turn, step lengths) → WDSF book OCR
charts (man+lady), holds from books → figure player (man/lady/both, smooth, closed-hold arcs) →
"what can follow", connections (foot, direction, position) → preparatory steps (several, moving,
suggestion from the book's prec step) → clearer player (live feet, follow camera, timeline) →
arrow buttons to move the routine (no click-to-move) → routine animation → timing + start/finish
position (incl. own positions outside the syllabus, flagged in E–C) in the plan panel → teeth
smoothing → stricter videos → crossed feet, trailing foot, body-turn arc → lady placement by
position → smooth single step, slower speeds → weight transfer vs step → rocks → full audit
(merged table cells, foot alternation repair, prec as step 1, placement keeps feet together) → corners unified: one control between figures (`corner` on prev = yes, `noCorner` on next = no, legacy `wall` still honoured), wall headers in the list, corner badges in room corners linked to the path, warning when the LOD turns > 4 m before the end wall (`SimSegment.cornerBefore/cornerDist/cornerFrom`); plan settings folded in a details → figure alternatives: `fig.alternatives` (build_data `extract_alternatives` from syllabus note sentences, kinds guapacha/footChange/replace/swap/omit/repeat/position/timing/other; hand-checked `data/alternatives.json` = kind exact with step patches set/replace, own wording, `matches` supersedes auto ones; so far Fan rumba-12 + chacha-16). `src/alternatives.ts` `applyAlternatives(fig, ids)` patches chart/timing/finish (cached); routine `variant.alts`; UI: detail section + chart preview, `AltChoice` in row panel and plan panel.

## Deliberate simplifications
- Both partners closing with a turn: couple rotates around its centre (teeth < 0.2 m accepted).
- Lady faces the man in opposing positions; promenade placement by the man's feet.
- Spanned turns spread evenly; unquantified "starts to turn" over ≥3 steps = 1/8 per step.
- Foot alternation repair only when the next step confirms; ambiguous L-L-R left alone.

## Open items / ideas offered
- Offer (unanswered): download lady charts from dancecentral.info for figures without book lady steps.
- Audit leftovers: 13 charts with fewer steps than the timing (rows missing in scans), 4 start-foot
  mismatches (tango-41, samba-12, chacha-29, paso-21), lady direction issues in underarm turns,
  Samba Locks lady side, last-step snaps in long latin turning figures (Natural Top chacha-25).
- 63 figures have no video (strict check); polka videos unchecked.
