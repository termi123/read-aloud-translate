// Pinyin syllable -> most common Han-Viet reading used in names. Only a *suggestion*; the user edits it.
var PINYIN_HV = (function() {
  var raw = "bai:Bạch ban:Ban bao:Bảo bei:Bối bin:Bân bing:Băng bo:Bác cai:Thái can:Xán cang:Thương cao:Tào chang:Trường chao:Siêu chen:Trần cheng:Thành chi:Trì chong:Sùng chu:Sở chun:Xuân cong:Thông cui:Thôi da:Đạt dai:Đới dan:Đan dao:Đạo de:Đức deng:Đặng di:Địch dian:Điền diao:Điêu ding:Đinh dong:Đông du:Đỗ duan:Đoạn dun:Đôn e:Nga en:Ân fa:Phát fan:Phàm fang:Phương fei:Phi fen:Phân feng:Phong fu:Phú gang:Cương gao:Cao ge:Cát geng:Canh gong:Công gu:Cố guan:Quan guang:Quang gui:Quý guo:Quốc hai:Hải han:Hàn hao:Hạo he:Hà hei:Hắc heng:Hằng hong:Hồng hou:Hầu hu:Hồ hua:Hoa huai:Hoài huan:Hoàn huang:Hoàng hui:Huy hun:Hồn huo:Hỏa ji:Cơ jia:Gia jian:Kiện jiang:Giang jiao:Giao jie:Kiệt jin:Kim jing:Kinh jiu:Cửu ju:Cư juan:Quyên jue:Quyết jun:Quân kai:Khải kang:Khang ke:Kha kong:Khổng kui:Khuê kun:Côn lai:Lai lan:Lan lang:Lang lao:Lão le:Lạc lei:Lôi leng:Lãnh li:Lý lian:Liên liang:Lương liao:Liêu lin:Lâm ling:Linh liu:Lưu long:Long lou:Lâu lu:Lục luan:Loan lun:Luân luo:La ma:Mã mai:Mai man:Mạn mao:Mao mei:Mỹ men:Môn meng:Mạnh mi:Mật mian:Miên miao:Miêu min:Mẫn ming:Minh mo:Mặc mu:Mục na:Na nan:Nam ni:Ni nian:Niên ning:Ninh niu:Ngưu nuo:Nặc ou:Âu pan:Phan pang:Bàng pei:Bội peng:Bành pi:Phi pin:Phẩm ping:Bình po:Phách pu:Phổ qi:Kỳ qian:Tiền qiang:Cường qiao:Kiều qin:Tần qing:Thanh qiong:Quỳnh qiu:Khâu qu:Khuất quan:Toàn que:Khuyết qun:Quần ran:Nhiên rang:Nhượng ren:Nhân rong:Dung ru:Như ruan:Nguyễn rui:Thụy run:Nhuận sa:Tát san:San sang:Tang sen:Sâm sha:Sa shan:Sơn shang:Thượng shao:Thiệu she:Xà shen:Thân sheng:Thịnh shi:Thạch shou:Thủ shu:Thư shuai:Soái shui:Thủy shun:Thuận si:Tư song:Tống su:Tô sui:Tùy sun:Tôn tai:Thái tan:Đàm tang:Đường tao:Đào teng:Đằng ti:Đề tian:Thiên tiao:Điều ting:Đình tong:Đồng tu:Đồ tuan:Đoàn wan:Vạn wang:Vương wei:Vĩ wen:Văn weng:Ông wu:Vũ xi:Hi xia:Hạ xian:Tiên xiang:Tường xiao:Tiêu xie:Tạ xin:Tân xing:Hưng xiong:Hùng xiu:Tú xu:Từ xuan:Huyền xue:Tuyết xun:Tuấn ya:Nhã yan:Yên yang:Dương yao:Diêu ye:Diệp yi:Nghi yin:Ân ying:Anh yong:Dũng you:Hữu yu:Vũ yuan:Viên yue:Nguyệt yun:Vân zai:Tải zao:Tảo ze:Trạch zeng:Tăng zhan:Chiến zhang:Trương zhao:Triệu zhe:Triết zhen:Chân zheng:Chính zhi:Chí zhong:Chung zhou:Chu zhu:Chu zhuan:Chuyên zhuang:Trang zhun:Chuẩn zhuo:Trác zi:Tử zong:Tông zou:Trâu zu:Tổ zuo:Tả";
  var map = {};
  raw.split(" ").forEach(function(x) {var i = x.indexOf(":"); map[x.slice(0, i)] = x.slice(i + 1)});
  return map;
})();

var PINYIN_COMPOUND_HV = {
  ouyang: "Âu Dương", sima: "Tư Mã", murong: "Mộ Dung", shangguan: "Thượng Quan", zhuge: "Gia Cát", dongfang: "Đông Phương",
  xiahou: "Hạ Hầu", gongsun: "Công Tôn", linghu: "Lệnh Hồ", nangong: "Nam Cung", xuanyuan: "Hiên Viên", situ: "Tư Đồ",
  duanmu: "Đoan Mộc", ximen: "Tây Môn", baili: "Bách Lý", yuwen: "Vũ Văn", huangfu: "Hoàng Phủ", gongyang: "Công Dương"
};

// "Shoujing" -> "Thủ Kinh" (unknown parts stay as-is, capitalised)
function pinyinToHanViet(token) {
  var t = token.toLowerCase();
  if (PINYIN_COMPOUND_HV[t]) return PINYIN_COMPOUND_HV[t];
  var out = [], i = 0;
  while (i < t.length) {
    var hit = null;
    for (var len = Math.min(6, t.length - i); len >= 1; len--) {
      var s = t.substr(i, len);
      if (PINYIN_HV[s]) {hit = s; break}
    }
    if (!hit) return token.charAt(0).toUpperCase() + token.slice(1);
    out.push(PINYIN_HV[hit]);
    i += hit.length;
  }
  return out.join(" ");
}
if (typeof module !== "undefined") module.exports = {PINYIN_HV: PINYIN_HV, pinyinToHanViet: pinyinToHanViet};
