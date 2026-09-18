"""Shared helpers for reading kjv/kjv-strongs.txt."""
import re
from pathlib import Path

TEXT_FILE = Path(__file__).resolve().parent / "kjv-strongs.txt"
TAG = re.compile(r"\{([^}]*)\}")
# leading text, the tagged phrase (starts at a letter or an opening bracket), its numbers
PHRASE = re.compile(r"([^{}]*?)([\w\[][^{}]*?)\{([^}]*)\}")
_verses = None


def verses():
    """Yield (reference, tagged_text) for every verse, cached after first read."""
    global _verses
    if _verses is None:
        with open(TEXT_FILE, encoding="utf-8") as f:
            _verses = [tuple(line.rstrip("\n").split("\t", 1)) for line in f]
    return _verses


def plain(tagged):
    """Drop the {H1234} tags, keep the [added] word brackets."""
    return TAG.sub("", tagged)


def phrases(tagged):
    """Yield (english_phrase, [numbers]) for each tagged phrase in a verse."""
    for m in PHRASE.finditer(tagged):
        yield m.group(2).strip(), m.group(3).split()


def occurrences(number):
    """Every verse containing the Strong's number.

    Returns a list of (reference, tagged_text, [matching phrases]).
    """
    number = number.upper()
    hits = []
    needle = re.compile(r"\{[^}]*\b" + re.escape(number) + r"\b[^}]*\}")
    for ref, text in verses():
        if needle.search(text):
            matched = [ph for ph, nums in phrases(text) if number in nums]
            hits.append((ref, text, matched))
    return hits
