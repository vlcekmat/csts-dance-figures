"""Merge the ČSTS catalog with the WDSF Syllabus (and scraped videos) into the
single JSON file consumed by the web app.

Inputs:
  data/build/catalog.json   (scripts/parse_catalog.py)
  data/build/syllabus.json  (scripts/parse_syllabus.py)
  data/videos.json          (scripts/scrape_videos.py, optional)
  data/dances.json          (hand-written dance metadata + catalog remarks)
Output:
  src/data/figures.json
"""

import difflib
import unicodedata
import json
import os
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BUILD = ROOT / "data" / "build"
OUT = ROOT / "src" / "data" / "figures.json"

# Catalog cross-reference prefixes ("Sf-36") -> dance id.
REF_PREFIX = {"Wa": "waltz", "Sf": "slowfox", "Qs": "quickstep", "Ta": "tango"}

# Syllabus chapter numbers of each dance ("2.1.5" = Waltz figure 5).
DANCE_SECTION = {
    "waltz": "2.1", "slowfox": "2.2", "quickstep": "2.3", "tango": "2.4", "viennese": "2.5",
    "chacha": "3.1", "rumba": "3.2", "paso": "3.3", "samba": "3.4", "jive": "3.5",
}

# Manual catalog -> syllabus matches where names differ too much for fuzzy
# matching. Key: (dance, catalog no) -> (syllabus dance, syllabus num) or None.
MANUAL_MATCH = {
    ("chacha", 29): ("chacha", 29),   # "MCF - Simple foot change"
    ("chacha", 48): ("chacha", 48),
    ("jive", 34): ("jive", 34),       # Chugging by ISTD
    ("jive", 37): ("jive", 37),
    ("rumba", 47): ("rumba", 47),
    ("samba", 55): ("samba", 55),
    # Tango syllabus does not describe Telemark to PP; the catalog refers to Slow Fox.
    ("tango", 33): ("slowfox", 17),
    ("tango", 39): ("tango", 38),
    ("tango", 40): ("tango", 39),
    ("tango", 41): ("tango", 40),
    ("tango", 42): ("tango", 41),
    # Both Coup de Pique variants normalise to the same name.
    ("paso", 37): ("paso", 37),
}


def norm(name):
    """Normalise a figure name for fuzzy comparison."""
    s = name.lower()
    # Drop bracketed aliases / cross references: "(see Slow Fox)", "(Shadow Botafogos)".
    s = re.sub(r"\([^)]*\)", " ", s)
    s = s.replace("left foot", "lf").replace("right foot", "rf")
    s = s.replace("fisht tail", "fishtail").replace("corté", "corte")
    s = s.replace("p.p.", "pp").replace("p.p", "pp")
    s = re.sub(r"\bpromenade position\b", "pp", s)
    s = re.sub(r"\bright\b", "r", s)
    s = re.sub(r"\bleft\b", "l", s)
    s = re.sub(r"\bleft foot\b", "lf", s)
    s = re.sub(r"\brigth\b", "r", s)
    s = re.sub(r"\bopen opp(?:osing)?\.? pos(?:ition)?\.?", "open opposing position", s)
    s = re.sub(r"[^a-z0-9 ]", " ", s)
    return re.sub(r"\s+", " ", s).strip()


def similarity(a, b):
    a, b = norm(a), norm(b)
    if a == b:
        return 1.0
    ratio = difflib.SequenceMatcher(None, a, b).ratio()
    # Bonus when one name is a prefix of the other (bracketed aliases etc.).
    if b.startswith(a) or a.startswith(b):
        ratio = max(ratio, 0.9)
    return ratio


# --- Czech rendering of Start/Finish -----------------------------------------
# Only feet and directions are translated; positions/holds stay in English, the
# same way the ČSTS catalog keeps the official WDSF position names.
CS_GLOSSARY = [
    (r"\bRF\b", "Pn"), (r"\bLF\b", "Ln"),
    (r"\bR foot\b", "Pn"), (r"\bL foot\b", "Ln"),
    (r"\bfwd\b", "vpřed"), (r"\bFwd\b", "vpřed"),
    (r"\bbwd\b", "vzad"), (r"\bBwd\b", "vzad"),
    (r"\bto side\b", "stranou"), (r"\bslightly\b", "mírně"),
    (r"\bdiag\.?,?", "diagonálně"), (r"\band across\b", "a napříč"),
    (r"\bacross\b", "napříč"),
    (r"\bcloses to\b", "přisouvá k"), (r"\bclosed to\b", "přisunuta k"),
    (r"\bcrosses behind\b", "kříží za"), (r"\bcrosses in front of\b", "kříží před"),
    (r"\bin place\b", "na místě"), (r"\bw/o weight\b", "bez váhy"),
    (r"\b[Ww]eight on\b", "váha na"), (r"\bsmall step\b", "malý krok"),
    (r"\bL side leading\b", "vedení L bokem"), (r"\bR side leading\b", "vedení P bokem"),
    (r"\bwith\b", "s"), (r"\band\b", "a"), (r"\bor\b", "nebo"),
    (r"\bT turned out\b", "špička vytočená"), (r"\bbehind\b", "za"),
]


def to_czech(text):
    out = text
    for pat, rep in CS_GLOSSARY:
        out = re.sub(pat, rep, out)
    return out


VARIANT_RE = re.compile(r"\s*\b\d\.\d\.\d+\.\d+\s+([A-Z][A-Z0-9 .,'’/-]+)$")


def clean_notes(notes, extra):
    """Turn trailing sub-figure headings ("3.1.29.2 CHASSE TO R SIDE LINK")
    into separate 'Variant' notes and append free text as a General note."""
    out = []
    for n in notes:
        m = VARIANT_RE.search(n["text"])
        if m:
            out.append({"topic": n["topic"], "text": n["text"][: m.start()].strip()})
            out.append({"topic": "Variant", "text": m.group(1).strip().title()})
        else:
            out.append(n)
    if extra:
        m = VARIANT_RE.search(extra)
        if m:
            extra_text = extra[: m.start()].strip()
            if extra_text:
                out.insert(0, {"topic": "General", "text": extra_text})
            out.insert(0, {"topic": "Variant", "text": m.group(1).strip().title()})
        else:
            out.insert(0, {"topic": "General", "text": extra})
    return [n for n in out if n["text"]]


# --- Variants allowed by the syllabus notes ------------------------------------
# The notes describe choreographic options in fairly regular English, e.g.
#   "Steps 1-3 or 4-6 only may be used", "May start from step 2",
#   "May start with RF fwd in CBMP in Outside Partner Position",
#   "It may end in Promenade Position."
# We turn the common patterns into structured options the routine editor can
# offer. Anything not recognised stays available as plain note text.

RANGE_RE = re.compile(r"(\d+)\s*[-–]\s*(\d+)")
PART_SENTENCE_RE = re.compile(
    r"\bsteps?\s*((?:\d+\s*[-–]\s*\d+\s*(?:,|or|and)?\s*)+)\s*(?:only\s+)?"
    r"(?:may\s+be\s+(?:used|danced)|only\s+(?:are|is)\s+used|are\s+used)",
    re.I,
)
FROM_STEP_RE = re.compile(r"\bmay\s+start\s+from\s+step\s+(\d+)", re.I)
END_RE = re.compile(
    r"\b(?:may|can)\b[^.]*?\b(?:end|finish)\s+in\s+(?:a\s+)?([A-Za-z][^.,;(]*?)\s*(?:[.,;(]|$)",
    re.I,
)
START_RE = re.compile(r"\bmay\s+(?:also\s+)?start\s+(?:with\s+)?(?!from\b)(.+?)\s*\.?$", re.I)
POSITION_ALIASES = {"pp": "Promenade Position", "close position": "Closed Position"}


def sentences(text):
    return [s.strip() for s in re.split(r"(?<=[.!?])\s+", text) if s.strip()]


def tidy_position(pos):
    pos = re.sub(r"\s+", " ", pos).strip().rstrip(")").strip()
    # "Open Opposing Position or 1/8 to R" -> "Open Opposing Position"
    if re.search(r"Position\s+or\s+", pos, re.I):
        pos = re.split(r"\s+or\s+", pos, flags=re.I)[0]
    pos = POSITION_ALIASES.get(pos.lower(), pos)
    return pos[:1].upper() + pos[1:]


def extract_variants(notes):
    parts, starts, finishes = [], [], []

    def add_part(a, b, sentence):
        key = (a, b)
        if key not in [(p["from"], p["to"]) for p in parts]:
            parts.append({"from": a, "to": b, "text": sentence})

    for note in notes:
        for s in sentences(note["text"]):
            low = s.lower()
            # Options that apply to the Lady only don't change the couple's start/finish.
            lady_only = re.search(r"\bLady\s+(?:may|will|can)\b", s) is not None
            # Step ranges ("Steps 1-3 or 4-6 only may be used"). Skip sentences
            # about timing / sway that merely mention step numbers.
            m = PART_SENTENCE_RE.search(s)
            if m and "timing" not in low and "sway" not in low:
                for a, b in RANGE_RE.findall(m.group(1)):
                    add_part(int(a), int(b), s)
            m = FROM_STEP_RE.search(s)
            if m:
                add_part(int(m.group(1)), None, s)  # None = up to the last step
            # Alternative finish position.
            for m in END_RE.finditer(s) if not lady_only else []:
                if len(m.group(1)) >= 50:
                    continue
                pos = tidy_position(m.group(1))
                if pos.lower() not in [f["position"].lower() for f in finishes]:
                    finishes.append({"position": pos, "text": s})
            # Alternative start (foot and/or position).
            m = START_RE.search(s)
            if m and not lady_only and not FROM_STEP_RE.search(s) and "steps" not in low[: low.find("start")]:
                desc = re.sub(r"^the\s+", "", m.group(1))
                # "may start and end in PP" -> start "in PP"
                desc = re.sub(r"^and\s+end\s+(in\s+.*)$", r"\1", desc, flags=re.I)
                desc = re.sub(r"\s+and\s+end\s+in\s+.*$", "", desc, flags=re.I)
                desc = re.split(r",\s*(?:the|in this case|it)\b", desc)[0].strip()
                if len(desc) < 90 and desc.lower() not in [x["desc"].lower() for x in starts]:
                    starts.append({"desc": desc, "descCs": to_czech(desc), "text": s})
    out = {}
    if parts:
        out["parts"] = parts
    if starts:
        out["starts"] = starts
    if finishes:
        out["finishes"] = finishes
    return out


# --- Holds -----------------------------------------------------------------------
# Latin start/finish descriptions carry the hold after the position:
#   "LF fwd (Open Opp.; LH to RH Hold)". Notes mention alternative holds
# ("LH to RH Hold may be used", "with any appropriate hold"). Holds are mapped
# to canonical keys that the app knows how to label and draw.

HOLD_PATTERNS = [
    ("double", r"\bLH to RH and RH to LH\b|\bdouble (?:hand )?hold\b|\bboth hands? hold\b"),
    ("lh-rh", r"\bLH to RH\b"),
    ("rh-lh", r"\bRH to LH\b"),
    ("rh-rh", r"\bRH to RH\b"),
    ("lh-lh", r"\bLH to LH\b"),
    ("promenade", r"\bProm(?:enade)?\.? Hold\b"),
    ("normal", r"\bNormal Hold\b"),
    ("shadow", r"\bShadow Hold\b"),
    # "RH releases Hold" only drops one hand, so it is not mapped to "no hold".
    ("none", r"\bw/o Hold\b|\bno hold\b|\bwithout hold\b"),
]


def holds_in(text):
    """Canonical hold keys in order of appearance (double hold wins over its parts)."""
    found = []
    for key, pat in HOLD_PATTERNS:
        for m in re.finditer(pat, text, re.I):
            found.append((m.start(), key))
    found.sort()
    out = []
    for pos, key in found:
        # "LH to RH and RH to LH" also matches lh-rh / rh-lh: skip parts of a double hold.
        if any(k == "double" and abs(p - pos) < 25 for p, k in found) and key in ("lh-rh", "rh-lh"):
            continue
        if key not in out:
            out.append(key)
    return out


def extract_holds(start, finish, notes):
    def paren(text):
        m = re.search(r"\(([^)]*)\)\s*$", text)
        return m.group(1) if m else ""

    s_holds = holds_in(paren(start))
    f_holds = holds_in(paren(finish))
    alts = []
    any_hold = False
    for n in notes:
        if re.search(r"\bany (?:other )?(?:appropriate |suitable )?hold\b", n["text"], re.I):
            any_hold = True
        for k in holds_in(n["text"]):
            if k not in alts:
                alts.append(k)
    if not (s_holds or f_holds or alts or any_hold):
        return None
    out = {"alts": alts}
    if s_holds:
        out["start"] = s_holds[0]
    if f_holds:
        out["finish"] = f_holds[-1]  # "Normal Hold to Promenade Hold" ends in Promenade Hold
    if any_hold:
        out["any"] = True
    return out


# --- Step charts (dancecentral.info) -------------------------------------------

STANDARD = {"waltz", "tango", "viennese", "slowfox", "quickstep"}
DANCE_WORDS = r"\b(waltz|tango|viennese|slow fox(?:trot)?|foxtrot|quickstep|samba|cha cha(?: cha)?|rumba|paso doble|jive)\b"
# Catalog figure -> dancecentral slug, where names differ too much.
MANUAL_CHART = {
    ("waltz", 1): "waltz/waltz-closed-changes",
    ("waltz", 2): "waltz/waltz-closed-changes|mirror",
    ("waltz", 16): "waltz/closed-telemark",
    ("waltz", 19): "waltz/closed-impetus",
    ("quickstep", 19): "quickstep/closed-telemark",
    ("quickstep", 17): "quickstep/closed-impetus",
    ("chacha", 4): "chacha/new-york",  # catalog typo "New York to P"
}


def chart_title(title):
    t = re.sub(DANCE_WORDS, " ", title, flags=re.I)
    return re.sub(r"\s*[-–]\s*$|^\s*[-–]\s*", "", t).strip(" -–")


def chart_to_floor(entry, dance):
    steps = []
    for st in entry.get("leader", []):
        cols = st["cols"]
        if dance in STANDARD and len(cols) >= 4:
            steps.append({"desc": cols[0], "align": cols[1], "turn": cols[3]})
        else:
            steps.append({"desc": cols[0], "align": "", "turn": cols[1] if len(cols) > 1 else ""})
    return {
        "title": entry["title"],
        "url": entry["url"],
        "steps": steps,
        "preceding": entry.get("preceding", [])[:20],
        "following": entry.get("following", [])[:20],
    }


def link_names(names, dance, rows):
    """Map dancecentral figure names ("Closed Impetus (after 1-3)") to catalog
    figures of the same dance. Returns [{"name", "note"?, "id"?}]."""
    out = []
    for raw in names:
        m = re.match(r"^(.*?)\s*\((.*)\)\s*$", raw)
        base, note = (m.group(1), m.group(2)) if m else (raw, None)
        base = re.sub(r"\s*-\s*(Waltz|Tango|Foxtrot|Quickstep|V Waltz|Samba|Rumba|Cha Cha|Jive)$", "", base, flags=re.I)
        # dancecentral writes "Closed Change RF", "Closed Telemark"...: drop "Closed" when the catalog has no such word.
        best, score = None, 0.0
        for r in rows:
            if not r["en"]:
                continue
            cand = [base, re.sub(r"^Closed\s+", "", base, flags=re.I)]
            for c in cand:
                sc = similarity(c, r["en"])
                # Direction words must not contradict ("to R" vs "to L").
                a, b = set(norm(c).split()), set(norm(r["en"]).split())
                if ({"r", "l"} & a) and ({"r", "l"} & b) and not ({"r", "l"} & a & b):
                    continue
                if sc > score:
                    best, score = r, sc
        item = {"name": raw if not note else base}
        if note:
            item["note"] = note
        if best and score >= 0.8:
            item["id"] = f"{dance}-{best['no']}"
        out.append(item)
    return out


def collect_aliases(entry, aliases_by_dance):
    """Other names: hand-written list + WDSF bracketed titles + dancecentral titles."""
    en, cs = [], []
    own = {norm(entry["en"] or ""), norm(entry["cs"])}

    def add(lst, name):
        name = re.sub(r"\s+", " ", name).strip(" -–")
        if name and norm(name) not in own and norm(name) not in [norm(x) for x in lst]:
            lst.append(name)

    manual = aliases_by_dance.get(entry["dance"], {}).get(entry["en"] or "", {})
    for n in manual.get("en", []):
        add(en, n)
    for n in manual.get("cs", []):
        add(cs, n)
    syl = entry.get("syllabus")
    if syl:
        for m in re.findall(r"\(([^)]*)\)", syl["title"]):
            if not re.match(r"see\b", m, re.I):
                add(en, m.title())
    fl = entry.get("floor")
    if fl:
        t = chart_title(fl["title"])
        if similarity(t, entry["en"] or "") < 0.95:
            add(en, t)
    out = {}
    if en:
        out["en"] = en
    if cs:
        out["cs"] = cs
    return out


def mirror_chart(chart):
    """Mirror a chart (e.g. Closed Change on RF -> on LF): swap feet, left/right
    and the diagonals to wall/centre, and the turn directions."""
    pairs = {"RF": "LF", "LF": "RF", "DW": "DC", "DC": "DW", "R": "L", "L": "R", "Wall": "Centre", "Centre": "Wall"}

    def flip(text):
        # All swaps at once, so "closes to RF" never becomes "to L…".
        # DW/DC also inside alignment codes ("FDC" -> "FDW").
        text = re.sub(r"DW|DC", lambda m: pairs[m.group(0)], text)
        return re.sub(r"\b(RF|LF|Wall|Centre|R|L)\b", lambda m: pairs[m.group(1)], text)

    out = dict(chart)
    out["leader"] = [{"count": st["count"], "cols": [flip(c) for c in st["cols"]]} for st in chart.get("leader", [])]
    return out


def match_chart(charts, dance, no, name):
    key = MANUAL_CHART.get((dance, no))
    if key:
        slug, _, flag = key.partition("|")
        chart = charts.get(slug)
        return mirror_chart(chart) if chart and flag == "mirror" else chart
    def words(t):
        t = unicodedata.normalize("NFKD", t).encode("ascii", "ignore").decode()
        return set(norm(t).split()) - {"to", "the", "and", "of", "from", "in", "on", "a", "with"}

    best, score = None, 0.0
    want = words(name)
    for c in charts.values():
        if c["dance"] != dance or not c.get("leader"):
            continue
        title = chart_title(c["title"])
        have = words(title)
        # Every significant word of the catalog name must appear in the chart
        # title ("Open Natural Turn" must not match "Natural Turn"). Direction
        # words may be missing ("New York to R" -> "New York") but must not be
        # contradicted ("to L" never matches "to Right").
        dirs = want & {"r", "l"}
        if not (want - dirs) <= have:
            continue
        if any(({"r": "l", "l": "r"}[d] in have and d not in have) for d in dirs):
            continue
        # Extra words that make a different figure ("Hover Telemark" is not "Telemark").
        if (have - want) & {"hover", "open", "from", "pp", "promenade", "quick", "running", "overturned", "curved", "natural", "reverse"}:
            continue
        sc = similarity(name, title) - 0.02 * len(have - want)
        if sc > score:
            best, score = c, sc
    return best if score >= 0.6 else None


DEPENDS = re.compile(r"depend|previous figure|figure being danced|quantity of turn danced", re.I)


ALIGN_BASE = {"LOD": 0, "DW": -45, "W": -90, "DC": 45, "C": 90}
ALIGN_NAME = {0: "LOD", 45: "DC", 90: "C", 135: "DC against LOD", 180: "LOD", -135: "DW against LOD", -90: "W", -45: "DW"}


ALMOST = 15  # degrees short of the named alignment for "almost" / "nearly" / "just under"


def _norm(a):
    return ((a + 180) % 360) - 180


def _avg(a, b):
    """Mean of two directions (handles the wrap around ±180°)."""
    return _norm(a + _norm(b - a) / 2)


def phrase_angle(phrase, bwd=False):
    """Direction of an alignment phrase ("Backing DC against LOD", "Pointing between W and DW",
    "almost Facing C", "L Toe Pointing to W") in degrees (0 = LOD, + = centre).
    Returns (angle, almost) or None. `bwd`: a bare code on a backward step means backing."""
    u = phrase.upper().replace("”", " ").replace("CENTRE", "C").replace("CENTER", "C")
    u = re.sub(r"\bLO[OLC0]\b", "LOD", u.replace("WALL", "W"))
    u = re.sub(r"\bWW+\b", "W", u)
    u = re.sub(r"\bAGAIN\S*", "AGAINST", u)  # OCR: "Agains'"
    u = re.sub(r"\bFACIN\w*", "FACING", u).replace("BACKIN ", "BACKING ").replace("PW", "DW").replace("DIAG.", "D")
    u = re.sub(r"\b(FACING|BACKING|POINTING)(?=[A-Z])", r"\1 ", u)  # OCR: "BackingDC"
    almost = bool(re.search(r"\b(ALMOST|AIMOST|NEARLY|JUST UNDER)\b", u))
    u = re.sub(r"\b(ALMOST|AIMOST|NEARLY|JUST|UNDER|OVER|SLIGHTLY|OF|THE|NEW|A)\b", " ", u)
    kind = re.search(r"\b(FACING|BACKING|BAKING|POINTING|DOWN)\b", u)
    rest = u[kind.end():] if kind else u
    mb = re.search(r"\bBETWEEN\s+(LOD|DW|DC|W|C)\s+AND\s+(LOD|DW|DC|W|C)\b", rest)
    if mb:
        a = _avg(ALIGN_BASE[mb.group(1)], ALIGN_BASE[mb.group(2)])
    else:
        m = re.search(r"\b(LOD|DW|DC|W|C)\b(\s+AGAINST\s+LOD)?|\bAGAINST\s+LOD\b", rest)
        if not m:
            return None
        if not m.group(1):
            a = 180
        else:
            a = ALIGN_BASE[m.group(1)]
            if m.group(2):
                a = 180 if m.group(1) == "LOD" else (180 - a if a > 0 else -180 - a)
    k = kind.group(1) if kind else None
    # "Toe pointing to W" / "toe turned in to DC" name the foot's direction itself
    # "toe turned in to DC", "Toe pointing to W", "To C, R toe turned in": the foot's own direction
    toe_code = re.search(r"\bTOE\b[^,.]*?\b(LOD|DW|DC|W|C)\b", u) or re.search(r"\bTO\s+(LOD|DW|DC|W|C)\b", u)
    if k in ("BACKING", "BAKING") or (k in (None, "DOWN") and bwd and not toe_code):
        a += 180
    return _norm(a), almost


def parse_alignment(text, desc, new_lod, prev, frame=None):
    """Precise alignment facts of one chart step.

    Returns {face, end, body, moving} in degrees in the frame of the figure's
    first LOD (None when not given) and whether the step mentions a new LOD.
    face = alignment of the step (direction of the foot), end = facing after
    a pivot / "then …", body = body facing when stated, moving = direction of travel."""
    out = {"face": None, "end": None, "body": None, "moving": None}
    if not text or DEPENDS.search(text):
        return out, False
    t = re.sub(r"\(next step.*?(\)|$)", " ", text, flags=re.I)
    t = re.sub(r"\(\d\)|\"", " ", t)
    t = re.sub(r"\bturn\s+tc\b", "turn to", t, flags=re.I)  # OCR
    new_here = bool(re.search(r"\bnew\s*LO[DO0]", t, flags=re.I))
    bwd = bool(re.search(r"\b(bwd|back)\b", desc, flags=re.I))
    # end of the step: "…, then …", "end Facing …", latin "Facing W turn to Facing LOD" / "Facing W to Facing DW"
    em = re.search(r"\b(?:then|end|to end|finish(?:ing)?|turn(?:ing)? to|to(?=\s+(?:facing|backing|pointing)\b))\b", t, flags=re.I)
    main, endp = (t[:em.start()], t[em.end():]) if em else (t, "")

    def pick(part, key_new):
        body = re.search(r"\bbody\s+(.*?)(?=,|\bmoving\b|$)", part, flags=re.I)
        mov = re.search(r"\bmoving\s+(?:along\s+|sideways\s+(?:to\s+)?|to\s+|towards?\s+)?(.*?)(?=,|$)", part, flags=re.I)
        core = re.split(r"\bbody\b|\bmoving\b|\bor\b", part, flags=re.I)[0]
        if frame is not None:
            shift = frame
        else:
            shift = 90 if key_new or re.search(r"\bnew\b", part, flags=re.I) else 0
        res = {}
        for key, ph, back in (("face", core, bwd), ("body", body.group(1) if body else "", False),
                              ("moving", "Facing " + mov.group(1) if mov else "", False)):
            r = phrase_angle(ph, back) if ph else None
            if r is not None:
                res[key] = (_norm(r[0] + shift), r[1])
        return res

    m = pick(main, new_lod)
    e = pick(endp, new_lod or new_here) if endp else {}
    ref = prev
    for key in ("face", "body", "moving"):
        if key in m:
            a, almost = m[key]
            if almost and ref is not None and abs(_norm(a - ref)) > 1:
                a = _norm(a - (1 if _norm(a - ref) > 0 else -1) * ALMOST)
            out[key] = round(a, 1)
    if "face" in e:
        a, almost = e["face"]
        if almost and out["face"] is not None and abs(_norm(a - out["face"])) > 1:
            a = _norm(a - (1 if _norm(a - out["face"]) > 0 else -1) * ALMOST)
        out["end"] = round(a, 1)
        if "body" in e:
            out["body"] = round(e["body"][0], 1)
    if out["face"] is None and out["end"] is not None:
        out["face"] = out["end"]
    return out, new_here


def align_code(angle):
    """Readable alignment code ("Facing DC", "Backing DW against LOD") of an angle."""
    if angle is None:
        return ""
    a = int(round(angle / 45.0)) * 45
    a = _norm(a)
    if abs(a) > 90:  # against LOD: dancers say "backing ..."
        b = _norm(a + 180)
        return "Backing " + ALIGN_NAME[b]
    return "Facing " + ALIGN_NAME[a]


def chart_rows(chart):
    """Chart steps without a leading "preceding step" row ("Weight on LF")."""
    steps = [dict(st) for st in chart["steps"]]
    # a leading row without an alignment is the "preceding step" of the chart
    while steps and re.match(r"(weight|recover|part weight)\b", steps[0]["desc"], flags=re.I) and not steps[0].get("align"):
        steps = steps[1:]
    # OCR lost the main line of a step ("RF fwd" / "Recover LF" -> only "Recover LF"):
    # rebuild it from the alternating feet and the alignment
    for i, st in enumerate(steps):
        if re.match(r"(weight|recover|part weight)\b", st["desc"], flags=re.I):
            nxt = next((re.search(r"\b(RF|LF)\b", x["desc"]) for x in steps[i + 1:i + 2]), None)
            foot = ("LF" if nxt.group(1) == "RF" else "RF") if nxt else None
            if foot:
                back = re.search(r"backing", st.get("align", ""), flags=re.I)
                st["desc"] = f"{foot} {'bwd' if back else 'fwd'}"
    return steps


def fact_desc(desc):
    """Precise step description composed from technical terms (foot, directions,
    CBMP, positions, pivots …) rather than the book's sentences."""
    foot = re.search(r"\b(RF|LF)\b", desc)
    d = desc.lower()
    if not foot:
        if re.search(r"feet|both", d):
            return "feet " + ("close" if "clos" in d else "uncross" if "uncross" in d else "together")
        return ""
    f = foot.group(1)
    o = "LF" if f == "RF" else "RF"
    extras = []
    if re.search(r"\bcloses?\b", d):
        base = f"{f} closes to {o}"
    elif re.search(r"\bcross", d):
        base = f"{f} crosses " + ("behind" if "behind" in d else "in front of") + f" {o}"
        if "loosely" in d:
            extras.append("loosely")
    elif re.search(r"\bbrush", d):
        base = f"{f} brushes to {o}"
    else:
        dirs = []
        for w, rx in (("diag fwd", r"\bdiag\.?\s*(?:fwd|forward)\b"), ("diag bwd", r"\bdiag\.?\s*(?:bwd|back)\b"),
                      ("fwd", r"\bfwd\b|\bforward\b"), ("bwd", r"\bbwd\b|\bback(?:ward)?\b"), ("to side", r"\bside\b")):
            for m in re.finditer(rx, d):
                if not any(abs(m.start() - x[0]) < 6 for x in dirs):
                    dirs.append((m.start(), w))
        dirs.sort()
        if not dirs:
            base = f"{f} in place" if re.search(r"in place|replace|transfer|weight", d) else f
        else:
            base = f"{f} {dirs[0][1]}"
            if len(dirs) > 1 and dirs[1][1] != dirs[0][1]:
                base += (" and slightly " if "slightly" in d else " and ") + dirs[1][1].replace("to side", "to side")
        if re.search(r"\bacross\b", d):
            base += " and across"
    for rx, word in ((r"\bcbmp\b", "in CBMP"), (r"outside partner|\bop\b", "outside partner"),
                     (r"\bpp\b|promenade", "in PP"), (r"w/o weight|without weight", "w/o weight"),
                     (r"part weight", "part weight"), (r"small step", "small step"),
                     (r"heel turn", "Heel Turn"), (r"heel pull", "Heel Pull"), (r"toe pivot", "Toe Pivot"),
                     (r"slip pivot", "Slip Pivot"), (r"\bpivot\b(?!ing)", "Pivot"), (r"swivel", "Swivel"),
                     (r"\b(l|r) side leading", None), (r"toe turned (in|out)", None)):
        m = re.search(rx, d)
        if not m:
            continue
        if word is None:
            word = m.group(0).replace("l side", "L side").replace("r side", "R side")
        if word == "Pivot" and any(w.endswith("Pivot") for w in extras):
            continue
        if word not in extras:
            extras.append(word)
    return " ".join([base] + extras)


def fact_turn(turn):
    """Amount of turn as bare facts: "3/8 R, then 1/2 R" (no wording)."""
    if not turn or DEPENDS.search(turn):
        return ""
    side = "R" if re.search(r"\bto\s*R\b|\bR\b|right", turn) else "L" if re.search(r"\bto\s*L\b|\bL\b|left", turn) else ""
    fr = re.findall(r"(\d/\d)\s*(?:to\s*)?([LR])?", turn)
    parts = [f"{a} {b or side}".strip() for a, b in fr]
    if not parts:
        return ("starts to turn " + side).strip() if re.search(r"com|start", turn, flags=re.I) else ""
    out = ", then ".join(parts)
    # when the turn happens: before the step ("between 1 and 2") or as a pivot after it ("on 4")
    if re.search(r"\bon\s*\d|pivot", turn, flags=re.I):
        out += " (pivot)"
    elif re.search(r"between", turn, flags=re.I):
        out += " (between steps)"
    return out


POS_WORDS = set("""close closed promenade counter outside partner fallaway wing position pos pos. opp opp. opposing
open ex ex. extended same side diag diag. prom prom. cnt cnt. r l right left angle fan shadow tandem contra double
hold to then at very e/o of and man lady passes behind front in relaxed hand hammerlock no cpp pp op""".split())


def is_position_terms(pos):
    """Only couple-position names (no sentences) go to the public site."""
    words = re.findall(r"[A-Za-z/.]+", pos)
    return bool(words) and len(pos) <= 70 and all(w.lower() in POS_WORDS for w in words)


def turn_amount(text):
    """Signed amount of turn written in a chart cell (degrees, + = left), None if unknown."""
    if not text or DEPENDS.search(text) or re.search(r"\bor\b|just|over|almost|slight|body", text, flags=re.I):
        return None
    total = 0.0
    found = False
    for m in re.finditer(r"(\d)\s*/\s*(\d)\s*(?:to\s*)?([LR])?", text):
        side = m.group(3) or ("R" if re.search(r"\bR\b|right", text) else "L" if re.search(r"\bL\b|left", text) else None)
        if not side:
            return None
        frac = int(m.group(1)) / int(m.group(2)) * 360
        total += frac if side == "L" else -frac
        found = True
    return total if found else (0.0 if not text.strip() else None)


def build_steps(chart, public):
    """Steps of a WDSF chart in the app's FloorStep format with precise alignment facts.
    public=True: facts only (no book wording, positions, timing)."""
    out = []
    new_lod = False  # after "... new LOD" the following steps refer to the new LOD too
    prev = None
    for st in chart_rows(chart):
        align = st.get("align", "")
        al, here_new = parse_alignment(align, st["desc"], new_lod, prev)
        if (here_new or new_lod) and prev is not None and not os.environ.get("NO_FRAME_PICK"):
            # "… new LOD": the book is not consistent about which steps after a corner refer to
            # the new LOD. Take the reading that agrees with the charted amount of turn.
            # only the turn before the step's own alignment ("…, then 1/2 on 3" comes after it)
            t = turn_amount(re.split(r"\bthen\b", st.get("turn", ""), flags=re.I)[0])
            expected = _norm(prev + (t or 0))
            options = [parse_alignment(align, st["desc"], new_lod, prev, frame=f)[0] for f in (0, 90)]
            def dist(o):
                v = o["face"]
                return 999 if v is None else abs(_norm(v - expected))
            if t is not None or not here_new:
                al = min(options, key=dist)
        facing = al["end"] if al["end"] is not None else al["face"]
        item = {
            "desc": fact_desc(st["desc"]) if public else st["desc"],
            # "align" = readable code of the facing after the step (also parsed by older code)
            "align": align_code(facing) if facing is not None else "",
            "turn": fact_turn(st.get("turn", "")) if public else ("" if DEPENDS.search(st.get("turn", "")) else st.get("turn", "")),
        }
        for k in ("face", "end", "body", "moving"):
            if al[k] is not None:
                item[k] = al[k]
        # "Pointing X … body turns less": the foot points X, the body is about 1/8 behind it
        if ("body" not in item and al["face"] is not None and prev is not None
                and re.search(r"\bpointing\b", align, re.I) and re.search(r"body turns less", st.get("turn", ""), re.I)):
            d = _norm(al["face"] - prev)
            if abs(d) > 45:
                item["body"] = round(_norm(al["face"] - (45 if d > 0 else -45)), 1)
        if re.fullmatch(r"[0-9&a.SQ ]{1,6}", st.get("timing") or ""):
            item["timing"] = st["timing"].strip()  # the count of the step
        pos = st.get("pos") or ""
        if pos and not DEPENDS.search(pos) and (not public or is_position_terms(pos)):
            item["pos"] = pos  # couple position names only (no sentences)
        if not public:
            if align and not DEPENDS.search(align):
                item["alignText"] = align

        out.append(item)
        if facing is not None:
            prev = facing
        new_lod = new_lod or here_new
    spread_constant_rotation(chart_rows(chart), out)
    return out


def block_turn(text):
    """Amount of turn of a merged cell covering several steps ("3 turns to R", "1 1/2 turns to L")."""
    if not text:
        return None
    side = "R" if re.search(r"\bto\s*R\b|\bR\b|right", text) else "L" if re.search(r"\bto\s*L\b|\bL\b|left", text) else None
    if not side:
        return None
    deg = 0.0
    m = re.search(r"(\d+)\s+(?:and\s+)?(\d)\s*/\s*(\d)|(\d)\s*/\s*(\d)|(\d+)\s*(?:full\s*)?turns?", text, re.I)
    if not m:
        return None
    if m.group(1):
        deg = int(m.group(1)) * 360 + int(m.group(2)) / int(m.group(3)) * 360
    elif m.group(4):
        deg = int(m.group(4)) / int(m.group(5)) * 360
    else:
        deg = int(m.group(6)) * 360
    return deg if side == "L" else -deg


def spread_constant_rotation(rows, out):
    """Charts with one merged "Quantity of Turn" cell for many steps and no alignment
    per step ("constant rotation"): spread the turn evenly over the steps so that the
    block ends in the alignment that follows it."""
    i = 0
    while i < len(out):
        t = rows[i].get("turn", "") if i < len(rows) else ""
        j = i
        while j + 1 < len(out) and j + 1 < len(rows) and rows[j + 1].get("turn", "") == t and t:
            j += 1
        block = range(i, j + 1)
        total = block_turn(t) if j - i >= 2 else None
        if total is not None and all("face" not in out[k] for k in block if k < j) :
            # alignment reached at the end of the block (its last step, or the step after it)
            end_k = next((k for k in range(j, min(j + 2, len(out))) if "face" in out[k]), None)
            if end_k is not None:
                end = out[end_k].get("end", out[end_k]["face"])
                n = end_k - i + 1
                for idx, k in enumerate(range(i, end_k + 1)):
                    if k == end_k:
                        break
                    a = _norm(end - total * (1 - (idx + 1) / n))
                    out[k]["face"] = round(a, 1)
                    out[k]["align"] = align_code(a)
                for k in block:
                    out[k]["turn"] = ""  # the per-step share is in the facings now
        i = j + 1


def canon(name):
    """Canonical figure name for matching book titles with catalog / syllabus names."""
    n = (name or "").lower()
    n = re.sub(r"\(.*?\)", " ", n)
    n = n.replace("promenade position", "pp").replace("p.p.", "pp").replace("p.p", "pp")
    n = n.replace("line of dance", "lod")
    n = re.sub(r"\b(right|rigth)\b", "r", n)
    n = re.sub(r"\bleft\b", "l", n)
    n = re.sub(r"\bbackward\b", "back", n)
    n = re.sub(r"\blocks\b", "lock", n)
    n = re.sub(r"\bfoot\b", "", n)
    n = re.sub(r"\bon (r|l)\b", r"\1", n)  # "closed change on right foot" ~ "closed change on rf"
    n = re.sub(r"\b(rf|lf)\b", lambda m: m.group(1)[0], n)
    n = re.sub(r"[^a-z0-9]+", " ", n)
    return re.sub(r"\s+", " ", n).strip()


STANDARD_BOOKS = ["waltz", "tango", "viennese", "slowfox", "quickstep"]


# Catalog figures whose book chart has a clearly different title.
BOOK_TITLE = {
    "tango-26": ("tango", "OUTSIDE SWIVEL METHOD 2 - AFTER OPEN FINISH AND TURNING TO LEFT"),
    "samba-8": ("samba", "WHISK TO RIGHT"),
    "samba-22": ("samba", "UNDERARM TURNING RIGHT"),
    "samba-23": ("samba", "UNDERARM TURNING LEFT"),
    "samba-28": ("samba", "MAYPOLE LADY TURNING RIGHT"),
    "chacha-29": ("chacha", "SIMPLE FOOT CHANGE"),
    "quickstep-44": ("waltz", "FALLAWAY NATURAL TURN"),
    "jive-34": ("jive", "CHUGGING"),
    "paso-35": ("paso", "4 LEFT FOOT VARIATION"),
    "paso-36": ("paso", "5A COUP DE PIQUE CHANGING LF TO RF"),
    "paso-37": ("paso", "5B COUP DE PIQUE CHANGING RF TO LF"),
    "waltz-40": ("slowfox", "BOUNCE FALLAWAY WITH WEAVE ENDING"),
    "waltz-41": ("slowfox", "QUICK OPEN REVERSE TURN"),
}


def match_book(technique, dance, titles, fig_id=None):
    """Man's and lady's chart of the figure in the WDSF book: exact (canonical) title,
    then a very close one; figures borrowed from another dance ("see Quickstep") are
    looked up in the other standard books by exact title only."""
    keys = [canon(t) for t in titles if t]

    def pick(charts, exact_only):
        best = None
        for c in charts:
            ck = canon(c["name"])
            if ck in keys:
                return c["name"]
            # never mix up "... to R" and "... to L", "on RF" and "on LF"
            sides = lambda k: set(re.findall(r"\b[rl]\b", k))
            if not exact_only and any(sides(k) == sides(ck) for k in keys):
                score = max(similarity(t, c["name"]) for t in titles if t)
                if score >= 0.93 and (best is None or score > best[0]):
                    best = (score, c["name"])
        return best[1] if best else None

    charts = technique.get(dance, [])
    name = BOOK_TITLE.get(fig_id) if fig_id else None
    if name and name[0] != dance:
        charts = technique.get(name[0], [])
    name = name[1] if name else pick(charts, False)
    if not name and dance in STANDARD_BOOKS:
        for other in STANDARD_BOOKS:
            if other != dance:
                name = pick(technique.get(other, []), True)
                if name:
                    charts = technique[other]
                    break
    if not name:
        return None, None
    man = next((c for c in charts if c["name"] == name and c["role"] == "man"), None)
    lady = next((c for c in charts if c["name"] == name and c["role"] == "lady"), None)
    return man, lady


def main():
    catalog = json.loads((BUILD / "catalog.json").read_text(encoding="utf-8"))
    syllabus = json.loads((BUILD / "syllabus.json").read_text(encoding="utf-8"))
    dances = json.loads((ROOT / "data" / "dances.json").read_text(encoding="utf-8"))
    videos_path = ROOT / "data" / "videos.json"
    videos = json.loads(videos_path.read_text(encoding="utf-8")) if videos_path.exists() else {}
    aliases_by_dance = json.loads((ROOT / "data" / "aliases.json").read_text(encoding="utf-8"))
    charts_path = ROOT / "data" / "alignment.json"
    charts = json.loads(charts_path.read_text(encoding="utf-8")) if charts_path.exists() else {}
    technique_path = BUILD / "technique.json"
    technique = json.loads(technique_path.read_text(encoding="utf-8")) if technique_path.exists() else {}
    turn_ranges = json.loads((ROOT / "data" / "turn_ranges.json").read_text(encoding="utf-8"))

    # Resolve "See 3.4.22 ..." entries (Samba) by copying the referenced figure.
    for dance, data in syllabus.items():
        by_num = {f["num"]: f for f in data["figures"]}
        for f in data["figures"]:
            m = re.match(r"See \d\.\d\.(\d+)", f.get("extra", ""))
            if m and not f["timing"]:
                src = by_num[int(m.group(1))]
                for key in ("start", "finish", "timing", "notes", "altTimings"):
                    f[key] = src[key]
                f["seeAlso"] = src["title"]
                f["extra"] = ""

    figures = []
    report = []
    book_floor = {}  # fig id -> chart from the WDSF technique books (local only)
    for dance, rows in catalog.items():
        syl = syllabus.get(dance, {"figures": []})["figures"]
        for row in rows:
            fig_id = f"{dance}-{row['no']}"
            entry = {
                "id": fig_id,
                "dance": dance,
                "no": row["no"],
                "en": row["en"],
                "cs": row["cs"],
                "classes": row["classes"],
                "wdsfRef": row.get("wdsfRef"),
                "plamRef": row.get("plamRef"),
            }
            for k in ("noteCs", "noteEn", "polkaRef"):
                if row.get(k):
                    entry[k] = row[k]

            match = None
            match_dance = dance
            if (dance, row["no"]) in MANUAL_MATCH:
                target = MANUAL_MATCH[(dance, row["no"])]
                if target:
                    match_dance = target[0]
                    match = next(f for f in syllabus[target[0]]["figures"] if f["num"] == target[1])
                score = 1.0
            elif row["en"] and syl:
                # "... to R" must never match "... to L" (and RF/LF likewise).
                sides = lambda k: set(re.findall(r"\b[rl]\b", canon(k)))
                scored = sorted(((similarity(row["en"], f["title"])
                                  - (0.5 if sides(row["en"]) and sides(f["title"]) and sides(row["en"]) != sides(f["title"]) else 0), f)
                                 for f in syl),
                                key=lambda t: -t[0])
                score, best = scored[0]
                # Prefer the syllabus number from the catalog when it is a tie.
                if row.get("wdsfRef", "") and row["wdsfRef"].isdigit():
                    for s, f in scored[:3]:
                        if f["num"] == int(row["wdsfRef"]) and s >= score - 0.05:
                            score, best = s, f
                            break
                if score >= 0.6:
                    match = best
                report.append((score, dance, row["no"], row["en"], best["title"]))

            if match:
                entry["syllabus"] = {
                    "section": f"{DANCE_SECTION[match_dance]}.{match['num']}{match['suffix']}",
                    "title": match["title"],
                    "start": match["start"],
                    "finish": match["finish"],
                    "startCs": to_czech(match["start"]),
                    "finishCs": to_czech(match["finish"]),
                    "timing": match["timing"],
                    "altTimings": match["altTimings"],
                    "notes": clean_notes(match["notes"], match.get("extra", "")),
                }
                entry["syllabus"]["variants"] = extract_variants(entry["syllabus"]["notes"])
                holds = extract_holds(match["start"], match["finish"], entry["syllabus"]["notes"])
                if holds:
                    entry["syllabus"]["holds"] = holds
                if match.get("seeAlso"):
                    entry["syllabus"]["seeAlso"] = match["seeAlso"]
                elif match_dance != dance:
                    entry["syllabus"]["seeAlso"] = f"{match_dance}: {match['title']}"
            if fig_id in videos:
                entry["videos"] = videos[fig_id]
            if row["en"] and charts:
                chart = match_chart(charts, dance, row["no"], row["en"])
                if chart:
                    entry["floor"] = chart_to_floor(chart, dance)
                    entry["floor"]["preceding"] = link_names(entry["floor"]["preceding"], dance, rows)
                    entry["floor"]["following"] = link_names(entry["floor"]["following"], dance, rows)
            # WDSF technique book (primary source): replaces the ISTD chart steps.
            titles = [row["en"], match["title"] if match else None]
            man, lady = match_book(technique, dance, titles, fig_id) if row["en"] else (None, None)
            if man and man["steps"]:
                fl = entry.get("floor", {"preceding": [], "following": []})
                steps = build_steps(man, public=False)
                # Copyrighted book content: only into the local, git-ignored file.
                book_floor[fig_id] = {
                    "title": man["name"].title(),
                    "url": "",
                    "source": "wdsf",
                    "page": man["page"],
                    "steps": steps,
                    "preceding": fl.get("preceding", []),
                    "following": fl.get("following", []),
                }
                # Public site: precise steps as facts (foot, direction, alignment, turn,
                # technical terms) for man and lady – no wording or notes from the books.
                pub = {
                    "title": fl.get("title") or man["name"].title(),
                    "url": fl.get("url", ""),
                    "source": "checked",
                    "steps": build_steps(man, public=True),
                    "preceding": fl.get("preceding", []),
                    "following": fl.get("following", []),
                }
                if not any(st["align"] for st in pub["steps"]):
                    pub["follows"] = True
                if lady and lady["steps"]:
                    pub["ladySteps"] = build_steps(lady, public=True)
                entry["floor"] = pub
                # Holds allowed by the technique book ("Lead - Hold" column and notes) extend the
                # syllabus holds: e.g. Time Step "usually w/o Hold, but any appropriate Hold".
                hold_texts = [st.get("hold", "") for st in man["steps"] + ((lady or {}).get("steps") or [])]
                hold_texts += man.get("notes", []) + ((lady or {}).get("notes") or [])
                sy = entry.get("syllabus")
                if sy is not None:
                    h = sy.get("holds") or {"alts": []}
                    changed = False
                    for ht in hold_texts:
                        if not ht or DEPENDS.search(ht):
                            continue
                        # only holds the book explicitly allows as options, not the hold
                        # changes during the figure
                        if not re.search(r"\bmay\b|\bor\b|\bany\b|alternativ|option|also", ht, re.I):
                            continue
                        if re.search(r"\bany\s+(?:other\s+)?(?:appropriate\s+|suitable\s+)?hold", ht, re.I) and not h.get("any"):
                            h["any"] = True
                            changed = True
                        for k in holds_in(ht):
                            if k not in h["alts"] and k != h.get("start") and k != h.get("finish"):
                                h["alts"].append(k)
                                changed = True
                    if changed or sy.get("holds"):
                        sy["holds"] = h
                bf = book_floor[fig_id]
                if lady and lady["steps"]:
                    bf["ladySteps"] = build_steps(lady, public=False)
                if not any(st["align"] for st in steps):
                    bf["follows"] = True
                notes = [n for n in man.get("notes", []) + (lady or {}).get("notes", [])]
                if notes:
                    bf["bookNotes"] = list(dict.fromkeys(notes))
            # Allowed under-/overturning comes from the (public) syllabus notes.
            if fig_id in turn_ranges:
                for fl in (entry.get("floor"), book_floor.get(fig_id)):
                    if fl is not None:
                        fl["turnRange"] = {k: v for k, v in turn_ranges[fig_id].items()}
            al = collect_aliases(entry, aliases_by_dance)
            if al:
                entry["aliases"] = al
            figures.append(entry)

    OUT.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "sources": {
            "catalog": "ČSTS Soutěžní řád, příloha SC02 Katalog figur (SC02_260701), účinnost od 24.07.2026",
            "syllabus": "WDSF Syllabus (worlddancesport.org, verze 2018)",
        },
        "dances": dances["dances"],
        "figures": figures,
    }
    OUT.write_text(json.dumps(payload, ensure_ascii=False, indent=1), encoding="utf-8")
    local = OUT.parent / "technique.local.json"
    if book_floor:
        local.write_text(json.dumps(book_floor, ensure_ascii=False, indent=1), encoding="utf-8")
    elif local.exists():
        local.unlink()

    # Report hand-written aliases whose figure name doesn't exist (typos).
    names = {(f["dance"], f["en"]) for f in figures}
    for d, table in aliases_by_dance.items():
        if d.startswith("_"):
            continue
        for n in table:
            if (d, n) not in names:
                print(f"WARNING: aliases.json: no figure '{n}' in {d}")
    unmatched = [f["id"] for f in figures if "syllabus" not in f and f["dance"] != "polka"]
    with_chart = sum(1 for f in figures if "floor" in f)
    print(f"{with_chart} figures with a public (dancecentral) chart, {len(book_floor)} with a local WDSF book chart "
          f"({sum(1 for f in book_floor.values() if 'ladySteps' in f)} with lady's steps)")
    for d in ["waltz", "tango", "viennese", "slowfox", "quickstep", "samba", "chacha", "rumba", "paso", "jive"]:
        miss = [f["id"] for f in figures if f["dance"] == d and f["id"] not in book_floor]
        if miss:
            print(f"  no WDSF chart: {miss}")
    print(f"{len(figures)} figures written, {len(unmatched)} without syllabus data: {unmatched}")
    if "--report" in sys.argv:
        for r in sorted(report):
            if r[0] < 0.95:
                print(f"{r[0]:.2f} {r[1]:9s} {r[2]:3d} {r[3]!r:55s} -> {r[4]!r}")


if __name__ == "__main__":
    main()
