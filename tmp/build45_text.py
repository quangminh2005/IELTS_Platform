# -*- coding: utf-8 -*-
"""Tach 3 bai doc cua IELTS Master Reading Test 45 tu file PDF goc.

Chu y: khong doan ranh gioi doan van theo do dai chuoi (de sai), ma do vi tri
mep phai thuc te cua tung dong trong PDF: dong cuoi doan bao gio cung dung
sam hon le phai.
"""
import pdfplumber, json, re

PDF = r'E:\ielts_master\reading\Reading (41-50)\45\Test 45.pdf'

pages = []          # moi trang: danh sach (text, right_edge)
with pdfplumber.open(PDF) as pdf:
    for p in pdf.pages:
        rows = {}
        for w in p.extract_words():
            key = round(w['top'] / 3)
            rows.setdefault(key, []).append(w)
        lines = []
        for key in sorted(rows):
            ws = sorted(rows[key], key=lambda w: w['x0'])
            lines.append((' '.join(w['text'] for w in ws).strip(),
                          max(w['x1'] for w in ws)))
        pages.append(lines)

RIGHT = max(r for pg in pages for _, r in pg)      # le phai cua khoi chu


def body(lines):
    out = []
    for s, r in lines:
        if s == 'IELTS MASTER':
            continue
        if s.startswith('IELTS MASTER') and 'best guide' in s:
            break
        out.append((s, r))
    return out


def take(page_idx_list, stop_marker):
    got = []
    for i in page_idx_list:
        for s, r in body(pages[i]):
            if s.startswith(stop_marker):
                return got
            got.append((s, r))
    return got


def to_paragraphs(lines):
    """Dong dau tien la tieu de bai doc; ngat doan o dong dung sam hon le phai."""
    lines = [(s, r) for s, r in lines if s]
    paras, cur = [lines[0][0]], []
    for s, r in lines[1:]:
        cur.append(s)
        # dong can le day luon cham mep phai; dong cuoi doan thi khong
        assert not (RIGHT - 7 < r < RIGHT - 1), 'Mep phai kho phan dinh: %.1f | %s' % (r, s[:60])
        if r < RIGHT - 3:
            paras.append(' '.join(cur))
            cur = []
    if cur:
        paras.append(' '.join(cur))
    return paras


p1 = to_paragraphs(take([0, 1], 'Questions 1-3'))
p2 = to_paragraphs(take([3, 4], 'Questions 14-20'))
p3 = to_paragraphs(take([6, 7], 'Questions 27-33'))

out = {}
for name, ps in (('p1', p1), ('p2', p2), ('p3', p3)):
    out[name] = {'title': ps[0], 'content': '\n\n'.join(ps[1:])}
    print('--- %s: %s (%d doan) ---' % (name, ps[0], len(ps) - 1))
    for r in ps[1:]:
        print('  * %-88s ... %s' % (r[:88], r[-45:]))

letters = [p.split()[0] for p in p2[1:]]
print('\nBai 2 nhan doan:', letters)
assert letters == list('ABCDEFG'), 'Tach doan bai 2 sai!'

for k, v in out.items():
    for m in re.finditer(r'[a-z]+-\s[a-z]+', v['content']):
        print('NGHI VAT DONG:', k, repr(m.group()))

json.dump(out, open('tmp/_t45_passages.json', 'w', encoding='utf8'), ensure_ascii=False, indent=1)
print('\nDa ghi tmp/_t45_passages.json')
