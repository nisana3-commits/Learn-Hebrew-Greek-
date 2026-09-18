# Learn Hebrew and Greek

Reference data and tools for studying the original languages of the KJV.

## What is here

| Path | Contents |
|---|---|
| `strongs/strongs-hebrew.json` | Strong's Hebrew dictionary, H1 through H8674 (8,674 entries). |
| `strongs/strongs-greek.json` | Strong's Greek dictionary, G1 through G5624 (5,523 entries; Strong's numbering has gaps). |
| `strongs/lookup.py` | Command-line lookup. Prints entries as plain text you can paste into a post. |

Each entry carries the lemma (Hebrew or Greek script), transliteration, pronunciation
(Hebrew only), derivation, Strong's definition, and the list of ways the King James
Version renders the word.

## Look something up

```
python3 strongs/lookup.py H7462            one entry
python3 strongs/lookup.py G4166 H7462      several entries
python3 strongs/lookup.py shepherd         search definitions and KJV renderings
python3 strongs/lookup.py --hebrew feed    restrict a search to Hebrew
python3 strongs/lookup.py --greek feed     restrict a search to Greek
```

Example output:

```
H7462  רָעָה  râʻâh
Pronounced: raw-aw'
Derivation: a primitive root;
Definition: to tend a flock; i.e. pasture it; intransitively, to graze (literally or figuratively); generally to rule; by extension, to associate with (as a friend)
KJV renders it: [idiom] break, companion, keep company with, devour, eat up, evil entreat, feed, use as a friend, make friendship with, herdman, keep (sheep) (-er), pastor, [phrase] shearing house, shepherd, wander, waste.
```

Python 3 is the only requirement. No packages to install.

## What is not here yet

This is Strong's dictionary, not the full concordance. It goes from a word or number
to its meaning, but it does not list every verse where the word occurs. A Strong's
tagged KJV text would add that and is the natural next file to bring in.

## Source and license

James Strong's dictionaries (Hebrew 1894, Greek 1890) are public domain. The JSON
files are derived from the Open Scriptures project's XML edition
(https://github.com/openscriptures/strongs), released under CC-BY-SA. The only change
made here is converting the JavaScript modules to plain JSON and sorting the Greek
entries by number.
