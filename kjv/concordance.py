#!/usr/bin/env python3
"""List every KJV verse where a Strong's number occurs, as plain text.

Usage:
  python3 kjv/concordance.py H7462              every verse, word marked with *asterisks*
  python3 kjv/concordance.py H7462 --count      counts and renderings only, no verses
  python3 kjv/concordance.py H7462 --book Psalms
  python3 kjv/concordance.py G4166 --limit 20

Requires kjv/kjv-strongs.txt, built by kjv/build.py, and the dictionaries
in strongs/ for the header.
"""
import re
import sys
from collections import Counter
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
sys.path.insert(0, str(HERE.parent / "strongs"))
import kjvtext  # noqa: E402
import lookup   # noqa: E402


def mark(tagged, number):
    """Plain verse text with every phrase carrying `number` wrapped in asterisks."""
    def repl(m):
        nums = m.group(3).split()
        phrase = m.group(2)
        if number in nums:
            phrase = "*" + phrase.strip() + "*" + phrase[len(phrase.rstrip()):]
        return m.group(1) + phrase
    return kjvtext.PHRASE.sub(repl, tagged)


def report(number, book=None, limit=None, count_only=False):
    number = number.upper()
    entry = lookup.get(number)
    hits = kjvtext.occurrences(number)
    if book:
        hits = [h for h in hits if h[0].lower().startswith(book.lower())]
    out = []
    out.append(lookup.fmt(entry, with_count=False) if entry else f"{number}: no dictionary entry.")
    n_words = sum(len(h[2]) for h in hits)
    scope = f" in {book}" if book else ""
    out.append(f"\nOccurs {n_words} times in {len(hits)} verses{scope}.")
    renderings = Counter()
    for _, _, matched in hits:
        for ph in matched:
            renderings[re.sub(r"[^\w' ]", "", ph).strip().lower()] += 1
    if renderings:
        out.append("Rendered as: " + ", ".join(
            f"{ph} ({n})" for ph, n in renderings.most_common(15)))
    if not count_only:
        out.append("")
        for ref, text, _ in (hits[:limit] if limit else hits):
            out.append(f"{ref}  {mark(text, number)}")
        if limit and len(hits) > limit:
            out.append(f"... {len(hits) - limit} more verses. Drop --limit to see them all.")
    return "\n".join(out)


def main(argv):
    if not argv or not re.fullmatch(r"[HhGg]\d+", argv[0]):
        print(__doc__)
        return 1
    number = argv[0]
    book = limit = None
    count_only = "--count" in argv
    if "--book" in argv:
        book = argv[argv.index("--book") + 1]
    if "--limit" in argv:
        limit = int(argv[argv.index("--limit") + 1])
    print(report(number, book, limit, count_only))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
