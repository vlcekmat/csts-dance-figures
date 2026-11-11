"""Parse the WDSF Syllabus text export into structured JSON.

Input:  data/build/syllabus.txt (pdftotext -layout output of WDSF_Syllabus.pdf)
Output: data/build/syllabus.json

For each figure we keep: section number, title, Start, Finish, Timing and the
list of NOTE paragraphs (each with its category, e.g. "Timing" or "General").
Alternative timings mentioned in the notes are extracted as well.
"""

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "data" / "build" / "syllabus.txt"
OUT = ROOT / "data" / "build" / "syllabus.json"

SECTIONS = {
    "2.1": "waltz",
    "2.2": "slowfox",
    "2.3": "quickstep",
    "2.4": "tango",
    "2.5": "viennese",
    "3.1": "chacha",
    "3.2": "rumba",
    "3.3": "paso",
    "3.4": "samba",
    "3.5": "jive",
}

FIG_RE = re.compile(r"^\s*([23]\.[1-5])\.(\d+)\s*([a-z]?)\s+(\S.*)$")
DANCE_RE = re.compile(r"^([23]\.[1-5])\s+[A-Z][A-Za-z ]+$")
FIELD_RE = re.compile(r"^\s*(Start|Finish|Timing)\s*:\s*(.*)$", re.I)
NOTE_RE = re.compile(r"^\s*NOTE\s*[-–]?\s*(.*)$")
PAGE_NO_RE = re.compile(r"^\s*\d{1,3}\s*$")

# A timing expression: counts, S/Q, &, a, e, parentheses, dashes and spaces.
TIMING_EXPR = r"[0-9SQ&ae()\-–/ ]*[0-9SQ&ae)][0-9SQ&ae()\-–/ ]*"
ALT_TIMING_RE = re.compile(
    r"(?:alternative\s+timings?|timing)\s+(?:of\s+|using\s+)?"
    r"(" + TIMING_EXPR + r"(?:\s*(?:,|or)\s*" + TIMING_EXPR + r")*)",
    re.I,
)


def clean(text):
    return re.sub(r"\s+", " ", text).strip()


def extract_alt_timings(notes):
    """Find explicit alternative timings like '12&3 or 123&' inside NOTE text."""
    found = []
    for note in notes:
        if "timing" not in note["text"].lower() and "timing" not in note["topic"].lower():
            continue
        for m in ALT_TIMING_RE.finditer(note["text"]):
            for part in re.split(r"\s*(?:,|\bor\b)\s*", m.group(1)):
                part = part.strip(" -–")
                # Require at least two timing symbols to avoid matching stray letters.
                if len(re.sub(r"[^0-9SQ&a]", "", part)) >= 2 and part not in found:
                    found.append(part)
    return found


def split_note(raw):
    """'Timing: alternative timing ...' -> topic 'Timing', text '...'."""
    m = re.match(r"^([A-Za-z /,]+?)\s*:\s*(.*)$", raw)
    if m and len(m.group(1)) < 60:
        return clean(m.group(1)), clean(m.group(2))
    return "", clean(raw)


TIMING_TOKEN_RE = re.compile(r"^[()0-9SQa&.\-–]+$")


def split_timing(raw):
    """Separate the timing expression from free text that follows it.

    The PDF sometimes continues a paragraph right after "Timing: ...", e.g.
    "2 3 4&1 When in R or L Side Same Pos. ...". We keep timing tokens and any
    parenthesised remark directly attached to them (e.g. "(12&3 Lady)").
    """
    toks = raw.split()
    kept, depth = [], 0
    for i, tok in enumerate(toks):
        depth_before = depth
        depth += tok.count("(") - tok.count(")")
        if depth_before > 0 or TIMING_TOKEN_RE.match(tok) or tok.startswith("(") or tok == "or":
            kept.append(tok)
        else:
            return " ".join(kept), " ".join(toks[i:])
    return " ".join(kept), ""


def main():
    lines = SRC.read_text(encoding="utf-8").splitlines()
    # Skip the table of contents: real content starts at "1 Introduction".
    start = next(i for i, l in enumerate(lines) if l.strip() == "1 Introduction")
    lines = lines[start:]

    result = {d: {"intro": "", "figures": []} for d in SECTIONS.values()}
    dance = None
    fig = None
    field = None  # name of the field receiving continuation lines
    intro_lines = []

    def flush_note():
        pass

    for line in lines:
        if PAGE_NO_RE.match(line) or not line.strip():
            continue
        m = DANCE_RE.match(line.strip())
        if m and m.group(1) in SECTIONS:
            if dance and intro_lines:
                result[dance]["intro"] = "\n".join(intro_lines)
            dance = SECTIONS[m.group(1)]
            fig, field, intro_lines = None, None, []
            continue
        if dance is None:
            continue
        m = FIG_RE.match(line)
        if m and SECTIONS.get(m.group(1)) == dance:
            if intro_lines and not result[dance]["intro"]:
                result[dance]["intro"] = "\n".join(intro_lines)
            fig = {
                "num": int(m.group(2)),
                "suffix": m.group(3),
                "title": clean(m.group(4)),
                "start": "",
                "finish": "",
                "timing": "",
                "notes": [],
            }
            result[dance]["figures"].append(fig)
            field = None
            continue
        if fig is None:
            intro_lines.append(line.strip())
            continue
        m = FIELD_RE.match(line)
        if m:
            field = m.group(1).lower()
            fig[field] = clean(m.group(2))
            continue
        m = NOTE_RE.match(line)
        if m:
            fig["notes"].append({"raw": m.group(1)})
            field = "note"
            continue
        # Continuation of the previous field / note.
        if (field is None and line.strip().isupper() and "extra" not in fig
                and not re.match(r"\s*\d", line)):
            # Wrapped figure title (all caps, before any Start/Finish field).
            fig["title"] = clean(fig["title"] + " " + line)
        elif field == "note":
            fig["notes"][-1]["raw"] += " " + line.strip()
        elif field in ("start", "finish", "timing"):
            fig[field] = clean(fig[field] + " " + line)
        else:
            fig.setdefault("extra", "")
            fig["extra"] = clean(fig["extra"] + " " + line)

    for data in result.values():
        for f in data["figures"]:
            f["timing"], rest = split_timing(f["timing"])
            if rest:
                f["extra"] = clean(rest + " " + f.get("extra", ""))
            notes = []
            for n in f["notes"]:
                topic, text = split_note(n["raw"])
                notes.append({"topic": topic, "text": text})
            f["notes"] = notes
            f["altTimings"] = extract_alt_timings(notes)

    OUT.write_text(json.dumps(result, ensure_ascii=False, indent=1), encoding="utf-8")
    for d, data in result.items():
        figs = data["figures"]
        no_timing = [f["num"] for f in figs if not f["timing"]]
        print(f"{d:10s} {len(figs):3d} figures; without timing: {no_timing}")


if __name__ == "__main__":
    main()
