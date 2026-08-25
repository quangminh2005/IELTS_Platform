# -*- coding: utf-8 -*-
"""Dung file JSON import cho IELTS Master - Reading Test 49.

Nguon:
  - de:     E:/ielts_master/reading/Reading (41-50)/49/Test 49.pdf
  - dap an: E:/ielts_master/reading/Reading (41-50)/49/Answer Sheet - 49.docx

Chay truoc:
  python tmp/build49_reading_text.py     -> tmp/_r49_passages.json
  python tmp/build49_reading_diagram.py  -> tmp/_r49_diag.txt
"""
import json
import re
import sys

sys.stdout.reconfigure(encoding="utf-8")

P = json.load(open("tmp/_r49_passages.json", encoding="utf-8"))
DIAGRAM = open("tmp/_r49_diag.txt", encoding="utf-8").read().strip()


def q(order, qtype, prompt, answer, explanation, evidence=None, options=None):
    d = {"order": order, "questionType": qtype, "prompt": prompt,
         "answer": answer if isinstance(answer, list) else [answer],
         "explanation": explanation, "points": 1}
    if evidence:
        d["evidence"] = evidence
    if options:
        d["options"] = options
    return d


# ============================ PASSAGE 1 - DIABETES ============================
endings = [
    "A a healthy lifestyle",
    "B never suffer any ill effects",
    "C women",
    "D people also suffering strokes",
    "E body cells",
    "F the pancreas",
    "G do not realise the fact",
    "H injections",
]
EN = {e.split()[0]: e for e in endings}

symptom_opts = [
    "A hot flushes",
    "B muscle pains",
    "C nausea",
    "D losing consciousness",
    "E tiredness",
    "F bleeding gums",
    "G dilation of the eyes",
]
symptom_answer = [symptom_opts[1], symptom_opts[3], symptom_opts[4]]  # B, D, E
SYMPTOM_EV = ("Common symptoms include: being more thirsty than usual, passing more urine, "
              "feeling lethargic, always feeling hungry, having cuts that heal slowly, itching, "
              "skin infections, bad breath, blurred vision, unexplained weight change, mood "
              "swings, headaches, feeling dizzy and leg cramps.")

p1 = [
    q(1, "true_false_not_given", "Carbohydrate foods are the body's source of glucose.", "YES",
      "Bài viết nói cơ thể TẠO glucose TỪ các thức ăn chứa carbohydrate: rau củ nhiều tinh bột, ngũ cốc, trái cây và sữa. → YES.",
      "The body makes glucose from foods containing carbohydrate such as vegetables containing carbohydrate (like potatoes or corn) and cereal foods (like bread, pasta and rice) as well as fruit and milk."),
    q(2, "true_false_not_given", "Diabetics cannot produce insulin.", "NO",
      "Câu này nói TẤT CẢ người tiểu đường đều không tạo được insulin - sai. Bài viết dùng chữ \"either... or\": tuyến tuỵ HOẶC không tạo được insulin, HOẶC có tạo nhưng không đủ và không hoạt động tốt. Tiểu đường tuýp 2 vẫn sản xuất insulin. → NO.",
      "In diabetes, the pancreas either cannot make insulin or the insulin it does make is not enough and cannot work properly."),
    q(3, "true_false_not_given",
      "Some patients develop diabetes due to faults in their own immune systems", "YES",
      "Tiểu đường tuýp 1 xảy ra khi HỆ MIỄN DỊCH của chính cơ thể tấn công và phá huỷ các tế bào beta sản xuất insulin trong tuyến tuỵ. → YES.",
      "It occurs when the body's immune system attacks the insulin-producing beta cells in the pancreas and destroys them."),
    q(4, "true_false_not_given",
      "Hyperglycaemia leads to type 1 diabetes being diagnosed quite quickly.", "YES",
      "Ở tuýp 1, triệu chứng đến đột ngột và có khi nguy hiểm tính mạng - đường huyết cao (hyperglycaemia) có thể gây hôn mê, CHÍNH VÌ VẬY bệnh thường được chẩn đoán khá nhanh. → YES.",
      "In Type 1 diabetes, symptoms are usually sudden and sometimes even life threatening - hyperglycaemia (high blood sugar levels) can lead to comas - and therefore it is mostly diagnosed quite quickly."),
    q(5, "true_false_not_given",
      "Artificial insulin is the most effective treatment for those patients requiring insulin.",
      "NOT GIVEN",
      "Bài có nói người phụ thuộc insulin phải TIÊM chứ không uống được, nhưng KHÔNG hề nhắc tới \"insulin nhân tạo\" cũng như không xếp hạng cách điều trị nào hiệu quả nhất. → NOT GIVEN."),
    q(6, "true_false_not_given",
      "Frequent check ups at the doctor can drastically reduce the chances of suffering from problems related to diabetes.",
      "NOT GIVEN",
      "Bẫy đánh tráo chủ thể: bài khuyên TỰ KIỂM TRA đường huyết thường xuyên (frequent self-testing), chứ không nói gì về việc đi khám bác sĩ định kỳ. → NOT GIVEN."),
    q(7, "true_false_not_given",
      "The majority of diabetics develop heart problems or suffer strokes.", "YES",
      "Bài nói 2 trong 3 người tiểu đường cuối cùng CHẾT vì các biến chứng tim mạch và đột quỵ - tức đa số mắc các vấn đề này. → YES.",
      "in fact 2 out of 3 people with diabetes eventually die of these complications"),
    q(8, "matching", "Bizarre as it may seem, many people with diabetes...", [EN["G"]],
      "Ngay đầu bài: hơn 1 triệu người Úc mắc bệnh nhưng 50% trong số đó CHƯA HỀ BIẾT mình mắc. → G do not realise the fact.",
      "Over 1 million Australians have it though 50% of those are as yet unaware.",
      endings),
    q(9, "matching", "Insulin is a hormone that allows glucose to be absorbed by...", [EN["E"]],
      "Insulin mở \"cánh cửa\" cho glucose đi từ máu vào CÁC TẾ BÀO CƠ THỂ, nơi năng lượng được tạo ra. Bẫy: F the pancreas là nơi SẢN XUẤT insulin, không phải nơi hấp thụ glucose. → E body cells.",
      "Insulin opens the doors that let glucose go from the blood to the body cells where energy is made.",
      endings),
    q(10, "matching", "Non severe type 2 diabetes can be solely treated by...", [EN["A"]],
      "Với tiểu đường tuýp 2, ăn uống lành mạnh và vận động đều đặn CÓ THỂ LÀ TẤT CẢ những gì cần ở giai đoạn đầu - thuốc viên hay insulin chỉ tính tới sau. → A a healthy lifestyle.",
      "For people with Type 2 diabetes, healthy eating and regular physical activity may be all that is required at first: sometimes tablets and/or insulin may be needed later on.",
      endings),
    q(11, "matching", "Increases in diabetes related heart problems are mainly seen in...",
      [EN["C"]],
      "Phụ nữ trẻ chiếm gần như TOÀN BỘ phần tăng thêm của nguy cơ nhồi máu cơ tim. Bẫy: nam giới trẻ có nguy cơ ĐỘT QUỴ gấp đôi phụ nữ - nhưng câu hỏi hỏi về bệnh TIM. → C women.",
      "Young women account for almost all the increase in heart attack risk, while young men are twice as likely to suffer a stroke as young women.",
      endings),
    # Cau 12-14: "Choose THREE letters" -> 3 cau multiple_choice lien tiep cung options
    # va cung tap dap an {B, D, E} => giao dien tu gop thanh MOT khoi checkbox.
    # Prompt de trong: de bai nam o groupInstructions (xem import-multi-select-letters).
    q(12, "multiple_choice", "", symptom_answer,
      "Ba triệu chứng có trong bài là B muscle pains (bài ghi \"leg cramps\" - chuột rút ở chân), D losing consciousness (đường huyết cao có thể dẫn tới hôn mê) và E tiredness (bài ghi \"feeling lethargic\" - uể oải). Bẫy: hot flushes, nausea, bleeding gums và dilation of the eyes đều KHÔNG có trong danh sách; bài chỉ nói \"blurred vision\" (nhìn mờ) chứ không phải giãn đồng tử.",
      SYMPTOM_EV + " / In Type 1 diabetes, symptoms are usually sudden and sometimes even life threatening - hyperglycaemia (high blood sugar levels) can lead to comas",
      symptom_opts),
    q(13, "multiple_choice", "", symptom_answer,
      "Ba triệu chứng có trong bài là B muscle pains (bài ghi \"leg cramps\" - chuột rút ở chân), D losing consciousness (đường huyết cao có thể dẫn tới hôn mê) và E tiredness (bài ghi \"feeling lethargic\" - uể oải). Bẫy: hot flushes, nausea, bleeding gums và dilation of the eyes đều KHÔNG có trong danh sách; bài chỉ nói \"blurred vision\" (nhìn mờ) chứ không phải giãn đồng tử.",
      SYMPTOM_EV + " / In Type 1 diabetes, symptoms are usually sudden and sometimes even life threatening - hyperglycaemia (high blood sugar levels) can lead to comas",
      symptom_opts),
    q(14, "multiple_choice", "", symptom_answer,
      "Ba triệu chứng có trong bài là B muscle pains (bài ghi \"leg cramps\" - chuột rút ở chân), D losing consciousness (đường huyết cao có thể dẫn tới hôn mê) và E tiredness (bài ghi \"feeling lethargic\" - uể oải). Bẫy: hot flushes, nausea, bleeding gums và dilation of the eyes đều KHÔNG có trong danh sách; bài chỉ nói \"blurred vision\" (nhìn mờ) chứ không phải giãn đồng tử.",
      SYMPTOM_EV + " / In Type 1 diabetes, symptoms are usually sudden and sometimes even life threatening - hyperglycaemia (high blood sugar levels) can lead to comas",
      symptom_opts),
]

# ============================ PASSAGE 2 - ARCTIC ============================
p2_summary = """The origins of spring, arctic haze, first seen over the ice cap in the 1950s, were at first not [[22]]. This haze is a smog formed in the dark, arctic winter by pollution delivered to the Arctic by storms [[23]] in Europe and Asia. It is known to be a recent phenomenon as proof from [[24]] shows it only starting to occur in the 20th Century. The smog consists of sulphates and carbon, the latter creating the [[25]] of the haze. Due to lack of research, the final destination of the pollution is unknown but it probably ends up in the [[26]] and therefore into the food chain. Scientists are presently more worried about the [[27]] effect it has on climate change."""

p2 = [
    q(15, "true_false_not_given", "Industry in the Arctic has increased over the last 20 years.",
      "NOT GIVEN",
      "Bẫy đọc lướt: bài nói trong 20 năm qua các nhà khoa học PHÁT HIỆN ngày càng nhiều loại chất độc ở phương Bắc, và nguồn gốc của chúng ở cách xa hàng nghìn dặm. Bài không nói gì về việc công nghiệp TẠI Bắc Cực tăng lên. → NOT GIVEN."),
    q(16, "true_false_not_given",
      "Arctic conditions mean that the break down of pollutants is much accelerated", "FALSE",
      "Ngược hẳn: do ít nắng, băng phủ dày và nhiệt độ lạnh, chất ô nhiễm phân huỷ CHẬM HƠN NHIỀU so với vùng khí hậu ấm - vì thế chúng còn tích tụ đậm đặc hơn. → FALSE.",
      "Due to extreme conditions in the Arctic, including reduced sunlight, extensive ice cover and cold temperatures, contaminants break down much more slowly than in warmer climates."),
    q(17, "true_false_not_given",
      "Pollution absorbed by arctic algae can eventually affect humans.", "TRUE",
      "Tảo hút chất độc, động vật phù du ăn tảo, chất độc tích tụ dần theo từng bậc chuỗi thức ăn và cuối cùng ảnh hưởng tới người dân phương Bắc ăn thú biển ở gần đỉnh chuỗi. → TRUE.",
      "The accumulation of these contaminants increases with each step of the food chain or web and can potentially affect northerners who eat marine mammals near the top of the food chain."),
    q(18, "true_false_not_given",
      "The AEPS has set up scientific stations in the Arctic to monitor pollution.", "NOT GIVEN",
      "Bài nói AEPS lập chương trình AMAP, và AMAP thiết lập một MẠNG LƯỚI KHOA HỌC QUỐC TẾ để theo dõi. \"Mạng lưới\" không đồng nghĩa với việc dựng các TRẠM nghiên cứu tại Bắc Cực - bài không nói tới trạm nào. → NOT GIVEN."),
    q(19, "true_false_not_given", "Arctic pollution can sometimes resemble US urban pollution.",
      "TRUE",
      "Khi ánh sáng mùa xuân tới, lớp mù ở Bắc Cực có lúc trông giống hệt màn ô nhiễm trên các thành phố như LOS ANGELES - một đô thị Mỹ. → TRUE.",
      "When the spring light arrives in the Arctic, there is a smog-like haze, which makes the region, at times, looks like pollution over such cities as Los Angeles."),
    q(20, "true_false_not_given",
      "Evidence that this smog has only occurred in the 20th Century has been found in the ice on the polar ice cap.",
      "TRUE",
      "Các lõi băng khoan từ dải băng Greenland cho thấy hạt mù này không phải lúc nào cũng có ở Bắc Cực mà chỉ bắt đầu xuất hiện trong thế kỷ vừa qua. → TRUE.",
      "Evidence from ice cores drilled from the ice sheet of Greenland indicates that these haze particles were not always present in the Arctic, but began to appear only in the last century."),
    q(21, "true_false_not_given",
      "Research has shown that aerosol arctic pollutants remain the air indefinitely.", "FALSE",
      "Bài viết nói rõ: người ta BIẾT các chất này bị loại khỏi không khí bằng cách nào đó, chỉ chưa rõ chúng đi đâu. Vậy chúng không ở lại trong không khí mãi mãi. → FALSE.",
      "It is known that they are removed somehow."),
    q(22, "note_completion", "Câu 22", ["accepted"],
      "Giả thuyết cho rằng nguồn gốc lớp mù ở rất xa lúc đầu KHÔNG ĐƯỢC CHẤP NHẬN - bài viết nói ý tưởng đó \"rất khó để nhiều người ủng hộ\". Bẫy: \"Valid\" (có giá trị) nghe hợp nhưng \"not accepted\" mới khớp với \"difficult for many to support\".",
      "The idea that the source was long range was very difficult for many to support."),
    q(23, "note_completion", "Câu 23", ["originating", "originate"],
      "Các cơn bão mang chất ô nhiễm tới Bắc Cực BẮT NGUỒN từ châu Âu và châu Á - bài dùng đúng động từ \"originate\", dạng V-ing sau danh từ \"storms\".",
      "It is now known that the contaminants originate largely from Europe and Asia."),
    q(24, "note_completion", "Câu 24", ["ice cores", "ice core"],
      "Bằng chứng đến từ CÁC LÕI BĂNG khoan ở dải băng Greenland - cho thấy hiện tượng chỉ mới có từ thế kỷ 20.",
      "Evidence from ice cores drilled from the ice sheet of Greenland indicates that these haze particles were not always present in the Arctic, but began to appear only in the last century."),
    q(25, "note_completion", "Câu 25", ["darkness"],
      "Hạt sulfate nguyên chất vốn KHÔNG MÀU, nên MÀU SẪM của lớp mù là do các hạt carbon trộn lẫn vào tạo ra.",
      "Pure sulfate particles or droplets are colourless, so it is believed the darkness of the haze is caused by the mixed-in carbon particles."),
    q(26, "note_completion", "Câu 26", ["sea", "the sea"],
      "Nhiều khả năng chất ô nhiễm cuối cùng rơi xuống BIỂN - Bắc Đại Tây Dương, biển Na Uy và có thể cả biển Bering, đều là ngư trường quan trọng, nên chúng đi vào chuỗi thức ăn.",
      "There is a good degree of likelihood that the contaminants end up in the ocean, likely into the North Atlantic, the Norwegian Sea and possibly the Bering Sea"),
    q(27, "note_completion", "Câu 27", ["unknown"],
      "Điều các nhà khoa học lo nhất hiện nay là tác động CHƯA RÕ của lớp mù lên biến đổi khí hậu - bài viết dùng đúng chữ \"unknown\".",
      "The global impact of this is currently unknown but the implications are quite powerful."),
]

# ============================ PASSAGE 3 - COFFEE ============================
headings = [
    "i Growing Coffee",
    "ii Problems with Manufacture",
    "iii Processing the Bean",
    "iv First Contact",
    "v Arabian Coffee",
    "vi Coffee Varieties",
    "vii Modern Coffee",
    "viii The Spread of Coffee",
    "ix Consuming Coffee",
    "x Climates for Coffee",
    "xi The Coffee Plant",
]
H = {re.match(r"^([ivx]+) ", h).group(1): h for h in headings}

p3_note = """[[34]]
[[35]]
[[36]]
:::break
# The Coffee Production Process
:::flow
The coffee (eg) ...cherry... is picked by hand and delivered to mills.
The coffee cherry is pulped or [[37]]
The pulped beans are left [[38]] to ferment in pure water.
The wet beans are sun dried for 1 or 2 weeks to make parchment - they are [[39]] often to ensure an even drying procedure.
The parchment is then bagged and taken to be milled to make the green beans.
The green beans are then roasted to [[40]]
The roasted beans are cooled.
The finished product is packaged and mailed to the customer.
:::"""

p3 = [
    q(28, "matching", "Paragraph B", [H["viii"]],
      "Đoạn B kể việc cà phê LAN RỘNG: từ Ethiopia sang bán đảo Ả Rập, trồng đầu tiên ở Yemen, rồi tới Thổ Nhĩ Kỳ và châu Âu nhờ thương nhân Venice. Bẫy: \"v Arabian Coffee\" chỉ đúng một chặng trong cả hành trình. → viii.",
      "Coffee berries were transported from Ethiopia to the Arabian Peninsula, and were first cultivated in what today is the country of Yemen. Coffee remained a secret in Arabia before spreading to Turkey and then to the European continent by means of Venetian trade merchants.",
      headings),
    q(29, "matching", "Paragraph C", [H["ix"]],
      "Đoạn C nói người ta DÙNG cà phê thế nào qua các thời kỳ: ăn như thức ăn, nấu thành thức uống gây hưng phấn, dùng làm thuốc, làm \"rượu vang Ả Rập\", rồi rang lên pha uống và mở quán cà phê. → ix Consuming Coffee.",
      "Coffee was first eaten as a food though later people in Arabia would make a drink out of boiling the beans for its narcotic effects and medicinal value.",
      headings),
    q(30, "matching", "Paragraph D", [H["vi"]],
      "Đoạn D liệt kê các GIỐNG cà phê: khoảng 60 loài mọc hoang, chỉ 10 loài được trồng, và hai loài Coffea Arabica với Coffea Canephora (Robusta) chiếm gần hết sản lượng thế giới, lại còn nhiều phân loài. → vi Coffee Varieties.",
      "Of these ten, two species are responsible for almost all the coffee produced in the world: Coffea Arabica and Coffea Canephora (usually known as Robusta).",
      headings),
    q(31, "matching", "Paragraph E", [H["xi"]],
      "Đoạn E mô tả BẢN THÂN CÂY và quả: chiều cao, hoa trắng thơm như nhài, quả đỏ như quả anh đào, các lớp epicarp - mesocarp - endocarp và kích thước hạt. → xi The Coffee Plant.",
      "Although wild plants can reach 10 - 12 metres in height, the plantation one reaches a height of around four metres.",
      headings),
    q(32, "matching", "Paragraph F", [H["i"]],
      "Đoạn F nói cách TRỒNG cà phê: khí hậu, đất, độ cao, gieo trong vườn ươm, chuyển ra đồn điền vào mùa mưa, che nắng che gió, và sản lượng khi cây được năm tuổi. Bẫy: \"x Climates for Coffee\" chỉ bao được phần đầu đoạn, trong khi đoạn còn nói cả khâu gieo trồng và thu hoạch. → i Growing Coffee.",
      "Coffee plants need special conditions to give a satisfactory crop.",
      headings),
    q(33, "matching", "Paragraph G", [H["iii"]],
      "Đoạn G mô tả CHẾ BIẾN hạt sau thu hoạch: hái quả, xay ướt, ủ lên men, phơi nắng, cào đảo, xay bỏ vỏ trấu để ra hạt xanh rồi rang. → iii Processing the Bean.",
      "At the end of the day, the pickers bring their heavy burlap bags to pulping mills where the cherry coffee can be pulped (or wet milled).",
      headings),
    q(34, "note_completion", "Câu 34", ["epicarp", "the epicarp"],
      "Mũi tên (34) chỉ LỚP VỎ NGOÀI cùng của quả - bài viết gọi là lớp màng mỏng màu đỏ, tức epicarp.",
      "The berry is coated with a thin, red film (epicarp) containing a white, sugary mucilaginous flesh (mesocarp)."),
    q(35, "note_completion", "Câu 35", ["mesocarp", "the mesocarp"],
      "Mũi tên (35) chỉ lớp THỊT QUẢ trắng, nhiều đường và nhớt nằm ngay dưới vỏ - tức mesocarp.",
      "The berry is coated with a thin, red film (epicarp) containing a white, sugary mucilaginous flesh (mesocarp)."),
    q(36, "note_completion", "Câu 36", ["endocarp", "the endocarp"],
      "Mũi tên (36) chỉ lớp vỏ trấu dai màu vàng óng bọc quanh hạt - bài gọi là endocarp.",
      "Beans are in turn coated with a kind of resistant, golden yellow parchment, (called endocarp)."),
    q(37, "note_completion", "Câu 37", ["wet milled", "wet-milled"],
      "Ở nhà máy, quả cà phê được xay bỏ vỏ - bài viết ghi \"pulped (or wet milled)\", tức XAY ƯỚT.",
      "At the end of the day, the pickers bring their heavy burlap bags to pulping mills where the cherry coffee can be pulped (or wet milled)."),
    q(38, "note_completion", "Câu 38", ["overnight"],
      "Hạt sau khi xay được ngâm trong nước mưa sạch để lên men QUA ĐÊM.",
      "The pulped beans then rest, covered in pure rainwater to ferment overnight."),
    q(39, "note_completion", "Câu 39", ["raked"],
      "Để hạt khô đều, người ta phải CÀO ĐẢO nhiều lần trong suốt thời gian phơi.",
      "To make sure they dry evenly, the beans need to be raked many times during this drying time."),
    q(40, "note_completion", "Câu 40",
      ["the customers' specifications", "customers' specifications",
       "the customers\u2019 specifications", "customers\u2019 specifications",
       "customer's specifications", "the customers specifications"],
      "Hạt xanh được rang THEO YÊU CẦU CỦA KHÁCH HÀNG, sau đó để nguội, đóng gói và gửi đi.",
      "The green beans are roasted according to the customers' specifications and, after cooling, the beans are then packaged and mailed to customers."),
]

# ============================ UNITS ============================
units = [
    {"unitType": "reading_passage", "unitNumber": 1,
     "title": "Passage 1 - Diabetes",
     "instructions": "You should spend about 20 minutes on Questions 1-14, which are based on Reading Passage 1 below.",
     "content": P["1"],
     "defaultTimeLimitMinutes": 20,
     "metadata": {
         "groupInstructions": {
             "1": "Do the following statements reflect the views of the writer in Reading Passage 1?\n"
                  "In boxes 1 - 7 on your answer sheet write:\n"
                  ":::box\n"
                  "YES if the statement agrees with the information\n"
                  "NO if the statement contradicts the statement\n"
                  "NOT GIVEN if there is no information on this in the passage\n"
                  ":::",
             "8": "Complete the following statements with the best ending from the box below.\n"
                  "Write the appropriate letters A - H in boxes 8 - 11 on your answer sheet.\n"
                  ":::box\n" + "\n".join(endings) + "\n:::",
             "12": "According to the text which of the following are symptoms of diabetes?\n"
                   "Choose THREE letters (A - G) and write them in boxes 12 - 14 on your answer sheet.",
         },
     },
     "questions": p1},
    {"unitType": "reading_passage", "unitNumber": 2,
     "title": "Passage 2 - Contaminating the Arctic",
     "instructions": "You should spend about 20 minutes on Questions 15-27, which are based on Reading Passage 2 below.",
     "content": P["2"],
     "defaultTimeLimitMinutes": 20,
     "metadata": {
         "groupInstructions": {
             "15": "Read passage 2 and look at the statements below.\n"
                   "In boxes 15 - 21 on your answer sheet write:\n"
                   ":::box\n"
                   "TRUE if the statement is true\n"
                   "FALSE if the statement is false\n"
                   "NOT GIVEN if the information is not given in the passage\n"
                   ":::",
             "22": "Complete the summary relating to Arctic Haze below.\n"
                   "Choose your answers from the box below the summary and write them in boxes 22 - 27 on your answer sheet.\n"
                   "NB There are more words than spaces, so you will not use them at all.\n"
                   ":::box\n"
                   "Burning | Terrible | Ice cores | Valid | Certain\n"
                   "Originating | Sea | Destroying | Theories | Unknown\n"
                   "Agriculture | Decided | Bird life | Dissipating | Accepted\n"
                   "Gases | Darkness | Air | Density\n"
                   ":::",
         },
         "groupTitles": {"22": "Arctic Haze"},
         "noteBody": p2_summary,
     },
     "questions": p2},
    {"unitType": "reading_passage", "unitNumber": 3,
     "title": "Passage 3 - The Story of Coffee",
     "instructions": "You should spend about 20 minutes on Questions 28-40, which are based on Reading Passage 3 below.",
     "content": P["3"],
     "defaultTimeLimitMinutes": 20,
     "metadata": {
         "groupInstructions": {
             "28": "The reading passage on The Story of Coffee has 7 paragraphs A - G.\n"
                   "From the list of headings below choose the most suitable headings for paragraphs B - G.\n"
                   "Write the appropriate number (i - xi) in boxes 28 - 33 on your answer sheet.\n"
                   "NB There are more headings than paragraphs, so you will not use them all.\n"
                   "Example: Paragraph A - Answer: iv\n"
                   "\nList of headings\n"
                   ":::box\n" + "\n".join(headings) + "\n:::",
             "34": "Complete the labels on the diagram of a coffee bean below.\n"
                   "Choose your answers from the text and write them in boxes 34 - 36 on your answer sheet.",
             "37": "Using the information in the passage, complete the flow chart below.\n"
                   "Write your answers in boxes 37 - 40 on your answer sheet.\n"
                   "Use NO MORE THAN THREE WORDS from the passage for each answer.",
         },
         "groupImages": {"34": DIAGRAM},
         "noteBody": p3_note,
     },
     "questions": p3},
]

payload = {
    "title": "IELTS Master - Reading Test 49",
    "skill": "reading",
    "sourceLabel": "IELTS Master - Reading Test 49",
    "description": "Đề đọc IELTS Master Test 49: Diabetes / Contaminating the Arctic / The Story of Coffee.",
    "units": units,
}

# ============================ VALIDATOR ============================
KEY = {
    1: "yes", 2: "no", 3: "yes", 4: "yes", 5: "not given", 6: "not given", 7: "yes",
    8: "G", 9: "E", 10: "A", 11: "C", 12: "B", 13: "E", 14: "D",
    15: "not given", 16: "false", 17: "true", 18: "not given", 19: "true", 20: "true",
    21: "false", 22: "accepted", 23: "originating", 24: "ice cores", 25: "darkness",
    26: "sea", 27: "unknown",
    28: "viii", 29: "ix", 30: "vi", 31: "xi", 32: "i", 33: "iii",
    34: "epicarp", 35: "mesocarp", 36: "endocarp", 37: "wet milled", 38: "overnight",
    39: "raked", 40: "the customers' specifications",
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

# Cau 12-14 phai thanh MOT khoi checkbox: 3 cau lien tiep, cung options, cung tap dap an.
mset = [qq for qq in units[0]["questions"] if qq["order"] in (12, 13, 14)]
if len({tuple(x["options"]) for x in mset}) != 1:
    errs.append("cau 12-14: options khong giong nhau -> khong gop thanh checkbox")
if len({tuple(sorted(x["answer"])) for x in mset}) != 1:
    errs.append("cau 12-14: tap dap an khong giong nhau -> khong gop thanh checkbox")
if len(mset[0]["answer"]) != 3:
    errs.append("cau 12-14: phai co dung 3 dap an")

# Doan note cua bai 3 phai tach lam 2 khoi (so do 34-36 / luu do 37-40).
if p3_note.count(":::break") != 1:
    errs.append("bai 3: thieu :::break giua so do va luu do")

if errs:
    print("LOI:")
    for e in errs:
        print(" -", e)
    raise SystemExit(1)

json.dump(payload, open("tmp/ielts_master_reading_test49.json", "w", encoding="utf-8"),
          ensure_ascii=False, indent=1)

allq = {qq["order"]: qq for u in units for qq in u["questions"]}
print(f"{'#':>3} | {'sach':<28} | toi")
for i in range(1, 41):
    print(f"{i:>3} | {KEY[i]:<28} | {' | '.join(allq[i]['answer'])}")
print("\nOK -> tmp/ielts_master_reading_test49.json (40 cau)")
