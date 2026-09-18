#!/usr/bin/env python3
"""Rebuild kjv/kjv-strongs.txt from the CrossWire KJV OSIS source.

Source (34 MB, not stored in this repo):
  https://raw.githubusercontent.com/scrollmapper/bible_databases/master/sources/en/KJV/KJV-osis.json
which is CrossWire's "King James Version (1769) with Strongs Numbers and
Morphology" module (https://gitlab.com/crosswire-bible-society/kjv), GPL.

Usage:
  python3 kjv/build.py path/to/KJV-osis.json

Output format, one verse per line, tab separated:
  Genesis 1:1<TAB>In the beginning{H7225} God{H430} created{H853 H1254} ...
Each tagged phrase is followed by its Strong's numbers in braces. Words the
KJV translators supplied (printed in italics in most Bibles) are in square
brackets. Translator notes and cross references are dropped.
"""
import json
import re
import sys
from html.parser import HTMLParser
from pathlib import Path

BOOK_NAMES = {
    "I Samuel": "1 Samuel", "II Samuel": "2 Samuel",
    "I Kings": "1 Kings", "II Kings": "2 Kings",
    "I Chronicles": "1 Chronicles", "II Chronicles": "2 Chronicles",
    "I Corinthians": "1 Corinthians", "II Corinthians": "2 Corinthians",
    "I Thessalonians": "1 Thessalonians", "II Thessalonians": "2 Thessalonians",
    "I Timothy": "1 Timothy", "II Timothy": "2 Timothy",
    "I Peter": "1 Peter", "II Peter": "2 Peter",
    "I John": "1 John", "II John": "2 John", "III John": "3 John",
    "Revelation of John": "Revelation",
    "Song of Solomon": "Song of Solomon",
}


def strong_numbers(lemma):
    """'strong:H0853 strong:H01254 lemma.TR:...' -> ['H853', 'H1254']"""
    out = []
    for tok in lemma.split():
        m = re.fullmatch(r"strong:([HG])0*(\d+)([a-z]?)", tok)
        if m:
            n = m.group(1) + m.group(2)
            if n not in out:
                out.append(n)
    return out


class VerseParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.parts = []          # output pieces
        self.stack = []          # open tag names
        self.w_text = []         # text collected inside current <w>
        self.w_nums = []
        self.in_w = False

    def _skipping(self):
        return "note" in self.stack

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        self.stack.append(tag)
        if self._skipping():
            return
        if tag == "w":
            self.in_w = True
            self.w_text = []
            self.w_nums = strong_numbers(a.get("lemma", ""))
        elif tag == "transchange":
            self._emit("[")
        elif tag == "divinename":
            self._emit("\x00")   # marker: uppercase until the closing tag

    def handle_startendtag(self, tag, attrs):
        # self-closing tags such as <milestone .../> carry no text
        pass

    def handle_endtag(self, tag):
        if self.stack and self.stack[-1] == tag:
            self.stack.pop()
        elif tag in self.stack:
            while self.stack and self.stack.pop() != tag:
                pass
        if self._skipping():
            return
        if tag == "w":
            text = "".join(self.w_text)
            if self.w_nums:
                text = text.rstrip()
                trail = "".join(self.w_text)[len(text):]
                self.parts.append(text + "{" + " ".join(self.w_nums) + "}" + trail)
            else:
                self.parts.append(text)
            self.in_w = False
        elif tag == "transchange":
            self._emit("]")
        elif tag == "divinename":
            self._emit("\x01")
        elif tag == "psalmtitle":
            self._emit(" ")

    def handle_data(self, data):
        if self._skipping():
            return
        self._emit(data)

    def _emit(self, s):
        if self.in_w:
            self.w_text.append(s)
        else:
            self.parts.append(s)

    def result(self):
        s = "".join(self.parts)
        s = re.sub("\x00([^\x01]*)\x01", lambda m: m.group(1).upper(), s)
        s = re.sub(r"\s+", " ", s).strip()
        s = re.sub(r"\[\s+", "[", s)
        s = re.sub(r"\s+\]", "]", s)
        return s


def convert(text):
    # html.parser treats <title> as raw text; rename it so its words are parsed.
    text = re.sub(r"<(/?)title\b", r"<\1psalmtitle", text)
    p = VerseParser()
    p.feed(text)
    p.close()
    return p.result()


def main(src):
    data = json.load(open(src, encoding="utf-8"))
    out = Path(__file__).resolve().parent / "kjv-strongs.txt"
    n = 0
    with open(out, "w", encoding="utf-8") as f:
        for book in data["books"]:
            name = BOOK_NAMES.get(book["name"], book["name"])
            for ch in book["chapters"]:
                for v in ch["verses"]:
                    f.write(f"{name} {ch['chapter']}:{v['verse']}\t{convert(v['text'])}\n")
                    n += 1
    print(f"wrote {n} verses to {out}")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print(__doc__)
        sys.exit(1)
    main(sys.argv[1])
