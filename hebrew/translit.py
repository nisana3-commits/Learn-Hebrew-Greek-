"""Transliterate pointed Biblical Hebrew.

Two styles:

  classical  Based on the SBL Handbook of Style academic scheme, adjusted so every
             letter is pronounceable: ʾ b/v g/gh d/dh h w z ḥ ṭ y k/kh l m n s ʿ p/f
             ṣ q r ś š t/th. Long vowels carry a macron (ā ē ō), vowels written with
             a vowel letter carry a circumflex (î ê ô û, and â for final qamets-he),
             vocal shva is ə, and a dagesh forte doubles the consonant.
  modern     Modern Israeli reading: v for vav, k for qof, kh for both chet and soft
             kaf, silent alef and ayin, ts for tsade, no doubling, no length marks,
             syllables separated by dots.

Decisions that need judgement, and how they are made here:

  * A qamets is short (o) when the next letter carries a silent shva and the qamets
    has no meteg, when the word is joined by maqqef to the next and the qamets sits
    in its final closed syllable, and when it is a hataf qamets. Otherwise it is ā.
  * A shva is vocal at the start of a word, under a doubled consonant, after another
    (silent) shva, after a long vowel, and under a letter identical to the one before
    it. It is silent at the end of a word and everywhere else.
  * A dagesh in one of the six begadkefat letters is lene (hard, no doubling) at the
    start of a word or after a silent shva, and forte (hard and doubled) after a vowel.
    In any other letter it is forte.
  * Furtive patach under a final chet, ayin or he-with-mappiq is spoken before the
    consonant: rûaḥ, māšîaḥ.

Accents are ignored except the meteg, which marks a qamets as long.
"""
import unicodedata

SHEVA, HATAF_SEGOL, HATAF_PATACH, HATAF_QAMATS = "ְ", "ֱ", "ֲ", "ֳ"
HIRIQ, TSERE, SEGOL, PATACH, QAMATS, HOLAM, HOLAM_HASER, QUBUTS = (
    "ִ", "ֵ", "ֶ", "ַ", "ָ", "ֹ", "ֺ", "ֻ")
DAGESH, METEG, RAFE, SHIN_DOT, SIN_DOT, QAMATS_QATAN = "ּ", "ֽ", "ֿ", "ׁ", "ׂ", "ׇ"
FULL_VOWELS = {HIRIQ, TSERE, SEGOL, PATACH, QAMATS, HOLAM, HOLAM_HASER, QUBUTS, QAMATS_QATAN}
HATAFS = {HATAF_SEGOL, HATAF_PATACH, HATAF_QAMATS}
KEPT_MARKS = FULL_VOWELS | HATAFS | {SHEVA, DAGESH, METEG, RAFE, SHIN_DOT, SIN_DOT}

ALEF, BET, GIMEL, DALET, HE, VAV, ZAYIN, HET, TET, YOD = "אבגדהוזחטי"
KAF_F, KAF, LAMED, MEM_F, MEM, NUN_F, NUN, SAMEKH, AYIN, PE_F, PE = "ךכלםמןנסעףפ"
TSADI_F, TSADI, QOF, RESH, SHIN, TAV = "ץצקרשת"
BEGADKEFAT = {BET, GIMEL, DALET, KAF, KAF_F, PE, PE_F, TAV}

# consonant -> str, or (hard, soft) for the begadkefat letters
CONS = {
    "classical": {
        ALEF: "ʾ", BET: ("b", "v"), GIMEL: ("g", "gh"), DALET: ("d", "dh"), HE: "h", VAV: "w",
        ZAYIN: "z", HET: "ḥ", TET: "ṭ", YOD: "y", KAF: ("k", "kh"), KAF_F: ("k", "kh"),
        LAMED: "l", MEM: "m", MEM_F: "m", NUN: "n", NUN_F: "n", SAMEKH: "s", AYIN: "ʿ",
        PE: ("p", "f"), PE_F: ("p", "f"), TSADI: "ṣ", TSADI_F: "ṣ", QOF: "q", RESH: "r",
        SHIN: "š", TAV: ("t", "th"),
    },
    "modern": {
        ALEF: "", BET: ("b", "v"), GIMEL: ("g", "g"), DALET: ("d", "d"), HE: "h", VAV: "v",
        ZAYIN: "z", HET: "kh", TET: "t", YOD: "y", KAF: ("k", "kh"), KAF_F: ("k", "kh"),
        LAMED: "l", MEM: "m", MEM_F: "m", NUN: "n", NUN_F: "n", SAMEKH: "s", AYIN: "",
        PE: ("p", "f"), PE_F: ("p", "f"), TSADI: "ts", TSADI_F: "ts", QOF: "k", RESH: "r",
        SHIN: "sh", TAV: ("t", "t"),
    },
}
SIN = {"classical": "ś", "modern": "s"}
VOWELS = {
    "classical": {PATACH: "a", QAMATS: "ā", QAMATS_QATAN: "o", HIRIQ: "i", TSERE: "ē", SEGOL: "e",
                  HOLAM: "ō", HOLAM_HASER: "ō", QUBUTS: "u", HATAF_PATACH: "ă", HATAF_SEGOL: "ĕ",
                  HATAF_QAMATS: "ŏ", SHEVA: "ə"},
    "modern": {PATACH: "a", QAMATS: "a", QAMATS_QATAN: "o", HIRIQ: "i", TSERE: "e", SEGOL: "e",
               HOLAM: "o", HOLAM_HASER: "o", QUBUTS: "u", HATAF_PATACH: "a", HATAF_SEGOL: "e",
               HATAF_QAMATS: "o", SHEVA: "e"},
}
# vowel written with a vowel letter: keyed by the mater tag
MATER_FORM = {
    "classical": {"u": "û", "o": "ô", "i": "î", "e": "ê", "a": "â"},
    "modern": {"u": "u", "o": "o", "i": "i", "e": "e", "a": "a"},
}


def _letters(word):
    """[(consonant, marks)] with accents dropped."""
    out = []
    for ch in unicodedata.normalize("NFD", word):
        if "א" <= ch <= "ת":
            out.append((ch, set()))
        elif out and ch in KEPT_MARKS:
            out[-1][1].add(ch)
    return out


def analyse(word, maqqef=False):
    """Per-letter analysis shared by both styles."""
    L = _letters(word)
    n = len(L)
    info = []
    for ch, marks in L:
        info.append({
            "ch": ch, "marks": marks,
            "vowel": next((m for m in marks if m in FULL_VOWELS), None),
            "hataf": next((m for m in marks if m in HATAFS), None),
            "shva": SHEVA in marks, "dagesh": DAGESH in marks, "meteg": METEG in marks,
            "mater": None, "forte": False, "vocal": False, "qatan": False, "mappiq": False,
        })

    def sound(j):
        x = info[j]
        return bool(x["vowel"] or x["hataf"] or x["mater"])

    if n > 1 and info[0]["ch"] == VAV and info[0]["dagesh"] and not info[0]["vowel"] and not info[0]["hataf"] and not info[0]["shva"]:
        info[0]["mater"], info[0]["dagesh"], info[0]["initial_u"] = "u", False, True
    for i in range(1, n):
        cur, prev = info[i], info[i - 1]
        bare = not cur["hataf"] and not cur["shva"]
        if cur["ch"] == VAV and bare:
            if cur["vowel"] == HOLAM and not sound(i - 1) and not prev["shva"] or cur["vowel"] == HOLAM and prev["shva"]:
                cur["mater"], cur["vowel"] = "o", None          # holam male
            elif cur["vowel"] is None and cur["dagesh"] and not sound(i - 1):
                cur["mater"], cur["dagesh"] = "u", False        # shureq
        elif cur["ch"] == YOD and bare and cur["vowel"] is None and not cur["dagesh"]:
            if prev["vowel"] in (HIRIQ, TSERE, SEGOL):
                cur["mater"] = {HIRIQ: "i", TSERE: "e", SEGOL: "e"}[prev["vowel"]]
        elif cur["ch"] == HE and i == n - 1 and bare and cur["vowel"] is None:
            if cur["dagesh"]:
                cur["mappiq"] = True
            elif prev["vowel"] == QAMATS:
                cur["mater"] = "a"

    for i in range(n):
        cur = info[i]
        if not cur["dagesh"] or cur["mappiq"]:
            continue
        if cur["ch"] in BEGADKEFAT:
            cur["forte"] = i > 0 and sound(i - 1)
        else:
            cur["forte"] = i > 0

    for i in range(n):
        cur = info[i]
        if cur["vowel"] == QAMATS_QATAN or cur["hataf"] == HATAF_QAMATS:
            cur["qatan"] = True
        if not cur["shva"]:
            continue
        if n == 1:
            cur["vocal"] = True
        elif i == n - 1:
            cur["vocal"] = False
        elif i == 0 or cur["forte"]:
            cur["vocal"] = True
        else:
            prev = info[i - 1]
            if prev["shva"] and not prev["vocal"]:
                cur["vocal"] = True
            elif prev["ch"] == cur["ch"] or info[i + 1]["ch"] == cur["ch"]:
                cur["vocal"] = True
            elif prev["vowel"] == QAMATS:
                if prev["meteg"]:
                    cur["vocal"] = True
                else:
                    prev["qatan"], cur["vocal"] = True, False
            elif prev["vowel"] in (TSERE, HOLAM, HOLAM_HASER) or prev["mater"]:
                cur["vocal"] = True
            else:
                cur["vocal"] = False
    if (maqqef and n >= 2 and info[-2]["vowel"] == QAMATS and not info[-2]["meteg"] and not sound(n - 1)
            and not info[-1]["mater"] and not info[-1]["shva"] and info[-1]["ch"] not in (ALEF, HE)):
        info[-2]["qatan"] = True
    return info


def transliterate(word, style="classical", maqqef=False):
    """Transliteration of one pointed word, or '' when it carries no vowels."""
    info = analyse(word, maqqef)
    n = len(info)
    if n == 0:
        return ""
    cons_map, vow_map, mater_form = CONS[style], VOWELS[style], MATER_FORM[style]
    units = []  # [consonant, vowel, starts_syllable]

    def sound(j):
        x = info[j]
        return bool(x["vowel"] or x["hataf"] or x["mater"])

    for i in range(n):
        cur = info[i]
        ch = cur["ch"]
        if cur.get("initial_u"):
            units.append(["", mater_form["u"], True])
            continue
        if cur["mater"]:
            if units:
                units[-1][1] = mater_form[cur["mater"]]
                units[-1][2] = len(units) > 1
                if cur["ch"] == HE and style == "modern":
                    units.append(["h", "", False])
            continue
        if (style == "modern" and ch == YOD and not sound(i) and not cur["shva"] and i == n - 2
                and info[i + 1]["ch"] == VAV and not sound(i + 1) and not info[i + 1]["shva"]):
            continue
        if ch == SHIN:
            c = SIN[style] if SIN_DOT in cur["marks"] else cons_map[SHIN]
        else:
            c = cons_map[ch]
            if isinstance(c, tuple):
                c = c[0] if cur["dagesh"] else c[1]
        if cur["forte"] and style == "classical":
            c = c + c
        if cur["vowel"]:
            v = "o" if (cur["qatan"] and cur["vowel"] == QAMATS) else vow_map[cur["vowel"]]
        elif cur["hataf"]:
            v = vow_map[cur["hataf"]]
        elif cur["shva"] and cur["vocal"]:
            v = vow_map[SHEVA]
        else:
            v = ""
        # furtive patach
        if (i == n - 1 and cur["vowel"] == PATACH and (ch in (HET, AYIN) or cur["mappiq"]) and i > 0
                and sound(i - 1) and (info[i - 1]["mater"] or info[i - 1]["vowel"] not in (PATACH, SEGOL, HIRIQ, QUBUTS))):
            units.append(["a" + c, "", True])
            continue
        if style == "modern" and c == "" and v and units and units[-1][1]:
            c = "'"
        units.append([c, v, bool(v)])
    if style == "classical":
        return "".join(c + v for c, v, _ in units)
    pieces = []
    for k, (c, v, starts) in enumerate(units):
        if k > 0 and starts and pieces:
            pieces.append(".")
        pieces.append(c + v)
    return "".join(pieces).strip(".")


if __name__ == "__main__":
    import sys
    for w in sys.argv[1:]:
        print(w, transliterate(w), transliterate(w, "modern"))
