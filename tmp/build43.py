# -*- coding: utf-8 -*-
"""Dựng file JSON import cho IELTS Master Reading Test 43 (nguồn: Test 43.pdf + Answer Sheet - 43.docx)."""
import json, sys

P = json.load(open('tmp/_t43_passages.json', encoding='utf8'))

FIX = [('scholar- reformer', 'scholar-reformer'),
       ('post- secondary', 'post-secondary'),
       ('expert- novice', 'expert-novice'),
       ('By reattaching1 the tongue', 'By reattaching the tongue')]
for k in P:
    for a, b in FIX:
        P[k]['content'] = P[k]['content'].replace(a, b)

TFNG = ['TRUE', 'FALSE', 'NOT GIVEN']
BOX_5_13 = list('ABCDEFGHIJKLMN')
BOX_28_34 = list('ABCDEFGHIJKLM')


def q(order, qtype, prompt, answer, explanation, options=None, evidence=None):
    d = {'order': order, 'questionType': qtype, 'prompt': prompt, 'answer': answer,
         'explanation': explanation, 'points': 1}
    if options:
        d['options'] = options
    if evidence:
        d['evidence'] = evidence
    return d


# ---------------------------------------------------------------- Passage 1
OPT_1_4 = ['A Modernization of the school system',
           'B Establishment of a parliament',
           'C Focus on the study of Confucianism',
           'D Reorganization of the military',
           'E Abolition of elections',
           'F Improvement of farming',
           'G Initiation of foreign trade']
ANS_1_4 = [OPT_1_4[0], OPT_1_4[1], OPT_1_4[3], OPT_1_4[5]]
EV_1_4 = ' / '.join([
    "The edicts called for a universal school system with an emphasis on practical and Western studies rather than Neo-Confucian orthodoxy.",
    "K'ang also called for the establishment of a national parliamentary government, including popularly elected members and ministries.",
    "Military reform and the establishment of a new defense system as well as the modernization of agriculture and medicine were also on the agenda.",
])
EXP_1_4 = ("Bốn cải cách được nêu trong bài là A, B, D, F. A – bài nói các sắc lệnh đòi lập hệ thống trường học phổ thông, "
           "chú trọng môn thực hành và Tây học. B – K'ang kêu gọi lập quốc hội có nghị viên do dân bầu. "
           "D và F – cùng một câu nhắc tới cải cách quân đội, xây dựng hệ thống phòng thủ mới và hiện đại hoá nông nghiệp. "
           "Bẫy: C sai vì bài nói bớt Nho giáo chứ không đề cao; E sai vì bài nói bầu nghị viên chứ không bãi bỏ bầu cử; "
           "G sai vì chính sách “open door” là do các nước Đồng minh áp đặt SAU khi cải cách thất bại, không nằm trong kế hoạch.")

u1q = [q(n, 'multiple_choice',
         'What were some of the reforms planned during the One Hundred Days of Reform in China?',
         ANS_1_4, EXP_1_4, OPT_1_4, EV_1_4) for n in (1, 2, 3, 4)]

S = [
    (5, 'China ............ with Japan.', 'F',
     "Chỗ trống nối với “with Japan” nên phải là cụm động từ đi được với “with”. Bài mở đầu phần về Trung Quốc bằng việc nước này THUA cuộc chiến Trung – Nhật. → F (lost a war).",
     "After losing the Sino-Japanese war, the Emperor Guwangxu found his country to be in a major crisis."),
    (6, 'Emperor Guwangxu put K’ang Yu-wei ............', 'B',
     "Ngày 11/6/1898, hoàng đế giao phong trào cải cách cho K'ang và đặt ông nắm quyền điều hành chính phủ, tức giao cho ông PHỤ TRÁCH phong trào cải cách. → B (in charge of the reform movement).",
     "On June 11, 1898, Emperor Guwangxu entrusted the reform movement to K’ang and put the progressive scholar-reformer in control of the government."),
    (7, 'After June 11, 1898, the reforms ............', 'L',
     "Ngay sau ngày 11/6/1898, triều đình ban hành hàng loạt sắc lệnh – tức cải cách được KHỞI ĐỘNG. → L (were initiated). Bẫy: C (were voted in) sai vì đây là sắc lệnh của triều đình, không hề có chuyện bỏ phiếu.",
     "Within days, the imperial court issued a number of statutes related to the social and political structure of the nation."),
    (8, 'People throughout China ............', 'M',
     "Bài nói có sự PHẢN ĐỐI dữ dội ở mọi tầng lớp xã hội, chỉ 1 trong 15 tỉnh chịu thi hành sắc lệnh. → M (opposed the reforms).",
     "There was intense opposition to the reform at all levels of society, and only one in fifteen provinces made attempts to implement the edicts."),
    (9, 'Yuan Shikai and Empress Dowager Cixi ............', 'A',
     "Hai người này tổ chức đảo chính (coup d’etat) để hất hoàng đế và nhóm cải cách trẻ khỏi quyền lực – tức LẬT ĐỔ chính quyền sau khi cải cách được đưa ra. → A.",
     "Just three months after the reform had begun, a coup d’etat was organized by Yuan Shikai and Empress Dowager Cbd to force Guangxu and the young reformers out of power and into seclusion."),
    (10, 'The reforms ............ after September 21st.', 'E',
     "Sau ngày 21/9, các sắc lệnh mới bị BÃI BỎ và phe bảo thủ giành lại quyền lực. → E (were abolished).",
     "After September 21st, the new edicts were abolished, and the conservatives regained their power."),
    (11, 'Secret societies attacked ............', 'H',
     "Các hội kín bài ngoại và bài Cơ Đốc giáo càn quét miền bắc Trung Quốc, nhắm vào các tô giới NGOẠI QUỐC và cơ sở truyền giáo. → H (foreigners in China).",
     "Immediately following the conservative takeover, anti-foreign and anti-Christian secret societies tore through northern China, targeting foreign concessions and missionary facilities."),
    (12, 'European, U.S., and Japanese troops ............', 'K',
     "Liên quân gồm chín nước châu Âu cùng Mỹ và Nhật tiến vào Bắc Kinh; miền bắc Trung Quốc bị CHIẾM ĐÓNG và quân nước ngoài đóng lại trong biên giới. → K (occupied China).",
     "By August, an Allied force made up of armies from nine European nations as well as the United States and Japan entered Peking. / With little effort, north China was occupied, and foreign troops had stationed themselves inside the border."),
    (13, 'Eventually, the reforms ............', 'N',
     "Chỉ trong vòng một thập kỷ, triều đình lại cho thi hành phần lớn các biện pháp cải cách ban đầu – tức cải cách được TÁI LẬP. → N (were reestablished).",
     "Within a decade, the court ordered many of the original reform measures, including the modernization of the education and military systems."),
]
u1q += [q(n, 'matching', p, a, e, BOX_5_13, ev) for n, p, a, e, ev in S]

unit1 = {
    'unitType': 'reading_passage', 'unitNumber': 1,
    'title': 'Passage 1 - One Hundred Days of Reform',
    'instructions': 'You should spend about 20 minutes on Questions 1-13, which are based on Reading Passage 1 below.',
    'content': P['p1']['content'], 'defaultTimeLimitMinutes': 20,
    'metadata': {'groupInstructions': {
        '1': ("What were some of the reforms planned during the One Hundred Days of Reform in China?\n"
              "Choose four answers from the list below, and write the correct letters, A-G, in boxes 1-4 on your Answer Sheet.\n"
              ":::box\n" + '\n'.join(OPT_1_4) + "\n:::"),
        '5': ("Complete the sentences below about the reading passage.\n"
              "Choose your answers from the box below, and write them in boxes 5-13 on your Answer Sheet.\n"
              "There are more choices than spaces, so you will not use them all.\n"
              ":::box\n"
              "A overthrew the government after the reforms were introduced\n"
              "B in charge of the reform movement\n"
              "C were voted in\n"
              "D in prison\n"
              "E were abolished\n"
              "F lost a war\n"
              "G began trade\n"
              "H foreigners in China\n"
              "I were executed\n"
              "J reform supporters\n"
              "K occupied China\n"
              "L were initiated\n"
              "M opposed the reforms\n"
              "N were reestablished\n"
              ":::")}},
    'questions': u1q,
}

# ---------------------------------------------------------------- Passage 2
C = [
    (14, 'Its root cause is a blockage at the trachea.', 'A',
     "Bài nói ngưng thở tắc nghẽn (OSA) xảy ra do đường thở trên bị TẮC; hơi thở dừng khi không khí bị chặn không vào được khí quản (trachea). → A.",
     "Obstructive sleep apnea (OSA), which affects 90 percent of sleep apnea sufferers, occurs because of an upper airway obstruction. / A person’s breathing stops when air is somehow prevented from entering the trachea."),
    (15, 'It is connected exclusively with the nervous system.', 'B',
     "Bài giải thích chữ “central” là vì loại này liên quan tới HỆ THẦN KINH TRUNG ƯƠNG chứ không phải tắc luồng khí. → B.",
     "The term central is used because this type of apnea is related to the central nervous system rather than the blocked airflow."),
    (16, 'It involves blocked airflow and a brain malfunction.', 'C',
     "Vừa tắc luồng khí vừa trục trặc ở não nghĩa là KẾT HỢP cả hai loại trên – đó chính là mixed apnea. → C.",
     "The third type of sleep apnea, known as mixed apnea, is a combination of the two and is the most rare form."),
    (17, 'It is the most unusual type of sleep apnea.', 'C',
     "“Most unusual” ở đây nghĩa là hiếm gặp nhất. Bài nói mixed apnea là dạng HIẾM NHẤT (the most rare form). → C.",
     "The third type of sleep apnea, known as mixed apnea, is a combination of the two and is the most rare form."),
    (18, 'It is the most common form of sleep apnea.', 'A',
     "Ngay câu mở đoạn, bài nói trong ba loại thì ngưng thở tắc nghẽn là PHỔ BIẾN NHẤT (chiếm 90% người bệnh). → A.",
     "There are three different types of sleep apnea, with obstructive sleep apnea being the most common."),
]
u2q = [q(n, 'matching', p, a, e, ['A', 'B', 'C'], ev) for n, p, a, e, ev in C]

T = [
    (19, 'Sleep apnea only affects men over 40.', 'FALSE',
     "Thừa cân, là nam và trên 40 tuổi chỉ là các YẾU TỐ NGUY CƠ; ngay sau đó bài nói bệnh này CÓ THỂ gặp ở trẻ em. Chữ “only” làm câu này mâu thuẫn với bài. → FALSE.",
     "Sleep apnea is associated with a number of risk factors, including being overweight, male, and over the age of forty. / However, like many disorders, sleep apnea can affect children and in many cases is found to be the result of a person’s genetic makeup."),
    (20, 'Most people with sleep apnea have the problem diagnosed.', 'FALSE',
     "Bài nói ngược lại: tuy rất phổ biến nhưng rối loạn này THƯỜNG KHÔNG được chẩn đoán, nhiều người mang triệu chứng cả đời mà không biết. → FALSE.",
     "Despite being so widespread, this disorder often goes undiagnosed."),
    (21, 'Often a relative of the sleep apnea sufferer is the first to notice the problem.', 'TRUE',
     "Bài nói người phát hiện ra các đợt ngắt quãng giấc ngủ thường KHÔNG phải chính người bệnh, mà là bạn đời hoặc NGƯỜI NHÀ nằm gần. → TRUE.",
     "Oftentimes, it is not the person suffering from sleep apnea who notices the repetitive episodes of sleep interruption, but a partner or family member sleeping nearby."),
    (22, 'Sleep apnea is more common in Greece than in other countries.', 'NOT GIVEN', None, None),
    (23, 'Sleep apnea can cause problems at work.', 'TRUE',
     "Bài nói ngưng thở khi ngủ bị quy trách nhiệm cho nhiều vụ lái xe kém an toàn và HIỆU SUẤT LÀM VIỆC KÉM. → TRUE.",
     "Sleep apnea is also blamed for many cases of impaired driving and poor job performance."),
]
NG_EXP_22 = ("Bài chỉ nói chữ “apnea” có GỐC Hy Lạp, nghĩa là “không thở” – đó là chuyện từ nguyên, "
             "hoàn toàn không nói gì về TỶ LỆ mắc bệnh ở Hy Lạp so với các nước khác. Không có thông tin để kết luận. → NOT GIVEN.")
for n, p, a, e, ev in T:
    if a == 'NOT GIVEN':
        u2q.append(q(n, 'true_false_not_given', p, a, NG_EXP_22, TFNG))
    else:
        u2q.append(q(n, 'true_false_not_given', p, a, e, TFNG, ev))

OPT_24_27 = ["A getting surgery", "B wearing a mask", "C taking sleeping pills",
             "D reducing one's weight", "E massaging the throat muscles",
             "F sleeping on one’s side", "G drinking moderate amounts of alcohol"]
ANS_24_27 = [OPT_24_27[0], OPT_24_27[1], OPT_24_27[3], OPT_24_27[5]]
EV_24_27 = ' / '.join([
    "In many cases, symptoms of sleep apnea can be eliminated when patients try losing weight or abstaining from alcohol.",
    "People who sleep on their backs or stomachs often find that their symptoms disappear if they try sleeping on their sides.",
    "When these treatments prove unsuccessful, sleep apnea sufferers can be fitted with a CPAP mask, which is worn at night over the mouth and nose, similar to an oxygen mask.",
    "In extreme cases, especially when facial deformities are the cause of the sleep apnea, surgery is needed to make a clear passage for the air.",
])
EXP_24_27 = ("Bốn cách chữa được nhắc tới là A, B, D, F. D – giảm cân; F – nằm nghiêng thay vì nằm ngửa hoặc nằm sấp; "
             "B – đeo mặt nạ CPAP khi các cách trên không hiệu quả; A – phẫu thuật trong ca nặng. "
             "Bẫy: C sai hoàn toàn vì bài khuyên BỎ thuốc ngủ (thuốc ngủ làm rối loạn hoạt động cơ họng và miệng); "
             "G sai vì bài khuyên KIÊNG rượu chứ không phải uống vừa phải; E không hề được nhắc tới.")
u2q += [q(n, 'multiple_choice', 'Which treatments for sleep apnea are mentioned in the passage?',
          ANS_24_27, EXP_24_27, OPT_24_27, EV_24_27) for n in (24, 25, 26, 27)]

unit2 = {
    'unitType': 'reading_passage', 'unitNumber': 2,
    'title': 'Passage 2 - Sleep Apnea',
    'instructions': 'You should spend about 20 minutes on Questions 14-27, which are based on Reading Passage 2 below.',
    'content': P['p2']['content'], 'defaultTimeLimitMinutes': 20,
    'metadata': {'groupInstructions': {
        '14': ("The passage describes three different types of sleep apnea.\n"
               "Which of the characteristics below belongs to which type of sleep apnea?\n"
               "In boxes 14-18 on your Answer Sheet, write\n"
               ":::box\n"
               "A if it is a characteristic of obstructive sleep apnea.\n"
               "B if it is a characteristic of central sleep apnea.\n"
               "C if it is a characteristic of mixed apnea.\n"
               ":::"),
        '19': ("Do the following statements agree with the information in Reading Passage 2?\n"
               "In boxes 19-23 on your Answer Sheet, write\n"
               ":::box\n"
               "TRUE if the statement is true according to the passage.\n"
               "FALSE if the statement contradicts the passage.\n"
               "NOT GIVEN if there is no information about this in the passage.\n"
               ":::"),
        '24': ("Which treatments for sleep apnea are mentioned in the passage?\n"
               "Choose four answers from the list below, and write the correct letters, A-G, in boxes 24-27 on your Answer Sheet.\n"
               ":::box\n" + '\n'.join(OPT_24_27) + "\n:::")}},
    'questions': u2q,
}

# ---------------------------------------------------------------- Passage 3
G = [
    (28, 'The psychological method of intelligence assessment measures ............', 'H',
     "Bài định nghĩa psychological method là phương pháp tập trung vào CÁC QUÁ TRÌNH TRÍ TUỆ như trí nhớ và suy luận trừu tượng. → H (thought processes). Bẫy: F (knowledge) là của pedagogical method – đo cái người ta BIẾT.",
     "These were the psychological method (which concentrates mostly on intellectual processes, such as memory and abstract reasoning) and the pedagogical method (which concentrates on assessing what an individual knows)."),
    (29, 'Binet and Simon wanted to develop an assessment method that was not influenced by the child’s ............', 'J',
     "Bài nói mối bận tâm chính của hai ông là dự đoán kết quả học tiểu học ĐỘC LẬP với hoàn cảnh xã hội và kinh tế của học sinh. → J (social class).",
     "The main concern of Binet and Simon was to predict elementary school performance independently from the social and economic background of the individual student."),
    (30, 'The Binet-Simon tests have been successfully used to predict ............', 'D',
     "Bài nói các bài trắc nghiệm Binet-Simon RẤT hiệu quả trong việc dự đoán thành công ở bậc tiểu học và trung học – tức tiềm năng học tập ở trường. → D (potential for achievement in school).",
     "The Binet-Simon tests are quite effective in predicting school success in both primary and secondary educational environments."),
    (31, 'The Binet-Simon tests are not good predictors of ............', 'L',
     "Ngay câu sau, bài nói chúng KÉM hiệu quả trong việc dự đoán thành công ở bậc sau phổ thông và trong lĩnh vực NGHỀ NGHIỆP. → L (future job performance).",
     "However, they have been found to be much less predictive of success in post-secondary academic and occupational domains."),
    (32, 'According to ............, the pedagogical method is the best way to assess adult intelligence.', 'I',
     "Câu nói nghiên cứu gần đây cho rằng trí tuệ người lớn nên được đo bằng pedagogical method có dẫn nguồn (Ackerman, 1996; Gregory, 1994). → I (Ackerman and Gregory). Bẫy: K (recent research) nghe hợp lý nhưng câu hỏi dùng “according to” nên cần TÊN người nghiên cứu.",
     "Recent research across the fields of education, cognitive science, and adult development suggests that much of adult intellect is indeed not adequately sampled by extant intelligence measures and might be better assessed through the pedagogical method (Ackerman, 1996; Gregory, 1994)."),
    (33, 'The pedagogical method is a better measure of adult intelligence because most problems that adults encounter in real life are not completely ............', 'C',
     "Bài nói khó khăn của việc đo trí tuệ người lớn nằm ở chỗ trong đời thực họ HIẾM KHI gặp vấn đề hoàn toàn MỚI LẠ (novel). → C (new).",
     "The dilemma for adult intellectual assessment is that the adult is rarely presented with a completely novel problem in the real world of academic or occupational endeavors."),
    (34, 'In the area of artificial intelligence, ............ systems are preferred.', 'E',
     "Giới trí tuệ nhân tạo đã từ bỏ ý tưởng về một bộ giải quyết vấn đề tổng quát để chuyển sang các hệ chuyên gia DỰA TRÊN TRI THỨC. → E (knowledge-based).",
     "From the artificial intelligence field, researchers have discarded the idea of a useful general problem solver in favor of knowledge-based expert systems."),
]
u3q = [q(n, 'matching', p, a, e, BOX_28_34, ev) for n, p, a, e, ev in G]

T3 = [
    (35, 'The Binet-Simon tests have not changed significantly over the years.', 'TRUE',
     "Bài nói hai ông đã tạo ra một mô hình đánh giá trí thông minh mà tới nay VỀ CƠ BẢN KHÔNG THAY ĐỔI so với các bài trắc nghiệm gốc. → TRUE.",
     "As a result, they settled on the psychological method, and they spawned an intelligence assessment paradigm, which has been substantially unchanged from their original tests."),
    (36, 'Success in elementary school is a predictor of success in college.', 'FALSE',
     "Bài nói các bài trắc nghiệm này KÉM hiệu quả trong việc dự đoán thành công ở bậc sau phổ thông (tức đại học), ngược hẳn với nhận định của câu hỏi. → FALSE.",
     "However, they have been found to be much less predictive of success in post-secondary academic and occupational domains."),
    (37, 'Research suggests that experts generally have more developed intellectual processes than novices.', 'FALSE',
     "Bài nói chuyên gia khác người mới chủ yếu ở KINH NGHIỆM và cấu trúc tri thức tích luỹ được, CHỨ KHÔNG PHẢI ở các quá trình trí tuệ. → FALSE.",
     "One line of relevant educational research is from the examination of expert-novice differences which indicates that the typical expert is found to mainly differ from the novice in terms of experience and the knowledge structures that are developed through that experience rather than in terms of intellectual processes (e.g., Glaser, 1991)."),
    (38, 'Knowledge structures in adults decrease with age.', 'FALSE',
     "Cái SUY GIẢM theo tuổi là các thước đo QUÁ TRÌNH (process measures), còn cấu trúc TRI THỨC lại là thứ quyết định phần lớn hoạt động trí tuệ của người lớn. Câu hỏi đảo ngược hai vế. → FALSE.",
     "Additional research from developmental and gerontological perspectives has also shown that various aspects of adult intellectual functioning are greatly determined by knowledge structures and less influenced by the kinds of process measures, which have been shown to decline with age over adult development (e.g., Schooler, 1987; Willis & Tosti-Vasey, 1990)."),
    (39, 'Better methods of measuring adult intelligence need to be developed.', 'TRUE',
     "Đoạn cuối kết luận rõ các phương pháp đánh giá trí tuệ người lớn hiện nay là KHÔNG ĐỦ, và thách thức sắp tới là xây dựng những bộ trắc nghiệm mới. → TRUE.",
     "By bringing together a variety of sources of research evidence, it is clear that our current methods of assessing adult intellect are insufficient."),
]
u3q += [q(n, 'true_false_not_given', p, a, e, TFNG, ev) for n, p, a, e, ev in T3]

OPT_40 = ['A thought processes', 'B job skills', 'C knowledge']
u3q.append(q(40, 'multiple_choice',
             'The Advanced Placement and College Level Exam Program tests measure',
             'C knowledge',
             "Bài nói khi đem TRI THỨC của người lớn ra khảo sát rộng bằng những bài như AP và CLEP thì mới có thể dự đoán tốt hơn kết quả học tập của họ – tức hai bài này đo TRI THỨC. → C. Bẫy: A là thứ mà psychological method (Binet-Simon) đo, không phải AP/CLEP.",
             OPT_40,
             "When adult knowledge structures are broadly examined with tests such as the Advanced Placement [AP] -and College Level Exam Program [CLEP], it may be possible to improve such things as the prediction of adult performance in specific educational endeavors, the placement of individuals, and adult educational counseling."))

unit3 = {
    'unitType': 'reading_passage', 'unitNumber': 3,
    'title': 'Passage 3 - Adult Intelligence',
    'instructions': 'You should spend about 20 minutes on Questions 28-40, which are based on Reading Passage 3 below.',
    'content': P['p3']['content'], 'defaultTimeLimitMinutes': 20,
    'metadata': {'groupInstructions': {
        '28': ("Complete the sentences below about the reading passage.\n"
               "Choose your answers from the box below, and write them in boxes 28-34 on your Answer Sheet.\n"
               "There are more choices than sentences so you will not use them all.\n"
               ":::box\n"
               "A tests\nB psychological issues\nC new\n"
               "D potential for achievement in school\nE knowledge-based\nF knowledge\n"
               "G Binet and Simon\nH thought processes\nI Ackerman and Gregory\n"
               "J social class\nK recent research\nL future job performance\n"
               "M problem solving\n:::"),
        '35': ("Do the following statements agree with the information in Reading Passage 3?\n"
               "In boxes 35-39 on your Answer Sheet, write\n"
               ":::box\n"
               "TRUE if the statement is true according to the passage.\n"
               "FALSE if the statement contradicts the passage.\n"
               "NOT GIVEN if there is no information about this in the passage.\n"
               ":::"),
        '40': "Choose the correct letter, A-C, and write it in box 40 on your Answer Sheet."}},
    'questions': u3q,
}

data = {
    'title': 'IELTS Master - Reading Test 43',
    'skill': 'reading',
    'sourceLabel': 'IELTS Master - Reading Test 43',
    'description': 'Đề đọc IELTS Master Test 43: One Hundred Days of Reform / Sleep Apnea / Adult Intelligence.',
    'units': [unit1, unit2, unit3],
}

# ------------------------------------------------------------------ validator
KEY = ('A B D F F B L M A E H K N A B C C A FALSE FALSE TRUE NOT_GIVEN TRUE A B D F '
       'H J D L I C E TRUE FALSE FALSE FALSE TRUE C').split()
errs = []
orders = [item['order'] for u in data['units'] for item in u['questions']]
if orders != list(range(1, 41)):
    errs.append('Thứ tự câu sai: %s' % orders)

for u in data['units']:
    for qq in u['questions']:
        n = qq['order']
        exp = KEY[n - 1].replace('_', ' ')
        ans = qq['answer']
        if isinstance(ans, list):
            letters = [a.split()[0] for a in ans]
            if exp not in letters:
                errs.append('Q%d: dap an %s khong chua %s' % (n, letters, exp))
        else:
            got = ans.split()[0] if qq['questionType'] == 'multiple_choice' else ans
            if got != exp:
                errs.append('Q%d: dap an %r != key %r' % (n, got, exp))
        if qq.get('options'):
            for a in (ans if isinstance(ans, list) else [ans]):
                if a not in qq['options']:
                    errs.append('Q%d: dap an %r khong nam trong options' % (n, a))
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

json.dump(data, open('tmp/ielts_master_reading_test43.json', 'w', encoding='utf8'),
          ensure_ascii=False, indent=1)
print('OK: 3 phan, %d cau. Da ghi tmp/ielts_master_reading_test43.json' % len(orders))
