# -*- coding: utf-8 -*-
"""Cat mot phan trang PNG ra file de doc ky. crop.py <page> <y0%> <y1%> [out]"""
import sys
from PIL import Image
SC = r'C:\Users\Admin\AppData\Local\Temp\claude\E--web-ielts\1f5ada91-21ca-481b-88bd-6a5aaa20946e\scratchpad'
pg, y0, y1 = int(sys.argv[1]), float(sys.argv[2]), float(sys.argv[3])
out = sys.argv[4] if len(sys.argv) > 4 else SC + r'\crop.png'
im = Image.open(SC + r'\png\p%03d.png' % pg)
w, h = im.size
im = im.crop((0, int(h * y0 / 100), w, int(h * y1 / 100)))
im = im.resize((int(im.width * 1.35), int(im.height * 1.35)), Image.LANCZOS)
im.save(out)
print(out, im.size)
