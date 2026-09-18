# Learn Hebrew and Greek

An app for learning to read the Hebrew Bible, plus the reference data behind it.
Everything runs with Python 3 and a web browser. Nothing to install.

## The app: Read the Hebrew Bible

Open `app/index.html` in any browser. It works from a double-click, no server needed,
and it is laid out for a phone.

How it teaches:

1. **Words in frequency order.** The 3,507 Hebrew words that occur five or more times.
   Together they cover 97 percent of every word in the Hebrew Bible. The eight inseparable
   prefixes (and, the, in, to, from, like, the question marker, who) are held back until
   you have started ten words and two of them appear with that prefix; the prefix card
   then shows it riding on words you already know.
2. **Recall first.** Each study card shows the Hebrew word and asks you to type its
   meaning before the answer appears. You judge yourself: Missed or Got it. Five dots
   track your streak on that word.
3. **Then the word in Scripture.** After every answer the app shows five verses that
   contain the word, in English, with the word itself in Hebrew where it falls. The verses
   come from the Bible-truth topics first: the key texts, then the passages they sit in,
   and only then the reading ladder. Every word you have answered right twice before also
   appears in Hebrew, so the verses turn into Hebrew as your vocabulary grows. Tap any
   Hebrew word to hear it and see its grammar.
4. **Spaced repetition.** Intervals grow the way Anki's do (SM-2 with two learning steps)
   and a miss brings the word back within minutes. Ten new words a day by default.
5. **Real verses to read.** The reading ladder holds 2,884 short verses ranked by their
   rarest word; a verse is "ready" when you have started every word in it. Fifteen
   Bible-truth topics hold 2,726 verses (the character of God, His promises, creation,
   the Sabbath, the law, the state of the dead, the second coming, the Messiah, the
   sanctuary, the great controversy, prophecy, the judgment, the new earth, health and
   stewardship, prayer): 404 starred key texts plus the chapters and passages they come
   from, such as Exodus 20, Isaiah 53, Ecclesiastes 9, Daniel 12 and Psalm 91. The list
   is `hebrew/curated.json`; a reference like "Ps 103" means the whole chapter. Edit it
   and rebuild. Whole verses can be added to your reviews as cards.

**Transliteration.** Every word is transliterated from its own pointed form by
`hebrew/translit.py`, in two styles. Classical (the default) follows the SBL academic
scheme with the soft begadkefat letters spelled as they sound: ʾ b/v g/gh d/dh h w z ḥ ṭ
y k/kh l m n s ʿ p/f ṣ q r ś š t/th, long vowels marked (ā ē ō), vowel letters marked
(î ê ô û â), vocal shva as ə, and doubled consonants written twice. Modern Israeli
(a setting on Home) uses v for vav, k for qof, kh for chet, silent alef and ayin, ts
for tsade, no length or doubling, and syllable dots. The rules for short qamets, vocal
shva, dagesh and furtive patach are documented at the top of the module, and
`hebrew/test_translit.py` holds sixty known forms it must reproduce.

**Pronunciation.** Every Hebrew word and verse has a speaker button, and words are read
aloud as they appear (turn this off on Home). The app uses the Hebrew voice built into
the device, so nothing is downloaded. iPhones and iPads include one (Carmit); on Android,
install Hebrew under Text-to-speech in the Google Speech Services settings. The voice
reads pointed text in modern Israeli pronunciation, the standard used in most seminaries.

Progress is saved in the browser. Export it from Home before changing phones.

### Rebuilding the data

```
git clone --depth 1 https://github.com/openscriptures/morphhb
curl -o TBESH.txt "https://raw.githubusercontent.com/STEPBible/STEPBible-Data/master/Lexicons/TBESH%20-%20Translators%20Brief%20lexicon%20of%20Extended%20Strongs%20for%20Hebrew%20-%20STEPBible.org%20CC%20BY.txt"
python3 hebrew/build_hebrew.py morphhb/wlc TBESH.txt
```

That rewrites `app/data/`. Edit `hebrew/curated.json` first to change the topics or verses.

## Reference data and tools

| Path | Contents |
|---|---|
| `strongs/strongs-hebrew.json` | Strong's Hebrew dictionary, H1 through H8674 (8,674 entries). |
| `strongs/strongs-greek.json` | Strong's Greek dictionary, G1 through G5624 (5,523 entries; Strong's numbering has gaps). |
| `strongs/lookup.py` | Dictionary lookup by number or by word. Prints plain text you can paste into a post. |
| `app/` | The Hebrew reading app. `index.html`, `app.js`, `style.css`, and the built data in `app/data/`. |
| `hebrew/build_hebrew.py` | Builds `app/data/` from the tagged Hebrew text and the lexicon. |
| `hebrew/curated.json` | The topic-by-topic verse list the app teaches from. |
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

- Hebrew text: Westminster Leningrad Codex with Strong's numbers and morphology, from the
  OpenScriptures morphhb project (https://github.com/openscriptures/morphhb), CC BY 4.0.
  The verse map in the same project aligns Hebrew and KJV verse numbering.
- Glosses, lemma forms and transliterations: TBESH, the Translators Brief lexicon of
  Extended Strongs for Hebrew, by Tyndale House Cambridge via STEPBible
  (https://github.com/STEPBible/STEPBible-Data), CC BY 4.0. Only the gloss, form,
  transliteration and word-type columns are used.
- James Strong's dictionaries (Hebrew 1894, Greek 1890) are public domain. The JSON
  files come from the Open Scriptures project's XML edition
  (https://github.com/openscriptures/strongs), CC-BY-SA. The only change made here
  is converting the JavaScript modules to plain JSON and sorting the Greek entries.
- The KJV text is public domain. The Strong's tagging is CrossWire Bible Society's
  "King James Version (1769) with Strongs Numbers and Morphology" module
  (https://gitlab.com/crosswire-bible-society/kjv), distributed under the GPL, fetched
  from the copy at https://github.com/scrollmapper/bible_databases. Morphology codes,
  translator notes, and cross references were dropped in the conversion.
