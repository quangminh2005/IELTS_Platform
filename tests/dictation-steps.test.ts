import { describe, expect, it } from "vitest";
import {
  chunkNoteLines,
  chunkTimeRange,
  computeNoteLineTimes,
  stepLabel
} from "../lib/dictation-steps";
import { buildTranscriptTiming } from "../lib/transcript-timing";

describe("chunkNoteLines", () => {
  it("gom dòng liên tiếp cho tới khi vượt số ô tối đa, không cắt giữa dòng", () => {
    const lines = [
      "W: Some [[1]] in cold [[2]] hibernate.",
      "M: They [[3]] [[4]] [[5]].",
      "W: OK.",
      "M: Then [[6]] [[7]]."
    ];
    const chunks = chunkNoteLines(lines, 5);
    expect(chunks.map((c) => [c.lineStart, c.lineEnd, c.blanks])).toEqual([
      [0, 2, 5],
      [3, 3, 2]
    ]);
    expect(chunks[0].text).toBe(
      "W: Some [[1]] in cold [[2]] hibernate.\nM: They [[3]] [[4]] [[5]].\nW: OK."
    );
  });

  it("một dòng nhiều ô hơn giới hạn vẫn là một bước trọn vẹn", () => {
    const lines = ["[[1]] [[2]] [[3]] [[4]] [[5]]", "[[6]]"];
    const chunks = chunkNoteLines(lines, 3);
    expect(chunks.map((c) => c.blanks)).toEqual([5, 1]);
  });

  it("đoạn không có ô trống nào -> một bước", () => {
    expect(chunkNoteLines(["a", "b"], 3)).toHaveLength(1);
  });
});

describe("computeNoteLineTimes", () => {
  const transcript = "W: Some animals in cold climates hibernate. M: They dig out shelters.";
  const asr = transcript
    .replace(/[^\w' ]/g, "")
    .split(/\s+/)
    .map((word, i) => ({ word, start: i * 1.5 }));
  const timingJson = JSON.stringify(buildTranscriptTiming(transcript, asr));

  it("tìm mốc giờ của dòng có ô trống sau khi điền đáp án", () => {
    const noteBody = [
      "1. A cave can be [[1]] during bad weather.",
      ":::break",
      "W: Some [[2]] in cold [[3]] hibernate.",
      "M: They [[4]] out shelters."
    ].join("\n");
    const times = computeNoteLineTimes({
      noteBody,
      answersByOrder: { 1: "shelter", 2: "animals", 3: "climates", 4: "dig" },
      transcript,
      transcriptTimingJson: timingJson
    });
    // Câu ví dụ mục A không có trong transcript -> null; dòng fence -> null.
    expect(times[0]).toBeNull();
    expect(times[1]).toBeNull();
    // "W Some animals in cold climates hibernate" = từ 0..6 -> bắt đầu 0, kết thúc = mốc từ 7.
    expect(times[2]).toEqual([0, 10.5]);
    // "M They dig out shelters" = từ 7..11 (từ cuối) -> kết thúc = mốc cuối + 3s.
    expect(times[3]).toEqual([10.5, 16.5 + 3]);
  });

  it("không có timing -> toàn null, không nổ", () => {
    const times = computeNoteLineTimes({
      noteBody: "W: [[1]]",
      answersByOrder: { 1: "x" },
      transcript,
      transcriptTimingJson: null
    });
    expect(times).toEqual([null]);
  });
});

describe("chunkTimeRange", () => {
  it("lấy min bắt đầu / max kết thúc của các dòng có mốc", () => {
    expect(chunkTimeRange([null, [3, 5], [5, 9], null], 0, 3)).toEqual([3, 9]);
    expect(chunkTimeRange([null, null], 0, 1)).toBeNull();
  });
});

describe("stepLabel", () => {
  it("rút gọn tiêu đề nhóm và thêm số đoạn", () => {
    expect(stepLabel("E  Dictation", 1, 1)).toBe("E · Dictation");
    expect(stepLabel("E  Dictation", 2, 5)).toBe("E · Dictation (đoạn 2/5)");
    expect(stepLabel(undefined, 1, 1)).toBe("");
  });
});
