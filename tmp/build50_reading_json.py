# -*- coding: utf-8 -*-
"""Dung file JSON import cho IELTS Master - Reading Test 50.

Nguon:
  - de:     E:/ielts_master/reading/Reading (41-50)/50/Test 50.pdf
  - dap an: E:/ielts_master/reading/Reading (41-50)/50/Answer Sheet - 50.docx

Chay truoc:
  python tmp/build50_reading_text.py     -> tmp/_r50_passages.json
"""
import json
import re
import sys

sys.stdout.reconfigure(encoding="utf-8")

P = json.load(open("tmp/_r50_passages.json", encoding="utf-8"))


def q(order, qtype, prompt, answer, explanation, evidence=None, options=None):
    d = {"order": order, "questionType": qtype, "prompt": prompt,
         "answer": answer if isinstance(answer, list) else [answer],
         "explanation": explanation, "points": 1}
    if evidence:
        d["evidence"] = evidence
    if options:
        d["options"] = options
    return d


# ======================= PASSAGE 1 - CORAL REEFS OF AGATTI =======================
headings = [
    "i Island legends",
    "ii Resources for exchange",
    "iii Competition for fishing rights",
    "iv The low cost of equipment",
    "v Agatti's favourable location",
    "vi Rising income levels",
    "vii The social nature of reef occupations",
    "viii Resources for islanders' own use",
    "ix High levels of expertise",
    "x Alternative sources of employment",
    "xi Resources for earning money",
    "xii Social rights and obligations",
]
H = {re.match(r"^([ivx]+) ", h).group(1): h for h in headings}

p1 = [
    q(1, "matching", "Paragraph A", [H["v"]],
      "Đoạn A giới thiệu VỊ TRÍ của Agatti: đảo nằm ngoài khơi Ấn Độ, được bao quanh bởi phá và rạn san hô, nên có tiềm năng mang lại đủ loại lợi ích cho cư dân. → v Agatti's favourable location.",
      "These islands are surrounded by lagoons and coral reefs which are in turn surrounded by the open ocean. / therefore have the potential to provide a stream of diverse benefits to the inhabitants of Agatti Island.",
      headings),
    q(2, "matching", "Paragraph B", [H["viii"]],
      "Đoạn B nói rạn san hô cung cấp thức ăn và sản phẩm để CHÍNH NGƯỜI DÂN ĐẢO TỰ DÙNG: cá, bạch tuộc, nhuyễn thể, cả vỏ ốc làm thuốc chữa bệnh mắt. → viii Resources for islanders' own use.",
      "In the first place, the reefs provide food and other products for consumption by the islanders themselves.",
      headings),
    q(3, "matching", "Paragraph C", [H["xi"]],
      "Đoạn C nói rạn san hô giúp TẠO THU NHẬP: 20% hộ gia đình sống chủ yếu bằng nghề đánh bắt, nhiều hộ nghèo phụ thuộc hoàn toàn vào rạn. Bẫy: \"vi Rising income levels\" - bài chỉ nói thu nhập ĐẾN TỪ rạn san hô, không nói thu nhập đang TĂNG. → xi Resources for earning money.",
      "In addition, the reef contributes to income generation.",
      headings),
    q(4, "matching", "Paragraph D", [H["ii"]],
      "Đoạn D nói về việc ĐỔI CHÁC sản vật rạn san hô giữa người trong đảo và giữa các đảo - vd đổi bạch tuộc lấy hàng từ đảo Androth, hay lấy gạo, dừa, cá. → ii Resources for exchange.",
      "Bartering of reef resources also commonly takes place, both between islanders and between islands.",
      headings),
    q(5, "matching", "Paragraph E", [H["iv"]],
      "Đoạn E nói khai thác rạn san hô cần VỐN RẤT ÍT: dụng cụ đơn giản, có sẵn ở địa phương, lưới quăng rẻ, thuyền tự đóng và chi phí vận hành thấp. → iv The low cost of equipment.",
      "The investment required to exploit the reefs is minimal. It involves simple, locally available tools and equipment",
      headings),
    q(6, "matching", "Paragraph F", [H["ix"]],
      "Đoạn F nói qua hơn 400 năm, người dân đảo có HIỂU BIẾT SÂU SẮC về rạn san hô: biết từng loại cá ở đâu theo con nước, có hệ thống tên gọi riêng, và rất nhiều kỹ thuật đánh bắt. → ix High levels of expertise.",
      "During more than 400 years of occupation and survival, the Agatti islanders have developed an intimate knowledge of the reefs.",
      headings),
    q(7, "matching", "Paragraph G", [H["i"]],
      "Đoạn G nói về văn hoá dân gian: gần như mọi câu chuyện, bài hát đều nhắc tới biển và rạn san hô, có cả truyền thuyết về con ma biển hiền lành baluvam. → i Island legends.",
      "Most of the island's folklore revolves around the reef and sea.",
      headings),
    q(8, "matching", "Paragraph H", [H["xii"]],
      "Đoạn H nói rạn san hô là TÀI SẢN CHUNG, ai cũng có QUYỀN dùng, nhưng vẫn phải giữ một bộ quy tắc ứng xử - tức vừa có quyền vừa có nghĩa vụ. Bẫy: \"iii Competition for fishing rights\" - bài nói việc tôn trọng quy tắc giúp TRÁNH tranh chấp, không nói có cạnh tranh. → xii Social rights and obligations.",
      "The reef is regarded by the islanders as common property, and all the islanders are entitled to use the lagoon and reef resources. / there is still a code of conduct or etiquette for exploiting the reef",
      headings),
    q(9, "matching", "Paragraph I", [H["vii"]],
      "Đoạn I nói việc khai thác rạn san hô cần LÀM CHUNG theo nhóm: kỹ thuật Bala fadal cần 25-30 người đàn ông, phụ nữ đi nhặt vỏ ốc theo nhóm 6-10 người. → vii The social nature of reef occupations.",
      "Exploitation of such vast and diverse resources as the reefs and lagoon surrounding the island has encouraged collaborative efforts",
      headings),
    q(10, "multiple_choice",
      "What proportion of poor households get all their income from reef products?",
      "A 12%",
      "\"Get ALL their income\" = \"completely dependent\": 12% hộ nghèo phụ thuộc HOÀN TOÀN vào rạn san hô. Bẫy: 20% là tỉ lệ hộ gia đình NÓI CHUNG coi nghề đánh bắt là nghề chính; 59% và 29% là các hộ nghèo chỉ dựa vào rạn cho 70% hoặc 50% thu nhập. → A.",
      "12% of poor households are completely dependent on the reef for their household income",
      ["A 12%", "B 20%", "C 29%", "D 59%"]),
    q(11, "multiple_choice", "Kat moodsal fishing",
      "C requires little investment.",
      "Đoạn E mở đầu bằng câu vốn đầu tư để khai thác rạn san hô là RẤT ÍT, rồi lấy Kat moodsal làm ví dụ: chỉ cần một cái lưới quăng nhỏ, một túi lá và đôi dép nhựa. Bẫy: A sai vì hoạt động diễn ra QUANH NĂM; B sai vì cá bắt được để nhà ăn; D sai vì hình thức này làm được mà KHÔNG CẦN thuyền. → C.",
      "The investment required to exploit the reefs is minimal. / A small cast net, a leaf bag, and plastic slippers are all that are required, and the activity can yield 10-12 small fish (approximately 1 kg) for household consumption.",
      ["A is a seasonal activity.", "B is a commercial activity.",
       "C requires little investment.", "D requires use of a rowing boat."]),
    q(12, "multiple_choice",
      "Which characteristic of present-day islanders do the writers describe?",
      "B fishing expertise",
      "Đoạn F nói người dân đảo có hiểu biết sâu sắc về rạn san hô và phát triển đủ loại kỹ năng, kỹ thuật đánh bắt - và rất nhiều kỹ thuật trong đó VẪN ĐANG được dùng. Các ý sức khoẻ, lòng dũng cảm, trí tưởng tượng không được bài mô tả là đặc điểm của người dân ngày nay. → B.",
      "the islanders have developed a wide range of skills and techniques for exploiting them. A multitude of different fishing techniques are still used by the islanders",
      ["A physical strength", "B fishing expertise", "C courage", "D imagination"]),
    q(13, "multiple_choice",
      "What do the writers say about the system for using the reef on Agatti?",
      "D There is open access.",
      "Rạn san hô là tài sản chung, MỌI người dân đảo đều có quyền dùng → ai cũng được vào khai thác. Bẫy: B - việc xin phép trưởng đảo (Amin) là chuyện NGÀY XƯA và nay không còn; A - phần cá chia cho Amin là con ngon nhất, không phải chia đều; C - bài nói quy tắc chung giúp TRÁNH tranh chấp. → D.",
      "The reef is regarded by the islanders as common property, and all the islanders are entitled to use the lagoon and reef resources.",
      ["A Fish catches are shared equally.", "B The reef owner issues permits.",
       "C There are frequent disputes.", "D There is open access."]),
]

# ======================= PASSAGE 2 - URBAN PLANNING IN SINGAPORE =======================
p2_summary = """When Singapore became an independent, self-sufficient state it decided to build up its [[14]], and government organisations were created to support this policy. However, this initial plan met with limited success due to a shortage of [[15]] and land. It was therefore decided to develop the [[16]] sector of the economy instead.

Singapore is now a leading city, but planners are working to ensure that its economy continues to grow. In contrast to previous policies, there is emphasis on [[17]]. In addition, land will be recovered to extend the financial district, and provide [[18]] as well as housing. The government also plans to improve the quality of Singapore's environment, but due to the shortage of natural landscapes it will concentrate instead on what it calls [[19]]."""

p2 = [
    q(14, "note_completion", "Câu 14", ["industry"],
      "Sau khi độc lập năm 1965, Singapore quyết định muốn đảm bảo tương lai kinh tế thì phải phát triển CÔNG NGHIỆP, và lập ra các cơ quan như EDB để thu hút đầu tư. → Industry.",
      "but it was decided that if Singapore was to secure its economic future, it must develop its industry."),
    q(15, "note_completion", "Câu 15", ["labour", "labor"],
      "Kế hoạch ban đầu gặp khó vì cả lực lượng LAO ĐỘNG lẫn diện tích đất đều có hạn (\"workforce\" = labour). → Labour.",
      "due to limits on both the size of the country's workforce and its land area, its labour-intensive industries were becoming increasingly uncompetitive."),
    q(16, "note_completion", "Câu 16", ["service"],
      "Uỷ ban kinh tế kết luận Singapore nên chuyển sang làm trung tâm DỊCH VỤ: trụ sở công ty, du lịch, ngân hàng. Bẫy: \"Tourism\" chỉ là MỘT mảng trong khu vực dịch vụ, và chỗ trống đứng trước chữ \"sector\" (service sector). → Service.",
      "So an economic committee was established which concluded that Singapore should focus on developing as a service centre"),
    q(17, "note_completion", "Câu 17", ["decentralization", "decentralisation"],
      "Khác với các kế hoạch trước, kế hoạch mới nhất có chính sách PHI TẬP TRUNG mạnh mẽ để tránh ùn tắc ở khu trung tâm - lập bốn trung tâm vùng. → Decentralization.",
      "the latest plan deviates from previous plans by having a strong decentralisation policy."),
    q(18, "note_completion", "Câu 18", ["entertainment"],
      "Khu mở rộng quanh vịnh Marina (đất lấn biển) áp dụng cách phân vùng hỗn hợp, gồm cả nhà ở lẫn GIẢI TRÍ. → Entertainment.",
      "However the need for vitality has been recognised and a mixed zoning approach has been adopted, to include housing and entertainment."),
    q(19, "note_completion", "Câu 19", ["beautification"],
      "Vì cảnh quan tự nhiên gần như không còn, chính sách môi trường tập trung vào việc phủ xanh khu đô thị bằng cây cối - được gọi là \"LÀM ĐẸP\" Singapore. → Beautification.",
      "Environmental policy is therefore very much concerned with making the built environment more green by introducing more plants - what is referred to as the 'beautification' of Singapore."),
    q(20, "true_false_not_given",
      "After 1965, the Singaporean government switched the focus of the island's economy.",
      "TRUE",
      "Trước đó hơn một thế kỷ, THƯƠNG MẠI giữ vai trò chủ đạo; từ năm 1965 Singapore chuyển sang phát triển CÔNG NGHIỆP (và sau này là dịch vụ). → TRUE.",
      "for more than a century trading interests dominated. However, in 1965 the newly independent island state was cut off from its hinterland, and so it set about pursuing a survival strategy. / it must develop its industry."),
    q(21, "true_false_not_given",
      "The creation of Singapore's financial centre was delayed while a suitable site was found.",
      "FALSE",
      "Ngược lại: đất cho khu dịch vụ đã được thu xếp TỪ SỚM - đầu thập niên 1970 - khi chính phủ nhận ra còn thiếu hạ tầng ngân hàng, rồi quy hoạch khu \"Golden Shoe\". Không hề có chuyện trì hoãn vì phải tìm địa điểm. → FALSE.",
      "The land required for this service-sector orientation had been acquired in the early 1970s, when the government realised that it lacked the banking infrastructure for a modern economy."),
    q(22, "true_false_not_given",
      "Singapore's four regional centres will eventually be the same size as its central business district.",
      "NOT GIVEN",
      "Bài chỉ nói mỗi trung tâm vùng phục vụ 800.000 dân và khu thương mại trung tâm hiện có VẪN sẽ tiếp tục phát triển. Không có thông tin nào so sánh quy mô cuối cùng của hai bên. → NOT GIVEN."),
    q(23, "true_false_not_given",
      "Planners have modelled new urban developments on other coastal cities.",
      "TRUE",
      "Khu mở rộng quanh vịnh Marina lấy ví dụ từ các \"thành phố thế giới\" khác, nhất là những nơi có khu trung tâm VEN BIỂN như Sydney và San Francisco. → TRUE.",
      "A major extension planned around Marina Bay draws on examples of other 'world cities', especially those with waterside central areas such as Sydney and San Francisco."),
    q(24, "true_false_not_given",
      "Plants and trees are amongst the current priorities for Singapore's city planners.",
      "TRUE",
      "Chính sách môi trường hiện nay rất chú trọng việc phủ xanh khu đô thị bằng cách TRỒNG THÊM CÂY, cùng các dải xanh dọc ranh giới khu dân cư và hành lang giao thông. → TRUE.",
      "Environmental policy is therefore very much concerned with making the built environment more green by introducing more plants"),
    q(25, "true_false_not_given",
      "The government has enacted new laws to protect Singapore's old buildings.",
      "NOT GIVEN",
      "Bài chỉ nói người ta nhận ra (hơi muộn) giá trị của việc GIỮ LẠI các toà nhà cũ ven sông Singapore. Không nhắc tới việc ban hành luật nào để bảo vệ chúng. Bẫy: năm 1996 có NỚI LỎNG quy định về chỗ ăn uống ngoài trời - không liên quan tới nhà cũ. → NOT GIVEN."),
    q(26, "true_false_not_given",
      "Singapore will find it difficult to compete with leading cities in other parts of the world.",
      "FALSE",
      "Kết bài khẳng định Singapore có VỊ THẾ TỐT để thành công, rồi liệt kê hàng loạt lý do: gốc gác trung tâm thương mại, đầu tư mạnh vào viễn thông và hàng không, vị trí gần các nền kinh tế châu Á, môi trường an toàn sạch sẽ, dùng tiếng Anh. → FALSE.",
      "It is well placed to succeed, for a variety of reasons."),
]

# ======================= PASSAGE 3 - SPICES =======================
LETTERS = list("ABCDEFGHI")

p3 = [
    q(27, "matching", "an example of a food which particularly benefits from the addition of spices", "D",
      "Đoạn D lấy XÚC XÍCH làm ví dụ: đây là môi trường vi khuẩn sinh sôi mạnh, từng gây chết người vì độc tố botulism, nên giá trị kháng khuẩn của gia vị khi làm xúc xích là quá rõ. → D.",
      "Sausages are a rich medium for bacterial growth, and have frequently been implicated as the source of death from the botulism toxin, so the value of the anti-bacterial compounds in spices used for sausage preparation is obvious.",
      LETTERS),
    q(28, "matching", "a range of methods for making food safer to eat", "I",
      "Đoạn I liệt kê NHIỀU CÁCH bảo quản thịt: nấu chín kỹ, ướp muối, hun khói, phơi khô và tẩm gia vị - tất cả đều nhằm hạn chế sinh vật gây hại trong thức ăn. → I.",
      "In areas where fresh meat is not consistently available, preservation may be accomplished by thoroughly cooking, salting, smoking, drying, and spicing meats.",
      LETTERS),
    q(29, "matching", "a comparison between countries with different climate types", "F",
      "Đoạn F SO SÁNH nước nóng với nước mát hơn: ở nước nóng gần như món thịt nào cũng có gia vị, còn ở nước mát hơn nhiều món nấu không có hoặc rất ít gia vị. Bẫy: đoạn E chỉ nói nhiệt độ làm vi khuẩn tăng nhanh, chưa so sánh các nước. → F.",
      "we found that countries with higher than average temperatures used more spices. Indeed, in hot countries nearly every meat-based recipe calls for at least one spice, and most include many spices, whereas in cooler ones, substantial proportions of dishes are prepared without spices, or with just a few.",
      LETTERS),
    q(30, "matching", "an explanation of how people first learned to select appropriate spices", "G",
      "Đoạn G đặt câu hỏi tổ tiên ta làm sao BIẾT dùng loại gia vị nào, rồi giải thích: người tình cờ cho gia vị vào thịt thì ít bị ngộ độc hơn, người khác quan sát và bắt chước theo. → G.",
      "But if the main function of spices is to make food safer to eat, how did our ancestors know which ones to use in the first place?",
      LETTERS),
    q(31, "matching", "a method of enhancing the effectiveness of individual spices", "D",
      "Đoạn D nói khi KẾT HỢP nhiều gia vị với nhau, khả năng kháng khuẩn còn mạnh hơn khi dùng từng loại riêng lẻ - đó là cách tăng hiệu quả của từng gia vị. Lưu ý: đề cho phép dùng lại một chữ cái, câu 27 cũng là D. → D.",
      "Studies also show that when combined, spices exhibit even greater anti-bacterial properties than when each is used alone.",
      LETTERS),
    q(32, "matching", "the relative effectiveness of certain spices against harmful organisms", "C",
      "Đoạn C so sánh MỨC ĐỘ hiệu quả giữa các gia vị: một nửa ức chế hơn 75% vi khuẩn, còn bốn loại (tỏi, hành, tiêu Jamaica, kinh giới) ức chế 100%. → C.",
      "half inhibit more than 75% of bacteria, and four (garlic, onion, allspice and oregano) inhibit 100% of those bacteria tested.",
      LETTERS),
    q(33, "matching", "the possible origins of a dislike for unspiced foods", "H",
      "Đoạn H giải thích vì sao người ta SỢ món không gia vị: ai ăn phải món gây bệnh thì về sau tránh vị đó, và cảm giác ghê sợ này thường gắn với món KHÔNG gia vị (tức kém an toàn). → H.",
      "By this process, food aversions would more often be associated with unspiced (and therefore unsafe) foods",
      LETTERS),
    q(34, "short_answer",
      "According to the writers, what might be the use of spices in cooking help people to avoid?",
      ["food poisoning"],
      "Giả thuyết đầu tiên của tác giả: nếu gia vị diệt được vi khuẩn, nấm hoặc ngăn chúng tạo độc tố thì dùng gia vị sẽ giảm nguy cơ bị NGỘ ĐỘC THỰC PHẨM. → food poisoning.",
      "So if spices kill these organisms, or inhibit their production of toxins, spice use in food might reduce our own chances of contracting food poisoning."),
    q(35, "short_answer",
      "What proportion of bacteria in food do four of the spices tested destroy?",
      ["100%", "100 %", "100 percent", "100 per cent", "one hundred percent", "one hundred per cent"],
      "Bốn loại gia vị - tỏi, hành, tiêu Jamaica và kinh giới - ức chế 100% số vi khuẩn được thử. Bẫy: 75% là mức của MỘT NỬA số gia vị, không phải bốn loại này. → 100%.",
      "four (garlic, onion, allspice and oregano) inhibit 100% of those bacteria tested."),
    q(36, "short_answer",
      "Which food often contains a spice known as 'quatre epices'?",
      ["sausages", "sausage"],
      "Hỗn hợp gia vị Pháp 'quatre epices' (tiêu, đinh hương, gừng, nhục đậu khấu) thường được dùng để làm XÚC XÍCH. → sausages.",
      "One intriguing example is the French 'quatre epices' (pepper, cloves, ginger and nutmeg) which is often used in making sausages."),
    q(37, "short_answer",
      "Which types of country use the fewest number of spices in cooking?",
      ["cooler ones", "cooler countries", "cooler", "the cooler ones"],
      "Ở các nước MÁT HƠN, phần lớn món ăn được nấu không có gia vị hoặc chỉ dùng rất ít - trái ngược với các nước nóng. → cooler ones.",
      "whereas in cooler ones, substantial proportions of dishes are prepared without spices, or with just a few."),
    q(38, "short_answer",
      "What might food aversions often be associated with?",
      ["unspiced foods", "unspiced food", "unspiced"],
      "Theo đoạn H, cảm giác ghê sợ một món ăn thường gắn với những món KHÔNG CÓ GIA VỊ (và vì thế kém an toàn). → unspiced foods.",
      "By this process, food aversions would more often be associated with unspiced (and therefore unsafe) foods"),
    q(39, "short_answer",
      "Apart from spices, which substance is used in all countries to preserve food?",
      ["salt"],
      "\"Used in all countries\" = \"used worldwide\": MUỐI đã được dùng khắp thế giới hàng thế kỷ để bảo quản thức ăn. → salt.",
      "Indeed, salt has been used worldwide for centuries to preserve food."),
    q(40, "multiple_choice", "Which is the best title for Reading Passage 3?",
      "A The function of spices in food preparation",
      "Cả bài xoay quanh VAI TRÒ của gia vị khi chế biến thức ăn: diệt vi khuẩn, giúp món ăn an toàn, dùng nhiều ở nước nóng, và vì sao con người thích món có gia vị. Bẫy: B - bảo quản thức ăn chỉ là một phần (đoạn I); C - bài có khảo sát công thức nấu ăn nhưng không giới thiệu công thức nào; D - bài không phân tích hoá học của cây gia vị. → A.",
      None,
      ["A The function of spices in food preparation",
       "B A history of food preservation techniques",
       "C Traditional recipes from around the world",
       "D An analysis of the chemical properties of spice plants"]),
]

# ============================ UNITS ============================
units = [
    {"unitType": "reading_passage", "unitNumber": 1,
     "title": "Passage 1 - The coral reefs of Agatti Island",
     "instructions": "You should spend about 20 minutes on Questions 1-13, which are based on Reading Passage 1 below.",
     "content": P["1"],
     "defaultTimeLimitMinutes": 20,
     "metadata": {
         "groupInstructions": {
             "1": "Reading Passage 1 has nine paragraphs A-I.\n"
                  "Choose the correct heading for each paragraph from the list of headings below.\n"
                  "Write the correct number i-xii in boxes 1-9 on your answer sheet.\n"
                  "\nList of Headings\n"
                  ":::box\n" + "\n".join(headings) + "\n:::",
             "10": "Choose the correct letter, A, B, C or D.\n"
                   "Write the correct letter in boxes 10-13 on your answer sheet.",
         },
     },
     "questions": p1},
    {"unitType": "reading_passage", "unitNumber": 2,
     "title": "Passage 2 - Urban planning in Singapore",
     "instructions": "You should spend about 20 minutes on Questions 14-26, which are based on Reading Passage 2 below.",
     "content": P["2"],
     "defaultTimeLimitMinutes": 20,
     "metadata": {
         "groupInstructions": {
             "14": "Complete the summary below using words from the box.\n"
                   "Write your answers in boxes 14-19 on your answer sheet.\n"
                   ":::box\n"
                   "Decentralization | Agriculture | Tourism | Hygiene\n"
                   "Hospitals | Fuel | Industry | Service\n"
                   "Trade | Loans | Deregulation | Recycling\n"
                   "Labour | Transport | Entertainment | Beautification\n"
                   ":::",
             "20": "Do the following statements agree with the information given in Reading Passage 2?\n"
                   "In boxes 20-26 on your answer sheet, write\n"
                   ":::box\n"
                   "TRUE if the statement is true according to the passage\n"
                   "FALSE if the statement is false according to the passage\n"
                   "NOT GIVEN if the information is not given in the passage\n"
                   ":::",
         },
         "groupTitles": {"14": "Singapore"},
         "noteBody": p2_summary,
     },
     "questions": p2},
    {"unitType": "reading_passage", "unitNumber": 3,
     "title": "Passage 3 - Spices",
     "instructions": "You should spend about 20 minutes on Questions 27-40, which are based on Reading Passage 3 below.",
     "content": P["3"],
     "defaultTimeLimitMinutes": 20,
     "metadata": {
         "groupInstructions": {
             "27": "Reading Passage 3 has nine paragraphs, labelled A-I.\n"
                   "Which paragraph contains the following information?\n"
                   "Write the correct letter A-I in boxes 27-33 on your answer sheet.\n"
                   "NB You may use any letter more than once.",
             "34": "Answer the questions below with words taken from Reading Passage 3.\n"
                   "Use NO MORE THAN TWO WORDS for each answer.\n"
                   "Write your answers in boxes 34-39 on your answer sheet.",
             "40": "Choose the correct letter, A, B, C or D.\n"
                   "Write the correct letter in box 40 on your answer sheet.",
         },
     },
     "questions": p3},
]

payload = {
    "title": "IELTS Master - Reading Test 50",
    "skill": "reading",
    "sourceLabel": "IELTS Master - Reading Test 50",
    "category": "book",
    "bookName": "IELTS Master – Reading",
    "description": "Đề đọc IELTS Master Test 50: The coral reefs of Agatti Island / Urban planning in Singapore / Spices.",
    "units": units,
}

# ============================ VALIDATOR ============================
KEY = {
    1: "v", 2: "viii", 3: "xi", 4: "ii", 5: "iv", 6: "ix", 7: "i", 8: "xii", 9: "vii",
    10: "A", 11: "C", 12: "B", 13: "D",
    14: "industry", 15: "labour", 16: "service", 17: "decentralization",
    18: "entertainment", 19: "beautification",
    20: "true", 21: "false", 22: "not given", 23: "true", 24: "true", 25: "not given", 26: "false",
    27: "D", 28: "I", 29: "F", 30: "G", 31: "D", 32: "C", 33: "H",
    34: "food poisoning", 35: "100%", 36: "sausages", 37: "cooler ones",
    38: "unspiced foods", 39: "salt", 40: "A",
}


def first_token(a):
    return a.split()[0] if " " in a and re.match(r"^([ivx]+|[A-I]) ", a) else a


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
        if qq["questionType"] == "note_completion" and o not in blanks:
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
        if not ev and "NOT GIVEN" not in qq["answer"] and o != 40:
            errs.append(f"cau {o}: thieu evidence")
        # dap an cua minh phai khop bang dap an sach
        mine = [first_token(a).lower() for a in qq["answer"]]
        if KEY[o].lower() not in mine:
            errs.append(f"cau {o}: dap an {qq['answer']} lech key {KEY[o]!r}")
    for b in blanks:
        if b not in seen:
            errs.append(f"[[{b}]] trong noteBody nhung khong co cau tuong ung")

if sorted(orders) != list(range(1, 41)):
    errs.append(f"order khong chay du 1-40: {sorted(orders)}")

# Cau 14-19: dap an phai nam trong hop tu
box_words = {w.strip().lower() for line in units[1]["metadata"]["groupInstructions"]["14"].split("\n")
             if "|" in line for w in line.split("|")}
for qq in p2[:6]:
    if qq["answer"][0].lower() not in box_words:
        errs.append(f"cau {qq['order']}: {qq['answer'][0]!r} khong co trong hop tu")

# Short answer: toi da 2 tu (tru bien the them "the")
for qq in p3:
    if qq["questionType"] == "short_answer" and len(qq["answer"][0].split()) > 2:
        errs.append(f"cau {qq['order']}: dap an chinh qua 2 tu")

if errs:
    print("LOI:")
    for e in errs:
        print(" -", e)
    raise SystemExit(1)

json.dump(payload, open("tmp/ielts_master_reading_test50.json", "w", encoding="utf-8"),
          ensure_ascii=False, indent=1)

allq = {qq["order"]: qq for u in units for qq in u["questions"]}
print(f"{'#':>3} | {'sach':<18} | toi")
for i in range(1, 41):
    print(f"{i:>3} | {KEY[i]:<18} | {' | '.join(allq[i]['answer'])}")
print("\nOK -> tmp/ielts_master_reading_test50.json (40 cau)")
