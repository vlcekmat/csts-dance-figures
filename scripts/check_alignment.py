"""Consistency check of WDSF chart alignments: the facing of each step must
follow from the previous one plus the stated amount of turn.

Usage: python3 -I scripts/check_alignment.py [dance ...]   (reads the local src/data/technique.local.json)
Prints suspicious steps (usually OCR slips) for manual correction in
data/technique_fixes.json.
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BASE = {"LOD": 0, "DW": -45, "W": -90, "DC": 45, "C": 90}


def angle(text):
    """Facing angle of an alignment text (0 = LOD, + = towards centre), or None."""
    t = re.split(r"[,(]|\bbody\b|\bend\b|\bthen\b|\bnext\b", text, flags=re.I)[0]
    t = re.sub(r"\b(almost|nearly|slightly|of new LOD|new)\b", "", t, flags=re.I).upper()
    t = t.replace("DIAG", "D").replace("CENTRE", "C").replace("WALL", "W")
    m = re.search(r"\b(FACING|BACKING|POINTING|DOWN)?\s*(LOD|DW|DC|W|C)\b(\s+AGAINST\s+LOD)?", t)
    if not m:
        return None
    a = BASE[m.group(2)]
    if m.group(3):
        a = 180 if m.group(2) == "LOD" else (180 - a if a > 0 else -180 - a)
    if m.group(1) == "BACKING":
        a += 180
    return ((a + 180) % 360) - 180


def turns(text):
    """Signed sum of fractions in a turn cell ("3/8 to R between 1 and 2 then 1/2 to R on 3")."""
    total = 0.0
    for m in re.finditer(r"(\d)\s*/\s*(\d)\s*(?:to\s*)?([LR])?", text):
        frac = int(m.group(1)) / int(m.group(2)) * 360
        side = m.group(3) or ("R" if re.search(r"\bR\b|right", text) else "L" if re.search(r"\bL\b|left", text) else None)
        if side is None:
            return None
        total += frac if side == "L" else -frac
    return total


def norm(a):
    return ((a + 180) % 360) - 180


def check_total(fig, role, steps):
    """Start and end alignment must differ by the figure's total amount of turn."""
    angles = [angle(st.get("align", "")) for st in steps]
    known = [(i, a) for i, a in enumerate(angles) if a is not None]
    if len(known) < 2:
        return 0
    total = 0.0
    for st in steps[known[0][0] + 1:]:
        t = turns(st.get("turn", ""))
        if t is None:
            return 0
        total += t
    # a pivot "on" the first step happens after its alignment
    first_turn = steps[known[0][0]].get("turn", "")
    if re.search(r"\bon\s*" + str(known[0][0] + 1) + r"\b", first_turn):
        total += turns(first_turn) or 0
    diff = norm(known[-1][1] - known[0][1] - total)
    if abs(diff) > 30:
        print(f"{fig['id']} {fig['en']} ({role}, p. {fig['floor'].get('page')}): start {steps[known[0][0]]['align']!r}, "
              f"end {steps[known[-1][0]]['align']!r}, turns sum {total:+.0f}° -> off by {diff:+.0f}°")
        return 1
    return 0


def check(fig, role, steps):
    issues = []
    prev = None
    for i, st in enumerate(steps):
        a = angle(st.get("align", ""))  # normalised by build_data.py
        if a is None:
            if st.get("align"):
                issues.append(f"  step {i+1}: unparsed alignment {st['align']!r}")
            continue
        if prev is not None:
            t = turns(st.get("turn", ""))
            if t is not None:
                diff = norm(a - (prev + t))
                if abs(diff) > 30:
                    issues.append(
                        f"  step {i+1}: {st['align']!r} after {steps[i-1]['align']!r}, turn {st['turn']!r} -> off by {diff:+.0f}°")
        prev = a
    if issues:
        print(f"{fig['id']} {fig['en']} ({role}, p. {fig['floor'].get('page')})")
        print("\n".join(issues))
    return len(issues)


def main():
    dances = [a for a in sys.argv[1:] if not a.startswith("--")] or ["waltz", "tango", "viennese", "quickstep"]
    figs = json.loads((ROOT / "src" / "data" / "figures.json").read_text())["figures"]
    book = json.loads((ROOT / "src" / "data" / "technique.local.json").read_text())
    for f in figs:
        if f["id"] in book:
            f["floor"] = book[f["id"]]
    n = 0
    for f in figs:
        fl = f.get("floor") or {}
        if f["dance"] not in dances or fl.get("source") != "wdsf":
            continue
        if "--steps" in sys.argv:
            n += check(f, "man", fl["steps"])
            n += check(f, "lady", fl.get("ladySteps", []))
        else:
            n += check_total(f, "man", fl["steps"])
            n += check_total(f, "lady", fl.get("ladySteps", []))
    print(f"{n} suspicious steps")


if __name__ == "__main__":
    main()
