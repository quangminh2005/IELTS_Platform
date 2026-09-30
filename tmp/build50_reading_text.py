# -*- coding: utf-8 -*-
"""Trich 3 bai doc cua IELTS Master - Reading Test 50 tu PDF ra JSON trung gian."""
import json
import re
import sys

import fitz

sys.stdout.reconfigure(encoding="utf-8")

PDF = r"E:/ielts_master/reading/Reading (41-50)/50/Test 50.pdf"

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

paras, cur = [], []
for t in lines:
    if t:
        cur.append(t)
    elif cur:
        paras.append(" ".join(cur))
        cur = []
if cur:
    paras.append(" ".join(cur))


def slice_passage(title, stop_prefix):
    start = None
    for i, p in enumerate(paras):
        if p == title:
            start, head = i + 1, None
            break
        if p.startswith(title + " "):
            start, head = i, p[len(title):].strip()
            break
    if start is None:
        raise SystemExit("khong tim thay tieu de: " + title)
    end = next(i for i in range(start, len(paras)) if paras[i].startswith(stop_prefix))
    out = paras[start:end]
    if head is not None:
        out = [head] + out[1:]
    return out


def merge_page_breaks(ps):
    """Ngat trang cat doi doan -> noi lai neu doan truoc chua ket thuc cau."""
    merged = []
    for p in ps:
        if merged and not merged[-1].rstrip().endswith((".", "?", "!", "'", '"')):
            merged[-1] = merged[-1] + " " + p
        else:
            merged.append(p)
    return merged


def merge_labelled(ps, labels):
    """Bai danh nhan doan A-G: doan khong mo dau bang nhan = phan tiep cua doan
    truoc bi ngat trang. Assert nhan ra dung du de bat loi ghep doan ngay."""
    merged = []
    for p in ps:
        if re.match(r"^[%s] \S" % labels, p):
            merged.append(p)
        elif merged:
            merged[-1] = merged[-1] + " " + p
        else:
            raise SystemExit("doan dau khong co nhan: " + p[:60])
    got = "".join(p[0] for p in merged)
    assert got == labels, "nhan doan ra %r, can %r" % (got, labels)
    return merged


passages = {
    1: merge_labelled(slice_passage("The coral reefs of Agatti Island", "Questions 1-9"), "ABCDEFGHI"),
    2: merge_page_breaks(slice_passage("Urban planning in Singapore", "Questions 14-19")),
    3: merge_labelled(slice_passage("Reading Passage 3", "Questions 27-33"), "ABCDEFGHI"),
}
# PDF vat dong giua tu ghep -> noi lai
VA = [("plant- eating", "plant-eating"), ("micro- organisms", "micro-organisms")]
for n in passages:
    fixed = []
    for p_ in passages[n]:
        for a, b in VA:
            p_ = p_.replace(a, b)
        fixed.append(p_)
    passages[n] = fixed

out = {}
for n, ps in passages.items():
    body = "\n\n".join(ps)
    broken = re.findall(r"[a-z]+-\s[a-z]+", body)
    print("passage", n, "| doan:", len(ps), "| ky tu:", len(body), "| gach vat dong:", broken)
    print("   ky tu la:", sorted({c for c in body if ord(c) > 126}))
    for i, p in enumerate(ps):
        if not p.rstrip().endswith((".", "?", "!", "'", '"')):
            print("   !! doan", i, "khong ket thuc cau:", repr(p[-60:]))
    print("   dau:", body[:75])
    print("   cuoi:", body[-75:])
    out[n] = body

json.dump(out, open("tmp/_r50_passages.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print("OK -> tmp/_r50_passages.json")
