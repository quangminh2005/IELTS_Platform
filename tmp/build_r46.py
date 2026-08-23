# -*- coding: utf-8 -*-
import json, re, sys
sys.stdout.reconfigure(encoding='utf-8')

P = json.load(open('tmp/_r46_passages.json', encoding='utf-8'))


def q(order, qtype, prompt, answer, explanation, evidence, options=None):
    d = {"order": order, "questionType": qtype, "prompt": prompt, "answer": answer,
         "explanation": explanation, "points": 1, "evidence": evidence}
    if options:
        d["options"] = options
    return d


# =================== UNIT 1 - Jargon ===================
HEADINGS = [
    "i The benefits of simple language",
    "ii A necessary tool",
    "iii A lasting way of concealing disasters",
    "iv The worst offenders",
    "v A deceptively attractive option",
    "vi Differing interpretations",
    "vii Publicising new words",
    "viii Feeling shut out",
    "ix Playing with words",
]

GI1 = ("Reading Passage 1 has six paragraphs, A - F.\n"
       "Choose the correct heading for each paragraph from the list of headings below.\n"
       "Write the correct number i - ix in boxes 1 - 6 on your answer sheet.\n\n"
       "List of Headings\n:::box\n" + "\n".join(HEADINGS) + "\n:::")

GI7 = ("Complete the summary using the list of words A-L below.\n"
       "Write the correct letter A- L in boxes 7 - 12 on your answer sheet.\n"
       ":::box\n"
       "A Judgement | B Jokes | C Shop-talk\n"
       "D Efficiency | E Know-how | F Command\n"
       "G Contempt | H Feeling | I Possessiveness\n"
       "J Pleasure | K Fear | L Humour\n"
       ":::")

GI13 = ("Choose the correct letter, A, B, C or D.\n"
        "Write the correct letter in box 13 on your answer sheet.")

NOTE1 = ("Jargon plays a useful part in many aspects of life including leisure. For example, when people take up "
         "pastimes they need to develop a good [[7]] of the relevant jargon. During discussion of these or other "
         "areas of interest, conversation can become more exciting and an element of [[8]] can be introduced by the "
         "use of shared jargon. Jargon is particularly helpful in the workplace. It leads to more [[9]] in the way "
         "colleagues communicate during work hours. Taking part in [[10]] during moments of relaxation can also help "
         "them to bond better. It is interesting that members of a group, whether social or professional, often "
         "demonstrate a certain [[11]] towards the particular linguistic characteristics of their subject area and "
         "tend to regard new people who do not wish to learn the jargon with [[12]].")

MC13 = [
    "A Jargon thoroughly deserves the bad reputation it has gained.",
    "B Jargon should not be encouraged except in the workplace.",
    "C Jargon should not be used if the intention is to exclude others.",
    "D Everyday life would be very much better without jargon.",
]

u1q = [
    q(1, "matching", "Paragraph A", "vi Differing interpretations",
      "Đoạn A đối chiếu HAI CÁCH HIỂU khác nhau về từ ‘jargon’: một nghĩa trung tính trong từ điển (vốn từ chuyên môn của một nhóm) và một nghĩa xấu, phổ biến hơn (thứ ngôn ngữ tối nghĩa, khoa trương). Đó chính là vi ‘Differing interpretations’.",
      "One dictionary defines it, neatly and neutrally, as ‘the technical vocabulary or idiom of a special activity or group’, but this sense is almost completely overshadowed by another: ‘obscure and often pretentious language marked by a roundabout way of expression and use of long words’.",
      HEADINGS),
    q(2, "matching", "Paragraph B", "ii A necessary tool",
      "Đoạn B khẳng định ai cũng dùng biệt ngữ và nó là phần THIẾT YẾU của mạng lưới nghề nghiệp, giúp diễn đạt tiết kiệm và chính xác. Là một CÔNG CỤ CẦN THIẾT → ii.",
      "It is an essential part of the network of occupations and pursuits that make up society. / It is the jargon element which, in a job, can promote economy and precision of expression, and thus help make life easier for the workers.",
      HEADINGS),
    q(3, "matching", "Paragraph C", "ix Playing with words",
      "Đoạn C nói về niềm vui khi CHƠI ĐÙA với ngôn từ: biệt ngữ thêm nhịp điệu, sự đa dạng và hài hước, kiểu nói ‘NASA-speak’ với countdown, all systems go, lift-off, rồi khoe chữ và pha trò nội bộ. → ix.",
      "It can add pace, variety and humour to speech - as when, with an important event approaching, we might slip into NASA-speak, and talk about countdown, all systems go, and lift-off.",
      HEADINGS),
    q(4, "matching", "Paragraph D", "viii Feeling shut out",
      "Đoạn D lý giải vì sao biệt ngữ mang tiếng xấu: nó vừa gộp vào vừa GẠT RA NGOÀI. Khi người nghe thấy mình có quyền được biết mà lại không hiểu nổi thì họ mới lên tiếng phàn nàn. Cảm giác bị gạt ra ngoài → viii.",
      "The most important reason stems from the way jargon can exclude as well as include.",
      HEADINGS),
    q(5, "matching", "Paragraph E", "iv The worst offenders",
      "Đoạn E chỉ đích danh những lĩnh vực BỊ CHỈ TRÍCH NẶNG NHẤT: quảng cáo, chính trị và quốc phòng. ‘The worst offenders’ = những kẻ vi phạm tệ nhất → iv. Bẫy: iii nói về việc che giấu thảm hoạ LÂU DÀI, nhưng bài viết khẳng định ngược lại là chỉ giấu được tạm thời.",
      "No area is exempt, but the fields of advertising, politics and defence have been especially criticised in recent years by the various campaigns for Plain English.",
      HEADINGS),
    q(6, "matching", "Paragraph F", "v A deceptively attractive option",
      "Đoạn F nói biệt ngữ trông rất HẤP DẪN – như tấm thẻ hội viên, lối tắt để vào nhóm, cách che giấu sự thiếu chắc chắn và yếu kém – nhưng đó là cái bẫy, dễ thành thói xấu. Lựa chọn hấp dẫn nhưng đánh lừa → v.",
      "Jargon, also, can provide a lazy way into a group or an easy way of hiding uncertainties and inadequacies: when terminology slips plausibly from the tongue, it is not essential for the brain to keep up.",
      HEADINGS),
    q(7, "note_completion", "Question 7", ["F", "F Command", "Command"],
      "Chỗ trống cần danh từ đi với ‘a good … of’, chỉ mức độ THÀNH THẠO. Bài viết nói mọi thú vui đều đòi hỏi làm chủ một hệ biệt ngữ. → F Command.",
      "All hobbies require mastery of a jargon. / When we have learned to command it, jargon is something we readily take pleasure in, whether the subject area is motorcycles, knitting, cricket, baseball or computers."),
    q(8, "note_completion", "Question 8", ["L", "L Humour", "Humour"],
      "Nhờ biệt ngữ chung mà câu chuyện sinh động hơn và có thêm yếu tố HÀI HƯỚC. → L Humour. Bẫy: B Jokes chỉ ứng với ‘in-jokes’, không phải thứ được đưa thêm vào cuộc trò chuyện.",
      "It can add pace, variety and humour to speech - as when, with an important event approaching, we might slip into NASA-speak, and talk about countdown, all systems go, and lift-off."),
    q(9, "note_completion", "Question 9", ["D", "D Efficiency", "Efficiency"],
      "Trong công việc, biệt ngữ giúp diễn đạt tiết kiệm và chính xác, làm việc dễ dàng hơn – tức giao tiếp HIỆU QUẢ hơn. → D Efficiency.",
      "It is the jargon element which, in a job, can promote economy and precision of expression, and thus help make life easier for the workers."),
    q(10, "note_completion", "Question 10", ["C", "C Shop-talk", "Shop-talk"],
      "Lúc thư giãn, thứ giúp đồng nghiệp gắn bó với nhau là chuyện nghề: bài viết gọi đó là ‘social togetherness (shop-talk)’. → C Shop-talk.",
      "It is also the chief linguistic element which shows professional awareness (‘know-how’) and social togetherness (‘shop-talk’)."),
    q(11, "note_completion", "Question 11", ["I", "I Possessiveness", "Possessiveness"],
      "Thành viên trong nhóm ‘jealous of this knowledge’ – giữ khư khư vốn từ riêng của mình, tức có TÍNH SỞ HỮU với nó. → I Possessiveness.",
      "Moreover, we are jealous of this knowledge."),
    q(12, "note_completion", "Question 12", ["G", "G Contempt", "Contempt"],
      "Người mới không chịu học biệt ngữ thì bị nhóm ‘demean’ – hạ thấp, coi thường. → G Contempt.",
      "We are quick to demean anyone who tries to be part of our group without being prepared to take on its jargon."),
    q(13, "multiple_choice", "Which of the following statements would the writer agree with?",
      ["C Jargon should not be used if the intention is to exclude others."],
      "Tác giả không hề bài xích biệt ngữ (đoạn B và C khẳng định nó cần thiết và thú vị) nên A và D sai; ông cũng không giới hạn nó ở nơi làm việc vì sở thích, giải trí đều có biệt ngữ, nên B sai. Điều tác giả lên án là dùng biệt ngữ CỐ Ý để người khác không hiểu. → C.",
      "It is also temptingly easy to slip some jargon into our expression, to ensure that others do not understand. / and if we suspect that the obfuscation is deliberate policy, we unreservedly condemn, labelling it gobbledegook and calling down public derision upon it.",
      MC13),
]

unit1 = {
    "unitType": "reading_passage", "unitNumber": 1, "title": "Passage 1 - Jargon",
    "instructions": "You should spend about 20 minutes on Questions 1-13, which are based on Reading Passage 1 below.",
    "content": "\n\n".join(P['p1']), "defaultTimeLimitMinutes": 20,
    "metadata": {"groupInstructions": {"1": GI1, "7": GI7, "13": GI13},
                 "groupTitles": {"7": "The Up Side of Jargon"},
                 "noteBody": NOTE1},
    "questions": u1q,
}

# =================== UNIT 2 - Healthy Intentions ===================
PARAS2 = ["A", "B", "C", "D", "E", "F", "G"]
GI14 = ("Reading Passage 2 has seven paragraphs, A - G.\n"
        "Which paragraph contains the following information?\n"
        "NB You may use any letter more than once.")
GI21 = ("Do the following statements agree with the claims of the writer in Reading passage 2?\n"
        "In boxes 21 -26 on your answer sheet, write\n"
        ":::box\n"
        "YES if the statement agrees with the claims of the writer\n"
        "NO if the statement contradicts the claims of the writer\n"
        "NOT GIVEN if it is impossible to say what the writer thinks about this\n"
        ":::")
YNG = ["YES", "NO", "NOT GIVEN"]

u2q = [
    q(14, "matching", "a reference to systems for neutralizing some harmful features of modern diets", "G",
      "Đoạn G nêu các CÁCH HOÁ GIẢI mặt hại của chế độ ăn: người Huasa cho tới hai mươi loại cây thuốc hoang dã vào canh, còn người Masai luôn kết hợp sản phẩm động vật với thảo mộc đắng giàu chất chống oxy hoá. → G.",
      "and peoples who have become heavily reliant on animal products have found ways of countering the negative effects of such a diet.",
      PARAS2),
    q(15, "matching", "a suggestion as to why mankind has prospered", "B",
      "Đoạn B giải thích vì sao loài người THÀNH CÔNG hơn các loài khác: ta điều khiển được dòng năng lượng và tài nguyên trong hệ sinh thái theo hướng có lợi cho mình. → B.",
      "Humans are qualitatively different from other animals because we manipulate the flow of energy and resources through the ecosystem to our advantage, and consequently to the detriment of other organisms. That is why we compete so successfully with other species.",
      PARAS2),
    q(16, "matching", "an example of what happens if a balanced, plant-based diet is abandoned", "F",
      "Đoạn F đưa VÍ DỤ về hậu quả khi bỏ chế độ ăn nhiều chất xơ từ thực vật: khỉ đột nuôi nhốt được cho ăn ít chất xơ, có thịt và trứng thì mắc đủ thứ bệnh vốn của con người. → F.",
      "When gorillas are brought into captivity and fed on lower-fiber diets containing meat and eggs, they suffer from many common human disorders: cardiovascular disease, ulcerative colitis and high cholesterol levels.",
      PARAS2),
    q(17, "matching", "a chronological outline of the different types of diet mankind has lived on", "D",
      "Đoạn D liệt kê theo TRÌNH TỰ THỜI GIAN: 100.000 thế hệ săn bắt hái lượm, 500 thế hệ sống nhờ nông nghiệp, 10 thế hệ từ khi có công nghiệp và 2 thế hệ lớn lên với đồ ăn nhanh chế biến sẵn. → D.",
      "At least 100,000 generations of people were hunter-gatherers, only 500 generations have depended on agriculture, only ten generations have lived since the onset of the industrial age and only two generations have grown up with highly processed fast foods.",
      PARAS2),
    q(18, "matching", "details of which main factors now threaten human life", "A",
      "Đoạn A nêu các nguyên nhân gây tử vong HÀNG ĐẦU hiện nay: bệnh tim, ung thư và đột quỵ, đều là bệnh không lây liên quan tới lối sống. → A.",
      "The main causes of death in the United States in 1997 were heart disease, cancer and stroke.",
      PARAS2),
    q(19, "matching", "a reference to one person’s theory about the cause of some of today’s illnesses", "G",
      "Đoạn G dẫn quan điểm RIÊNG của Timothy Johns: thủ phạm không phải việc ăn nhiều mỡ động vật hay ăn ít chất chống oxy hoá, mà là sự MẤT CÂN BẰNG giữa hai thứ đó. → G. Bẫy: đoạn D cũng dẫn lời chuyên gia nhưng là HAI bác sĩ, không phải ‘one person’.",
      "According to Timothy Johns, it is not the high intake of animal fat or the low intake of antioxidants, that creates so many health problems in industrial countries; it is the lack of balance between the two.",
      PARAS2),
    q(20, "matching", "details of the varied intake of early humans", "E",
      "Đoạn E mô tả bữa ăn ĐA DẠNG của người tiền sử: trái cây sống, hạt, rau, nước sạch, côn trùng, thịt thú rừng ít mỡ bão hoà, và ước tính 100–300 loài thực vật mỗi năm. → E.",
      "Paleolithic humans ate a diet similar to that of wild chimpanzees and gorillas today: raw fruit, nuts, seeds, vegetation, fresh untreated water, insects and wild-game meat low in saturated fats.",
      PARAS2),
    q(21, "true_false_not_given", "An increase in material resources leads to improved physical health.", "NO",
      "Bài viết khẳng định tiến bộ kinh tế và kỹ thuật KHÔNG bảo đảm sức khoẻ tốt – trái ngược hẳn với nhận định. → NO.",
      "It is clear that economic and technical progress is no assurance of good health.", YNG),
    q(22, "true_false_not_given", "Cereals were unknown to our hunter-gathering ancestors.", "NOT GIVEN",
      "Bài chỉ nói tổ tiên ‘hiếm khi, nếu có’ ăn ngũ cốc. ‘Hiếm khi’ hoàn toàn khác với ‘chưa từng biết đến’, nên không đủ căn cứ kết luận. → NOT GIVEN.",
      "Our ancestors rarely, if ever, ate grains or drank the milk of other animals.", YNG),
    q(23, "true_false_not_given", "In the future, human bodies will adapt to take account of changes in diet.", "NOT GIVEN",
      "Bài nói chọn lọc tự nhiên CHƯA kịp sửa cơ thể ta cho hợp với lối sống mới, nhưng không hề bàn tới việc TƯƠNG LAI cơ thể có thích nghi được hay không. → NOT GIVEN.",
      "Natural selection has not had time to revise our bodies for coping with fatty diets, automobiles, drugs, artificial lights and central heating.", YNG),
    q(24, "true_false_not_given", "Many people in developed countries have a less balanced diet than early humans.", "YES",
      "Người tiền sử ăn 100–300 loài thực vật mỗi năm, còn người phương Tây khá giả ngày nay hiếm khi vượt quá 20–30 loài – tức khẩu phần kém đa dạng, kém cân bằng hơn. → YES.",
      "Most important, like chimpanzees and gorillas, prehistoric humans ate a wide variety of plants - an estimated 100 to 300 different types in one year. Nowadays, even health-conscious, rich westerners seldom consume more than twenty to thirty different species of plants.", YNG),
    q(25, "true_false_not_given", "Gorillas that live in the wild avoid most infectious diseases.", "NOT GIVEN",
      "Những bệnh mà khỉ đột hoang dã tránh được, theo bài viết, là bệnh tim mạch, viêm loét đại tràng và cholesterol cao – đều KHÔNG phải bệnh truyền nhiễm. Bài không nói gì về bệnh truyền nhiễm ở khỉ đột. → NOT GIVEN.",
      "Their natural diet, rich in antioxidants and fiber, apparently prevents these diseases in the wild, suggesting that such a diet may have serious implications for our own health.", YNG),
    q(26, "true_false_not_given", "Food additives can prevent people from eating what their bodies need.", "YES",
      "Bài viết nói các ‘siêu kích thích’ tạo ra nhân tạo trong thực phẩm chế biến sẵn lấn át những tín hiệu tinh tế của cơ thể, khiến ta không chọn được chế độ ăn lành mạnh. → YES.",
      "Such subtleties are easily overridden by artificially created superstimuli in processed foods that leave us unable to select a healthy diet.", YNG),
]

unit2 = {
    "unitType": "reading_passage", "unitNumber": 2, "title": "Passage 2 - Healthy Intentions",
    "instructions": "You should spend about 20 minutes on Questions 14-26, which are based on Reading Passage 2 below.",
    "content": "\n\n".join(P['p2']), "defaultTimeLimitMinutes": 20,
    "metadata": {"groupInstructions": {"14": GI14, "21": GI21}},
    "questions": u2q,
}

# =================== UNIT 3 - Women in New Technologies ===================
FINDINGS = [
    "A Men and women perceive their environment differently.",
    "B The advantages of ICTs in schools are difficult to specify.",
    "C Men see ICT as an exciting new area of employment.",
    "D Female students find working on their own unappealing.",
    "E A greater female representation in scientific and technical posts would have enormous benefits.",
    "F Women can be seen as both passive and active users of ICTs.",
    "G Female students can benefit most from ICTs and distance learning.",
    "H In Higher Education, men use a wider range of ICT skills than women.",
    "I A considerable number of women give up ICT posts to work in different fields.",
    "J The way the two genders regard computers reflects the differences in the way they develop their sense of self.",
    "K Certain new employment sectors are soon colonized by workers of one sex.",
]
GI27 = ("Look at the following people (Questions 27 - 34) and the list of reported findings below.\n"
        "Match each person with the correct finding, A-K.\n"
        "Write the correct letter A - K in boxes 27 - 34 on your answer sheet.\n\n"
        "List of Reported Findings\n:::box\n" + "\n".join(FINDINGS) + "\n:::")
GI35 = ("Complete the sentences below.\n"
        "Choose NO MORE THAN THREE WORDS from the passage for each answer.")
NOTE3 = "Women are thought to be suited to computer work as it involves developing [[40]] and [[40]]."

u3q = [
    q(27, "matching", "Rothschild", "E A greater female representation in scientific and technical posts would have enormous benefits.",
      "Rothschild (1982) được dẫn cho lập luận: nếu có nhiều phụ nữ làm kỹ sư và nhà khoa học hơn thì ta hẳn đã sống trong một thế giới rất khác. → E.",
      "Feminist writers for many years have argued that if more women were engineers and scientists, we might live in a very different world. (Rothschild 1982)", FINDINGS),
    q(28, "matching", "Alper", "I A considerable number of women give up ICT posts to work in different fields.",
      "Tên Alper (1993) gắn với hiện tượng ‘leaking’ – một lượng đáng kể phụ nữ đã vào ngành ICT rồi lại bỏ sang lĩnh vực khác. → I.",
      "They found a pattern of a low proportion of female entrants, a significant ‘leaking’ (Alper 1993) of those who enter to other areas of employment, and a ghetto of women in lower paid jobs.", FINDINGS),
    q(29, "matching", "Woodfield", "K Certain new employment sectors are soon colonized by workers of one sex.",
      "Nghiên cứu của Woodfield (2000) cho thấy nam được giao trách nhiệm quản lý dù công ty thừa nhận họ kém kỹ năng, còn nữ có kỹ năng lại không được giao – từ đó rút ra kết luận nghề nghiệp bị ‘gán giới’ rất nhanh ở một số ngành. → K.",
      "A study of a new high-tech ICT company (Woodfield 2000) employing highly qualified graduates showed that men were given management responsibility despite an acknowledgement by the company that they had poor management skills. / It seems that jobs acquire gender quite quickly in some sectors.", FINDINGS),
    q(30, "matching", "Turkle", "J The way the two genders regard computers reflects the differences in the way they develop their sense of self.",
      "Turkle xem máy tính là công cụ nối dài BẢN SẮC của mỗi người; nam và nữ dùng máy tính để khám phá và thể hiện bản sắc giới của mình theo những cách khác nhau đáng kể. → J.",
      "She sees computers as tools used as an extension of our identities, with significant variations in the ways that men and women use them to explore and perform their gendered identities.", FINDINGS),
    q(31, "matching", "Angrist", "B The advantages of ICTs in schools are difficult to specify.",
      "Angrist (MIT) khi khảo sát ICT trong lớp học thấy chi phí lắp đặt thì rõ ràng, còn lợi ích thì KHÓ THẤY hơn nhiều. → B.",
      "One researcher, Angrist, from MIT found when examining ICTs in the classroom that the set-up costs were obvious and the benefits much less so (Economist 2002).", FINDINGS),
    q(32, "matching", "Shade", "F Women can be seen as both passive and active users of ICTs.",
      "Shade (2002) phân biệt hai kiểu: phụ nữ bị nhắm tới như NGƯỜI TIÊU DÙNG (vai trò thụ động) và phụ nữ tự tạo nội dung mở ra cơ hội cho phụ nữ (vai trò chủ động). → F.",
      "Shade (2002) distinguishes between the feminisation of the Internet, where women are targeted as consumers rather than citizens or learners; and feminist uses of the Internet where women develop content that creates opportunities for women.", FINDINGS),
    q(33, "matching", "Kirkup", "D Female students find working on their own unappealing.",
      "Khảo sát sinh viên học từ xa của Kirkup cho thấy nữ giới thấy khó chịu khi bị CÔ LẬP và mong muốn được kết nối với người khác. → D.",
      "Women were uncomfortable with isolation and stated a desire for connection with others.", FINDINGS),
    q(34, "matching", "Li", "H In Higher Education, men use a wider range of ICT skills than women.",
      "Li (2002) nghiên cứu sinh viên đại học ở Anh và Trung Quốc, thấy nam dùng e-mail thường xuyên hơn, online lâu hơn và tham gia NHIỀU LOẠI hoạt động hơn nữ. → H.",
      "Li (2002), in a study of university students in the UK and China, found that male students used e-mail more frequently, spent more time online, and engaged in more varied activities than women students.", FINDINGS),
    q(35, "short_answer", "The term ‘............’ refers to a company that is equally happy to promote workers of either sex.",
      ["gender blind", "gender-blind", "‘gender blind’"],
      "Bài viết nói người ta hay bảo các ngành mới là ‘gender blind’, tức là hễ làm giỏi thì thăng tiến, bất kể giới tính. → gender blind.",
      "It is often said that new industries are both ‘gender blind’ (i.e. if you are good at your work you’ll succeed whatever your gender) and that they value ‘feminine’ communication and ‘people’ skills."),
    q(36, "short_answer", "It is clear that ICT developments in most fields are driven by ............",
      ["economic force", "an economic force", "economic forces"],
      "Bài viết: động lực nền tảng của hầu hết các sáng kiến dựa trên ICT trong công việc, giáo dục, giải trí và quyền công dân là ‘economic force’. → economic force.",
      "This subtle way of understanding our relationship with this technology, however, must go in parallel with a materialist view, which is that an underlying motivation for most ICT-based initiatives in work, education, leisure, citizenship is economic force."),
    q(37, "short_answer", "The range of institutions providing high level instruction today is known as a ............",
      ["multiversity", "a multiversity", "‘multiversity’"],
      "Clark Kerr đặt ra từ ‘multiversity’ năm 1963; ngày nay giáo dục bậc cao do nhiều loại đại học, cao đẳng và công ty thương mại cùng cung cấp. → multiversity.",
      "In 1963 Clark Kerr, the President of the University of California, coined the term ‘multiversity’, to suggest that universities were no longer based on a body of universal knowledge or a heterogeneous body of students."),
    q(38, "short_answer", "Women who are working find it hard to get their ............ right.",
      ["work/life balance", "work-life balance", "work life balance"],
      "Thuật ngữ ‘Second Shift’ ra đời để chỉ CÂN BẰNG CÔNG VIỆC – CUỘC SỐNG của phụ nữ đi làm: họ không bỏ việc nhà mà phải gánh cả hai. → work/life balance.",
      "The term ‘Second Shift’ was invented to identify the work/life balance of employed women."),
    q(39, "short_answer", "The way workers of both sexes now face having to fit children, work and continued learning into their lives is called the ............",
      ["Third Shift", "third shift", "‘Third Shift’"],
      "Kramarae gọi việc học suốt đời chồng thêm lên công việc và gia đình của cả nam lẫn nữ là ‘Third Shift’. → Third Shift.",
      "Kramarae sees education in the new century as the ‘Third Shift’: ‘As lifelong learning and knowledge become ever more important, women and men find they juggle not only the demands of work and family, but also the demands of further education throughout their lives. ’ (2001)"),
    q(40, "note_completion", "Question 40", ["networks and relationships"],
      "Việc tạo dựng và duy trì ‘networks and relationships’ thường được viện dẫn làm lý do để coi truyền thông qua máy tính là một công nghệ ‘nữ tính’. → networks and relationships.",
      "Engagement in creating and maintaining networks and relationships is often cited as a reason why computer-mediated communication will be a ‘female’ technology."),
]

unit3 = {
    "unitType": "reading_passage", "unitNumber": 3,
    "title": "Passage 3 - Educational and Professional Opportunities for Women in New Technologies",
    "instructions": "You should spend about 20 minutes on Questions 27-40, which are based on Reading Passage 3 below.",
    "content": "\n\n".join(P['p3']), "defaultTimeLimitMinutes": 20,
    "metadata": {"groupInstructions": {"27": GI27, "35": GI35}, "noteBody": NOTE3},
    "questions": u3q,
}

data = {
    "title": "IELTS Master - Reading Test 46",
    "skill": "reading",
    "sourceLabel": "IELTS Master - Reading Test 46",
    "description": "Đề đọc IELTS Master Test 46: Jargon / Healthy Intentions / Educational and Professional Opportunities for Women in New Technologies.",
    "units": [unit1, unit2, unit3],
}

# ================= VALIDATOR =================
KEY = {1: 'vi', 2: 'ii', 3: 'ix', 4: 'viii', 5: 'iv', 6: 'v', 7: 'F', 8: 'L', 9: 'D', 10: 'C',
       11: 'I', 12: 'G', 13: 'C', 14: 'G', 15: 'B', 16: 'F', 17: 'D', 18: 'A', 19: 'G', 20: 'E',
       21: 'NO', 22: 'NOT GIVEN', 23: 'NOT GIVEN', 24: 'YES', 25: 'NOT GIVEN', 26: 'YES',
       27: 'E', 28: 'I', 29: 'K', 30: 'J', 31: 'B', 32: 'F', 33: 'D', 34: 'H',
       35: 'gender blind', 36: 'economic force', 37: 'multiversity', 38: 'work/life balance',
       39: 'third shift', 40: 'networks and relationships'}

DAU = 'àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđĐ'

errs = []
orders = []
for u in data['units']:
    body = u['content']
    nb = (u.get('metadata') or {}).get('noteBody') or ''
    note_orders = set(int(x) for x in re.findall(r'\[\[(\d+)\]\]', nb))
    seen_note = set()
    for qq in u['questions']:
        o = qq['order']
        orders.append(o)
        # 1) dan chung phai co NGUYEN VAN trong bai doc
        for piece in qq['evidence'].split(' / '):
            if piece.strip() not in body:
                errs.append('Q%d: dan chung KHONG khop nguyen van -> %s' % (o, piece[:70]))
        # 2) dap an phai nam trong options
        if 'options' in qq:
            ans = qq['answer'] if isinstance(qq['answer'], list) else [qq['answer']]
            for a in ans:
                if a not in qq['options']:
                    errs.append('Q%d: dap an "%s" khong co trong options' % (o, a))
        # 3) note_completion phai co o trong tuong ung
        if qq['questionType'] == 'note_completion':
            if o not in note_orders:
                errs.append('Q%d: note_completion nhung noteBody khong co [[%d]]' % (o, o))
            seen_note.add(o)
        # 4) giai thich phai la tieng Viet CO DAU
        if not any(c in DAU for c in qq['explanation']):
            errs.append('Q%d: giai thich thieu dau tieng Viet' % o)
        # 5) prompt khong duoc bat dau bang so thu tu cua cau
        if re.match(r'^\d+[.\s]', qq['prompt']):
            errs.append('Q%d: prompt bat dau bang so thu tu' % o)
        # 6) doi chieu voi BANG DAP AN goc
        k = KEY[o].lower()
        ans = qq['answer'] if isinstance(qq['answer'], list) else [qq['answer']]
        if not any(a.lower() == k or a.lower().startswith(k + ' ') for a in ans):
            errs.append('Q%d: LECH dap an goc "%s" vs %s' % (o, KEY[o], ans))
    if note_orders != seen_note:
        errs.append('Unit %d: noteBody thua o trong: %s' % (u['unitNumber'], note_orders - seen_note))

if orders != list(range(1, 41)):
    errs.append('Thu tu cau sai/thieu: %s' % orders)
if NOTE3.count('[[40]]') != 2:
    errs.append('Cau 40 phai co dung 2 o [[40]]')

if errs:
    print('!!! CO LOI:')
    for e in errs:
        print(' -', e)
    sys.exit(1)

json.dump(data, open('tmp/ielts_master_reading_test46.json', 'w', encoding='utf-8'),
          ensure_ascii=False, indent=1)
print('OK - 40 cau, 3 passage, moi dan chung khop nguyen van, dap an khop bang goc.')
for u in data['units']:
    print(' ', u['title'], '|', len(u['content']), 'ky tu |', len(u['questions']), 'cau')
