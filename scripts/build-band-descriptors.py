"""Dựng lib/ai-grading/descriptors/*.json từ PDF IELTS Band Descriptors (bản cập nhật 5/2023).

Chạy (chỉ cần chạy lại khi IELTS ra bản descriptors mới):
    python scripts/build-band-descriptors.py "E:/IELTS band descriptor"

Chữ được chép NGUYÊN VĂN từ bảng trong PDF, chỉ nối các dòng bị ngắt giữa câu.
Script tự kiểm đủ band 9→0 và đủ 4 tiêu chí; thiếu ô nào thì dừng với lỗi.
Không in nội dung descriptors ra màn hình.
"""
import json
import re
import sys
from pathlib import Path

import pdfplumber

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "lib" / "ai-grading" / "descriptors"

WRITING_KEYS = ["taskAchievement", "coherence", "lexicalResource", "grammar"]
SPEAKING_KEYS = ["fluency", "lexicalResource", "grammar", "pronunciation"]
BULLET = re.compile(r"^[•▪●–-]\s*")


def clean(cell):
    """Nối các dòng bị ngắt; dòng bắt đầu bằng gạch đầu dòng thì giữ xuống dòng."""
    lines = [line.strip() for line in (cell or "").splitlines() if line.strip()]
    out = ""
    for line in lines:
        if not out:
            out = line
        elif BULLET.match(line):
            out += "\n" + line
        elif out.endswith("-") and len(out) > 1 and out[-2].isalpha():
            out += line  # từ bị ngắt bằng gạch nối cuối dòng
        else:
            out += " " + line
    return out.strip()


def header_name(cell):
    return re.sub(r"\s+", " ", (cell or "").replace("\n", " ")).strip()


def read_tables(pdf_path):
    """Trả về danh sách (tên 4 cột tiêu chí, {band: [4 ô]}) theo từng bảng."""
    tables = []
    with pdfplumber.open(pdf_path) as pdf:
        for page in pdf.pages:
            for table in page.extract_tables():
                if len(table) < 2 or len(table[0]) != 5:
                    continue
                names = [header_name(c) for c in table[0][1:]]
                rows = {}
                for row in table[1:]:
                    band = re.sub(r"\D", "", row[0] or "")
                    if band == "":
                        continue
                    rows[band] = [clean(c) for c in row[1:]]
                tables.append((names, rows))
    return tables


def build(tables, keys, source, first_header):
    merged_names = None
    bands = {}
    for names, rows in tables:
        if not names[0].startswith(first_header):
            continue
        merged_names = merged_names or names
        bands.update(rows)

    if merged_names is None:
        raise SystemExit(f"Không thấy bảng có cột '{first_header}' trong {source}")

    result = {}
    for band in range(9, -1, -1):
        cells = bands.get(str(band))
        if cells is None:
            raise SystemExit(f"{source}: thiếu band {band}")
        # Band 0 trong PDF là một ô gộp cả hàng: chép chữ đó cho cả 4 tiêu chí.
        if all(not c for c in cells[1:]):
            cells = [cells[0]] * 4
        for key, text in zip(keys, cells):
            if len(text) < 10:
                raise SystemExit(f"{source}: band {band} · {key} trống hoặc quá ngắn")
        result[str(band)] = dict(zip(keys, cells))

    return {
        "source": source,
        "criteria": [{"key": k, "name": n} for k, n in zip(keys, merged_names)],
        "bands": result,
    }


def main():
    if len(sys.argv) != 2:
        raise SystemExit('Dùng: python scripts/build-band-descriptors.py "E:/IELTS band descriptor"')
    folder = Path(sys.argv[1])
    writing = read_tables(folder / "IELTS Writing Band Descriptors.pdf")
    speaking = read_tables(folder / "IELTS Speaking Band Descriptors.pdf")

    outputs = {
        "writing-task1": build(writing, WRITING_KEYS, "IELTS Writing Task 1 Band Descriptors (updated May 2023)", "Task Achievement"),
        "writing-task2": build(writing, WRITING_KEYS, "IELTS Writing Task 2 Band Descriptors (updated May 2023)", "Task Response"),
        "speaking": build(speaking, SPEAKING_KEYS, "IELTS Speaking Band Descriptors", "Fluency"),
    }

    OUT.mkdir(parents=True, exist_ok=True)
    for name, data in outputs.items():
        path = OUT / f"{name}.json"
        path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        chars = sum(len(t) for row in data["bands"].values() for t in row.values())
        print(f"{name}: {len(data['bands'])} band, {chars} ky tu -> {path.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
