# -*- coding: utf-8 -*-
import re, json, sys
sys.stdout.reconfigure(encoding='utf-8')
import pdfplumber

FOOTER_START = 'IELTS MASTER – The best guide'

def page_lines(pg):
    t = pg.extract_text() or ''
    lines = t.split('\n')
    out = []
    for ln in lines:
        s = ln.strip()
        if s == 'IELTS MASTER':
            continue
        if s.startswith(FOOTER_START):
            break
        out.append(s)
    return out

pdf = pdfplumber.open(r'E:/ielts_master/reading/Reading (41-50)/46/Test 46.pdf')
pages = [page_lines(p) for p in pdf.pages]
json.dump(pages, open('tmp/_r46_lines.json','w',encoding='utf-8'), ensure_ascii=False, indent=1)

def unwrap(lines, para_re):
    """Gop dong bi ngat; bat dau doan moi khi khop para_re."""
    paras, cur = [], []
    for ln in lines:
        if not ln:
            continue
        if para_re and para_re.match(ln):
            if cur: paras.append(' '.join(cur))
            cur = [ln]
        else:
            cur.append(ln)
    if cur: paras.append(' '.join(cur))
    return paras

def fix(s):
    s = re.sub(r'(\w)- (\w)', r'\1-\2', s)   # gach noi bi tach khoang trang khi ngat dong
    s = re.sub(r'\s+', ' ', s).strip()
    return s

# Passage 1: page 1, doan bat dau bang chu cai A-F
p1 = [fix(x) for x in unwrap(pages[0][1:], re.compile(r'^[A-F] [A-Z]'))]
# Passage 2: page 3 (tu sau tieu de) + page 4 den truoc "Questions 14-20"
l3 = pages[2][1:]
l4 = []
for ln in pages[3]:
    if ln.startswith('Questions 14'): break
    l4.append(ln)
p2 = [fix(x) for x in unwrap(l3 + l4, re.compile(r'^[A-H] [A-Z]'))]
# Passage 3: page 5 (sau tieu de) + page 6 den truoc "Questions 27-34"
l5 = pages[4][1:]
l6 = []
for ln in pages[5]:
    if ln.startswith('Questions 27'): break
    l6.append(ln)
p3raw = l5 + l6

P3_STARTS = [
 'The principle that you',
 'In a review of five countries',
 'It is often said that new industries',
 'In the 1980s and 1990s',
 'We must also differentiate',
 'In 1963 Clark Kerr',
 'Although online education',
 'ICTs - the Internet in particular',
 'Digital media may also produce',
]
whole = fix(' '.join(x for x in p3raw if x))
idxs = []
for s in P3_STARTS:
    i = whole.find(s)
    assert i >= 0, 'khong tim thay: ' + s
    idxs.append(i)
assert idxs == sorted(idxs), 'thu tu doan sai'
p3 = [whole[a:b].strip() for a, b in zip(idxs, idxs[1:] + [len(whole)])]


for name, ps in (('P1',p1),('P2',p2),('P3',p3)):
    print('=====', name, len(ps), 'doan')
    for x in ps:
        print(' *', x[:100], '...', x[-60:])
json.dump({'p1':p1,'p2':p2,'p3':p3}, open('tmp/_r46_passages.json','w',encoding='utf-8'), ensure_ascii=False, indent=1)
