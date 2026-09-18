"""Known forms for the transliterator. Run: python3 hebrew/test_translit.py

Classical forms follow the SBL academic scheme with soft begadkefat letters spelled
out (v gh dh kh f th). Modern forms follow the Israeli reading with syllable dots.
"""
from translit import transliterate

CASES = [
    # word, classical, modern, maqqef
    ("בְּרֵאשִׁית", "bərēʾšîth", "be.re.shit", False),
    ("בָּרָא", "bārāʾ", "ba.ra", False),
    ("אֱלֹהִים", "ʾĕlōhîm", "e.lo.him", False),
    ("אֵת", "ʾēth", "et", False),
    ("הַשָּׁמַיִם", "haššāmayim", "ha.sha.ma.yim", False),
    ("וְאֵת", "wəʾēth", "ve.'et", False),
    ("הָאָרֶץ", "hāʾāreṣ", "ha.'a.rets", False),
    ("יְהוָה", "yəhwâ", "yeh.vah", False),
    ("יְהֹוָה", "yəhōwâ", "ye.ho.vah", False),
    ("מֶלֶךְ", "melekh", "me.lekh", False),
    ("דָּבָר", "dāvār", "da.var", False),
    ("תּוֹרָה", "tôrâ", "to.rah", False),
    ("מֹשֶׁה", "mōšeh", "mo.sheh", False),
    ("דָּוִד", "dāwidh", "da.vid", False),
    ("בַּיִת", "bayith", "ba.yit", False),
    ("יִשְׂרָאֵל", "yiśrāʾēl", "yis.ra.'el", False),
    ("רוּחַ", "rûaḥ", "ru.akh", False),
    ("מָשִׁיחַ", "māšîaḥ", "ma.shi.akh", False),
    ("כָּל", "kol", "kol", True),
    ("כָּל", "kāl", "kal", False),
    ("חָכְמָה", "ḥokhmâ", "khokh.mah", False),
    ("יֹשְׁבִים", "yōšəvîm", "yo.she.vim", False),
    ("מִשְׁפָּט", "mišpāṭ", "mish.pat", False),
    ("צִוָּה", "ṣiwwâ", "tsi.vah", False),
    ("שָׁלוֹם", "šālôm", "sha.lom", False),
    ("קֹדֶשׁ", "qōdheš", "ko.desh", False),
    ("אֲדֹנָי", "ʾădhōnāy", "a.do.nay", False),
    ("הַלְלוּיָהּ", "haləlûyāh", "ha.le.lu.yah", False),
    ("סֵפֶר", "sēfer", "se.fer", False),
    ("מַלְכֵי", "malkhê", "mal.khe", False),
    ("אַתְּ", "ʾatt", "at", False),
    ("עַיִן", "ʿayin", "a.yin", False),
    ("גּוֹי", "gôy", "goy", False),
    ("עָלָיו", "ʿālāyw", "a.lav", False),
    ("שָׂדֶה", "śādheh", "sa.deh", False),
    ("מִצְוֺת", "miṣwōth", "mits.vot", False),
    ("וַיֹּאמֶר", "wayyōʾmer", "va.yo.mer", False),
    ("וַיַּעֲבֹר", "wayyaʿăvōr", "va.ya.'a.vor", False),
    ("הוּא", "hûʾ", "hu", False),
    ("אוֹר", "ʾôr", "or", False),
    ("עָוֹן", "ʿāwōn", "a.von", False),
    ("יִשְׁמְרוּ", "yišmərû", "yish.me.ru", False),
    ("הָֽאָדָם", "hāʾādhām", "ha.'a.dam", False),
    ("יָֽשְׁבוּ", "yāšəvû", "ya.she.vu", False),
    ("בְּתוֹךְ", "bəthôkh", "be.tokh", False),
    ("אֶרֶץ", "ʾereṣ", "e.rets", False),
    ("בֵּית", "bêth", "bet", False),
    ("נֹחַ", "nōaḥ", "no.akh", False),
    ("שָׁמַע", "šāmaʿ", "sha.ma", False),
    ("קָדוֹשׁ", "qādhôš", "ka.dosh", False),
    ("שַׁבָּת", "šabbāth", "sha.bat", False),
    ("מִזְמוֹר", "mizmôr", "miz.mor", False),
    ("רֹעִי", "rōʿî", "ro.'i", False),
    ("וְ", "wə", "ve", False),
    ("בְּ", "bə", "be", False),
    ("וּבַחֲבֻרָתוֹ", "ûvaḥăvurāthô", "u.va.kha.vu.ra.to", False),
    ("וּמֶלֶךְ", "ûmelekh", "u.me.lekh", False),
    ("נִרְפָּא", "nirpāʾ", "nir.pa", True),
    ("אֶת", "ʾeth", "et", True),
    ("שָׂם", "śām", "sam", False),
]

if __name__ == "__main__":
    fails = 0
    for word, cl, mo, mq in CASES:
        a, b = transliterate(word, "classical", mq), transliterate(word, "modern", mq)
        ok = a == cl and b == mo
        if not ok:
            fails += 1
            print(f"FAIL {word:12} classical {a!r} (want {cl!r})  modern {b!r} (want {mo!r})")
    print(f"{len(CASES) - fails} of {len(CASES)} pass")
