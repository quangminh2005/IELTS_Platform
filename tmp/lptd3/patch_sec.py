# -*- coding: utf-8 -*-
"""Vá lại phần D (hoặc B) trong ban nhap + spec khi OCR sot chu.

    python tmp/lptd3/patch_sec.py <n> D < cac_dong_moi.txt
    python tmp/lptd3/patch_sec.py <n> B < cac_dong_moi.txt

Doc cac dong thay the tu stdin, ghi de TOAN BO phan do trong ca hai file.
"""
import sys, re, os

n = int(sys.argv[1])
sec = sys.argv[2].upper()
new = [l.rstrip() for l in sys.stdin.read().split('\n') if l.strip()]

for p in (r'E:\web_ielts\tmp\lptd3_draft\unit%02d.txt' % n,
          r'E:\web_ielts\tmp\lptd3_specs\unit%02d.txt' % n):
    if not os.path.exists(p):
        continue
    lines = open(p, encoding='utf-8').read().split('\n')
    out, i, done = [], 0, False
    while i < len(lines):
        s = lines[i].strip()
        head = re.match(r'^(A|B|C|D \w+|E( \w+)?)$', s)
        if head and s.split()[0] == sec:
            out.append(lines[i]); i += 1
            while i < len(lines) and not re.match(r'^(A|B|C|D \w+|E( \w+)?)$', lines[i].strip()):
                i += 1
            out += new
            out.append('')
            done = True
            continue
        out.append(lines[i]); i += 1
    if not done:
        raise SystemExit('%s: khong thay muc %s' % (p, sec))
    open(p, 'w', encoding='utf-8').write('\n'.join(out))
    print('patched', p)
