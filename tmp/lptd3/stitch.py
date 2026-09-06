# -*- coding: utf-8 -*-
"""Ghep phan Dictation cua mot unit (cuoi trang 3N-1 + trang 3N) thanh 1 anh.

    python tmp/lptd3/stitch.py <unit>   -> scratchpad/dict.png
"""
import sys, pdfplumber
from PIL import Image

SC = r'C:\Users\Admin\AppData\Local\Temp\claude\E--web-ielts\1f5ada91-21ca-481b-88bd-6a5aaa20946e\scratchpad'
SRC = r'E:\Listening Practice Through Dictation 3\Listening Practice Through Dictation 3.pdf'
DPI = 150.0 / 72.0

n = int(sys.argv[1])
p1, p2 = 3 * n - 1, 3 * n

with pdfplumber.open(SRC) as pdf:
    pg = pdf.pages[p1 - 1]
    y0 = None
    for w in pg.extract_words(x_tolerance=2):
        if w['text'].startswith('complete'):
            y0 = w['bottom']
    if y0 is None:
        y0 = pg.height * 0.55
    h1 = pg.height

im1 = Image.open(SC + r'\png\p%03d.png' % p1)
im2 = Image.open(SC + r'\png\p%03d.png' % p2)
a = im1.crop((0, int(y0 * DPI), im1.width, int((h1 - 30) * DPI)))
# Day noi dung trang 3N: do bang pixel (lop chu OCR hay sot dong cuoi).
import numpy as np
g = np.asarray(im2.convert('L'))
top0 = int(78 * DPI)
foot = int(im2.height * 0.955)
dark = (g[:foot, 120:im2.width - 150] < 120).sum(axis=1)
rows2 = np.nonzero(dark > 3)[0]
y2px = min(foot, (int(rows2[-1]) + 55) if len(rows2) else int(im2.height * 0.85))
b = im2.crop((0, top0, im2.width, y2px))

out = Image.new('RGB', (max(a.width, b.width), a.height + b.height + 12), 'white')
out.paste(a, (0, 0))
out.paste(b, (0, a.height + 12))
path = SC + r'\dict.png'
out.save(path)
print(path, out.size)
