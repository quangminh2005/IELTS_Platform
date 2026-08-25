# -*- coding: utf-8 -*-
"""Trich 3 bai doc cua IELTS Master - Reading Test 48 tu PDF ra JSON trung gian."""
import json
import re
import sys

import fitz

sys.stdout.reconfigure(encoding="utf-8")

PDF = r"E:/ielts_master/reading/Reading (41-50)/48/Test 48.pdf"

# Header/footer quang cao lap lai o moi trang -> bo di.
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
    """Cat doan tu sau tieu de toi truoc khoi cau hoi.

    Bai 2 khong co dong trong giua tieu de va doan A nen tieu de dinh lien vao
    doan dau -> phai cat bo tien to thay vi bo ca doan.
    """
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
    """Ngat trang cat doi doan -> noi lai voi doan sau neu doan truoc chua het cau."""
    merged = []
    for p in ps:
        if merged and not merged[-1].rstrip().endswith((".", "?", "!", "'", '"')):
            merged[-1] = merged[-1] + " " + p
        else:
            merged.append(p)
    return merged


def merge_labelled(ps, labels):
    """Bai danh nhan doan A-G: doan nao khong mo dau bang nhan thi la phan tiep
    cua doan truoc bi ngat trang (vd doan F cua bai Insomnia dut o cuoi trang 3
    DUNG cho het cau nen merge_page_breaks khong bat duoc)."""
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
    1: merge_page_breaks(
        slice_passage("The Big Cats at the Sharjah Breeding Centre", "Questions 1-8")),
    2: merge_labelled(
        slice_passage("Insomnia - The Enemy of Sleep", "Questions 14-19"), "ABCDEFG"),
    3: merge_page_breaks(
        slice_passage("Alternative Farming Methods in Oregon", "Questions 28-35")),
}

# PDF vat dong giua tu ghep, de lai "broad- spectrum" -> va lai cho khop evidence.
HYPHEN_FIX = [("broad- spectrum", "broad-spectrum")]

out = {}
for n, ps in passages.items():
    body = "\n\n".join(ps)
    for a, b in HYPHEN_FIX:
        body = body.replace(a, b)
    broken = re.findall(r"[a-z]+-\s[a-z]+", body)
    print("passage", n, "| doan:", len(ps), "| ky tu:", len(body), "| gach vat dong:", broken)
    print("   ky tu la:", sorted({c for c in body if ord(c) > 126}))
    for i, p in enumerate(ps):
        if not p.rstrip().endswith((".", "?", "!", "'", '"')):
            print("   !! doan", i, "khong ket thuc cau:", repr(p[-60:]))
    print("   dau:", body[:75])
    print("   cuoi:", body[-75:])
    out[n] = body

json.dump(out, open("tmp/_r48_passages.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print("OK -> tmp/_r48_passages.json")
