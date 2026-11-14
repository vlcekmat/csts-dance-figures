---
name: csts-dance-figures
description: Working knowledge of the "Katalog figur ČSTS" app in this repo (React + Vite + TS static site with Python data pipeline) – figure catalog, routines, floor plan, figure/routine player, WDSF technique-book charts, audits and deploy. Use for ANY task in this repository (features, fixes, data rebuilds, alignment / step / animation questions, videos, deploying), before reading code.
---

# Katalog figur ČSTS – how this project works

Static bilingual (CS/EN) web app for searching ČSTS catalog figures (ballroom & latin),
building routines, checking class legality and timing, planning routines on the floor and
animating figures/routines step by step. Repo: github.com/vlcekmat/csts-dance-figures,
deployed to GitHub Pages (https://vlcekmat.github.io/csts-dance-figures/) on every push to `main`.

Read the reference file for the area you touch:
- `references/architecture.md` – source map: modules, key functions, data types, UI components
- `references/data-pipeline.md` – PDFs/scans → OCR → charts → `src/data/figures.json`, videos
- `references/geometry.md` – alignment model, floor plan simulation, figure/routine player, all the
  rules and deliberate simplifications (read before touching `floor.ts`, `playerGeometry.ts`, `plan.ts`)
- `references/history.md` – what the user asked for over time, decisions, known open issues

## Hard rules (the user set these – never break them)

1. **Copyright.** The WDSF technique books (`mainReferences/`, scans) are copyrighted.
   Public data (`src/data/figures.json`, committed) may contain only *facts* (foot, direction,
   alignment angles, turn amounts, positions as terms) – never book wording, notes or
   `alignText`/`bookNotes`, never `"source": "wdsf"`. Book data goes only to the gitignored
   `src/data/technique.local.json`. Before every commit run the leak check:
   `for k in alignText bookNotes '"source": "wdsf"'; do grep -c "$k" src/data/figures.json; done` → all `0`.
   Don't quote book text to the user either; "use the info, don't cite it".
   In the UI don't say charts were taken from the books.
2. **Never touch the user's browser data.** The user's routines live in localStorage of their own
   dev server (port 5199) and of the Pages site. Test only on an isolated server:
   `npx vite --port 5200 --strictPort` (origin http://localhost:5200 = separate storage; there is a
   test routine `testE`). Before writing localStorage via JS, assert `location.port === '5200'`.
   Kill it afterwards (`pkill -f "vite --port 5200"`). Don't stop the user's 5199 server.
3. **Language.** Code and comments in English; UI strings always CS + EN in `src/i18n.tsx`
   (keys must be unique; quotes inside strings: use „…“ / “…”, not ASCII `"`).
   Talk to the user in Czech. Don't use the coding-tutor skill here – build directly.
4. **Commits** end with the attribution line from the system reminder
   (`Co-Authored-By: Claude …`). Deploying = commit + `git push origin main`, then
   `gh run watch <id> --exit-status`. The accepted workflow is: finish a change → verify → deploy
   without asking, then report in Czech.

## Standard workflow for a change

1. Edit code (Python scripts in `scripts/`, app in `src/`).
2. Data changed? `python3 -I scripts/parse_technique.py` (if OCR/merge logic changed) then
   `python3 -I scripts/build_data.py` (or `npm run data` when the PDFs in `data/raw/` changed).
3. `npx tsc -b` (strict, unused vars are errors).
4. Audits (see geometry.md): `npm run audit`, `npm run audit:steps` (`-v`, `--kind=dir|foot|weight|count|start`,
   `--solo`), `npm run audit:teeth` (`MINLEG=0.25` env for big ones), `python3 -I scripts/check_alignment.py`.
   Compare counts before/after; don't regress.
5. Visual check in the isolated browser (Claude in Chrome tools; batch actions; close the tab).
   Figure detail: `#/figures/<id>` (player `.player`, timeline `.player-timeline button`);
   routine: `#/routines/<id>` (plan, `.routine-anim`, `.plan-fig-options`).
6. Leak check → `npm run build` → commit → push → watch the Pages run → short Czech report
   (what changed, what's left, honest about what wasn't verified).

Temporary files go to `$CLAUDE_JOB_DIR/tmp` when running as a background job. Debug scripts
importing `src/` modules: write a `.ts` in `scripts/`, bundle with
`npx rolldown x.ts --platform node --format esm -o data/build/x.mjs && node data/build/x.mjs`, delete after.

## Quick facts

- Figure ids: `<dance>-<catalog no>` (e.g. `waltz-3` Natural Turn, `jive-6`, `rumba-1`).
  Dances: waltz, tango, viennese, slowfox, quickstep, samba, chacha, rumba, paso, jive, polka.
- Progressive dances (floor plan) = all except chacha, rumba, jive. Polka has Czech names only.
- Angles: degrees, 0 = LOD (along the first long wall), + = to the left / towards centre;
  room plan: wall sides 0–3 anticlockwise; `side*90` rotates LOD frame → room frame.
- `FloorStep` facts: `desc` ("LF fwd and slightly to side"), `align` code, `face` (foot/step
  direction), `end` (after pivot), `body`, `moving`, `turn` text, `span` (turn shared by N steps),
  `timing`, `pos` (couple position).
- The app loads `technique.local.json` (book charts) when it exists, so the user's local app is
  richer than Pages. Audits run on whatever data exists locally.
