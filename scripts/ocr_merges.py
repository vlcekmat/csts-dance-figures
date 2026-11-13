"""Which table cells of the technique books span several rows (vertically merged).

The OCR (scripts/ocr_technique.py) repeats a merged cell's text in every row it spans,
so "1/4 R" written once over steps 4-6 looked like 1/4 R on each step. This script
finds the table grid again (no OCR, fast) and stores for every table in
data/build/ocr/<Book>.json a matrix `cont`: cont[row][col] = True when the cell of that
data row continues the cell above.

Usage: python3 -I scripts/ocr_merges.py Waltz Tango ...   (then parse_technique.py)
"""
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))
from ocr_technique import OCR_DIR, find_tables, line_present  # noqa: E402


def page_merges(path):
    arr = np.array(Image.open(path).convert("L"))
    dark = arr < 200
    out = []
    for t in find_tables(dark):
        hl, vl = t["h"], t["v"]
        ncol = len(vl) - 1
        rows = []
        for r in range(1, len(hl) - 1):  # data rows (row 0 = header)
            row = []
            for c in range(ncol):
                x0, x1 = vl[c][1] + 1, vl[c + 1][0] - 1
                row.append(r > 1 and not line_present(dark, hl[r][0], hl[r][1], x0, x1))
            rows.append(row)
        out.append(rows)
    return out


def main():
    for book in sys.argv[1:]:
        path = OCR_DIR / f"{book}.json"
        tables = json.loads(path.read_text(encoding="utf-8"))
        by_page = {}
        for t in tables:
            if t.get("title") == "NOTES" or "rows" not in t:
                continue
            by_page.setdefault(t["page"], []).append(t)
        done = 0
        for page, ts in by_page.items():
            img = OCR_DIR / book / f"p-{page - 1:03d}.png"
            if not img.exists():
                continue
            merges = page_merges(img)
            for t, m in zip(ts, merges):
                if len(m) == len(t["rows"]):
                    t["cont"] = m
                    done += 1
        path.write_text(json.dumps(tables, ensure_ascii=False, indent=1), encoding="utf-8")
        print(book, done, "tables with merge info")


if __name__ == "__main__":
    main()
