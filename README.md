# Learn Hebrew and Greek

Reference data and tools for studying the original languages behind the KJV.
Everything runs with Python 3 alone. Nothing to install.

## What is here

| Path | Contents |
|---|---|
| `strongs/strongs-hebrew.json` | Strong's Hebrew dictionary, H1 through H8674 (8,674 entries). |
| `strongs/strongs-greek.json` | Strong's Greek dictionary, G1 through G5624 (5,523 entries; Strong's numbering has gaps). |
| `strongs/lookup.py` | Dictionary lookup by number or by word. Prints plain text you can paste into a post. |
| `kjv/kjv-strongs.txt` | The whole KJV, one verse per line, every phrase tagged with its Strong's number. 31,102 verses. |
| `kjv/concordance.py` | Occurrence lists: every verse where a Strong's number appears, with the word marked. |
| `kjv/kjvtext.py` | Shared reader used by the two scripts. |
| `kjv/build.py` | Rebuilds `kjv-strongs.txt` from the CrossWire source. You only need it if the source is updated. |

Each dictionary entry carries the lemma (Hebrew or Greek script), transliteration,
pronunciation (Hebrew only), derivation, Strong's definition, the list of ways the
King James Version renders the word, and how many times it occurs.

## Look up a word

```
python3 strongs/lookup.py H7462            one entry
python3 strongs/lookup.py G4166 H7462      several entries
python3 strongs/lookup.py shepherd         search definitions and KJV renderings
python3 strongs/lookup.py --hebrew feed    restrict a search to Hebrew
python3 strongs/lookup.py --greek feed     restrict a search to Greek
```

Example:

```
H7462  רָעָה  râʻâh
Pronounced: raw-aw'
Derivation: a primitive root;
Definition: to tend a flock; i.e. pasture it; intransitively, to graze (literally or figuratively); generally to rule; by extension, to associate with (as a friend)
KJV renders it: [idiom] break, companion, keep company with, devour, eat up, evil entreat, feed, use as a friend, make friendship with, herdman, keep (sheep) (-er), pastor, [phrase] shearing house, shepherd, wander, waste.
Occurs 173 times in 144 verses. Verse list: python3 kjv/concordance.py H7462
```

## List every verse where a word occurs

```
python3 kjv/concordance.py H7462                 all 144 verses, the word marked with *asterisks*
python3 kjv/concordance.py H7462 --book Psalms   only one book
python3 kjv/concordance.py G4166 --count         counts and renderings, no verse list
python3 kjv/concordance.py G26 --limit 20        first 20 verses
```

Example:

```
Occurs 8 times in 8 verses in Psalms.
Rendered as: is my shepherd (1), feed (1), thou shalt be fed (1), shall feed (1), him to feed (1), so he fed (1), o shepherd (1), doth devour (1)

Psalms 23:1  A Psalm of David. The LORD *[is] my shepherd*; I shall not want.
Psalms 28:9  Save thy people, and bless thine inheritance: *feed* them also, and lift them up for ever.
Psalms 37:3  Trust in the LORD, and do good; [so] shalt thou dwell in the land, and verily *thou shalt be fed*.
```

Words in square brackets are the ones the KJV translators supplied, printed in italics
in most Bibles. LORD in capitals marks the divine name, as in the printed KJV.

## The tagged text format

`kjv/kjv-strongs.txt` is plain text, so it also works with grep or any editor:

```
Genesis 1:1<TAB>In the beginning{H7225} God{H430} created{H853 H1254} the heaven{H8064} and{H853} the earth{H776}.
```

A phrase with two numbers in its braces translates two original words at once.

## Sources and licenses

- James Strong's dictionaries (Hebrew 1894, Greek 1890) are public domain. The JSON
  files come from the Open Scriptures project's XML edition
  (https://github.com/openscriptures/strongs), CC-BY-SA. The only change made here
  is converting the JavaScript modules to plain JSON and sorting the Greek entries.
- The KJV text is public domain. The Strong's tagging is CrossWire Bible Society's
  "King James Version (1769) with Strongs Numbers and Morphology" module
  (https://gitlab.com/crosswire-bible-society/kjv), distributed under the GPL, fetched
  from the copy at https://github.com/scrollmapper/bible_databases. Morphology codes,
  translator notes, and cross references were dropped in the conversion.
