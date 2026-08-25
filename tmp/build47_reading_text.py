# -*- coding: utf-8 -*-
"""Trich 3 bai doc cua IELTS Master - Reading Test 47 tu PDF ra JSON trung gian."""
import json
import re
import sys

import fitz

sys.stdout.reconfigure(encoding="utf-8")

PDF = r"E:/ielts_master/reading/Reading (41-50)/47/Test 47.pdf"

# Cac dong header/footer quang cao lap lai o moi trang -> bo di.
JUNK = re.compile(
    r"^(IELTS MASTER\s*$|IELTS MASTER . The best guide|and advanced tricks|"
    r"For largest and latest|and for tutorials|www\.youtube\.com/englishwithd|\d+\s*$)"
)

FIX = [("\u2019", "'"), ("\u2018", "'"), ("\u201c", '"'), ("\u201d", '"'),
       ("\u2013", "-"), ("\u2014", "-"), ("\u2026", "..."), ("\u00a0", " "),
       ("\u00ad", "")]


def clean(s):
    for a, b in FIX:
        s = s.replace(a, b)
    return s


doc = fitz.open(PDF)
lines = []
for page in doc:
    for raw in clean(page.get_text()).split("\n"):
        t = raw.strip()
        if JUNK.match(t):
            continue
        lines.append(t)

# Gop thanh doan: dong trong = het doan.
paras, cur = [], []
for t in lines:
    if t:
        cur.append(t)
    elif cur:
        paras.append(" ".join(cur))
        cur = []
if cur:
    paras.append(" ".join(cur))

# Vi tri bat dau/ket thuc cua tung bai doc trong danh sach doan.
def idx(pred, start=0):
    for i in range(start, len(paras)):
        if pred(paras[i]):
            return i
    raise SystemExit("khong tim thay moc")


i1 = idx(lambda p: p == "Ocean Acidification")
q1 = idx(lambda p: p.startswith("Questions 1-7"))
i2 = idx(lambda p: p == "A New Fair Trade Organisation")
q2 = idx(lambda p: p.startswith("Questions 14-19"))
i3 = idx(lambda p: p == "The First Antigravity Machine")
q3 = idx(lambda p: p.startswith("Questions 27-30"))

passages = {
    1: paras[i1 + 1:q1],
    2: paras[i2 + 1:q2],
    3: paras[i3 + 1:q3],
}

# Ngat trang cat doi mot doan -> noi lai voi doan sau neu doan truoc chua het cau.
def merge_page_breaks(ps):
    merged = []
    for p in ps:
        if merged and not merged[-1].rstrip().endswith((".", "?", "!", "'", '"')):
            merged[-1] = merged[-1] + " " + p
        else:
            merged.append(p)
    return merged


out = {}
for n, ps in passages.items():
    ps = merge_page_breaks(ps)
    body = "\n\n".join(ps)
    # PDF hay vat dong giua tu ghep -> "high- rise". Kiem tra truoc khi dung.
    broken = re.findall(r"[a-z]+-\s[a-z]+", body)
    print("passage", n, "| doan:", len(ps), "| ky tu:", len(body), "| gach vat dong:", broken)
    weird = sorted({c for c in body if ord(c) > 126})
    print("   ky tu la:", weird)
    out[n] = body
    print("   dau:", body[:80])
    print("   cuoi:", body[-80:])

json.dump(out, open("tmp/_r47_passages.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print("OK -> tmp/_r47_passages.json")
