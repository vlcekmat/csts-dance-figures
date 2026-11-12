"""Turn the OCR'd tables of the WDSF technique books into per-figure step charts.

Input:  data/build/ocr/<Book>.json   (scripts/ocr_technique.py)
Output: data/build/technique.json    {dance: [{name, role, page, steps, notes}]}

Side 1 of a chart gives foot placement, alignment, amount of turn and timing,
side 2 the couple position (and, in latin, the alignment and hold).
"""
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OCR_DIR = ROOT / "data" / "build" / "ocr"
OUT = ROOT / "data" / "build" / "technique.json"

BOOKS = {
    "Waltz": "waltz", "Tango": "tango", "Valčík": "viennese", "Quickstep": "quickstep",
    "Slowfox": "slowfox", "Paso": "paso", "Chacha": "chacha", "Rumba": "rumba", "Samba": "samba", "Jive": "jive",
}

TITLE_RE = re.compile(r"^(?P<name>.+?)\s*(?:[({\[]\s*(?P<role>Man|Lady|Men|Lad[yv])\s*[)}\]]?)?\s*[-–—~.]*\s*Side\s*(?P<side>[12l|I])", re.I)


def clean(s: str) -> str:
    s = s or ""
    s = s.replace("|", " ").replace("’", "'").replace("“", '"').replace("”", '"')
    s = re.sub(r"\s+", " ", s).strip()
    return s


def fix_ocr(s: str) -> str:
    """Typical OCR slips in these tables."""
    s = clean(s)
    s = re.sub(r"\bOW\b", "DW", s)
    s = re.sub(r"\bOC\b", "DC", s)
    s = re.sub(r"\bLo[opDd0]\b\W?", "LOD", s)
    s = re.sub(r"^Couple Position\s+", "", s)
    s = re.sub(r"to\s*([LR])\s*on\s*[il1]\b|to\s*([LR])on[il1]\b|to\s*([LR])on[il1]{1,2}\b", lambda m: f"to {m.group(1) or m.group(2) or m.group(3)} on 1", s)
    s = re.sub(r"\b(\d)S\b", r"\1", s)
    s = re.sub(r"\bfess\b|\btess\b", "less", s)
    s = re.sub(r"\bBodv\b", "Body", s)
    s = re.sub(r"\bAF\b", "RF", s)
    s = re.sub(r"(\d)\s*and\s*(\d)", r"\1 and \2", s)
    s = re.sub(r"\bland\s*(\d)", r"1 and \1", s)
    s = re.sub(r"\bSand\s*(\d)", r"5 and \1", s)
    s = re.sub(r"to\s*R\s*on\s*(\d)", r"to R on \1", s)
    s = re.sub(r"to\s*L\s*on\s*(\d)", r"to L on \1", s)
    s = re.sub(r"turnto", "turn to ", s)
    s = re.sub(r"\bRoni\b", "R on 1", s)
    s = re.sub(r"\bRon\s*(\d)", r"R on \1", s)
    s = re.sub(r"\bLon\s*(\d)", r"L on \1", s)
    s = re.sub(r"(\d)\s*/\s*(\d)", r"\1/\2", s)
    s = re.sub(r"\s+", " ", s).strip()
    return s


# OCR slips in chart titles.
NAME_FIXES = [
    (r"\bCLOSLD\b", "CLOSED"),
    (r"^TELEMARK$", "TELEMARK"),
    (r"^H?AGE ALTERNATIVE", "CHASE ALTERNATIVE"),
    (r"^CUUNST.*METHOD 4.*", "CHASE ALTERNATIVE ENDINGS - METHOD 4 PROGRESSIVE LINK"),
    (r"PROMENADE INK MAN", "PROMENADE LINK"),
    (r"CLOSE STEP TO PP AY", "CLOSE STEP TO PP"),
    (r"FLECRERL", "FLECKERL"),
    (r"TURNING TO R MAN$", "TURNING TO R"),
    (r"\bINFO\b", "INTO"),
    (r"\s+", " "),
]

CONT_RE = re.compile(r"(Recover|Weight on|Part weight|Wt on)\b", re.I)

POS_RE = re.compile(
    r"(Outside Partner|Counter Promenade|Promenade|Fallaway|Closed?|Wing|Open Counter Promenade|Open Facing|"
    r"Open|Fan|Shadow|Side by Side|Right Side|Left Side|Tandem|Contra|Double Hold|Hammerlock|Position|Opp(?:osing)?|"
    r"Facing|Apart|Relaxed|to|L to R|R to L|Hand|Hold|No Hold|CPP|PP)\b",
    re.I,
)


def clean_pos(text: str) -> str:
    """Couple position cells sometimes include OCR noise from the merged step column."""
    t = re.sub(r"Prec\.?\s*Step", " ", text, flags=re.I)
    words = [w for w in re.split(r"\s+", t) if w and not re.fullmatch(r"\d+|[a-z]{1,2}|[^A-Za-z]+", w)]
    t = " ".join(words)
    return t.strip()


def col(header, *keys):
    for i, h in enumerate(header):
        hl = (h or "").lower()
        if any(k in hl for k in keys):
            return i
    return None


def split_placement(text: str):
    """'RF fwd Recover LF' -> ('RF fwd', 'Recover LF')."""
    text = fix_ocr(text)
    # drop OCR junk before the first foot name
    m = re.search(r"\b(RF|LF|Both|Feet|Weight|Recover|Point|Pivot|Swivel|Rock|Tap|Close|Spin)\b", text, re.I)
    if m:
        text = text[m.start():]
    parts = re.split(r"\s+(?=(?:Recover|Weight on|Part weight|Part wt|Wt on|Weight)\b)", text, maxsplit=1)
    return parts[0].strip(), (parts[1].strip() if len(parts) > 1 else "")


def step_numbers(cell: str):
    nums = re.findall(r"\d+", cell or "")
    return [int(n) for n in nums]


def main():
    out = {}
    for book, dance in BOOKS.items():
        path = OCR_DIR / f"{book}.json"
        if not path.exists():
            continue
        tables = json.loads(path.read_text())
        figures = []
        cur = None  # figure the next "side 2" belongs to
        import difflib
        last_title = None
        for t in tables:
            if t["title"] == "NOTES":
                text = clean(t["text"])
                notes = re.findall(r"NOTE\s*[-–]\s*(.+?)(?=NOTE\s*[-–]|$)", text)
                if notes and figures:
                    for n in notes:
                        n = re.sub(r"\s*\d+\s*$", "", n).strip()  # page number
                        if n and n not in figures[-1]["notes"]:
                            figures[-1]["notes"].append(n)
                continue
            header = [clean(h) for h in t["header"]]
            side = 1 if col(header, "foot place", "placement", "piacement", "lacement") is not None else 2 if col(header, "couple") is not None else 0
            if not side:
                continue
            title = clean(t["title"]).replace("[© PP", "TO PP").replace("[© ", "TO ")
            # role only from "(Man)" / "(Lady)" – titles like "Maypole Lady Turning Right" name the lady too
            rm = re.search(r"[({\[|]\s*(Man|Men|Mun|Lady|Ladv|Lad)\b", title, re.I) or re.search(r"\b(Man|Lady)\s*[)}\]]", title, re.I)
            role = ""
            if rm:
                role = "lady" if rm.group(1).lower().startswith("lad") else "man"
            # name = text before "(Man)" / "- Side"
            name = re.split(r"[({\[]|\s[-–—~]+\s*Side|\sSide\b", title)[0]
            name = re.sub(r"[^A-Z0-9 '&/-]", "", name.upper()).strip(" -")
            if len(name) < 2 or not re.search(r"[A-Z]{3}|^V\d", name):
                name = None
            if not name or len(name) < 2:
                name, role = last_title if last_title else (None, "")
            if not name:
                continue
            for bad, good in NAME_FIXES:
                name = re.sub(bad, good, name)
            last_title = (name, role)
            if side == 1:
                # Charts come in pairs: man, then lady. A chart right after the man's
                # one with (nearly) the same title is the lady's even if OCR lost "(Lady)".
                prev = figures[-1] if figures else None
                same = prev and difflib.SequenceMatcher(None, prev["name"], name).ratio() > 0.7
                # Lady's chart right after an unpaired man's chart (next page) even with a garbled title.
                follows_man = prev and prev["role"] == "man" and not prev.get("paired") and t["page"] - prev["page"] <= 2
                if not role:
                    role = "lady" if follows_man and (same or len(name) < 8 or difflib.SequenceMatcher(None, prev["name"], name).ratio() > 0.45) else "man"
                if role == "lady" and follows_man:
                    same = True
                # Two man's charts with the same title in a row: the second is the lady's.
                if role == "man" and follows_man and prev["name"] == name:
                    role = "lady"
                if same and role == "lady":
                    name = prev["name"]  # keep the (better) man's title
                    prev["paired"] = True
                cur = {"name": name, "role": role, "page": t["page"], "steps": [], "notes": []}
                figures.append(cur)
                i_step = 0
                i_foot = col(header, "placement", "piacement", "lacement")
                i_align = col(header, "alignment")
                i_turn = col(header, "quantity", "turn")
                i_time = col(header, "timing")
                prev_cell = None
                for row in t["rows"]:
                    cell = (row[i_step] or "").strip()
                    if re.search(r"\bprec", cell, re.I):
                        prev_cell = cell
                        # "Prec. Step": the step before the figure, not part of it – kept
                        # separately (preparatory step of a routine starting with this figure).
                        if i_foot is not None and not cur.get("prec"):
                            pdesc, _ = split_placement(row[i_foot] or "")
                            cur["prec"] = {
                                "desc": pdesc,
                                "align": fix_ocr(row[i_align]) if i_align is not None else "",
                                "turn": fix_ocr(row[i_turn]) if i_turn is not None else "",
                                "timing": clean(row[i_time]) if i_time is not None else "",
                            }
                        continue
                    desc0 = (row[i_foot] if i_foot is not None else "").strip()
                    # A step cell merged over two sub-rows ("RF fwd" / "Recover LF") is
                    # repeated in both: the second sub-row belongs to the same step.
                    if cur["steps"] and ((cell and cell == prev_cell) or (not cell and CONT_RE.match(desc0))):
                        last = cur["steps"][-1]
                        extra = fix_ocr(desc0)
                        if extra and extra not in (last["desc"], last["after"]):
                            last["after"] = (last["after"] + " " + extra).strip()
                        prev_cell = cell
                        continue
                    prev_cell = cell
                    if not desc0:
                        continue  # e.g. the "preceding step" row of a Viennese chart
                    # Steps are numbered 1, 2, 3 …; a cell may hold several ("2 3").
                    # OCR'd digits are unreliable ("1" -> "l", "1" -> "3"): count instead.
                    if not (row[i_foot] if i_foot is not None else "").strip() and not step_numbers(row[i_step]):
                        continue
                    k = max(1, len([n for n in step_numbers(row[i_step]) if n < 40]))
                    first = cur["steps"][-1]["n"] + 1 if cur["steps"] else 1
                    nums = list(range(first, first + k))
                    desc, after = split_placement(row[i_foot]) if i_foot is not None else ("", "")
                    for n in nums:
                        cur["steps"].append({
                            "n": n,
                            "desc": desc,
                            "after": after,
                            "align": fix_ocr(row[i_align]) if i_align is not None else "",
                            "turn": fix_ocr(row[i_turn]) if i_turn is not None else "",
                            "timing": clean(row[i_time]) if i_time is not None else "",
                        })
            elif cur is not None:
                i_pos = col(header, "couple")
                i_align = col(header, "alignment")
                i_hold = col(header, "lead", "hold")
                by_n = {s["n"]: s for s in cur["steps"]}
                expected = 1
                for row in t["rows"]:
                    if re.search(r"\bprec", row[0] or "", re.I):
                        continue
                    ns = [n for n in step_numbers(row[0]) if n < 40] or [expected]
                    expected = ns[-1] + 1
                    for n in ns:
                        s = by_n.get(n)
                        if not s:
                            continue
                        if i_pos is not None:
                            s["pos"] = clean_pos(fix_ocr(row[i_pos]))
                        if i_align is not None and not s.get("align"):
                            s["align"] = fix_ocr(row[i_align])
                        if i_hold is not None:
                            s["hold"] = fix_ocr(row[i_hold])
        out[dance] = figures
        print(dance, len(figures), "charts", sum(1 for f in figures if f["role"] == "man"), "man")
    for figs in out.values():
        for f in figs:
            f.pop("paired", None)
    # Hand transcriptions of charts the OCR could not read replace the OCR'd ones.
    manual = ROOT / "data" / "technique_manual.json"
    if manual.exists():
        for dance, charts in json.loads(manual.read_text()).items():
            if dance.startswith("_"):
                continue
            figs = out.setdefault(dance, [])
            for c in charts:
                figs[:] = [f for f in figs if not (f["name"] == c["name"] and f["role"] == c["role"])]
                figs.append(c)
    OUT.write_text(json.dumps(out, ensure_ascii=False, indent=1))


if __name__ == "__main__":
    main()
