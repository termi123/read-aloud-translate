/**
 * Heuristic detector for Chinese person names in the SOURCE text (before translation).
 * "surname + 1-2 given chars" that repeat and behave like names; gender from 他/她 and role words.
 */
var ZhNames = (function() {
  var SINGLE = "王李张刘陈杨黄赵吴周徐孙马朱胡郭何高林罗郑梁谢宋唐许韩冯邓曹彭曾肖田董袁潘蒋蔡杜叶程苏魏吕丁沈姚卢姜崔钟谭陆汪范廖贾夏方白邹孟熊秦邱江尹薛段雷侯龙史陶黎贺顾毛郝龚邵万钱严武戴莫孔汤萧楚慕凌柳华冷乔俞邢柯傅阮蒲屠池洛宁霍牧澹";
  var COMPOUND = ["欧阳","司马","慕容","上官","诸葛","东方","夏侯","皇甫","尉迟","公孙","令狐","长孙","独孤","南宫","轩辕","司徒","端木","西门","百里","东郭","澹台","宇文","呼延","赫连","闻人","淳于"];

  var STOP = ("高兴 高大 高手 高级 高度 高中 高空 高声 高低 高峰 白天 白色 白云 白光 白衣 白发 白银 白玉 方便 方向 方法 方面 方式 方才 方圆 黄色 黄金 黄昏 金色 金属 金光 金钱 金黄 张开 王子 王国 王者 王府 王爷 马上 马车 马匹 万一 万分 万物 万千 田野 田地 林中 林间 江湖 江山 江水 龙王 龙虎 龙凤 许多 许久 何必 何时 何处 何况 何人 何事 钟声 冷笑 冷哼 冷漠 冷静 冷冷 冷意 冷汗 冷光 冷眼 冷酷 君子 君王 楚楚 莫非 莫名 莫要 莫大 武器 武功 武士 武技 武者 武道 毛病 毛发 夏天 史上 陆续 陆地 孙子 宋体 唐突 程度 程序 苏醒 段落 雷声 雷电 雷霆 雷鸣 侯爷 陶醉 黎明 顾虑 顾忌 顾及 毛巾 严重 严格 严肃 严厉 严密 钱财 戴着 孔雀 汤药 萧条 萧瑟 柳树 柳叶 华丽 华贵 华美 乔装 宁愿 宁静 宁可 熊熊 熊猫 范围 范畴 姜汁 池水 池塘 池子 毛骨 毛孔 毛笔 方丈 方正 白痴 白费 白白 白净 白皙 白嫩 白骨 白雾 白烟 白纸 白日 黑白 白马 田间 许可 许诺 何不 何妨 何苦 何用 何以 何止 高明 高傲 高贵 高尚 高昂 高远 高耸 高悬 高深 高强 高档 高温 高压 高速 高层 高原 高处 高升 高考 高调 高位 高洁 高雅 高挑 高瘦 高亢 周围 周身 周遭 周全 周密 周期 周边 方位 万丈 万般 万里 万年 万古 万众 凌厉 凌乱 凌空 凌晨 凌驾 凌云 冷淡 冷峻 冷艳").split(/\s+/).filter(Boolean);
  var STOPSET = {}; STOP.forEach(function(w) {STOPSET[w] = true});   // (set: duplicates are harmless)

  var FUNC = "的了是在不有和就都而及与着或之也很把被让给对向从到这那我你他她它们个吗呢吧啊呀么说道想看听走来去要会能可为以又还只才再已正刚便却但如若因所其此各每某任何";
  var FUNCSET = {}; FUNC.split("").forEach(function(c) {FUNCSET[c] = true});

  var VERB_SET = {}; "说道笑问看望盯瞪点摇皱冷淡放回带拿摸等发哼叹喊叫吼骂答回应听想觉感知起站坐走跑冲转抬低伸拉推抱握拿挥举指拍打踢跳飞退进出来去到却也便又还都已正刚终忽突立微轻缓慢沉默开闭怒喝嘶嚷愣怔呆愕惊怕恼恨嘲讽哭泣吸呼吐咬咳睁眯扫瞥瞧注视凝视".split("").forEach(function(c) {VERB_SET[c] = true});
  var BEFORE_SET = {}; "对向和与跟被把让给叫由问拉扶按推抱看望瞪见找救杀打喊".split("").forEach(function(c) {BEFORE_SET[c] = true});

  // [zh, vi label, gender]
  var ROLES = [
    ["老师","giáo viên",""],["教授","giáo sư",""],["校长","hiệu trưởng",""],["班长","lớp trưởng",""],["同学","bạn học",""],["学生","học sinh",""],
    ["妈妈","mẹ","F"],["母亲","mẹ","F"],["娘亲","mẹ","F"],["爸爸","bố","M"],["父亲","bố","M"],
    ["儿子","con trai","M"],["女儿","con gái","F"],["哥哥","anh trai","M"],["姐姐","chị gái","F"],["弟弟","em trai","M"],["妹妹","em gái","F"],
    ["爷爷","ông nội","M"],["奶奶","bà nội","F"],["师父","sư phụ",""],["师傅","sư phụ",""],["师尊","sư tôn",""],
    ["师兄","sư huynh","M"],["师姐","sư tỷ","F"],["师弟","sư đệ","M"],["师妹","sư muội","F"],
    ["掌门","chưởng môn",""],["长老","trưởng lão",""],["宗主","tông chủ",""],["族长","tộc trưởng",""],["门主","môn chủ",""],
    ["医生","bác sĩ",""],["大夫","đại phu",""],["护士","y tá","F"],["将军","tướng quân",""],["皇帝","hoàng đế","M"],["陛下","bệ hạ",""],
    ["太子","thái tử","M"],["皇后","hoàng hậu","F"],["公主","công chúa","F"],["王爷","vương gia","M"],["郡主","quận chúa","F"],["丞相","thừa tướng",""],
    ["老板","ông chủ",""],["总裁","tổng tài",""],["经理","quản lý",""],["秘书","thư ký",""],["队长","đội trưởng",""],
    ["警察","cảnh sát",""],["律师","luật sư",""],["老公","chồng","M"],["丈夫","chồng","M"],["妻子","vợ","F"],["老婆","vợ","F"],
    ["夫人","phu nhân","F"],["小姐","tiểu thư","F"],["少爷","thiếu gia","M"],["公子","công tử","M"],["姑娘","cô nương","F"],
    ["少主","thiếu chủ",""],["魔尊","ma tôn",""],["仙子","tiên tử","F"],["道长","đạo trưởng","M"],["和尚","hòa thượng","M"],
    ["剑客","kiếm khách","M"],["丫鬟","nha hoàn","F"],["侍女","thị nữ","F"],["管家","quản gia",""],["保镖","vệ sĩ",""],
    ["侍卫","thị vệ",""],["弟子","đệ tử",""],["徒弟","đồ đệ",""],["朋友","bạn",""],["对手","đối thủ",""],["敌人","kẻ địch",""]
  ];
  var FEMALE_WORDS = ["少女","女子","女人","女孩","美人","佳人","姑娘","小姐","夫人","母亲","妈妈","姐姐","妹妹","公主","皇后","仙子","女侠","女修"];
  var MALE_WORDS = ["少年","男子","男人","男孩","公子","少爷","先生","父亲","爸爸","哥哥","弟弟","大侠","王爷","皇帝","青年"];

  function isCJK(c) {return c >= "一" && c <= "鿿"}
  function isBoundary(c) {return !c || !isCJK(c) || !!BEFORE_SET[c]}
  function surnameAt(text, i) {
    var two = text.substr(i, 2);
    if (COMPOUND.indexOf(two) >= 0) return two;
    var c = text.charAt(i);
    return SINGLE.indexOf(c) >= 0 ? c : null;
  }
  function validGiven(s) {
    for (var k = 0; k < s.length; k++) if (!isCJK(s[k]) || FUNCSET[s[k]]) return false;
    return true;
  }
  function hasRoleWord(s) {
    for (var r = 0; r < ROLES.length; r++) if (s.indexOf(ROLES[r][0]) >= 0) return true;
    return false;
  }
  function roleFollows(rest) {
    for (var r = 0; r < ROLES.length; r++) if (rest.indexOf(ROLES[r][0]) === 0) return true;
    return false;
  }

  function collect(text) {
    var stats = {};
    function add(name, before, after, rest) {
      var st = stats[name] || (stats[name] = {count: 0, ctx: 0});
      st.count++;
      // names usually start a clause (subject) and are followed by a verb / role word
      var score = (isBoundary(before) ? 0.6 : 0) + (roleFollows(rest) || VERB_SET[after] ? 0.5 : 0);
      if (score === 0 && VERB_SET[before]) score = 0.2;
      st.ctx += Math.min(1, score);
    }
    for (var i = 0; i < text.length; i++) {
      var sn = surnameAt(text, i);
      if (!sn) continue;
      var before = text.charAt(i - 1);
      [1, 2].forEach(function(glen) {
        var name = text.substr(i, sn.length + glen);
        if (name.length !== sn.length + glen) return;
        var given = name.substr(sn.length);
        if (!validGiven(given) || STOPSET[name] || hasRoleWord(given)) return;
        add(name, before, text.charAt(i + name.length), text.substr(i + name.length, 3));
      });
    }
    return stats;
  }

  function detect(text, opts) {
    opts = opts || {};
    var minCount = opts.minCount || 2, max = opts.max || 60;
    var stats = collect(text);
    var names = Object.keys(stats).sort(function(a, b) {return b.length - a.length || stats[b].count - stats[a].count});
    var chosen = [], remaining = {};
    names.forEach(function(n) {remaining[n] = stats[n].count});
    names.forEach(function(n) {
      var st = stats[n], cnt = remaining[n], ratio = st.ctx / st.count;
      var ok = cnt >= minCount && (cnt >= 6 ? ratio >= 0.4 : ratio >= 0.6);
      if (ok && n.length >= 2 && !(n.length === 2 && SINGLE.indexOf(n[0]) < 0)) {
        chosen.push({name: n, count: cnt});
        for (var l = n.length - 1; l >= 2; l--) {
          var p = n.substr(0, l);
          if (remaining[p] != null) remaining[p] = Math.max(0, remaining[p] - cnt);
        }
      }
    });
    chosen.sort(function(a, b) {return b.count - a.count});
    chosen = chosen.slice(0, max);
    chosen.forEach(function(c) {Object.assign(c, describe(text, c.name))});
    return chosen;
  }

  function describe(text, name) {
    var positions = [], idx = -1;
    while ((idx = text.indexOf(name, idx + 1)) >= 0 && positions.length < 300) positions.push(idx);
    var male = 0, female = 0, direct = {};
    positions.forEach(function(p) {
      var end = p + name.length, right = text.substr(end, 12), left = text.substring(Math.max(0, p - 8), p);
      ROLES.forEach(function(r) {
        var key = r[0];
        if (right.indexOf(key) === 0 || left.slice(-key.length) === key) {
          direct[r[1]] = (direct[r[1]] || 0) + 1;
          if (r[2] === "M") male += 3;
          if (r[2] === "F") female += 3;
        }
      });
      var tail = text.substr(end, 24).split(/[。！？!?\n]/)[0];
      var m = isCJK(text.charAt(p - 1)) ? null : tail.match(/[他她]/);   // only when the name is the clause subject
      if (m) {if (m[0] === "他") male++; else female++}
      else if (!isCJK(text.charAt(p - 1))) {
        // narration often continues "<name>……。他/她……" : look at the start of the next sentence
        var after = text.substr(end, 60), e = after.search(/[。！？!?\n]/);
        if (e >= 0) {
          var nx = after.substr(e + 1, 3).replace(/^[”」"']+/, "").charAt(0);
          if (nx === "他") male++; else if (nx === "她") female++;
        }
      }
      FEMALE_WORDS.forEach(function(w) {if (right.slice(0, 8).indexOf(w) === 0 || left.slice(-w.length) === w) female += 2});
      MALE_WORDS.forEach(function(w) {if (right.slice(0, 8).indexOf(w) === 0 || left.slice(-w.length) === w) male += 2});
    });
    var gender = "";
    if (male + female >= 1) {if (male >= female * 1.6) gender = "M"; else if (female >= male * 1.6) gender = "F"}
    var roles = Object.keys(direct).sort(function(a, b) {return direct[b] - direct[a]}).slice(0, 2);
    return {gender: gender, roles: roles};
  }

  return {detect: detect};
})();
if (typeof module !== "undefined") module.exports = ZhNames;
