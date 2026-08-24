# -*- coding: utf-8 -*-
"""Dung file JSON import cho IELTS Master - Listening Test 47.

Nguon:
  - de:         Listening (41-50)/Test (41-50)/47/Test 47.pdf
  - dap an:     Listening (41-50)/Test (41-50)/47/Answer Sheet - 47.docx
  - transcript: transcript/Listening_test47.docx
Audio goc 47.mp3 da cat thanh 4 part theo moc trong AUDIO_NOTE.
"""
import json
import re
import sys

from docx import Document

sys.stdout.reconfigure(encoding="utf-8")

DOCX = r"E:/ielts_master/listening/transcript/Listening_test47.docx"

# Moc cat audio (giay) tren file goc 47.mp3 - lay tu ffmpeg silencedetect.
# Moi part giu tron 30s lang "check your answers" o cuoi; cau "Now turn to
# Section N" duoc doc trong khoang giua hai part nen khong thuoc part nao.
AUDIO_NOTE = {1: (0, 382.0), 2: (388.4, 850.2), 3: (856.2, 1250.8), 4: (1255.9, None)}

# Chuan hoa dau nhay/gach ngang cong cua Word ve ASCII cho khop voi dan chung.
FIX = [
    (chr(0x2019), "'"),
    (chr(0x2018), "'"),
    (chr(0x201C), '"'),
    (chr(0x201D), '"'),
    (chr(0x2014), "-"),
    (chr(0x2013), "-"),
    (chr(0x2026), "..."),
    (chr(0x00A0), " "),
]


def clean(s):
    for a, b in FIX:
        s = s.replace(a, b)
    return s.strip()


# --- tach transcript theo Section ------------------------------------------
doc = Document(DOCX)
blocks, cur, idx = {}, None, None
for p in doc.paragraphs:
    t = clean(p.text)
    m = re.fullmatch(r"Section ([1-4])", t)
    if m:
        if idx:
            blocks[idx] = cur
        idx, cur = int(m.group(1)), []
        continue
    if t:
        cur.append(t)
if idx:
    blocks[idx] = cur

transcripts = {}
for n, lines in blocks.items():
    # "Now turn to Section N+1." nam ngoai doan audio da cat -> bo di.
    lines = [re.sub(r"\s*Now turn to Section [1-4]\.\s*$", "", l) for l in lines]
    transcripts[n] = "\n".join(l for l in lines if l)

for n in (1, 2, 3, 4):
    assert n in transcripts, "thieu Section %s" % n

AUDIO = {
    1: "https://yr2odb5jaalgrfbg.public.blob.vercel-storage.com/test47_part1-HiGsAJisIHPakRqtCLnHYUHUfoCON6",
    2: "https://yr2odb5jaalgrfbg.public.blob.vercel-storage.com/test47_part2-gBHV2m9F1iZvGGB4Fg8UgQdjRCey8q",
    3: "https://yr2odb5jaalgrfbg.public.blob.vercel-storage.com/test47_part3-QRZrXwBSm8XKh6CDMj0UprlZ2n4fnF",
    4: "https://yr2odb5jaalgrfbg.public.blob.vercel-storage.com/test47_part4-DDEExYzmmqDDH52rQuRNL9AXqoJUcn",
}


def mc(order, prompt, options, correct):
    """correct: chu cai (vd 'C') hoac danh sach chu cai (vd ['A', 'D'])."""
    letters = [correct] if isinstance(correct, str) else list(correct)
    return {
        "order": order,
        "questionType": "multiple_choice",
        "prompt": prompt,
        "options": options,
        "answer": [next(o for o in options if o.startswith(l + " ")) for l in letters],
    }


def match(order, prompt, options, letter):
    return {
        "order": order,
        "questionType": "matching",
        "prompt": prompt,
        "options": options,
        "answer": [next(o for o in options if o.startswith(letter + " "))],
    }


def note(order, answers):
    return {
        "order": order,
        "questionType": "note_completion",
        "prompt": "C\u00e2u %d" % order,
        "answer": answers,
    }


# ============================ PART 1 =======================================
P1_NOTE = """# Notes for holiday
## Travel information
Will email the flight number
- Must find out which [[1]] arriving at
- Best taxi company [[2]]
- Note: Simon lives in the [[3]] of the city
- Simon's cell phone number [[4]]
## What to pack
To wear:
- Casual clothes
- One smart dress - to wear at a [[5]]
- A good [[6]]
- Tough [[7]]
To read:
- Try to find book named [[8]] by Rex Campbell
For presents:
- For Janice [[9]]
- For Alec [[10]] (with racing pictures)"""

P1 = [
    (1, ["terminal", "the terminal"],
     "Simon \u0111o\xe1n Tanya s\u1ebd t\u1edbi Terminal 1 nh\u01b0ng Tanya ch\u01b0a bi\u1ebft, ph\u1ea3i t\xecm hi\u1ec3u l\u1ea1i m\xecnh h\u1ea1 c\xe1nh \u1edf NH\xc0 GA (terminal) n\xe0o.",
     "I presume you'll be coming into Terminal 1?"),
    (2, ["Pantera"],
     "H\u00e3ng taxi t\u1ed1t Simon gi\u1edbi thi\u1ec7u t\u00ean l\u00e0 Pantera - \u00f4ng c\u00f2n \u0111\u00e1nh v\u1ea7n P-A-N-T-E-R-A.",
     "There's a really good company called Pantera."),
    (3, ["east", "the east"],
     "Nh\u00e0 Simon n\u1eb1m \u1edf PH\u00cdA \u0110\u00d4NG th\u00e0nh ph\u1ed1. B\u1eaby: \"city centre\" l\u00e0 n\u01a1i Simon d\u1eb7n \u0111\u1eebng b\u1ea3o t\u00e0i x\u1ebf ch\u1edf t\u1edbi, kh\u00f4ng ph\u1ea3i \u0111\u00e1p \u00e1n.",
     "We're east of it, actually."),
    (4, ["07765328411", "07765 328411"],
     "Simon \u0111\u1ecdc s\u1ed1 di \u0111\u1ed9ng m\u1edbi c\u1ee7a m\u00ecnh: 07765 328411.",
     "Ready? It's 07765 328411."),
    (5, ["hotel restaurant", "hotel", "a hotel restaurant"],
     "C\u1ea7n m\u1ed9t chi\u1ebfc v\u00e1y l\u1ecbch s\u1ef1 \u0111\u1ec3 m\u1eb7c trong b\u1eefa t\u1ed1i sang tr\u1ecdng \u1edf NH\u00c0 H\u00c0NG KH\u00c1CH S\u1ea0N.",
     "we'll be having at least one fancy dinner in a hotel restaurant"),
    (6, ["raincoat", "rain coat"],
     "Mang \u00c1O M\u01afA lo\u1ea1i t\u1ed1t v\u00ec \u0111ang m\u00f9a m\u01b0a. B\u1eaby: \u00f4 (umbrella) b\u1ecb lo\u1ea1i v\u00ec Simon b\u1ea3o nh\u00e0 c\u00f3 s\u1eb5n r\u1ea5t nhi\u1ec1u, \u0111\u1eebng mang theo.",
     "But pack a raincoat, a good one"),
    (7, ["walking shoes", "shoes"],
     "Tanya nh\u1eafc mang GI\u00c0Y \u0110I B\u1ed8 ch\u1eafc ch\u1eafn, Simon x\u00e1c nh\u1eadn \u0111\u01b0\u1eddng \u1edf \u0111\u00e2y g\u1ed3 gh\u1ec1 n\u00ean gi\u00e0y ph\u1ea3i b\u1ec1n.",
     "And I'd better remember to pack my sturdy walking shoes."),
    (8, ["Mountain Lives"],
     "T\u00ean cu\u1ed1n s\u00e1ch l\u00e0 Mountain Lives; Tanya c\u00f2n d\u1eebng l\u1ea1i \u0111\u1ec3 ch\u00e9p cho k\u1ecbp.",
     "It's called Mountain Lives"),
    (9, ["chocolate", "chocolates", "some chocolate"],
     "Janice gi\u1edd \u00edt u\u1ed1ng tr\u00e0 n\u00ean m\u00f3n qu\u00e0 h\u1ee3p l\u00e0 S\u00d4 C\u00d4 LA - th\u1ee9 b\u00e0 th\u00edch nh\u1ea5t. B\u1eaby: \"English tea\" l\u00e0 \u00fd ban \u0111\u1ea7u c\u1ee7a Tanya nh\u01b0ng \u0111\u00e3 b\u1ecb b\u00e1c.",
     "But she'd love some chocolate"),
    (10, ["calendar", "a calendar"],
     "Alec v\u1eabn m\u00ea \u0111ua ng\u1ef1a n\u00ean Tanya t\u00ednh t\u1eb7ng cu\u1ed1n L\u1ecaCH c\u00f3 \u1ea3nh \u0111ua ng\u1ef1a.",
     "I was thinking of bringing a calendar, you know, with horse racing pictures."),
]

p1 = []
for order, answers, expl, ev in P1:
    q = note(order, answers)
    q["explanation"], q["evidence"] = expl, ev
    p1.append(q)

# ============================ PART 2 =======================================
P2_MC = [
    (11, "According to the speaker, in what way is Camber's different from other theme parks?",
     ["A it is suitable for different age groups",
      "B it offers lots to do in wet weather",
      "C it has a focus on education"], "C",
     "Camber's c\u0169ng c\u00f3 tr\u00f2 ch\u01a1i cho m\u1ecdi l\u1ee9a tu\u1ed5i GI\u1ed0NG c\u00e1c c\u00f4ng vi\u00ean kh\u00e1c (n\u00ean A sai), \u0111i\u1ec3m KH\u00c1C bi\u1ec7t l\u00e0 ch\u00fa tr\u1ecdng tr\u1ea3i nghi\u1ec7m GI\u00c1O D\u1ee4C. Ho\u1ea1t \u0111\u1ed9ng trong nh\u00e0 ch\u1ec9 l\u00e0 ph\u1ee5 n\u00ean B sai.",
     "but Cambers also places strong emphasis on the educational experience for its visitors"),
    (12, "The park first opened in",
     ["A 1980", "B 1997", "C 2004"], "B",
     "C\u00f4ng vi\u00ean \u0111\u01b0\u1ee3c l\u1eadp n\u0103m 1997; 2004 ch\u1ec9 l\u00e0 n\u0103m \u0110\u1ed4I CH\u1ee6, kh\u00f4ng ph\u1ea3i n\u0103m m\u1edf c\u1eeda.",
     "The park was set up in 1997 by the Camber family, but then taken over by new owners in 2004"),
    (13, "What is included in the entrance fee?",
     ["A most rides and parking",
      "B all rides and some exhibits",
      "C parking and all rides"], "A",
     "H\u1ea6U H\u1ebeT (ch\u1ee9 kh\u00f4ng ph\u1ea3i t\u1ea5t c\u1ea3) tr\u00f2 ch\u01a1i \u0111\u01b0\u1ee3c mi\u1ec5n ph\u00ed - tr\u00f2 m\u1edbi nh\u1ea5t v\u1eabn thu th\u00eam ti\u1ec1n - v\u00e0 g\u1eedi xe th\u00ec mi\u1ec5n ph\u00ed.",
     "All but one of these is free once you've paid your entrance fee. / You don't pay anything for parking."),
    (14, "Becoming a member of the Adventurers Club means",
     ["A you can avoid queuing so much",
      "B you can enter the park free for a year",
      "C you can visit certain zones closed to other people"], "A",
     "H\u1ed9i vi\u00ean c\u00f3 l\u00e0n \u0111i ri\u00eang n\u00ean KH\u00d4NG PH\u1ea2I X\u1ebeP H\u00c0NG. B\u1eaby: ch\u1ec9 gi\u1ea3m 50% gi\u00e1 v\u00e9 ch\u1ee9 kh\u00f4ng mi\u1ec5n ph\u00ed (B sai).",
     "and a special lane for all rides and exhibits, which means you don't have to wait to get into any part of the park"),
    (15, "The Future Farm zone encourages visitors to",
     ["A buy animals as pets",
      "B learn about the care of animals",
      "C get close to the animals"], "C",
     "\u0110i\u1ec3m nh\u1ea5n c\u1ee7a khu n\u00e0y l\u00e0 \u0110\u01af\u1ee2C L\u1ea0I G\u1ea6N con v\u1eadt - c\u00f3 th\u1ec3 vu\u1ed1t ve v\u00e0 mua th\u1ee9c \u0103n cho ch\u00fang. Mua TH\u1ee8C \u0102N ch\u1ee9 kh\u00f4ng ph\u1ea3i mua con v\u1eadt (A sai).",
     "The emphasis is on getting near to the animals."),
    (16, "When is hot food available in the park?",
     ["A 10 am - 5.30 pm", "B 11 am - 5 pm", "C 10.30 am - 5 pm"], "B",
     "\u0110\u1ed2 \u0102N N\u00d3NG b\u00e1n t\u1eeb 11h \u0111\u1ebfn 17h. B\u1eaby: 10h-17h30 l\u00e0 gi\u1edd m\u1edf c\u1eeda c\u1ea3 c\u00f4ng vi\u00ean, \u00e1p d\u1ee5ng cho \u0111\u1ed3 u\u1ed1ng l\u1ea1nh v\u00e0 \u0111\u1ed3 \u0103n v\u1eb7t.",
     "And hot food is available most of the day in the Hungry Horse Cafe from 11:00 until 5:00"),
]

P2_OPTS = [
    "A Must be over a certain age",
    "B Must use special safety equipment",
    "C Must avoid it if they have health problems",
    "D Must wear a particular type of clothing",
    "E Must be over a certain height",
    "F Must be accompanied by an adult if under 16",
]

P2_MATCH = [
    (17, "River Adventure", "F",
     "Tr\u1ebb d\u01b0\u1edbi 8 tu\u1ed5i v\u1eabn ch\u01a1i \u0111\u01b0\u1ee3c, nh\u01b0ng m\u1ecdi ng\u01b0\u1eddi D\u01af\u1edaI 16 TU\u1ed4I ph\u1ea3i c\u00f3 ng\u01b0\u1eddi l\u1edbn \u0111i k\u00e8m.",
     "Children under 8 can go on this ride, but all under-16s must have an adult with them."),
    (18, "Jungle Jim Rollercoaster", "B",
     "M\u1ed7i gh\u1ebf c\u00f3 D\u00c2Y AN TO\u00c0N v\u00e0 b\u1eaft bu\u1ed9c th\u1eaft su\u1ed1t h\u00e0nh tr\u00ecnh - \u0111\u00f3 l\u00e0 thi\u1ebft b\u1ecb an to\u00e0n \u0111\u1eb7c bi\u1ec7t.",
     "with safety belts for each passenger, which must be worn at all times"),
    (19, "Swoop Slide", "D",
     "Kh\u00f4ng gi\u1edbi h\u1ea1n tu\u1ed5i hay chi\u1ec1u cao, nh\u01b0ng b\u1eaft bu\u1ed9c m\u1eb7c QU\u1ea6N D\u00c0I \u0111\u1ec3 kh\u1ecfi b\u1ecb b\u1ecfng do ma s\u00e1t.",
     "you must have on long trousers so you won't get any speed burns"),
    (20, "Zip Go-carts", "E",
     "Ng\u01b0\u1eddi ch\u01a1i ph\u1ea3i CAO tr\u00ean 1,2 m \u0111\u1ec3 v\u1edbi t\u1edbi b\u00e0n \u0111\u1ea1p - \u0111\u00e2y l\u00e0 \u0111i\u1ec1u ki\u1ec7n chi\u1ec1u cao, kh\u00f4ng ph\u1ea3i tu\u1ed5i.",
     "All riders must be above 1.2 metres because they have to be able to reach the pedals"),
]

p2 = []
for order, prompt, opts, letter, expl, ev in P2_MC:
    q = mc(order, prompt, opts, letter)
    q["explanation"], q["evidence"] = expl, ev
    p2.append(q)
for order, prompt, letter, expl, ev in P2_MATCH:
    q = match(order, prompt, P2_OPTS, letter)
    q["explanation"], q["evidence"] = expl, ev
    p2.append(q)

# ============================ PART 3 =======================================
P3_G1 = ["A Listening skills are often overlooked in business training",
         "B Learning to listen well is a skill that is easy for most people to learn",
         "C It is sometimes acceptable to argue against speakers",
         "D Body language is very important when listening",
         "E Listeners should avoid interrupting speakers"]
P3_G2 = ["A Meetings should start with a clear statement of goals",
         "B It is important for each individual's goals to be explained",
         "C Everybody in the group should have the same goals",
         "D Goals should be a mix of the realistic and the ideal",
         "E Goals must always to be achievable within a set time"]
P3_G3 = ["A It does not explore the topic in enough detail",
         "B It only discusses conservative views",
         "C It says nothing about the potential value of conflict",
         "D It talks too much about winners and losers",
         "E It does not provide definitions of key terms"]

P3_PAIRS = [
    ((21, 22), "What TWO things do Brad and Helen agree to say about listening in groups?",
     P3_G1, ["A", "D"],
     "A: c\u1ea3 hai th\u1ed1ng nh\u1ea5t k\u1ef9 n\u0103ng l\u1eafng nghe \u00cdT \u0111\u01b0\u1ee3c d\u1ea1y trong ng\u00e0nh c\u1ee7a h\u1ecd. D: Helen nh\u1ea5n m\u1ea1nh s\u1ee9c m\u1ea1nh c\u1ee7a t\u01b0 th\u1ebf, c\u1eed ch\u1ec9 (ng\u00f4n ng\u1eef c\u01a1 th\u1ec3) v\u00e0 Brad \u0111\u1ed3ng t\u00ecnh. B\u1eaby B: Brad cho l\u00e0 d\u1ec5 h\u1ecdc nh\u01b0ng Helen ph\u1ea3n \u0111\u1ed1i n\u00ean KH\u00d4NG ph\u1ea3i \u0111i\u1ec1u hai ng\u01b0\u1eddi \u0111\u1ed3ng thu\u1eadn.",
     "Effective listening in groups, because it's not something that's frequently covered on courses in our field. / Something I do think we should emphasise is the power of the listener's posture, gestures, etc., in making speakers feel respected."),
    ((23, 24), "What TWO things does the article say about goal setting?",
     P3_G2, ["B", "E"],
     "B: b\u00e0i b\u00e1o n\u00f3i m\u1ecdi th\u00e0nh vi\u00ean ph\u1ea3i \u0111\u01b0\u1ee3c cho th\u1eddi gian tr\u00ecnh b\u00e0y m\u1ee5c ti\u00eau RI\u00caNG c\u1ee7a m\u00ecnh. E: m\u1ee5c ti\u00eau ph\u1ea3i kh\u1ea3 thi TRONG M\u1ed8T KHUNG TH\u1edcI GIAN nh\u1ea5t \u0111\u1ecbnh. B\u1eaby C: Brad b\u00e1c b\u1ecf \u00fd \"c\u1ea3 nh\u00f3m chung m\u1ed9t m\u1ee5c ti\u00eau\" l\u00e0 n\u00f3i qu\u00e1.",
     "Well, firstly, it says that all group members must be given time to explain their own goals. / ...achievable within a particular time?"),
    ((25, 26), "What TWO things do Brad and Helen agree are weak points in the article's section on conflict resolution?",
     P3_G3, ["B", "C"],
     "B: b\u00e0i b\u00e1o b\u1ecf qua c\u00e1c l\u00fd thuy\u1ebft C\u1ea4P TI\u1ebeN, t\u1ee9c ch\u1ec9 n\u00eau quan \u0111i\u1ec3m b\u1ea3o th\u1ee7. C: kh\u00f4ng n\u00f3i t\u1edbi vi\u1ec7c xung \u0111\u1ed9t \u0111\u00f4i khi l\u1ea1i L\u00c0NH M\u1ea0NH cho nh\u00f3m. B\u1eaby A: ch\u1ec9 m\u00ecnh Brad ch\u00ea thi\u1ebfu chi ti\u1ebft, Helen l\u1ea1i th\u1ea5y vi\u1ebft qu\u00e1 d\u00e0i; b\u1eaby E: Helen n\u00f3i b\u00e0i C\u00d3 \u0111\u1ecbnh ngh\u0129a kh\u00e1 k\u1ef9.",
     "It didn't mention some of the more radical theories. / And also, I think it could have said more about conflict sometimes being healthy in groups."),
]

P3_OPTS = ["A Contact the tutor for clarification",
           "B Check the assignment specifications",
           "C Leave it until the last task",
           "D Ask a course-mate to help",
           "E Find information on the internet",
           "F Look through course handbooks"]

P3_MATCH = [
    (27, "Preparing the powerpoint", "C",
     "Brad nh\u1eadn l\u00e0m PowerPoint nh\u01b0ng \u0110\u1ec2 SAU C\u00d9NG, khi m\u1ecdi th\u1ee9 kh\u00e1c \u0111\u00e3 xong. B\u1eaby D: Helen k\u00e9m PowerPoint nh\u01b0ng kh\u00f4ng ai nh\u1edd b\u1ea1n h\u1ecdc gi\u00fap vi\u1ec7c n\u00e0y.",
     "I'm quite happy using PowerPoint, and I'll put it together when everything else is ready. / That's a relief! But yes, do that later."),
    (28, "Using direct quotations", "B",
     "Helen \u0111\u1ecbnh email h\u1ecfi gi\u1ea3ng vi\u00ean nh\u01b0ng Brad b\u1ea3o KH\u00d4NG C\u1ea6N, c\u1ee9 xem l\u1ea1i B\u1ea2N Y\u00caU C\u1ea6U \u0111\u1ec1 b\u00e0i cho nhanh. B\u1eaby A b\u1ecb b\u00e1c ngay.",
     "No need. I can just have a look at the specs he gave us when he set the task."),
    (29, "Creating a handout", "D",
     "Helen s\u1ebd h\u1ecfi Sarah - B\u1ea0N C\u00d9NG KHO\u00c1 h\u1ecdc c\u00f9ng chuy\u00ean ng\u00e0nh marketing - xem c\u1ea7n \u0111\u01b0a g\u00ec v\u00e0o t\u1edd ph\u00e1t tay.",
     "She's doing the same option as me in marketing. I'll ask her advice on what to include."),
    (30, "Drawing up a bibliography", "F",
     "Brad \u0111\u1ec1 ngh\u1ecb b\u1eaft \u0111\u1ea7u b\u1eb1ng vi\u1ec7c l\u1eadt S\u1ed4 TAY M\u00d4N H\u1eccC. B\u1eaby E: t\u00ecm tr\u00ean m\u1ea1ng l\u00e0 \u00fd c\u1ee7a Helen nh\u01b0ng b\u1ecb nh\u1eafc l\u00e0 \u0111\u00e3 \u0111\u01b0\u1ee3c khuy\u00ean kh\u00f4ng n\u00ean.",
     "I think we should start by looking through module handbooks."),
]

p3 = []
for orders, prompt, opts, letters, expl, ev in P3_PAIRS:
    for order in orders:
        q = mc(order, prompt, opts, letters)
        q["explanation"], q["evidence"] = expl, ev
        p3.append(q)
for order, prompt, letter, expl, ev in P3_MATCH:
    q = match(order, prompt, P3_OPTS, letter)
    q["explanation"], q["evidence"] = expl, ev
    p3.append(q)

# ============================ PART 4 =======================================
P4_NOTE = """# Engineering for sustainable development
## Problem
- Short growing season because of high altitude and low [[31]]
- Fresh vegetables imported by lorry or by [[32]], so are expensive
- Need to use sunlight to prevent local plants from [[33]]
- Previous programmes to provide greenhouses were [[34]]
## New greenhouse
Meets criteria for sustainability
- Simple and [[35]] to build
- Made mainly from local materials (mud or stone for the walls, wood and [[36]] for the roof)
- Building and maintenance done by local craftsmen
- Runs solely on [[37]] energy
- Only families who have a suitable [[38]] can own one
## Design
- Long side faces South
- Strong polythene cover
- Inner [[39]] are painted black or white
## Social benefits
- Owners' status is improved
- Rural [[40]] have greater opportunities
- More children are educated"""

P4 = [
    (31, ["rainfall"],
     "M\u00f9a v\u1ee5 ng\u1eafn v\u00ec v\u00f9ng n\u00e0y \u1edf \u0111\u1ed9 cao l\u1edbn v\u00e0 L\u01af\u1ee2NG M\u01afA r\u1ea5t th\u1ea5p.",
     "because the altitude of the region is around 3,500 metres, and because the rainfall is so low"),
    (32, ["air", "plane", "aeroplane", "airplane"],
     "Rau t\u01b0\u01a1i ch\u1edf b\u1eb1ng xe t\u1ea3i v\u00e0o m\u00f9a h\u00e8, c\u00f2n m\u00f9a \u0111\u00f4ng ph\u1ea3i ch\u1edf b\u1eb1ng \u0110\u01af\u1edcNG H\u00c0NG KH\u00d4NG n\u00ean r\u1ea5t \u0111\u1eaft.",
     "They arrive by truck in summer, or by air in winter, which makes them expensive."),
    (33, ["freezing"],
     "C\u1ea7n t\u1eadn d\u1ee5ng n\u1eafng \u0111\u1ec3 b\u1ea3o v\u1ec7 c\u00e2y tr\u1ed3ng \u0111\u1ecba ph\u01b0\u01a1ng kh\u1ecfi b\u1ecb \u0110\u00d3NG B\u0102NG trong m\u00f9a \u0111\u00f4ng.",
     "protect locally produced plants from freezing during winter"),
    (34, ["unsuccessful"],
     "C\u00e1c ch\u01b0\u01a1ng tr\u00ecnh c\u1ea5p nh\u00e0 k\u00ednh tr\u01b0\u1edbc \u0111\u00e2y \u0111\u1ec1u TH\u1ea4T B\u1ea0I v\u00ec kh\u00f4ng h\u1ee3p \u0111i\u1ec1u ki\u1ec7n \u0111\u1ecba ph\u01b0\u01a1ng, b\u1ecb b\u1ecf kh\u00f4ng d\u00f9ng.",
     "there had been programmes in the past to provide greenhouses, but these were unsuccessful"),
    (35, ["cheap", "inexpensive"],
     "Nh\u00e0 k\u00ednh m\u1edbi thi\u1ebft k\u1ebf \u0111\u01a1n gi\u1ea3n n\u00ean chi ph\u00ed x\u00e2y d\u1ef1ng R\u1eba.",
     "the new greenhouse is designed to be relatively simple, so construction is cheap"),
    (36, ["grass"],
     "M\u00e1i l\u00e0m b\u1eb1ng g\u1ed7 d\u01b0\u01a1ng s\u1eb5n c\u00f3 c\u00f9ng C\u1ecf ch\u1ecbu n\u01b0\u1edbc c\u1ee7a \u0111\u1ecba ph\u01b0\u01a1ng.",
     "The main roof is generally made from locally available poplar wood, with water-resistant local grass for the covering."),
    (37, ["solar"],
     "Nh\u00e0 k\u00ednh ch\u1ea1y ho\u00e0n to\u00e0n b\u1eb1ng N\u0102NG L\u01af\u1ee2NG M\u1eb6T TR\u1edcI, kh\u00f4ng c\u00f3 ngu\u1ed3n s\u01b0\u1edfi b\u1ed5 sung.",
     "the greenhouse is designed to run on solar power alone; there's no supplementary heating"),
    (38, ["location", "site"],
     "Ch\u1ec9 h\u1ed9 n\u00e0o c\u00f3 V\u1eca TR\u00cd \u0111\u1ea5t ph\u00f9 h\u1ee3p \u0111\u1ec3 d\u1ef1ng nh\u00e0 k\u00ednh m\u1edbi \u0111\u01b0\u1ee3c ch\u1ecdn.",
     "They have to have a site which is suitable for constructing it on."),
    (39, ["walls"],
     "C\u00e1c B\u1ee8C T\u01af\u1edcNG b\u00ean trong \u0111\u01b0\u1ee3c s\u01a1n: t\u01b0\u1eddng sau v\u00e0 t\u01b0\u1eddng h\u01b0\u1edbng t\u00e2y s\u01a1n \u0111en \u0111\u1ec3 h\u00fat nhi\u1ec7t, t\u01b0\u1eddng h\u01b0\u1edbng \u0111\u00f4ng s\u01a1n tr\u1eafng \u0111\u1ec3 ph\u1ea3n chi\u1ebfu n\u1eafng s\u1edbm.",
     "On the inside of the greenhouse, the walls are painted."),
    (40, ["women"],
     "\u1ede n\u00f4ng th\u00f4n ch\u00ednh PH\u1ee4 N\u1eee l\u00e0 ng\u01b0\u1eddi tr\u1ed3ng tr\u1ecdt, n\u00ean nh\u00e0 k\u00ednh m\u1edf ra nhi\u1ec1u c\u01a1 h\u1ed9i h\u01a1n cho h\u1ecd.",
     "because in rural areas it is women who usually grow the food, the greenhouses have increased their opportunities"),
]

p4 = []
for order, answers, expl, ev in P4:
    q = note(order, answers)
    q["explanation"], q["evidence"] = expl, ev
    p4.append(q)

# ============================ tong hop =====================================
data = {
    "title": "IELTS Master - Listening Test 47",
    "skill": "listening",
    "sourceLabel": "IELTS Master - Listening Test 47",
    "description": "Listening Test 47: 4 ph\u1ea7n, 40 c\u00e2u (chu\u1ea9n b\u1ecb \u0111i th\u0103m b\u1ea1n \u1edf n\u01b0\u1edbc ngo\u00e0i / c\u00f4ng vi\u00ean gi\u1ea3i tr\u00ed Camber's / thuy\u1ebft tr\u00ecnh v\u1ec1 l\u00e0m vi\u1ec7c nh\u00f3m / nh\u00e0 k\u00ednh b\u1ec1n v\u1eefng \u1edf v\u00f9ng n\u00fai Himalaya).",
    "units": [
        {
            "unitType": "listening_part", "unitNumber": 1,
            "title": "Listening Part 1 - Notes for holiday",
            "instructions": "You will hear a woman called Tanya talking to her friend called Simon, who lives abroad. Tanya is planning to visit Simon. Answer questions 1-10.",
            "content": "Listen to the recording and answer the questions below.",
            "defaultTimeLimitMinutes": 10,
            "audioUrl": AUDIO[1],
            "transcript": transcripts[1],
            "metadata": {
                "groupInstructions": {
                    "1": "Complete the notes below. Write NO MORE THAN TWO WORDS OR A NUMBER."
                },
                "noteBody": P1_NOTE,
            },
            "questions": p1,
        },
        {
            "unitType": "listening_part", "unitNumber": 2,
            "title": "Listening Part 2 - Camber's theme park",
            "instructions": "You will hear a podcast on Camber's theme park. Answer questions 11-20.",
            "content": "Listen to the recording and answer the questions below.",
            "defaultTimeLimitMinutes": 10,
            "audioUrl": AUDIO[2],
            "transcript": transcripts[2],
            "metadata": {
                "groupTitles": {"11": "Camber's theme park", "17": "Rides"},
                "groupInstructions": {
                    "11": "Choose the correct letter A, B or C.",
                    "17": "Questions 17-20\nWhat special conditions apply to the following rides?\n"
                          "Choose FOUR answers from the list below and write the correct letter A-F next to questions 17-20.\n"
                          "Special conditions for visitors\n:::box\n" + "\n".join(P2_OPTS) + "\n:::",
                },
            },
            "questions": p2,
        },
        {
            "unitType": "listening_part", "unitNumber": 3,
            "title": "Listening Part 3 - Working effectively in groups",
            "instructions": "You will hear two business studies students discussing a presentation they'll do on an article on working effectively in groups. Answer questions 21-30.",
            "content": "Listen to the recording and answer the questions below.",
            "defaultTimeLimitMinutes": 10,
            "audioUrl": AUDIO[3],
            "transcript": transcripts[3],
            "metadata": {
                "groupTitles": {"27": "Preparation tasks"},
                "groupInstructions": {
                    "21": "Questions 21 and 22\nChoose TWO letters A-E.\nWhat TWO things do Brad and Helen agree to say about listening in groups?",
                    "23": "Questions 23 and 24\nChoose TWO letters A-E.\nWhat TWO things does the article say about goal setting?",
                    "25": "Questions 25 and 26\nChoose TWO letters A-E.\nWhat TWO things do Brad and Helen agree are weak points in the article's section on conflict resolution?",
                    "27": "Questions 27-30\nWhat actions do Brad and Helen agree to do regarding the following preparation tasks?\n"
                          "Choose FOUR answers from the list below and write the correct letter A-F next to questions 27-30.\n"
                          "Action\n:::box\n" + "\n".join(P3_OPTS) + "\n:::",
                },
            },
            "questions": p3,
        },
        {
            "unitType": "listening_part", "unitNumber": 4,
            "title": "Listening Part 4 - Engineering for sustainable development",
            "instructions": "You will hear a lecturer talking to a group of engineering students about the design of a greenhouse. Answer questions 31-40.",
            "content": "Listen to the recording and answer the questions below.",
            "defaultTimeLimitMinutes": 10,
            "audioUrl": AUDIO[4],
            "transcript": transcripts[4],
            "metadata": {
                "groupInstructions": {
                    "31": "Complete the notes below. Write ONE WORD ONLY for each answer."
                },
                "noteBody": P4_NOTE,
            },
            "questions": p4,
        },
    ],
}

# --- dan chung phai la nguyen van trong transcript -------------------------
bad = []
for unit in data["units"]:
    tr = unit["transcript"]
    for q in unit["questions"]:
        for piece in (q.get("evidence") or "").split(" / "):
            if piece and piece not in tr:
                bad.append((unit["unitNumber"], q["order"], piece))
if bad:
    print("DAN CHUNG KHONG KHOP TRANSCRIPT:")
    for u, o, piece in bad:
        print("  part %s cau %s: %r" % (u, o, piece))
    sys.exit(1)

OUT = "tmp/ielts_master_listening_test47.json"
json.dump(data, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
print("OK ->", OUT)
for n in (1, 2, 3, 4):
    print("  Section %s: transcript %s ky tu, audio %s" % (n, len(transcripts[n]), AUDIO_NOTE[n]))
