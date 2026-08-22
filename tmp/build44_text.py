# -*- coding: utf-8 -*-
"""Tach 3 bai doc cua IELTS Master Reading Test 44 tu file PDF goc."""
import pdfplumber, json, re

PDF = r'E:\ielts_master\reading\Reading (41-50)\44\Test 44.pdf'
pages = []
with pdfplumber.open(PDF) as pdf:
    for p in pdf.pages:
        pages.append(p.extract_text() or '')


def body(t):
    out = []
    for ln in t.split('\n'):
        s = ln.strip()
        if s == 'IELTS MASTER':
            continue
        if s.startswith('IELTS MASTER') and 'best guide' in s:
            break
        out.append(s)
    return out


def take(page_idx_list, stop_marker):
    lines = []
    for i in page_idx_list:
        for s in body(pages[i]):
            if s.startswith(stop_marker):
                return lines
            lines.append(s)
    return lines


def to_paragraphs(lines):
    """Dong dau tien la tieu de bai doc, phan con lai gop thanh cac doan."""
    lines = [s for s in lines if s]
    paras, cur = [lines[0]], []
    for s in lines[1:]:
        if not s:
            continue
        cur.append(s)
        # dong cuoi cua mot doan: ngan hon be rong can le VA ket thuc cau
        if len(s) < 100 and re.search(r'[.?!][’”\')\]]?$', s):
            paras.append(' '.join(cur))
            cur = []
    if cur:
        paras.append(' '.join(cur))
    return paras


p1 = to_paragraphs(take([0, 1], 'Questions 1-7'))
p2 = to_paragraphs(take([2, 3], 'Questions 14-19'))
p3 = to_paragraphs(take([4, 5], 'Questions 27-33'))

out = {}
for name, ps in (('p1', p1), ('p2', p2), ('p3', p3)):
    out[name] = {'title': ps[0], 'content': '\n\n'.join(ps[1:])}
    print('--- %s: %s (%d doan) ---' % (name, ps[0], len(ps) - 1))
    for r in ps[1:]:
        print('  *', r[:85])

# kiem tra doan A-G cua bai 2
letters = [p.split()[0] for p in p2[1:]]
print('\nBai 2 nhan doan:', letters)
assert letters == list('ABCDEFG'), 'Tach doan bai 2 sai!'

# tim loi vat dong kieu "scholar- reformer"
for k, v in out.items():
    for m in re.finditer(r'\S*-\s\S+', v['content']):
        print('HYPHEN?', k, repr(m.group()))

json.dump(out, open('tmp/_t44_passages.json', 'w', encoding='utf8'), ensure_ascii=False, indent=1)
print('\nDa ghi tmp/_t44_passages.json')
