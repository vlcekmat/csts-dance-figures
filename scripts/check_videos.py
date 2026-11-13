"""Strict check of the example videos (data/videos.json) and a new search for figures
without a good one.

A video is kept only when its title
  * is about the right dance (and not another one, e.g. viennese vs slow waltz),
  * names the whole figure (its English name or a known alias; all key words),
  * doesn't name the opposite variant (natural <-> reverse, to R <-> to L, RF <-> LF),
  * isn't a routine / competition / full lesson (very long videos, "routine", "final" …).

Usage:
  python3 -I scripts/check_videos.py            # report only
  python3 -I scripts/check_videos.py --fix      # drop bad videos, search again where needed
Then: python3 -I scripts/build_data.py
"""
import json
import random
import re
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from scrape_videos import DANCE_QUERY, TRUSTED_CHANNELS, search  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
VIDEOS = ROOT / "data" / "videos.json"
FIGURES = ROOT / "src" / "data" / "figures.json"

DANCE_RE = {
    "waltz": r"(?<![a-z])waltz|(?<![a-z])vals\b|(?<![a-z])walc",
    "tango": r"(?<![a-z])tango",
    "viennese": r"viennese|wiener|vídeňsk|vienna",
    "slowfox": r"fox ?trot|slow ?fox|foxtrott",
    "quickstep": r"quick ?step",
    "samba": r"(?<![a-z])samba",
    "chacha": r"cha[ -]?cha",
    "rumba": r"(?<![a-z])rumba",
    "paso": r"paso",
    "jive": r"(?<![a-z])jive",
    "polka": r"(?<![a-z])polka",
}
# Another dance named instead: wrong video (e.g. "Viennese Waltz" for slow waltz).
OTHER = {
    "waltz": r"viennese|wiener|vienna",
    "tango": r"argentin",
}
STOP = {"to", "the", "and", "of", "from", "in", "on", "a", "with", "see", "into", "or", "for", "by", "s", "istd",
        "method", "alternative", "ending", "tsp", "specific", "principles"}
BAD_TITLE = re.compile(
    r"routine|choreograph|competition|championship|\bfinal\b|semi ?final|\bheat\b|\bround\b|show ?dance|"
    r"wedding|first dance|full lesson|\bclass\b.*\b(level|week)|medley|compilation|\bshorts?\b.*\bvs\b",
    re.I,
)
QUALIFIERS = {"inverted", "double", "overturned", "syncopated", "open", "closed", "hover", "running", "continuous",
              "curved", "fallaway", "progressive", "natural", "reverse", "outside", "quick", "travelling", "stationary",
              "alternative", "advanced", "contra", "rising", "turning", "same", "foot", "shadow", "three", "triple",
              "promenade", "back", "forward", "split", "spiral", "hip", "sliding", "drop", "telemark", "impetus"}
SYN = [
    (r"\bto the\b", "to"), (r"\bturning to\b", "turning"),
    (r"chass[ée]", "chasse"), (r"\bpp\b", "promenade"), (r"\bprom\b", "promenade"), (r"\bright\b", "r"),
    (r"\bleft\b", "l"), (r"\brt\b", "r"), (r"\blt\b", "l"), (r"\bcorté\b", "corte"), (r"\bfwd\b", "forward"),
    (r"\bback ?ward\b", "back"), (r"\bbwd\b", "back"), (r"\bcha[ -]?cha[ -]?cha\b", "chacha"),
    (r"\bnew ?yorks?\b", "newyork"), (r"\bfour ?step\b", "fourstep"), (r"\bthree ?step\b", "threestep"),
    (r"\btele ?mark\b", "telemark"), (r"\bfeather ?step\b", "feather"), (r"\bspot ?turn\b", "spotturn"),
    (r"\bunder ?arm\b", "underarm"), (r"\bhip ?twist\b", "hiptwist"), (r"\bhockey ?stick\b", "hockeystick"),
]


def norm(text):
    t = text.lower().replace("’", "'").replace("-", " ")
    for a, b in SYN:
        t = re.sub(a, b, t)
    return t


def words(name):
    name = re.sub(r"\(.*?\)", " ", name or "")
    # direction tokens may be left out of a title (the opposite one is checked separately)
    return [w for w in re.findall(r"[a-z0-9]+", norm(name)) if w not in STOP and w not in {"r", "l", "rf", "lf"} and not w.isdigit()]


def has(word, title_words):
    # prefix match tolerates plurals ("turns", "changes")
    return any(t == word or (len(word) > 3 and t.startswith(word)) for t in title_words)


def standalone(own, tw):
    """The figure's own name appears on its own (not "Open Telemark", "Telemark to PP")."""
    n = len(own)
    for k in range(len(tw) - n + 1):
        if all(has(w, [tw[k + j]]) for j, w in enumerate(own)):
            before = tw[k - 1] if k > 0 else ""
            after = tw[k + n] if k + n < len(tw) else ""
            if before not in QUALIFIERS and after not in ("to", "from", "with"):
                return True
    return False


def seconds(length):
    parts = [int(p) for p in (length or "").split(":") if p.isdigit()]
    return sum(p * 60 ** i for i, p in enumerate(reversed(parts))) if parts else 0


def check(video, fig):
    """(ok, reason, match quality 0–1)."""
    title = norm(video["title"])
    channel = video.get("channel", "").lower()
    tw = re.findall(r"[a-z0-9]+", title)
    dance = fig["dance"]
    if not re.search(DANCE_RE[dance], title) and not re.search(DANCE_RE[dance], channel):
        # WDSF Academy titles name only the figure: fine when no other dance has it
        if not ("wdsf academy" in title or "wdsfacademy" in channel.replace(" ", "")) or not UNIQUE.get(fig["id"], False):
            return False, "dance not named", 0
    if dance in OTHER and re.search(OTHER[dance], title):
        return False, "other dance", 0
    if BAD_TITLE.search(video["title"]):
        return False, "routine/competition", 0
    sec = seconds(video.get("length", ""))
    if sec > 12 * 60:
        return False, "too long", 0
    names = [fig.get("en") or ""] + list((fig.get("aliases") or {}).get("en", []))
    best = 0.0
    for nm in names:
        ws = words(nm)
        if not ws:
            continue
        # "forward" is often left out ("Change Step Natural to Reverse")
        ws = [w for w in ws if w not in ("forward", "lady") or has(w, tw)] or ws
        cov = sum(1 for w in ws if has(w, tw)) / len(ws)
        best = max(best, cov)
    if best < 0.999:
        return False, f"figure not named ({best:.2f})", best
    # A different figure with an extra qualifier ("Inverted Reverse Pivot", "Double Chase",
    # "Overturned Spin Turn" for Reverse Pivot / Chase / Spin Turn).
    name_words = set(re.findall(r"[a-z0-9]+", norm(" ".join(names))))
    first = words(fig.get("en") or "")[:1]
    if first:
        occ = [k for k, t in enumerate(tw) if t == first[0]]
        qual = [tw[k - 1] for k in occ if k > 0 and tw[k - 1] in QUALIFIERS and tw[k - 1] not in name_words]
        if occ and len(qual) == len(occ):  # every mention is of the other variant
            return False, f"other variant ({qual[0]})", best
    en = norm(fig.get("en") or "")
    # opposite variants named in the title but not in the figure name
    for a, b in (("natural", "reverse"), ("reverse", "natural")):
        if re.search(rf"\b{a}\b", en) and re.search(rf"\b{b}\b", title) and not re.search(rf"\b{a}\b", title):
            return False, f"{b} instead of {a}", best
    for a, b in ((r"\bto r\b", r"\bto l\b"), (r"\bto l\b", r"\bto r\b"), (r"\bturning r\b", r"\b(?:to|turning) l\b"), (r"\bturning l\b", r"\b(?:to|turning) r\b")):
        if re.search(a, en) and re.search(b, title) and not re.search(a, title):
            return False, "other direction", best
    for a, b in ((r"\bl side\b", r"\br side\b"), (r"\br side\b", r"\bl side\b")):
        if re.search(a, en) and re.search(b, title) and not re.search(a, title):
            return False, "other side", best
    # a longer figure of the same dance named in the title ("Telemark to PP" for Telemark)
    own = words(fig.get("en") or "")
    for other in LONGER.get(fig["id"], []):
        if all(has(w, tw) for w in other) and not standalone(own, tw):
            return False, "longer figure: " + " ".join(other), best
    # the catalog has the same figure in the other direction: the title must say which
    if TWIN.get(fig["id"]):
        own_dir = re.search(r"\b(?:to|turning|on) ([rl])\b", en)
        if own_dir and not re.search(rf"\b(?:to|turning|on) {own_dir.group(1)}\b|\b{own_dir.group(1)} side\b", title):
            return False, "direction not named", best
    m = re.search(r"\bfrom ([rl]) to ([rl])\b", en)
    if m and re.search(rf"\b{m.group(2)} to {m.group(1)}\b", title) and not re.search(rf"\b{m.group(1)} to {m.group(2)}\b", title):
        return False, "other direction", best
    for a, b in (("rf", "lf"), ("lf", "rf")):
        if re.search(rf"\bon {a}\b|\b{a}\b", en) and re.search(rf"\b{b}\b", title) and not re.search(rf"\b{a}\b", title):
            return False, f"{b} instead of {a}", best
    return True, "ok", best


def rank(video, quality):
    s = quality * 4 + TRUSTED_CHANNELS.get(video.get("channel", "").lower(), 0)
    sec = seconds(video.get("length", ""))
    if 0 < sec <= 5 * 60:
        s += 1  # a short figure demo
    # titles naming many figures are less specific
    s -= 0.3 * max(0, len(re.findall(r",|\+|&|\band\b", video["title"])) - 1)
    return s


UNIQUE = {}
LONGER = {}
TWIN = {}


def main():
    fix = "--fix" in sys.argv
    figs = {f["id"]: f for f in json.loads(FIGURES.read_text(encoding="utf-8"))["figures"]}
    by_name = {}
    for f in figs.values():
        by_name.setdefault(" ".join(words(f.get("en") or "")), set()).add(f["dance"])
    for fid, f in figs.items():
        UNIQUE[fid] = len(by_name.get(" ".join(words(f.get("en") or "")), set())) == 1
        own = words(f.get("en") or "")
        base = re.sub(r"\b(?:to|turning|on) [rl]\b", "", norm(f.get("en") or ""))
        TWIN[fid] = base != norm(f.get("en") or "") and any(
            g["dance"] == f["dance"] and g["id"] != fid and re.sub(r"\b(?:to|turning|on) [rl]\b", "", norm(g.get("en") or "")) == base
            for g in figs.values()
        )
        LONGER[fid] = [
            ws for g in figs.values()
            if g["dance"] == f["dance"] and g["id"] != fid
            for ws in [words(g.get("en") or "")]
            if own and len(ws) > len(own) and all(w in ws for w in own)
        ]
    videos = json.loads(VIDEOS.read_text(encoding="utf-8"))
    bad = 0
    total = 0
    need = []
    for fid, fig in figs.items():
        if fig["dance"] == "polka":
            continue  # Czech names only (searched as ČSTS polka)
        vs = videos.get(fid, [])
        keep = []
        for v in vs:
            total += 1
            ok, why, _ = check(v, fig)
            if ok:
                keep.append(v)
            else:
                bad += 1
                print(f"{fid:14} ✗ {why:24} {v['title'][:90]}")
        if fix:
            videos[fid] = keep
        if len(keep) < 2:
            need.append(fid)
    print(f"\n{bad} of {total} videos rejected; {len(need)} figures with fewer than 2 good videos")
    if not fix:
        return
    for i, fid in enumerate(need, 1):
        fig = figs[fid]
        names = [re.sub(r"\(.*?\)", "", fig.get("en") or fig["cs"]).strip()] + list((fig.get("aliases") or {}).get("en", []))[:2]
        seen = {v["id"] for v in videos.get(fid, [])}
        cands = []
        for nm in dict.fromkeys(names):
            q = f"{DANCE_QUERY[fig['dance']]} {nm}"
            try:
                res = search(q)
            except Exception as exc:
                print(f"  search failed: {exc}")
                time.sleep(5)
                continue
            for v in res[:20]:
                if v["id"] in seen:
                    continue
                ok, _, quality = check(v, fig)
                if ok:
                    seen.add(v["id"])
                    cands.append((rank(v, quality), dict(v, query=q)))
            time.sleep(1.0 + random.random())
            if len(cands) >= 3:
                break
        cands.sort(key=lambda c: -c[0])
        videos[fid] = (videos.get(fid, []) + [c[1] for c in cands])[:3]
        print(f"[{i}/{len(need)}] {fid} {fig['en']}: {len(videos[fid])} videos", flush=True)
        if i % 10 == 0:
            VIDEOS.write_text(json.dumps(videos, ensure_ascii=False, indent=1), encoding="utf-8")
    VIDEOS.write_text(json.dumps(videos, ensure_ascii=False, indent=1), encoding="utf-8")
    print("done")


if __name__ == "__main__":
    main()
