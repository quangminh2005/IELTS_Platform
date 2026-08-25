# -*- coding: utf-8 -*-
"""Cat so do hat ca phe (cau 34-36) tu trang 7 cua Test 49.pdf ra data URI."""
import base64
import io
import sys

import fitz
from PIL import Image

sys.stdout.reconfigure(encoding="utf-8")

PDF = r"E:/ielts_master/reading/Reading (41-50)/49/Test 49.pdf"
CLIP = fitz.Rect(70, 118, 512, 316)  # vung anh so do tren trang 7

doc = fitz.open(PDF)
pix = doc[6].get_pixmap(matrix=fitz.Matrix(3, 3), clip=CLIP)
img = Image.open(io.BytesIO(pix.tobytes("png"))).convert("L")
img = img.resize((900, round(900 * img.height / img.width)), Image.LANCZOS)

buf = io.BytesIO()
img.save(buf, "JPEG", quality=74, optimize=True)
data = buf.getvalue()

open("tmp/_r49_diag.txt", "w", encoding="utf-8").write(
    "data:image/jpeg;base64," + base64.b64encode(data).decode()
)
img.save(
    r"C:/Users/Admin/AppData/Local/Temp/claude/E--web-ielts/"
    r"d78b30d8-c464-46df-9a17-b8209ff19e02/scratchpad/diag49.jpg",
    "JPEG", quality=74, optimize=True,
)
print("OK -> tmp/_r49_diag.txt |", img.size, "|", len(data) // 1024, "KB")
