"""OCR of the WDSF technique books (image-only scans) into table cells.

The books are scans of Word tables. Instead of OCR-ing whole pages (columns get
mixed up), we find the table grid lines and OCR every cell separately.

Input:  page images extracted with `pdfimages -png` into data/build/ocr/<Book>/p-NNN.png
Output: data/build/ocr/<Book>.json  – [{page, title, header, rows: [[cell, ...]]}]

Usage:  python3 -I scripts/ocr_technique.py Waltz Tango ...
Requires tesseract, Pillow and numpy.
"""
import json
import re
import os
import subprocess
import sys
import tempfile
from concurrent.futures import ProcessPoolExecutor
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
OCR_DIR = ROOT / "data" / "build" / "ocr"
# Columns we don't need (saves most of the OCR time).
SKIP = re.compile(r"rotation|rise|sway|extension|hip|translation|squeeze|foot action|general action", re.I)


def ocr(img: Image.Image, psm: int = 6, thr: int = 165) -> str:
    """OCR a small image (upscaled and binarised) with tesseract."""
    if img.width < 4 or img.height < 4:
        return ""
    g = img.convert("L")
    g = g.resize((g.width * 2, g.height * 2), Image.LANCZOS)
    g = g.point(lambda v: 255 if v > thr else 0)
    # White border helps tesseract with text touching the crop edge.
    canvas = Image.new("L", (g.width + 40, g.height + 40), 255)
    canvas.paste(g, (20, 20))
    with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as f:
        path = f.name
    try:
        canvas.save(path)
        out = subprocess.run(
            ["tesseract", path, "-", "--psm", str(psm)],
            capture_output=True, text=True, check=False,
        ).stdout
    finally:
        os.unlink(path)
    return " ".join(line.strip() for line in out.splitlines() if line.strip())


def longest_run(row: np.ndarray) -> int:
    """Longest run of True values (vectorised)."""
    if not row.any():
        return 0
    d = np.diff(np.concatenate(([0], row.astype(np.int8), [0])))
    starts, ends = np.where(d == 1)[0], np.where(d == -1)[0]
    return int((ends - starts).max())


def runs(mask_row: np.ndarray) -> int:
    """Longest run of True values in a 1-D boolean array."""
    best = cur = 0
    for v in mask_row:
        cur = cur + 1 if v else 0
        if cur > best:
            best = cur
    return best


def group(idx, gap=4):
    """Group nearby indices (a line is several pixels thick) into their centres."""
    out = []
    for i in idx:
        if out and i - out[-1][-1] <= gap:
            out[-1].append(i)
        else:
            out.append([i])
    return [(g[0], g[-1]) for g in out]


def smear(mask: np.ndarray, k: int, axis: int) -> np.ndarray:
    """OR of k neighbouring rows (axis=0) or columns (axis=1): scans are slightly skewed."""
    out = mask.copy()
    for i in range(1, k):
        if axis == 0:
            out[:-i] |= mask[i:]
        else:
            out[:, :-i] |= mask[:, i:]
    return out


def vertical_lines(dark: np.ndarray, y0: int, y1: int) -> list:
    """Columns that are dark over (almost) the whole band y0..y1."""
    band = smear(dark[y0:y1], 5, 1)
    if band.shape[0] < 5:
        return []
    fill = band.sum(axis=0) / band.shape[0]
    return group([x for x in range(dark.shape[1]) if fill[x] > 0.9], gap=6)


def find_tables(dark: np.ndarray):
    h, w = dark.shape
    sm = smear(dark, 5, 0)
    fill = sm.sum(axis=1)
    cand = [y for y in range(h) if fill[y] > w * 0.15 and longest_run(sm[y]) > 150]
    hlines = []
    for a, b in group(cand, gap=6):
        if b - a > 14:
            # a dark (coloured) header band: its top and bottom edges are the lines
            hlines += [(a, a + 2), (b - 2, b)]
        else:
            hlines.append((a, b))
    tables = []
    cur = []
    for ln in hlines:
        if cur:
            # same table if vertical borders connect the previous line with this one
            v = vertical_lines(dark, cur[-1][1] + 3, ln[0] - 1)
            if len(v) < 3:
                tables.append(cur)
                cur = []
        cur.append(ln)
    if cur:
        tables.append(cur)
    result = []
    for t in tables:
        if len(t) < 3:
            continue
        top, bottom = t[0][0], t[-1][1]
        # columns: borders present in every row band
        vsets = [vertical_lines(dark, t[i][1] + 3, t[i + 1][0] - 1) for i in range(len(t) - 1)]
        # Columns from the table body: coloured (dark) header cells hide their borders.
        # (first data row only: tall tables are slightly skewed in the scan)
        vcols = vertical_lines(dark, t[1][1] + 3, t[2][0] - 1)
        if len(vcols) < 3:
            continue
        result.append({"h": t, "v": vcols, "top": top, "bottom": bottom,
                       "left": vcols[0][0], "right": vcols[-1][1]})
    return result


def line_present(dark, y0, y1, x0, x1) -> bool:
    """Is there a horizontal border between x0 and x1 at rows y0..y1?"""
    seg = dark[max(0, y0 - 2):y1 + 3, x0 + 6:x1 - 6]
    if seg.size == 0:
        return True
    return (seg.any(axis=0).sum() / seg.shape[1]) > 0.7


def process_page(args):
    """OCR one page, cached next to the image (p-NNN.json) so reruns resume."""
    book, path = args
    cache = Path(path).with_suffix(".json")
    if cache.exists():
        return book, json.loads(cache.read_text())
    try:
        out = _process_page(path)
    except Exception as e:  # a broken page must not lose the whole book
        print(f"{path}: {e}", file=sys.stderr)
        out = []
    cache.write_text(json.dumps(out, ensure_ascii=False))
    return book, out


def _process_page(path):
    img = Image.open(path).convert("L")
    arr = np.array(img)
    dark = arr < 200
    out = []
    for t in find_tables(dark):
        hl, vl = t["h"], t["v"]
        title = ocr(img.crop((t["left"], max(0, t["top"] - 55), t["right"], t["top"] - 4)), psm=7, thr=90)
        ncol = len(vl) - 1
        grid = []
        # merged[c] = index of the row where the current (vertically merged) cell began
        for r in range(len(hl) - 1):
            y0, y1 = hl[r][1] + 1, hl[r + 1][0] - 1
            row = []
            for c in range(ncol):
                x0, x1 = vl[c][1] + 1, vl[c + 1][0] - 1
                if r > 0 and not line_present(dark, hl[r][0], hl[r][1], x0, x1):
                    row.append(None)  # continues the cell above
                else:
                    row.append((x0, y0, x1, y1))
            grid.append(row)
        # extend merged cells downwards and OCR each once
        cells = [[None] * ncol for _ in grid]
        header = []
        for c in range(ncol):
            x0, y0, x1, y1 = grid[0][c]
            header.append(ocr(img.crop((x0 + 3, y0 + 3, x1 - 3, y1 - 3))))
        for c in range(ncol):
            if SKIP.search(header[c]):
                for row in cells:
                    row[c] = ""
                continue
            r = 0
            while r < len(grid):
                box = grid[r][c]
                if box is None:
                    r += 1
                    continue
                end = r
                while end + 1 < len(grid) and grid[end + 1][c] is None:
                    end += 1
                x0, y0, x1, _ = box
                y1 = hl[end + 1][0] - 1
                text = ocr(img.crop((x0 + 3, y0 + 3, x1 - 3, y1 - 3))) if x1 - x0 > 10 and y1 - y0 > 10 else ""
                for k in range(r, end + 1):
                    cells[k][c] = text
                r = end + 1
        out.append({
            "page": int(Path(path).stem.split("-")[-1]) + 1,
            "title": title,
            "header": header,
            "rows": cells[1:],
        })
    # Notes ("NOTE - General: ...") printed below the last table.
    if out:
        last_bottom = max(t["bottom"] for t in find_tables(dark))
        if arr.shape[0] - 160 - last_bottom > 20:
            text = ocr(img.crop((60, last_bottom + 4, arr.shape[1] - 60, arr.shape[0] - 160)), psm=4)
            if text:
                out.append({"page": out[0]["page"], "title": "NOTES", "text": text})
    return out


def main():
    books = sys.argv[1:]
    jobs = []
    for b in books:
        for p in sorted((OCR_DIR / b).glob("p-*.png")):
            jobs.append((b, str(p)))
    results = {b: [] for b in books}
    with ProcessPoolExecutor(max_workers=os.cpu_count()) as ex:
        for i, (book, tables) in enumerate(ex.map(process_page, jobs, chunksize=2)):
            results[book].extend(tables)
            if i % 50 == 0:
                print(f"{i}/{len(jobs)}", flush=True)
    for b, tables in results.items():
        tables.sort(key=lambda t: t["page"])
        (OCR_DIR / f"{b}.json").write_text(json.dumps(tables, ensure_ascii=False, indent=1))
        print(b, len(tables), "tables")


if __name__ == "__main__":
    main()
