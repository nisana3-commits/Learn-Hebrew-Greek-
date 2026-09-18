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

  const MIN = 60000, DAY = 86400000;
  const STORE_KEY = "hebrew-srs-v1";

  // ---------- state ----------
  const defaults = () => ({ cards: {}, deferred: {}, settings: { newPerDay: 10, highlightNew: true }, log: {} });
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
    if (alreadyKnown) { c.state = "review"; c.ivl = 30; c.due = Date.now() + 30 * DAY; c.reps = 1; }
    else { apply(c, 2, Date.now()); logToday("new"); }
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
  function stats() {
    const cards = Object.values(S.cards);
    const words = cards.filter(c => c.kind === "word");
    return {
      words: words.length,
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
        <div><span class="heb">${esc(w.h)}</span> <span class="translit">${esc(w.translit || lex.translit || "")}</span></div>
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
    return `<li data-act="open-verse" data-id="${id}"><span class="ref">${esc(v.ref)}</span><span class="heb">${esc(v.words.map(w => w.h).join(" "))}</span>${badge}</li>`;
  }
  function kjvBlock(v) {
    return `<div class="kjv"><span class="ref">${esc(v.ref)}${v.kjvRef ? " (KJV " + esc(v.kjvRef) + ")" : ""}</span>${esc(v.kjv)}</div>`;
  }

  // ---------- views ----------
  const view = document.getElementById("view");
  let current = { tab: "home" };

  function route() {
    const h = location.hash.replace(/^#/, "") || "home";
    const [name, arg] = h.split("/");
    current = { tab: name, arg: arg ? decodeURIComponent(arg) : null };
    document.querySelectorAll("#tabs a").forEach(a => a.classList.toggle("active", a.dataset.tab === (name === "verse" || name === "topic" ? "read" : name)));
    const r = { home: renderHome, learn: renderLearn, review: renderReview, read: renderRead, verse: renderVersePage, topic: renderTopic }[name] || renderHome;
    view.innerHTML = r(current.arg);
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
        <div class="stat"><b>${st.words}</b><span>Words started</span></div>
        <div class="stat"><b>${st.readable}</b><span>Verses ready</span></div>
      </div>
      <div class="card stack" style="margin-top:14px">
        <div class="progress"><i style="width:${pct}%"></i><b>${st.words} of ${VOCAB.length} words</b></div>
        <p class="small muted">Words are ordered by how often they appear in the Hebrew Bible. The first few hundred cover most of every page. Verses unlock in Read as soon as you know their words.</p>
        <div class="row">
          <a class="btn primary" href="#review">Review${st.due ? " (" + st.due + ")" : ""}</a>
          <a class="btn" href="#learn">Learn new words${left ? " (" + left + " left today)" : ""}</a>
          <a class="btn" href="#read">Read</a>
        </div>
      </div>
      <div class="section-title">Today</div>
      <div class="card small">
        ${(S.log[today()] || { new: 0, reviews: 0 }).new} new words, ${(S.log[today()] || { new: 0, reviews: 0 }).reviews} reviews. ${st.mature} words mature (interval of three weeks or more). ${st.verses} verses in your reviews.
      </div>
      <div class="section-title">Settings</div>
      <div class="card stack small">
        <label class="opt" for="new-per-day">New words per day <input id="new-per-day" type="number" min="1" max="100" value="${S.settings.newPerDay}" data-act="set-new-per-day"></label>
        <label class="opt" for="highlight-new"><input id="highlight-new" type="checkbox" ${S.settings.highlightNew ? "checked" : ""} data-act="toggle-highlight"> Colour words I have not started yet in rose</label>
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

  function renderLearn() {
    const left = newLeftToday();
    const next = nextNewWords(1)[0];
    if (!next) return `<div class="card center"><h2>Every word started</h2><p>You have started all ${VOCAB.length} words in the list. Keep reviewing.</p></div>`;
    if (left === 0) {
      return `<div class="card center stack"><h2>Done for today</h2><p class="muted">You have started ${S.settings.newPerDay} new words today. Review what is due, or read. Raise the daily limit on Home if you want more.</p>
        <div class="row" style="justify-content:center"><a class="btn primary" href="#review">Review</a><a class="btn" href="#read">Read</a></div>
        <button class="btn quiet sm" data-act="one-more">Show one more anyway</button></div>`;
    }
    return wordCard(next, left);
  }
  function wordCard(v, left) {
    const ex = (INDEX[v.key] || [])[0];
    const exv = ex ? VERSES[ex] : null;
    let exHtml = "";
    if (exv) {
      const idx = exv.words.findIndex(w => wordKeys(w).includes(v.key) || (w.key === v.key));
      exHtml = `<div class="example">
        <div class="small muted">Example, ${esc(exv.ref)}</div>
        <div class="heb heb-verse hide-new" data-verse="${exv.id}">${exv.words.map((w, i) => renderWord(w, i, { hl: idx })).join("")}</div>
        <div class="small">${esc(exv.kjv)}</div>
        <div id="ex-panel"></div>
      </div>`;
    }
    return `
      <div class="row between small muted"><span>Word #${v.rank} of ${VOCAB.length}</span><span>${left} more today</span></div>
      <div class="card">
        <div class="heb heb-big">${esc(v.heb)}</div>
        <div class="center translit">${esc(v.translit)}</div>
        <div class="center gloss" style="margin-top:8px">${esc(v.gloss)}</div>
        <div class="center small muted">${esc(typeLabel(v.type))}${v.prefix ? " (inseparable prefix)" : ""} · ${v.count.toLocaleString()}× in the Hebrew Bible</div>
        ${v.kjv ? `<div class="center small" style="margin-top:6px">KJV: ${esc(v.kjv.join(", "))}</div>` : ""}
        ${exHtml}
      </div>
      <div class="row">
        <button class="btn primary" data-act="start-word" data-key="${esc(v.key)}">Start learning</button>
        <button class="btn" data-act="know-word" data-key="${esc(v.key)}">I already know it</button>
        <button class="btn quiet" data-act="defer-word" data-key="${esc(v.key)}">Later</button>
      </div>`;
  }

  let reviewState = { showing: null, revealed: false };
  function renderReview() {
    const q = dueCards();
    const soon = dueCards(20 * MIN).filter(c => c.state === "learn");
    const c = q[0] || soon[0];
    if (!c) {
      const all = Object.values(S.cards);
      const next = all.length ? Math.min(...all.map(x => x.due)) - Date.now() : null;
      return `<div class="card center stack"><h2>Nothing due</h2>
        <p class="muted">${all.length ? "Next card in " + fmtDelta(Math.max(next, MIN)) + "." : "Start some words in Learn and they will show up here."}</p>
        <div class="row" style="justify-content:center"><a class="btn primary" href="#learn">Learn new words</a><a class="btn" href="#read">Read</a></div></div>`;
    }
    const id = c.kind + ":" + c.id;
    if (reviewState.showing !== id) reviewState = { showing: id, revealed: false };
    const head = `<div class="row between small muted"><span>${q.length} due${soon.length && !q.length ? " (learning ahead)" : ""}</span><span>${c.kind === "verse" ? "Verse" : "Word"} · ${c.state === "review" ? "review" : "learning"}</span></div>`;
    const grades = `<div class="grades">
      <button class="btn again" data-act="grade" data-g="0">Again<small>${fmtDelta(preview(c, 0))}</small></button>
      <button class="btn" data-act="grade" data-g="1">Hard<small>${fmtDelta(preview(c, 1))}</small></button>
      <button class="btn" data-act="grade" data-g="2">Good<small>${fmtDelta(preview(c, 2))}</small></button>
      <button class="btn easy" data-act="grade" data-g="3">Easy<small>${fmtDelta(preview(c, 3))}</small></button>
    </div>`;
    if (c.kind === "word") {
      const v = VOCAB_BY_KEY[c.id] || Object.assign({ key: c.id, heb: "", gloss: "", translit: "", type: "", count: 0 }, LEX[c.id] || {});
      const ex = (INDEX[c.id] || [])[0];
      return head + `<div class="card flashcard">
        <div class="heb heb-big">${esc(v.heb)}</div>
        ${reviewState.revealed ? `<div class="back">
          <div class="translit">${esc(v.translit)}</div>
          <div class="gloss">${esc(v.gloss)}</div>
          <div class="small muted">${esc(typeLabel(v.type))}${v.kjv ? " · KJV: " + esc(v.kjv.slice(0, 3).join(", ")) : ""}</div>
          ${ex ? `<div class="example"><div class="heb heb-small hide-new" style="text-align:center">${esc(VERSES[ex].words.map(w => w.h).join(" "))}</div><div class="small muted">${esc(VERSES[ex].ref)}: ${esc(VERSES[ex].kjv)}</div></div>` : ""}
        </div>` : ""}
      </div>` + (reviewState.revealed ? grades : `<button class="btn primary block" data-act="reveal">Show meaning</button>`);
    }
    const v = VERSES[c.id];
    if (!v) { delete S.cards[id]; save(); return renderReview(); }
    return head + `<div class="card">
      <div class="small muted">${esc(v.ref)} · tap a word for its meaning</div>
      ${renderVerse(v)}
      <div id="vpanel"></div>
      ${reviewState.revealed ? kjvBlock(v) : ""}
    </div>` + (reviewState.revealed ? grades : `<button class="btn primary block" data-act="reveal">Show English</button>`);
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
      <p class="muted">${esc(t.blurb)}</p>
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
        <div class="row between small muted"><span>${esc(v.ref)}${v.aramaic ? " · Aramaic" : ""}</span><span>${newKeys.length === 0 && rare.length === 0 ? '<span class="pill ok">All words known</span>' : `${newKeys.length + rare.length} new word${newKeys.length + rare.length === 1 ? "" : "s"}`}</span></div>
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
      <div class="center translit">${esc(lex.translit || "")}</div>
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
      const v = VERSES[container.dataset.verse];
      const i = +wEl.dataset.i;
      container.querySelectorAll(".w.active").forEach(x => x.classList.remove("active"));
      wEl.classList.add("active");
      const panel = container.parentElement.querySelector("#vpanel, #ex-panel") || container.nextElementSibling;
      if (panel) panel.innerHTML = wordPanel(v, i);
      return;
    }
    const el = e.target.closest("[data-act]");
    if (!el) return;
    const act = el.dataset.act;
    if (act === "start-word") { startWord(el.dataset.key, false); route(); }
    else if (act === "know-word") { startWord(el.dataset.key, true); route(); }
    else if (act === "defer-word") { S.deferred[el.dataset.key] = Date.now(); save(); route(); }
    else if (act === "one-more") { S.settings.newPerDay++; save(); route(); }
    else if (act === "learn-word") { startWord(el.dataset.key, false); sheet.hidden = true; route(); }
    else if (act === "word-sheet") { openWordSheet(el.dataset.key); }
    else if (act === "reveal") { reviewState.revealed = true; route(); }
    else if (act === "grade") { grade(reviewState.showing, +el.dataset.g); reviewState = { showing: null, revealed: false }; route(); }
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
  document.body.addEventListener("change", e => {
    const el = e.target.closest("[data-act]");
    if (!el) return;
    if (el.dataset.act === "set-new-per-day") { S.settings.newPerDay = Math.max(1, Math.min(100, +el.value || 10)); save(); }
    else if (el.dataset.act === "toggle-highlight") { S.settings.highlightNew = el.checked; save(); route(); }
  });
  window.addEventListener("hashchange", route);
  route();
})();
