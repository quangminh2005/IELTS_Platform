"""Gộp 4 unit + transcript Whisper thành một file JSON import được.

Dẫn chứng (evidence) KHÔNG gõ tay: script dò 'evidenceHint' trong chính đoạn
transcript sẽ lưu vào DB rồi cắt trọn câu chứa nó ra — nhờ vậy dẫn chứng luôn
khớp nguyên văn, thẻ Giải thích ở trang kết quả bấm được.
"""
import json
import re
import sys
from pathlib import Path

BASE = Path("E:/web_ielts/tmp")
PARTS = BASE / "ocg_test2_parts"
STT = BASE / "ocg_test2_stt"
OUT = BASE / "ocg_test2_listening.json"


# Whisper nghe nhầm ở vài chỗ. Chỉ sửa những chỗ ĐÃ ĐỐI CHIẾU với audio/đề và
# có ảnh hưởng tới câu hỏi — không "làm đẹp" transcript tuỳ tiện.
CORRECTIONS = {
    1: [
        # Câu 5 hỏi đúng chi tiết này: người nói phân biệt CHỮ SỐ 4 với chữ "four".
        ("that's the number for, not the word for.", "that's the number four, not the word four."),
    ],
    # Hai chỗ dưới đây Whisper nuốt mất từ đầu câu ở ranh giới segment.
    2: [
        ("extinction. at the Sea Life Centre", "extinction. Here at the Sea Life Centre"),
    ],
    3: [
        ("sooner or later. more a question", "sooner or later. It's more a question"),
    ],
}


def apply_corrections(text: str, section: int) -> str:
    for wrong, right in CORRECTIONS.get(section, []):
        if wrong not in text:
            raise SystemExit(f"section {section}: không thấy chuỗi cần sửa {wrong!r}")
        text = text.replace(wrong, right)
    return text


def format_transcript(raw: str) -> str:
    """Whisper trả về một dòng dài. Tách câu rồi gộp 4 câu một đoạn cho dễ đọc."""
    text = re.sub(r"\s+", " ", raw).strip()
    sentences = re.split(r"(?<=[.!?])\s+", text)
    paragraphs = [
        " ".join(sentences[i : i + 4]).strip() for i in range(0, len(sentences), 4)
    ]
    return "\n\n".join(p for p in paragraphs if p)


def find_evidence(transcript: str, hint: str) -> str | None:
    """Cắt trọn câu chứa hint. Trả None nếu không tìm thấy (để báo lỗi, không đoán)."""
    low = transcript.lower()
    pos = low.find(hint.lower())
    if pos < 0:
        return None
    start = max(
        transcript.rfind(". ", 0, pos),
        transcript.rfind("? ", 0, pos),
        transcript.rfind("! ", 0, pos),
        transcript.rfind("\n", 0, pos),
    )
    start = 0 if start < 0 else start + 1
    tail = re.search(r"[.!?](\s|$)", transcript[pos:])
    end = pos + tail.end() if tail else len(transcript)
    return transcript[start:end].strip()


units = []
missing = []

for n in (1, 2, 3, 4):
    unit = json.loads((PARTS / f"unit{n}.json").read_text(encoding="utf-8"))
    raw = (STT / f"section{n}.txt").read_text(encoding="utf-8")
    transcript = format_transcript(apply_corrections(raw, n))
    unit["transcript"] = transcript
    unit.pop("audioKey", None)

    for q in unit["questions"]:
        # Dạng điền chỗ trống không có đề riêng (đề nằm trong noteBody), nhưng cột
        # prompt trong DB bắt buộc phải có giá trị.
        q.setdefault("prompt", f"Question {q['order']}")
        hint = q.pop("evidenceHint", None)
        if not hint:
            continue
        ev = find_evidence(transcript, hint)
        if ev:
            q["evidence"] = ev
        else:
            missing.append((n, q["order"], hint))

    units.append(unit)

material = {
    "title": "The Official Cambridge Guide to IELTS - Listening Test 2",
    "skill": "listening",
    "sourceLabel": "The Official Cambridge Guide to IELTS - Practice Test 2",
    "description": "Đề nghe đầy đủ 4 phần, 40 câu, có transcript và giải thích từng câu.",
    "units": units,
}

OUT.write_text(json.dumps(material, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

total = sum(len(u["questions"]) for u in units)
with_ev = sum(1 for u in units for q in u["questions"] if q.get("evidence"))
print(f"Đã ghi {OUT}: {len(units)} phần, {total} câu, {with_ev} câu có dẫn chứng.")

if missing:
    print(f"\nKHÔNG tìm thấy dẫn chứng cho {len(missing)} câu:")
    for n, order, hint in missing:
        print(f"  section {n} câu {order}: {hint!r}")
    sys.exit(1)
