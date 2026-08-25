# -*- coding: utf-8 -*-
"""Dung file JSON import cho IELTS Master - Reading Test 48.

Nguon:
  - de:     E:/ielts_master/reading/Reading (41-50)/48/Test 48.pdf
  - dap an: E:/ielts_master/reading/Reading (41-50)/48/Answer Sheet - 48.docx

Chay `python tmp/build48_reading_text.py` truoc de co tmp/_r48_passages.json.
"""
import json
import re
import sys

sys.stdout.reconfigure(encoding="utf-8")

P = json.load(open("tmp/_r48_passages.json", encoding="utf-8"))


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
animal_opts = [
    "A if the statement refers to cheetahs at the Breeding Centre.",
    "B if the statement refers to leopards at the Breeding Centre.",
    "C if the statement refers to both cheetahs and leopards at the Breeding Centre.",
    "D If the statement refers to neither cheetahs nor leopards at the Breeding Centre.",
]

p1_summary = """# SUMMARY
The Sharjah Breeding Centre now has a variety of animals including birds, mammals and [[9]]. As its name suggests, the Centre is primarily involved in breeding and [[10]] the numbers of the species housed there whilst still maintaining the [[11]] of bloodlines in order to retain genetic health. In spite of problems involving the complex [[12]] of the animals, a fair amount of [[13]] has been achieved with North African cheetahs and Arabian leopards."""

p1 = [
    q(1, "matching", "These animals were smuggled into the UAE.", [animal_opts[0]],
      "Chỉ báo về BÁO GÊPA (cheetah): cả 25 con đều bị nhập lậu vào UAE rồi bị chặn lại ở cảng và sân bay. Bẫy: hai con báo hoa mai (leopard) đầu tiên đến hợp pháp - một con đực từ Yemen và một con cái cho mượn để nhân giống từ Oman. → A.",
      "The 25 cheetahs were all imported illegally into the UAE and were intercepted at the UAE harbour and airport entry points.",
      animal_opts),
    q(2, "matching", "At first these animals did not adapt to life at the Sharjah Breeding Centre",
      [animal_opts[3]],
      "KHÔNG loài nào cả. Báo gêpa đến trong tình trạng suy dinh dưỡng, mất nước và căng thẳng, nhưng đó là hậu quả của CHUYẾN VẬN CHUYỂN chứ không phải vì không thích nghi được với trung tâm - và ngay sau đó bài viết nói chúng đã khoẻ mạnh, tràn đầy sức sống. Báo hoa mai thì phản ứng tích cực với người chăm. → D.",
      "They nearly all arrived malnourished, dehydrated and highly stressed after long voyages stuffed into boxes, crates and suitcases. Now they are bright and full of energy.",
      animal_opts),
    q(3, "matching", "These animals are regarded as the most important animal at the Centre.",
      [animal_opts[1]],
      "Báo hoa mai Ả Rập giữ vai trò LOÀI BIỂU TƯỢNG (flagship species) của trung tâm - chính sự xuất hiện của hai cá thể này đã dẫn tới việc xây dựng trung tâm. → B.",
      "The arrival of these two animals led to the construction of the Breeding Centre in which the leopard has played the role of flagship species.",
      animal_opts),
    q(4, "matching", "Half of these animals were born at the Breeding centre.", [animal_opts[3]],
      "KHÔNG loài nào đúng. Trung tâm có 12 con báo hoa mai, 8 con sinh tại đây - tức HAI PHẦN BA chứ không phải một nửa. Bài không cho số liệu tương ứng với báo gêpa. → D.",
      "Today there are twelve leopards at the Breeding centre, eight of which have been born at the centre since the first cub in 1998.",
      animal_opts),
    q(5, "matching", "These animals can be dangerous to one another.", [animal_opts[1]],
      "Báo hoa mai đực từng giết bạn tình khi được ghép đôi, còn báo cái từng giết con non nếu hang bị quấy nhiễu. Bẫy: với báo gêpa, con cái chỉ \"e dè\" con đực chứ không nguy hiểm chết người. → B.",
      "Male leopards are known to have killed their partners on introduction, so it is essential for the keeper to understand the leopards' behaviour to decide when it is safe to do so. / Leopard females have been known to kill their cubs if the dens have been disturbed",
      animal_opts),
    q(6, "matching",
      "The role of the keeper is vital in the breeding programme of these animals.",
      [animal_opts[2]],
      "CẢ HAI loài. Với báo gêpa, người chăm phải theo dõi từng cá thể để chọn đúng thời điểm ghép đôi; với báo hoa mai, bài viết nói thẳng bí quyết thành công của trung tâm là mối quan hệ gần gũi giữa vật và người chăm. → C.",
      "It is the responsibility of the keeper therefore to monitor each individual and to be able to respond to any indication from the cheetahs that the time is right for introducing a pair. / Once more, the secret to the centre's success is the close relationship between animal and keeper.",
      animal_opts),
    q(7, "matching", "The first of these animals at the Breeding Centre were relatively young.",
      [animal_opts[0]],
      "Nhóm báo gêpa còn NON và thiếu kinh nghiệm trong chuyện ghép đôi. Bẫy: chương trình báo hoa mai lại khởi đầu bằng hai cá thể ĐÃ TRƯỞNG THÀNH (two mature specimens). → A.",
      "Because this group was still young and inexperienced in courtship matters, the keepers had to make the introductions only after careful planning and management",
      animal_opts),
    q(8, "matching", "It is normally difficult for humans to approach these animals.",
      [animal_opts[1]],
      "Báo hoa mai vốn NHÚT NHÁT và kín đáo khi có người, dù ở trung tâm này chúng lại chịu để người chăm gãi tai. Bài không nói báo gêpa khó tiếp cận. → B.",
      "The leopard is usually shy and secretive with people around, but here they react positively to the presence of their keepers",
      animal_opts),
    q(9, "note_completion", "Câu 9", ["reptiles", "reptile"],
      "Ngoài chim và thú, trung tâm còn tiếp nhận BÒ SÁT: \"hơn 900 mammals and reptiles và 969 birds\". Trong hộp từ chỉ có \"Reptiles\" hợp nghĩa (\"Fish\" không được nhắc tới).",
      "In the last four years, more than 900 mammals and reptiles and 969 birds have arrived at the centre"),
    q(10, "note_completion", "Câu 10", ["expanding", "expand"],
      "Chương trình nhân giống nhằm duy trì VÀ MỞ RỘNG nguồn gen - danh động từ đi sau \"breeding and ...\" nên chọn \"Expanding\". Bẫy: \"Creating\" sai vì đàn đã có sẵn, chỉ tăng số lượng thêm.",
      "which aims to ensure that the genetic diversity of this endangered species is maintained and expanded by breeding as many founder animals as possible"),
    q(11, "note_completion", "Câu 11", ["diversity"],
      "Cụm \"genetic diversity\" trong bài chính là SỰ ĐA DẠNG của các dòng máu cần được giữ lại. Bẫy: \"Variety\" cũng nghĩa là đa dạng nhưng bài dùng đúng chữ \"diversity\", và \"variety\" đã xuất hiện ở đầu bài tóm tắt với nghĩa khác.",
      "which aims to ensure that the genetic diversity of this endangered species is maintained and expanded by breeding as many founder animals as possible"),
    q(12, "note_completion", "Câu 12", ["behavior", "behaviour"],
      "Khó khăn nằm ở TẬP TÍNH phức tạp của các con vật: người chăm phải hiểu tập tính của báo hoa mai mới biết lúc nào ghép đôi là an toàn. Hộp từ ghi theo lối Mỹ \"Behavior\", bài đọc viết \"behaviour\" - hệ thống chấp nhận cả hai.",
      "so it is essential for the keeper to understand the leopards' behaviour to decide when it is safe to do so"),
    q(13, "note_completion", "Câu 13", ["success"],
      "Dù khó khăn, trung tâm vẫn đạt được KHÁ NHIỀU THÀNH CÔNG với báo gêpa Bắc Phi và báo hoa mai Ả Rập - bài viết dùng đúng chữ \"success\".",
      "Once more, the secret to the centre's success is the close relationship between animal and keeper."),
]

# ============================ PASSAGE 2 ============================
headings = [
    "i The Role of Sleep",
    "ii Insomnia Medication",
    "iii Habits to Promote a Good Night's Sleep",
    "iv What is Insomnia",
    "v Complications for Insomniacs",
    "vi Government Action",
    "vii Available Treatment for Insomnia",
    "viii The Causes of Insomnia",
    "ix Therapy Solutions",
    "x Types of Insomnia",
    "xi Current Research",
]
H = {re.match(r"^([ivx]+) ", h).group(1): h for h in headings}

p2 = [
    q(14, "matching", "Paragraph B", [H["viii"]],
      "Cả đoạn B liệt kê NGUYÊN NHÂN gây mất ngủ: tuổi trên 60, tiền sử trầm cảm, phụ nữ sau mãn kinh, sang chấn tâm lý, căng thẳng, lệch múi giờ, rượu và ma tuý. → viii.",
      "Stress, anxiety, illness and other sleep disorders such as restless legs syndrome are the most common causes of insomnia.",
      headings),
    q(15, "matching", "Paragraph C", [H["i"]],
      "Đoạn C bàn về BẢN THÂN GIẤC NGỦ: cơ chế gây ngủ, hormone melatonin, vì sao ngủ lại cần cho sức khoẻ, hai trạng thái REM và non-REM. Bẫy: \"xi Current Research\" sai vì đoạn không nói tới nghiên cứu đang tiến hành. → i.",
      "Exactly why sleep is necessary for good health and efficient mental functioning is unknown.",
      headings),
    q(16, "matching", "Paragraph D", [H["x"]],
      "Đoạn D phân LOẠI mất ngủ: Primary Insomnia và Secondary Insomnia. → x.",
      "The two main types of insomnia have been described as Primary Insomnia and Secondary Insomnia.",
      headings),
    q(17, "matching", "Paragraph E", [H["vii"]],
      "Đoạn E nói các CÁCH ĐIỀU TRỊ: cải thiện vệ sinh giấc ngủ, thư giãn trước khi ngủ, đổi giờ giấc, và trên hết là xử lý nguyên nhân gốc. Bẫy: \"ix Therapy Solutions\" hẹp hơn - đoạn không chỉ nói về trị liệu, và \"ii Insomnia Medication\" sai vì không hề nhắc tới thuốc. → vii.",
      "Improving one's sleep hygiene helps improve insomnia in all patients. / Usually the best method of dealing with insomnia is by attacking the underlying cause.",
      headings),
    q(18, "matching", "Paragraph F", [H["v"]],
      "Đoạn F liệt kê HỆ LUỴ của mất ngủ: kém năng suất, cáu gắt, mất tập trung, lái xe nguy hiểm, nghỉ việc, mất cơ hội thăng tiến, che lấp rối loạn tâm thần, hại tim. → v.",
      "Not getting enough sleep can make you less productive, irritable and unable to concentrate.",
      headings),
    q(19, "matching", "Paragraph G", [H["iii"]],
      "Đoạn G đưa ra các THÓI QUEN nên tạo lập: ngủ dậy đúng giờ, không ngủ ngày, tránh cà phê - nicotine - rượu, tập thể dục, chỉ dùng phòng ngủ để ngủ. → iii.",
      "Establishing certain set routines can help insomniacs get better sleep.",
      headings),
    q(20, "true_false_not_given",
      "Someone who only gets four hours of sleep a night must be suffering from insomnia.",
      "NO",
      "Bài viết nói rõ mất ngủ KHÔNG được định nghĩa bằng số giờ ngủ; nhu cầu ngủ mỗi người mỗi khác, có người ngủ ít vẫn ổn. Vậy ngủ bốn tiếng chưa chắc là mất ngủ. → NO.",
      "Insomnia is not defined by the number of hours you sleep every night. The amount of sleep a person needs varies. While most people need between 7 and 8 hours of sleep a night, some people do well with less, and some need more."),
    q(21, "true_false_not_given", "Travelling can cause insomnia.", "YES",
      "\"Jet lag\" (lệch múi giờ do bay đường dài) được liệt kê thẳng trong danh sách nguyên nhân gây mất ngủ. → YES.",
      "An irregular work schedule, jet lag or brain damage from a stroke or Alzeimer's disease can also cause insomnia as well as excessive use of alcohol or illicit drugs."),
    q(22, "true_false_not_given",
      "REM sleep is felt to be the most important for the body's rest.", "NOT GIVEN",
      "Bài chỉ mô tả giấc ngủ REM (mơ, mắt đảo, tăng tiêu thụ oxy) và nói giai đoạn 1-2 của non-REM được cho là có tác dụng phục hồi. Tác giả KHÔNG hề xếp hạng giai đoạn nào quan trọng nhất cho sự nghỉ ngơi của cơ thể. → NOT GIVEN. Bẫy: nhiều bạn thấy chữ \"restorative\" gán cho non-REM rồi vội chọn NO, nhưng so sánh \"quan trọng NHẤT\" thì bài không đưa ra."),
    q(23, "true_false_not_given",
      "Secondary insomnia is far more common than primary insomnia.", "NOT GIVEN",
      "Đoạn D định nghĩa cả hai loại nhưng KHÔNG so sánh loại nào phổ biến hơn. Bẫy: bài có cụm \"the most common form of primary insomnia is psychophysiological insomnia\" - đó là so sánh trong nội bộ nhóm primary, không phải giữa primary và secondary. → NOT GIVEN."),
    q(24, "true_false_not_given", "Sufferers of insomnia can attend specialist sleep clinics.",
      "NOT GIVEN",
      "Bài nói tới bác sĩ chẩn đoán, vệ sinh giấc ngủ, trị liệu và xử lý nguyên nhân gốc, nhưng KHÔNG chỗ nào nhắc tới phòng khám chuyên về giấc ngủ. → NOT GIVEN."),
    q(25, "true_false_not_given",
      "Many people suffering from insomnia don't realise that they suffer from it.", "NOT GIVEN",
      "Bài chỉ nói người mất ngủ có thể TƯỞNG mất ngủ là vấn đề duy nhất của mình, trong khi thật ra nó là triệu chứng của rối loạn lớn hơn như trầm cảm - tức họ BIẾT mình mất ngủ, chỉ không biết nguyên nhân sâu xa. Bài không nói có nhiều người không nhận ra mình mất ngủ. → NOT GIVEN."),
    q(26, "true_false_not_given",
      "There is no actual correlation linking insomnia and depression.", "NO",
      "Ngược hẳn: các nghiên cứu cho thấy người mất ngủ có nguy cơ trầm cảm CAO GẤP BỐN LẦN người ngủ tốt, và đoạn B còn xếp tiền sử trầm cảm vào nhóm nguyên nhân. → NO.",
      "Studies show that people with insomnia are four times more likely to be depressed than people with a healthy sleeping pattern."),
    q(27, "true_false_not_given", "Sleeping during the day can make insomnia worse.", "YES",
      "Trong danh sách thói quen giúp người mất ngủ ngủ ngon hơn có mục \"avoiding napping\" - tránh ngủ ngày. Tức ngủ ngày làm bệnh nặng thêm. → YES.",
      "Examples of these routines include: going to bed and getting up at the same time every day, avoiding napping, avoiding caffeine, nicotine, alcohol and eating heavily late in the day"),
]

# ============================ PASSAGE 3 ============================
people = [
    "TB Tony Brown",
    "PL Patrick Leahy",
    "BB Bill Bowler",
    "PJ Paul Jepson",
    "AP Art Pimms",
    "SB Steve Black",
    "RH Rick Hilton",
]
PE = {p.split()[0]: p for p in people}

p3 = [
    q(28, "matching", "There is a double advantage to the new techniques.", [PE["AP"]],
      "Art Pimms (nhà nghiên cứu ở Malheur) nói cách làm mới vừa CÓ LỢI CHO MÔI TRƯỜNG vừa mang lại thành công cho nhà nông - đúng nghĩa \"lợi ích kép\". → AP.",
      "The new practices benefit the environment and give the growers their success.",
      people),
    q(29, "matching",
      "Expectations of end users of agricultural products affect the products.", [PE["RH"]],
      "Rick Hilton nói người tiêu dùng vừa ép ngành giảm thuốc trừ sâu vừa đòi quả phải đẹp không tì vết - tức KỲ VỌNG CỦA NGƯỜI DÙNG CUỐI chi phối sản phẩm. → RH.",
      "Consumers are rightly putting more and more pressure on the industry to change its reliance on chemical pesticides, but they still want a picture-perfect product",
      people),
    q(30, "matching", "The work on developing these alternative techniques is not finished.",
      [PE["PJ"]],
      "Paul Jepson dùng chữ \"must CONTINUE to develop\" - phải TIẾP TỤC phát triển các biện pháp thay thế, nghĩa là việc chưa xong. → PJ.",
      "We must continue to develop effective alternative practices that will reduce environmental hazards and produce high quality products",
      people),
    q(31, "matching",
      "Eating food that has had chemicals used in its production is dangerous to our health.",
      [PE["BB"]],
      "Bill Bowler, người phát ngôn của nhóm Green Action, khẳng định ăn thường xuyên thực phẩm trồng bằng hoá chất độc hại thì không thể tốt cho sức khoẻ. → BB.",
      "There is no way that habitual consumption of foodstuffs grown using toxic chemicals of the nature found on today's farms can be healthy for consumers",
      people),
    q(32, "matching", "Changing current farming methods is not a cheap process.", [PE["TB"]],
      "Tony Brown (Hiệp hội Nông dân Quốc gia) nói thay đổi toàn diện cách diệt sâu bệnh là chuyện TỐN KÉM, nên mới đề nghị được miễn giảm thuế. → TB.",
      "Wholesale changes in the way that farmers control the pests on their farms is an expensive business.",
      people),
    q(33, "matching", "Results have exceeded anticipations.", [PE["SB"]],
      "Steve Black, chủ trại hành thương phẩm, nói không những thay được thuốc diệt sâu nhân tạo mà kết quả còn VƯỢT CẢ MONG ĐỢI. → SB.",
      "but instead we have actually surpassed expectations.",
      people),
    q(34, "matching", "The research done should be translated into practical projects.",
      [PE["PJ"]],
      "Vẫn là Paul Jepson: kết quả nghiên cứu của OSU phải được ÁP DỤNG NGOÀI ĐỒNG RUỘNG chứ không nằm chết trong các tạp chí khoa học. Lưu ý PJ được dùng cho cả câu 30 và 34. → PJ.",
      "The work coming from OSU researchers must be adopted in the field and not simply languish in scientific journals.",
      people),
    q(35, "matching", "The U.S. produces the best food in the world.", [PE["PL"]],
      "Patrick Leahy - người đặt hàng bản báo cáo - nói nguồn thực phẩm của Mỹ vẫn AN TOÀN VÀ CHẤT LƯỢNG NHẤT TRÁI ĐẤT, dù ông phê phán việc lạm dụng thuốc trừ sâu. → PL.",
      "Our food supply remains the safest and highest quality on Earth",
      people),
    q(36, "true_false_not_given",
      "Integrated Pest Management has generally been regarded as a success in the US.", "FALSE",
      "Ngược lại: trên phạm vi toàn quốc, IPM KHÔNG đạt được kết quả sánh được với Oregon, và báo cáo GAO chê chính phủ liên bang chưa thúc đẩy hiệu quả. → FALSE.",
      "Nationwide, however, IPM has not delivered results comparable to those in Oregon."),
    q(37, "true_false_not_given",
      "Oregon farmers of apples and pears have been promoted as successful examples of Integrated Pest Management.",
      "TRUE",
      "Báo cáo GAO NÊU ĐÍCH DANH những người trồng táo và lê ở Oregon như hình mẫu áp dụng IPM ngày càng thành công. → TRUE.",
      "The GAO report singles out Oregon's apple and pear producers who have used the new IPM techniques with growing success."),
    q(38, "true_false_not_given", "The IPPC uses scientists from different organisations.", "TRUE",
      "IPPC quy tụ các nhà khoa học từ NHIỀU ĐƠN VỊ khác nhau: Trạm Thí nghiệm Nông nghiệp OSU, OSU Extension Service, Bộ Nông nghiệp Mỹ và cả nông dân Oregon. → TRUE.",
      "The IPPC brings together scientists from OSU's Agricultural Experiment Station, OSU Extension service, the U.S. Department of Agriculture and Oregon farmers"),
    q(39, "true_false_not_given", "Straw mulch experiments produced unplanned benefits.", "TRUE",
      "Ngoài giữ đất và giữ ẩm như dự tính, lớp phủ rơm còn BẤT NGỜ tạo nơi trú cho bọ cánh cứng và nhện có ích - bài dùng đúng chữ \"unexpectedly\". → TRUE.",
      "In addition, and unexpectedly, the scientists found that the mulched soil created a home for beneficial beetles and spiders that prey on onion thrips"),
    q(40, "true_false_not_given",
      "The apple industry is now facing a lot of competition from abroad.", "NOT GIVEN",
      "Bẫy đánh tráo loại quả: bài nói ngành LÊ (pear) đang chịu cạnh tranh gay gắt từ nước ngoài, chứ không nói gì về ngành táo. → NOT GIVEN."),
]

# ============================ UNITS ============================
units = [
    {"unitType": "reading_passage", "unitNumber": 1,
     "title": "Passage 1 - The Big Cats at the Sharjah Breeding Centre",
     "instructions": "You should spend about 20 minutes on Questions 1-13, which are based on Reading Passage 1 below.",
     "content": P["1"],
     "defaultTimeLimitMinutes": 20,
     "metadata": {
         "groupInstructions": {
             "1": "Use the information in the text to match the statements (1 - 8) with the animals (A - D).\n"
                  "Write the appropriate letter (A - D) in boxes 1 - 8 on your answer sheet. Write:\n"
                  ":::box\n"
                  "A if the statement refers to cheetahs at the Breeding Centre.\n"
                  "B if the statement refers to leopards at the Breeding Centre.\n"
                  "C if the statement refers to both cheetahs and leopards at the Breeding Centre.\n"
                  "D If the statement refers to neither cheetahs nor leopards at the Breeding Centre.\n"
                  ":::\n"
                  "Example: These animals are endangered - Answer: C",
             "9": "Complete the summary below. Choose your answers from the box below the summary and write them in boxes 9- 12 on your answer sheet.\n"
                  "NB There are more words than spaces, so you will not use them at all.\n"
                  ":::box\n"
                  "Reptiles | Variety | Behavior | Success | Creating\n"
                  "Expanding | Difficulty | Diversity | Action | Habitat\n"
                  "Season | Fish | Change | Working | Programme\n"
                  ":::",
         },
         "noteBody": p1_summary,
     },
     "questions": p1},
    {"unitType": "reading_passage", "unitNumber": 2,
     "title": "Passage 2 - Insomnia - The Enemy of Sleep",
     "instructions": "You should spend about 20 minutes on Questions 14-27, which are based on Reading Passage 2 below.",
     "content": P["2"],
     "defaultTimeLimitMinutes": 20,
     "metadata": {
         "groupInstructions": {
             "14": "The reading passage on Insomnia has 7 paragraphs (A - G).\n"
                   "From the list of headings below choose the most suitable headings for paragraphs B - G.\n"
                   "Write the appropriate number (i - xi) in boxes 14 - 19 on your answer sheet.\n"
                   "NB There are more headings than paragraphs, so you will not use them all.\n"
                   "Example: Paragraph A - Answer: iv\n"
                   "\nList of headings\n"
                   ":::box\n" + "\n".join(headings) + "\n:::",
             "20": "Do the following statements agree with the views of the writer of the reading passage on Insomnia?\n"
                   "In Boxes 20 - 27 write:\n"
                   ":::box\n"
                   "YES if the statement agrees with the writer\n"
                   "NO if the statement doesn't agree with the writer\n"
                   "NOT GIVEN if it is impossible to say what the writer thinks about this\n"
                   ":::",
         },
     },
     "questions": p2},
    {"unitType": "reading_passage", "unitNumber": 3,
     "title": "Passage 3 - Alternative Farming Methods in Oregon",
     "instructions": "You should spend about 20 minutes on Questions 28-40, which are based on Reading Passage 3 below.",
     "content": P["3"],
     "defaultTimeLimitMinutes": 20,
     "metadata": {
         "groupInstructions": {
             "28": "Match the views (28 - 35) with the people listed below.\n"
                   ":::box\n" + "\n".join(people) + "\n:::",
             "36": "Read the passage about alternative farming methods in Oregon again and look at the statements below.\n"
                   "In boxes 36 - 40 on your answer sheet write:\n"
                   ":::box\n"
                   "TRUE if the statement is true\n"
                   "FALSE if the statement is false\n"
                   "NOT GIVEN if the information is not given in the advertisement\n"
                   ":::",
         },
     },
     "questions": p3},
]

payload = {
    "title": "IELTS Master - Reading Test 48",
    "skill": "reading",
    "sourceLabel": "IELTS Master - Reading Test 48",
    "description": "Đề đọc IELTS Master Test 48: The Big Cats at the Sharjah Breeding Centre / Insomnia - The Enemy of Sleep / Alternative Farming Methods in Oregon.",
    "units": units,
}

# ============================ VALIDATOR ============================
KEY = {
    1: "A", 2: "D", 3: "B", 4: "D", 5: "B", 6: "C", 7: "A", 8: "B",
    9: "reptiles", 10: "expanding", 11: "diversity", 12: "behavior", 13: "success",
    14: "viii", 15: "i", 16: "x", 17: "vii", 18: "v", 19: "iii",
    20: "no", 21: "yes", 22: "not given", 23: "not given", 24: "not given",
    25: "not given", 26: "no", 27: "yes",
    28: "AP", 29: "RH", 30: "PJ", 31: "BB", 32: "TB", 33: "SB", 34: "PJ", 35: "PL",
    36: "false", 37: "true", 38: "true", 39: "true", 40: "not given",
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
        if not ev and "NOT GIVEN" not in qq["answer"]:
            errs.append(f"cau {o}: thieu evidence")
    for b in blanks:
        if b not in seen:
            errs.append(f"[[{b}]] trong noteBody nhung khong co cau tuong ung")

if sorted(orders) != list(range(1, 41)):
    errs.append(f"order khong chay du 1-40: {sorted(orders)}")

# Moi phuong an trong hop :::box phai la mot option that (bat loi go nham chu cai).
for u in units:
    for qq in u["questions"]:
        for opt in qq.get("options", []):
            if opt not in (qq.get("options") or []):
                errs.append(f"cau {qq['order']}: option la {opt!r}")

if errs:
    print("LOI:")
    for e in errs:
        print(" -", e)
    raise SystemExit(1)

json.dump(payload, open("tmp/ielts_master_reading_test48.json", "w", encoding="utf-8"),
          ensure_ascii=False, indent=1)

allq = {qq["order"]: qq for u in units for qq in u["questions"]}
print(f"{'#':>3} | {'sach':<10} | toi")
for i in range(1, 41):
    print(f"{i:>3} | {KEY[i]:<10} | {' | '.join(allq[i]['answer'])}")
print("\nOK -> tmp/ielts_master_reading_test48.json (40 cau)")
