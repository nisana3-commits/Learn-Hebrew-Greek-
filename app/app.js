/* Read the Hebrew Bible: frequency vocabulary + spaced repetition + real verses.
   Plain JavaScript, no build step. Data comes from data/*.js (built by hebrew/build_hebrew.py).
   Progress lives in localStorage; export it from Home to keep a copy. */
(function () {
  "use strict";

  const VOCAB = window.HEB_VOCAB.vocab;
  const VERSES = window.HEB_VERSES.verses;
  const TOPICS = window.HEB_VERSES.topics;
  const LADDER = window.HEB_VERSES.ladder;
  const LEX = window.HEB_LEXICON;
  const VOCAB_BY_KEY = Object.fromEntries(VOCAB.map(v => [v.key, v]));

  // ---------- expand the compact verse records ----------
  const PREFIX_GLOSS = { c: "and, but", d: "the", b: "in, with, by", l: "to, for", m: "from, out of", k: "like, as", s: "who, which, that", i: "[question marker]" };
  const STEMS_H = { q: "Qal", N: "Niphal", p: "Piel", P: "Pual", h: "Hiphil", H: "Hophal", t: "Hithpael", o: "Polel", O: "Polal", r: "Hithpolel", m: "Poel", M: "Poal", k: "Palel", K: "Pulal", Q: "Qal passive", l: "Pilpel", L: "Polpal", f: "Hithpalpel", D: "Nithpael", j: "Pealal", i: "Pilel", u: "Hothpaal", c: "Tiphil", v: "Hishtaphel", w: "Nithpalel", y: "Nithpoel", z: "Hithpoel" };
  const STEMS_A = { q: "Peal", Q: "Peil", u: "Hithpeel", p: "Pael", P: "Ithpaal", M: "Hithpaal", a: "Aphel", h: "Haphel", s: "Saphel", e: "Shaphel", H: "Hophal", i: "Ithpeel", t: "Hishtaphel", v: "Ishtaphel", w: "Hithaphel", o: "Polel", z: "Ithpoel", r: "Hithpolel", f: "Hithpalpel", b: "Hephal", c: "Tiphel", m: "Poel", l: "Palpel", L: "Ithpalpel", O: "Ithpolel", G: "Ittaphal" };
  const VTYPES = { p: "perfect", q: "sequential perfect", i: "imperfect", w: "sequential imperfect", h: "cohortative", j: "jussive", v: "imperative", r: "participle", s: "passive participle", a: "infinitive absolute", c: "infinitive construct" };
  const GENDER = { m: "masc.", f: "fem.", b: "both", c: "common" }, NUMBER = { s: "sing.", p: "plur.", d: "dual" }, STATE = { a: "absolute", c: "construct", d: "determined" };
  const PRONOUN = { d: "demonstrative", f: "indefinite", i: "interrogative", p: "personal", r: "relative" };
  const PARTICLE = { a: "affirmation", d: "article", e: "exclamation", i: "interrogative", j: "interjection", m: "negative", o: "object marker", r: "relative" };
  const ADJ = { a: "adjective", c: "cardinal number", o: "ordinal number", g: "gentilic" }, NOUN = { c: "noun", g: "gentilic noun", p: "proper noun" };
  const SUFFIX = { "1cs": "me / my", "1cp": "us / our", "2ms": "you / your (m.)", "2fs": "you / your (f.)", "2mp": "you / your (m. pl.)", "2fp": "you / your (f. pl.)", "3ms": "him / his", "3fs": "her", "3mp": "them / their (m.)", "3fp": "them / their (f.)" };
  function pgn(s) {
    const out = [];
    if ("123".includes(s[0] || "-")) { out.push({ 1: "1st", 2: "2nd", 3: "3rd" }[s[0]]); s = s.slice(1); }
    if (GENDER[s[0]]) { out.push(GENDER[s[0]]); s = s.slice(1); }
    if (NUMBER[s[0]]) { out.push(NUMBER[s[0]]); s = s.slice(1); }
    if (STATE[s[0]]) out.push(STATE[s[0]]);
    return out.join(" ");
  }
  function decodeMorph(code) {
    const lang = code[0];
    return code.slice(1).split("/").filter(Boolean).map(p => {
      const c = p[0], rest = p.slice(1);
      if (c === "R") return "preposition" + (rest === "d" ? " + the" : "");
      if (c === "C") return "conjunction";
      if (c === "D") return "adverb";
      if (c === "T") return PARTICLE[rest] || "particle";
      if (c === "N") return ((NOUN[rest[0]] || "noun") + " " + pgn(rest.slice(1))).trim();
      if (c === "A") return ((ADJ[rest[0]] || "adjective") + " " + pgn(rest.slice(1))).trim();
      if (c === "P") return ((PRONOUN[rest[0]] || "") + " pronoun " + pgn(rest.slice(1))).trim();
      if (c === "V") { const st = (lang === "A" ? STEMS_A : STEMS_H)[rest[0]] || ""; return ["verb", st, VTYPES[rest[1]] || "", pgn(rest.slice(2))].filter(Boolean).join(" "); }
      if (c === "S") return rest[0] === "p" ? "suffix: " + (SUFFIX[rest.slice(1)] || rest.slice(1)) : rest[0] === "d" ? "directional ending (toward)" : rest[0] === "h" ? "paragogic he" : rest[0] === "n" ? "paragogic nun" : "suffix";
      return p;
    });
  }
  for (const id in VERSES) {
    const v = VERSES[id];
    v.kjv = v.seg.map(s => s[0]).join("");
    v.words.forEach((w, i) => {
      w.h = w.parts.join("");
      w.mq = !!w.mq; w.end = !!w.end; w.name = !!w.name;
      const lex = w.key ? LEX[w.key] : null;
      w.gloss = lex ? lex.gloss : (w.pfx.length ? w.pfx.map(p => PREFIX_GLOSS[p] || p).join(" + ") : "");
      w.morph = decodeMorph(w.m);
      w.eng = null;
    });
    for (const [t, wi] of v.seg) if (wi != null && v.words[wi].eng == null) v.words[wi].eng = t.trim();
    v.kjvRef = v.kjvRef || null; v.aramaic = !!v.aramaic; v.star = !!v.star;
  }

  const MIN = 60000, DAY = 86400000;
  const STORE_KEY = "hebrew-srs-v1";

  // ---------- state ----------
  const defaults = () => ({ cards: {}, deferred: {}, settings: { newPerDay: 10, highlightNew: true, autoSpeak: true, speakRate: 0.75, classicalW: true }, log: {} });
  let S = load();
  function load() {
    try { const raw = localStorage.getItem(STORE_KEY); if (raw) return Object.assign(defaults(), JSON.parse(raw)); } catch (e) { /* ignore */ }
    return defaults();
  }
  function save() { try { localStorage.setItem(STORE_KEY, JSON.stringify(S)); } catch (e) { /* ignore */ } }
  const today = () => new Date().toISOString().slice(0, 10);
  function logToday(field) { const d = today(); S.log[d] = S.log[d] || { new: 0, reviews: 0 }; S.log[d][field]++; }

  // ---------- scheduler (SM-2 with learning steps) ----------
  function newCard(kind, id) {
    return { kind, id, state: "new", step: 0, ease: 2.5, ivl: 0, due: Date.now(), reps: 0, lapses: 0, added: Date.now() };
  }
  function preview(card, grade) {
    const c = Object.assign({}, card);
    apply(c, grade, Date.now());
    return c.due - Date.now();
  }
  function apply(c, grade, now) {
    if (c.state === "new" || c.state === "learn") {
      c.state = "learn";
      if (grade === 0) { c.step = 0; c.due = now + 1 * MIN; }
      else if (grade === 1) { c.due = now + 5 * MIN; }
      else if (grade === 2) {
        if (c.step === 0) { c.step = 1; c.due = now + 10 * MIN; }
        else { c.state = "review"; c.ivl = 1; c.due = now + DAY; }
      } else { c.state = "review"; c.ivl = 4; c.due = now + 4 * DAY; }
    } else {
      if (grade === 0) { c.lapses++; c.state = "learn"; c.step = 0; c.ease = Math.max(1.3, c.ease - 0.2); c.ivl = 0; c.due = now + 10 * MIN; }
      else {
        if (grade === 1) { c.ivl = Math.max(1, Math.round(c.ivl * 1.2)); c.ease = Math.max(1.3, c.ease - 0.15); }
        else if (grade === 2) { c.ivl = Math.max(c.ivl + 1, Math.round(c.ivl * c.ease)); }
        else { c.ivl = Math.max(c.ivl + 1, Math.round(c.ivl * c.ease * 1.3)); c.ease += 0.15; }
        c.due = now + c.ivl * DAY;
      }
    }
    c.reps++;
  }
  function grade(cardId, g) {
    const c = S.cards[cardId];
    if (!c) return;
    apply(c, g, Date.now());
    c.streak = g === 0 ? 0 : (c.streak || 0) + 1;
    logToday("reviews");
    save();
  }
  function fmtDelta(ms) {
    if (ms < 60 * MIN) return Math.max(1, Math.round(ms / MIN)) + " min";
    if (ms < DAY) return Math.round(ms / (60 * MIN)) + " h";
    const d = Math.round(ms / DAY);
    if (d < 30) return d + " d";
    if (d < 365) return Math.round(d / 30) + " mo";
    return (d / 365).toFixed(1) + " y";
  }


  // ---------- speech (the device's own Hebrew voice) ----------
  const SPEAK_ICON = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="currentColor" d="M4 9v6h4l5 4V5L8 9H4zm11.5 3a3.5 3.5 0 0 0-2-3.15v6.3a3.5 3.5 0 0 0 2-3.15zM13.5 4.3v2.1a6 6 0 0 1 0 11.2v2.1a8 8 0 0 0 0-15.4z"/></svg>';
  const speech = {
    ok: typeof window.speechSynthesis !== "undefined" && typeof window.SpeechSynthesisUtterance !== "undefined",
    voice: null, looked: false,
    findVoice() {
      if (!this.ok) return null;
      const voices = window.speechSynthesis.getVoices();
      this.looked = voices.length > 0;
      const he = voices.filter(v => /^(he|iw)\b/i.test(v.lang));
      // prefer a non-remote, higher quality voice when the device offers several
      he.sort((a, b) => (b.localService === true) - (a.localService === true) || (/enhanced|premium|natural/i.test(b.name) - /enhanced|premium|natural/i.test(a.name)));
      this.voice = he[0] || null;
      return this.voice;
    },
    say(text) {
      if (!this.ok) return false;
      const v = this.voice || this.findVoice();
      if (!v) return false;
      const clean = text.replace(/[\u0591-\u05AF\u05BD\u05BF\u05C0\u05C3-\u05C6]/g, "").replace(/־/g, " ").replace(/׃/g, "");
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(clean);
      u.voice = v; u.lang = v.lang; u.rate = S.settings.speakRate || 0.75;
      window.speechSynthesis.speak(u);
      return true;
    },
    status() {
      if (!this.ok) return "This browser cannot speak text aloud.";
      if (!this.voice) this.findVoice();
      if (this.voice) return "Hebrew voice: " + this.voice.name + ".";
      if (!this.looked) return "Voices are still loading. Tap a speaker in a moment.";
      return "No Hebrew voice is installed on this device. iPhone: Settings, Accessibility, Spoken Content, Voices, Hebrew. Android: Settings, System, Languages, Text-to-speech, install Hebrew for Google Speech Services.";
    },
  };
  if (speech.ok) { speech.findVoice(); window.speechSynthesis.addEventListener("voiceschanged", () => speech.findVoice()); setTimeout(() => { speech.looked = true; }, 2000); }
  const speakBtn = (text, label) => `<button class="speak" type="button" data-act="speak" data-say="${esc(text)}" aria-label="${esc(label || "Pronounce")}" title="Pronounce">${SPEAK_ICON}</button>`;
  function autoSpeak(text) { if (S.settings.autoSpeak && speech.voice) setTimeout(() => speech.say(text), 150); }

  // ---------- knowledge helpers ----------
  const wordCardId = key => "w:" + key;
  const verseCardId = id => "v:" + id;
  const isKnown = key => !!S.cards[wordCardId(key)];
  function wordKeys(w) {
    const keys = w.pfx.map(p => "pfx:" + p);
    if (w.key && !w.name) keys.push(w.key);
    return keys;
  }
  function newKeysInVerse(v) {
    const set = new Set();
    for (const w of v.words) for (const k of wordKeys(w)) if (!isKnown(k) && VOCAB_BY_KEY[k]) set.add(k);
    return [...set];
  }
  function rareKeysInVerse(v) {
    const set = new Set();
    for (const w of v.words) if (w.key && !w.name && !VOCAB_BY_KEY[w.key]) set.add(w.key);
    return [...set];
  }
  function nextNewWords(n) {
    const out = [];
    const later = [];
    for (const v of VOCAB) {
      if (isKnown(v.key)) continue;
      if (S.deferred[v.key]) { later.push(v); continue; }
      out.push(v);
      if (out.length >= n) break;
    }
    while (out.length < n && later.length) out.push(later.shift());
    return out;
  }
  function newLeftToday() {
    const used = (S.log[today()] || { new: 0 }).new;
    return Math.max(0, S.settings.newPerDay - used);
  }
  function startWord(key, alreadyKnown) {
    if (S.cards[wordCardId(key)]) return;
    const c = newCard("word", key);
    if (alreadyKnown) { c.state = "review"; c.ivl = 30; c.due = Date.now() + 30 * DAY; c.reps = 1; c.streak = 3; }
    else { apply(c, 2, Date.now()); c.streak = 1; logToday("new"); }
    S.cards[wordCardId(key)] = c;
    delete S.deferred[key];
    save();
  }
  function startVerse(id) {
    if (S.cards[verseCardId(id)]) return;
    const c = newCard("verse", id);
    apply(c, 2, Date.now());
    S.cards[verseCardId(id)] = c;
    save();
  }
  function dueCards(aheadMs) {
    const now = Date.now() + (aheadMs || 0);
    return Object.values(S.cards).filter(c => c.due <= now)
      .sort((a, b) => (a.state === "review") - (b.state === "review") || a.due - b.due);
  }
  const keyBase = k => (k || "").replace(/[a-z]$/, "");
  // a word shows up in Hebrew inside English verses once it has been answered right twice
  const isPracticed = key => { const c = S.cards[wordCardId(key)]; return !!c && ((c.streak || 0) >= 2 || c.state === "review"); };
  const isMastered = c => (c.streak || 0) >= 3 || (c.state === "review" && c.ivl >= 21);
  function stats() {
    const cards = Object.values(S.cards);
    const words = cards.filter(c => c.kind === "word");
    return {
      words: words.length,
      mastered: words.filter(isMastered).length,
      mature: words.filter(c => c.state === "review" && c.ivl >= 21).length,
      verses: cards.filter(c => c.kind === "verse").length,
      due: dueCards().length,
      readable: LADDER.concat(TOPICS.flatMap(t => t.verses)).filter((id, i, a) => a.indexOf(id) === i)
        .filter(id => newKeysInVerse(VERSES[id]).length === 0 && rareKeysInVerse(VERSES[id]).length === 0).length,
    };
  }

  // verses that contain a key, easiest first
  const INDEX = {};
  for (const id in VERSES) for (const w of VERSES[id].words) {
    for (const k of wordKeys(w).concat(w.key && w.name ? [w.key] : [])) (INDEX[k] = INDEX[k] || new Set()).add(id);
  }
  for (const k in INDEX) INDEX[k] = [...INDEX[k]].sort((a, b) => VERSES[a].aramaic - VERSES[b].aramaic || VERSES[a].level - VERSES[b].level || VERSES[a].words.length - VERSES[b].words.length);

  // ---------- rendering helpers ----------
  // transliteration: classical (vav as w) or modern Israeli (vav as v)
  const tr = o => (o && (S.settings.classicalW && o.translitW ? o.translitW : o.translit)) || "";
  const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  function typeLabel(t) {
    if (!t) return "";
    if (t.startsWith("N:")) {
      const x = t.split("-").pop();
      return { P: "name (person)", L: "name (place)", T: "name (title)", PG: "name (people group)", LG: "name (people group)" }[x] || "name";
    }
    const m = t.match(/^[HA]:([A-Za-z]+)(?:-([A-Z]+))?/);
    if (!m) return t;
    const base = { N: "noun", V: "verb", A: "adjective", Adv: "adverb", Prep: "preposition", Conj: "conjunction", Part: "particle",
      Neg: "negative", RelP: "relative pronoun", PerP: "personal pronoun", DemP: "demonstrative", Intg: "interrogative", Intj: "interjection",
      Art: "article", Cond: "conditional", ImpP: "impersonal pronoun", PosP: "possessive pronoun", RefP: "reflexive pronoun", Cor: "correlative" }[m[1]] || m[1];
    const g = { M: "masc.", F: "fem.", C: "common", N: "neut." }[m[2]] || "";
    return (t.startsWith("A:") ? "Aramaic " : "") + base + (g ? ", " + g : "");
  }
  function renderWord(w, i, opts) {
    opts = opts || {};
    const keys = wordKeys(w);
    const isNew = keys.some(k => !isKnown(k) && VOCAB_BY_KEY[k]);
    const cls = ["w", w.name ? "name" : "", isNew ? "new" : "", opts.hl === i ? "hl" : ""].filter(Boolean).join(" ");
    const parts = w.parts.map((p, j) => `<span class="${j < w.pfx.length ? "p" : "m"}">${esc(p)}</span>`).join("");
    return `<span class="${cls}" data-i="${i}">${parts}</span>${w.mq ? "־" : w.end ? "׃ " : " "}`;
  }
  function renderVerse(v, opts) {
    return `<div class="heb heb-verse${S.settings.highlightNew ? "" : " hide-new"}" data-verse="${v.id}">${v.words.map((w, i) => renderWord(w, i, opts)).join("")}</div>`;
  }
  function wordPanel(v, i) {
    const w = v.words[i];
    const key = w.key;
    const lex = key ? (LEX[key] || {}) : {};
    const voc = key ? VOCAB_BY_KEY[key] : null;
    const pfxGloss = w.pfx.map(p => VOCAB_BY_KEY["pfx:" + p] ? `${esc(VOCAB_BY_KEY["pfx:" + p].heb)} ${esc(VOCAB_BY_KEY["pfx:" + p].gloss)}` : p);
    let status = "";
    if (key && !w.name) {
      if (isKnown(key)) status = `<span class="pill ok">In your reviews</span>`;
      else if (voc) status = `<button class="btn sm primary" data-act="learn-word" data-key="${esc(key)}">Add to reviews</button>`;
      else status = `<span class="pill gray">Rare word (${lex.count || 0}×)</span>`;
    }
    return `<div class="wpanel">
      <div class="row between">
        <div><span class="heb">${esc(w.h)}</span> <span class="translit">${esc(tr(w) || tr(lex))}</span> ${speakBtn(w.h, "Pronounce")}</div>
        ${status}
      </div>
      <div class="gloss">${esc(w.gloss || lex.gloss || "")}</div>
      <dl>
        ${w.pfx.length ? `<dt>Prefix${w.pfx.length > 1 ? "es" : ""}</dt><dd>${pfxGloss.join(" + ")}</dd>` : ""}
        ${key ? `<dt>Lemma</dt><dd><span class="heb heb-small">${esc(lex.heb || "")}</span> ${esc(typeLabel(lex.type))}${lex.rank ? `, word #${lex.rank}` : ""}${lex.count ? `, ${lex.count}× in the Hebrew Bible` : ""}</dd>` : ""}
        <dt>Grammar</dt><dd>${esc(w.morph.join(" · "))}</dd>
        ${w.eng ? `<dt>KJV here</dt><dd>${esc(w.eng)}</dd>` : ""}
        ${key ? `<dt>Strong's</dt><dd>${esc(key.replace(/[a-z]$/, ""))} <button class="btn sm quiet" data-act="word-sheet" data-key="${esc(key)}">More verses</button></dd>` : ""}
      </dl>
    </div>`;
  }
  function verseRow(id) {
    const v = VERSES[id];
    const n = newKeysInVerse(v).length + rareKeysInVerse(v).length;
    const badge = n === 0 ? `<span class="pill ok">Ready</span>` : `<span class="pill${n > 2 ? " gray" : ""}">${n} new</span>`;
    return `<li data-act="open-verse" data-id="${id}"><span class="ref">${v.star ? "★ " : ""}${esc(v.ref)}</span><span class="heb">${esc(v.words.map(w => w.h).join(" "))}</span>${badge}</li>`;
  }
  function kjvBlock(v) {
    return `<div class="kjv"><span class="ref">${esc(v.ref)}${v.kjvRef ? " (KJV " + esc(v.kjvRef) + ")" : ""}</span>${esc(v.kjv)}</div>`;
  }

  // ---------- views ----------
  const view = document.getElementById("view");
  let current = { tab: "home" };

  function route() {
    const h = location.hash.replace(/^#/, "") || "home";
    let [name, arg] = h.split("/");
    if (name === "learn" || name === "review") name = "study";
    current = { tab: name, arg: arg ? decodeURIComponent(arg) : null };
    document.querySelectorAll("#tabs a").forEach(a => a.classList.toggle("active", a.dataset.tab === (name === "verse" || name === "topic" ? "read" : name)));
    const r = { home: renderHome, study: renderStudy, read: renderRead, verse: renderVersePage, topic: renderTopic, words: renderWords }[name] || renderHome;
    view.innerHTML = r(current.arg);
    if (name !== "study") study.phase = study.phase === "verses" ? "verses" : "ask";
    const g = document.getElementById("guess"); if (g && study.phase === "ask") g.focus();
    window.scrollTo(0, 0);
    updateBadge();
  }
  function updateBadge() {
    const b = document.getElementById("due-badge");
    const n = dueCards().length;
    b.hidden = n === 0;
    b.textContent = n;
  }

  function renderHome() {
    const st = stats();
    const pct = Math.min(100, Math.round(100 * st.words / VOCAB.length));
    const left = newLeftToday();
    return `
      <div class="stats">
        <div class="stat"><b>${st.due}</b><span>Due now</span></div>
        <div class="stat"><b>${st.mastered}</b><span>Mastered</span></div>
        <div class="stat"><b>${st.readable}</b><span>Verses ready</span></div>
      </div>
      <div class="card stack" style="margin-top:14px">
        <div class="progress"><i style="width:${pct}%"></i><b>${st.words} of ${VOCAB.length} words started</b></div>
        <p class="small muted">Each study card asks you for the meaning first, then shows the word inside real verses. Words you have answered right twice start appearing in Hebrew inside every English verse, so Scripture turns into Hebrew as you go.</p>
        <div class="row">
          <a class="btn primary" href="#study">Study${st.due ? " (" + st.due + " due)" : left ? " (" + left + " new)" : ""}</a>
          <a class="btn" href="#read">Read</a>
          <a class="btn" href="#words">All words</a>
        </div>
      </div>
      <div class="section-title">Today</div>
      <div class="card small">
        ${(S.log[today()] || { new: 0, reviews: 0 }).new} new words, ${(S.log[today()] || { new: 0, reviews: 0 }).reviews} answers. ${st.words} words started, ${st.mastered} mastered (three right in a row). ${st.verses} verses in your reviews.
      </div>
      <div class="section-title">Settings</div>
      <div class="card stack small">
        <label class="opt" for="new-per-day">New words per day <input id="new-per-day" type="number" min="1" max="100" value="${S.settings.newPerDay}" data-act="set-new-per-day"></label>
        <label class="opt" for="highlight-new"><input id="highlight-new" type="checkbox" ${S.settings.highlightNew ? "checked" : ""} data-act="toggle-highlight"> Colour words I have not started yet in rose</label>
        <label class="opt" for="classical-w"><input id="classical-w" type="checkbox" ${S.settings.classicalW ? "checked" : ""} data-act="toggle-w"> Classical transliteration (off: modern Israeli with syllable dots)</label>
        <details class="key"><summary>Transliteration key</summary>
          <p>Classical follows the SBL academic scheme, with the six soft letters spelled as they sound. Every word is transliterated from its own pointed form in the verse.</p>
          <table>
            <tr><th>Letter</th><th>Classical</th><th>Modern</th></tr>
            <tr><td class="heb">א</td><td>ʾ (catch in the throat)</td><td>silent</td></tr>
            <tr><td class="heb">בּ / ב</td><td>b / v</td><td>b / v</td></tr>
            <tr><td class="heb">גּ / ג</td><td>g / gh</td><td>g</td></tr>
            <tr><td class="heb">דּ / ד</td><td>d / dh (the)</td><td>d</td></tr>
            <tr><td class="heb">ו</td><td>w</td><td>v</td></tr>
            <tr><td class="heb">ח</td><td>ḥ (deep in the throat)</td><td>kh</td></tr>
            <tr><td class="heb">ט</td><td>ṭ (emphatic t)</td><td>t</td></tr>
            <tr><td class="heb">כּ / כ</td><td>k / kh (Bach)</td><td>k / kh</td></tr>
            <tr><td class="heb">ע</td><td>ʿ (voiced, in the throat)</td><td>silent</td></tr>
            <tr><td class="heb">פּ / פ</td><td>p / f</td><td>p / f</td></tr>
            <tr><td class="heb">צ</td><td>ṣ (emphatic s; ts is accepted)</td><td>ts</td></tr>
            <tr><td class="heb">ק</td><td>q (far back)</td><td>k</td></tr>
            <tr><td class="heb">שׁ / שׂ</td><td>š / ś</td><td>sh / s</td></tr>
            <tr><td class="heb">תּ / ת</td><td>t / th (thin)</td><td>t</td></tr>
            <tr><td>Vowels</td><td>ā ē ō long, a e i o u short, î ê ô û â written with a vowel letter, ə a quick e</td><td>a e i o u</td></tr>
            <tr><td>Doubled letter</td><td>held longer (haššāmayim)</td><td>not marked</td></tr>
          </table>
        </details>
        <label class="opt" for="auto-speak"><input id="auto-speak" type="checkbox" ${S.settings.autoSpeak ? "checked" : ""} data-act="toggle-speak"> Say each word aloud when it appears or is tapped</label>
        <label class="opt" for="speak-rate">Speaking speed <select id="speak-rate" data-act="set-rate"><option value="0.6" ${S.settings.speakRate == 0.6 ? "selected" : ""}>Slow</option><option value="0.75" ${S.settings.speakRate == 0.75 ? "selected" : ""}>Learner</option><option value="0.9" ${S.settings.speakRate == 0.9 ? "selected" : ""}>Natural</option></select></label>
        <p class="muted">Pronunciation uses the Hebrew voice built into your phone or computer, which speaks modern Israeli Hebrew (vav as v). ${esc(speech.status())}</p>
        <div class="row">
          <button class="btn sm" data-act="export">Export progress</button>
          <button class="btn sm" data-act="import">Import</button>
          <button class="btn sm quiet" data-act="reset">Reset everything</button>
        </div>
        <div id="io-box" hidden></div>
        <p class="muted">Progress is stored in this browser only. Export a copy before switching phones or clearing site data.</p>
      </div>
      <div class="section-title">Sources</div>
      <p class="small muted">Hebrew text: Westminster Leningrad Codex with Strong's numbers and morphology (OpenScriptures, CC BY 4.0). Glosses: Tyndale House STEPBible TBESH (CC BY 4.0). English: King James Version.</p>`;
  }

  // ---------- study loop: ask, reveal, verses ----------
  let study = { id: null, phase: "ask", guess: "", shuffle: 1, isNew: false };
  function nextStudyItem() {
    const fromPool = pool => {
      if (!pool.length) return null;
      const c = pool.find(x => x.kind + ":" + x.id !== study.last) || pool[0];
      return { id: c.kind + ":" + c.id, kind: c.kind, key: c.kind === "word" ? c.id : null, verse: c.kind === "verse" ? c.id : null, isNew: false };
    };
    const due = fromPool(dueCards());
    if (due) return due;
    if (newLeftToday() > 0) {
      const v = nextNewWords(1)[0];
      if (v) return { id: "new:" + v.key, kind: "word", key: v.key, isNew: true };
    }
    return fromPool(dueCards(20 * MIN).filter(c => c.state === "learn"));
  }
  function seededPick(arr, n, seed) {
    let s = seed * 9301 + 49297;
    const rand = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a.slice(0, n);
  }
  const wordHas = (w, key) => key.startsWith("pfx:") ? w.pfx.includes(key.slice(4)) : keyBase(w.key) === keyBase(key);
  // verses that carry the word: Bible-truth topic verses first, then the easiest ladder verses
  function versesForWord(key) {
    const all = (INDEX[key] || []).filter(id => !VERSES[id].aramaic && VERSES[id].seg.some(([, wi]) => wi != null && wordHas(VERSES[id].words[wi], key)));
    return { key: all.filter(id => VERSES[id].star), topical: all.filter(id => VERSES[id].topics.length && !VERSES[id].star),
             rest: all.filter(id => !VERSES[id].topics.length).slice(0, 24) };
  }
  const TOPIC_TITLE = Object.fromEntries(TOPICS.map(t => [t.id, t.title]));
  // English verse with the target word, and every practiced word, shown in Hebrew
  function renderSwappedVerse(v, targetKey) {
    let swapped = 0;
    const html = v.seg.map(([t, wi]) => {
      if (wi == null) return esc(t);
      const w = v.words[wi];
      const isTarget = wordHas(w, targetKey);
      const keys = w.pfx.map(p => "pfx:" + p).concat(w.key ? [w.key] : []);
      const practiced = keys.length > 0 && keys.every(isPracticed);
      if (!isTarget && !practiced) return esc(t);
      if (!isTarget) swapped++;
      return `<span class="w heb heb-inline${isTarget ? " target" : ""}" data-i="${wi}" title="${esc(t)}">${esc(w.h)}</span>`;
    }).join("");
    return { html, swapped };
  }
  function dots(c) {
    const s = c ? (c.streak || 0) : 0;
    const cls = s >= 5 ? "gold" : s >= 3 ? "ok" : s >= 1 ? "on" : "";
    return `<div class="dots" aria-label="${s} in a row">${[0, 1, 2, 3, 4].map(i => `<i class="${s > i ? cls : ""}"></i>`).join("")}</div>`;
  }
  function renderStudy() {
    if (study.phase === "verses" && study.key) return renderVersesPhase();
    const item = nextStudyItem();
    if (!item) return renderCaughtUp();
    if (study.id !== item.id) study = { id: item.id, phase: "ask", guess: "", shuffle: 1, isNew: item.isNew, key: item.key, verse: item.verse, last: study.last };
    const due = dueCards().length;
    const left = newLeftToday();
    const head = (label) => `<div class="row between small muted"><span>${due} due${study.isNew ? " · new word" : " · " + label}</span><span>${left} new left today</span></div>`;
    if (item.kind === "verse") {
      const v = VERSES[item.verse];
      if (!v) { delete S.cards[item.id]; save(); return renderStudy(); }
      return head("verse") + `<div class="card">
        <div class="row between small muted"><span>${esc(v.ref)} · tap a word for its meaning</span>${speakBtn(v.words.map(w => w.h).join(" "), "Read the verse aloud")}</div>
        ${renderVerse(v)}
        <div id="vpanel"></div>
        ${study.phase === "reveal" ? kjvBlock(v) : ""}
      </div>` + (study.phase === "reveal" ? verdictButtons() : `<button class="btn primary block" data-act="reveal">Show English</button>`);
    }
    const v = VOCAB_BY_KEY[item.key] || Object.assign({ key: item.key, heb: "", gloss: "", translit: "", type: "", count: 0 }, LEX[item.key] || {});
    const card = S.cards[wordCardId(item.key)];
    if (study.phase === "ask") autoSpeak(v.heb);
    const guessLine = study.guess ? `<div class="small muted">Your guess: <em>${esc(study.guess)}</em></div>` : "";
    const ask = `<div class="ask">
        <label class="small muted center" for="guess">What does it mean?</label>
        <div class="row nowrap">
          <input id="guess" type="text" autocomplete="off" autocapitalize="off" placeholder="Type the English meaning" value="${esc(study.guess)}" data-act="guess">
          <button class="btn primary" data-act="submit-guess" aria-label="Check">→</button>
        </div>
        <button class="btn quiet sm" data-act="reveal">Show answer</button>
      </div>`;
    const reveal = `<div class="answer">
        <div class="small muted eyebrow-label">Answer</div>
        <div class="gloss">${esc(v.gloss)}</div>
        <div class="small muted">${esc(typeLabel(v.type))}${v.kjv ? " · KJV: " + esc(v.kjv.slice(0, 3).join(", ")) : ""} · ${(v.count || 0).toLocaleString()}× in the Hebrew Bible</div>
        ${guessLine}
      </div>` + verdictButtons();
    return head(card && card.state === "review" ? "review" : "learning") + `<div class="card study">
        <div class="small muted eyebrow-label">${esc(keyBase(item.key).startsWith("pfx") ? "prefix" : keyBase(item.key))}${v.rank ? " · word #" + v.rank : ""}</div>
        <div class="heb heb-big">${esc(v.heb)}</div>
        <div class="center translit">${esc(tr(v))} ${speakBtn(v.heb, "Pronounce")}</div>
        ${dots(card)}
        ${study.phase === "ask" ? ask : reveal}
      </div>`;
  }
  function verdictButtons() {
    return `<div class="verdict">
      <button class="btn missed" data-act="verdict" data-g="0">Missed</button>
      <button class="btn got" data-act="verdict" data-g="2">Got it</button>
    </div>`;
  }
  function renderVersesPhase() {
    const key = study.key;
    const v = VOCAB_BY_KEY[key] || LEX[key] || {};
    const { key: keyVerses, topical, rest } = versesForWord(key);
    const pick = seededPick(keyVerses, 5, study.shuffle);
    if (pick.length < 5) pick.push(...seededPick(topical, 5 - pick.length, study.shuffle));
    if (pick.length < 5) pick.push(...seededPick(rest, 5 - pick.length, study.shuffle));
    const total = keyVerses.length + topical.length + rest.length;
    let anySwapped = false;
    const list = pick.map(id => {
      const vs = VERSES[id];
      const { html, swapped } = renderSwappedVerse(vs, key);
      if (swapped) anySwapped = true;
      const topic = vs.topics.length ? `<a class="pill" href="#topic/${esc(vs.topics[0])}">${esc(TOPIC_TITLE[vs.topics[0]] || "")}</a>` : "";
      return `<div class="card verse-en" data-verse="${id}">
        <div class="row between"><span class="small muted eyebrow-label">${esc(vs.ref)}</span>${topic}</div>
        <div class="en">${html}</div>
        <div class="vpanel-slot"></div>
      </div>`;
    }).join("");
    return `<div class="center" style="margin-bottom:12px">
        <div class="heb heb-big">${esc(v.heb)}</div>
        <div class="gloss center">${esc(v.gloss)}</div>
        <div class="small muted">${keyVerses.length || topical.length ? "This word in the Bible truths you are studying." : "This word in Scripture."} Tap a Hebrew word to hear it.</div>
      </div>
      ${list || `<div class="card small muted">No verses in this app carry this word on its own yet.</div>`}
      ${anySwapped ? `<p class="small muted center">Words you have practiced appear in Hebrew too.</p>` : ""}
      <div class="row" style="justify-content:center">
        ${total > 5 ? `<button class="btn" data-act="shuffle-verses">Different verses</button>` : ""}
        <button class="btn primary" data-act="continue">Continue</button>
      </div>`;
  }
  function renderCaughtUp() {
    const all = Object.values(S.cards);
    const next = all.length ? Math.min(...all.map(x => x.due)) - Date.now() : null;
    const st = stats();
    const noNew = newLeftToday() === 0 && nextNewWords(1).length > 0;
    return `<div class="card center stack">
      <div class="heb heb-big">שָׁלוֹם</div>
      <h2>All caught up</h2>
      <p class="muted">${all.length ? "Next review in " + fmtDelta(Math.max(next, MIN)) + "." : "Your first words will appear here."}${noNew ? " You have started today's " + S.settings.newPerDay + " new words." : ""}</p>
      <div class="stats"><div class="stat"><b>${st.mastered}</b><span>Mastered</span></div><div class="stat"><b>${st.words - st.mastered}</b><span>In progress</span></div><div class="stat"><b>${st.readable}</b><span>Verses ready</span></div></div>
      <div class="row" style="justify-content:center">
        <a class="btn" href="#read">Read</a>
        ${noNew ? `<button class="btn quiet sm" data-act="one-more">Study one more new word</button>` : ""}
      </div>
    </div>`;
  }

  function renderWords() {
    const q = (study.wordsQuery || "").toLowerCase();
    const status = key => {
      const c = S.cards[wordCardId(key)];
      if (!c) return ["", "not started"];
      if (isMastered(c)) return ["gold", "mastered"];
      if (c.due <= Date.now()) return ["due", "due now"];
      if (c.state === "review") return ["ok", "reviewing"];
      return ["on", "learning"];
    };
    let rows = VOCAB;
    if (q) rows = rows.filter(v => v.gloss.toLowerCase().includes(q) || tr(v).toLowerCase().includes(q) || v.heb.includes(q) || v.key.toLowerCase() === q);
    const started = rows.filter(v => S.cards[wordCardId(v.key)]);
    const upcoming = rows.filter(v => !S.cards[wordCardId(v.key)]).slice(0, q ? 60 : 30);
    const row = v => { const [cls, label] = status(v.key); const c = S.cards[wordCardId(v.key)]; return `<li data-act="word-sheet" data-key="${esc(v.key)}"><i class="dot ${cls}" title="${label}"></i><span class="heb heb-small">${esc(v.heb)}</span><span class="small">${esc(v.gloss)}</span><span class="small muted right">${c && c.streak ? c.streak + " ✦" : "#" + v.rank}</span></li>`; };
    return `<div class="section-title">All words</div>
      <input id="words-q" type="search" placeholder="Search meaning, sound, or Hebrew" value="${esc(study.wordsQuery || "")}" data-act="words-query" class="search">
      <p class="small muted">${VOCAB.length.toLocaleString()} words in frequency order. ${started.length} started.</p>
      ${started.length ? `<div class="section-title">Started (${started.length})</div><ul class="list words">${started.map(row).join("")}</ul>` : ""}
      <div class="section-title">Next up</div><ul class="list words">${upcoming.map(row).join("")}</ul>`;
  }

  function renderRead() {
    const ready = [], one = [], two = [], more = [];
    for (const id of LADDER) {
      const n = newKeysInVerse(VERSES[id]).length;
      (n === 0 ? ready : n === 1 ? one : n === 2 ? two : more).push(id);
    }
    const group = (title, ids, limit) => ids.length ? `<div class="section-title">${title} (${ids.length})</div><ul class="list">${ids.slice(0, limit).map(verseRow).join("")}</ul>${ids.length > limit ? `<p class="small muted">Showing ${limit}. Learn more words and the list moves.</p>` : ""}` : "";
    return `
      <div class="section-title">Bible truths, verse by verse</div>
      ${TOPICS.map(t => {
        const r = t.verses.filter(id => newKeysInVerse(VERSES[id]).length === 0 && rareKeysInVerse(VERSES[id]).length === 0).length;
        return `<div class="card topic" data-act="open-topic" data-id="${t.id}"><div class="row between"><h3>${esc(t.title)}</h3><span class="pill${r ? " ok" : " gray"}">${r} of ${t.verses.length} ready</span></div><div class="small muted">${esc(t.blurb)}</div></div>`;
      }).join("")}
      <div class="heart-rule">♥</div>
      <div class="section-title">Reading ladder</div>
      <p class="small muted">Short verses built only from the most common words. Each one is placed by the rarest word in it, so the list grows as you learn.</p>
      ${group("Ready to read", ready.slice().reverse(), 40)}
      ${group("One new word", one, 25)}
      ${group("Two new words", two, 15)}
      ${group("Further along", more, 10)}`;
  }

  function renderTopic(id) {
    const t = TOPICS.find(x => x.id === id);
    if (!t) return renderRead();
    return `<a class="btn quiet sm" href="#read">← All topics</a>
      <h2 style="margin:8px 0 4px">${esc(t.title)}</h2>
      <p class="muted">${esc(t.blurb)} Starred verses are the key texts; the rest are the passages they come from.</p>
      <ul class="list">${t.verses.map(verseRow).join("")}</ul>`;
  }

  let versePage = { id: null, revealed: false };
  function renderVersePage(id) {
    const v = VERSES[id];
    if (!v) return renderRead();
    if (versePage.id !== id) versePage = { id, revealed: false };
    const newKeys = newKeysInVerse(v);
    const rare = rareKeysInVerse(v);
    const inReviews = !!S.cards[verseCardId(id)];
    const back = v.topics.length ? `#topic/${v.topics[0]}` : "#read";
    const topicNames = v.topics.map(tid => (TOPICS.find(t => t.id === tid) || {}).title).filter(Boolean);
    return `<a class="btn quiet sm" href="${back}">← Back</a>
      <div class="card">
        <div class="row between small muted"><span>${esc(v.ref)}${v.aramaic ? " · Aramaic" : ""} ${speakBtn(v.words.map(w => w.h).join(" "), "Read the verse aloud")}</span><span>${newKeys.length === 0 && rare.length === 0 ? '<span class="pill ok">All words known</span>' : `${newKeys.length + rare.length} new word${newKeys.length + rare.length === 1 ? "" : "s"}`}</span></div>
        ${renderVerse(v)}
        <div id="vpanel"></div>
        ${versePage.revealed ? kjvBlock(v) : `<button class="btn block" data-act="reveal-verse">Show English</button>`}
      </div>
      <div class="row">
        ${inReviews ? `<span class="pill ok">In your reviews</span>` : `<button class="btn primary" data-act="start-verse" data-id="${id}">Add verse to reviews</button>`}
        ${newKeys.length ? `<button class="btn" data-act="learn-verse-words" data-id="${id}">Start its ${newKeys.length} new word${newKeys.length === 1 ? "" : "s"}</button>` : ""}
      </div>
      ${topicNames.length ? `<p class="small muted" style="margin-top:12px">Topics: ${esc(topicNames.join(", "))}</p>` : ""}
      ${v.aramaic ? `<div class="notice">This verse is in Aramaic, the language of parts of Daniel and Ezra. Its words are glossed but they do not count toward your Hebrew vocabulary.</div>` : ""}`;
  }

  // ---------- word sheet ----------
  const sheet = document.getElementById("sheet");
  const sheetBody = document.getElementById("sheet-body");
  function openWordSheet(key) {
    const lex = LEX[key] || {};
    const voc = VOCAB_BY_KEY[key];
    const ids = (INDEX[key] || []).slice(0, 25);
    sheetBody.innerHTML = `
      <div class="heb heb-big">${esc(lex.heb || (voc && voc.heb) || "")}</div>
      <div class="center translit">${esc(tr(lex))} ${speakBtn(lex.heb || (voc && voc.heb) || "", "Pronounce")}</div>
      <div class="center gloss">${esc(lex.gloss || "")}</div>
      <div class="center small muted">${esc(typeLabel(lex.type))} · ${lex.count || 0}× in the Hebrew Bible${lex.rank ? " · word #" + lex.rank : ""}</div>
      ${voc && voc.kjv ? `<div class="center small">KJV: ${esc(voc.kjv.join(", "))}</div>` : ""}
      <div class="center" style="margin:12px 0">${isKnown(key) ? '<span class="pill ok">In your reviews</span>' : voc ? `<button class="btn primary sm" data-act="learn-word" data-key="${esc(key)}">Add to reviews</button>` : ""}</div>
      <div class="section-title">Verses in this app with this word</div>
      <ul class="list">${ids.map(verseRow).join("")}</ul>`;
    sheet.hidden = false;
  }
  document.getElementById("sheet-close").onclick = () => { sheet.hidden = true; };
  sheet.addEventListener("click", e => { if (e.target === sheet) sheet.hidden = true; });

  // ---------- events ----------
  document.body.addEventListener("click", e => {
    const wEl = e.target.closest(".w");
    if (wEl) {
      const container = wEl.closest("[data-verse]");
      if (!container) return;
      const v = VERSES[container.dataset.verse];
      const i = +wEl.dataset.i;
      container.querySelectorAll(".w.active").forEach(x => x.classList.remove("active"));
      wEl.classList.add("active");
      const panel = container.querySelector(".vpanel-slot") || container.parentElement.querySelector("#vpanel, #ex-panel") || container.nextElementSibling;
      if (panel) panel.innerHTML = wordPanel(v, i);
      if (S.settings.autoSpeak) speech.say(v.words[i].h);
      return;
    }
    const el = e.target.closest("[data-act]");
    if (!el) return;
    const act = el.dataset.act;
    if (act === "speak") {
      if (!speech.say(el.dataset.say)) {
        let n = document.getElementById("speech-note");
        if (!n) { n = document.createElement("div"); n.id = "speech-note"; n.className = "notice"; el.closest(".card, .sheet-card, .wpanel, #view").appendChild(n); }
        n.textContent = speech.status();
      }
      return;
    }
    if (act === "one-more") { S.settings.newPerDay++; save(); route(); }
    else if (act === "learn-word") { startWord(el.dataset.key, false); sheet.hidden = true; route(); }
    else if (act === "word-sheet") { openWordSheet(el.dataset.key); }
    else if (act === "submit-guess" || act === "reveal") {
      const g = document.getElementById("guess"); if (g) study.guess = g.value.trim();
      if (act === "submit-guess" && !study.guess) { g.classList.add("shake"); setTimeout(() => g.classList.remove("shake"), 400); return; }
      study.phase = "reveal"; route();
    }
    else if (act === "verdict") {
      const g = +el.dataset.g;
      if (study.isNew) {
        const c = newCard("word", study.key); apply(c, g, Date.now()); c.streak = g === 0 ? 0 : 1; logToday("new");
        S.cards[wordCardId(study.key)] = c; delete S.deferred[study.key]; save();
      } else grade(study.id, g);
      study.last = study.id;
      if (study.key) { study.phase = "verses"; study.shuffle = 1; } else study.phase = "ask";
      route();
    }
    else if (act === "shuffle-verses") { study.shuffle++; route(); }
    else if (act === "continue") { study.phase = "ask"; study.id = null; route(); }
    else if (act === "open-verse") { sheet.hidden = true; location.hash = "#verse/" + el.dataset.id; }
    else if (act === "open-topic") { location.hash = "#topic/" + el.dataset.id; }
    else if (act === "reveal-verse") { versePage.revealed = true; route(); }
    else if (act === "start-verse") { startVerse(el.dataset.id); route(); }
    else if (act === "learn-verse-words") { for (const k of newKeysInVerse(VERSES[el.dataset.id])) startWord(k, false); route(); }
    else if (act === "export") {
      const box = document.getElementById("io-box");
      box.hidden = false;
      box.innerHTML = `<p class="small muted">Copy this text somewhere safe (a note, an email to yourself). Paste it back with Import on another device.</p><textarea class="io" id="io-text" readonly>${esc(JSON.stringify(S))}</textarea><div class="row"><button class="btn sm" data-act="copy-io">Copy</button><button class="btn sm quiet" data-act="close-io">Close</button></div>`;
      document.getElementById("io-text").select();
    }
    else if (act === "import") {
      const box = document.getElementById("io-box");
      box.hidden = false;
      box.innerHTML = `<p class="small muted">Paste an export here.</p><textarea class="io" id="io-text" placeholder="{&quot;cards&quot;: ...}"></textarea><div class="row"><button class="btn sm primary" data-act="load-io">Load</button><button class="btn sm quiet" data-act="close-io">Close</button></div><div id="io-msg" class="small"></div>`;
    }
    else if (act === "copy-io") {
      const t = document.getElementById("io-text"); t.select();
      const done = () => { el.textContent = "Copied"; };
      if (navigator.clipboard) navigator.clipboard.writeText(t.value).then(done, () => document.execCommand("copy") && done());
      else if (document.execCommand("copy")) done();
    }
    else if (act === "load-io") {
      const msg = document.getElementById("io-msg");
      try {
        const d = JSON.parse(document.getElementById("io-text").value);
        if (d && d.cards) { S = Object.assign(defaults(), d); save(); route(); }
        else msg.textContent = "That text is not an export from this app.";
      } catch (err) { msg.textContent = "Could not read that text. Paste the whole export."; }
    }
    else if (act === "close-io") { document.getElementById("io-box").hidden = true; }
    else if (act === "reset") {
      if (el.dataset.confirm) { S = defaults(); save(); route(); }
      else { el.dataset.confirm = "1"; el.textContent = "Tap again to erase all progress"; }
    }
  });
  document.body.addEventListener("input", e => {
    const el = e.target.closest("[data-act]");
    if (!el) return;
    if (el.dataset.act === "guess") study.guess = el.value;
    else if (el.dataset.act === "words-query") { study.wordsQuery = el.value; const ul = document.querySelectorAll(".list.words"); if (ul.length) { const pos = window.scrollY; view.innerHTML = renderWords(); const q = document.getElementById("words-q"); q.focus(); q.setSelectionRange(q.value.length, q.value.length); window.scrollTo(0, pos); } }
  });
  document.body.addEventListener("keydown", e => {
    if (e.key === "Enter" && e.target.id === "guess") { e.preventDefault(); document.querySelector("[data-act=submit-guess]").click(); }
  });
  document.body.addEventListener("change", e => {
    const el = e.target.closest("[data-act]");
    if (!el) return;
    if (el.dataset.act === "set-new-per-day") { S.settings.newPerDay = Math.max(1, Math.min(100, +el.value || 10)); save(); }
    else if (el.dataset.act === "toggle-highlight") { S.settings.highlightNew = el.checked; save(); route(); }
    else if (el.dataset.act === "toggle-speak") { S.settings.autoSpeak = el.checked; save(); }
    else if (el.dataset.act === "toggle-w") { S.settings.classicalW = el.checked; save(); route(); }
    else if (el.dataset.act === "set-rate") { S.settings.speakRate = +el.value; save(); speech.say("שָׁלוֹם"); }
  });
  window.addEventListener("hashchange", route);
  route();
})();
