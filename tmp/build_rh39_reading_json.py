# -*- coding: utf-8 -*-
"""Dựng JSON đề đọc Reading Homework 39 (Parkour) từ bản PDF 2 trang."""
import json

content = "\n\n".join([
    "A Parkour was developed in France in the 1980s by Raymond Belle and later by his son David Belle and his friends. It is based on military obstacle course training. The aim is to get from one point to another in any way you can, and express yourself while doing so. There are no limits on how you move in parkour: running, climbing, swinging, jumping, rolling and any other types of movement are possible. Parkour is more of a philosophy or set of ideas than a sport. It is a new way of seeing the environment and finding ways to go over, under, around, across or through obstacles.",
    "B Parkour can be done alone or in groups. The most famous group of traceurs (people who do parkour) were the Yamakasi, a group made up of David Belle and his friends and cousins. They formed in the late 1980s and became popular during the 1990s and 2000s after appearing in several films, documentaries and advertisements. In the Yamakasi, there were strict rules. Members had to arrive on time and they were not allowed to complain or make excuses. They valued humility, so they were not allowed to show off or compete with other members.",
    "C Parkour is a 'state of mind'. It is about getting over mental as well as physical barriers. It teaches people to touch the world and interact with it. It is about understanding what it means to be human. The organisation Parkour.net believes that parkour can never be a competitive sport. It is an art and is concerned with self-development. They say you can't ask, 'Who is the best at parkour?' Raymond Belle's advice is: 'If two roads open up before you, always take the more difficult one. Because you know you can travel the easy one.'",
    "D There are some gyms and camps where you can practise and learn parkour. However, many traceurs do not like the idea of special places for their activity. The idea behind parkour is to adapt to any environment and be creative about how you get through it. It is about freedom and self-expression. The founder of parkour refused to teach people how to do moves or get over obstacles. The whole point is to learn your own technique and way of moving. So the idea of having classes or a limited space to practise in conflicts with the values of parkour.",
    "E Parkour is also known as freerunning. Sometimes freerunning refers to another form of parkour developed by Sebastien Foucan, which has more focus on the individual. The term freerunning came out of the film Jump London (2003). It told the story of three French traceurs practising parkour around the famous monuments of London. Freerunning was the English translation of parkour. There are more similarities than differences between the two activities, and the Parkour UK website uses the two terms to refer to the same activity."
])

note_body = (
    "Parkour is an activity that involves [[9]] in many different ways through different "
    "environments. People who practise parkour are called [[10]]. They believe that parkour is "
    "not a sport and can never be part of a [[11]]. The values of parkour are adaptability, "
    "[[12]] and freedom. Parkour should not be taught because it is about discovering your own "
    "way of moving and overcoming [[13]]. Although there are gyms and other places where you can "
    "learn and practise parkour, many feel that this [[14]] with the values of the discipline. "
    "Freerunning is a type of parkour. However, it is more about [[15]] development than parkour, "
    "which is often, but not always, done as part of a group."
)

tfng = ["TRUE", "FALSE", "NOT GIVEN"]

questions = [
    dict(order=1, questionType="true_false_not_given", options=tfng,
         prompt="You have to use a limited number of moves in parkour.",
         answer="FALSE",
         explanation="Đoạn A khẳng định KHÔNG có giới hạn nào về cách di chuyển: chạy, trèo, đu, nhảy, lăn… đều được. Câu hỏi nói phải dùng một số động tác hạn chế → ngược với bài. → FALSE.",
         evidence="There are no limits on how you move in parkour: running, climbing, swinging, jumping, rolling and any other types of movement are possible."),
    dict(order=2, questionType="true_false_not_given", options=tfng,
         prompt="Parkour is mainly done in the countryside.",
         answer="NOT GIVEN",
         explanation="Bài chỉ nói parkour là cách nhìn mới về môi trường xung quanh và tìm đường vượt chướng ngại vật, KHÔNG hề nói nơi tập chủ yếu là nông thôn hay thành phố. → NOT GIVEN."),
    dict(order=3, questionType="true_false_not_given", options=tfng,
         prompt="Parkour began in the twentieth century.",
         answer="TRUE",
         explanation="Đoạn A ghi parkour hình thành ở Pháp trong thập niên 1980 — tức là thế kỷ 20. → TRUE.",
         evidence="Parkour was developed in France in the 1980s by Raymond Belle and later by his son David Belle and his friends."),
    dict(order=4, questionType="true_false_not_given", options=tfng,
         prompt="The Yamakasi did not allow latecomers.",
         answer="TRUE",
         explanation="Đoạn B: thành viên Yamakasi BUỘC phải đến đúng giờ, không được phàn nàn hay viện cớ. Vậy nhóm không chấp nhận người đến muộn. → TRUE.",
         evidence="Members had to arrive on time and they were not allowed to complain or make excuses."),
    dict(order=5, questionType="true_false_not_given", options=tfng,
         prompt="When doing parkour, Raymond Belle recommends that you always choose the easy route.",
         answer="FALSE",
         explanation="Lời khuyên của Raymond Belle ở đoạn C là luôn chọn đường KHÓ hơn, vì đường dễ thì bạn biết mình đi được rồi. Câu hỏi nói ngược lại. → FALSE.",
         evidence="Raymond Belle's advice is: 'If two roads open up before you, always take the more difficult one. Because you know you can travel the easy one.'"),
    dict(order=6, questionType="true_false_not_given", options=tfng,
         prompt="There are many gyms in France where you can do parkour.",
         answer="NOT GIVEN",
         explanation="Đoạn D chỉ nói có MỘT SỐ (some) phòng tập và trại tập parkour, không nói “nhiều” và cũng không nói ở Pháp. Đúng bẫy mà TIP nhắc: some ≠ many. → NOT GIVEN."),
    dict(order=7, questionType="true_false_not_given", options=tfng,
         prompt="The founder of parkour was a very good teacher of parkour.",
         answer="FALSE",
         explanation="Đoạn D nói người sáng lập parkour TỪ CHỐI dạy người khác cách làm động tác hay vượt chướng ngại vật, vì mỗi người phải tự tìm kỹ thuật của mình. Vậy không thể là “thầy dạy parkour rất giỏi”. → FALSE.",
         evidence="The founder of parkour refused to teach people how to do moves or get over obstacles."),
    dict(order=8, questionType="true_false_not_given", options=tfng,
         prompt="Freerunning and parkour are similar.",
         answer="TRUE",
         explanation="Đoạn E: giữa hai hoạt động này điểm GIỐNG nhiều hơn điểm khác, và trang Parkour UK dùng cả hai tên cho cùng một hoạt động. → TRUE.",
         evidence="There are more similarities than differences between the two activities, and the Parkour UK website uses the two terms to refer to the same activity."),
    dict(order=9, questionType="note_completion", prompt="Câu 9",
         answer=["moving", "H"],
         explanation="Sau “involves” phải là danh động từ (V-ing) → moving (H), không phải move (G) ở dạng nguyên thể. Đoạn A: không có giới hạn nào về cách di chuyển qua nhiều môi trường khác nhau.",
         evidence="There are no limits on how you move in parkour: running, climbing, swinging, jumping, rolling and any other types of movement are possible."),
    dict(order=10, questionType="note_completion", prompt="Câu 10",
         answer=["traceurs", "M"],
         explanation="Đoạn B định nghĩa thẳng: traceurs = những người tập parkour. → M traceurs.",
         evidence="The most famous group of traceurs (people who do parkour) were the Yamakasi, a group made up of David Belle and his friends and cousins."),
    dict(order=11, questionType="note_completion", prompt="Câu 11",
         answer=["competition", "C"],
         explanation="Đoạn C: Parkour.net tin rằng parkour không bao giờ có thể là môn thể thao thi đấu. Sau mạo từ “a” cần danh từ số ít → competition (C), không phải tournaments (L) số nhiều.",
         evidence="The organisation Parkour.net believes that parkour can never be a competitive sport."),
    dict(order=12, questionType="note_completion", prompt="Câu 12",
         answer=["creativity", "E"],
         explanation="Đoạn D nêu đúng ba giá trị: thích nghi (adapt), SÁNG TẠO (be creative → creativity) và tự do (freedom). Chỗ trống nằm giữa hai danh từ nên cũng phải là danh từ. → E creativity.",
         evidence="The idea behind parkour is to adapt to any environment and be creative about how you get through it. It is about freedom and self-expression."),
    dict(order=13, questionType="note_completion", prompt="Câu 13",
         answer=["barriers", "B"],
         explanation="Đoạn C: parkour là vượt qua rào cản tinh thần lẫn thể chất. “Overcoming” đi với barriers. → B barriers.",
         evidence="It is about getting over mental as well as physical barriers."),
    dict(order=14, questionType="note_completion", prompt="Câu 14",
         answer=["conflicts", "D"],
         explanation="Đoạn D: việc có lớp học hay không gian tập giới hạn XUNG ĐỘT với các giá trị của parkour. Chỗ trống cần động từ chia ngôi thứ ba số ít (this + V-s) → conflicts (D).",
         evidence="So the idea of having classes or a limited space to practise in conflicts with the values of parkour."),
    dict(order=15, questionType="note_completion", prompt="Câu 15",
         answer=["personal", "I"],
         explanation="Đoạn E: freerunning tập trung vào CÁ NHÂN nhiều hơn. Trước danh từ “development” cần tính từ → personal (I).",
         evidence="Sometimes freerunning refers to another form of parkour developed by Sebastien Foucan, which has more focus on the individual."),
]

material = {
    "title": "Reading Homework 39 – Parkour",
    "skill": "reading",
    "sourceLabel": "Reading Homework 39 – Unit 06 / Reading (tr.110–111)",
    "description": "Bài đọc Parkour (5 đoạn A–E), 15 câu: 1–8 True/False/Not Given, 9–15 điền từ vào đoạn tóm tắt từ hộp từ A–M. Tự chấm, có giải thích tiếng Việt và dẫn chứng.",
    "units": [
        {
            "unitType": "reading_passage",
            "unitNumber": 1,
            "title": "Parkour",
            "instructions": "You should spend about 20 minutes on Questions 1–15, which are based on the reading passage below. Đọc lướt bài trong 1 phút trước khi làm câu hỏi.",
            "content": content,
            "defaultTimeLimitMinutes": 20,
            "metadata": {
                "groupInstructions": {
                    "1": "Do the following statements agree with the information in the text?\nWrite\n:::box\nTRUE if the statement agrees with the information\nFALSE if the statement contradicts the information\nNOT GIVEN if there is no information on this\n:::\nTIP: Be careful of words like some, often, occasionally that change the meaning of a sentence. For example, some sports does not mean the same as many sports.",
                    "9": "Complete the summary of the text using the list of words A–M below.\n:::box\nA agrees | B barriers | C competition | D conflicts | E creativity\nF latecomers | G move | H moving | I personal | J respect\nK team | L tournaments | M traceurs\n:::\nUse the strategies you have learnt:\n- Read the whole summary first.\n- Decide what type of word is needed for each gap.\n- Make a prediction before looking at the words given.\n- Remember that there are more words than gaps.\n- Read the sentence, checking for grammar and meaning."
                },
                "noteBody": note_body
            },
            "questions": [
                {**q, "answer": q["answer"] if isinstance(q["answer"], list) else [q["answer"]], "points": 1}
                for q in questions
            ]
        }
    ]
}

with open("tmp/reading_homework_39_parkour.json", "w", encoding="utf-8") as fh:
    json.dump(material, fh, ensure_ascii=False, indent=2)
    fh.write("\n")
print("ok")
