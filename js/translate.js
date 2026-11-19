/**
 * Free pre-translation + automatic character names (see auto-names.js).
 * Engines:  "gtx"  - Google's classic public endpoint (no key, stable, default)
 *           "html" - EXPERIMENTAL: the endpoint used by Google's web page translator ("translateHtml").
 *                    Paragraphs are sent as <a i=N> items so the model sees neighbouring paragraphs.
 *                    It needs an API key that Google's own public JS contains; if the key or the
 *                    response cannot be read we silently fall back to "gtx".
 */
var translator = (function() {
  var endpoint = "https://translate.googleapis.com/translate_a/single";
  var maxChunk = 1800;      // chars per request
  var concurrency = 3;
  var cache = new Map();    // text -> translated

  function chunkTexts(texts) {
    var chunks = [], cur = [], len = 0;
    texts.forEach(function(t, i) {
      if (len + t.length > maxChunk && cur.length) {chunks.push(cur); cur = []; len = 0}
      cur.push(i);
      len += t.length + 1;
    });
    if (cur.length) chunks.push(cur);
    return chunks;
  }

  async function callGoogle(text, sl, tl) {
    var body = new URLSearchParams({client: "gtx", sl: sl, tl: tl, dt: "t", dj: "0", q: text});
    for (var attempt = 0; ; attempt++) {
      try {
        var res = await fetch(endpoint, {
          method: "POST",
          headers: {"Content-Type": "application/x-www-form-urlencoded;charset=UTF-8"},
          body: body.toString()
        });
        if (!res.ok) throw new Error("Translate server returns " + res.status);
        var json = await res.json();
        return {
          text: (json[0] || []).map(function(seg) {return seg[0] || ""}).join(""),
          lang: json[2]
        };
      }
      catch (err) {
        if (attempt >= 2) throw err;
        await new Promise(function(f) {setTimeout(f, 400 * (attempt + 1))});
      }
    }
  }

  // ---- experimental "html" engine ------------------------------------------------------------
  var htmlEndpoint = "https://translate-pa.googleapis.com/v1/translateHtml";
  var keySource = "https://translate.googleapis.com/_/translate_http/_/js/k=translate_http.tr.en_US.YusFYy3P_ro.O/am=AAg/d=1/exm=el_conf/ed=1/rs=AN8SPfq1Hb8iJRleQqQc8zhdzXmF9E56eQ/m=el_main";
  var apiKey = null, apiKeyTime = 0;

  async function getApiKey() {
    if (apiKey && Date.now() - apiKeyTime < 20 * 60 * 1000) return apiKey;
    var res = await fetch(keySource);
    var m = (await res.text()).match(/['"]x-goog-api-key['"]\s*:\s*['"](\w{39})['"]/i);
    if (!m) throw new Error("translateHtml: api key not found");
    apiKey = m[1]; apiKeyTime = Date.now();
    return apiKey;
  }

  function escapeHtml(t) {return t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}
  function unescapeHtml(t) {return t.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&")}

  // The reply wraps each translated sentence in <b>…</b> followed by the original in <i>…</i>, all inside <a i=N>.
  // Keep only the <b> text, grouped by N.
  function parseHtmlReply(reply, count) {
    var body = reply.replace(/<\/?pre[^>]*>/g, "").replace(/<i>[\s\S]*?<\/i>/g, "").replace(/<\/b>\s*<b>/g, " ").replace(/<\/?b>/g, "");
    var parts = new Array(count), re = /<a\s+i\s*=\s*"?(\d+)"?\s*>([\s\S]*?)<\/a>/g, m;
    while ((m = re.exec(body))) {
      var i = Number(m[1]);
      if (i < count) parts[i] = (parts[i] ? parts[i] + " " : "") + unescapeHtml(m[2].replace(/<[^>]+>/g, "")).trim();
    }
    for (var k = 0; k < count; k++) if (parts[k] == null) throw new Error("translateHtml: paragraph " + k + " missing in reply");
    return parts;
  }

  async function translateGroupHtml(group, sl, tl) {
    var key = await getApiKey();
    var html = "<pre>" + group.map(function(t, i) {return "<a i=" + i + ">" + escapeHtml(t) + "</a>"}).join("") + "</pre>";
    var res = await fetch(htmlEndpoint, {
      method: "POST",
      headers: {"Content-Type": "application/json+protobuf", "X-goog-api-key": key},
      body: JSON.stringify([[[html], sl, tl], "te"])
    });
    if (!res.ok) {apiKey = null; throw new Error("translateHtml: server returns " + res.status)}
    var json = await res.json();
    console.debug("[translateHtml] raw reply", JSON.stringify(json).slice(0, 3000));
    var reply = json && json[0] && json[0][0];
    if (typeof reply !== "string") throw new Error("translateHtml: unexpected reply shape");
    return {parts: parseHtmlReply(reply, group.length), lang: json[1] && json[1][0]};
  }

  // translate a group of paragraphs in one request
  async function translateGroup(group, sl, tl, engine) {
    if (engine === "html") {
      try {return await translateGroupHtml(group, sl, tl)}
      catch (err) {console.warn("translateHtml failed, falling back to gtx:", err.message)}
    }
    return translateGroupGtx(group, sl, tl);
  }

  // ---- default "gtx" engine: paragraphs joined by newline, split back by newline ----------------
  async function translateGroupGtx(group, sl, tl) {
    var joined = group.join("\n");
    var res = await callGoogle(joined, sl, tl);
    var parts = res.text.split(/\n/);
    if (parts.length !== group.length) {
      // newline structure lost -> fall back to one paragraph per request
      parts = [];
      for (var i = 0; i < group.length; i++) parts.push((await callGoogle(group[i], sl, tl)).text);
    }
    return {parts: parts, lang: res.lang};
  }

  // remembered characters (see auto-names.js) live in storage so a name stays the same between pages
  function loadNames() {
    return new Promise(function(f) {brapi.storage.local.get(["nameMap", "nameReplace"], f)}).catch(function() {return {}});
  }
  function saveNames(state) {
    return new Promise(function(f) {brapi.storage.local.set({nameMap: state}, f)});
  }

  /**
   * @returns {Promise<{texts: string[], translated: boolean}>}
   */
  async function translateTexts(texts, settings) {
    var tl = settings.translateTarget || "vi";
    var sl = settings.translateSource || "auto";
    var engineTag = (settings.translateEngine || "gtx") + "|";

    // pass 1: Chinese names in the source text -> Vietnamese names, before the translator sees them
    var names = await loadNames();
    var replaceNames = names.nameReplace !== false;
    var nameState = names.nameMap || [], nameChanged = false;
    try {
      var sr = AutoNames.applySource(texts, nameState, replaceNames);
      texts = sr.texts; nameState = sr.state; nameChanged = sr.changed;
    }
    catch (err) {console.error("Auto names (source) failed", err)}

    // paragraphs must stay single-line for the newline-split trick
    var prepared = texts.map(function(t) {return t.replace(/\s*\r?\n\s*/g, " ")});
    var out = new Array(texts.length);
    var anyTranslated = false;

    var todo = [];
    prepared.forEach(function(t, i) {
      var key = engineTag + sl + ">" + tl + ":" + t;
      if (cache.has(key)) {out[i] = cache.get(key); anyTranslated = true}
      else todo.push(i);
    });

    var chunks = chunkTexts(todo.map(function(i) {return prepared[i]})).map(function(c) {
      return c.map(function(k) {return todo[k]});
    });

    var next = 0;
    async function worker() {
      while (next < chunks.length) {
        var idxs = chunks[next++];
        var r = await translateGroup(idxs.map(function(i) {return prepared[i]}), sl, tl, settings.translateEngine);
        if (r.lang === tl) {   // already in target language, keep as is
          idxs.forEach(function(i) {out[i] = prepared[i]});
          continue;
        }
        anyTranslated = true;
        idxs.forEach(function(i, k) {
          var v = r.parts[k];
          out[i] = v;
          cache.set(engineTag + sl + ">" + tl + ":" + prepared[i], v);
        });
      }
    }
    var workers = [];
    for (var w = 0; w < Math.min(concurrency, chunks.length); w++) workers.push(worker());
    await Promise.all(workers);
    if (anyTranslated) {
      // pass 2 (fallback): names the translator left as pinyin
      try {
        if (await AutoNames.enrichPinyin(nameState, 20)) nameChanged = true;
        var mg = AutoNames.merge(nameState);
        nameState = mg.state; nameChanged = nameChanged || mg.changed;
        var pr = AutoNames.apply(out, nameState, replaceNames);
        out = pr.texts; nameState = pr.state; nameChanged = nameChanged || pr.changed;
      }
      catch (err) {console.error("Auto names (pinyin) failed", err)}
    }
    if (nameChanged) await saveNames(nameState);
    return {texts: out, translated: anyTranslated};
  }

  return {translateTexts: translateTexts, parseHtmlReply: parseHtmlReply};
})();
