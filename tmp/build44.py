# -*- coding: utf-8 -*-
"""Dựng file JSON import cho IELTS Master Reading Test 44 (nguồn: Test 44.pdf + Answer Sheet - 44.docx)."""
import json, sys

P = json.load(open('tmp/_t44_passages.json', encoding='utf8'))

TFNG = ['TRUE', 'FALSE', 'NOT GIVEN']
PARA_AG = list('ABCDEFG')
EXPERTS = list('ABCDE')
ENDINGS = list('ABCDEFGHI')


def q(order, qtype, prompt, answer, explanation, options=None, evidence=None):
    d = {'order': order, 'questionType': qtype, 'prompt': prompt, 'answer': answer,
         'explanation': explanation, 'points': 1}
    if options:
        d['options'] = options
    if evidence:
        d['evidence'] = evidence
    return d


# ============================================================ Passage 1
T1 = [
    (1, 'Trans fatty acids are found in all types of meat.', 'FALSE',
     "Bài chỉ nói chất béo chuyển hoá có tự nhiên (với lượng nhỏ) trong thực phẩm từ động vật NHAI LẠI – sữa, thịt bò, thịt cừu. Chữ “all types of meat” rộng hơn hẳn so với bài. → FALSE.",
     "They occur naturally in small amounts in foods produced from ruminant animals e.g. milk, beef and lamb."),
    (2, 'Health problems can be caused by the consumption of small amounts of trans fatty acids.', 'TRUE',
     "Bài nói tác hại của chất béo chuyển hoá được ghi nhận NGAY CẢ Ở MỨC ĂN VÀO RẤT THẤP (khoảng 2-7g mỗi ngày). → TRUE.",
     "The authors also reported that the adverse effects of trans fatty acids were observed even at very low intakes (3% of total daily energy intake, or about 2-7g per day) (Mozaffarian et al. 2006)."),
    (3, 'Experts consider that the trans fatty acids contained in animal products are unlikely to be a serious health risk.', 'TRUE',
     "Bài nói tác động tới sức khoẻ cộng đồng của chất béo chuyển hoá từ động vật nhai lại được cho là TƯƠNG ĐỐI HẠN CHẾ – tức không phải mối nguy nghiêm trọng. → TRUE.",
     "The public health implications of consuming trans fatty acids from ruminant products are considered to be relatively limited."),
    (4, 'In Britain, the intake of trans fatty acids is continuing to decline.', 'NOT GIVEN', None, None),
    (5, 'The amount of saturated fats in processed meats is being reduced by some major producers.', 'NOT GIVEN', None, None),
    (6, 'It is proving difficult to find a safe substitute for trans fatty acids.', 'TRUE',
     "Bài nói thách thức kỹ thuật lớn là làm sao ĐỪNG chỉ đổi chất béo chuyển hoá lấy chất béo bão hoà, vì loại kia cũng có hại – tức tìm chất thay thế an toàn đang là chuyện khó. → TRUE.",
     "It is clear that a major technical challenge in achieving such changes is to avoid simply exchanging trans fatty acids for saturated fatty acids, which also have damaging health effects."),
    (7, 'Some people are still consuming larger quantities of trans fatty acids than the experts consider safe.', 'TRUE',
     "Bài nói không được chủ quan vì lượng ăn vào ở MỘT SỐ BỘ PHẬN dân cư vẫn CAO HƠN mức khuyến nghị. → TRUE.",
     "However, this does not mean there is room for complacency, as the intake in some sectors of the population is known to be higher than recommended."),
]
NG4 = ("Bài chỉ nói SUỐT THẬP KỶ QUA lượng ăn vào ở Anh đã giảm và nay ở mức 1,2% năng lượng, "
       "hoàn toàn không cho biết mức này CÓ TIẾP TỤC GIẢM hay không. Không đủ thông tin để kết luận. → NOT GIVEN.")
NG5 = ("Bài có nhắc một nhà sản xuất châu Âu đã cắt giảm chất béo bão hoà, nhưng là trong BÁNH QUY, BÁNH NGỌT VÀ ĐỒ ĂN VẶT, "
       "chứ không hề nói gì tới THỊT CHẾ BIẾN. Không có thông tin để kết luận. → NOT GIVEN.")
NG_EXP = {4: NG4, 5: NG5}

u1q = []
for n, p, a, e, ev in T1:
    if a == 'NOT GIVEN':
        u1q.append(q(n, 'true_false_not_given', p, a, NG_EXP[n], TFNG))
    else:
        u1q.append(q(n, 'true_false_not_given', p, a, e, TFNG, ev))

S1 = [
    (8, 'Scientists at Oxford University propose that information about trans fatty acids should be included on ............',
     ['food labels', 'the food labels', 'food label'],
     "Câu mở bài nói bài xã luận của các nhà nghiên cứu Đại học Oxford kêu gọi NHÃN THỰC PHẨM phải ghi cả chất béo chuyển hoá. → food labels.",
     "A recent editorial in the British Medical Journal (BMJ), written by researchers from the University of Oxford, has called for food labels to list trans fats as well as cholesterol and saturated fat."),
    (9, 'In food manufacture, the majority of trans fatty acids are created when ............ are solidified.',
     ['vegetable oils', 'the vegetable oils', 'vegetable oil'],
     "Bài nói phần lớn chất béo chuyển hoá trong khẩu phần sinh ra trong quá trình hydro hoá một phần (làm cứng) DẦU THỰC VẬT thành mỡ bán rắn. → vegetable oils.",
     "However, most of the trans fatty acids in the diet are produced during the process of partial hydrogenation (hardening) of vegetable oils into semi-solid fats."),
    (10, 'The likelihood of a person developing ............ is increased by trans fatty acid consumption.',
     ['heart disease', 'heart diseases', 'cardiovascular disease', 'cardiovascular diseases'],
     "Bài nói chất béo chuyển hoá tác động xấu tới lipid máu, và điều này đã được chứng minh làm TĂNG NGUY CƠ BỆNH TIM. → heart disease (hoặc cardiovascular disease).",
     "Trans fatty acids have an adverse effect on certain chemicals, known as lipids, which are found in the blood and have been shown to increase the risk of heart disease."),
    (11, 'In the UK, the ............ established a limit for the safe daily consumption of trans fatty acids.',
     ['Department of Health', 'the Department of Health'],
     "Mức khuyến nghị 2% tổng năng lượng là do BỘ Y TẾ Anh đặt ra năm 1991. → Department of Health.",
     "Over the last decade, population intakes of trans fatty acids in the UK fell and are now, on average, well below the recommended 2% of total energy set by the Department of Health in 1991, at 1.2% of energy (Henderson et al. 2003)."),
    (12, 'Partially hydrogenated oils are no longer found in most UK manufactured salty ............',
     ['biscuits and crisps', 'savoury biscuits and crisps'],
     "“Salty” trong câu hỏi tương ứng với “savoury” trong bài: đại đa số BÁNH QUY MẶN VÀ SNACK KHOAI TÂY sản xuất ở Anh không còn chứa dầu hydro hoá một phần. → biscuits and crisps.",
     "Consequently, the vast majority of savoury biscuits and crisps produced in the UK do not contain partially hydrogenated oils."),
    (13, 'Consumption of trans fatty acids in ............ is now higher than in the UK.',
     ['USA', 'the USA', 'US', 'the US', 'United States', 'the United States'],
     "Bài nói lượng ăn vào trung bình ở Anh THẤP HƠN ở Mỹ – đảo lại thì Mỹ cao hơn Anh. → USA.",
     "Furthermore, the average intake of trans fatty acids is lower in the UK than in the USA (where legislation has now been introduced)."),
]
u1q += [q(n, 'short_answer', p, a, e, None, ev) for n, p, a, e, ev in S1]

unit1 = {
    'unitType': 'reading_passage', 'unitNumber': 1,
    'title': 'Passage 1 - Trans Fatty Acids',
    'instructions': 'You should spend about 20 minutes on Questions 1-13, which are based on Reading Passage 1 below.',
    'content': P['p1']['content'], 'defaultTimeLimitMinutes': 20,
    'metadata': {'groupInstructions': {
        '1': ("Do the following statements agree with the information given in the passage?\n"
              "In boxes 1-7 write\n"
              ":::box\n"
              "TRUE if the statement agrees with the information\n"
              "FALSE if the statement contradicts the information\n"
              "NOT GIVEN if there is no information on this\n"
              ":::"),
        '8': ("Complete the sentences below.\n"
              "Choose NO MORE THAN THREE WORDS from the passage.")}},
    'questions': u1q,
}

# ============================================================ Passage 2
M2 = [
    (14, 'reasons for the success of bioethanol production in one region', 'D',
     "Đoạn D giải thích vì sao Brazil làm được: người Brazil lái xe ít hơn, đất đai màu mỡ, khí hậu thuận lợi nên năng suất cây trồng cao hơn, lại thưa dân. → D.",
     "Not only do Brazilians drive far less than Europeans and Americans, their fertile land and favourable climate mean their crop yields are higher, and their population density is lower."),
    (15, 'an individual’s prediction of the consequences of increasing production of corn ethanol', 'F',
     "Đoạn F dẫn lời Lester Brown DỰ ĐOÁN bùng nổ bioethanol sẽ dẫn tới cuộc cạnh tranh giữa 800 triệu người có ô tô và 3 tỷ người sống dưới 2 đô la một ngày. → F.",
     "He predicts that a boom in bioethanol would lead to a competition between the 800 million people in the world who own automobiles and the three billion people who live on less than $2 a day, many of whom are already spending over half their income on food."),
    (16, 'a reference to why biofuels might help to slow down global warming', 'B',
     "Đoạn B nêu LÝ DO: cây trồng hút khí CO2 từ khí quyển khi lớn lên nên phe ủng hộ cho rằng nhiên liệu sinh học cắt giảm mạnh khí nhà kính ròng. → B.",
     "B Supporters claim they will cut our net greenhouse gas inputs dramatically, because the crops soak up carbon dioxide from the atmosphere as they grow."),
    (17, 'a definition of biofuel', 'A',
     "Đoạn A đưa ra ĐỊNH NGHĨA: biofuel là thuật ngữ chung chỉ mọi nhiên liệu có nguồn gốc từ chất hữu cơ. → A.",
     "Biofuel is an umbrella term used to describe all fuels derived from organic matter."),
    (18, 'a reference to research that found one type of bioethanol to be less ecofriendly than oil', 'E',
     "Đoạn E dẫn nghiên cứu của David Pimentel (Đại học Cornell) kết luận ethanol từ ngô thải ra NHIỀU khí nhà kính hơn cả đốt nhiên liệu hoá thạch. → E.",
     "Opinions are divided as to what should and should not be included in the calculations, which means the results vary widely, but a study by David Pimentel at Cornell University in New York concluded that corn ethanol creates more greenhouse gases than burning fossil fuels."),
    (19, 'examples of how ethanol was used as a fuel before petroleum', 'C',
     "Đoạn C nêu VÍ DỤ thời trước dầu mỏ: xe Model T Ford (1908) được thiết kế chạy bằng ethanol, còn Rudolf Diesel chạy máy trình diễn bằng dầu lạc. → C.",
     "The Model T Ford, first produced in 1908, was designed to run on ethanol, and Rudolf Diesel, who invented the diesel engine in 1892, ran his demonstration model on peanut oil."),
]
u2q = [q(n, 'matching', p, a, e, PARA_AG, ev) for n, p, a, e, ev in M2]

N2 = [
    (20, ['molecules', 'the molecules'],
     "Câu tóm tắt nói “……của cellulose được tạo nên từ các loại đường”. Bài viết: PHÂN TỬ cellulose gồm các chuỗi đường. → molecules.",
     "Its molecules comprise chains of sugars strong enough to make plant cell walls."),
    (21, ['cell walls', 'the cell walls', 'cell wall', 'structural component', 'the structural component'],
     "Các chuỗi đường này đủ chắc để tạo nên THÀNH TẾ BÀO của cây (bài cũng gọi cellulose là “main structural component” của cây xanh). → cell walls.",
     "Cellulose is the main structural component of all green plants. / Its molecules comprise chains of sugars strong enough to make plant cell walls."),
    (22, ['ferment'],
     "Bài nói nếu phá vỡ được các phân tử đó để giải phóng đường thì có thể LÊN MEN chúng cho tới khi tạo ra ethanol. Sau “allowing them to” cần động từ nguyên thể. → ferment.",
     "If you could break down those molecules to release the sugars they contain, you could ferment them until ethanol is created."),
    (23, ['switchgrass', 'switch grass'],
     "Bài nêu switchgrass – một loài cỏ dại mọc khoẻ ở các bang miền đông và Trung Tây nước Mỹ, tức loài cây Bắc Mỹ phổ biến. → switchgrass.",
     "Developing such a process could open the door to many non-food materials such as switchgrass - a wild grass that thrives in the eastern states and Midwest of the US - straw, crop residues like stalks and hardwood chips."),
    (24, ['corn'],
     "Phe ủng hộ nói các vật liệu cellulose này cho lượng ethanol GẤP ĐÔI trên mỗi hecta so với NGÔ. → corn.",
     "Its supporters say these cellulose materials could deliver twice as much ethanol per hectare as corn, and do it using land that is today neither economically productive nor environmentally precious."),
    (25, ['environmentally'],
     "Bài nói phần đất đó hiện “neither economically productive nor ENVIRONMENTALLY precious” – tức không có giá trị về mặt MÔI TRƯỜNG. → environmentally.",
     "Its supporters say these cellulose materials could deliver twice as much ethanol per hectare as corn, and do it using land that is today neither economically productive nor environmentally precious."),
]
u2q += [q(n, 'note_completion', 'Question %d' % n, a, e, None, ev) for n, a, e, ev in N2]

OPT_26 = ['A Bioethanol made from sugar cane will be the cheapest fuel worldwide.',
          'B The US could become self-sufficient in biofuel made from corn.',
          'C A biofuel may be made in time which does not damage the environment.',
          'D Scientists agree that some form of bioethanol is the future for fuel.']
u2q.append(q(26, 'multiple_choice', 'What conclusion does the writer of the text come to?',
             OPT_26[2],
             "Câu kết của bài để ngỏ khả năng: NẾU các con số hợp lý thì hướng đi này có thể giúp ta thoát khỏi lệ thuộc dầu mỏ mà KHÔNG phải trả giá bằng Trái Đất – tức có thể làm ra nhiên liệu sinh học không phá môi trường. → C. Bẫy: D sai vì bài nói giới khoa học đang CHIA RẼ; B sai vì bài nói Mỹ cần tới 30% đất nông nghiệp chỉ để đạt mục tiêu 10%.",
             OPT_26,
             "If the numbers add up this could be the development that may yet deliver us from our dependence on oil, without costing us the Earth in the process."))

NOTE_BODY_2 = ("A major constituent of green plants is cellulose. The [[20]] of cellulose are made up of sugars. "
               "These form the [[21]] of plants. Ethanol could be produced by extracting the sugars and allowing "
               "them to [[22]]. One common North American plant that could be used in this method is [[23]]. "
               "Some scientists believe that this would be a more productive source of ethanol than [[24]]. "
               "Additionally, the source plant materials could be grown in ground which is not currently being "
               "used for agriculture and is not [[25]] valuable.")

unit2 = {
    'unitType': 'reading_passage', 'unitNumber': 2,
    'title': 'Passage 2 - Biofuels',
    'instructions': 'You should spend about 20 minutes on Questions 14-26, which are based on Reading Passage 2 below.',
    'content': P['p2']['content'], 'defaultTimeLimitMinutes': 20,
    'metadata': {
        'groupInstructions': {
            '14': ("Reading Passage 2 has seven paragraphs, A-G.\n"
                   "Which paragraph contains the following information?"),
            '20': ("Complete the summary below.\n"
                   "Choose NO MORE THAN TWO WORDS from the passage."),
            '26': "Choose the correct letter, A, B, C or D."},
        'groupTitles': {'20': 'Using Non-Food Crops to Make Biofuels'},
        'noteBody': NOTE_BODY_2},
    'questions': u2q,
}

# ============================================================ Passage 3
M3 = [
    (27, 'A business cannot rely on the success of one good innovation.', 'C',
     "Utterback nói một sáng tạo chỉ tạo ra thế độc quyền TẠM THỜI, vì đối thủ sẽ sao chép khi bằng sáng chế hết hạn, nên doanh nghiệp phải liên tục tìm cách đổi mới tiếp. → C (Utterback).",
     "Utterback’s (1994) concept of ‘dominant design’ provides insight into how an innovation can create a temporary monopoly situation that will weaken competitive forces; however, when an innovative product or service is launched, rivals typically begin to copy it (once patents run out). / Hence, it is necessary for the company to continuously seek further ways to innovate."),
    (28, 'A group approach is an effective way of generating innovation.', 'D',
     "Hargadorn và Sutton cho rằng dùng ĐỘI NHÓM để thu nhận và chia sẻ ý tưởng là một cách giữ cho ý tưởng sống – bước then chốt của quá trình đổi mới. → D.",
     "According to Hargadorn and Sutton, using teams to capture and share ideas is one method of keeping ideas alive - a key step in the innovation process."),
    (29, 'Employees are more creative in a culture that accepts failure.', 'E',
     "Kahn và Hirshorn nói con người bừng nở khi thấy AN TOÀN, còn lo sợ thì kìm hãm họ; muốn nhân viên dám mạo hiểm thì tổ chức phải CHẤP NHẬN THẤT BẠI. → E.",
     "According to psychologists Kahn and Hirshorn, people come alive when they feel safe. / It is threat and anxiety that inhibit them. / It would follow that in order for people in organizations to take risks, lack of success must be tolerated."),
    (30, 'Radical innovations will provide greater income than minor changes.', 'B',
     "Kirn và Mauborgne đưa số liệu: 14% lần ra mắt là đổi mới ĐỘT PHÁ nhưng mang lại 38% doanh thu và tới 61% lợi nhuận, vượt xa các cải tiến nhỏ. → B.",
     "The remaining 14% of launches - the real breakthrough innovations - generated 38% of total revenues and a huge 61% of total profits."),
    (31, 'Businesses with a structured approach to innovation are more likely to succeed.', 'D',
     "Bài dẫn Hargadorn & Sutton: những công ty GIỎI NHẤT là những công ty đã học được cách hệ thống hoá quy trình đổi mới. → D.",
     "The best companies have learned to systematize the process (Hargadorn & Sutton, 2000)."),
    (32, 'Innovation consists of a new idea combined with business potential.', 'A',
     "Afuah định nghĩa đổi mới là “invention plus commercialization” – phát minh CỘNG khả năng thương mại hoá. → A.",
     "Indeed, the very definition of innovation for Afuah (2003) is ‘invention plus commercialization.’"),
    (33, 'A business that concentrates on responding to clients’ needs may overlook the need for wider development.', 'C',
     "Utterback cảnh báo công ty quá chăm chăm làm hài lòng KHÁCH HÀNG có thể bỏ lỡ những thay đổi mang tính tiến hoá. → C.",
     "A potential disadvantage of this approach, according to Utterback, is that evolutionary change can be missed when companies are too focused on pleasing customers."),
]
u3q = [q(n, 'matching', p, a, e, EXPERTS, ev) for n, p, a, e, ev in M3]

E3 = [
    (34, 'Unfortunately the development of an organised innovation process ............', 'E',
     "Bài nói nhược điểm chính của quy trình đổi mới có cấu trúc là TỐC ĐỘ RA THỊ TRƯỜNG: càng nhiều quy trình thì quãng đường từ ý tưởng tới sản phẩm càng dài. → E.",
     "The primary disadvantage to having a structured innovation process is speed to market - the more structure, the longer the lead time is from idea to product."),
    (35, 'One of the most difficult issues in innovation ............', 'G',
     "Bài nói khía cạnh KHÓ NHẤT của mọi đổi mới là xác định khả năng bán được (marketability) của sản phẩm. → G.",
     "The most challenging aspect of any innovation is determining marketability."),
    (36, 'A company wanting to maintain a leading position in business ............', 'B',
     "Muốn giữ vị trí dẫn đầu thì công ty phải bám sát tuyến đầu đổi mới, và điều đó đòi hỏi cách làm DÀI HƠI cùng mức chấp nhận rủi ro tài chính cao – tức bỏ cả thời gian lẫn tiền bạc. → B.",
     "To guarantee a leadership position, they have to stay on the leading-edge of innovation. / This requires a long-term approach and a high tolerance for risk."),
    (37, 'A different approach to achieving innovation ............', 'I',
     "Một công ty theo chiến lược khác thường là “mua” đổi mới bằng cách thâu tóm công ty nhỏ hoặc HỢP TÁC với các công ty chuyên biệt. → I.",
     "One company actively pursues a rather unusual strategy of ‘acquiring’ innovation by purchasing other smaller companies or partnering with specialized companies."),
    (38, 'Getting staff to come up with new ideas ............', 'C',
     "Bài nói lôi kéo nhân viên vào việc nghĩ ý tưởng có thể đem lại lợi ích lớn với CHI PHÍ RẤT THẤP. → C.",
     "Involving employees in idea-generation can reap some large benefits at a very low cost."),
    (39, 'A recommendation for companies already committed to innovation ............', 'H',
     "Phần kết luận nhận xét ngay cả những công ty sáng tạo nhất cũng ĐẦU TƯ CHƯA ĐỦ vào NGHIÊN CỨU THỊ TRƯỜNG ở giai đoạn tinh chỉnh ý tưởng – hàm ý nên rót thêm tiền vào đó. → H.",
     "It is the authors’ perception that even the most innovative companies in the sample underinvest in market research during the concept refining phase."),
    (40, 'Problems experienced by companies participating in the study ............', 'F',
     "Bài nói hầu hết các “vấn đề” mà người tham gia nêu ra đều bắt nguồn từ việc NGẠI RỦI RO – ở cả nhân viên lẫn các hội đồng xét duyệt. → F.",
     "Most of the ‘problems’ cited by participants were due to a low tolerance for risk - by employees (what they would or would not say), and by committees (being afraid to invest money without knowing the return on investment)."),
]
u3q += [q(n, 'matching', p, a, e, ENDINGS, ev) for n, p, a, e, ev in E3]

unit3 = {
    'unitType': 'reading_passage', 'unitNumber': 3,
    'title': 'Passage 3 - A Comparative Study of Innovative Practices in Business',
    'instructions': 'You should spend about 20 minutes on Questions 27-40, which are based on Reading Passage 3 below.',
    'content': P['p3']['content'], 'defaultTimeLimitMinutes': 20,
    'metadata': {'groupInstructions': {
        '27': ("Look at the following theories (Questions 27-33) and the list of experts below.\n"
               "Match each theory with the correct expert A-E.\n"
               "Write the correct letter A-E in boxes 27-33 on your answer sheet.\n"
               "NB You may use any letter more than once.\n\n"
               "List of Experts\n"
               ":::box\n"
               "A Afuah\n"
               "B Kirn and Mauborgne\n"
               "C Utterback\n"
               "D Hargardorn and Sutton\n"
               "E Kahn and Hirshorn\n"
               ":::"),
        '34': ("Complete each sentence with the correct ending A-I below.\n"
               ":::box\n"
               "A can be to develop a sympathetic manufacturing environment.\n"
               "B must put time and money into innovation.\n"
               "C can be a very cost-effective way of achieving innovation.\n"
               "D may require a more sophisticated communication system.\n"
               "E may give rise to a lengthy period between initial concept and launch.\n"
               "F could be attributed to an unwillingness to accept risk.\n"
               "G can be to work out the saleability of a future product.\n"
               "H would be to put more money into the analysis of customer demand.\n"
               "I might involve collaboration with another company with particular expertise.\n"
               ":::")}},
    'questions': u3q,
}

data = {
    'title': 'IELTS Master - Reading Test 44',
    'skill': 'reading',
    'sourceLabel': 'IELTS Master - Reading Test 44',
    'description': 'Đề đọc IELTS Master Test 44: Trans Fatty Acids / Biofuels / A Comparative Study of Innovative Practices in Business.',
    'units': [unit1, unit2, unit3],
}

# ------------------------------------------------------------------ validator
KEY = {
    1: 'FALSE', 2: 'TRUE', 3: 'TRUE', 4: 'NOT GIVEN', 5: 'NOT GIVEN', 6: 'TRUE', 7: 'TRUE',
    8: 'food labels', 9: 'vegetable oils', 10: 'heart disease', 11: 'Department of Health',
    12: 'biscuits and crisps', 13: 'USA',
    14: 'D', 15: 'F', 16: 'B', 17: 'A', 18: 'E', 19: 'C',
    20: 'molecules', 21: 'cell walls', 22: 'ferment', 23: 'switchgrass', 24: 'corn', 25: 'environmentally',
    26: 'C',
    27: 'C', 28: 'D', 29: 'E', 30: 'B', 31: 'D', 32: 'A', 33: 'C',
    34: 'E', 35: 'G', 36: 'B', 37: 'I', 38: 'C', 39: 'H', 40: 'F',
}
errs = []
orders = [item['order'] for u in data['units'] for item in u['questions']]
if orders != list(range(1, 41)):
    errs.append('Thu tu cau sai: %s' % orders)

for u in data['units']:
    body = u['content'] + '\n' + (u['metadata'].get('noteBody') or '')
    for qq in u['questions']:
        n = qq['order']
        exp = KEY[n]
        ans = qq['answer']
        accepted = ans if isinstance(ans, list) else [ans]
        if qq['questionType'] == 'multiple_choice':
            accepted = [a.split()[0] for a in accepted]
        if exp.lower() not in [str(a).lower() for a in accepted]:
            errs.append('Q%d: dap an %s khong khop key %r' % (n, accepted, exp))
        if qq.get('options'):
            for a in (ans if isinstance(ans, list) else [ans]):
                if a not in qq['options']:
                    errs.append('Q%d: dap an %r khong nam trong options' % (n, a))
        if qq['questionType'] == 'note_completion' and ('[[%d]]' % n) not in body:
            errs.append('Q%d: thieu o [[%d]] trong noteBody' % (n, n))
        if not qq.get('explanation'):
            errs.append('Q%d: thieu giai thich' % n)
        if qq['answer'] != 'NOT GIVEN' and not qq.get('evidence'):
            errs.append('Q%d: thieu dan chung' % n)
        for piece in (qq.get('evidence') or '').split(' / '):
            if piece and piece not in u['content']:
                errs.append('Q%d: dan chung KHONG khop nguyen van: %s...' % (n, piece[:70]))

if errs:
    print('LOI:')
    for e in errs:
        print(' -', e)
    sys.exit(1)

json.dump(data, open('tmp/ielts_master_reading_test44.json', 'w', encoding='utf8'),
          ensure_ascii=False, indent=1)
print('OK: 3 phan, %d cau. Da ghi tmp/ielts_master_reading_test44.json' % len(orders))
