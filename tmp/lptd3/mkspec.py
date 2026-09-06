# -*- coding: utf-8 -*-
"""Ghep ban nhap (A-D) voi mat na muc E go tay -> tmp/lptd3_specs/unitNN.txt

    python tmp/lptd3/mkspec.py <n> [passage|dialog] < mat_na.txt
"""
import sys, os, re, subprocess

n = int(sys.argv[1])
kind = sys.argv[2] if len(sys.argv) > 2 else 'dialog'
mask = sys.stdin.read().strip('\n')

draft = open(r'E:\web_ielts\tmp\lptd3_draft\unit%02d.txt' % n, encoding='utf-8').read()
head = draft.split('\nE\n')[0].rstrip('\n')
head = '\n'.join(l for l in head.split('\n') if '# ??' not in l or True)
out = head + '\n\nE ' + kind + '\n' + mask + '\n'
path = r'E:\web_ielts\tmp\lptd3_specs\unit%02d.txt' % n
os.makedirs(os.path.dirname(path), exist_ok=True)
open(path, 'w', encoding='utf-8').write(out)
print('wrote', path)
