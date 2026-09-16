# -*- coding: utf-8 -*-
"""Ghep dap an go tay (tmp/lptd4/answers.txt) vao ban nhap spec -> tmp/lptd4_specs_final/.

answers.txt, moi unit mot khoi:
  U<n>
  A w1 w2 w3 w4 w5 w6        dap an 6 cau muc A theo thu tu (dau _ = khoang trang)
  B a c                      lua chon dung cua 2 cau muc B
  D T F T T F  |  D 3 1 5 2 4    T/F hoac thu tu 1-5 cua 5 cau muc D
  BOX=w | w | ...            (tuy chon) thay hop tu
  A3=<ca dong>               (tuy chon) thay nguyen dong cau 3 muc A (da co [dap an])
  B2OPTS=o1|o2|o3|o4         (tuy chon) thay 4 lua chon cau 2 muc B
  D5=<cau>                   (tuy chon) thay noi dung cau 5 muc D
"""
import os, re, sys
sys.stdout.reconfigure(encoding='utf-8')
ROOT = r'E:\web_ielts\tmp'
SRC = os.path.join(ROOT, 'lptd4_specs')
OUT = os.path.join(ROOT, 'lptd4_specs_final')
os.makedirs(OUT, exist_ok=True)

answers = {}
cur = None
for raw in open(os.path.join(ROOT, 'lptd4', 'answers.txt'), encoding='utf-8'):
    s = raw.rstrip('\n')
    if not s.strip():
        continue
    m = re.match(r'^U(\d+)$', s)
    if m:
        cur = answers.setdefault(int(m.group(1)), {'over': {}})
        continue
    m = re.match(r'^([A-Z0-9]+)=(.*)$', s)
    if m:
        cur['over'][m.group(1)] = m.group(2)
        continue
    key, _, val = s.partition(' ')
    cur[key] = val.split()

errs = []
for n in sorted(answers):
    a = answers[n]
    path = os.path.join(SRC, 'unit%02d.txt' % n)
    lines = open(path, encoding='utf-8').read().split('\n')
    out = []
    sec = None
    a_i = b_q = b_o = d_i = c_i = 0
    skip_opts = False
    for ln in lines:
        s = ln.rstrip()
        if s.startswith('# CHU Y'):
            continue
        if s.startswith('BOX '):
            if 'BOX' in a['over']:
                s = 'BOX ' + a['over']['BOX']
            out.append(s); continue
        if s in ('A', 'B', 'C') or re.match(r'^(D|E) \w+$', s):
            sec = s[0]; out.append(s); continue
        if not s or s.startswith('#'):
            out.append(s); continue
        if sec == 'A':
            a_i += 1
            key = 'A%d' % a_i
            if key in a['over']:
                s = a['over'][key]
            else:
                word = a['A'][a_i - 1].replace('_', ' ')
                if s.count('[?]') != 1:
                    errs.append(f'U{n} A{a_i}: co {s.count("[?]")} cho [?] -> {s}')
                s = s.replace('[?]', '[' + word + ']', 1)
            if s.count('[') != 1:
                errs.append(f'U{n} A{a_i}: khong dung 1 ngoac -> {s}')
            out.append(s); continue
        if sec == 'C':
            c_i += 1
            key = 'C%d' % c_i
            if key in a['over']:
                s = a['over'][key]
            if s.count('[') != 1:
                errs.append(f'U{n} C{c_i}: khong dung 1 ngoac -> {s}')
            out.append(s); continue
        if sec == 'B':
            if s.startswith('Q '):
                b_q += 1; b_o = 0
                out.append(s)
                key = 'B%dOPTS' % b_q
                skip_opts = key in a['over']
                if skip_opts:
                    for k, o in enumerate(a['over'][key].split('|')):
                        mark = '+' if 'abcd'[k] == a['B'][b_q - 1] else '-'
                        out.append(mark + ' ' + o.strip())
                continue
            if s.startswith('- '):
                if skip_opts:
                    continue
                mark = '+' if 'abcd'[b_o] == a['B'][b_q - 1] else '-'
                b_o += 1
                out.append(mark + s[1:]); continue
            out.append(s); continue
        if sec == 'D':
            if s.startswith('? '):
                d_i += 1
                key = 'D%d' % d_i
                text = a['over'][key] if key in a['over'] else s[2:]
                out.append(a['D'][d_i - 1] + ' ' + text); continue
            out.append(s); continue
        out.append(s)
    if a_i != 6 or b_q != 2 or d_i != 5 or c_i != 4:
        errs.append(f'U{n}: dem A={a_i} B={b_q} D={d_i}')
    open(os.path.join(OUT, 'unit%02d.txt' % n), 'w', encoding='utf-8').write('\n'.join(out).rstrip('\n') + '\n')

missing = [n for n in range(1, 41) if n not in answers]
if missing:
    errs.append(f'chua co dap an cho unit {missing}')
if errs:
    print('LOI:'); [print(' -', e) for e in errs]; sys.exit(1)
print('OK', len(answers), 'unit ->', OUT)
