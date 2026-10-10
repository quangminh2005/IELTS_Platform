# -*- coding: utf-8 -*-
"""Dựng file JSON import cho IELTS Master - Listening Test 48, 49, 50.

Nguồn (mỗi đề N):
  - đề:         Listening (41-50)/Test (41-50)/N/Test N.pdf
  - đáp án:     Listening (41-50)/Test (41-50)/N/Answer Sheet - N.docx
  - transcript: transcript/Listening_testN.docx
  - ảnh đề:     ảnh JPEG gốc nhúng trong PDF (không dính watermark)
Audio gốc N.mp3 đã cắt thành 4 part theo mốc trong AUDIO_NOTE (giây trên file gốc);
mỗi part giữ đủ 30s lặng cuối, part nào thiếu thì nối thêm anullsrc.

Chạy: python tmp/build48_50_listening.py
"""
import base64
import io
import json
import re
import sys

import fitz
from docx import Document

sys.stdout.reconfigure(encoding="utf-8")

ROOT = r"E:/ielts_master/listening"
TEST_DIR = ROOT + r"/Listening (41-50)/Test (41-50)"

AUDIO_NOTE = {
    48: [(0, 388.4), (388.0, 808.15), (807.75, 1269.4), (1269.0, None)],
    49: [(0, 347.9), (347.5, 740.9), (740.5, 1127.4), (1127.0, None)],
    50: [(0, 305.4), (305.0, 694.15), (693.75, 1080.4), (1080.0, None)],
}

BLOB = "https://yr2odb5jaalgrfbg.public.blob.vercel-storage.com/"
AUDIO = {
    48: ["test48_part1-IzhXvu7GDHrPxvAmdi7uKKfYgA0tbb", "test48_part2-IykAad86IbmATjV82ot4nTVSoEu85r",
         "test48_part3-oGMwmaNZsp0t4suxUnlHGdEzJZG7n1", "test48_part4-oqKtvJDmmL5t2vQEKe5tojq1eNKHxR"],
    49: ["test49_part1-XXPTAbKZSJvRR73xYQKC3cZ0LWOxQB", "test49_part2-sXU7wQzzGEOSjk3YrG7946YY5td1ld",
         "test49_part3-6UDM9Oc7b21h24VLzO6jKrx5R1gqJ7", "test49_part4-FrtZJGthZySVvE096HpAQvXFs70HhF"],
    50: ["test50_part1-87SGmwlA7JDjOn4LWIuIreZkQsry4Z", "test50_part2-iNvnJvQR56Gn2MiRJNpPnMQzWjbn6Y",
         "test50_part3-F7xwWPUMan7DM6mU5OaG0P5MgydN7Y", "test50_part4-UvBW93XiKbnADxgFpFsdXYMGdCKyIK"],
}

# Chuẩn hoá dấu nháy/gạch ngang cong của Word về ASCII cho khớp với dẫn chứng.
FIX = [
    (chr(0x2019), "'"), (chr(0x2018), "'"), (chr(0x201C), '"'), (chr(0x201D), '"'),
    (chr(0x2014), "-"), (chr(0x2013), "-"), (chr(0x2026), "..."), (chr(0x00A0), " "),
]


def clean(s):
    for a, b in FIX:
        s = s.replace(a, b)
    return s.strip()


def load_transcripts(n):
    doc = Document(ROOT + "/transcript/Listening_test%d.docx" % n)
    blocks, cur, idx = {}, None, None
    for p in doc.paragraphs:
        t = clean(p.text)
        m = re.fullmatch(r"Section ([1-4])", t)
        if m:
            if idx:
                blocks[idx] = cur
            idx, cur = int(m.group(1)), []
            continue
        # "[Pause]" là ghi chú quãng lặng, không phải lời đọc; dòng "v" lạc ở cuối file 50.
        if t and t != "[Pause]" and t != "v":
            cur.append(t)
    if idx:
        blocks[idx] = cur
    out = {k: "\n".join(v) for k, v in blocks.items()}
    for k in (1, 2, 3, 4):
        assert out.get(k), "Test %d thiếu Section %d" % (n, k)
    return out


def pdf_image(n):
    """Ảnh JPEG gốc nhúng trong PDF -> data URI (mỗi đề chỉ có 1 ảnh)."""
    d = fitz.open(TEST_DIR + "/%d/Test %d.pdf" % (n, n))
    for page in d:
        for info in page.get_images(full=True):
            img = d.extract_image(info[0])
            assert img["ext"] == "jpeg"
            return "data:image/jpeg;base64," + base64.b64encode(img["image"]).decode()
    raise SystemExit("Test %d không có ảnh" % n)


# ---------------------------------------------------------------- helpers ---
def mc(order, prompt, options, correct, expl, ev):
    letters = [correct] if isinstance(correct, str) else list(correct)
    return {
        "order": order, "questionType": "multiple_choice", "prompt": prompt, "options": options,
        "answer": [next(o for o in options if o.startswith(l + " ")) for l in letters],
        "explanation": expl, "evidence": ev,
    }


def match(order, prompt, options, letter, expl, ev):
    return {
        "order": order, "questionType": "matching", "prompt": prompt, "options": options,
        "answer": [next(o for o in options if o.startswith(letter + " "))],
        "explanation": expl, "evidence": ev,
    }


def blank(order, answers, expl, ev, qtype="note_completion"):
    return {
        "order": order, "questionType": qtype, "prompt": "Câu %d" % order,
        "answer": answers, "explanation": expl, "evidence": ev,
    }


def pair(orders, prompt, options, letters, expls, evs):
    """Dạng 'Choose TWO/THREE letters': mỗi câu mang trọn bộ đáp án, giải thích riêng từng chữ."""
    return [mc(o, prompt, options, letters, e, v) for o, e, v in zip(orders, expls, evs)]


def unit(n, num, title, instructions, metadata, questions):
    return {
        "unitType": "listening_part", "unitNumber": num, "title": title,
        "instructions": instructions,
        "content": "Listen to the recording and answer the questions below.",
        "defaultTimeLimitMinutes": 10,
        "audioUrl": BLOB + AUDIO[n][num - 1],
        "transcript": TR[n][num],
        "metadata": metadata,
        "questions": questions,
    }


def box(lines):
    return ":::box\n" + "\n".join(lines) + "\n:::"


ABC = "Choose the correct letter A, B or C."
TR = {n: load_transcripts(n) for n in (48, 49, 50)}
IMG = {n: pdf_image(n) for n in (48, 49, 50)}

# ============================================================== TEST 48 ====
P48_1_NOTE = """## Advice on plumbers and decorators
• Don't call a plumber during the [[1]]
• Look at trade website: www.[[2]].com"""

P48_1_TABLE = """| Name | Positive points | Negative points |
| --- | --- | --- |
| Peake's plumbing | • Pleasant and friendly<br>• Give [[3]] information<br>• Good quality work | • Always [[4]] |
| John Damerol Plumbing Services | • [[5]] than other companies<br>• Reliable | • Not very polite<br>• Tends to be [[6]] |
| Simonson Plasterers | • Able to do lots of different [[7]] | • More [[8]] than other companies |
| H.L. Plastering | • Reliable<br>• Also able to do [[9]] | • Prefers not to use long [[10]] |"""

t48_p1 = [
    blank(1, ["weekend", "weekends"],
          "Alistair khuyên tránh gọi thợ vào CUỐI TUẦN vì giá sẽ bị đội lên, đợi tới thứ Hai nếu được.",
          "try to avoid calling anybody on weekends"),
    blank(2, ["plasdeco"],
          "Trang web là www.plasdeco.com - Alistair còn đánh vần p-l-a-s-d-e-c-o, viết bằng chữ 'c' chứ không phải 'k'.",
          "It's www.plasdeco.com."),
    blank(3, ["clear"], "Peake's Plumbing giải thích thông tin cần thiết một cách RÕ RÀNG (in a clear way).",
          "they tell you information you need in a clear way", "table_completion"),
    blank(4, ["late", "unreliable"],
          "Điểm trừ của Peake's: lần nào cũng tới MUỘN. Ruth hỏi \"Are they reliable?\" thì Alistair nói đó chính là nhược điểm.",
          "Every single time I've used them, they arrive late", "table_completion"),
    blank(5, ["cheaper"],
          "Chất lượng của John Damerol chỉ ở mức ổn, ưu điểm chính là RẺ HƠN những người khác.",
          "Basically he comes out cheaper, you know, than other people.", "table_completion"),
    blank(6, ["messy"],
          "Ông ấy đến đúng hẹn (nên không phải unreliable) nhưng hay làm BỪA BỘN, phải dọn dẹp khá nhiều.",
          "he has the tendency to be messy", "table_completion"),
    blank(7, ["designs", "design"],
          "Simonson làm được nhiều KIỂU TRANG TRÍ khác nhau - Ruth tóm lại và Alistair xác nhận \"You've got it\".",
          "So they can do a variety of designs.", "table_completion"),
    blank(8, ["expensive"],
          "Nhược điểm của Simonson là ĐẮT HƠN các công ty khác.",
          "But it comes at a premium because they are more expensive, you know.", "table_completion"),
    blank(9, ["painting"],
          "Ruth hỏi có ai SƠN tường luôn không, Alistair nói đó đúng là điều ông định kể về Harry (H.L. Plastering).",
          "Do either of them do painting for you if you want? / That's what I was going to say", "table_completion"),
    blank(10, ["ladders", "ladder"],
          "Harry đã lớn tuổi nên tránh những việc phải dùng THANG cao.",
          "he avoids doing jobs which involve tall ladders", "table_completion"),
]

t48_p2 = [
    mc(11, "On Monday what will be the students' working day?",
       ["A 9 am - 5 pm", "B 8.45 am - 5 pm", "C 9 am - 4.45 pm"], "B",
       "Bình thường làm 9h-17h, nhưng thứ Hai là ngày đầu nên phải tới lúc 8h45 (quarter to nine) và vẫn về đúng giờ thường lệ (5 pm). Bẫy C: 4.45 không hề được nhắc.",
       "but on Monday, because it's your first day, we'd like you to arrive at quarter to nine. Please note, though, that you'll finish at the usual time."),
    mc(12, "While working in the museum students are encouraged to wear",
       ["A formal clothing such as a suit", "B cap with the museum logo", "C their own casual clothes"], "C",
       "Trong bảo tàng thì mặc ĐỒ THƯỜNG NGÀY của mình vì việc rất bụi bặm. Bẫy B: mũ có logo chỉ đội khi đi chuyến tham quan bên ngoài; vest (A) thì lạc lõng.",
       "But on a day-to-day basis in the museum itself, we say put on your own casual clothing"),
    mc(13, "If students are ill or going to be late they must inform",
       ["A the museum receptionist", "B their museum supervisor", "C their school placement tutor"], "A",
       "Phải gọi cho LỄ TÂN bảo tàng; lễ tân sẽ tự báo người hướng dẫn (B). Thầy ở trường (C) chỉ được báo khi nghỉ quá một ngày.",
       "then what we ask you to do is ring the museum receptionist"),
    mc(14, "The most popular task while on work placement is usually",
       ["A making presentations in local primary schools", "B talking to elderly people in care homes",
        "C conducting workshops in the museum"], "B",
       "Việc được yêu thích nhất (the most popular) là đến các viện dưỡng lão ghi lại ký ức của NGƯỜI CAO TUỔI. Bẫy C: xưởng nghệ thuật với trẻ em được nhắc trước nhưng không phải phổ biến nhất.",
       "or, the most popular, when they go out on our outreach work to residential homes, recording elderly people's memories"),
    mc(15, "The best form of preparation before starting their work placement is to read",
       ["A the history of the museum on the website", "B the museum regulations and safety guidance",
        "C notes made by previous work placement students"], "C",
       "Nên tìm đọc các bản đánh giá và GHI CHÚ CỦA HỌC SINH KHOÁ TRƯỚC. Bẫy A và B: lịch sử bảo tàng và quy định an toàn đều do người hướng dẫn phổ biến khi bắt đầu.",
       "it might be worthwhile if you get hold of evaluations and other notes made by students who've worked with us before"),
    blank(16, ["C"],
          "Vào cửa chính, cầu thang ở ngay trước mặt; bên phải là bức tượng ngựa (Statue), cửa ngay sau tượng là phòng ký tên -> ô C.",
          "To the right of this is the statue of the horse, and just behind that is a door. Go through that, and that's the sign-in office."),
    blank(17, ["I"],
          "Ở sân trung tâm gần lối vào có hòm quyên góp (Donations); cánh cửa ngay sau đó dẫn vào Gallery 1 -> ô I.",
          "there's a large chest where visitors put donations for the museum. The door just behind that leads to Gallery 1."),
    blank(18, ["H"],
          "Đi vòng ra sau quầy lễ tân, hộp chìa khoá nằm GIỮA phòng trưng bày lớn (Gallery 2) và hiệu sách -> ô H.",
          "walk behind reception, and it's between the large gallery and the bookshop"),
    blank(19, ["D"],
          "Đi vòng qua quầy lễ tân sẽ thấy tủ tròn nhỏ (ô E - chính là tủ trưng bày gốm); cửa vào bếp nằm ngay sau tủ đó -> ô D.",
          "go round the reception desk and you'll see a small circular cabinet. The door to the kitchen area is just behind that."),
    blank(20, ["G"],
          "Bảng tin nằm ở GÓC khu vui chơi, phía trong cùng, trên tường của Gallery 3 -> ô G (F cũng trên tường Gallery 3 nhưng không ở góc).",
          "This is in the corner of the play area, at the back, on the wall of Gallery 3."),
]

P48_3_OPTS = [
    "A It would be very rewarding for the student.",
    "B It is too ambitious.",
    "C It would be difficult to evaluate.",
    "D It wouldn't be sufficiently challenging.",
    "E It would involve extra costs.",
    "F It is beyond the student's current ability.",
    "G It is already being done by another student.",
    "H It would probably have the greatest impact on the company.",
]
G48_27 = ["A Personal relationships.", "B Cultural differences.", "C Division of labour.",
          "D Group leadership.", "E Group size."]
G48_29 = ["A Punctuality.", "B Organisation.", "C Accessibility.", "D Helpfulness.", "E Teaching materials."]

t48_p3 = [
    match(21, "Customer database", P48_3_OPTS, "D",
          "Dự án này rất đơn giản, Sam sẽ không học được gì mới -> KHÔNG ĐỦ THỬ THÁCH. Bẫy C: thầy nói nó DỄ đánh giá (simple enough to evaluate), ngược với C.",
          "but I don't think you'd get enough out of a project like that. You wouldn't learn anything new."),
    match(22, "Online sales catalogue", P48_3_OPTS, "B",
          "Thầy đồng ý với Sam: việc này quá lớn so với thời gian có được -> QUÁ THAM VỌNG.",
          "You're right, it's too much for the time you've got."),
    match(23, "Payroll", P48_3_OPTS, "A",
          "Thầy cho rằng Sam sẽ học được nhiều, mở rộng kỹ năng -> RẤT BỔ ÍCH cho bản thân. Bẫy G: có sinh viên làm việc tương tự từ hai năm trước, nhưng lần này khác và không còn ai đang làm.",
          "Mm, I think you'd get a lot out of a project like that."),
    match(24, "Stock inventory", P48_3_OPTS, "H",
          "Hệ thống kiểm kho điện tử có lẽ là LỢI ÍCH LỚN NHẤT cho công ty.",
          "An electronic inventory would probably be the biggest single benefit for the company."),
    match(25, "Internal security", P48_3_OPTS, "F",
          "Sam không biết làm hệ thống thẻ từ, thầy xác nhận việc này VƯỢT QUÁ TRÌNH ĐỘ hiện tại của Sam.",
          "At the moment, it's probably a bit beyond your level of knowledge."),
    match(26, "Customer services", P48_3_OPTS, "E",
          "Nếu phải tới tận nơi gặp khách hàng thì sẽ tốn tiền đi lại - PHÁT SINH CHI PHÍ chưa được thoả thuận.",
          "that would incur expenses that haven't been agreed with these companies"),
] + pair(
    (27, 28), "Which TWO problems do Sam and the tutor identify concerning group assignments?", G48_27, ["B", "E"],
    ["Hai đáp án đúng của cụm 27-28 là B và E. B: chỉ vài người nói còn số khác im lặng - thầy giải thích là do KHÁC BIỆT VĂN HOÁ, mỗi nơi có thói quen tham gia khác nhau. Bẫy A: cả nhóm là bạn bè, không có mâu thuẫn.",
     "Hai đáp án đúng của cụm 27-28 là B và E. E: Sam thấy nhóm QUÁ ĐÔNG, lần họp nào cũng có người vắng. Bẫy C, D: mọi người chia việc đều và trưởng nhóm làm rất tốt."],
    ["In some places, students are more used to listening than talking, and vice versa.",
     "But personally, I feel that there are just too many of us in the group."],
) + pair(
    (29, 30), "Which TWO problems does Sam identify concerning the lecturers?", G48_29, ["A", "C"],
    ["Hai đáp án đúng của cụm 29-30 là A và C. A: một số giảng viên hay ĐẾN MUỘN 10-15 phút. Bẫy B: chuyện xếp nhầm phòng (organisation) là của học kỳ trước, nay không còn.",
     "Hai đáp án đúng của cụm 29-30 là A và C. C: rất KHÓ GẶP RIÊNG giảng viên, giờ tiếp sinh viên họ cũng hay vắng. Bẫy D: khi gặp được thì họ rất nhiệt tình (supportive and friendly)."],
    ["some of the staff often turn up late",
     "it can be very difficult to get to see a lecturer individually"],
)

P48_4_NOTE = """# The Tawny Owl
Most [[31]] owl species in UK
Strongly nocturnal
## Habitat:
Mainly lives in [[32]] but can also be seen in urban areas, e.g. parks.
## Adaptations:
• Short wings and [[33]], for navigation
• Brown and [[34]] feathers, for camouflage
• Large eyes (more effective than those of [[35]]), for good night vision
• Very good spatial [[36]] for predicting where prey might be found
• Excellent [[37]] for locating prey from a perch
## Diet
Main food is small mammals.
Owls in urban areas eat more [[38]]
## Survival
Two thirds of young owls die within a [[39]]
Owls don't disperse over long distances.
Owls seem to dislike flying over large areas of [[40]]"""

t48_p4 = [
    blank(31, ["common"], "Trong các loài cú ở Anh, cú lông xám là loài PHỔ BIẾN nhất.",
          "of all the owl species in the UK, it's actually the most common one"),
    blank(32, ["woodland", "woodlands", "woods"], "Khảo sát những năm 1980 cho thấy loài cú này chủ yếu sống ở RỪNG.",
          "this owl is most likely to be found in woodland"),
    blank(33, ["tail"], "Cả cánh và ĐUÔI đều ngắn, giúp nó luồn lách giữa các thân cây.",
          "both its wings and its tail are short, which helps it to manoeuvre through the trees"),
    blank(34, ["grey", "gray"], "Bộ lông pha giữa nâu và XÁM, giúp ngụy trang khi đậu sát thân cây.",
          "the bird's plumage is a mixture of brown and grey"),
    blank(35, ["humans", "people"], "Thị lực của cú tốt hơn hẳn thị lực của CON NGƯỜI.",
          "The tawny owl's visual capacities are considerably better than those of humans."),
    blank(36, ["memory"], "Cú có TRÍ NHỚ rất tốt về địa hình từng khu vực, nhờ vậy đoán được con mồi ở đâu.",
          "its excellent memory of the layout of different areas"),
    blank(37, ["hearing"], "Ngoài mắt to, cú còn có THÍNH GIÁC rất tốt để định vị con mồi khi đậu trên cành.",
          "the owl's sense of hearing is excellent, and this helps it to locate potential prey as it sits on its perch"),
    blank(38, ["birds"], "Ở đô thị, cú có vẻ săn CHIM nhiều hơn. Bẫy: ếch, dơi, cá là món phụ của cú sống trong rừng.",
          "In urbanised landscapes, the owls seem to prey more on birds"),
    blank(39, ["year"], "Cứ ba con non thì hai con chết trong NĂM đầu tiên.",
          "two out of every three are likely to die within their first year"),
    blank(40, ["water"], "Cú có vẻ ngại bay qua những vùng NƯỚC rộng, nên vắng mặt ở nhiều hòn đảo.",
          "There also appears to be some reluctance to cross large bodies of water."),
]

test48 = {
    "title": "IELTS Master - Listening Test 48",
    "skill": "listening",
    "category": "book",
    "bookName": "IELTS Master – Listening",
    "sourceLabel": "IELTS Master - Listening Test 48",
    "description": "Listening Test 48: 4 phần, 40 câu (tìm thợ sửa ống nước và thợ trát tường / thực tập ở bảo tàng / chọn dự án IT cho công ty / loài cú lông xám).",
    "units": [
        unit(48, 1, "Listening Part 1 - Advice on plumbers and decorators",
             "You will hear a woman who has just moved into the area talking to a neighbour about problems she is having in her house. Answer questions 1-10.",
             {"groupInstructions": {
                 "1": "Complete the notes below. Write NO MORE THAN ONE WORD for each answer.",
                 "3": "Complete the table below. Write NO MORE THAN ONE WORD for each answer."},
              "noteBody": P48_1_NOTE, "tableBody": P48_1_TABLE},
             t48_p1),
        unit(48, 2, "Listening Part 2 - Museum work placement",
             "You will hear the education officer in a museum giving a talk to school students who are about to start a one-week work placement in the museum. Answer questions 11-20.",
             {"groupInstructions": {
                 "11": ABC,
                 "16": "Label the plan below. Write the correct letter A-I next to questions 16-20.\nWhere in the museum are the following places?"},
              "noteBody": ":::map\nSign-in office [[16]]\nGallery 1 [[17]]\nKey box [[18]]\nKitchen area [[19]]\nStaff noticeboard [[20]]\n:::",
              "images": [IMG[48]]},
             t48_p2),
        unit(48, 3, "Listening Part 3 - Company-based IT project",
             "You will hear a business studies student called Sam talking to his tutor about an IT project he is going to do for a local company called Turner's. Answer questions 21-30.",
             {"groupTitles": {"21": "Company projects"},
              "groupInstructions": {
                  # Đề gốc in "Choose FIVE answers" nhưng có 6 câu, 6 đáp án khác nhau -> sửa thành SIX.
                  "21": "What is the tutor's opinion of the following company projects?\n"
                        "Choose SIX answers from the box, and write the correct letter, A-H, next to questions 21-26.\n"
                        "Tutor's opinion\n" + box(P48_3_OPTS),
                  "27": "Choose TWO letters, A-E.\nWhich TWO problems do Sam and the tutor identify concerning group assignments?",
                  "29": "Choose TWO letters, A-E.\nWhich TWO problems does Sam identify concerning the lecturers?"}},
             t48_p3),
        unit(48, 4, "Listening Part 4 - The Tawny Owl",
             "You will hear a wildlife expert giving a talk to a group of bird lovers in the UK about a species called the tawny owl. Answer questions 31-40.",
             {"groupInstructions": {"31": "Complete the notes below. Write ONE WORD ONLY for each answer."},
              "noteBody": P48_4_NOTE},
             t48_p4),
    ],
}

# ============================================================== TEST 49 ====
P49_1_NOTE = """## Things to do:
• [[6]] furniture etc. in Trading Post
• [[7]] or sell kitchen things
• Get [[8]] first from second hand shop
• Give clothes to [[9]] shop
• [[10]] fridge and microwave to Andrea"""

t49_p1 = [
    mc(1, "What is Harry's problem?",
       ["A he does not want to sell his things", "B he needs to decide what to do with his possessions",
        "C he wants to take everything to England"], "B",
       "Harry có quá nhiều đồ không thể mang về nước và KHÔNG BIẾT XỬ LÝ chúng thế nào. Bẫy C: chính vì không mang hết về Anh được nên mới có vấn đề.",
       "I've got a lot of things I can't possibly take back with me, but I don't know what to do with them."),
    mc(2, "Which of the items below does Harry want to sell?",
       ["A a computer", "B a plant", "C a fridge"], "C",
       "Trong ba món ở hình, chỉ có TỦ LẠNH (fridge) được nhắc - Harry định đăng bán tủ lạnh cùng lò vi sóng và đồ nội thất. Máy tính và chậu cây không hề xuất hiện.",
       "I could advertise the fridge, the microwave, and the furniture."),
    mc(3, "Where is Harry going to advertise his books for sale?",
       ["A In the university bookshop.", "B In the student newspaper.", "C in the economics department"], "C",
       "Andrea gợi ý dán thông báo bán sách ở bảng tin nhà Hội sinh viên và ở KHOA KINH TẾ. Hiệu sách (A) và báo sinh viên (B) không được nhắc.",
       "on the notice boards in the Student Union building and in the economics department"),
    mc(4, "Andrea thinks it is unlikely students will buy the furniture because...",
       ["A they're all doing the same thing.", "B they live at home.", "C it's the summer vacation."], "C",
       "Sinh viên thường đi vắng CẢ MÙA HÈ nên lúc này không ai muốn mua đồ nội thất.",
       "but usually students are away all summer so they don't want to buy furniture now"),
    mc(5, "Andrea thinks that a second hand shop...",
       ["A may not pay well.", "B may not take your goods", "C may only take free goods"], "A",
       "Cửa hàng đồ cũ sẽ đến báo giá miễn phí, nhưng thường KHÔNG TRẢ ĐƯỢC BAO NHIÊU TIỀN. Bẫy C: chữ \"free\" là báo giá miễn phí (free quote), không phải nhận đồ cho không.",
       "But you don't usually get much money for that sort of stuff."),
    blank(6, ["advertise"],
          "Harry chốt: ĐĂNG QUẢNG CÁO bán đồ đắt tiền là đồ nội thất trên tờ Trading Post.",
          "Another alternative is to put an advertisement in the Trading Post. / I'll advertise the expensive stuff: the furniture"),
    blank(7, ["donate"],
          "Đồ bếp cũ có thể QUYÊN GÓP cho cửa hàng từ thiện hoặc bán - Harry sẽ hỏi giá trước rồi mới quyết định bán hay cho.",
          "another option is to donate the kitchen things to a charity shop / Find out how much they'll give me and then decide whether to sell them or give them away."),
    blank(8, ["quote", "a quote", "free quote", "a free quote"],
          "Nhờ cửa hàng đồ cũ BÁO GIÁ trước đã.",
          "Why don't you get a second-hand shop to give you a quote first?"),
    blank(9, ["charity"],
          "Quần áo còn tốt thì cửa hàng TỪ THIỆN cũng nhận.",
          "A charity shop will take them too, as long as they're in good condition."),
    blank(10, ["sell"],
          "Andrea muốn MUA tủ lạnh và lò vi sóng, nên Harry sẽ BÁN chúng cho Andrea.",
          "Well, actually, I'm interested in buying the fridge and the microwave, depending on the price of course."),
]

P49_2_NOTE = ("The Great Bath is [[15]] deep. Around the bath area are alcoves where there were [[16]] and tables "
              "where bathers could relax. The water temperature of the Sacred Spring is [[17]]. The water is rich in "
              "[[18]]. In Roman times, the Sacred Spring was well known for its [[19]]. The Temple was constructed "
              "between [[20]] AD.")

t49_p2 = [
    mc(11, "What can visitors use free of charge?", ["A pushchairs", "B child carriers", "C coats and bags"], "B",
       "Địu em bé (child carriers) được cho mượn MIỄN PHÍ. Bẫy A: xe đẩy chỉ được nhắc để so sánh; C: áo khoác, túi xách là đồ GỬI ở phòng giữ đồ, không phải đồ dùng miễn phí.",
       "we have child carriers, free of charge of course"),
    mc(12, "Which of the following can visitors buy at the shop?", ["A coins", "B refreshments", "C postcards"], "C",
       "Cửa hàng có áp phích, BƯU THIẾP, bản sao tượng, đồ chơi, sách... Tiền xu (A) và đồ ăn uống (B) không có trong danh sách.",
       "posters, postcards, replicas of the Gorgon's Head"),
    mc(13, "When did the Grand Opening of the baths occur?", ["A 1894", "B 1897", "C 1994"], "B",
       "Lễ khai trương là năm 1897. Bẫy A: 1894 là năm tạc các bức tượng để chuẩn bị cho lễ khai trương.",
       "they were sculpted in 1894 especially for the grand opening of the Baths in 1897"),
    mc(14, "The Romans built on the site",
       ["A after the Celts", "B before the Celts", "C at the same time as the Celts"], "A",
       "Người Celt là những người ĐẦU TIÊN xây ở đây; người La Mã đến SAU và cũng dựng một ngôi đền.",
       "And the first people to build here were the Celts / When the Romans came, they too built a temple here"),
    blank(15, ["1.6m", "1.6 m", "1.6 metres", "1.6 meters", "1.6metres", "1.6meters"],
          "Bể tắm sâu 1,6 mét. Bẫy: 40 mét là chiều cao của mái vòm cũ.",
          "The bath itself is 1.6 meters deep"),
    blank(16, ["benches"], "Các hốc tường quanh bể từng có GHẾ DÀI và có thể có bàn nhỏ để đồ ăn uống.",
          "would have had benches and possibly small tables for drinks and snacks"),
    blank(17, ["46", "46 degrees", "46°C", "46 °C", "46°", "46 degrees centigrade", "46 degrees celsius", "46 celsius"],
          "Nước suối thiêng phun lên ở 46 độ C. Bẫy: 64-96 độ là nhiệt độ nước ở độ sâu 2.500-4.500 mét dưới lòng đất.",
          "at a temperature of 46 degrees Centigrade"),
    blank(18, ["minerals"], "Ngoài nóng, nước còn giàu KHOÁNG CHẤT.",
          "the water is rich in minerals"),
    blank(19, ["healing powers"], "Người khắp đế chế La Mã tìm đến để thử KHẢ NĂNG CHỮA BỆNH của dòng suối.",
          "to try out its healing powers"),
    blank(20, ["60 and 70", "60-70", "60 to 70"], "Ngôi đền được xây trong khoảng năm 60 đến 70 sau Công nguyên.",
          "being built between 60 and 70 AD"),
]

P49_3_NOTE = """The best days for engineering students are [[21]].
Students can get useful suggestions about [[22]].
Use the internet to look at [[23]] before the event."""

G49_28 = ["A to get a job", "B to find out what employers want from you", "C to give employers your contact details",
          "D to discover which are the key companies to work for", "E to practice your communication skills",
          "F to make useful contacts"]

t49_p3 = [
    blank(21, ["Tuesday and Wednesday"],
          "Nên đi vào THỨ BA VÀ THỨ TƯ vì các công ty kỹ thuật xuất hiện nhiều nhất hai ngày đó, không phải thứ Hai hay cuối tuần.",
          "I'd suggest making sure you get along there on Tuesday and Wednesday."),
    blank(22, ["career paths"], "Fergus nghe nói hội chợ cho nhiều ý tưởng giá trị về CON ĐƯỜNG SỰ NGHIỆP.",
          "I've heard you can pick up some valuable ideas for career paths"),
    blank(23, ["company websites"], "Thầy dặn xem trước WEBSITE CÁC CÔNG TY để có cái mà trò chuyện tại gian hàng.",
          "Have a look at company websites so you've got the basis for a good conversation"),
    mc(24, "Fergus says that",
       ["A there is one company he is particularly interested in", "B he has done some research already",
        "C he knows the boss at one of the companies"], "B",
       "Fergus đã xem website một công ty hôm trước, thầy khen \"You've made a start already\" -> ĐÃ TÌM HIỂU TRƯỚC. Bẫy A: Fergus quan tâm thêm một vài hãng khác, không riêng một công ty; C: Fergus chỉ đọc bài phỏng vấn ông chủ, không quen biết.",
       "Yes, I was looking at one the other day. / You've made a start already."),
    mc(25, "The tutor thinks Fergus should",
       ["A prepare questions in advance", "B research the skills required for jobs before the event",
        "C find out what the starting salaries are"], "A",
       "Thầy dặn nghĩ sẵn sẽ HỎI GÌ trước khi tới. Bẫy B: kỹ năng cần cho công việc là NỘI DUNG câu hỏi, không phải việc phải tìm hiểu trước; C: lương chỉ bàn khi phỏng vấn.",
       "Remember to think about what you're going to ask people before you turn up."),
    mc(26, "Fergus plans",
       ["A to wear a suit and tie", "B to wear smart but casual clothes", "C to buy an outfit for the event"], "B",
       "Fergus sẽ mặc quần âu đẹp và áo khoác, không quá trang trọng -> LỊCH SỰ NHƯNG THOẢI MÁI. Bộ vest (A) để ở nhà bố mẹ, còn mua đồ mới (C) thì không.",
       "a nice pair of trousers and a jacket, nothing too formal"),
    mc(27, "The tutor suggests that Fergus",
       ["A should ask particular people certain questions", "B should avoid taking free gifts",
        "C should treat conversations like short interviews"], "A",
       "Mỗi công ty có nhiều người đại diện, thầy dặn hướng câu hỏi tới ĐÚNG NGƯỜI phù hợp. Quà tặng miễn phí (B) chỉ được nhắc khi kể vai trò của người bên marketing.",
       "Try and direct your questions towards the best person."),
] + pair(
    (28, 29, 30), "Why do the tutor and Fergus think it is useful to attend a jobs fair?", G49_28, ["B", "E", "F"],
    ["Ba đáp án đúng của cụm 28-30 là B, E, F. B: hội chợ chủ yếu để tìm hiểu xem các công ty CẦN GÌ ở ứng viên. Bẫy A: khó mà được hứa hẹn việc làm ngay.",
     "Ba đáp án đúng của cụm 28-30 là B, E, F. E: Fergus nói đây là dịp luyện KỸ NĂNG GIAO TIẾP như kết nối, gặp người mới, nói về bản thân.",
     "Ba đáp án đúng của cụm 28-30 là B, E, F. F: thầy nói có cơ hội làm quen với những NGƯỜI CÓ ÍCH. Bẫy C: chính nhà tuyển dụng đưa danh thiếp cho Fergus chứ không phải ngược lại."],
    ["It's more about discovering what companies are looking for in potential employees.",
     "they're a great opportunity to practice things like networking, meeting new people, talking about yourself",
     "you'll have the chance to get to know some useful people"],
)

P49_4_NOTE = """# Suggestions for Developing a Portfolio
• Get some artwork printed in magazines by entering [[36]]
• Also you can [[37]] and [[37]] mock up book pages.
• Make an effort to use a variety of artistic [[38]]
• Aim for recognition by dividing work into distinct [[39]]
• Possibly use [[40]]"""

G49_32 = ["A earning enough money", "B moving to a new environment", "C competing with other artists",
          "D having their work criticized"]

t49_p4 = [
    mc(31, "At the start of her talk Rebecca points out that new graduates can find it hard to",
       ["A get the right work", "B take sufficient breaks", "C motivate themselves"], "C",
       "Hồi đi học có bạn bè, thầy cô thúc đẩy; ra trường rồi thì vấn đề không phải cảm hứng hay giấy vẽ mà là CHÍNH MÌNH - khó TỰ TẠO ĐỘNG LỰC. Bẫy B: câu \"one more cup of coffee\" là ví dụ cho sự trì hoãn, không phải chuyện nghỉ giải lao.",
       "Suddenly, it isn't finding the inspiration or getting the right paper that's a problem-it's you."),
] + pair(
    (32, 33), "Which TWO of the following does Rebecca say worry new artists?", G49_32, ["A", "D"],
    ["Hai đáp án đúng của cụm 32-33 là A và D. A: kiếm đủ sống là thử thách thật sự với nghệ sĩ mới vào nghề.",
     "Hai đáp án đúng của cụm 32-33 là A và D. D: nghệ sĩ muốn được khen; nghe người khác CHÊ tác phẩm là trải nghiệm rất đau lòng. Bẫy B: đi mang tranh từ nơi này sang nơi khác không phải là chuyển tới môi trường mới."],
    ["It's a real challenge making a decent living as a new artist.",
     "If people don't like what they create, then it can be a very emotional and upsetting experience hearing them say this."],
) + [
    mc(34, "Rebecca decided to become an illustrator because it",
       ["A afforded her greater objectivity as an artist", "B offered her greater freedom of expression",
        "C allowed her to get her work published"], "A",
       "Vẽ minh hoạ giúp Rebecca TÁCH CẢM XÚC khỏi tác phẩm, vẽ theo chủ đề định sẵn và thực tế hơn -> khách quan hơn. Bẫy B: ngược lại, cô không còn vẽ \"từ trái tim\" nữa.",
       "this offered me the opportunity to become more emotionally detached from my work"),
    mc(35, "When she had developed a portfolio of illustrations, Rebecca found publishers",
       ["A more receptive to her work", "B equally cautious about her work", "C uninterested in her work"], "B",
       "Có hồ sơ tranh rồi nhưng chưa có tác phẩm in, các nhà xuất bản VẪN DÈ DẶT khi ký hợp đồng (chữ \"still\" = vẫn như trước).",
       "they tend to hold back still when it comes to offering a contract"),
    blank(36, ["competition", "competitions", "a competition"],
          "Cách thứ nhất: gửi tranh dự một CUỘC THI (cuộc thi thiết kế tử vi do tạp chí phụ nữ tài trợ).",
          "The first way was by submitting my work for a competition."),
    blank(37, ["design and print"],
          "Cách thứ hai: tự THIẾT KẾ VÀ IN vài trang sách mẫu ghép tranh với chữ. Gõ \"design\" vào ô đầu, \"print\" vào ô sau.",
          "The other approach I took was to design and print some mock-up pages of a book."),
    blank(38, ["styles", "techniques", "style", "technique"],
          "Rebecca có thể thay đổi PHONG CÁCH, không bị bó vào một KỸ THUẬT nào - đáp án gốc chấp nhận cả styles lẫn techniques.",
          "so that I could vary my style and wasn't limited to a certain technique"),
    blank(39, ["categories"], "Chia tác phẩm thành những NHÓM riêng biệt (tranh minh hoạ thiết kế tách khỏi tranh vẽ).",
          "One remedy for this is to separate your work into distinct categories."),
    blank(40, ["two names", "2 names"], "Làm việc dưới HAI CÁI TÊN giúp phân biệt rõ hai hướng sáng tác.",
          "Working under two names is also useful"),
]

test49 = {
    "title": "IELTS Master - Listening Test 49",
    "skill": "listening",
    "category": "book",
    "bookName": "IELTS Master – Listening",
    "sourceLabel": "IELTS Master - Listening Test 49",
    "description": "Listening Test 49: 4 phần, 40 câu (dọn đồ trước khi về nước / nhà tắm La Mã cổ / hội chợ việc làm / lời khuyên cho hoạ sĩ minh hoạ mới vào nghề).",
    "units": [
        unit(49, 1, "Listening Part 1 - Selling things before leaving",
             "You will hear a conversation between Harry and Andrea, two students who have just finished their final exams. Answer questions 1-10.",
             {"groupInstructions": {"1": ABC, "2": ABC, "3": ABC,
                                    "6": "Complete Harry's notes using NO MORE THAN TWO WORDS."},
              # Câu 2 chọn theo hình: ảnh gắn ngay trên câu 2 như đề gốc.
              "groupImages": {"2": [IMG[49]]},
              "noteBody": P49_1_NOTE},
             t49_p1),
        unit(49, 2, "Listening Part 2 - The Roman Baths",
             "You will hear a guide talking to visitors about a tourist attraction. Answer questions 11-20.",
             {"groupInstructions": {
                 "11": ABC,
                 "15": "Complete the summary below. Write NO MORE THAN THREE WORDS AND/ OR A NUMBER for each answer."},
              "noteBody": P49_2_NOTE},
             t49_p2),
        unit(49, 3, "Listening Part 3 - The jobs fair",
             "You will hear a conversation between a university tutor and a student about a jobs fair. Answer questions 21-30.",
             {"groupInstructions": {
                 "21": "Complete the sentences below. Write NO MORE THAN THREE WORDS for each answer.",
                 "24": ABC,
                 "28": "Choose THREE letters A-F.\nWhy do the tutor and Fergus think it is useful to attend a jobs fair?"},
              "noteBody": P49_3_NOTE},
             t49_p3),
        unit(49, 4, "Listening Part 4 - Getting your first job as an artist",
             "You will hear Rebecca Bramwell, an artist and illustrator, giving advice on how to get your first job or commission as an artist. Answer questions 31-40.",
             {"groupInstructions": {
                 "31": ABC,
                 "32": "Choose TWO letters A-D.\nWhich TWO of the following does Rebecca say worry new artists?",
                 "34": ABC,
                 "36": "Complete the notes below. Write NO MORE THAN THREE WORDS for each answer."},
              "noteBody": P49_4_NOTE},
             t49_p4),
    ],
}

# ============================================================== TEST 50 ====
P50_1_NOTE = """Area of interest: city centre
Rents: from £[[1]] to £1000 per month
Number of bedrooms required: [[2]]
Apartment 1: North Street
Rent: £[[3]] per month
Including [[4]]
Apartment 2: [[5]] Road
Rent: £625 per month
Viewing arrangements: meet [[6]] at
Place: [[7]]
Time: [[8]] pm
Also required: reference letter from [[9]]
One month's rent deposit
£[[10]] contract fee"""

t50_p1 = [
    blank(1, ["400", "£400"], "Giá thuê bắt đầu từ 400 bảng một tháng, cao nhất 1.000 bảng.",
          "Well, prices start at £400 a month, going up to £1,000 a month."),
    blank(2, ["2", "two"], "Kevin muốn căn HAI phòng ngủ.", "Two bedrooms would be nice."),
    blank(3, ["750", "£750"], "Căn ở North Street giá 750 bảng một tháng. Bẫy: 600 là mức Kevin muốn, 625 là giá căn thứ hai.",
          "it's a very nice apartment, but it's £750 a month"),
    blank(4, ["parking space", "a parking space", "private parking space", "a private parking space"],
          "Giá đó đã gồm một CHỖ ĐỖ XE riêng.", "But that includes a private parking space."),
    blank(5, ["Cornell"], "Căn thứ hai ở đường Cornell, người môi giới đánh vần C-O-R-N-E-L-L.",
          "It's in Cornell Road, at number 12B."),
    blank(6, ["Jason", "Jayson", "colleague", "agent", "agent's colleague", "the agent's colleague", "his colleague"],
          "Kevin sẽ gặp Jason - ĐỒNG NGHIỆP của người môi giới. Đáp án gốc chấp nhận cả Jayson/agent/colleague.",
          "So that'll be 5:15 with my colleague, Jason."),
    blank(7, ["apartment", "the apartment"], "Jason sẽ đợi Kevin ngay TẠI CĂN HỘ.", "He'll meet you at the apartment."),
    blank(8, ["5.15", "5:15", "5.15 pm", "5:15 pm"],
          "Ngày mai không ai rảnh, nên hẹn xem nhà lúc 5:15 chiều nay.",
          "But if you're free later today, you could see it at 5:15?"),
    blank(9, ["employer", "your employer", "my employer"], "Cần thư giới thiệu của NGƯỜI SỬ DỤNG LAO ĐỘNG xác nhận Kevin đang làm việc ở đó.",
          "a reference letter from your employer"),
    blank(10, ["60", "£60"], "Ngoài tiền đặt cọc một tháng còn có phí 60 bảng để làm hợp đồng.",
          "and a deposit, which is one month's rent plus a fee of £60"),
]

P50_2_NOTE = """3rd Floor: [[11]]
2nd Floor: cinema
1st Floor: [[12]]
Ground floor: small shops and [[13]]
Basement: car park
• The beach will be [[14]]
• This will attract [[15]]
• The plans will be on display from Monday, 5th March until [[16]], 6th [[17]]
• Suggestions can be placed in the [[18]]
• The next meeting will be on April [[19]]
• It will start at [[20]] pm"""

t50_p2 = [
    blank(11, ["cafe and restaurant", "café and restaurant", "a cafe and a restaurant", "a café and a restaurant",
               "cafe and a restaurant", "café and a restaurant"],
          "Tầng 3 sẽ là một QUÁN CÀ PHÊ VÀ NHÀ HÀNG, một phần ở ngoài trời.",
          "On the third floor will be a cafe and a restaurant."),
    blank(12, ["council offices"], "Tầng 1 là các VĂN PHÒNG CỦA HỘI ĐỒNG vì toà thị chính đã quá chật.",
          "And below that, on the first floor, will be some much-needed council offices."),
    blank(13, ["workshops", "workshop spaces", "five workshop spaces", "5 workshop spaces"],
          "Tầng trệt ngoài 20 gian hàng nhỏ còn có năm XƯỞNG LÀM VIỆC cho các cơ sở sản xuất nhỏ.",
          "Also on the ground floor will be five workshop spaces"),
    blank(14, ["expanded", "extended"], "Bãi biển sẽ được MỞ RỘNG thêm bằng 10.000 tấn cát.",
          "We're going to extend the beach."),
    blank(15, ["visitors", "tourists", "more visitors", "more tourists"],
          "Bãi biển đẹp sẽ thu hút thêm KHÁCH DU LỊCH tới thị trấn.",
          "we're hoping that a decent beach will attract more visitors to the town"),
    blank(16, ["Friday"], "Bản thiết kế được trưng bày tới THỨ SÁU, ngày 6 tháng 4.",
          "They'll be there from Monday the 5th of March until Friday the 6th of April"),
    blank(17, ["April"], "Ngày kết thúc trưng bày là thứ Sáu ngày 6 THÁNG TƯ (tháng 3 là ngày bắt đầu).",
          "They'll be there from Monday the 5th of March until Friday the 6th of April"),
    blank(18, ["suggestion box", "suggestions box", "box"], "Góp ý bỏ vào HÒM GÓP Ý đặt cùng phòng với bản thiết kế.",
          "There'll be a suggestions box in the same room as the plans."),
    blank(19, ["10", "10th", "the 10th"], "Buổi họp tiếp theo vào thứ Ba, ngày 10 tháng 4.",
          "Then on Tuesday, April the 10th, there'll be another public meeting"),
    blank(20, ["7", "seven", "7 o'clock"], "Buổi họp bắt đầu lúc 7 giờ.", "It'll start at 7 o'clock"),
]

P50_3_OPTS = ["A Expand it", "B Reduce it", "C Delete it"]

t50_p3 = [
    mc(21, "Maria's essay is",
       ["A better than her previous one", "B not quite as good as her previous one", "C similar to her previous one"], "A",
       "Thầy nói bài này TIẾN BỘ RẤT NHIỀU so với bài trước.", "It's a big improvement on the last one."),
    mc(22, "The tutor is impressed by",
       ["A the punctuation", "B the spelling", "C the style and choice of language"], "C",
       "Điểm thầy khen là VĂN PHONG VÀ CÁCH DÙNG TỪ đã hợp với bài học thuật. Bẫy A, B: dấu câu còn sơ sài, chính tả còn lỗi.",
       "In particular, the style and language are much more appropriate for an academic essay."),
    mc(23, "The tutor feels that Maria's use of English is",
       ["A generally acceptable", "B very poor", "C perfect"], "C",
       "Đáp án gốc của đề là C. Maria hỏi phần ngôn ngữ đã ổn chưa, thầy khẳng định \"Absolutely\" và nói cứ giữ như vậy thì không có vấn đề gì đáng kể.",
       "Absolutely. If you carry on like this, you shouldn't have any significant problems in that department."),
    mc(24, "How does Maria feel about this?", ["A she is very sad", "B she is relieved", "C she is delighted"], "B",
       "Maria vốn lo về văn phong nên nghe vậy thì NHẸ NHÕM (\"That's a relief\").", "That's a relief."),
    mc(25, "How does the tutor suggest Maria can improve her spelling?",
       ["A use a dictionary", "B use a computer spell checker", "C avoid difficult to spell words"], "B",
       "Maria dùng máy tính nước ngoài nên trình kiểm tra chính tả không chạy tiếng Anh; thầy gợi ý ĐỔI CÀI ĐẶT sang tiếng Anh để dùng được trình kiểm tra chính tả.",
       "Have you tried changing the setting to English?"),
    match(26, "the introduction", P50_3_OPTS, "B",
          "Phần mở bài nên ngắn lại, tối đa bằng một nửa hiện tại -> RÚT GỌN. Các ý quan trọng chuyển xuống thân bài.",
          "In general, I'd say your introductory section should be no more than half as long as it is at the moment."),
    match(27, "information on the railways", P50_3_OPTS, "A",
          "Đường sắt là yếu tố quan trọng nhưng Maria chỉ nhắc qua; thầy muốn viết NHIỀU HƠN -> MỞ RỘNG.",
          "I'd like to see a lot more on that"),
    match(28, "the quotation from The Times", P50_3_OPTS, "C",
          "Đoạn trích dẫn là thừa vì ý đã có dẫn chứng khác, nên BỎ HẲN đi. Bẫy B: Maria tưởng chỉ cần rút ngắn.",
          "You mean I could just get rid of it? / The quotation's redundant really."),
    match(29, "the conclusion", P50_3_OPTS, "A",
          "Kết bài chưa rõ quan điểm, thầy bảo THÊM vài dòng làm rõ -> MỞ RỘNG.",
          "I'd add a few lines clarifying your position."),
    match(30, "the bibliography", P50_3_OPTS, "B",
          "Chỉ cần liệt kê những sách thực sự đã đọc -> RÚT GỌN danh mục tài liệu.",
          "Just the books you actually consulted will be fine."),
]

P50_4_NOTE = """Sterilisation is usually performed only on [[33]].
Sterilisation is carried out in [[34]].
Cats remain there for [[35]].
To show that an animal has been sterilized, one [[36]]."""

P50_4_TABLE = """# Ways of publicizing the issue
| Method | Message | When |
| --- | --- | --- |
| Poster campaign | A kitten is not [[37]] | Now |
| [[38]] | Families may get bored with the responsibility of owning a pet | Perhaps before next Christmas |
| Newspaper advertisements | Abandoned animals cause problems for other people | [[39]] |"""

t50_p4 = [
    mc(31, "The main problem is", ["A cats in towns", "B the poor condition of feral cats", "C public awareness"], "C",
       "Vấn đề chính là NHẬN THỨC CỦA CÔNG CHÚNG - mọi người quen nhìn mèo hoang ốm yếu đến mức không coi đó là vấn đề. Bẫy B: tình trạng tồi tệ của mèo chỉ là hệ quả.",
       "The principal problem regarding this issue is much the same in Italy as it is in other countries: public awareness."),
    mc(32, "Emergency veterinary treatment is provided by",
       ["A the government", "B a small number of people", "C nobody"], "B",
       "Có những cá nhân tự lo thức ăn, chữa trị khẩn cấp cho mèo, nhưng họ chỉ giúp được một PHẦN NHỎ - tức chỉ một số ít người làm việc này.",
       "But these people can only provide support for a fraction of the vast numbers of feral cats that exist."),
    blank(33, ["females", "female cats", "female animals", "female"], "Triệt sản thường chỉ làm với mèo CÁI.",
          "Sterilisation is usually only performed on female animals."),
    blank(34, ["temporary centres", "temporary centre", "a temporary centre", "temporary centers", "temporary center"],
          "Mèo được đưa tới một TRUNG TÂM TẠM THỜI do tổ chức địa phương lập ra để phẫu thuật.",
          "They are then taken to a temporary centre set up by a local organisation"),
    blank(35, ["about 24 hours", "around 24 hours", "24 hours"], "Mèo được giữ lại trung tâm khoảng 24 GIỜ rồi thả về chỗ cũ.",
          "They are kept at the centre for around 24 hours"),
    blank(36, ["ear is clipped", "ear clipped", "ear tip is clipped", "ear tip clipped"],
          "Mèo đã triệt sản được CẮT CHÓP MỘT BÊN TAI làm dấu.",
          "each cat that has been operated on has the tip of one ear clipped"),
    blank(37, ["just for Christmas"], "Khẩu hiệu áp phích: \"A kitten is not just for Christmas\" - mèo con không chỉ là quà Giáng sinh.",
          "A kitten is not just for Christmas", "table_completion"),
    blank(38, ["radio ads", "radio advertisements", "radio adverts", "radio advertising"],
          "Chiến dịch QUẢNG CÁO TRÊN RADIO đang được lên kế hoạch, có thể trước Giáng sinh tới.",
          "a campaign of radio advertisements is planned, perhaps in the run-up to next Christmas", "table_completion"),
    blank(39, ["last year", "previous year", "the previous year"], "Quảng cáo trên báo được dùng vào NĂM NGOÁI.",
          "Last year, we used newspaper ads featuring pictures of emaciated strays", "table_completion"),
    mc(40, "A wider problem of feral cats is that they can",
       ["A injure children", "B damage human health", "C become infested with parasites"], "B",
       "Mèo hoang có thể thành MỐI NGUY CHO SỨC KHOẺ CON NGƯỜI (lây bệnh, ký sinh trùng). Bẫy A: trẻ em dễ bị ảnh hưởng vì hay sờ vào mèo, chứ mèo không làm trẻ bị thương; C: nhiễm ký sinh trùng là chuyện của mèo, còn ý rộng hơn là nguy hại cho người.",
       "can become a health hazard in various ways, including the spreading of disease and parasites"),
]

test50 = {
    "title": "IELTS Master - Listening Test 50",
    "skill": "listening",
    "category": "book",
    "bookName": "IELTS Master – Listening",
    "sourceLabel": "IELTS Master - Listening Test 50",
    "description": "Listening Test 50: 4 phần, 40 câu (thuê căn hộ / kế hoạch cải tạo khu bờ biển / góp ý bài luận / chương trình cứu trợ mèo hoang).",
    "units": [
        unit(50, 1, "Listening Part 1 - Renting an apartment",
             "You will hear a man called Kevin Brown talking to a letting agent about renting an apartment. Answer questions 1-10.",
             {"groupInstructions": {
                 "1": "Complete the form below, using NO MORE THAN THREE WORDS AND/OR A NUMBER for each answer."},
              "noteBody": P50_1_NOTE},
             t50_p1),
        unit(50, 2, "Listening Part 2 - Seafront redevelopment",
             "You will hear a member of the local council describing plans to redevelop part of the seafront of a coastal town. Answer questions 11-20.",
             {"groupInstructions": {
                 "11": "Complete the information below. Write NO MORE THAN THREE WORDS AND/ OR A NUMBER for each answer."},
              "noteBody": P50_2_NOTE,
              # noteBody không có :::map thì "images" bị đẩy sang cột đoạn văn (Listening
              # không có cột này) -> gắn ảnh vào nhóm 11 cho hiện ngay trên khối note.
              "groupImages": {"11": [IMG[50]]}},
             t50_p2),
        unit(50, 3, "Listening Part 3 - Improving an essay",
             "Maria is a student at university. She has handed the first draft of an essay to her tutor, and now they are discussing ways the essay can be improved. Answer questions 21-30.",
             {"groupInstructions": {
                 "21": ABC,
                 "26": "What suggestions does the tutor make?\nComplete the list below with the correct letters A, B or C.\n" + box(P50_3_OPTS)}},
             t50_p3),
        unit(50, 4, "Listening Part 4 - Feral cats",
             "You will hear a talk about stray cats. Answer questions 31-40.",
             {"groupInstructions": {
                 "31": ABC,
                 "33": "Complete the sentences below. Write NO MORE THAN THREE WORDS for each answer.",
                 "37": "Complete the table below. Write NO MORE THAN THREE WORDS for each answer.",
                 "40": ABC},
              "noteBody": P50_4_NOTE, "tableBody": P50_4_TABLE},
             t50_p4),
    ],
}


# ============================================================== kiểm tra ===
def validate(data):
    errs = []
    orders = [q["order"] for u in data["units"] for q in u["questions"]]
    if sorted(orders) != list(range(1, 41)):
        errs.append("số câu không phải 1..40: %s" % sorted(orders))
    for u in data["units"]:
        md = u["metadata"]
        body = (md.get("noteBody") or "") + "\n" + (md.get("tableBody") or "")
        tr = u["transcript"]
        for q in u["questions"]:
            o, t = q["order"], q["questionType"]
            if t in ("note_completion", "table_completion"):
                if "[[%d]]" % o not in body:
                    errs.append("câu %d không có ô [[%d]]" % (o, o))
                if body.count("[[%d]]" % o) > 1 and not any(" and " in a for a in q["answer"]):
                    errs.append("câu %d ô ghép nhưng đáp án không nối ' and '" % o)
            else:
                if not q["prompt"] or re.match(r"^\d+[.)]\s", q["prompt"]) or re.fullmatch(r"Câu \d+", q["prompt"]):
                    errs.append("câu %d prompt sai: %r" % (o, q["prompt"]))
                for a in q["answer"]:
                    if a not in q["options"]:
                        errs.append("câu %d đáp án ngoài options" % o)
            if not q.get("explanation"):
                errs.append("câu %d thiếu giải thích" % o)
            for piece in (q.get("evidence") or "").split(" / "):
                if not piece or piece not in tr:
                    errs.append("part %d câu %d dẫn chứng không khớp: %r" % (u["unitNumber"], o, piece))
        # ô [[n]] trong note/table phải thuộc đúng unit
        for m in re.findall(r"\[\[(\d+)\]\]", body):
            if int(m) not in [q["order"] for q in u["questions"]]:
                errs.append("part %d có ô [[%s]] không có câu" % (u["unitNumber"], m))
        for key in md.get("groupInstructions", {}):
            if int(key) not in [q["order"] for q in u["questions"]]:
                errs.append("part %d groupInstructions key %s lạc" % (u["unitNumber"], key))
    return errs


bad = False
for n, data in ((48, test48), (49, test49), (50, test50)):
    errs = validate(data)
    if errs:
        bad = True
        print("Test %d LỖI:" % n)
        for e in errs:
            print("  -", e)
        continue
    out = "tmp/ielts_master_listening_test%d.json" % n
    json.dump(data, open(out, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
    print("OK ->", out, "| transcript:", [len(u["transcript"]) for u in data["units"]])
sys.exit(1 if bad else 0)
