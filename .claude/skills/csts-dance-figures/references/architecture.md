# Architecture (source map)

## App (`src/`)

| File | Role |
|---|---|
| `main.tsx`, `App.tsx` | hash routes: `#/figures`, `#/figures/<id>`, `#/routines`, `#/routines/<id>`, `#/about` (+ finder) |
| `data.ts` | loads `data/figures.json` (+ `technique.local.json` via guarded `import.meta.glob`, replaces `floor`), `FIGURES`, `getFigure`, `getDance`, `isLegal(fig, cls)`, `figureNames`, custom figures |
| `i18n.tsx` | `STRINGS` (cs/en), `useI18n()` → `t(key, vars)` (vars must be strings), `barsWord` |
| `glossary.ts` | term glossary, `localizeStep`, `localizePositions`, `localizeTurn` (CS rendering of chart facts; careful with rule order – positions run before step rules) |
| `timing.ts` | `parseTiming` (S/Q/1/&/a …), `totalBeats`, tempo, `startFoot`, `positionOf` |
| `variants.ts` | `VariantChoice` (part, start/finish alt index, own `startPosition`/`finishPosition`, `extraTurn`, `choreo`, `startTurn`, `stepScales`, holds), `resolveItem` → `ResolvedItem` (feet, positions, `partAllowed`, `positionsAllowed`, `startDir`…), `connect` (foot/position/hold continuity) |
| `routines.ts` | `Routine` (items, room, stepCm, loop/loopTo, `prep: PrepStep[]` (legacy single object → `prepSteps()`), start spot with `face`), localStorage key `csts-routines-v1`, import/export |
| `floor.ts` | chart steps & geometry core: `FloorStep`/`FloorData` types, `parseAlign`, `parseTurn`, `stepVector`, `tracePath`, `chartSteps(fig)`, `simulateRoutine` (room placement), `figureAlignment`, `alignLabel`, `turnOptions`, `allowedExtra` |
| `plan.ts` | `buildPlan(opts)` → `Plan` (= SimResult + `nums`, `baseLen`): SimItems from routine rows, repetitions/loop, preparatory pseudo item `prep#0` (number 0 = "P"), animation fields (`animSteps`, `animLady`, `counts`, `startPos`, `latin`) |
| `playerGeometry.ts` | couple geometry for the player: `figureGeometry`, `coupleGeometry(cfg, man, lady, TraceOpts)`, `fixLadyFacing`, `mirrorSteps`, `ladyOffset`, `promenadeSide`, `closeHold`, `liveFeet`, `feetBetween`, `partnerRelation`, `signedTurn` |
| `routineTrack.ts` | whole routine → one player `Track` in room coords (`toRoom`, `walkAlong` for chartless figures, groups per figure, per-step `ladyEstimated`, `side`) |
| `describe.ts`, `finder.ts` | figure descriptions, "find a figure" by steps |

## Components (`src/components/`)

- `FigureBrowser`, `FigureDetail` (detail drawer: syllabus, holds, chart tables, videos, `FigurePlayer`), `FigureFinder`, `Help`, `Glossary`.
- `FigurePlayer.tsx`: `Track` type; `FigurePlayer({fig})` builds a track; `StepPlayer({track, dance, resetKey, room?})` = the player UI (role toggle, ⏮ ◀ ▶ play, speeds 0.1–1×, follow camera, all footprints, smooth; timeline chips; figure chips in routine mode; info table; weight arrows, cross tags, body-turn arc).
- `RoutineList`, `RoutineEditor` (stats, prep steps editor, loop, timing strip, routine animation section, `FloorPlan`, item list with drag & drop + picker), `RoutineItemRow` (timing, variant fieldset, alignment fieldset, chips, "what can follow"), `FigureChoices.tsx` (`TimingChoice`, `PositionChoice` shared by the row and the plan panel, `patchVariant`).
- `FloorPlan.tsx`: room plan SVG (start spot, arrows ← ↑ ↓ → move the routine by 0.5 m — clicking the plan no longer moves it), selected-figure panel (`figureOptions` slot: timing + start/finish position; `TurnDial`: turn slider, start turn, step lengths), legend ("P" for prep).
- `TimingStrip`, `TimingBreakdown`, `HoldPicker`, `ClassBadges`, `CustomFigureForm/Host`.
- Styles: single `src/styles.css` (tokens, dark/light; player classes `fp-*`, `player-*`).

## Scripts (`scripts/`)

parse_catalog.py, parse_syllabus.py, build_data.py (big: matching, `build_steps`, alignment parsing,
`prep_from_book`, `with_prec`, `fix_alternation`, holds, turn ranges), ocr_technique.py, ocr_merges.py,
parse_technique.py, check_alignment.py, scrape_alignment.py (dancecentral.info), scrape_videos.py,
check_videos.py, audit_figures.ts, audit_steps.ts, audit_teeth.ts. See data-pipeline.md.

## Data files

`data/dances.json`, `data/aliases.json`, `data/turn_ranges.json` (own wording, allowed under/overturn),
committed. Gitignored: `data/raw/`, `data/build/`, `data/videos.json`, `data/alignment.json`,
`data/technique_manual.json`, `mainReferences/`, `src/data/technique.local.json`.

## Owner's step editor (dev server only)

`#/edit[/<figId>]` (tab "Editor" + "✎ Upravit" in the figure drawer, both only when `import.meta.env.DEV`;
`FigureEditor` is lazy-loaded, absent from the build). `src/edits.ts`: `FigureEdit` = per role a list of
`StepRef {from?, set?, unset?}` (field patches against the underlying chart, new steps without `from`,
missing = deleted) + own figure `timing` + `note`. Stored in committed `src/data/edits.json`; `data.ts`
applies them to `FIGURES` (`baseFigure(id)` = before edits, `withEdit`). Saving/publishing goes through
`scripts/editorServer.js` (Vite plugin, `apply: "serve"`, localhost only): `POST /__edits/save`,
`POST /__edits/publish` (commits only edits.json on main and pushes; refuses book wording).
Hand edits win over rebuilt data – if a data rebuild changes a chart's step count the editor warns.
