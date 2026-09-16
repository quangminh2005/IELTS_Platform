// Chế độ "làm từng bước" cho các unit dài (sách Listening Practice Through
// Dictation: 5 mục A–E, mục E khoét ~100–200 ô). Bật bằng metadata.stepMode = true
// của phần. Màn làm bài chỉ hiện MỘT bước mỗi lúc thay vì cả bức tường ô trống.
//
// Toàn bộ hàm ở đây THUẦN LOGIC (không DB, không React) — dùng chung cho server
// (tính mốc giờ từng dòng ghi chú, nơi có transcript + đáp án) lẫn client (chia
// một đoạn ghi chú thành nhiều bước ngắn).

import { parseTranscriptTiming, tokenizeWithOffsets } from "@/lib/transcript-timing";

// Số ô trống tối đa trong một bước dictation — vừa một màn điện thoại.
export const STEP_MAX_BLANKS = 20;

const BLANK_RE = /\[\[(\d+)\]\]/g;

export function countBlanks(line: string): number {
  return (line.match(BLANK_RE) ?? []).length;
}

// Dòng "khung" (:::box, :::flow, :::, :::break…) không phải lời thoại.
function isFenceLine(line: string): boolean {
  return line.trim().startsWith(":::");
}

export type NoteChunk = {
  // Chỉ số dòng (trong mảng `lines` truyền vào) của dòng đầu và dòng cuối.
  lineStart: number;
  lineEnd: number;
  text: string;
  blanks: number;
};

// Chia các dòng của một đoạn ghi chú thành từng "bước": gom dòng liên tiếp cho tới
// khi vượt quá `maxBlanks` ô trống. Không bao giờ cắt giữa dòng (một lượt thoại
// luôn nằm trọn trong một bước). Dòng mở đầu không có ô trống (tiêu đề, "W: OK.")
// đi cùng bước của dòng có ô trống kế tiếp. Đoạn không có ô trống nào -> một bước.
export function chunkNoteLines(lines: string[], maxBlanks = STEP_MAX_BLANKS): NoteChunk[] {
  const chunks: NoteChunk[] = [];
  let current: NoteChunk | null = null;
  lines.forEach((line, index) => {
    const blanks = countBlanks(line);
    if (current && current.blanks > 0 && current.blanks + blanks > maxBlanks) {
      chunks.push(current);
      current = null;
    }
    if (!current) {
      current = { lineStart: index, lineEnd: index, text: line, blanks };
      return;
    }
    current.lineEnd = index;
    current.text += `\n${line}`;
    current.blanks += blanks;
  });
  if (current) {
    chunks.push(current);
  }
  return chunks;
}

export type LineTime = [start: number, end: number];

// Mốc giây [bắt đầu, kết thúc] trong audio của TỪNG DÒNG noteBody (theo chỉ số
// dòng của cả noteBody, kể cả dòng fence -> null). Dòng không tìm thấy trong
// transcript (câu ví dụ mục A, tiêu đề) -> null. Client dùng để làm nút "Nghe lại
// đoạn này" cho mỗi bước; chỉ gồm số nên không lộ transcript/đáp án.
export function computeNoteLineTimes(input: {
  noteBody: string;
  answersByOrder: Record<number, string>;
  transcript: string | null | undefined;
  transcriptTimingJson: string | null | undefined;
}): Array<LineTime | null> {
  const lines = input.noteBody.split(/\r?\n/);
  const empty: Array<LineTime | null> = lines.map(() => null);
  const timing = parseTranscriptTiming(input.transcriptTimingJson);
  if (!timing || !input.transcript) {
    return empty;
  }
  const words = tokenizeWithOffsets(input.transcript).map((token) => token.norm);
  // timing.words đi 1:1 với từ của transcript; lệch = dữ liệu cũ, bỏ qua cho an toàn.
  if (words.length === 0 || timing.words.length !== words.length) {
    return empty;
  }
  const times = timing.words.map((word) => word.t);
  const lastEnd = times[times.length - 1] + 3;

  const out = empty.slice();
  let cursor = 0;
  lines.forEach((rawLine, index) => {
    if (rawLine.trim() === ":::break") {
      // Sang nhóm câu mới (vd từ mục C sang mục E): dò lại từ đầu bài nghe.
      cursor = 0;
      return;
    }
    if (isFenceLine(rawLine)) {
      return;
    }
    const filled = rawLine
      .replace(/^\s*\d+\.\s*/, "")
      .replace(BLANK_RE, (_m, order: string) => ` ${input.answersByOrder[Number(order)] ?? ""} `);
    const lineWords = tokenizeWithOffsets(filled).map((token) => token.norm);
    if (lineWords.length === 0) {
      return;
    }
    const probe = lineWords.slice(0, Math.min(4, lineWords.length));
    const found = findSequence(words, probe, cursor);
    if (found === -1) {
      return;
    }
    const endIdx = Math.min(words.length - 1, found + lineWords.length - 1);
    const end = endIdx + 1 < times.length ? times[endIdx + 1] : lastEnd;
    out[index] = [times[found], end];
    cursor = found + lineWords.length;
  });
  return out;
}

// Vị trí đầu tiên (>= from) mà `probe` xuất hiện liên tiếp trong `words`; -1 nếu không có.
function findSequence(words: string[], probe: string[], from: number): number {
  const limit = words.length - probe.length;
  for (let i = Math.max(0, from); i <= limit; i++) {
    let ok = true;
    for (let k = 0; k < probe.length; k++) {
      if (words[i + k] !== probe[k]) {
        ok = false;
        break;
      }
    }
    if (ok) {
      return i;
    }
  }
  return -1;
}

// Khoảng audio của một bước = từ dòng đầu tới dòng cuối có mốc giờ. Thiếu mốc ở
// mọi dòng -> null (không hiện nút nghe lại).
export function chunkTimeRange(
  lineTimes: Array<LineTime | null>,
  lineStart: number,
  lineEnd: number
): LineTime | null {
  let start: number | null = null;
  let end: number | null = null;
  for (let i = lineStart; i <= lineEnd; i++) {
    const t = lineTimes[i];
    if (!t) continue;
    if (start === null || t[0] < start) start = t[0];
    if (end === null || t[1] > end) end = t[1];
  }
  return start === null || end === null ? null : [start, end];
}

// Nhãn bước gọn: "E · Dictation" từ groupTitle "E  Dictation"; kèm "(đoạn 2/5)".
export function stepLabel(groupTitle: string | undefined, part: number, total: number): string {
  const base = groupTitle
    ? groupTitle.replace(/^([A-Z])\s{2,}/, "$1 · ").trim()
    : "";
  if (total > 1) {
    return `${base || "Bước"} (đoạn ${part}/${total})`;
  }
  return base;
}
