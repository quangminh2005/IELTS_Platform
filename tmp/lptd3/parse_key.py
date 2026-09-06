# -*- coding: utf-8 -*-
"""Rut dap an A/B/C/D cua 40 unit tu LPTD_3_Answer_key.pdf -> tmp/lptd3_key.json"""
import pdfplumber, re, json, sys
from collections import defaultdict
sys.stdout.reconfigure(encoding='utf-8')

SRC = r'E:\Listening Practice Through Dictation 3\LPTD_3_Answer_key.pdf'
OUT = r'E:\web_ielts\tmp\lptd3_key.json'
MID = 276

lines = []
with pdfplumber.open(SRC) as pdf:
    for pg in pdf.pages:
        ws = pg.extract_words(x_tolerance=2)
        for col in (0, 1):
            rows = defaultdict(list)
            for w in ws:
                if (w['x0'] < MID) != (col == 0):
                    continue
                if w['x0'] > 500 and w['x1'] - w['x0'] < 14:   # chu "Answer Key" doc le
                    continue
                rows[round(w['top'] / 4)].append(w)
            for k in sorted(rows):
                t = ' '.join(x['text'] for x in sorted(rows[k], key=lambda x: x['x0']))
                lines.append(t.strip())

UNIT = re.compile(r'^Unit\s+(\d{1,2})\s+(\S.*)$')
SEC = re.compile(r'^([A-D])\.\s*(.+)$')
ITEM = re.compile(r'(?<![\w(])(\d)\.\s')

units, cur, sec = {}, None, None
for t in lines:
    if t in ('Answer Key',) or not t:
        continue
    m = UNIT.match(t)
    if m and int(m.group(1)) <= 40:
        cur = int(m.group(1))
        units[cur] = {'number': cur, 'title': m.group(2).strip(), 'sections': {}}
        sec = None
        continue
    m = SEC.match(t)
    if m and cur:
        sec = m.group(1)
        units[cur]['sections'][sec] = {'label': m.group(2).strip(), 'items': {}}
        continue
    if cur and sec and re.match(r'^\d\.', t):
        ms = list(ITEM.finditer(t))
        for i, m in enumerate(ms):
            end = ms[i + 1].start() if i + 1 < len(ms) else len(t)
            units[cur]['sections'][sec]['items'][int(m.group(1))] = t[m.end():end].strip()

missing = [n for n in range(1, 36) if n not in units]
assert not missing, missing
print('!! khong co dap an cho unit 36-40 (PDF key chi den unit 35)')
for n in sorted(units):
    u = units[n]
    got = {s: len(v['items']) for s, v in u['sections'].items()}
    labels = {s: v['label'] for s, v in u['sections'].items()}
    ok = got.get('A') == 6 and got.get('B') == 2 and got.get('C') == 4 and got.get('D') == 5
    print(('OK ' if ok else '!! ') + f"Unit {n:2d} {u['title'][:28]:30s} {got} D={labels.get('D')}")

json.dump([units[n] for n in sorted(units)], open(OUT, 'w', encoding='utf-8'),
          ensure_ascii=False, indent=1)
print('wrote', OUT)
