# -*- coding: utf-8 -*-
"""Cat so do "Podkletnov's Antigravity Device" (cau 27-30) tu trang 8 cua Test 47.pdf
ra data URI de nhet vao metadata.groupImages.
"""
import base64
import io
import sys

import fitz
from PIL import Image

sys.stdout.reconfigure(encoding="utf-8")

PDF = r"E:/ielts_master/reading/Reading (41-50)/47/Test 47.pdf"
# Vung so do tren trang 8 (bo dong huong dan phia tren va watermark ben phai).
CLIP = fitz.Rect(66, 251, 388, 632)

doc = fitz.open(PDF)
pix = doc[7].get_pixmap(matrix=fitz.Matrix(3, 3), clip=CLIP)
img = Image.open(io.BytesIO(pix.tobytes("png"))).convert("L")
img = img.resize((880, round(880 * img.height / img.width)), Image.LANCZOS)

buf = io.BytesIO()
img.save(buf, "JPEG", quality=72, optimize=True)
data = buf.getvalue()

open("tmp/_r47_diag.txt", "w", encoding="utf-8").write(
    "data:image/jpeg;base64," + base64.b64encode(data).decode()
)
print("OK -> tmp/_r47_diag.txt |", img.size, "|", len(data) // 1024, "KB")
