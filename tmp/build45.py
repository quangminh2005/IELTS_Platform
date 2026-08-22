# -*- coding: utf-8 -*-
"""Dựng file JSON import cho IELTS Master Reading Test 45 (nguồn: Test 45.pdf + Answer Sheet - 45.docx)."""
import json, sys

P = json.load(open('tmp/_t45_passages.json', encoding='utf8'))

# vá các chỗ PDF vắt dòng giữa từ ghép
FIX = ['urban- planning', 'well- being', 'high- rise', 'sector- wide', 'two- week']
for k in P:
    for bad in FIX:
        P[k]['content'] = P[k]['content'].replace(bad, bad.replace('- ', '-'))

TFNG = ['TRUE', 'FALSE', 'NOT GIVEN']
HEADINGS = ['i The influence of the seasons on productivity',
            'ii A natural way to anger management',
            'iii Natural building materials promote health',
            'iv Learning from experience in another field',
            'v Stimulating the brain through internal design features',
            'vi Current effects on the species of ancient experiences',
            'vii Uniformity is not the answer',
            'viii The negative effects of restricted spaces',
            'ix Improving occupational performance',
            'x The modern continuation of ancient customs']
THEORIES = list('ABCDEFGHI')


def q(order, qtype, prompt, answer, explanation, options=None, evidence=None):
    d = {'order': order, 'questionType': qtype, 'prompt': prompt, 'answer': answer,
         'explanation': explanation, 'points': 1}
    if options:
        d['options'] = options
    if evidence:
        d['evidence'] = evidence
    return d


# ============================================================ Passage 1
OPT_1_3 = ['A They tend to lead the way in terms of fashion.',
           'B Their population has ceased to expand.',
           'C They reached their peak in the second half of the twentieth century.',
           'D 50 per cent of the world’s inhabitants now live in them.',
           'E They grew rich on the profits from manufacturing industry.',
           'F Their success begins to work against them at a certain stage.',
           'G It is no longer automatically advantageous to base a company there.']
ANS_1_3 = [OPT_1_3[1], OPT_1_3[5], OPT_1_3[6]]
EV_1_3 = ' / '.join([
    "The typical growth rate of the population within a megacity has slowed from more than eight per cent in the 1980s to less than half that over the last five years, and numbers are expected to be static in the next quarter century.",
    "‘Economically, after a city reaches a certain size its productivity starts to fall,’ notes Mario Pezzini, head of the regional-competitiveness division of the OECD.",
    "While more financial deals are done now in big capitals like New York and London than ever before, it is also clear that plenty of booming service industries are leaving for ‘Rising Urban Stars’ like Dubai, Montpellier and Cape Town.",
])
EXP_1_3 = ("Ba ý đúng là B, F, G. B – bài nói tốc độ tăng dân số của siêu đô thị đã chậm lại còn chưa tới một nửa mức thập niên 1980 "
           "và dự kiến ĐỨNG YÊN trong 25 năm tới. F – Mario Pezzini nói khi thành phố vượt một quy mô nhất định thì NĂNG SUẤT BẮT ĐẦU GIẢM, "
           "tức chính thành công lại quay ra hại nó. G – dù giao dịch tài chính vẫn dồn về New York hay London, nhiều ngành dịch vụ đang RỜI ĐI "
           "sang các \"Rising Urban Stars\" như Dubai hay Cape Town. "
           "Bẫy: C sai vì bài nói \"thời của họ\" là 50 năm QUA, kéo sang cả thế kỷ 21; D sai vì bài nói một nửa dân đô thị sống ở nơi DƯỚI nửa triệu dân, "
           "chứ không phải một nửa dân số thế giới sống trong siêu đô thị; E sai vì bài nói họ giàu lên nhờ ngành công nghệ cao và tài chính, không phải chế tạo.")
u1q = [q(n, 'multiple_choice',
         'Which THREE of the following statements are true of megacities, according to the text?',
         ANS_1_3, EXP_1_3, OPT_1_3, EV_1_3) for n in (1, 2, 3)]

OPT_4_6 = ['A the existence of support services for foreign workers',
           'B the provision of cheap housing for older people',
           'C the creation of efficient access routes',
           'D the ability to attract financial companies',
           'E the expertise to keep up with electronic developments',
           'F the maintenance of a special local atmosphere',
           'G the willingness to imitate international-style architecture']
ANS_4_6 = [OPT_4_6[2], OPT_4_6[4], OPT_4_6[5]]
EV_4_6 = ' / '.join([
    "One key is excellent transport links, especially to the biggest commercial centres.",
    "These places have not only improved their Internet backbones, but often have technical institutes and universities that turn out the kinds of talent that populate growth industries.",
    "Italy, for example, is trying to create tourist hubs of towns close to each other with distinctive buildings and offering different yet complementary cultural activities.",
])
EXP_4_6 = ("Ba lý do được nêu là C, E, F. C – bài nói chìa khoá là ĐƯỜNG GIAO THÔNG tốt tới các trung tâm thương mại lớn (Goyang cách Seoul 30 phút tàu điện ngầm). "
           "E – các thành phố này nâng cấp hạ tầng Internet và có trường kỹ thuật, đại học đào tạo nhân lực cho ngành công nghệ. "
           "F – Montpellier hút người vì nhịp sống thong thả hơn, còn Ý thì gây dựng các cụm đô thị có KIẾN TRÚC RIÊNG và hoạt động văn hoá bổ trợ nhau. "
           "Bẫy: G ngược hẳn với bài (bài nhấn mạnh nét RIÊNG chứ không bắt chước kiến trúc quốc tế); D sai vì bài nói giao dịch tài chính vẫn ở lại các thủ đô lớn; "
           "A và B không hề được nhắc tới.")
u1q += [q(n, 'multiple_choice',
          'Which THREE of these reasons are mentioned by the writer of the text?',
          ANS_4_6, EXP_4_6, OPT_4_6, EV_4_6) for n in (4, 5, 6)]

N1 = [
    (7, ['F', 'F service industries', 'service industries'],
     "Chỗ trống cần chủ thể đang rời bỏ mặt bằng đắt đỏ ở siêu đô thị. Bài nói nhiều NGÀNH DỊCH VỤ đang ăn nên làm ra chuyển tới Dubai, Montpellier, Cape Town. → F.",
     "While more financial deals are done now in big capitals like New York and London than ever before, it is also clear that plenty of booming service industries are leaving for ‘Rising Urban Stars’ like Dubai, Montpellier and Cape Town."),
    (8, ['R', 'R university', 'university'],
     "Nơi cung cấp lực lượng lao động có tay nghề: bài nói Montpellier vốn đã có một TRƯỜNG ĐẠI HỌC mạnh. → R. Bẫy: I (infrastructure) nghe hợp nhưng không phải thứ đào tạo nhân lực.",
     "Until the 1980s, it was like a big Mediterranean village, but one with a strong university, many lovely villas and an IBM manufacturing base."),
    (9, ['G', 'G capital', 'capital'],
     "Khách tới Montpellier là dân PARIS – tức từ THỦ ĐÔ. → G.",
     "Once the high-speed train lines were built, Parisians began pouring in for weekend breaks."),
    (10, ['H', 'H high speed train', 'high speed train'],
     "Thứ giúp ngày càng nhiều người tới nghỉ ngắn ngày là các tuyến TÀU CAO TỐC được xây xong. → H.",
     "Once the high-speed train lines were built, Parisians began pouring in for weekend breaks."),
    (11, ['O', 'O amenities', 'amenities'],
     "Để phục vụ lớp chuyên gia mới đến, thành phố bắt tay xây dựng các TIỆN ÍCH: nhà hát opera, tuyến tàu điện. → O.",
     "To cater to the incoming professionals, the city began building amenities: an opera house, a tram line to discourage cars in the city centre."),
    (12, ['M', 'M professionals', 'professionals'],
     "Nhóm thích nhịp sống thong thả và mua nhà ở đây là tầng lớp CHUYÊN GIA trung lưu. → M. Bẫy: P (middle age) chỉ na ná chữ \"middle-class\" chứ bài không nói tuổi tác.",
     "Some bought houses, creating a critical mass of middle-class professionals who began taking advantage of flexible working systems to do three days in Paris, and two down South, where things seemed less pressured."),
    (13, ['C', 'C flexible', 'flexible'],
     "Họ tận dụng chế độ làm việc LINH HOẠT của công ty để ở Paris ba ngày, ở miền Nam hai ngày. → C. Bẫy: Q (overtime) không hề được nhắc tới.",
     "Some bought houses, creating a critical mass of middle-class professionals who began taking advantage of flexible working systems to do three days in Paris, and two down South, where things seemed less pressured."),
]
u1q += [q(n, 'note_completion', 'Question %d' % n, a, e, None, ev) for n, a, e, ev in N1]

NOTE_BODY_1 = ("It is becoming increasingly obvious that large numbers of [[7]] are giving up their expensive "
               "premises in the megacities and relocating to smaller cities like Montpellier. One of the "
               "attractions of Montpellier is the presence of a good [[8]] that can provide them with the "
               "necessary skilled workforce.\n\n"
               "Another important factor for Montpellier was the arrival of visitors from the [[9]]. The "
               "introduction of the [[10]] meant that increasing numbers were able to come for short stays. "
               "Of these, a significant proportion decided to get a base in the city. The city council soon "
               "realised that they needed to provide appropriate [[11]] for their new inhabitants. In fact, "
               "the [[12]] among them liked the more relaxed lifestyle so much that they took advantage of "
               "any [[13]] arrangements offered by their firms to spend more of the week in Montpellier.")

unit1 = {
    'unitType': 'reading_passage', 'unitNumber': 1,
    'title': 'Passage 1 - Unlikely Boomtowns: The World’s Hottest Cities',
    'instructions': 'You should spend about 20 minutes on Questions 1-13, which are based on Reading Passage 1 below.',
    'content': P['p1']['content'], 'defaultTimeLimitMinutes': 20,
    'metadata': {
        'groupInstructions': {
            '1': ("Choose THREE letters, A-G.\n"
                  "Write your answers in boxes 1-3 on your answer sheet.\n"
                  "Which THREE of the following statements are true of megacities, according to the text?\n"
                  ":::box\n" + '\n'.join(OPT_1_3) + "\n:::"),
            '4': ("Choose THREE letters, A-G.\n"
                  "Write your answers in boxes 4-6 on your answer sheet.\n"
                  "The list below gives some possible reasons why small towns can turn into successful Second Cities.\n"
                  "Which THREE of these reasons are mentioned by the writer of the text?\n"
                  ":::box\n" + '\n'.join(OPT_4_6) + "\n:::"),
            '7': ("Complete the summary using the list of words A-R below.\n"
                  "Write the correct letter, A-R, in boxes 7-13 on your answer sheet.\n"
                  ":::box\n"
                  "A urban centres | B finance companies | C flexible | D tram line\n"
                  "E cosmopolitan | F service industries | G capital | H high speed train\n"
                  "I infrastructure | J unskilled workers | K jobs | L medical technology\n"
                  "M professionals | N European Union | O amenities | P middle age\n"
                  "Q overtime | R university\n"
                  ":::")},
        'groupTitles': {'7': 'Urban Decentralisation'},
        'noteBody': NOTE_BODY_1},
    'questions': u1q,
}

# ============================================================ Passage 2
H2 = [
    (14, 'Paragraph A', HEADINGS[3],
     "Đoạn A đặt câu hỏi về không gian toà nhà rồi bảo muốn tìm gợi ý thì hãy nhìn sang VƯỜN THÚ – tức học hỏi kinh nghiệm từ một lĩnh vực khác. → iv.",
     "For insights, it is useful to look not at buildings, but at zoos."),
    (15, 'Paragraph B', HEADINGS[7],
     "Đoạn B kể chuyện thú bị NHỐT CHUỒNG sinh ra hành vi bất thường, điển hình là con gấu trắng bơi vòng số 8 cả ngày trong bể nhỏ vì buồn chán. → viii.",
     "Caged animals often exhibit neurotic behaviors—pacing, repetitive motions, aggression, and withdrawal."),
    (16, 'Paragraph C', HEADINGS[5],
     "Đoạn C trình bày \"giả thuyết thảo nguyên\": vì loài người tiến hoá ở đồng cỏ châu Phi nên tới nay vẫn thích những cảnh quan mang đặc điểm đó – quá khứ xa xưa còn để dấu trên tâm lý loài. → vi.",
     "Although humans now live in many different habitats, Orians argues that our species’ long history as mobile hunters and gatherers on the African savannahs should have left its mark on our psyche."),
    (17, 'Paragraph D', HEADINGS[9],
     "Đoạn D nối tập tục quây quần bên đống lửa thời săn bắt hái lượm với bếp ăn gia đình và quán cà phê ngày nay – tức tập tục cổ xưa vẫn TIẾP DIỄN dưới hình thức hiện đại. → x.",
     "Today’s hearth is the family kitchen at home, and the community places, such as cafes and coffee bars, where people increasingly congregate to eat, talk, read and work."),
    (18, 'Paragraph E', HEADINGS[8],
     "Đoạn E dẫn hàng loạt nghiên cứu cho thấy gần gũi thiên nhiên giúp tập trung tốt hơn và LÀM VIỆC VĂN PHÒNG hiệu quả hơn. → ix.",
     "People in their study who went for a walk in a predominantly natural setting achieved better on several office tasks requiring concentration than those who walked in a predominantly built setting or who quietly read a magazine indoors."),
    (19, 'Paragraph F', HEADINGS[1],
     "Đoạn F nói cây xanh ngoài trời LÀM DỊU tính hung hăng ở các khu chung cư cao tầng – tức một cách trị nóng giận bằng thiên nhiên. → ii.",
     "For instance, Francis Kuo found that outdoor nature buffers aggression in urban high-rise settings and enhances ability to deal with demanding circumstances."),
    (20, 'Paragraph G', HEADINGS[6],
     "Đoạn G phê phán lối thiết kế \"một cỡ vừa cho tất cả\", vì mỗi người mỗi khác nên cần cho họ tự điều chỉnh ánh sáng, nhiệt độ. → vii.",
     "Yet buildings continue to be designed with a “one size fits all” approach."),
]
u2q = [q(n, 'matching', p, a, e, HEADINGS, ev) for n, p, a, e, ev in H2]

M2 = [
    (21, 'Gordon Orians', 'I',
     "Orians lập luận con người thích những cảnh quan mang đặc điểm của đồng cỏ châu Phi – NƠI LOÀI NGƯỜI ĐƯỢC CHO LÀ ĐÃ TIẾN HOÁ. → I.",
     "Drawing on habitat selection theory, ecologist Gordon Orians argues that humans are psychologically adapted to and prefer landscape features that characterized the African plain or savannah, the presumed site of human evolution."),
    (22, 'Melvin Konner', 'H',
     "Konner cho rằng cảm giác an toàn và thân mật bên đống lửa có thể đã góp phần vào sự phát triển TRÍ TUỆ lẫn gắn kết xã hội – tức não người phát triển một phần nhờ thường xuyên quây quần với đồng loại. → H.",
     "According to anthropologist Melvin Konner, the sense of safety and intimacy associated with the campfire may have been a factor in the evolution of intellectual progression as well as social bonds."),
    (23, 'Roger Ulrich', 'F',
     "Ulrich chứng minh chỉ cần NGẮM thiên nhiên qua cửa sổ đã giúp tâm trạng tích cực hơn. → F.",
     "For instance, research by Roger Ulrich consistently shows that passive viewing of nature through windows promotes positive moods."),
    (24, 'Stephen Kaplan', 'C',
     "Stephen Kaplan nói tiếp xúc thiên nhiên cho ta những quãng NGHỈ NGƠI ngắn cho đầu óc, nhờ đó KHẢ NĂNG TẬP TRUNG tốt lên – vừa thư giãn vừa làm sắc bén trí óc. → C. Bẫy: đừng nhầm với Rachel Kaplan ở câu trước.",
     "Connection to nature also provides mini mental breaks that may aid the ability to concentrate, according to research by Stephen Kaplan."),
    (25, 'Francis Kuo', 'A',
     "Kuo báo cáo rằng trồng cây trong đô thị làm tăng tính cộng đồng: tạo chỗ dễ chịu để cư dân trò chuyện và kết bạn. → A.",
     "He also reported that planting trees in urban areas increases sociability by providing comfortable places for residents to talk with one another and develop friendships that promote mutual support."),
    (26, 'Walter Kroner', 'E',
     "Nghiên cứu của Kroner cho thấy được TỰ ĐIỀU CHỈNH môi trường quanh mình làm tăng đáng kể sự thoải mái và tinh thần. → E.",
     "Although the technology is largely available to do this, the personal comfort systems have not sold well in the market place, even though research by Walter Kroner and colleagues at Rensselaer Polytechnic Institute shows that personal control leads to significant increases in comfort and morale."),
]
u2q += [q(n, 'matching', p, a, e, THEORIES, ev) for n, p, a, e, ev in M2]

unit2 = {
    'unitType': 'reading_passage', 'unitNumber': 2,
    'title': 'Passage 2 - Psychological Value of Space',
    'instructions': 'You should spend about 20 minutes on Questions 14-26, which are based on Reading Passage 2 below.',
    'content': P['p2']['content'], 'defaultTimeLimitMinutes': 20,
    'metadata': {'groupInstructions': {
        '14': ("Reading Passage 2 has seven paragraphs, A-G.\n"
               "Choose the correct heading for each paragraph from the list of headings below.\n"
               "Write the correct number i-x in boxes 14-20 on your answer sheet.\n\n"
               "List of Headings\n"
               ":::box\n" + '\n'.join(HEADINGS) + "\n:::"),
        '21': ("Look at the following people (Questions 21-26) and the list of theories below.\n"
               "Match each person with the correct theory, A-I.\n"
               "Write the correct letter A-I in boxes 21-26 on your answer sheet.\n\n"
               "List of Theories\n"
               ":::box\n"
               "A Creating a green area can stimulate a sense of community.\n"
               "B People need adequate living space in order to be healthy.\n"
               "C Natural landscape can both relax and sharpen the mind.\n"
               "D Cooking together is an important element in human bonding.\n"
               "E People feel more at ease if they can adjust their environment.\n"
               "F Looking at a green environment improves people’s spirits.\n"
               "G Physical exercise improves creative thinking at work.\n"
               "H Man’s brain developed partly through regular association with peers.\n"
               "I We are drawn to places similar to the area where our species originated.\n"
               ":::")}},
    'questions': u2q,
}

# ============================================================ Passage 3
MC3 = [
    (27, 'What do we learn about charities in the first paragraph?',
     ['A People trust charities because they are approved by government.',
      'B Not all the funds a charity receives go on practical aid for people.',
      'C Charities do not disclose their systems for fear of losing official status.',
      'D People who work for charities without pay are not fit for the job.'], 1,
     "Bài nói người ta VẪN TIN rằng tổ chức từ thiện tách khỏi nhà nước, toàn người tình nguyện và tiêu từng xu quyên góp cho đúng mục đích – rồi khẳng định ngay: phần lớn là SAI. Tức có tiền không đi thẳng vào việc cứu trợ. → B.",
     "Charities, it is still widely believed, are separate from government, staffed entirely by volunteers and spend every penny donated on the cause they support. / Noble stuff, but in most cases entirely wrong."),
    (28, 'Why, in the writer’s view, is it hard for charities to inform the public properly?',
     ['A They calculate success differently from other businesses.',
      'B They are unable to publish a true financial report.',
      'C The amount of resources needed changes radically year by year.',
      'D Donors may be disappointed if they see large profits in the accounts.'], 0,
     "Bài giải thích khó vẽ ra bức tranh trọn vẹn cho nhà tài trợ vì KHÁC với doanh nghiệp chạy theo lợi nhuận, tổ chức từ thiện không thể đo thành quả bằng con số lãi lỗ. → A.",
     "But it’s still difficult to give donors a complete picture because, unlike profit-driven businesses, charities can’t measure achievement purely by the bottom line."),
    (29, 'One of the conclusions of the report ‘Funding Success’ is that',
     ['A charities must cut down on any unnecessary expenditure.',
      'B raising more money for their cause should be a charity’s main aim.',
      'C charities should give the public an assessment of the results of their work.',
      'D clarifying the reasons for administration costs would not dissuade donors.'], 3,
     "Báo cáo nói nhiều nhà tài trợ coi chi phí vận hành cao – NẾU ĐƯỢC HẠCH TOÁN MINH BẠCH – là dấu hiệu tổ chức chạy hiệu quả chứ không phải lãng phí. Tức giải trình rõ chi phí không làm nhà tài trợ quay lưng. → D.",
     "Many funders, it claims, regard high overheads on, for example, premises, publicity and so on, that are properly accounted for, as a sign of an efficiently run organisation, rather than a waste of resources."),
    (30, 'Baroness O’Neill’s main recommendation is that charities should',
     ['A follow the current government requirements on reporting.',
      'B encourage the public to examine and discuss the facts.',
      'C publicise any areas in which they have been effective.',
      'D make sure the figures are laid out as clearly as possible.'], 1,
     "O’Neill nói muốn công chúng tự phán đoán thì cần đối thoại thật sự, trong đó họ được HỎI, QUAN SÁT, KIỂM CHỨNG và thậm chí CHẤT VẤN bằng chứng. → B. Bẫy: A sai vì bà nói thêm yêu cầu báo cáo đã không làm người ta tin hơn.",
     "‘... If we are to judge for ourselves, we need genuine communication in which we can question and observe, check and even challenge the evidence that others present.’"),
    (31, 'What is Cathy Pharoah most concerned about?',
     ['A the public’s adverse reaction to the money spent on charity personnel',
      'B the effect on general donations if any charity misuses their funds',
      'C the reliance of many charities on a single sector of the population',
      'D the findings of a Charity Commission report on public confidence'], 1,
     "Pharoah cho rằng mối đe doạ LỚN NHẤT với niềm tin là các vụ bê bối kiểu Scotland năm 2003 – nơi hai tổ chức bị phát giác chỉ chi một phần nhỏ cho mục đích từ thiện. → B. Bẫy: A ngược lại, bà tin người quyên góp thừa hiểu phải trả lương cho nhân sự chuyên nghiệp.",
     "She believes the biggest threats to trust are the kind of scandals that blighted the Scottish voluntary sector in 2003."),
    (32, 'Why does Fiona Duncan think the ‘Giving Scotland’ campaign succeeded?',
     ['A The message came over strongly because so many organisations united.',
      'B People did not believe the critical stories that appeared in newspapers.',
      'C Private donors paid for some advertising in the national press.',
      'D People forgot about the scandals over the Christmas holidays.'], 0,
     "Duncan tổng kết bài học là \"strength in numbers\" – sức mạnh của số đông (14 tổ chức cùng hai hiệp hội bắt tay nhau) và chọn đúng thời điểm. → A.",
     "‘We learned about strength in numbers and the importance of timing - because it was Christmas, we were able to get good coverage,’ says Duncan."),
    (33, 'The writer suggests that in the future, charities',
     ['A may well have to face a number of further scandals.',
      'B will need to think up some new promotional campaigns.',
      'C may find it hard to change the public’s perception of them.',
      'D will lose the public’s confidence if they modernise their image.'], 2,
     "Câu kết nói thành bại sẽ tuỳ ở chỗ họ có SẴN SÀNG cởi bỏ hình ảnh thánh thiện để dựng một hình ảnh mới, bạo dạn hơn hay không – hàm ý đây là việc không dễ. → C.",
     "The numerous proactive initiatives now underway across the UK give charities the chance to prevent the situation ever getting that bad again - but their success will depend on whether they are prepared to shed their saintly image and rally to the cause of creating a newer, bolder one."),
]
u3q = [q(n, 'multiple_choice', p, opts[i], e, opts, ev) for n, p, opts, i, e, ev in MC3]

T3 = [
    (34, 'Charity involvement in some prominent campaigns has meant that they are undergoing more careful examination by the public.', 'TRUE',
     "Bài nói các chiến dịch đình đám như Make Poverty History đã kéo khu vực từ thiện ra ÁNH ĐÈN SÂN KHẤU, và đi kèm ánh đèn là SỰ SOI XÉT. → TRUE.",
     "High-profile international programmes of awareness-raising activities, such as Make Poverty History, have dragged the voluntary sector into the spotlight and shown charity workers to be as much business entrepreneurs as they are angels of mercy. / But with the spotlight comes scrutiny, and unless charities present compelling cases for political campaigning, six-figure salaries and paying the expenses of celebrities who go on demanding trips to refugee camps for nothing, they may get bitten."),
    (35, 'Famous people insist on a large fee if they appear for a charity.', 'NOT GIVEN', None, None),
    (36, 'The new RNID documents outline expected progress as well as detailing past achievements.', 'TRUE',
     "Bài nói mỗi bản impact report vừa nhìn lại những gì đã làm được trong 12 tháng qua, VỪA nêu mục tiêu cho năm tới. → TRUE.",
     "Each impact report looks back at what has been achieved over the previous 12 months and also states the charity’s aims for the year ahead."),
    (37, 'People have been challenging the RNID on their promotional activities.', 'FALSE',
     "Brian Lamb thừa nhận RNID CHƯA làm tốt việc giải thích cho công chúng, và nói người ta SẼ đặt câu hỏi khi khu vực này càng nổi – tức chuyện chất vấn chưa xảy ra. → FALSE.",
     "‘We have not been good at educating the public on issues such as why we do a lot of campaigning,’ he says. / ‘But the more high-profile the sector becomes, the more people will ask questions.’"),
    (38, 'The two charities involved in a scandal have altered their funding programmes.', 'NOT GIVEN', None, None),
    (39, 'Following the scandal, the media attacked the charity sector as a whole.', 'TRUE',
     "Bài nói hai vụ đó gây ra cơn sốt truyền thông, nhà báo chớp mọi cơ hội để đánh vào CẢ KHU VỰC từ thiện, biến hai chuyện xấu thành khủng hoảng toàn ngành. → TRUE.",
     "‘Those two incidents caused a media frenzy as journalists took every opportunity to undermine the sector,’ says Fiona Duncan, director of external affairs at Capability Scotland."),
    (40, 'Charity donations in Scotland are now back to their pre-scandal level.', 'NOT GIVEN', None, None),
]
NG_EXP = {
    35: ("Bài chỉ nói tổ chức từ thiện phải giải trình việc CHI TRẢ CHI PHÍ cho những người nổi tiếng đi thăm trại tị nạn "
         "\"for nothing\" – tức không lấy thù lao. Việc người nổi tiếng có ĐÒI thù lao lớn hay không thì bài không hề đề cập. → NOT GIVEN."),
    38: ("Bài chỉ kể hai tổ chức bị phanh phui vì chi rất ít cho mục đích từ thiện và hậu quả truyền thông, "
         "hoàn toàn không nói họ có THAY ĐỔI chương trình gây quỹ hay không. → NOT GIVEN."),
    40: ("Bài chỉ dẫn hai cuộc thăm dò về Ý ĐỊNH quyên góp (52% nói ít có khả năng cho hơn, sau đó hơn một nửa nói dễ cân nhắc cho hơn), "
         "chứ không cho biết SỐ TIỀN quyên góp thực tế đã trở lại mức trước bê bối hay chưa. → NOT GIVEN."),
}
for n, p, a, e, ev in T3:
    if a == 'NOT GIVEN':
        u3q.append(q(n, 'true_false_not_given', p, a, NG_EXP[n], TFNG))
    else:
        u3q.append(q(n, 'true_false_not_given', p, a, e, TFNG, ev))

unit3 = {
    'unitType': 'reading_passage', 'unitNumber': 3,
    'title': 'Passage 3 - Ditching that Saintly Image',
    'instructions': 'You should spend about 20 minutes on Questions 27-40, which are based on Reading Passage 3 below.',
    'content': P['p3']['content'], 'defaultTimeLimitMinutes': 20,
    'metadata': {'groupInstructions': {
        '27': ("Choose the correct letter, A, B, C or D.\n"
               "Write the correct letter in boxes 27-33 on your answer sheet."),
        '34': ("Do the following statements agree with the information given in Reading Passage 3?\n"
               "In boxes 34-40 on your answer sheet, write\n"
               ":::box\n"
               "TRUE if the statement agrees with the information\n"
               "FALSE if the statement contradicts the information\n"
               "NOT GIVEN if there is no information on this.\n"
               ":::")}},
    'questions': u3q,
}

data = {
    'title': 'IELTS Master - Reading Test 45',
    'skill': 'reading',
    'sourceLabel': 'IELTS Master - Reading Test 45',
    'description': 'Đề đọc IELTS Master Test 45: Unlikely Boomtowns / Psychological Value of Space / Ditching that Saintly Image.',
    'units': [unit1, unit2, unit3],
}

# ------------------------------------------------------------------ validator
KEY = {1: 'B', 2: 'F', 3: 'G', 4: 'C', 5: 'E', 6: 'F',
       7: 'F', 8: 'R', 9: 'G', 10: 'H', 11: 'O', 12: 'M', 13: 'C',
       14: 'iv', 15: 'viii', 16: 'vi', 17: 'x', 18: 'ix', 19: 'ii', 20: 'vii',
       21: 'I', 22: 'H', 23: 'F', 24: 'C', 25: 'A', 26: 'E',
       27: 'B', 28: 'A', 29: 'D', 30: 'B', 31: 'B', 32: 'A', 33: 'C',
       34: 'TRUE', 35: 'NOT GIVEN', 36: 'TRUE', 37: 'FALSE', 38: 'NOT GIVEN',
       39: 'TRUE', 40: 'NOT GIVEN'}
# cau 1-3 va 4-6 la dang chon NHIEU chu cai: moi cau mang tron bo dap an
MULTI = {1: 'BFG', 2: 'BFG', 3: 'BFG', 4: 'CEF', 5: 'CEF', 6: 'CEF'}

errs = []
orders = [item['order'] for u in data['units'] for item in u['questions']]
if orders != list(range(1, 41)):
    errs.append('Thu tu cau sai: %s' % orders)

for u in data['units']:
    body = u['content'] + '\n' + (u['metadata'].get('noteBody') or '')
    for qq in u['questions']:
        n = qq['order']
        ans = qq['answer']
        accepted = ans if isinstance(ans, list) else [ans]
        if n in MULTI:
            got = ''.join(sorted(a.split()[0] for a in accepted))
            if got != MULTI[n]:
                errs.append('Q%d: bo dap an %r != key %r' % (n, got, MULTI[n]))
        else:
            heads = [str(a).split()[0] for a in accepted]
            if KEY[n] not in heads and KEY[n] not in [str(a) for a in accepted]:
                errs.append('Q%d: dap an %s khong khop key %r' % (n, heads, KEY[n]))
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

json.dump(data, open('tmp/ielts_master_reading_test45.json', 'w', encoding='utf8'),
          ensure_ascii=False, indent=1)
print('OK: 3 phan, %d cau. Da ghi tmp/ielts_master_reading_test45.json' % len(orders))
