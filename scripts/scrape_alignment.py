"""Scrape step charts (alignment, amount of turn) from dancecentral.info.

dancecentral.info publishes ISTD-based step charts for International Style
figures: per step the foot/direction, alignment (e.g. "BDW", "FLOD"), footwork,
amount of turn and rise & fall, plus preceding / following figures.

We keep only the structured facts needed for floor diagrams and links:
  - leader steps: description (foot + direction), alignment, amount of turn
  - preceding / following figure names
  - page URL (the app links to the source for the full description)

Output: data/alignment.json {slug: {...}}. Resumable; use --force to refresh.
"""

import html
import json
import re
import sys
import time
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "data" / "alignment.json"
BASE = "https://www.dancecentral.info"
DANCES = {
    "waltz": "waltz", "tango": "tango", "viennese-waltz": "viennese", "slow-foxtrot": "slowfox",
    "quickstep": "quickstep", "samba": "samba", "cha-cha-cha": "chacha", "rumba": "rumba",
    "paso-doble": "paso", "jive": "jive",
}
# Index pages that are not figures.
SKIP_SUFFIXES = ("technique", "choreography", "exercises")
HEADERS = {"User-Agent": "Mozilla/5.0 (CSTS figure catalog; personal study tool)"}


def fetch(url):
    req = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.read().decode("utf-8", "replace")


def page_text(h):
    t = re.sub(r"<script.*?</script>|<style.*?</style>", "", h, flags=re.S)
    t = re.sub(r"<br\s*/?>", "\n", t)
    t = re.sub(r"</(p|div|li|h\d|tr)>", "\n", t)
    t = html.unescape(re.sub(r"<[^>]+>", "", t))
    return [l.strip() for l in t.splitlines() if l.strip()]


# Standard charts: "Count 1: RF back | BDW | TH | ...". Latin: "4 & 1: LF to side | 1/8 to L".
# Jive / Samba also use S / Q counts ("Q: Close LF to RF | 1/8 to L").
COUNT_RE = re.compile(r"^(?:Count|Step)?\s*([0-9SQ][0-9SQ&a ,.\-]{0,11}|[&a]):\s*(.+)$")


def parse_chart(lines):
    """Leader / follower step rows and preceding / following figure lists."""
    # The site navigation also contains words like "Leader"; the chart starts at
    # the first "Leader" that is directly followed by a Count/Step row.
    # Headers vary: "Leader", "Man", "Leader or Follower"; a few intro lines may
    # come before the first step row.
    start = next(
        (
            i
            for i, l in enumerate(lines[:-3])
            if l in ("Leader", "Man", "Leader or Follower") and any(COUNT_RE.match(x) for x in lines[i + 1:i + 7])
        ),
        None,
    )
    if start is None:
        return None
    out = {"leader": [], "follower": [], "preceding": [], "following": []}
    section = "leader"
    for l in lines[start + 1:]:
        if l in ("Follower", "Lady", "Woman"):
            section = "follower" if not out["follower"] else None
            continue
        if l.startswith(("Leader (", "Follower (", "Variations")):
            # Alternative (silver/gold) versions: keep only the basic chart.
            section = None
            continue
        if l.startswith("Technique Notes"):
            section = None
            continue
        if l == "Preceding Figures":
            section = "preceding"
            continue
        if l == "Following Figures":
            section = "following"
            continue
        if l.startswith("©") or l.startswith("Report abuse"):
            break
        m = COUNT_RE.match(l)
        if section in ("leader", "follower") and m:
            cols = [c.strip() for c in m.group(2).split("|")]
            out[section].append({"count": m.group(1).strip(), "cols": cols})
        elif section in ("preceding", "following") and not l.startswith("("):
            if len(l) < 60:
                out[section].append(l)
    return out


def main():
    force = "--force" in sys.argv
    data = {} if force or not OUT.exists() else json.loads(OUT.read_text(encoding="utf-8"))
    nav = fetch(f"{BASE}/ballroom/international-style/waltz")
    links = sorted(set(re.findall(r'href="(/ballroom/international-style/([a-z-]+)/([a-z0-9-]+))"', nav)))
    todo = [(path, d, slug) for path, d, slug in links if d in DANCES and not slug.endswith(SKIP_SUFFIXES)]
    print(f"{len(todo)} figure pages", flush=True)
    for i, (path, d, slug) in enumerate(todo, 1):
        key = f"{DANCES[d]}/{slug}"
        if key in data and data[key].get("leader"):
            continue
        try:
            h = fetch(BASE + path)
        except Exception as exc:
            print(f"[{i}] {key}: ERROR {exc}", flush=True)
            continue
        lines = page_text(h)
        title_m = re.search(r"<title>(.*?)</title>", h, re.S)
        title = html.unescape(title_m.group(1)).replace("Dance Central - ", "").strip() if title_m else slug
        chart = parse_chart(lines)
        data[key] = {"dance": DANCES[d], "slug": slug, "title": title, "url": BASE + path, **(chart or {})}
        n = len(chart["leader"]) if chart else 0
        print(f"[{i}/{len(todo)}] {key}: {title} ({n} leader steps)", flush=True)
        if i % 10 == 0:
            OUT.write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding="utf-8")
        time.sleep(1.0)
    OUT.write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding="utf-8")
    print("done", flush=True)


if __name__ == "__main__":
    main()
