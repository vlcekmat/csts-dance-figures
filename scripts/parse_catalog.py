"""Parse the ČSTS figure catalog (SC02) text export into structured JSON.

Input:  data/build/catalog.txt  (pdftotext -layout output of the SC02 PDF)
Output: data/build/catalog.json

Each table row becomes one figure with its catalog number, English and Czech
name, literature references (WDSF syllabus number, Plamínek/Landsfeld number)
and the list of competition classes in which it may be danced.
"""

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "data" / "build" / "catalog.txt"
OUT = ROOT / "data" / "build" / "catalog.json"

# Czech dance headings in the catalog -> internal dance id.
DANCE_HEADINGS = {
    "Waltz": "waltz",
    "Tango": "tango",
    "Valčík": "viennese",
    "Slowfoxtrot": "slowfox",
    "Quickstep": "quickstep",
    "Samba": "samba",
    "Chacha": "chacha",
    "Rumba": "rumba",
    "Paso Doble": "paso",
    "Jive": "jive",
    "Polka": "polka",
}

# Lines that repeat on every page and must be ignored.
BOILERPLATE = re.compile(
    r"^(Český svaz tanečního sportu|schváleno:|platnost od:|\s+Úplné znění|\s*\d+/15\s*$)"
)
CLASSES_RE = re.compile(r"^(?:[EDC],)*[EDC]$")
ROW_RE = re.compile(r"^\s{0,4}(\d{1,2})\s+(\S.*)$")


def chunks(line):
    """Split a layout line into (start_col, text) chunks separated by 2+ spaces."""
    return [(m.start(), m.group(0)) for m in re.finditer(r"\S+(?: \S+)*", line)]


def tokens(line, start_col):
    """Whitespace tokens (with their start column) at or after start_col."""
    return [(m.start(), m.group(0)) for m in re.finditer(r"\S+", line) if m.start() >= start_col]


class Table:
    """Column layout of one catalog table, derived from its header line."""

    def __init__(self, header_line):
        en = header_line.index("Anglický")
        cz = header_line.index("český")
        wdsf = header_line.index("WDSF")
        # Boundaries are midpoints between header labels; robust to centering.
        self.cz_from = (en + cz) // 2 + 2
        self.refs_from = (cz + wdsf) // 2 + 6


def split_row(table, body, offset):
    """Split the text of a row (or continuation line) into name/ref parts.

    `offset` is the column at which `body` starts in the original line so that
    the column boundaries of the table can be applied.
    """
    en, cz = [], []
    line = " " * offset + body
    refs_start = None
    for start, text in chunks(line):
        if start < table.cz_from:
            en.append(text)
        elif start < table.refs_from:
            cz.append(text)
        else:
            refs_start = start if refs_start is None else refs_start
    refs = tokens(line, refs_start) if refs_start is not None else []
    # A Czech chunk may swallow trailing refs if separated by a single space only;
    # peel off trailing class lists / numbers in that case.
    return " ".join(en), " ".join(cz), [t for _, t in refs]


def assign_refs(fig, refs):
    """Distribute ref tokens into wdsf / plam / classes fields."""
    for tok in refs:
        if CLASSES_RE.match(tok):
            fig["classes"] = tok.split(",")
        elif fig["wdsfRef"] is None and not fig["_wdsf_done"]:
            fig["wdsfRef"] = tok
            fig["_wdsf_done"] = True
        elif fig["plamRef"] is None:
            fig["plamRef"] = tok
        else:
            fig["plamRef"] += " " + tok


def parse_polka(lines):
    """The Polka table has a different, simpler layout (Czech names only)."""
    out = []
    for line in lines:
        m = re.match(r"^\s*(\d+)\s+(.+?)\s{2,}(\d+)\s+((?:[EDC],)*[EDC])\s*$", line)
        if not m:
            continue
        name = re.sub(r"\s{2,}", " ", m.group(2)).strip()
        out.append({
            "no": int(m.group(1)),
            "en": None,
            "cs": name,
            "wdsfRef": None,
            "plamRef": None,
            "polkaRef": m.group(3),
            "classes": m.group(4).split(","),
        })
    return out


# Manual fixes for rows where the PDF layout merges columns (only one space
# between the English and Czech name) or where text wraps oddly.
OVERRIDES = {
    ("waltz", 40): {
        "wdsfRef": "Sf-40",
        "noteCs": "Ze SF převzato Bounce Fallaway (1a23), napojeno 4-7 Weave from PP (123)",
        "noteEn": "Bounce Fallaway (1a23) taken from Slow Fox, joined with steps 4-7 of Weave from PP (123)",
    },
    ("quickstep", 48): {"en": "Running Spin Turn"},
    # Typo in the catalog ("Postupová základní pohyb").
    ("samba", 3): {"cs": "Postupový základní pohyb"},
    ("paso", 36): {
        "en": "Coup de Pique (changing from LF to RF)",
        "cs": "Bodnutí pikou - se změnou z Ln na Pn",
    },
    ("paso", 37): {
        "en": "Coup de Pique (changing from RF to LF)",
        "cs": "Bodnutí pikou - se změnou z Pn na Ln",
    },
    ("jive", 12): {
        "en": "Change of Place from R to L with Double Spin",
        "cs": "Změna míst z P do L s dvojitou spinou",
    },
    ("jive", 13): {
        "en": "Overturned Change of Place from L to R",
        "cs": "Přetočená změna míst z L do P",
    },
    ("jive", 34): {"wdsfRef": "DTV-NF-7", "plamRef": None},
    ("jive", 37): {"wdsfRef": "DTV-NF-9", "plamRef": None},
    ("quickstep", 32): {"plamRef": "pozn.3 Wa-23"},
    ("tango", 25): {
        "en": "Outside Swivel - method 1: after Open Finish and Turning to R",
        "cs": "Výkrut mimo – metoda 1: po otevřeném zakončení a točený do P",
    },
    ("tango", 39): {
        "en": "Chase Alternative Ending - method 1: Whisk, fwd step to PP",
        "cs": "Obchvat – alternat. zakončení metodou 1: Zášvih, krok vpřed do PP",
    },
    ("tango", 40): {
        "en": "Chase Alternative Ending - method 2: Whisk, Promenade Link",
        "cs": "Obchvat – alternat. zakončení metodou 2: Zášvih, promenádní spojka",
    },
    ("tango", 41): {
        "en": "Chase Alternative Ending - method 3: Whisk, close step to PP",
        "cs": "Obchvat – alternat. zakončení metodou 3: Zášvih, přísun do PP",
    },
    ("tango", 42): {
        "en": "Chase Alternative Ending - method 4: Progressive Link",
        "cs": "Obchvat – alternat. zakončení metodou 4: Postupová spojka",
    },
}


# Obvious spelling mistakes in the catalog's Czech names (diacritics, grammar).
CS_TYPOS = [
    (r"\bPreměn", "Přeměn"), (r"\bpreměn", "přeměn"),
    (r"\bPřemen(a|y|ou)\b", r"Přeměn\1"), (r"\bpřemen(a|y|ou)\b", r"přeměn\1"),
    (r"\bUzavřená změny\b", "Uzavřená změna"),
    (r"\bčtyrkrok\b", "čtyřkrok"),
    (r"\bPretočená\b", "Přetočená"),
    (r"\bBežená\b", "Běžená"),
    (r"\bkřízení\b", "křížení"),
    (r"\bzměny Ln\b", "změna Ln"),
]


def apply_overrides(result):
    for (dance, no), patch in OVERRIDES.items():
        fig = next(f for f in result[dance] if f["no"] == no)
        fig.update(patch)
    for figs in result.values():
        for f in figs:
            for pat, rep in CS_TYPOS:
                f["cs"] = re.sub(pat, rep, f["cs"])


def main():
    lines = [l.rstrip("\n") for l in SRC.read_text(encoding="utf-8").splitlines()]
    lines = [l for l in lines if l.strip() and not BOILERPLATE.match(l)]

    result = {}
    dance = None
    table = None
    current = None
    in_table = False
    polka_lines = None

    for i, line in enumerate(lines):
        stripped = line.strip()
        if stripped in DANCE_HEADINGS:
            dance = DANCE_HEADINGS[stripped]
            result.setdefault(dance, [])
            in_table = False
            if dance == "polka":
                polka_lines = []
            continue
        if polka_lines is not None:
            polka_lines.append(line)
            continue
        if "Anglický" in line and "WDSF" in line:
            table = Table(line)
            in_table = True
            current = None
            continue
        if not in_table or dance is None:
            continue
        if stripped.startswith(("P.", "Název", "Třídy")) or stripped == "Literatura":
            continue
        # Any text starting at column 0 is a footnote / remark: table ended.
        if not line[0].isspace():
            in_table = False
            continue

        m = ROW_RE.match(line)
        if m:
            current = {
                "no": int(m.group(1)),
                "en": "",
                "cs": "",
                "wdsfRef": None,
                "plamRef": None,
                "classes": [],
                "_wdsf_done": False,
            }
            result[dance].append(current)
            en, cz, refs = split_row(table, m.group(2), m.start(2))
            current["en"], current["cs"] = en, cz
            assign_refs(current, refs)
        elif current is not None:
            en, cz, refs = split_row(table, line, 0)
            # Bullet continuation lines describe a variant ("method 1: ...").
            en = en.lstrip("• ").strip()
            cz = cz.lstrip("• ").strip()
            if en:
                current["en"] = (current["en"] + " " + en).strip()
            if cz:
                current["cs"] = (current["cs"] + " " + cz).strip()
            assign_refs(current, refs)

    if polka_lines is not None:
        result["polka"] = parse_polka(polka_lines)

    apply_overrides(result)

    for figs in result.values():
        for f in figs:
            f.pop("_wdsf_done", None)
            for key in ("en", "cs"):
                if f[key]:
                    f[key] = re.sub(r"\s+", " ", f[key]).replace(": ", ": ").strip()

    OUT.write_text(json.dumps(result, ensure_ascii=False, indent=1), encoding="utf-8")
    for d, figs in result.items():
        nos = [f["no"] for f in figs]
        gaps = sorted(set(range(1, max(nos) + 1)) - set(nos)) if nos else []
        print(f"{d:10s} {len(figs):3d} figures; missing numbers: {gaps}", file=sys.stderr)


if __name__ == "__main__":
    main()
