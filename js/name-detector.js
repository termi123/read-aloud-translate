/**
 * Finds Chinese person names that the translator left as pinyin inside Vietnamese text
 * ("Sun Guofu", "Wang Shoujing"), then guesses gender and role from the Vietnamese words around them.
 */
var NameDetector = (function() {
  var SURNAMES = ("wang li zhang liu chen yang huang zhao wu zhou xu sun ma zhu hu guo he gao lin luo zheng liang xie song tang han feng deng cao peng zeng xiao tian dong yuan pan yu jiang cai du ye cheng su wei lu ding shen yao cui zhong tan fan jin liao jia xia fang bai zou meng xiong qin qiu yin xue duan lei hou long shi tao gu mao hao gong shao wan qian yan dai mo kong chu mu ling hua leng qiao xing ke fu ruan pu tu chi " +
    "ouyang sima murong shangguan zhuge dongfang xiahou gongsun linghu nangong xuanyuan situ duanmu ximen baili yuwen huangfu").split(" ");
  var SURSET = {}; SURNAMES.forEach(function(s) {SURSET[s] = true});
  // capitalised ASCII Vietnamese words that may follow a surname-like word by accident
  var NOT_NAME = {Anh: 1, Em: 1, Ong: 1, Ba: 1, Me: 1, Co: 1, Bo: 1, Cha: 1, Chi: 1, Tu: 1, Do: 1, Nam: 1, Nu: 1, Ma: 1};

  // role phrase (lowercase Vietnamese), gender hint
  var ROLES = [
    ["lớp trưởng", ""], ["lớp phó", ""], ["giáo viên", ""], ["cô giáo", "F"], ["thầy giáo", "M"], ["giáo sư", ""], ["hiệu trưởng", ""], ["học sinh", ""], ["sinh viên", ""], ["bạn học", ""], ["bạn cùng lớp", ""],
    ["bác sĩ", ""], ["y tá", "F"], ["đại phu", ""], ["luật sư", ""], ["cảnh sát", ""], ["thư ký", ""], ["giám đốc", ""], ["tổng giám đốc", ""], ["chủ tịch", ""], ["tổng tài", ""], ["quản lý", ""], ["đội trưởng", ""], ["ông chủ", "M"], ["bà chủ", "F"],
    ["mẹ", "F"], ["bố", "M"], ["cha", "M"], ["ba", "M"], ["ông nội", "M"], ["bà nội", "F"], ["ông ngoại", "M"], ["bà ngoại", "F"], ["anh trai", "M"], ["chị gái", "F"], ["em trai", "M"], ["em gái", "F"], ["con trai", "M"], ["con gái", "F"],
    ["chồng", "M"], ["vợ", "F"], ["phu nhân", "F"], ["tiểu thư", "F"], ["thiếu gia", "M"], ["công tử", "M"], ["cô nương", "F"], ["công chúa", "F"], ["hoàng hậu", "F"], ["hoàng đế", "M"], ["thái tử", "M"], ["bệ hạ", ""], ["vương gia", "M"], ["thừa tướng", ""], ["tướng quân", ""],
    ["sư phụ", ""], ["sư tôn", ""], ["sư huynh", "M"], ["sư đệ", "M"], ["sư tỷ", "F"], ["sư muội", "F"], ["chưởng môn", ""], ["trưởng lão", ""], ["tông chủ", ""], ["tộc trưởng", ""], ["đệ tử", ""], ["đồ đệ", ""], ["đạo trưởng", "M"], ["hòa thượng", "M"], ["tiên tử", "F"], ["ma tôn", ""],
    ["quản gia", ""], ["vệ sĩ", ""], ["thị vệ", ""], ["nha hoàn", "F"], ["thị nữ", "F"], ["đối thủ", ""], ["kẻ thù", ""]
  ].sort(function(a, b) {return b[0].length - a[0].length});
  var ROLE_RE = ROLES.map(function(r) {return r[0]}).join("|");

  // gender words right before a name ("chàng trai tên Wang Shoujing", "cô Li")
  var MALE_BEFORE = "chàng trai|thiếu niên|cậu bé|cậu|chàng|thiếu gia|công tử|anh|ông|thầy|huynh|đại ca|gã|người đàn ông|nam sinh";
  var FEMALE_BEFORE = "cô gái|thiếu nữ|cô bé|cô nương|cô giáo|cô|bà|nàng|chị|tiểu thư|muội|người phụ nữ|nữ sinh|bé gái";
  // pronouns after a name in the same sentence
  var MALE_AFTER = "anh ấy|anh ta|hắn ta|hắn|ông ấy|ông ta|gã|y|chàng|cậu ấy|cậu ta|thiếu niên|chàng trai";
  var FEMALE_AFTER = "cô ấy|cô ta|nàng ta|nàng|bà ấy|bà ta|chị ấy|thị|cô gái|thiếu nữ";

  function wordRe(alts, tail) {return new RegExp("(?<![\\p{L}])(?:" + alts + ")" + (tail || "") + "(?![\\p{L}])", "iu")}
  var reRoleBefore = new RegExp("(?<![\\p{L}])(" + ROLE_RE + ")[\\s\"“”'‘’:,]*$", "iu");
  var reRoleAfter = new RegExp("^(?:[,，]\\s*|\\s+là\\s+|\\s*[-–]\\s*)(?:một\\s+|vị\\s+|người\\s+)?(" + ROLE_RE + ")(?![\\p{L}])", "iu");
  var reMaleBefore = new RegExp("(?<![\\p{L}])(?:" + MALE_BEFORE + ")(?:\\s+tên)?[\\s\"“”'‘’:,]*$", "iu");
  var reFemaleBefore = new RegExp("(?<![\\p{L}])(?:" + FEMALE_BEFORE + ")(?:\\s+tên)?[\\s\"“”'‘’:,]*$", "iu");
  var reMaleAfter = wordRe(MALE_AFTER), reFemaleAfter = wordRe(FEMALE_AFTER);

  function roleGender(phrase) {
    var p = phrase.toLowerCase();
    for (var i = 0; i < ROLES.length; i++) if (ROLES[i][0] === p) return ROLES[i][1];
    return "";
  }

  function lev1(a, b) {   // edit distance <= 1
    if (a === b) return true;
    if (Math.abs(a.length - b.length) > 1) return false;
    var i = 0; while (i < a.length && i < b.length && a[i] === b[i]) i++;
    if (a.length === b.length) return a.slice(i + 1) === b.slice(i + 1);
    return a.length > b.length ? a.slice(i + 1) === b.slice(i) : a.slice(i) === b.slice(i + 1);
  }

  // all runs "Surname Given [Given [Given]]" (capitalised ASCII words separated by single spaces)
  function findRuns(text) {
    var runs = [], re = /(?<![\p{L}])[A-Z][a-z]+(?:[ ][A-Z][a-z]+){0,3}(?![\p{L}])/gu, m;
    while ((m = re.exec(text))) {
      var words = m[0].split(" ");
      var start = m.index, w = 0;
      // the surname may be preceded by other capitalised words: slide to the first surname
      while (w < words.length && !SURSET[words[w].toLowerCase()]) {start += words[w].length + 1; w++}
      if (w >= words.length) continue;
      var rest = words.slice(w), given = [];
      for (var k = 1; k < rest.length && !NOT_NAME[rest[k]]; k++) given.push(rest[k]);
      runs.push({surname: rest[0], given: given, index: start, end: start + [rest[0]].concat(given).join(" ").length});
    }
    return runs;
  }

  function detect(text, opts) {
    opts = opts || {};
    var minCount = opts.minCount || 2, max = opts.max || 60;
    var runs = findRuns(text);
    // group full names (surname + >=1 given) by normalised key, merging 1-letter typos
    var groups = [];
    runs.filter(function(r) {return r.given.length}).forEach(function(r) {
      var form = [r.surname].concat(r.given).join(" ");
      var key = form.toLowerCase().replace(/ /g, "");
      var g = groups.filter(function(x) {return x.surname === r.surname.toLowerCase() && lev1(x.key, key)})[0];
      if (!g) {g = {surname: r.surname.toLowerCase(), key: key, forms: {}, count: 0, positions: []}; groups.push(g)}
      g.forms[form] = (g.forms[form] || 0) + 1;
      g.count++;
      g.positions.push([r.index, r.end]);
    });
    groups = groups.filter(function(g) {return g.count >= minCount});
    groups.forEach(function(g) {
      var forms = Object.keys(g.forms).sort(function(a, b) {return g.forms[b] - g.forms[a]});
      g.name = forms[0]; g.variants = forms;
    });
    // lone surname mentions ("Wang nói") count as the person when only one group has that surname
    var bySur = {}; groups.forEach(function(g) {bySur[g.surname] = (bySur[g.surname] || 0) + 1});
    runs.filter(function(r) {return !r.given.length}).forEach(function(r) {
      var s = r.surname.toLowerCase();
      if (bySur[s] === 1) groups.filter(function(g) {return g.surname === s})[0].positions.push([r.index, r.end]);
    });
    groups.forEach(function(g) {g.surnameUnique = bySur[g.surname] === 1});
    groups.sort(function(a, b) {return b.count - a.count});
    groups = groups.slice(0, max);
    groups.forEach(function(g) {Object.assign(g, describe(text, g.positions))});
    return groups.map(function(g) {
      return {name: g.name, variants: g.variants, count: g.count, surname: g.name.split(" ")[0], surnameUnique: g.surnameUnique,
        gender: g.gender, roles: g.roles};
    });
  }

  function describe(text, positions) {
    var male = 0, female = 0, direct = {};
    positions.slice(0, 300).forEach(function(pos) {
      var before = text.slice(Math.max(0, pos[0] - 30), pos[0]), after = text.slice(pos[1], pos[1] + 45);
      var m = before.match(reRoleBefore);
      if (m) {var k = m[1].toLowerCase(); direct[k] = (direct[k] || 0) + 1; var rg = roleGender(k); if (rg === "M") male += 3; if (rg === "F") female += 3}
      var a = after.match(reRoleAfter);
      if (a) {var k2 = a[1].toLowerCase(); direct[k2] = (direct[k2] || 0) + 1; var rg2 = roleGender(k2); if (rg2 === "M") male += 3; if (rg2 === "F") female += 3}
      if (reMaleBefore.test(before)) male += 3;
      if (reFemaleBefore.test(before)) female += 3;
      // first pronoun after the name, inside the same sentence
      var sentence = after.split(/[.!?…\n]/)[0];
      var clauseStart = !before || /[^\p{L}]\s*$/u.test(before) || !!m;
      if (clauseStart) {
        var im = sentence.search(reMaleAfter), if_ = sentence.search(reFemaleAfter);
        if (im >= 0 && (if_ < 0 || im < if_)) male++; else if (if_ >= 0) female++;
      }
    });
    var gender = "";
    if (male + female >= 1) {if (male >= female * 1.6) gender = "M"; else if (female >= male * 1.6) gender = "F"}
    var roles = Object.keys(direct).sort(function(a, b) {return direct[b] - direct[a]}).slice(0, 2)
      .map(function(k) {return {vi: k, count: direct[k]}});
    return {gender: gender, roles: roles};
  }

  return {detect: detect, lev1: lev1};
})();
if (typeof module !== "undefined") module.exports = NameDetector;
