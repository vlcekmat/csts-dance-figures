# Data pipeline

```
data/raw/SC02_…Katalog figur.pdf ─pdftotext→ parse_catalog.py ─┐
data/raw/WDSF_Syllabus.pdf      ─pdftotext→ parse_syllabus.py ─┤
mainReferences/ (WDSF technique books: PDFs of scans; slowfox & paso as page images)
   pdfimages -png → data/build/ocr/<Book>/p-NNN.png
   ocr_technique.py <Books…>  (tesseract per table cell; per-page cache p-NNN.json; → <Book>.json)
   ocr_merges.py <Books…>     (adds `cont` matrix: vertically merged cells, no OCR, seconds)
   parse_technique.py         (→ data/build/technique.json: charts man/lady, steps, prec, span)
data/alignment.json (dancecentral.info, ISTD charts; fallback)  ─┤
data/videos.json (YouTube search)                                ─┤
                                                     build_data.py → src/data/figures.json (public facts)
                                                                   → src/data/technique.local.json (book, local)
```

Books (OCR dir names): Waltz, Tango, Valčík (=viennese), Slowfox, Quickstep, Chacha, Rumba, Samba,
Paso, Jive. PrincipySTT/LAT contain principles, no figure charts. Page image `p-NNN` ↔ page NNN+1.

## parse_technique.py essentials
- Tables per chart: role from "(Man)/(Lady)" titles (+ pairing heuristics), columns by header names
  (placement, alignment, quantity/turn, timing; side-2 tables: couple position, alignment, lead/hold).
- "Prec. Step" row → `chart["prec"]` (desc/align/turn/timing), not a step.
- Merged cells (`cont`): a turn written once over several rows → kept on the first step with
  `span` = number of steps; an alignment merged over a block that turns → dropped on the
  continuation steps (`align_cont` handling, also in the side-2 table refill).
- Manual overrides: `data/technique_manual.json` (whole charts). NAME_FIXES for titles; `PAGE_TITLES` {(book, page): (name, role)} for charts whose title OCR lost (e.g. Paso p.76 = Syncopated Separation lady).

## build_data.py essentials
- `data/technique_fixes.json` (git-ignored, read from the scans): per figure id `man`/`lady` ops `{set: n, field…}`, `{insert: n …}`, `{delete: n}`, `{steps: [...]}` (whole chart), applied by `apply_step_fixes` right after `match_book`. Done 2026-11: chacha-24/36/38/39/41, jive-2/33/34, paso-4/19/20/21/24/32/33, rumba-15/31/43, samba-52, slowfox-21. Remaining audit differences are syllabus-vs-book (count/start), not data.
- `fact_desc` (public step text): normalises OCR slips (ClOS@d, toside, w/o wt), keeps the first clause when a second one is about the free foot, `closed`→closes, `behind`→crosses behind, `rightwards`→small side step, `drawn` / pointed / tapped / kick / flick ⇒ w/o weight, `hold position` ⇒ `position held` (no weight). Audits run on the PUBLIC data (Vite-only glob for the local file).
- Matches catalog rows to syllabus and to book charts (`match_book`, canon names, MANUAL_MATCH).
- `with_prec`: when the syllabus start foot ≠ chart's first foot and the chart's prec step has it,
  the prec step becomes step 1 (tango Open Natural Turn, Tap…). Then no `prep` suggestion.
- `build_steps(chart, public)`: per step `desc` (facts via `fact_desc`), `align` code, `turn`
  (`fact_turn`: fractions, "N turns", pivot/between flags), `face/end/body/moving` from
  `parse_alignment`, `span`, `timing`, `pos` (terms only in public). New-LOD frame logic,
  `spread_constant_rotation`. Ends with `fix_alternation` (repairs OCR foot slips only when the
  next weight step confirms; skips foot-change/swivel/flick/chug/kick figures).
- `prep_from_book`: public `floor.prep` {foot, dir, face} from the prec row (drops foot when it
  equals step 1's foot = misread).
- Public vs local: public has `"source": "checked"` and no wording; local has `"source": "wdsf"`,
  `bookNotes`, `alignText`. Holds from book only when text says may/or/any/alternative.
- Videos merged from `data/videos.json`.
- Alternatives: `extract_alternatives` (syllabus notes → selectable options, skipping parts/start/finish/hold/turn/alt-timing ones that have own controls) + `data/alternatives.json` (hand-checked step patches, committed, own wording only).

## Videos
- `scrape_videos.py` (YouTube results page `ytInitialData`, no API key; resumable).
- `check_videos.py`: strict acceptance (dance named and not another dance; all key words of the
  figure name or an alias; opposite variant natural/reverse, to R/L, RF/LF, L/R side, from L to R;
  "twin" figures must name their direction; longer figure of the same dance; qualifier before the
  name like "Open"/"Double"/"Inverted"; no routines/competitions/>12 min; WDSF Academy titles
  accepted without the dance only for names unique to one dance). `--fix` drops bad ones and
  searches again (up to 3). Polka is skipped (Czech names). Empty is preferred to wrong.
- After videos change: `python3 -I scripts/build_data.py`.

## Rebuild commands
- After script changes: `python3 -I scripts/parse_technique.py && python3 -I scripts/build_data.py`
- New catalog/syllabus PDF: put into `data/raw/`, adjust `npm run data` path, `npm run data`.
- New scans: pdfimages → ocr_technique.py (long, run in background) → ocr_merges.py → parse → build.
