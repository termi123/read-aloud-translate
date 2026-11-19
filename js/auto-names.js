/**
 * Automatic character names: pinyin names left in the translated text ("Sun Guofu") are replaced by
 * common Vietnamese names chosen by gender. The choice is stored in `state` so a character keeps
 * the same name across pages/chapters.
 */
var AutoNames = (function() {
  var FEMALE = ["Linh", "Hương", "Nhi", "Phương", "Hải"];   // first = default (also used when there is only 1 female)
  var MALE = ["Dũng", "Hùng", "Quý", "Thuận", "Tuấn"];
  // surnames that are also ordinary Vietnamese words: never replace them when they stand alone
  var NO_ALIAS = {ma: 1, chi: 1, tu: 1, mu: 1, du: 1, cao: 1, long: 1, song: 1, tan: 1, nam: 1, he: 1, hu: 1, yu: 1};

  function lev1(a, b) {return NameDetector.lev1(a, b)}
  function keyOf(name) {return name.toLowerCase().replace(/ /g, "")}
  function escapeRe(s) {return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}

  function hanViet(name) {
    return typeof pinyinToHanViet === "function" ? name.split(" ").map(pinyinToHanViet).join(" ") : name;
  }

  function pickName(entries, gender, fallback) {
    var used = {}; entries.forEach(function(e) {used[e.vi] = true});
    var pool = gender === "F" ? FEMALE : gender === "M" ? MALE : [];
    for (var i = 0; i < pool.length; i++) if (!used[pool[i]]) return pool[i];
    return fallback;      // unknown gender or pool exhausted: Han-Viet reading of the pinyin
  }

  /**
   * @param {string[]} texts translated paragraphs
   * @param {Array} state   remembered characters [{key, surname, variants, vi, gender}]
   * @param {boolean} [replace=true] false = only detect/remember characters, leave the text untouched
   * @returns {{texts: string[], state: Array, changed: boolean}}
   */
  function apply(texts, state, replace) {
    state = (state || []).map(function(e) {return Object.assign({}, e, {variants: e.variants.slice()})});
    var changed = false;
    var found = NameDetector.detect(texts.join("\n"), {minCount: 2, max: 60});   // already sorted by frequency

    found.forEach(function(g) {
      var sur = g.surname.toLowerCase();
      var key = keyOf(g.name);
      var owner = state.filter(function(e) {return e.kind === "zh" && e.pinyin && lev1(keyOf(e.pinyin), key)})[0];
      if (owner) {   // the same person as a Chinese-named entry: remember this spelling as an alias
        owner.aliases = owner.aliases || [];
        g.variants.forEach(function(v) {if (owner.aliases.indexOf(v) < 0) {owner.aliases.push(v); changed = true}});
        return;
      }
      var entry = state.filter(function(e) {return e.kind !== "zh" && e.surname === sur && lev1(e.key, key)})[0];
      if (!entry) {
        entry = {key: key, surname: sur, variants: [], vi: pickName(state, g.gender, hanViet(g.name)), gender: g.gender,
          role: g.roles.map(function(r) {return r.vi}).join(", ")};
        state.push(entry); changed = true;
      }
      // fill in what was unknown before (never renames an existing character)
      if (!entry.gender && g.gender) {entry.gender = g.gender; changed = true}
      if (!entry.role && g.roles.length) {entry.role = g.roles.map(function(r) {return r.vi}).join(", "); changed = true}
      g.variants.forEach(function(v) {if (entry.variants.indexOf(v) < 0) {entry.variants.push(v); changed = true}});
    });

    if (replace === false) return {texts: texts, state: state, changed: changed};

    // replacement list: full-name variants, plus the lone surname when only one character has it
    var py = state.filter(function(e) {return e.kind !== "zh"});
    var surCount = {}; py.forEach(function(e) {surCount[e.surname] = (surCount[e.surname] || 0) + 1});
    var pairs = [];
    state.filter(function(e) {return e.kind === "zh" && e.aliases && e.vi}).forEach(function(e) {
      e.aliases.forEach(function(v) {pairs.push([v, e.vi])});
    });
    py.forEach(function(e) {
      e.variants.forEach(function(v) {pairs.push([v, e.vi])});
      if (surCount[e.surname] === 1 && !NO_ALIAS[e.surname]) {
        var sw = e.variants[0].split(" ")[0];
        pairs.push([sw, e.vi]);
      }
    });
    pairs.sort(function(a, b) {return b[0].length - a[0].length});
    var res = pairs.map(function(p) {
      return [new RegExp("(?<![\\p{L}])" + escapeRe(p[0]).replace(/ +/g, "\\s+") + "(?![\\p{L}])", "gu"), p[1]];
    });
    var out = texts.map(function(t) {
      res.forEach(function(r) {t = t.replace(r[0], function() {return r[1]})});
      return t;
    });
    return {texts: out, state: state, changed: changed};
  }

  /**
   * Pass 1, on the Chinese SOURCE text: detect Chinese names and replace them by the Vietnamese name
   * before translation, so the translator never sees (and never re-translates) them.
   */
  function applySource(texts, state, replace) {
    state = (state || []).map(function(e) {return Object.assign({}, e, {variants: e.variants.slice()})});
    var changed = false;
    ZhNames.detect(texts.join("\n"), {minCount: 2, max: 60}).forEach(function(g) {
      var entry = state.filter(function(e) {return e.kind === "zh" && e.key === g.name})[0];
      if (!entry) {
        entry = {kind: "zh", key: g.name, variants: [g.name], vi: pickName(state, g.gender, ""), gender: g.gender, role: g.roles.join(", ")};
        state.push(entry); changed = true;
      }
      if (!entry.gender && g.gender) {entry.gender = g.gender; changed = true}
      if (!entry.role && g.roles.length) {entry.role = g.roles.join(", "); changed = true}
      if (!entry.vi && entry.gender) {entry.vi = pickName(state, entry.gender, ""); changed = true}
    });
    if (replace === false) return {texts: texts, state: state, changed: changed};
    var pairs = state.filter(function(e) {return e.kind === "zh" && e.vi}).map(function(e) {return [e.key, e.vi]});
    pairs.sort(function(a, b) {return b[0].length - a[0].length});
    var out = texts.map(function(t) {
      pairs.forEach(function(p) {t = t.split(p[0]).join(" " + p[1] + " ")});
      return t.replace(/ {2,}/g, " ").trim();
    });
    return {texts: out, state: state, changed: changed};
  }

  function stripTones(t) {return t.normalize("NFD").replace(/\p{M}/gu, "").replace(/đ/g, "d")}

  // Pinyin of a Chinese name via the free Google endpoint ("Jiǎ Tiānxīn" -> "Jia Tianxin")
  async function fetchPinyin(zh) {
    var body = new URLSearchParams({client: "gtx", sl: "zh-CN", tl: "vi", q: zh});
    body.append("dt", "t"); body.append("dt", "rm");
    var res = await fetch("https://translate.googleapis.com/translate_a/single", {
      method: "POST",
      headers: {"Content-Type": "application/x-www-form-urlencoded;charset=UTF-8"},
      body: body.toString()
    });
    if (!res.ok) throw new Error("Server returns " + res.status);
    var json = await res.json(), py = "";
    (json[0] || []).forEach(function(seg) {if (seg[3]) py += seg[3]});
    py = stripTones(py).trim();
    return py.split(/\s+/).map(function(w) {return w.charAt(0).toUpperCase() + w.slice(1)}).join(" ");
  }

  // fill in the pinyin of Chinese-named entries (at most `limit` lookups per call)
  async function enrichPinyin(state, limit) {
    var todo = state.filter(function(e) {return e.kind === "zh" && !e.pinyin && !e.pinyinFailed}).slice(0, limit || 20);
    var changed = false, next = 0;
    async function worker() {
      while (next < todo.length) {
        var e = todo[next++];
        try {
          var py = await fetchPinyin(e.key);
          if (py) {e.pinyin = py; changed = true} else {e.pinyinFailed = true; changed = true}
        }
        catch (err) {}   // network problem: try again next time
      }
    }
    await Promise.all([worker(), worker(), worker(), worker()]);
    return changed;
  }

  // one row per character: fold pinyin-named entries into the Chinese-named entry they duplicate
  function merge(state) {
    var out = [], changed = false;
    var zhs = state.filter(function(e) {return e.kind === "zh" && e.pinyin});
    state.forEach(function(e) {
      if (e.kind === "zh") {out.push(e); return}
      var key = e.key || keyOf((e.variants[0] || ""));
      var owner = zhs.filter(function(z) {var k = keyOf(z.pinyin); return k.length >= 4 && lev1(k, key)})[0];
      if (!owner) {out.push(e); return}
      owner.aliases = owner.aliases || [];
      e.variants.forEach(function(v) {if (owner.aliases.indexOf(v) < 0) owner.aliases.push(v)});
      if (!owner.vi) owner.vi = e.vi;
      if (!owner.gender && e.gender) owner.gender = e.gender;
      if (!owner.role && e.role) owner.role = e.role;
      changed = true;
    });
    return {state: out, changed: changed};
  }

  return {apply: apply, applySource: applySource, enrichPinyin: enrichPinyin, merge: merge, FEMALE: FEMALE, MALE: MALE};
})();
if (typeof module !== "undefined") module.exports = AutoNames;
