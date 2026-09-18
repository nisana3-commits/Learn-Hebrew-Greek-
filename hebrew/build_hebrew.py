#!/usr/bin/env python3
"""Build the Hebrew learning data for app/data/ from three sources.

Sources (fetch them first; none are stored in this repo):
  1. Westminster Leningrad Codex with Strong's numbers and morphology, OSIS XML
     https://github.com/openscriptures/morphhb  (wlc/*.xml, CC BY 4.0)
  2. TBESH brief Hebrew lexicon, STEPBible (CC BY 4.0). Only the Gloss, Hebrew
     form, Transliteration and Morph columns are used. The Meaning column carries
     a separate permission note and is not used.
  3. kjv/kjv-strongs.txt from this repo, for the KJV rendering of each verse.

Usage:
  python3 hebrew/build_hebrew.py path/to/morphhb/wlc path/to/TBESH.txt

Outputs:
  app/data/vocab.json    frequency-ordered vocabulary (lemmas seen 10+ times, plus prefixes)
  app/data/verses.json   curated topic verses and the reading ladder, word by word
  app/data/lexicon.json  short glosses for every lemma that appears in verses.json
"""
import json
import re
import sys
import unicodedata
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "app" / "data"
KJV_FILE = ROOT / "kjv" / "kjv-strongs.txt"
CURATED = ROOT / "hebrew" / "curated.json"

BOOKS = [  # OSIS id, KJV name in kjv-strongs.txt
    ("Gen", "Genesis"), ("Exod", "Exodus"), ("Lev", "Leviticus"), ("Num", "Numbers"),
    ("Deut", "Deuteronomy"), ("Josh", "Joshua"), ("Judg", "Judges"), ("Ruth", "Ruth"),
    ("1Sam", "1 Samuel"), ("2Sam", "2 Samuel"), ("1Kgs", "1 Kings"), ("2Kgs", "2 Kings"),
    ("1Chr", "1 Chronicles"), ("2Chr", "2 Chronicles"), ("Ezra", "Ezra"), ("Neh", "Nehemiah"),
    ("Esth", "Esther"), ("Job", "Job"), ("Ps", "Psalms"), ("Prov", "Proverbs"),
    ("Eccl", "Ecclesiastes"), ("Song", "Song of Solomon"), ("Isa", "Isaiah"), ("Jer", "Jeremiah"),
    ("Lam", "Lamentations"), ("Ezek", "Ezekiel"), ("Dan", "Daniel"), ("Hos", "Hosea"),
    ("Joel", "Joel"), ("Amos", "Amos"), ("Obad", "Obadiah"), ("Jonah", "Jonah"), ("Mic", "Micah"),
    ("Nah", "Nahum"), ("Hab", "Habakkuk"), ("Zeph", "Zephaniah"), ("Hag", "Haggai"),
    ("Zech", "Zechariah"), ("Mal", "Malachi"),
]
OSIS_TO_KJV = dict(BOOKS)
BOOK_ORDER = {b: i for i, (b, _) in enumerate(BOOKS)}

# Inseparable prefixes as tagged in the WLC lemma field.
PREFIXES = {
    "c": ("וְ", "ve", "and, but", "conjunction"),
    "d": ("הַ", "ha", "the", "article"),
    "b": ("בְּ", "be", "in, with, by", "preposition"),
    "l": ("לְ", "le", "to, for", "preposition"),
    "m": ("מִ", "mi", "from, out of", "preposition"),
    "k": ("כְּ", "ke", "like, as", "preposition"),
    "s": ("שֶׁ", "she", "who, which, that", "relative"),
    "i": ("הֲ", "ha", "[question marker]", "interrogative"),
}

SUFFIX_GLOSS = {
    "1cs": "me / my", "1cp": "us / our", "2ms": "you / your (m.)", "2fs": "you / your (f.)",
    "2mp": "you / your (m. pl.)", "2fp": "you / your (f. pl.)", "3ms": "him / his",
    "3fs": "her", "3mp": "them / their (m.)", "3fp": "them / their (f.)",
}

STEMS_H = {"q": "Qal", "N": "Niphal", "p": "Piel", "P": "Pual", "h": "Hiphil", "H": "Hophal",
           "t": "Hithpael", "o": "Polel", "O": "Polal", "r": "Hithpolel", "m": "Poel",
           "M": "Poal", "k": "Palel", "K": "Pulal", "Q": "Qal passive", "l": "Pilpel",
           "L": "Polpal", "f": "Hithpalpel", "D": "Nithpael", "j": "Pealal", "i": "Pilel",
           "u": "Hothpaal", "c": "Tiphil", "v": "Hishtaphel", "w": "Nithpalel",
           "y": "Nithpoel", "z": "Hithpoel"}
STEMS_A = {"q": "Peal", "Q": "Peil", "u": "Hithpeel", "p": "Pael", "P": "Ithpaal", "M": "Hithpaal",
           "a": "Aphel", "h": "Haphel", "s": "Saphel", "e": "Shaphel", "H": "Hophal",
           "i": "Ithpeel", "t": "Hishtaphel", "v": "Ishtaphel", "w": "Hithaphel",
           "o": "Polel", "z": "Ithpoel", "r": "Hithpolel", "f": "Hithpalpel", "b": "Hephal",
           "c": "Tiphel", "m": "Poel", "l": "Palpel", "L": "Ithpalpel", "O": "Ithpolel",
           "G": "Ittaphal"}
VTYPES = {"p": "perfect", "q": "sequential perfect", "i": "imperfect", "w": "sequential imperfect",
          "h": "cohortative", "j": "jussive", "v": "imperative", "r": "participle",
          "s": "passive participle", "a": "infinitive absolute", "c": "infinitive construct"}
GENDER = {"m": "masc.", "f": "fem.", "b": "both", "c": "common"}
NUMBER = {"s": "sing.", "p": "plur.", "d": "dual"}
STATE = {"a": "absolute", "c": "construct", "d": "determined"}
PRONOUN = {"d": "demonstrative", "f": "indefinite", "i": "interrogative", "p": "personal", "r": "relative"}
PARTICLE = {"a": "affirmation", "d": "article", "e": "exclamation", "i": "interrogative",
            "j": "interjection", "m": "negative", "o": "object marker", "r": "relative"}
ADJ = {"a": "adjective", "c": "cardinal number", "o": "ordinal number", "g": "gentilic"}
NOUN = {"c": "noun", "g": "gentilic noun", "p": "proper noun"}


def pgn(s):
    """'3ms' -> '3rd masc. sing.'"""
    out = []
    if s[:1] and s[:1] in "123":
        out.append({"1": "1st", "2": "2nd", "3": "3rd"}[s[0]])
        s = s[1:]
    if s[:1] in GENDER:
        out.append(GENDER[s[0]])
        s = s[1:]
    if s[:1] in NUMBER:
        out.append(NUMBER[s[0]])
        s = s[1:]
    if s[:1] in STATE:
        out.append(STATE[s[0]])
    return " ".join(out)


def decode_morph(morph):
    """'HR/Ncmsc/Sp3ms' -> ['preposition', 'noun masc. sing. construct', 'suffix: his']"""
    lang = morph[:1]
    parts = morph[1:].split("/")
    out = []
    for p in parts:
        if not p:
            continue
        c, rest = p[0], p[1:]
        if c == "R":
            out.append("preposition" + (" + the" if rest == "d" else ""))
        elif c == "C":
            out.append("conjunction")
        elif c == "D":
            out.append("adverb")
        elif c == "T":
            out.append(PARTICLE.get(rest, "particle"))
        elif c == "N":
            kind = NOUN.get(rest[:1], "noun")
            out.append((kind + " " + pgn(rest[1:])).strip())
        elif c == "A":
            out.append((ADJ.get(rest[:1], "adjective") + " " + pgn(rest[1:])).strip())
        elif c == "P":
            out.append((PRONOUN.get(rest[:1], "pronoun") + " pronoun " + pgn(rest[1:])).strip())
        elif c == "V":
            stems = STEMS_A if lang == "A" else STEMS_H
            stem = stems.get(rest[:1], "")
            vt = VTYPES.get(rest[1:2], "")
            out.append(" ".join(x for x in ["verb", stem, vt, pgn(rest[2:])] if x))
        elif c == "S":
            if rest[:1] == "p":
                out.append("suffix: " + SUFFIX_GLOSS.get(rest[1:], rest[1:]))
            elif rest[:1] == "d":
                out.append("directional ending (toward)")
            elif rest[:1] == "h":
                out.append("paragogic he")
            elif rest[:1] == "n":
                out.append("paragogic nun")
            else:
                out.append("suffix")
        else:
            out.append(p)
    return out


def strip_cantillation(s):
    """Remove accent marks, keep vowel points."""
    return "".join(ch for ch in s if not (0x0591 <= ord(ch) <= 0x05AF or ch in "ֽֿ׀׃ׅׄ׆"))


def strip_points(s):
    return "".join(ch for ch in s if not unicodedata.combining(ch))


def lemma_key(lemma):
    """'b/1254 a' -> (['b'], 'H1254a'); '853' -> ([], 'H853'); 'l' -> (['l'], None)"""
    bits = lemma.split("/")
    main = bits[-1].strip()
    pfx = bits[:-1]
    m = re.fullmatch(r"(\d+)(?: ([a-z]))?(\+)?", main)
    if not m:
        return bits, None
    key = "H" + m.group(1) + (m.group(2) or "")
    return pfx, key


# ---------- lexicon ----------

def load_tbesh(path):
    """eStrong -> {heb, translit, type, gloss}; first row per number wins."""
    lex = {}
    with open(path, encoding="utf-8-sig") as f:
        for line in f:
            if not re.match(r"H\d{4}", line):
                continue
            cols = line.rstrip("\n").split("\t")
            if len(cols) < 7:
                continue
            e = cols[0].strip()
            key = "H" + str(int(e[1:5])) + e[5:].lower()
            if key in lex:
                continue
            gloss = cols[6].strip()
            if gloss == "[Obj.]":
                gloss = "(marks the direct object)"
            lex[key] = {"heb": strip_cantillation(cols[3].strip()), "translit": cols[4].strip(),
                        "type": cols[5].strip(), "gloss": gloss}
    return lex


def lex_lookup(lex, key):
    if key in lex:
        return lex[key]
    base = re.sub(r"[a-z]$", "", key)
    return lex.get(base)


# ---------- WLC ----------

W_RE = re.compile(r'<w ([^>]*)>(.*?)</w>|<seg type="x-(maqqef|sof-pasuq)">[^<]*</seg>|<verse osisID="([^"]+)">', re.S)


def parse_wlc(wlc_dir):
    verses = {}  # osisID -> list of word dicts
    order = []
    for osis, _ in BOOKS:
        text = (Path(wlc_dir) / f"{osis}.xml").read_text(encoding="utf-8")
        cur = None
        for m in W_RE.finditer(text):
            if m.group(4):
                cur = m.group(4)
                verses[cur] = []
                order.append(cur)
                continue
            if m.group(3):
                if cur and verses[cur]:
                    if m.group(3) == "maqqef":
                        verses[cur][-1]["mq"] = True
                    else:
                        verses[cur][-1]["end"] = True
                continue
            attrs = dict(re.findall(r'(\w+)="([^"]*)"', m.group(1)))
            if attrs.get("type") == "x-ketiv":
                continue  # the qere reading follows inside the note
            pfx, key = lemma_key(attrs.get("lemma", ""))
            morph = attrs.get("morph", "")
            surface = re.sub(r"<[^>]+>", "", m.group(2))  # letters marked large/small/suspended
            verses[cur].append({
                "h": strip_cantillation(surface.replace("/", "")),
                "parts": [strip_cantillation(p) for p in surface.split("/")],
                "pfx": pfx, "key": key, "morph": morph,
            })
    return verses, order


def parse_versemap(wlc_dir):
    """WLC osisID -> KJV osisID for verses whose numbering differs."""
    text = (Path(wlc_dir) / "VerseMap.xml").read_text(encoding="utf-8")
    m = {}
    for wlc, kjv in re.findall(r'<verse wlc="([^"]+)" kjv="([^"]+)"', text):
        m[wlc.split("!")[0]] = kjv.split("!")[0]
    return m


def osis_to_kjv_ref(osis):
    b, c, v = osis.split(".")
    return f"{OSIS_TO_KJV[b]} {c}:{v}"


def load_kjv():
    kjv = {}
    with open(KJV_FILE, encoding="utf-8") as f:
        for line in f:
            ref, text = line.rstrip("\n").split("\t", 1)
            kjv[ref] = text
    return kjv


def kjv_plain(tagged):
    return re.sub(r"\{[^}]*\}", "", tagged)


def kjv_phrases(tagged):
    """list of (phrase, [numbers]) in order"""
    return [(m.group(2).strip(), m.group(3).split())
            for m in re.finditer(r"([^{}]*?)([\w\[][^{}]*?)\{([^}]*)\}", tagged)]


# ---------- reference parsing ----------

def expand_ref(ref):
    """'Ps 103:8-13' -> ['Ps.103.8', ..., 'Ps.103.13'] (KJV numbering)"""
    m = re.fullmatch(r"(\S+) (\d+):(\d+)(?:-(\d+))?", ref)
    b, c, v1, v2 = m.group(1), int(m.group(2)), int(m.group(3)), m.group(4)
    v2 = int(v2) if v2 else v1
    return [f"{b}.{c}.{v}" for v in range(v1, v2 + 1)]


# ---------- main ----------

def main(wlc_dir, tbesh_path):
    lex = load_tbesh(tbesh_path)
    verses, order = parse_wlc(wlc_dir)
    vmap = parse_versemap(wlc_dir)
    kjv = load_kjv()
    kjv_to_wlc = defaultdict(list)
    wlc_to_kjv = {}
    for osis in order:
        k = vmap.get(osis, osis)
        wlc_to_kjv[osis] = k
        kjv_to_wlc[k].append(osis)

    # frequency over Hebrew (not Aramaic) words
    freq = Counter()
    pfx_freq = Counter()
    surface = defaultdict(Counter)
    for osis in order:
        for w in verses[osis]:
            if w["morph"].startswith("A"):
                continue
            for p in w["pfx"]:
                pfx_freq[p] += 1
            if w["key"]:
                freq[w["key"]] += 1
                surface[w["key"]][strip_points(w["parts"][-1])] += 1

    def is_name(key):
        e = lex_lookup(lex, key)
        return bool(e and e["type"].startswith("N:"))

    # vocabulary: prefixes first (by count), then lemmas with 10+ occurrences
    vocab = []
    for p, n in pfx_freq.most_common():
        if p in PREFIXES:
            heb, tr, gloss, typ = PREFIXES[p]
            vocab.append({"key": "pfx:" + p, "heb": heb, "translit": tr, "gloss": gloss,
                          "type": typ, "count": n, "prefix": True})
    for key, n in freq.most_common():
        if n < 10:
            break
        e = lex_lookup(lex, key)
        if not e:
            continue
        vocab.append({"key": key, "heb": e["heb"], "translit": e["translit"],
                      "gloss": e["gloss"], "type": e["type"], "count": n,
                      "name": is_name(key)})
    # rank: prefixes 1..8, then by frequency
    rank = {}
    r = 0
    for v in vocab:
        r += 1
        v["rank"] = r
        rank[v["key"]] = r

    # KJV renderings per Strong's number (top 3) for vocab cards
    render = defaultdict(Counter)
    for ref, tagged in kjv.items():
        for ph, nums in kjv_phrases(tagged):
            for n in nums:
                if n.startswith("H"):
                    render[n][re.sub(r"[^\w' ]", "", ph).strip().lower()] += 1
    for v in vocab:
        base = re.sub(r"[a-z]$", "", v["key"])
        if base in render:
            v["kjv"] = [p for p, _ in render[base].most_common(4)]

    # per-verse difficulty: highest rank among non-name lemmas; None if a word is off the list
    def verse_level(osis):
        lvl = 0
        unknown = 0
        for w in verses[osis]:
            for p in w["pfx"]:
                lvl = max(lvl, rank.get("pfx:" + p, 0))
            if w["key"] and not is_name(w["key"]):
                rk = rank.get(w["key"])
                if rk is None:
                    unknown += 1
                else:
                    lvl = max(lvl, rk)
        return lvl, unknown

    def build_verse(osis, topic=None):
        k = wlc_to_kjv[osis]
        kref = osis_to_kjv_ref(k)
        tagged = kjv.get(kref, "")
        phrases = kjv_phrases(tagged)
        used = set()
        words = []
        for w in verses[osis]:
            e = lex_lookup(lex, w["key"]) if w["key"] else None
            if e is None and w["pfx"] and all(p in PREFIXES for p in w["pfx"]):
                e = {"gloss": " + ".join(PREFIXES[p][2] for p in w["pfx"]), "translit": ""}
            # KJV phrase for this word: first unused phrase carrying its Strong's number
            eng = None
            if w["key"]:
                base = re.sub(r"[a-z]$", "", w["key"])
                for i, (ph, nums) in enumerate(phrases):
                    if i not in used and base in nums:
                        eng = ph
                        used.add(i)
                        break
            words.append({
                "h": w["h"], "parts": w["parts"], "pfx": w["pfx"], "key": w["key"],
                "gloss": e["gloss"] if e else "", "translit": e["translit"] if e else "",
                "morph": decode_morph(w["morph"]), "eng": eng,
                "mq": w.get("mq", False), "end": w.get("end", False),
                "name": is_name(w["key"]) if w["key"] else False,
            })
        lvl, unknown = verse_level(osis)
        b, c, v = osis.split(".")
        return {"id": osis, "ref": f"{OSIS_TO_KJV[b]} {c}:{v}",
                "kjvRef": kref if kref != f"{OSIS_TO_KJV[b]} {c}:{v}" else None,
                "kjv": kjv_plain(tagged), "words": words, "level": lvl,
                "unknown": unknown, "aramaic": any(w["morph"].startswith("A") for w in verses[osis]),
                "topics": [topic] if topic else []}

    # curated topic verses
    curated = json.load(open(CURATED, encoding="utf-8"))
    out_verses = {}
    topics = []
    missing = []
    for t in curated["topics"]:
        ids = []
        for ref in t["refs"]:
            for k in expand_ref(ref):
                wl = kjv_to_wlc.get(k, [])
                if not wl:
                    missing.append(k)
                    continue
                for osis in wl:
                    if osis not in out_verses:
                        out_verses[osis] = build_verse(osis, t["id"])
                    elif t["id"] not in out_verses[osis]["topics"]:
                        out_verses[osis]["topics"].append(t["id"])
                    if osis not in ids:
                        ids.append(osis)
        topics.append({"id": t["id"], "title": t["title"], "blurb": t["blurb"], "verses": ids})
    if missing:
        print("WARNING: no Hebrew verse found for", missing)

    # reading ladder: short verses fully covered by the vocabulary, spread across levels
    ladder = []
    candidates = []
    for osis in order:
        ws = verses[osis]
        if any(w["morph"].startswith("A") for w in ws):
            continue
        if not (3 <= len(ws) <= 14):
            continue
        lvl, unknown = verse_level(osis)
        if unknown or lvl == 0:
            continue
        content = [w for w in ws if w["key"] and not is_name(w["key"])]
        if len(content) < 3 or len(content) < 0.6 * len(ws):
            continue
        candidates.append((lvl, len(ws), osis))
    candidates.sort()
    per_bucket = Counter()
    per_bucket_book = Counter()
    seen_text = set()
    for lvl, n, osis in candidates:
        text = " ".join(w["h"] for w in verses[osis])
        if text in seen_text:
            continue
        seen_text.add(text)
        bucket = (lvl - 1) // 25
        book = osis.split(".")[0]
        cap = 40 if bucket < 8 else 20
        if per_bucket[bucket] >= cap or per_bucket_book[(bucket, book)] >= 6:
            continue
        per_bucket[bucket] += 1
        per_bucket_book[(bucket, book)] += 1
        ladder.append(osis)
        if osis not in out_verses:
            out_verses[osis] = build_verse(osis)
    ladder.sort(key=lambda o: (out_verses[o]["level"], len(out_verses[o]["words"])))

    # lexicon for every lemma in the output verses
    lexicon = {}
    for v in out_verses.values():
        for w in v["words"]:
            if w["key"] and w["key"] not in lexicon:
                e = lex_lookup(lex, w["key"])
                lexicon[w["key"]] = {"heb": e["heb"] if e else "", "translit": e["translit"] if e else "",
                                     "gloss": e["gloss"] if e else "", "type": e["type"] if e else "",
                                     "count": freq.get(w["key"], 0), "rank": rank.get(w["key"])}

    OUT.mkdir(parents=True, exist_ok=True)
    json.dump({"vocab": vocab, "totalWords": sum(freq.values())},
              open(OUT / "vocab.json", "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    json.dump({"topics": topics, "ladder": ladder, "verses": out_verses},
              open(OUT / "verses.json", "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    json.dump(lexicon, open(OUT / "lexicon.json", "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))

    for name, var in [("vocab", "HEB_VOCAB"), ("verses", "HEB_VERSES"), ("lexicon", "HEB_LEXICON")]:
        js = (OUT / f"{name}.json").read_text(encoding="utf-8")
        (OUT / f"{name}.js").write_text(f"window.{var}={js};\n", encoding="utf-8")

    covered = sum(v["count"] for v in vocab if not v.get("prefix"))
    print(f"vocab: {len(vocab)} entries covering {covered}/{sum(freq.values())} Hebrew word tokens "
          f"({100*covered/sum(freq.values()):.1f}%)")
    print(f"verses: {len(out_verses)} total, {sum(len(t['verses']) for t in topics)} topic slots, "
          f"{len(ladder)} ladder verses")
    print("ladder per 25-word bucket:", dict(sorted(per_bucket.items())))


if __name__ == "__main__":
    if len(sys.argv) != 3:
        print(__doc__)
        sys.exit(1)
    main(sys.argv[1], sys.argv[2])
