const test = require('node:test')
const assert = require('node:assert')
const ND = require('../js/name-detector.js')
const {pinyinToHanViet} = require('../js/pinyin-names.js')

const text = [
  "Chương 1 Cái nắp bình thủy bị mất 13.",
  "Trường trung học Changji. 3.",
  "Lớp năm thứ hai, phòng giám đốc.",
  "Lớp trưởng Sun Guofu trợn mắt nhìn thiếu niên trước mặt. 1.",
  "\"Tên bạn là Wang Shojing? Bạn muốn gì ở tôi?\" 1.",
  "Chàng trai tên \"Wang Shoujing\" nở nụ cười chân thành:",
  "\"Lớp trưởng, tôi muốn gia nhập đội của bạn.\"",
  "Sun Guofu hừ lạnh, hắn không tin. Wang nhìn Sun Guo Fu, cười nhạt.",
  "Cô giáo Li Meiling bước vào lớp. Li Meiling nhìn quanh, cô ấy mỉm cười.",
  "Mẹ của Wang Shoujing đứng ngoài cửa. Li Meiling nói với Wang Shoujing: \"Em về đi.\"",
  "Li Meiling là giáo viên chủ nhiệm. Nàng gật đầu."
].join("\n")

const byName = () => Object.fromEntries(ND.detect(text).map(n => [n.name, n]))

test("finds pinyin names and merges typo / spacing variants", () => {
  const names = ND.detect(text).map(n => n.name)
  const sun = names.filter(n => /^Sun/.test(n)), wang = names.filter(n => /^Wang/.test(n))
  assert.strictEqual(sun.length, 1, names.join())
  assert.strictEqual(wang.length, 1, names.join())
  assert.ok(names.some(n => /^Li Meiling$/.test(n)), names.join())
  assert.ok(!names.includes("Changji"))
})

test("guesses role and gender from Vietnamese context", () => {
  const all = ND.detect(text)
  const sun = all.find(n => /^Sun/.test(n.name)), wang = all.find(n => /^Wang/.test(n.name)), li = all.find(n => /^Li/.test(n.name))
  assert.ok(sun.roles.some(r => r.vi === "lớp trưởng"), JSON.stringify(sun))
  assert.strictEqual(sun.gender, "M")
  assert.strictEqual(wang.gender, "M")
  assert.strictEqual(li.gender, "F")
  assert.ok(li.roles.some(r => /giáo/.test(r.vi)), JSON.stringify(li))
})

test("pinyin to Han-Viet suggestion", () => {
  assert.strictEqual(pinyinToHanViet("Sun"), "Tôn")
  assert.strictEqual(pinyinToHanViet("Guofu"), "Quốc Phú")
  assert.strictEqual(pinyinToHanViet("Shoujing"), "Thủ Kinh")
  assert.strictEqual(pinyinToHanViet("Ouyang"), "Âu Dương")
})

const AutoNames = require('../js/auto-names.js')
global.pinyinToHanViet = pinyinToHanViet
global.NameDetector = ND

test("auto names: replace=false only records characters", () => {
  const r = AutoNames.apply(text.split("\n"), [], false)
  assert.strictEqual(r.texts.join("\n"), text)
  assert.ok(r.state.length >= 3 && r.state.every(e => e.vi))
})

test("auto names: gender pools, defaults, persistence", () => {
  const texts = text.split("\n")
  const r = AutoNames.apply(texts, [])
  const joined = r.texts.join("\n")
  // the most frequent male (Wang) -> Dũng, next male (Sun) -> Hùng, the only female (Li) -> Linh
  assert.ok(/Dũng/.test(joined) && /Hùng/.test(joined) && /Linh/.test(joined), joined)
  assert.ok(!/Guofu|Shoujing|Shojing|Meiling/.test(joined), joined)
  assert.ok(!/Changji/.test(joined) === false, "places are untouched")
  // persistence: a later page with a single mention still gets the same names
  const r2 = AutoNames.apply(["Li Meiling nhìn Sun Guofu."], r.state)
  assert.strictEqual(r2.texts[0], "Linh nhìn Hùng.")
  // a new female character gets the next name in the pool
  const more = ["Zhang Yiyi bước vào. Zhang Yiyi cười, cô ấy nhìn Li Meiling."]
  const r3 = AutoNames.apply(more, r.state)
  assert.ok(/Hương/.test(r3.texts[0]), r3.texts[0])
})

const ZhNames = require('../js/zh-names.js')
global.ZhNames = ZhNames

const zh = [
  "贾天心放学回家，一进门就喊道：“妈妈！我要我的猫。”",
  "他的妈妈李小璐正在厨房做饭。李小璐听见儿子回来，对他说道：“先洗手。”",
  "贾天心放下书包，走到厨房门口。他看着李小璐，笑了笑。",
  "贾天心说道：“妈妈，我饿了。”李小璐点了点头，她盛了一碗饭。",
].join("")

test("Chinese source: detect names, replace before translation, keep state", () => {
  const found = ZhNames.detect(zh)
  const jia = found.find(n => n.name === "贾天心"), li = found.find(n => n.name === "李小璐")
  assert.ok(jia && li, JSON.stringify(found))
  assert.strictEqual(jia.gender, "M")
  assert.strictEqual(li.gender, "F")
  assert.ok(li.roles.includes("mẹ"), JSON.stringify(li))
  const r = AutoNames.applySource(zh.split("。"), [], true)
  const joined = r.texts.join("。")
  assert.ok(!/贾天心|李小璐/.test(joined), joined)
  assert.ok(/Linh/.test(joined) && /Dũng/.test(joined), joined)
  // next page: only one mention, same names
  const r2 = AutoNames.applySource(["贾天心看着李小璐。"], r.state, true)
  assert.strictEqual(r2.texts[0], "Dũng看着 Linh 。".replace("Dũng看", "Dũng 看").replace("着 Linh 。", "着 Linh 。"))
  // replace=false leaves the text alone but still remembers
  const r3 = AutoNames.applySource(zh.split("。"), [], false)
  assert.strictEqual(r3.texts.join("。"), zh)
  assert.strictEqual(r3.state.length, 2)
})

test("merge: pinyin duplicate of a Chinese-named character becomes one row", () => {
  const state = [
    {kind: "zh", key: "贾天心", variants: ["贾天心"], vi: "Dũng", gender: "M", role: "", pinyin: "Jia Tianxin"},
    {key: "jiatianxin", surname: "jia", variants: ["Jia Tianxin", "Jia Tian Xin"], vi: "Hùng", gender: "", role: "con trai"},
    {key: "limeiling", surname: "li", variants: ["Li Meiling"], vi: "Linh", gender: "F", role: ""},
  ]
  const m = AutoNames.merge(state)
  assert.strictEqual(m.state.length, 2)
  const jia = m.state.find(e => e.kind === "zh")
  assert.strictEqual(jia.vi, "Dũng")
  assert.deepStrictEqual(jia.aliases, ["Jia Tianxin", "Jia Tian Xin"])
  assert.strictEqual(jia.role, "con trai")
  // pass 2 now rewrites the aliases to the Chinese entry's name
  global.NameDetector = ND
  const out = AutoNames.apply(["Jia Tianxin nhìn Li Meiling. Jia Tian Xin cười, Li Meiling gật đầu."], m.state, true)
  assert.ok(/Dũng nhìn/.test(out.texts[0]) && /Dũng cười/.test(out.texts[0]), out.texts[0])
})

test("translateHtml reply parser keeps only translated text per <a i=N>", () => {
  global.brapi = {storage: {local: {get() {}, set() {}}}}
  delete require.cache[require.resolve('../js/translate.js')]
  const src = require('fs').readFileSync(require('path').join(__dirname, '../js/translate.js'), 'utf8')
  const translator = new Function(src + "; return translator")()
  const reply = '<pre><a i=0><b>Sun Guofu nhìn Wang Shoujing.</b><i>孙国富看着王守静。</i></a><a i=1><b>Wang cười.</b> <b>Anh gật đầu.</b><i>王守静笑了。</i><i>他点了点头。</i></a></pre>'
  assert.deepStrictEqual(translator.parseHtmlReply(reply, 2), ["Sun Guofu nhìn Wang Shoujing.", "Wang cười. Anh gật đầu."])
  assert.throws(() => translator.parseHtmlReply('<pre><a i=0><b>x</b></a></pre>', 2), /missing/)
})
