#!/usr/bin/env python3
"""Look up Strong's dictionary entries and print them as copy-paste plain text.

Usage:
  python3 strongs/lookup.py H7462          one entry by number
  python3 strongs/lookup.py G4166 H7462    several entries
  python3 strongs/lookup.py shepherd       search definitions and KJV renderings
  python3 strongs/lookup.py --hebrew shepherd   restrict a search to one language
  python3 strongs/lookup.py --greek shepherd

No dependencies beyond the Python standard library.
"""
import json
import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
FILES = {"H": HERE / "strongs-hebrew.json", "G": HERE / "strongs-greek.json"}
_cache = {}


def load(prefix):
    if prefix not in _cache:
        with open(FILES[prefix], encoding="utf-8") as f:
            _cache[prefix] = json.load(f)
    return _cache[prefix]


def normalize(number, entry):
    """Hebrew and Greek files use slightly different field names. Flatten them."""
    return {
        "number": number,
        "lemma": entry.get("lemma", ""),
        "translit": entry.get("xlit") or entry.get("translit", ""),
        "pron": entry.get("pron", ""),
        "derivation": (entry.get("derivation") or "").strip(),
        "definition": (entry.get("strongs_def") or "").strip(),
        "kjv": (entry.get("kjv_def") or "").strip(),
    }


def fmt(e):
    lines = [f"{e['number']}  {e['lemma']}  {e['translit']}"]
    if e["pron"]:
        lines.append(f"Pronounced: {e['pron']}")
    if e["derivation"]:
        lines.append(f"Derivation: {e['derivation']}")
    if e["definition"]:
        lines.append(f"Definition: {e['definition']}")
    if e["kjv"]:
        lines.append(f"KJV renders it: {e['kjv']}")
    return "\n".join(lines)


def get(number):
    number = number.upper()
    m = re.fullmatch(r"([HG])0*(\d+)", number)
    if not m:
        return None
    key = m.group(1) + m.group(2)
    d = load(m.group(1))
    return normalize(key, d[key]) if key in d else None


def search(term, prefixes=("H", "G"), limit=25):
    term_l = term.lower()
    hits = []
    for p in prefixes:
        for key, entry in load(p).items():
            e = normalize(key, entry)
            hay = " ".join([e["translit"], e["definition"], e["kjv"], e["lemma"]]).lower()
            if term_l in hay:
                # Rank exact KJV renderings above loose definition matches.
                kjv_words = [w.strip(" .()[]") for w in re.split(r"[,;]", e["kjv"].lower())]
                rank = 0 if term_l in kjv_words else 1
                hits.append((rank, int(key[1:]), e))
    hits.sort(key=lambda t: (t[0], t[1]))
    return [h[2] for h in hits[:limit]], len(hits)


def main(argv):
    args = [a for a in argv if not a.startswith("--")]
    flags = [a for a in argv if a.startswith("--")]
    if not args:
        print(__doc__)
        return 1
    prefixes = ("H", "G")
    if "--hebrew" in flags:
        prefixes = ("H",)
    if "--greek" in flags:
        prefixes = ("G",)

    blocks = []
    for a in args:
        if re.fullmatch(r"[HhGg]\d+", a):
            e = get(a)
            blocks.append(fmt(e) if e else f"{a.upper()}: no entry found.")
        else:
            results, total = search(a, prefixes)
            if not results:
                blocks.append(f'No entries match "{a}".')
                continue
            header = f'{total} entries match "{a}"'
            if total > len(results):
                header += f" (showing first {len(results)})"
            blocks.append(header + "\n\n" + "\n\n".join(fmt(e) for e in results))
    print("\n\n".join(blocks))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
