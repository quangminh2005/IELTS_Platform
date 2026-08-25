# -*- coding: utf-8 -*-
"""Dung file JSON import cho IELTS Master - Reading Test 47.

Nguon:
  - de:     E:/ielts_master/reading/Reading (41-50)/47/Test 47.pdf
  - dap an: E:/ielts_master/reading/Reading (41-50)/47/Answer Sheet - 47.docx

Chay `python tmp/build47_reading_text.py` truoc de co tmp/_r47_passages.json.
"""
import json
import re
import sys

sys.stdout.reconfigure(encoding="utf-8")

P = json.load(open("tmp/_r47_passages.json", encoding="utf-8"))
DIAGRAM = open("tmp/_r47_diag.txt", encoding="utf-8").read().strip()


def q(order, qtype, prompt, answer, explanation, evidence=None, options=None):
    d = {"order": order, "questionType": qtype, "prompt": prompt,
         "answer": answer if isinstance(answer, list) else [answer],
         "explanation": explanation, "points": 1}
    if evidence:
        d["evidence"] = evidence
    if options:
        d["options"] = options
    return d


# ============================ PASSAGE 1 ============================
p1_flow = """# A possible benefit from increased CO2 levels in the sea
:::flow
Increased ocean acidification
Large quantities of organic compounds made by [[8]]
Transfer to [[9]]
[[10]] are formed
[[11]] temperatures
Reduction in rate of [[12]]
:::"""

opts13 = [
    "A We will have to wait and see if acidification has serious effects.",
    "B It is clear that acidification will cause huge damage to marine life.",
    "C It is likely that increased CO2 will change marine ecosystems considerably.",
    "D The theory that increased CO2 could have positive results is believable.",
]

p1 = [
    q(1, "short_answer", "What does the pteropod use to move itself through the water?",
      ["small flaps", "flaps", "(small) flaps", "its small flaps"],
      "Loài pteropod bơi theo kiểu giống bướm vỗ cánh, được đẩy đi nhờ NHỮNG VẠT NHỎ (small flaps) ở thân.",
      "which swim in a way that resembles butterfly flight, propelled by small flaps"),
    q(2, "short_answer", "Which part of the pteropods was being damaged by increased acidification?",
      ["shells", "their shells", "the shells", "(their) shells"],
      "Fabry thấy pteropod vẫn bơi được nhưng VỎ của chúng đang tan dần thấy rõ - đó là bộ phận bị axit ăn mòn.",
      "The pteropods were still swimming, but their shells were visibly dissolving"),
    q(3, "short_answer",
      "What proportion of the carbon released over the last 200 years has been taken in by the oceans?",
      ["a third", "about a third", "1/3", "about 1/3", "one third", "one-third"],
      "Biển đã hấp thụ KHOẢNG MỘT PHẦN BA lượng carbon từ nhiên liệu hoá thạch thải ra kể từ đầu cách mạng công nghiệp giữa thế kỷ 18 (tức khoảng 200 năm nay).",
      "the seas have absorbed about a third of all the fossil-fuel carbon released into the atmosphere since the beginning of the industrial revolution in the mid-eighteenth century"),
    q(4, "short_answer", "Where do carbonates enter the oceans from?",
      ["rocks on land", "rocks", "(rocks) on land", "from rocks on land", "ocean sediments"],
      "Carbonate được giải phóng từ ĐÁ TRÊN ĐẤT LIỀN (và từ trầm tích đáy biển) rồi trung hoà bớt CO2 đã hoà tan - giống thả phấn vào axit. Đáp án sách ghi \"rocks (on land)\".",
      "the release of carbonates from rocks on land and from ocean sediments can neutralise the dissolved CO2"),
    q(5, "short_answer",
      "How long did the oceans need to recover after the destruction of marine life by acidification 55 million years ago?",
      ["over 100,000 years", "100,000 years", "over 100000 years", "100000 years"],
      "Sau đợt tuyệt chủng hàng loạt cách đây 55 triệu năm, biển phải mất HƠN 100.000 NĂM mới trở lại trạng thái bình thường.",
      "It took over 100,000 years for the oceans to return to their normal state."),
    q(6, "short_answer", "Which businesses will suffer if reefs are damaged?",
      ["fishing and tourism", "tourism and fishing", "fishing and tourism industries"],
      "Báo cáo của Royal Society cảnh báo NGHỀ CÁ VÀ DU LỊCH dựa vào các rạn san hô sẽ mất hàng tỷ đô la mỗi năm.",
      "with fishing and tourism based around reefs losing billions of dollars each year"),
    q(7, "short_answer", "What type of creatures make their skeletons out of aragonite?",
      ["corals", "coral", "(corals)"],
      "Aragonite dễ tan hơn calcite, nên những sinh vật có bộ khung bằng aragonite - tiêu biểu là SAN HÔ - sẽ chịu thiệt nặng nhất.",
      "So organisms with aragonite structures, such as corals, will be hardest hit."),
    q(8, "note_completion", "Câu 8", ["microbes", "microbe"],
      "Trong môi trường axit hơn, VI SINH VẬT (microbes) sinh ra nhiều hợp chất hữu cơ dễ bay hơi hơn, chẳng hạn dimethyl sulphide.",
      "in more acidic conditions, microbes will produce more volatile organic compounds such as dimethyl sulphide"),
    q(9, "note_completion", "Câu 9", ["the atmosphere", "atmosphere"],
      "Một phần các hợp chất đó thoát lên KHÍ QUYỂN - đây là bước chuyển tiếp trong sơ đồ.",
      "some of which escapes to the atmosphere and causes clouds to develop"),
    q(10, "note_completion", "Câu 10", ["clouds", "cloud", "more clouds"],
      "Lên tới khí quyển, các hợp chất này khiến MÂY hình thành.",
      "some of which escapes to the atmosphere and causes clouds to develop"),
    q(11, "note_completion", "Câu 11", ["cooler", "cooler conditions"],
      "Nhiều mây hơn đồng nghĩa với nhiệt độ MÁT HƠN (cooler). Ô trống đứng ngay trước chữ \"temperatures\" nên phải điền tính từ so sánh \"cooler\".",
      "More clouds would mean cooler conditions"),
    q(12, "note_completion", "Câu 12", ["global warming"],
      "Nhiệt độ mát hơn có thể làm CHẬM quá trình NÓNG LÊN TOÀN CẦU - đây chính là \"lợi ích có thể có\" mà sơ đồ nói tới.",
      "which could potentially slow global warming"),
    q(13, "multiple_choice", "Which of the following best summarises the writer's view in the passage?",
      [opts13[2]],
      "Ở đoạn kết, tác giả dẫn lời Caldeira: biển sẽ không chết hẳn, nhưng \"kết cục có khả năng xảy ra là hệ sinh thái bị đơn giản hoá triệt để\", và tác giả kết luận axit hoá sẽ khiến mất nhiều loài. Tức là CO2 tăng RẤT CÓ THỂ làm hệ sinh thái biển thay đổi đáng kể → C. Bẫy: A sai vì tác giả không hề chờ xem; B sai vì tác giả dùng \"likely\" chứ không khẳng định chắc chắn; D sai vì phần lợi ích chỉ được nêu như một phát hiện gây tò mò.",
      "A likely outcome will be a radical simplification of the ecosystem. / it seems clear that acidification will mean the loss of many species",
      opts13),
]

# ============================ PASSAGE 2 ============================
p2_summary = """# A Proposal for Regulating Multinational Corporations
The FTO would determine the [[20]] for the multinational corporations to follow. In this way, a multinational corporation would have to prove that all aspects of the way it produced its goods and the systems for their [[21]] to customers was in line with FTO requirements. Similarly it would need to satisfy the FTO that the processes employed by any [[22]] that it used were also acceptable.

As an illustration, in order to source cocoa from Africa, a corporation would have to ensure that no illegal [[23]] were being used by the [[24]] during cultivation and that they had not taken over land from [[25]].

It would not be sufficient for multinational corporations to say that these points had been checked. Their conduct would have to be inspected by [[26]] appointed by the FTO."""

opts14 = ["A point out how differently industries were financed in the past.",
          "B show how unnecessary tariff barriers are for countries today.",
          "C help the reader understand how infant industry protection works.",
          "D compare European trade development with that of the United States."]
opts15 = ["A Businesses will succeed if they learn from established companies.",
          "B Detailed market research is often neglected in developing countries.",
          "C You have to be prepared to adapt your products quickly to follow fashion.",
          "D New industries in poor countries will probably fail without protection."]
opts16 = ["A improving safety in the majority of workplaces around the world.",
          "B preventing the continued destruction of endangered wildlife habitats.",
          "C encouraging states to work together in a more even-handed way.",
          "D making politicians agree to more representative systems of government."]
opts17 = ["A The trades unions' aim is to help foreign workers gain better conditions.",
          "B The trades unions are concerned about the effects of imports on local jobs.",
          "C Workers in poor countries are grateful for the trades unions' support.",
          "D Campaigners are right to suggest imposing tariffs against bad treatment."]
opts18 = ["A Factories would be set up and jobs created in the country of origin.",
          "B Multinational companies would consume fewer natural resources.",
          "C The export of finished products around the world would decrease.",
          "D Countries would be able to keep their resources for the domestic market."]
opts19 = ["A It would help to combat injustice in its many different forms.",
          "B It would be difficult to introduce but would be worth the effort.",
          "C States all over the world would earn more through trade as a result of it.",
          "D Multinationals would accept it because it measures exports more precisely."]

p2 = [
    q(14, "multiple_choice", "The writer refers to textile production in Britain in order to",
      [opts14[2]],
      "Ngành dệt Anh được nêu NGAY SAU định nghĩa \"infant industry protection\" (bảo hộ ngành non trẻ), như một ví dụ minh hoạ: nó được nuôi dưỡng bằng thuế quan và lệnh cấm hàng cạnh tranh → C. Bẫy: D sai vì Mỹ được nêu như một ví dụ riêng chứ không phải để so sánh với châu Âu; B sai ngược hoàn toàn với ý tác giả.",
      "The textile industry in Britain, for example, on which the Industrial Revolution was built in the nineteenth century, was nurtured and promoted by means of tariffs (or trade taxes) and the outright prohibition of competing goods.",
      opts14),
    q(15, "multiple_choice", "What is the writer's main point in the third paragraph?",
      [opts15[3]],
      "Đoạn 3 ví nước nghèo cạnh tranh trực diện với nước có ngành công nghiệp lâu đời như tập bơi ở dòng sông chảy xiết: bị cuốn trôi và chết đuối trước khi kịp có kỹ năng. Ý là ngành non trẻ ở nước nghèo SẼ THẤT BẠI NẾU KHÔNG ĐƯỢC BẢO HỘ → D.",
      "For nations to develop in direct competition with countries with established industries is like learning to swim in a fast-flowing river: you are likely to be swept away and drowned long before you acquire the necessary expertise.",
      opts15),
    q(16, "multiple_choice", "According to the writer, a fair trade system could have the effect of",
      [opts16[2]],
      "Hệ thống thương mại công bằng sẽ đẩy thế giới tới thương mại tự do thật sự - cách CÔNG BẰNG NHẤT để điều hành quan hệ GIỮA CÁC QUỐC GIA, hướng tới bình đẳng kinh tế rồi bình đẳng chính trị → C. Bẫy: A và B chính là những vấn đề mà tác giả nói ngay sau đó rằng hệ thống này KHÔNG giải quyết trực tiếp được.",
      "A fair-trade system should, or so we should hope, slowly push the world towards genuine free trade, which is likely to be the most equitable means of governing nations' relationships with each other.",
      opts16),
    q(17, "multiple_choice", "What point is the writer making in the sixth paragraph?",
      [opts17[1]],
      "Đoạn 6 nói cách đánh thuế hàng nhập từ nước ngược đãi lao động cũng được CÔNG ĐOÀN ủng hộ, nhưng là để BẢO VỆ VIỆC LÀM của đoàn viên trước người nước ngoài → B. Bẫy: A sai vì mục tiêu của công đoàn không phải giúp lao động nước ngoài; C sai ngược - chính người lao động nước nghèo \"deeply resented\" cách làm này.",
      "This approach has also been advocated by trades unions seeking to protect members' jobs from foreigners.",
      opts17),
    q(18, "multiple_choice",
      "According to the writer, what is one of the benefits of full-cost accounting?",
      [opts18[0]],
      "Khi phải chịu đủ chi phí, không công ty nào còn xuất gỗ, hạt cà phê hay bông thô nữa vì vận chuyển nguyên liệu cồng kềnh tốn năng lượng hơn hẳn; mọi thứ sẽ được CHẾ BIẾN NGAY TẠI NƯỚC XUẤT XỨ, biến các nước này thành nơi sản xuất được ưa chuộng nhất - tức có nhà máy và việc làm → A. Bẫy: C sai vì hàng thành phẩm vẫn được xuất, chỉ đổi nơi sản xuất.",
      "One of the many beneficial impacts of such full-cost accounting would be that everything that could be processed in the country of origin would be. / Those nations which are currently locked into the export of raw materials would become the most favoured locations for manufacturing.",
      opts18),
    q(19, "multiple_choice", "What conclusion does the writer come to about the FTO system?",
      [opts19[1]],
      "Câu kết: áp dụng các biện pháp này trước sự phản kháng của các chính phủ và tập đoàn mạnh nhất thế giới sẽ đòi hỏi những cách làm khắc nghiệt và bất thường (KHÓ), NHƯNG mục tiêu thương mại công bằng toàn cầu sẽ mang lại sự san bằng kinh tế mà thiếu nó thì không có công lý (ĐÁNG LÀM) → B. Bẫy: A sai vì tác giả đã thừa nhận hệ thống này không xử lý trực tiếp mọi bất công.",
      "To introduce these measures in the face of the resistance of the world's most powerful governments and companies would require severe and unusual methods. But the goal of universal fair trade would permit the global economic levelling without which there can be no justice.",
      opts19),
    q(20, "note_completion", "Câu 20", ["standards", "the standards", "rules", "rule"],
      "Chức năng thứ hai của FTO là ĐẶT RA CÁC TIÊU CHUẨN (standards) mà các tập đoàn đa quốc gia phải tuân theo.",
      "So a second function of the FTO could be to set the standards to which those corporations must conform."),
    q(21, "note_completion", "Câu 21", ["distribution", "the distribution"],
      "Tập đoàn phải chứng minh được rằng ở MỌI KHÂU sản xuất VÀ PHÂN PHỐI (distribution) đều đạt chuẩn - \"systems for their ... to customers\" chính là khâu phân phối.",
      "A corporation would not be permitted to trade between nations unless it could demonstrate that, at every stage of manufacture and distribution, its own operations and those of its suppliers met the necessary standards."),
    q(22, "note_completion", "Câu 22", ["suppliers", "supplier", "its suppliers"],
      "Không chỉ hoạt động của chính mình, tập đoàn còn phải bảo đảm các NHÀ CUNG CẤP (suppliers) của nó cũng đạt chuẩn.",
      "A corporation would not be permitted to trade between nations unless it could demonstrate that, at every stage of manufacture and distribution, its own operations and those of its suppliers met the necessary standards."),
    q(23, "note_completion", "Câu 23", ["pesticides", "pesticide", "banned pesticides"],
      "Ví dụ nhập ca cao từ châu Phi: phải chứng minh bên bán KHÔNG dùng THUỐC TRỪ SÂU bị cấm (banned pesticides = illegal pesticides trong bài tóm tắt).",
      "it would need to demonstrate that the plantation owners it bought from were not using banned pesticides"),
    q(24, "note_completion", "Câu 24", ["plantation owners", "the plantation owners", "plantation owner"],
      "Người dùng thuốc trừ sâu trong quá trình canh tác chính là các CHỦ ĐỒN ĐIỀN (plantation owners) mà tập đoàn mua hàng của họ.",
      "it would need to demonstrate that the plantation owners it bought from were not using banned pesticides"),
    q(25, "note_completion", "Câu 25", ["protected forests", "protected forest"],
      "Điều kiện thứ hai: các chủ đồn điền không được lấn sang RỪNG ĐƯỢC BẢO VỆ (protected forests).",
      "expanding into protected forests or failing to conform to whatever other standards the FTO set"),
    q(26, "note_completion", "Câu 26", ["monitors", "monitor", "accredited monitors"],
      "Tập đoàn tự nói suông là chưa đủ: hoạt động của họ phải do các GIÁM SÁT VIÊN (monitors) được FTO công nhận đánh giá, và chính tập đoàn phải trả chi phí đó.",
      "The company's performance would be assessed, at its own expense, by monitors accredited to the organisation."),
]

# ============================ PASSAGE 3 ============================
p3_diagram = """[[27]] - to measure weight loss
superconductive disc rotating at max [[28]]
cooling [[29]]
[[30]] - to protect object from disturbance"""

cls_opts = ["A Podkletnov", "B Tohoku University", "C Modanese"]

p3 = [
    q(27, "note_completion", "Câu 27",
      ["balance", "sensitive balance", "a sensitive balance", "(sensitive) balance"],
      "Vật thử được treo vào một CHIẾC CÂN nhạy đặt phía trên đĩa - đó là thứ dùng để đo phần trọng lượng bị mất.",
      "An object was suspended from a sensitive balance above the disc."),
    q(28, "note_completion", "Câu 28",
      ["5,000 revolutions per minute", "5000 revolutions per minute", "5,000 rpm", "5000 rpm"],
      "Đĩa siêu dẫn được nâng bằng từ trường và quay với tốc độ tối đa 5.000 VÒNG MỖI PHÚT.",
      "magnetically levitated and rotated at high speed - up to 5,000 revolutions per minute (rpm) in a magnetic field"),
    q(29, "note_completion", "Câu 29", ["liquid nitrogen"],
      "Đĩa siêu dẫn được bao quanh bằng NITƠ LỎNG để làm lạnh (tới -196°C) thì mới mất hết điện trở.",
      "A superconductive disc, surrounded by liquid nitrogen was magnetically levitated"),
    q(30, "note_completion", "Câu 30", ["glass tube", "a glass tube", "in a glass tube"],
      "Vật thử được bọc trong một ỐNG THUỶ TINH để chắn mọi ảnh hưởng của luồng khí - tức bảo vệ khỏi nhiễu động.",
      "It was enclosed in a glass tube to shield it from any effects of air currents."),
    q(31, "matching", "The experiment only works if the equipment moves in a particular direction.",
      [cls_opts[1]],
      "Thí nghiệm ở Đại học Tohoku: hiệu ứng CHỈ xuất hiện khi con quay hồi chuyển quay NGƯỢC CHIỀU KIM ĐỒNG HỒ - tức phụ thuộc vào chiều chuyển động. → B.",
      "Oddly the effect only appeared if the gyroscope was spinning anticlockwise",
      cls_opts),
    q(32, "matching", "Varying amounts of weight are lost as a result of the test.",
      [cls_opts[0]],
      "Podkletnov quan sát thấy vật thử mất một lượng trọng lượng THAY ĐỔI, từ dưới 0,5% đến 2% tổng trọng lượng. → A.",
      "Podkletnov was able to observe that the object lost a variable amount of weight from less than 0.5 percent to 2 percent of its total weight",
      cls_opts),
    q(33, "matching", "Gravity could be absorbed by a magnetic field.",
      [cls_opts[2]],
      "Modanese đặt giả thuyết rằng từ trường bao quanh đĩa siêu dẫn có thể HẤP THU (assimilate) một phần trường hấp dẫn bên dưới nó. → C.",
      "Modanese wondered if the magnetic fields surrounding the superconductive disc might somehow assimilate part of the gravitational field under it.",
      cls_opts),
    q(34, "matching", "Superconductive material seems to screen an object from gravity.",
      [cls_opts[0]],
      "Kết luận từ loạt thí nghiệm của Podkletnov: chiếc đĩa siêu dẫn dường như CHE CHẮN một phần lực hút của Trái Đất tác động lên vật thử. → A.",
      "the disc appeared to be partly shielding the object from the gravitational pull of the Earth",
      cls_opts),
    q(35, "matching", "Weight loss occurs when the equipment rotates at speeds reaching 13,000 rpm.",
      [cls_opts[1]],
      "Con số 13.000 vòng/phút là của nhóm Đại học Tohoku (Nhật Bản), nơi con quay mất 0,01% trọng lượng. Bẫy: đĩa của Podkletnov chỉ quay tới 5.000 vòng/phút. → B.",
      "research suggesting that apparatus, known as a gyroscope, lost 0.01 percent of its weight when spinning at up to 13,000 rpm",
      cls_opts),
    q(36, "true_false_not_given",
      "Podkletnov won a prize for his initial work on superconductive substances.",
      "FALSE",
      "Giải Nobel về vật liệu siêu dẫn nhiệt độ cao thuộc về Karl Muller và Johannes Bednorz - hai người đầu tiên chứng minh hiện tượng này hồi thập niên 1980, KHÔNG phải Podkletnov. → FALSE.",
      "it won a Nobel Prize for the scientists, Karl Muller and Johannes Bednorz, who first demonstrated it in the 1980s"),
    q(37, "true_false_not_given",
      "A chance observation led Podkletnov to experiment with gravity blocking.",
      "TRUE",
      "Năm 1992 Podkletnov TÌNH CỜ thấy khói tẩu thuốc của một đồng nghiệp bay thành cột thẳng đứng phía trên đĩa đang quay; chính quan sát ngẫu nhiên đó khiến ông thiết kế thí nghiệm. → TRUE.",
      "In 1992, while experimenting with rotating superconductors, Podkletnov noticed that pipe-smoke from a nearby researcher was drifting into a vertical column above the spinning disc."),
    q(38, "true_false_not_given", "Einstein challenged earlier experiments on antigravity.",
      "NOT GIVEN",
      "Bài chỉ nói thuyết tương đối rộng của Einstein (1905) coi hấp dẫn là sự uốn cong của không-thời gian nên không thể chắn được, và mọi tuyên bố chắn hấp dẫn đều là thách thức chính Einstein. Bài KHÔNG hề nói Einstein đã phản bác các thí nghiệm phản trọng lực trước đó. → NOT GIVEN."),
    q(39, "true_false_not_given",
      "Modanese suffered professionally after following up Podkletnov's findings.",
      "TRUE",
      "Sau khi công bố các tính toán năm 1995, Modanese sớm nhận ra rằng nghiêm túc với \"phản trọng lực\" là một nước đi HẠN CHẾ SỰ NGHIỆP (career-limiting move). → TRUE.",
      "He published some calculations based on his idea in 1995 - and soon discovered that taking 'antigravity' seriously was a career-limiting move."),
    q(40, "true_false_not_given",
      "An aircraft company announced that it had replicated Podkletnov's results.",
      "FALSE",
      "Boeing (Mỹ) và BAE Systems (Anh) đều được cho là có nghiên cứu, nhưng bài khẳng định KHÔNG một nhóm nào báo cáo xác nhận được kết quả gốc. → FALSE.",
      "Yet not one of the teams has reported confirmation of the original findings."),
]

# ============================ UNITS ============================
units = [
    {"unitType": "reading_passage", "unitNumber": 1,
     "title": "Passage 1 - Ocean Acidification",
     "instructions": "You should spend about 20 minutes on Questions 1-13, which are based on Reading Passage 1 below.",
     "content": P["1"],
     "defaultTimeLimitMinutes": 20,
     "metadata": {
         "groupInstructions": {
             "1": "Answer the questions below.\nChoose NO MORE THAN THREE WORDS AND/OR A NUMBER from the passage for each answer.",
             "8": "Complete the flow chart below.\nWrite NO MORE THAN TWO WORDS from the passage.",
             "13": "Choose the correct letter, A, B, C or D.\nWrite the correct letter in box 13 on your answer sheet.",
         },
         "noteBody": p1_flow,
     },
     "questions": p1},
    {"unitType": "reading_passage", "unitNumber": 2,
     "title": "Passage 2 - A New Fair Trade Organisation",
     "instructions": "You should spend about 20 minutes on Questions 14-26, which are based on Reading Passage 2 below.",
     "content": P["2"],
     "defaultTimeLimitMinutes": 20,
     "metadata": {
         "groupInstructions": {
             "14": "Choose the correct letter, A, B, C or D.\nWrite the correct letter in boxes 14 - 19 on your answer sheet.",
             "20": "Complete the summary below.\nChoose NO MORE THAN TWO WORDS from the passage for each answer.",
         },
         "noteBody": p2_summary,
     },
     "questions": p2},
    {"unitType": "reading_passage", "unitNumber": 3,
     "title": "Passage 3 - The First Antigravity Machine",
     "instructions": "You should spend about 20 minutes on Questions 27-40, which are based on Reading Passage 3 below.",
     "content": P["3"],
     "defaultTimeLimitMinutes": 20,
     "metadata": {
         "groupInstructions": {
             "27": "Label the diagram below.\nChoose NO MORE THAN THREE WORDS OR A NUMBER from the passage.",
             "31": "Classify the following findings as belonging to\n:::box\nA Podkletnov\nB Tohoku University\nC Modanese\n:::\nWrite the correct letter, A, B or C in boxes 31-35 on your answer sheet.",
             "36": "Do the following statements agree with information given in Reading Passage 3?\nIn boxes 36 - 40 on your answer sheet, write\n:::box\nTRUE if the statement agrees with the information\nFALSE if the statement contradicts the information\nNOT GIVEN if there is no information on this\n:::",
         },
         "groupImages": {"27": DIAGRAM},
         "noteBody": p3_diagram,
     },
     "questions": p3},
]

payload = {
    "title": "IELTS Master - Reading Test 47",
    "skill": "reading",
    "sourceLabel": "IELTS Master - Reading Test 47",
    "description": "Đề đọc IELTS Master Test 47: Ocean Acidification / A New Fair Trade Organisation / The First Antigravity Machine.",
    "units": units,
}

# ============================ VALIDATOR ============================
KEY = {
    1: "(small) flaps", 2: "(their/ the) shells", 3: "(about) 1/3 / a third",
    4: "rocks (on land)", 5: "(over) 100,000 years", 6: "fishing and tourism",
    7: "coral(s)", 8: "microbes", 9: "(the) atmosphere", 10: "clouds",
    11: "cooler", 12: "global warming", 13: "C", 14: "C", 15: "D", 16: "C",
    17: "B", 18: "A", 19: "B", 20: "standards/ rule", 21: "distribution",
    22: "suppliers", 23: "pesticides", 24: "plantation owners",
    25: "protected forests", 26: "monitors", 27: "(sensitive) balance",
    28: "5,000 revolutions per minute", 29: "liquid nitrogen", 30: "glass tube",
    31: "B", 32: "A", 33: "C", 34: "A", 35: "B", 36: "false", 37: "true",
    38: "not given", 39: "true", 40: "false",
}

errs = []
orders = []
for u in units:
    md = u["metadata"]
    body = (md.get("noteBody") or "") + (md.get("tableBody") or "")
    blanks = {int(m) for m in re.findall(r"\[\[(\d+)\]\]", body)}
    seen = set()
    for qq in u["questions"]:
        o = qq["order"]
        orders.append(o)
        if o in seen:
            errs.append(f"trung order {o}")
        seen.add(o)
        if not qq.get("explanation"):
            errs.append(f"cau {o}: thieu explanation")
        if qq["questionType"] in ("note_completion",) and o not in blanks:
            errs.append(f"cau {o}: note_completion nhung thieu [[{o}]] trong noteBody")
        if qq["questionType"] in ("multiple_choice", "matching"):
            for a in qq["answer"]:
                if a not in qq.get("options", []):
                    errs.append(f"cau {o}: dap an {a!r} khong nam trong options")
        if qq["questionType"] != "note_completion" and re.match(r"^(\d+[.)]\s|Câu \d+$)", qq["prompt"]):
            errs.append(f"cau {o}: prompt khong duoc kem so thu tu")
        ev = qq.get("evidence")
        if ev:
            for piece in ev.split(" / "):
                if piece not in u["content"]:
                    errs.append(f"cau {o}: evidence khong khop content -> {piece[:60]!r}")
        need_ev = qq["questionType"] in ("multiple_choice", "matching", "true_false_not_given",
                                         "short_answer", "note_completion")
        if need_ev and not ev and "NOT GIVEN" not in qq["answer"]:
            errs.append(f"cau {o}: thieu evidence")
    for b in blanks:
        if b not in seen:
            errs.append(f"[[{b}]] trong noteBody nhung khong co cau tuong ung")

if sorted(orders) != list(range(1, 41)):
    errs.append(f"order khong chay du 1-40: {sorted(orders)}")

if errs:
    print("LOI:")
    for e in errs:
        print(" -", e)
    raise SystemExit(1)

json.dump(payload, open("tmp/ielts_master_reading_test47.json", "w", encoding="utf-8"),
          ensure_ascii=False, indent=1)

# Bang doi chieu "dap an cua toi" vs "bang dap an sach".
allq = {qq["order"]: qq for u in units for qq in u["questions"]}
print(f"{'#':>3} | {'sach':<32} | toi")
for i in range(1, 41):
    mine = " | ".join(allq[i]["answer"])
    print(f"{i:>3} | {KEY[i]:<32} | {mine}")
print("\nOK -> tmp/ielts_master_reading_test47.json (40 cau)")
