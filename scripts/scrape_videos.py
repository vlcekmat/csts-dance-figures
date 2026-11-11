"""Find example YouTube videos for every catalog figure.

For each figure we run a YouTube search ("<dance> <figure name>") by fetching
the public results page and reading the embedded `ytInitialData` JSON. The
candidates are ranked by how well their title matches the figure / dance and
by a small bonus for channels known to publish WDSF syllabus material.

Output: data/videos.json  {figure_id: [{id, title, channel, length}, ...]}
The script is resumable: figures already present in the output are skipped
(use --force to refresh everything).
"""

import json
import random
import re
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CATALOG = ROOT / "data" / "build" / "catalog.json"
OUT = ROOT / "data" / "videos.json"

DANCE_QUERY = {
    "waltz": "slow waltz",
    "tango": "ballroom tango",
    "viennese": "viennese waltz",
    "slowfox": "slow foxtrot",
    "quickstep": "quickstep",
    "samba": "samba",
    "chacha": "cha cha",
    "rumba": "rumba",
    "paso": "paso doble",
    "jive": "jive",
    "polka": "polka",
}
DANCE_WORDS = {
    "waltz": ["waltz"], "tango": ["tango"], "viennese": ["viennese"],
    "slowfox": ["foxtrot", "slowfox", "slow fox", "foxtrott"], "quickstep": ["quickstep"],
    "samba": ["samba"], "chacha": ["cha", "chacha"], "rumba": ["rumba"],
    "paso": ["paso"], "jive": ["jive"], "polka": ["polka"],
}
# Channels with systematic syllabus / technique videos get a ranking bonus.
TRUSTED_CHANNELS = {"thewdsfacademy": 3, "mania wdsf": 3, "dance vids": 1}
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
                  "(KHTML, like Gecko) Chrome/130.0 Safari/537.36",
    "Accept-Language": "en-US,en;q=0.9",
}
STOPWORDS = {"to", "the", "and", "of", "from", "in", "on", "a", "with", "see", "r", "l"}


def search(query):
    url = "https://www.youtube.com/results?" + urllib.parse.urlencode({"search_query": query})
    req = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(req, timeout=30) as resp:
        html = resp.read().decode("utf-8", "replace")
    m = re.search(r"var ytInitialData = (\{.*?\});</script>", html)
    if not m:
        return []
    data = json.loads(m.group(1))
    found = []

    def walk(node):
        if isinstance(node, dict):
            vr = node.get("videoRenderer")
            if vr and "videoId" in vr:
                found.append({
                    "id": vr["videoId"],
                    "title": "".join(r.get("text", "") for r in vr.get("title", {}).get("runs", [])),
                    "channel": (vr.get("ownerText", {}).get("runs") or [{}])[0].get("text", ""),
                    "length": vr.get("lengthText", {}).get("simpleText", ""),
                })
            for v in node.values():
                walk(v)
        elif isinstance(node, list):
            for v in node:
                walk(v)

    walk(data)
    return found


def figure_words(name):
    name = re.sub(r"\(.*?\)", " ", name.lower())
    return [w for w in re.findall(r"[a-z0-9]+", name) if w not in STOPWORDS]


def score(video, dance, words):
    title = video["title"].lower()
    s = sum(1.0 for w in words if w in title) / max(len(words), 1) * 4
    if any(w in title for w in DANCE_WORDS[dance]):
        s += 1.5
    s += TRUSTED_CHANNELS.get(video["channel"].lower(), 0)
    # Very long videos are usually full lessons / competitions, not a figure demo.
    parts = [int(p) for p in video["length"].split(":") if p.isdigit()]
    seconds = sum(p * 60 ** i for i, p in enumerate(reversed(parts))) if parts else 0
    if seconds > 20 * 60 or seconds == 0:
        s -= 2
    return s


def main():
    catalog = json.loads(CATALOG.read_text(encoding="utf-8"))
    force = "--force" in sys.argv
    results = {} if force or not OUT.exists() else json.loads(OUT.read_text(encoding="utf-8"))

    todo = []
    for dance, figs in catalog.items():
        for f in figs:
            fid = f"{dance}-{f['no']}"
            if fid not in results:
                todo.append((fid, dance, f))

    print(f"{len(todo)} figures to search", flush=True)
    for i, (fid, dance, f) in enumerate(todo, 1):
        name = f["en"] or f["cs"]
        name = re.sub(r"\(see .*?\)", "", name, flags=re.I).strip()
        query = f"{DANCE_QUERY[dance]} {name}" + (" ČSTS" if dance == "polka" else "")
        try:
            videos = search(query)
        except Exception as exc:  # network hiccup: keep going, retry on next run
            print(f"[{i}/{len(todo)}] {fid}: ERROR {exc}", flush=True)
            time.sleep(5)
            continue
        words = figure_words(name)
        ranked = sorted(videos[:15], key=lambda v: -score(v, dance, words))
        results[fid] = [dict(v, query=query) for v in ranked[:3]]
        best = ranked[0]["title"] if ranked else "-"
        print(f"[{i}/{len(todo)}] {fid}: {best}", flush=True)
        if i % 10 == 0:
            OUT.write_text(json.dumps(results, ensure_ascii=False, indent=1), encoding="utf-8")
        time.sleep(1.0 + random.random())

    OUT.write_text(json.dumps(results, ensure_ascii=False, indent=1), encoding="utf-8")
    print("done", flush=True)


if __name__ == "__main__":
    main()
