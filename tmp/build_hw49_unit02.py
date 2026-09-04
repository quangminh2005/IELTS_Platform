# -*- coding: utf-8 -*-
"""Dựng file JSON import cho bài về nhà Unit 02 (Grammar and Vocabulary, tr.31-33).

Chạy:  python tmp/build_hw49_unit02.py <duong-dan-Homework_49.pdf> [dau-ra.json]

Ảnh của bài 02 (8 bức) được cắt thẳng từ trang 1 của PDF và nhúng dạng data URI
vào metadata.groupImages -> không cần tải lên Vercel Blob.
"""
import base64
import io
import json
import sys

import pypdfium2 as pdfium
from PIL import Image

PDF = sys.argv[1] if len(sys.argv) > 1 else "Homework_49.pdf"
OUT = sys.argv[2] if len(sys.argv) > 2 else "tmp/homework49_unit02_grammar_vocab.json"

# Toạ độ (tỉ lệ theo chiều rộng/cao trang 1) của 8 bức ảnh bài 02.
PICTURE_BOXES = [
    (0.045, 0.365, 0.235, 0.625),
    (0.235, 0.375, 0.485, 0.600),
    (0.487, 0.375, 0.735, 0.615),
    (0.725, 0.405, 1.000, 0.640),
    (0.005, 0.625, 0.275, 0.920),
    (0.265, 0.615, 0.505, 0.885),
    (0.490, 0.665, 0.678, 0.965),
    (0.695, 0.635, 1.000, 0.900),
]


def picture_data_uris(pdf_path):
    page = pdfium.PdfDocument(pdf_path)[0].render(scale=4.0).to_pil()
    width, height = page.size
    uris = []
    for x0, y0, x1, y1 in PICTURE_BOXES:
        crop = page.crop(
            (int(x0 * width), int(y0 * height), int(x1 * width), int(y1 * height))
        ).convert("RGB")
        crop.thumbnail((330, 470), Image.LANCZOS)
        buf = io.BytesIO()
        crop.save(buf, "JPEG", quality=58, optimize=True)
        uris.append("data:image/jpeg;base64," + base64.b64encode(buf.getvalue()).decode())
    return uris


LETTER_GRID = [
    "EYDBSHOWER",
    "KPGARDENMS",
    "OBBSTUDYWI",
    "KVWERKGTEN",
    "IVSMSBMNEK",
    "TELEVISION",
    "CNDNXZRVSN",
    "HILTATTICF",
    "ESQWINDOWK",
    "NXJPMBLIND",
]
GRID_BOX = ":::box\n" + "\n".join(" | ".join(row) for row in LETTER_GRID) + "\n:::"

# --- Bài 03: hộp câu trả lời dùng chung A-H -------------------------------
MATCH_OPTIONS = [
    "A. Usually in the living room and sometimes in my bedroom.",
    "B. Usually in the study and sometimes in my bedroom.",
    "C. My comfortable bed and my posters.",
    "D. Yes. Go down the hall and it is next to the living room.",
    "E. My parents, my sister and my grandparents.",
    "F. Because I can't cook!",
    "G. Yes, and I think I'm quite good at it.",
    "H. Yes. I like it because I can spend time in the garden.",
]


def question(order, qtype, prompt, answer, explanation, options=None, points=1):
    item = {"order": order, "questionType": qtype, "prompt": prompt}
    if options:
        item["options"] = options
    item["answer"] = answer
    item["explanation"] = explanation
    item["points"] = points
    return item


# ==========================================================================
# PHẦN 1 - VOCABULARY (bài 01-05), câu 1-39
# ==========================================================================
unit1 = []

# Bài 01 - Read the definitions (câu 1-6)
definitions = [
    (1, "This is the place where you usually sleep every night.",
     ["bedroom", "a bedroom", "the bedroom"],
     "Phòng để ngủ mỗi đêm là bedroom (phòng ngủ)."),
    (2, "This is the place where you have a wash and brush your teeth.",
     ["bathroom", "a bathroom", "the bathroom"],
     "Nơi rửa mặt, đánh răng, tắm rửa là bathroom (phòng tắm)."),
    (3, "This is the place where people usually sit together to talk, play games or watch TV.",
     ["living room", "a living room", "the living room", "sitting room", "lounge"],
     "Phòng cả nhà ngồi nói chuyện, chơi, xem TV là living room (phòng khách). "
     "Sách Anh - Anh cũng chấp nhận sitting room / lounge."),
    (4, "This is the place where you keep the car.",
     ["garage", "a garage", "the garage"],
     "Chỗ để xe ô tô là garage (nhà để xe)."),
    (5, "This is the place that you walk through to move from one room to another.",
     ["hall", "a hall", "the hall", "hallway", "a hallway", "the hallway", "corridor"],
     "Lối đi nối các phòng với nhau là hall / hallway (hành lang trong nhà)."),
    (6, "This is the place where you can be outside and sit on the grass.",
     ["garden", "a garden", "the garden", "yard", "the yard"],
     "Khoảng ngoài trời có cỏ để ngồi chơi là garden (vườn)."),
]
for order, prompt, answer, explanation in definitions:
    unit1.append(question(order, "short_answer", f"{order}. {prompt}", answer, explanation))

# Bài 02 - Look at the pictures (câu 7-14)
pictures = [
    (7, "Ảnh 1", ["a fridge", "a freezer"], "a fridge",
     "Trong ảnh là tủ có ngăn để rau quả tươi ở nhiệt độ mát -> a fridge (tủ lạnh). "
     "Freezer là ngăn/tủ đông để đồ đông đá."),
    (8, "Ảnh 2", ["a terraced house", "a semi-detached house"], "a semi-detached house",
     "Ảnh chụp từng CẶP nhà dính nhau, mỗi cặp tách rời cặp bên cạnh -> semi-detached house "
     "(nhà song lập). Terraced house là cả DÃY nhà liền nhau."),
    (9, "Ảnh 3", ["a desk", "some drawers"], "some drawers",
     "Ảnh là tủ nhiều ngăn kéo có tay nắm -> some drawers (các ngăn kéo). "
     "Desk là bàn làm việc."),
    (10, "Ảnh 4", ["a living room", "a study"], "a living room",
     "Ảnh có ghế sofa, bàn trà và TV -> a living room (phòng khách). "
     "Study là phòng làm việc/học, thường có bàn và sách."),
    (11, "Ảnh 5", ["an attic", "a basement"], "an attic",
     "Ảnh chụp không gian dưới mái nhà, thấy rõ xà gỗ và cửa sổ mái -> an attic (gác mái). "
     "Basement nằm dưới mặt đất."),
    (12, "Ảnh 6", ["a wardrobe", "a cupboard"], "a cupboard",
     "Tủ trong ảnh chỉ có các NGĂN KỆ, không có thanh treo quần áo -> a cupboard (tủ chén/tủ kệ). "
     "Wardrobe là tủ treo quần áo."),
    (13, "Ảnh 7", ["a chair", "a sofa"], "a chair",
     "Ảnh là ghế đơn có lưng tựa cho một người ngồi -> a chair. Sofa là ghế dài, có đệm, ngồi nhiều người."),
    (14, "Ảnh 8", ["a university campus", "a private apartment block"], "a university campus",
     "Toà nhà lớn có sinh viên đi lại, bãi để xe đạp, sân chung -> a university campus "
     "(khuôn viên trường đại học)."),
]
for order, prompt, options, answer, explanation in pictures:
    unit1.append(question(order, "multiple_choice", prompt, answer, explanation, options=options))

# Bài 03 - Match the questions and answers (câu 15-22)
matches = [
    (15, "What do you like about your room?", 2,
     "Câu hỏi về việc THÍCH GÌ ở phòng mình -> trả lời kể ra đồ vật: giường êm và mấy tấm poster."),
    (16, "Who do you live with?", 4,
     "Hỏi sống VỚI AI -> trả lời liệt kê người trong nhà: bố mẹ, chị/em gái và ông bà."),
    (17, "Do you like to cook?", 6,
     "Câu hỏi Yes/No về sở thích nấu ăn -> 'Yes, and I think I'm quite good at it.'"),
    (18, "Where do you watch television?", 0,
     "Hỏi xem TV Ở ĐÂU -> trả lời nơi chốn: thường ở phòng khách, đôi khi ở phòng ngủ."),
    (19, "Is it often sunny where you live?", 7,
     "Hỏi nơi bạn sống có hay nắng không -> 'Yes. I like it because I can spend time in the garden.' "
     "(có nắng nên ra vườn chơi được)."),
    (20, "Where do you do your homework?", 1,
     "Hỏi làm bài tập Ở ĐÂU -> 'Usually in the study and sometimes in my bedroom.'"),
    (21, "Can you tell me where the bathroom is, please?", 3,
     "Hỏi đường tới phòng tắm -> câu chỉ đường: 'Go down the hall and it is next to the living room.'"),
    (22, "Why don't you often go in the kitchen?", 5,
     "Hỏi WHY -> câu trả lời bắt đầu bằng Because: 'Because I can't cook!'"),
]
for order, prompt, index, explanation in matches:
    unit1.append(
        question(order, "matching", prompt, MATCH_OPTIONS[index], explanation, options=MATCH_OPTIONS)
    )

# Bài 04 - Word search (câu 23-33)
word_search = [
    (23, "a _ _ _ _ (5 chữ cái)", "attic", "ATTIC nằm ở hàng 8, đọc từ trái sang phải (H I L T A T T I C F)."),
    (24, "b _ _ _ _ _ _ _ (8 chữ cái)", "basement",
     "BASEMENT nằm ở cột 4, đọc từ trên xuống (B A S E M E N T)."),
    (25, "b _ _ _ _ (5 chữ cái)", "blind", "BLIND nằm ở hàng 10, đọc từ trái sang phải (N X J P M B L I N D)."),
    (26, "d _ _ _ (4 chữ cái)", "desk",
     "DESK nằm ở đường chéo đi LÊN sang phải: D (hàng 7, cột 3) - E - S - K (hàng 4, cột 6)."),
    (27, "g _ _ _ _ _ (6 chữ cái)", "garden", "GARDEN nằm ở hàng 2, đọc từ trái sang phải (K P G A R D E N M S)."),
    (28, "k _ _ _ _ _ _ (7 chữ cái)", "kitchen", "KITCHEN nằm ở cột 1, đọc từ trên xuống (hàng 4 đến hàng 10)."),
    (29, "s _ _ _ _ _ (6 chữ cái)", "shower", "SHOWER nằm ở hàng 1, đọc từ trái sang phải (E Y D B S H O W E R)."),
    (30, "s _ _ _ (4 chữ cái)", "sink", "SINK nằm ở cột 10, đọc từ trên xuống (hàng 2 đến hàng 5)."),
    (31, "s _ _ _ _ (5 chữ cái)", "study", "STUDY nằm ở hàng 3, đọc từ trái sang phải (O B B S T U D Y W I)."),
    (32, "t _ _ _ _ _ _ _ _ _ (10 chữ cái)", "television", "TELEVISION chiếm trọn hàng 6."),
    (33, "w _ _ _ _ _ (6 chữ cái)", "window", "WINDOW nằm ở hàng 9, đọc từ trái sang phải (E S Q W I N D O W K)."),
]
for order, prompt, answer, explanation in word_search:
    unit1.append(question(order, "short_answer", prompt, [answer], explanation))

# Bài 05 - Correct the spelling mistake (câu 34-39)
spelling = [
    (34, 'I really like my "certains" - they are red and black, and they make my bedroom very dark.',
     ["curtains"], 'Rèm cửa viết đúng là "curtains" (không phải certains).'),
    (35, 'I have a bright "tabel lamb" that I use when I do my homework.',
     ["table lamp", "a table lamp"], 'Đèn bàn viết đúng là "table lamp": table (không phải tabel) và lamp (không phải lamb - lamb nghĩa là cừu non).'),
    (36, 'I think "potsers" make the walls look more interesting - don\'t you?',
     ["posters"], 'Áp phích dán tường viết đúng là "posters".'),
    (37, 'It is good to sleep with two "bilows" - it is very comfortable.',
     ["pillows"], 'Gối ngủ viết đúng là "pillows".'),
    (38, 'My brother never cooks - the only thing he can do is turn on the "uven"!',
     ["oven"], 'Lò nướng viết đúng là "oven".'),
    (39, 'Most of my clothes are in my "walldrobe" - the rest are in the drawers next to my bed.',
     ["wardrobe"], 'Tủ quần áo viết đúng là "wardrobe" (ward- chứ không phải wall-).'),
]
for order, prompt, answer, explanation in spelling:
    unit1.append(question(order, "short_answer", f"{order - 33}. {prompt}", answer, explanation))

# ==========================================================================
# PHẦN 2 - GRAMMAR (bài 06-08), câu 40-58
# ==========================================================================
unit2 = []


def sentence_answers(*variants):
    """Thêm bản không dấu câu cuối để học viên quên chấm/hỏi vẫn được tính đúng."""
    out = []
    for text in variants:
        out.append(text)
        stripped = text.rstrip(".?!")
        if stripped != text:
            out.append(stripped)
    return out


# Bài 06 - Rewrite using the question form (câu 40-44)
rewrite = [
    (40, "It is okay to come to your house this evening.",
     sentence_answers("Is it okay to come to your house this evening?"),
     "Câu có động từ to be 'is' -> đảo 'is' lên trước chủ ngữ 'it': Is it okay...?"),
    (41, "You can check that the windows are all closed before we go out.",
     sentence_answers("Can you check that the windows are all closed before we go out?"),
     "Có động từ khuyết thiếu 'can' -> đảo 'can' lên trước 'you': Can you check...?"),
    (42, "You are in the living room next to the kitchen.",
     sentence_answers("Are you in the living room next to the kitchen?"),
     "Động từ to be 'are' -> đảo lên trước 'you': Are you...?"),
    (43, "You want to sit in the garden.",
     sentence_answers("Do you want to sit in the garden?"),
     "Động từ thường 'want' ở thì hiện tại đơn -> mượn trợ động từ 'do': Do you want...?"),
    (44, "The apartments in the UK are very different from the apartments in your country.",
     sentence_answers(
         "Are the apartments in the UK very different from the apartments in your country?"),
     "Động từ to be 'are' -> đảo lên trước chủ ngữ 'the apartments in the UK'."),
]
for order, prompt, answer, explanation in rewrite:
    unit2.append(question(order, "short_answer", f"{order - 39}. {prompt}", answer, explanation))

# Bài 07 - Find the mistake (câu 45-50)
mistakes = [
    (45, "In my country, people live usually in apartments and not houses.",
     ["usually live", "people usually live", "people usually live in apartments",
      "In my country, people usually live in apartments and not houses.",
      "In my country, people usually live in apartments and not houses"],
     "SAI: trạng từ tần suất đứng TRƯỚC động từ thường -> 'people usually live', không phải 'people live usually'."),
    (46, "My uncle keeps his car always in the garage because it is very expensive.",
     ["always keeps", "always keeps his car", "my uncle always keeps his car",
      "My uncle always keeps his car in the garage because it is very expensive.",
      "My uncle always keeps his car in the garage because it is very expensive"],
     "SAI: 'always' phải đứng trước động từ thường 'keeps' -> 'My uncle always keeps his car in the garage'."),
    (47, "Our sink sometimes makes a very strange noise.",
     ["correct", "no mistake", "câu đúng", "dung", "đúng",
      "Our sink sometimes makes a very strange noise."],
     "ĐÚNG: 'sometimes' đã đứng trước động từ thường 'makes'."),
    (48, "I have a housemate but I don't see very often him - he is always studying.",
     ["I don't see him very often", "don't see him very often", "see him very often",
      "I do not see him very often",
      "I have a housemate but I don't see him very often - he is always studying."],
     "SAI: tân ngữ 'him' phải đứng ngay sau động từ, cụm 'very often' đưa xuống cuối -> "
     "'I don't see him very often'."),
    (49, "In your country, do people usually celebrate their 18th birthday with a party?",
     ["correct", "no mistake", "câu đúng", "dung", "đúng",
      "In your country, do people usually celebrate their 18th birthday with a party?"],
     "ĐÚNG: trong câu hỏi, trạng từ tần suất đứng sau chủ ngữ và trước động từ chính "
     "('do people usually celebrate')."),
    (50, "Do you prefer to do your homework in your bedroom?",
     ["correct", "no mistake", "câu đúng", "dung", "đúng",
      "Do you prefer to do your homework in your bedroom?"],
     "ĐÚNG: câu hỏi hiện tại đơn với 'do' đã đúng trật tự."),
]
for order, prompt, answer, explanation in mistakes:
    unit2.append(question(order, "short_answer", f"{order - 44}. {prompt}", answer, explanation))

# Bài 08 - Reorder the words (câu 51-58)
reorder = [
    (51, "does / he / washing / never / up / the",
     sentence_answers("He never does the washing up."),
     "'never' đứng trước động từ thường 'does' -> He never does the washing up. (never rửa bát)"),
    (52, "me / advice / you / some / give / can / ?",
     sentence_answers("Can you give me some advice?"),
     "Câu hỏi với 'can': Can + chủ ngữ + động từ + tân ngữ gián tiếp (me) + tân ngữ trực tiếp (some advice)?"),
    (53, "eight / house / leave / morning / the / I / in / always / at / my / o'clock",
     sentence_answers(
         "I always leave my house at eight o'clock in the morning.",
         "I always leave my house at eight o’clock in the morning."),
     "'always' đứng trước động từ 'leave'; trạng ngữ thời gian nhỏ (at eight o'clock) đứng trước "
     "trạng ngữ lớn (in the morning)."),
    (54, "off / time / your / does / what / alarm / go / usually / ?",
     sentence_answers("What time does your alarm usually go off?"),
     "Câu hỏi 'What time' + does + chủ ngữ + trạng từ tần suất + động từ: "
     "What time does your alarm usually go off?"),
    (55, "often / dinner / house / my / comes / to / cousin / for / my",
     sentence_answers("My cousin often comes to my house for dinner."),
     "'often' đứng trước động từ 'comes'; 'for dinner' chỉ mục đích đứng cuối câu."),
    (56, "live / future / do / the / where / to / in / want / you / ?",
     sentence_answers("Where do you want to live in the future?"),
     "Câu hỏi Wh-: Where + do + you + want to live + in the future?"),
    (57, "live / how / you / do / with / people / many / ?",
     sentence_answers("How many people do you live with?"),
     "'How many + danh từ' đứng đầu câu hỏi, giới từ 'with' bị đẩy xuống cuối."),
    (58, "on / campus / live / you / do / university / the",
     sentence_answers("Do you live on the university campus?"),
     "Câu hỏi Yes/No với động từ thường -> Do + you + live + on the university campus?"),
]
for order, prompt, answer, explanation in reorder:
    unit2.append(question(order, "short_answer", f"{order - 50}. {prompt}", answer, explanation))

# ==========================================================================
payload = {
    "title": "Homework 49 - Unit 02: Grammar and Vocabulary",
    "skill": "writing",
    "sourceLabel": "Homework 49 - Unit 02 / Grammar and Vocabulary (tr.31-33)",
    "description": (
        "Bài về nhà Unit 02: từ vựng về nhà cửa - phòng ốc - đồ đạc (bài 01-05) và ngữ pháp "
        "câu hỏi + trạng từ tần suất (bài 06-08). 58 câu, hệ thống tự chấm."
    ),
    "units": [
        {
            "unitType": "writing_task",
            "unitNumber": 1,
            "title": "Phần 1 - Vocabulary: nhà cửa, phòng ốc và đồ đạc (bài 01-05)",
            "instructions": (
                "Làm lần lượt 5 bài của sách: đọc định nghĩa viết từ, nhìn ảnh chọn từ, ghép câu hỏi "
                "với câu trả lời, tìm 11 từ trong bảng chữ cái và sửa lỗi chính tả. "
                "Máy chấm KHÔNG phân biệt chữ hoa - chữ thường."
            ),
            "content": (
                "UNIT 02 - GRAMMAR AND VOCABULARY\n"
                "Places and things in and around the home\n\n"
                "Phần 1 gồm 5 bài trong sách (01-05):\n"
                "- Bài 01: đọc định nghĩa, viết tên nơi chốn trong nhà.\n"
                "- Bài 02: nhìn 8 bức ảnh, chọn từ đúng.\n"
                "- Bài 03: ghép 8 câu hỏi với 8 câu trả lời.\n"
                "- Bài 04: tìm 11 từ về nhà cửa trong bảng chữ cái.\n"
                "- Bài 05: sửa lỗi chính tả của từ in nghiêng trong ngoặc kép.\n\n"
                "Lưu ý khi gõ đáp án: chỉ gõ từ/cụm từ được hỏi, không thêm dấu chấm cuối câu."
            ),
            "defaultTimeLimitMinutes": 25,
            "metadata": {
                "taskTag": "UNIT 02 - VOCABULARY",
                "groupTitles": {
                    "1": "Bài 01 - Definitions",
                    "7": "Bài 02 - Look at the pictures",
                    "15": "Bài 03 - Questions and answers",
                    "23": "Bài 04 - Word search",
                    "34": "Bài 05 - Spelling",
                },
                "groupInstructions": {
                    "1": (
                        "Read the definitions of places in and around the home and write the correct words.\n"
                        "Viết MỘT từ (hoặc cụm từ) tiếng Anh cho mỗi định nghĩa, không cần a/an/the."
                    ),
                    "7": (
                        "Look at the pictures and choose the correct answer.\n"
                        "Tám bức ảnh đánh số 1-8 đúng như trong sách (tr.31). Chọn phương án đúng "
                        "cho từng ảnh. (Đề gốc yêu cầu gạch chân - ở đây bấm chọn.)"
                    ),
                    "15": (
                        "Match the questions and answers.\n"
                        "Bấm một câu trả lời trong hộp bên phải rồi bấm vào ô trống của câu hỏi tương ứng. "
                        "Mỗi câu trả lời chỉ dùng MỘT lần."
                    ),
                    "23": (
                        "Find the 11 words about places and things in and around a home.\n"
                        + GRID_BOX
                        + "\nTừ nằm theo hàng ngang, cột dọc hoặc đường chéo. Mỗi câu cho sẵn chữ cái đầu "
                        "và số chữ cái của từ cần tìm - gõ đầy đủ từ đó."
                    ),
                    "34": (
                        "Correct the spelling mistake in each sentence.\n"
                        "Từ viết sai được đặt trong ngoặc kép. Chỉ gõ lại TỪ đã sửa đúng chính tả, "
                        "không cần chép cả câu."
                    ),
                },
            },
            "questions": unit1,
        },
        {
            "unitType": "writing_task",
            "unitNumber": 2,
            "title": "Phần 2 - Grammar: câu hỏi và trạng từ tần suất (bài 06-08)",
            "instructions": (
                "Ba bài ngữ pháp: viết lại câu thành câu hỏi, tìm lỗi sai về trật tự từ và sắp xếp "
                "từ thành câu đúng. Viết CẢ CÂU và nhớ dấu chấm hỏi ở cuối câu hỏi."
            ),
            "content": (
                "UNIT 02 - GRAMMAR AND VOCABULARY\n"
                "Question forms & adverbs of frequency\n\n"
                "Nhắc lại kiến thức cần dùng:\n"
                "- Câu hỏi Yes/No: động từ to be và động từ khuyết thiếu đảo lên TRƯỚC chủ ngữ "
                "(You are... -> Are you...? / You can... -> Can you...?).\n"
                "- Động từ thường ở hiện tại đơn thì mượn do/does: You want... -> Do you want...?\n"
                "- Trạng từ tần suất (always, usually, often, sometimes, never) đứng TRƯỚC động từ "
                "thường nhưng SAU động từ to be: He always leaves early. / He is always late.\n"
                "- Tân ngữ đứng ngay sau động từ, cụm chỉ tần suất kiểu 'very often' đứng CUỐI câu: "
                "I don't see him very often.\n\n"
                "Máy chấm không phân biệt chữ hoa - chữ thường, nhưng hãy viết đủ từ và đúng thứ tự."
            ),
            "defaultTimeLimitMinutes": 20,
            "metadata": {
                "taskTag": "UNIT 02 - GRAMMAR",
                "groupTitles": {
                    "40": "Bài 06 - Question forms",
                    "45": "Bài 07 - Find the mistakes",
                    "51": "Bài 08 - Reorder the words",
                },
                "groupInstructions": {
                    "40": (
                        "Rewrite the sentences using the question form.\n"
                        "Ví dụ (0): You help your parents with the housework. "
                        "-> Do you help your parents with the housework?\n"
                        "Viết CẢ câu hỏi và kết thúc bằng dấu ?"
                    ),
                    "45": (
                        "Find and underline the mistakes. Rewrite the mistake correctly. "
                        "Some sentences are correct.\n"
                        "Nếu câu SAI: gõ lại phần đã sửa cho đúng (vd: usually live). "
                        "Nếu câu ĐÚNG: gõ correct."
                    ),
                    "51": (
                        "Reorder the words to make correct sentences.\n"
                        "Viết cả câu, kết thúc bằng dấu chấm hoặc dấu hỏi."
                    ),
                },
            },
            "questions": unit2,
        },
    ],
}

payload["units"][0]["metadata"]["groupImages"] = {"7": picture_data_uris(PDF)}

with open(OUT, "w", encoding="utf-8") as handle:
    json.dump(payload, handle, ensure_ascii=False, indent=2)

total = sum(len(unit["questions"]) for unit in payload["units"])
print(f"Đã ghi {OUT}: {len(payload['units'])} phần, {total} câu.")
