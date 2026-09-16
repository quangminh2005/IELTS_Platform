# -*- coding: utf-8 -*-
"""Rut transcript quyen 4 tu LPTD4.pdf (co lop chu) -> tmp/lptd4_transcripts.json"""
import fitz, re, json
d = fitz.open(r"E:\Listening Practice Through Dictation 4\LPTD4.pdf")
txt = "\n".join(p.get_text() for p in d)
txt = txt.replace("\ufffd", "'").replace("\u2019", "'").replace("\u2018", "'").replace("\u201c", '"').replace("\u201d", '"')
lines = [l.strip() for l in txt.split("\n")]
units = []
cur = None; turn = None
skip = {"Listening Practice through Dictation 4", "Nature and the Environment", "Science and Technology",
        "Art and Culture", "Leisure and Entertainment", "School and Family", "People and Work",
        "Sports and Health", "Travel and Transport"}
for l in lines:
    if not l or l.isdigit() or l in skip:
        continue
    m = re.match(r'^Unit (\d+) (.+)$', l)
    if m:
        cur = {"number": int(m.group(1)), "title": m.group(2).strip(), "turns": []}
        units.append(cur); turn = None; continue
    if re.match(r'^Part (I|II|III)$', l):
        cur["turns"].append({"speaker": "", "text": l}); turn = None; continue
    m = re.match(r'^([A-Z][A-Za-z0-9]{0,2}) ?: ?(.*)$', l)
    if m:
        turn = {"speaker": m.group(1), "text": m.group(2)}
        cur["turns"].append(turn); continue
    if turn is None:  # doan van khong co nguoi noi (bai doc lien mach, xuong dong doan)
        turn = {"speaker": "", "text": l}; cur["turns"].append(turn)
    else:
        turn["text"] = (turn["text"] + " " + l).strip()
for u in units:
    for t in u["turns"]:
        t["text"] = re.sub(r"\s+", " ", t["text"]).strip()
json.dump(units, open(r"E:\web_ielts\tmp\lptd4_transcripts.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print(len(units), [ (u["number"], len(u["turns"]), sum(len(t["text"].split()) for t in u["turns"])) for u in units])
