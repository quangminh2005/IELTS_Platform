# -*- coding: utf-8 -*-
"""OCR sach LPTD 4 (ban scan). Unit N = trang PDF 3N+5..3N+7.
Ghi tmp/lptd4/ocr/pNNN.tsv: y0 \t y1 \t x0 \t x1 \t score \t text (toa do theo anh 400dpi).
Ghi them anh 110dpi de doc bang mat o tmp/lptd4/img/pNNN.png."""
import sys, os, fitz, numpy as np, cv2
from rapidocr_onnxruntime import RapidOCR
SRC = r'E:\Listening Practice Through Dictation 4\Listening Practice Through Dictation 4.pdf'
OUT = r'E:\web_ielts\tmp\lptd4'
doc = fitz.open(SRC)
ocr = RapidOCR()
pages = [int(a) for a in sys.argv[1:]] or list(range(8, 128))
for pno in pages:
    tsv = os.path.join(OUT, 'ocr', 'p%03d.tsv' % pno)
    if os.path.exists(tsv):
        continue
    pg = doc[pno - 1]
    pix = pg.get_pixmap(dpi=400, colorspace=fitz.csGRAY)
    a = np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.height, pix.width).astype(np.float32)
    bg = cv2.GaussianBlur(a, (0, 0), 25) + 1
    norm = np.clip(a / bg * 255, 0, 255)
    norm = np.clip((norm - 150) * 255 / 100, 0, 255).astype(np.uint8)
    img = cv2.cvtColor(norm, cv2.COLOR_GRAY2BGR)
    res, _ = ocr(img)
    lines = []
    for box, text, score in (res or []):
        xs = [p[0] for p in box]; ys = [p[1] for p in box]
        lines.append((min(ys), max(ys), min(xs), max(xs), float(score), text))
    lines.sort(key=lambda l: (round(l[0] / 20), l[2]))
    with open(tsv, 'w', encoding='utf-8') as f:
        for l in lines:
            f.write('%d\t%d\t%d\t%d\t%.3f\t%s\n' % l)
    small = pg.get_pixmap(dpi=110)
    small.save(os.path.join(OUT, 'img', 'p%03d.png' % pno))
    print('page', pno, len(lines), flush=True)
