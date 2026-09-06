# -*- coding: utf-8 -*-
"""Tach 40 transcript tu file PDF Transcripts (2 cot) ra JSON.

Ky thuat:
  - Lay TUNG TU kem font/co chu (khong lay ca dong) de biet dong nao la tieu de.
      Sabon-Roman 10   = loi thoai
      GoalRounded 13   = "Unit N Ten bai"
      GoalRounded 15   = tieu de chuong (Nature and the Environment, ...) -> bo
      DIN-Black        = chu trang tri "Transcripts" chay doc o le  -> bo
  - x_tolerance=2 (mac dinh 3 lam dinh chu: "differentareas", "wantedto").
  - Ghep tu thanh dong theo toa do y, xu ly rieng tung cot trai/phai.
"""
import pdfplumber, re, json
from collections import defaultdict

SRC = r'E:\Listening Practice Through Dictation 3\Audio + Transcipt\LPTD 3_transcript.pdf'
OUT = r'E:\web_ielts\tmp\lptd3_transcripts.json'

X_TOL = 2          # nguong gop tu theo chieu ngang
LINE_TOL = 3       # sai so toa do y de coi la cung mot dong


def clean(t):
    for a, b in (('\ufffd', "'"), ('\u2019', "'"), ('\u2018', "'"),
                 ('\u201c', '"'), ('\u201d', '"'), ('\u2013', '-'), ('\u2014', '-')):
        t = t.replace(a, b)
    return t


def font_kind(name, size):
    name = name.split('+')[-1]
    if name.startswith('DIN'):
        return 'deco'
    if name.startswith('GoalRounded'):
        return 'chapter' if size > 14 else 'unit'
    return 'body'


# ---- gom tu -> dong, giu nhan font ------------------------------------------
lines = []
with pdfplumber.open(SRC) as pdf:
    for pg in pdf.pages:
        mid = pg.width / 2
        words = pg.extract_words(x_tolerance=X_TOL, extra_attrs=['fontname', 'size'])
        for col in (0, 1):
            rows = defaultdict(list)
            for w in words:
                if (w['x0'] < mid) != (col == 0):
                    continue
                if font_kind(w['fontname'], w['size']) == 'deco':
                    continue
                rows[round(w['top'] / LINE_TOL)].append(w)
            for key in sorted(rows):
                ws = sorted(rows[key], key=lambda w: w['x0'])
                kinds = {font_kind(w['fontname'], w['size']) for w in ws}
                text = clean(' '.join(w['text'] for w in ws)).strip()
                if text:
                    lines.append((text, kinds))

# ---- tach theo unit ---------------------------------------------------------
UNIT = re.compile(r'^Unit\s+(\d{1,2})\s+(\S.*)$')
SPK = re.compile(r'^([MWBG])\s*:\s*(.*)$')

units, cur = {}, None
for text, kinds in lines:
    if 'chapter' in kinds:            # tieu de chuong -> bo han
        continue
    m = UNIT.match(text)
    if m and 'unit' in kinds and 1 <= int(m.group(1)) <= 40:
        cur = int(m.group(1))
        units[cur] = {'number': cur, 'title': m.group(2).strip(), 'lines': []}
        continue
    if cur and 'body' in kinds:
        units[cur]['lines'].append(text)

for u in units.values():
    turns = []
    for s in u['lines']:
        m = SPK.match(s)
        if m:
            turns.append({'speaker': m.group(1), 'text': m.group(2)})
        elif turns:
            turns[-1]['text'] += ' ' + s
        else:
            turns.append({'speaker': None, 'text': s})
    for t in turns:
        s = re.sub(r'\s+', ' ', t['text']).strip()
        # Chu in nghieng trong PDF hay de thua mot khoang trang truoc dau cau
        # ("It's The Sound of Music ."). Bo khoang trang do, NHUNG chua dau ba
        # cham co khoang trang co y cua sach ("but . . .").
        s = re.sub(r'(?<=\w)\s+([.,!?;:])(?!\s*\.)', r'\1', s)
        t['text'] = s
    u['turns'] = [t for t in turns if t['text']]
    del u['lines']

# ---- kiem tra ---------------------------------------------------------------
missing = [n for n in range(1, 41) if n not in units]
assert not missing, f'thieu unit: {missing}'

problems = []
BAD_CHAR = re.compile(r"[^A-Za-z0-9 ,.!?;:'\"()\-$%&/]")
for n in sorted(units):
    for t in units[n]['turns']:
        for junk in BAD_CHAR.findall(t['text']):
            problems.append(f'Unit {n}: ky tu la {junk!r}')
        for w in t['text'].split():
            core = re.sub(r"[^A-Za-z']", '', w)
            if len(core) >= 12:
                problems.append(f'Unit {n}: tu dai kha nghi {w!r}')
            if len(core) == 1 and core.lower() not in ('a', 'i'):
                problems.append(f'Unit {n}: tu 1 chu cai {w!r} (co the bi tach nham)')

for p in problems:
    print(' !!', p)
print(f'{"CO VAN DE" if problems else "SACH SE"} - 40 unit')
for n in sorted(units):
    u = units[n]
    print(f"  Unit {n:2d} turns={len(u['turns']):2d} "
          f"words={sum(len(t['text'].split()) for t in u['turns']):4d}  {u['title']}")

with open(OUT, 'w', encoding='utf-8') as f:
    json.dump([units[n] for n in sorted(units)], f, ensure_ascii=False, indent=1)
print('wrote', OUT)
