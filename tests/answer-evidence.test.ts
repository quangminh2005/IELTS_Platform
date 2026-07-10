import { describe, expect, it } from "vitest";
import { deriveAnswerEvidence, splitByAnswerMatches } from "@/lib/answer-evidence";

describe("deriveAnswerEvidence", () => {
  const passage =
    "Lightning is dangerous. Power companies lose money every year. Atoms split apart.";

  it("trả câu chứa đáp án nguyên văn cho câu điền từ", () => {
    expect(deriveAnswerEvidence("short_answer", ["power companies"], passage)).toBe(
      "Power companies lose money every year."
    );
  });

  it("không phân biệt hoa/thường", () => {
    expect(deriveAnswerEvidence("note_completion", ["ATOMS"], passage)).toBe(
      "Atoms split apart."
    );
  });

  it("khớp theo ranh giới từ, không lọt số con", () => {
    const src = "The room holds 120 people. Bus number 12 leaves at noon.";
    expect(deriveAnswerEvidence("note_completion", ["12"], src)).toBe(
      "Bus number 12 leaves at noon."
    );
  });

  it("ưu tiên đáp án dài nhất trong danh sách chấp nhận", () => {
    expect(deriveAnswerEvidence("short_answer", ["companies", "power companies"], passage)).toBe(
      "Power companies lose money every year."
    );
  });

  it("trả null với loại câu nhãn (MC/TF-NG/matching)", () => {
    expect(deriveAnswerEvidence("multiple_choice", ["B"], passage)).toBeNull();
    expect(deriveAnswerEvidence("true_false_not_given", ["TRUE"], passage)).toBeNull();
  });

  it("trả null khi thiếu nguồn hoặc không tìm thấy", () => {
    expect(deriveAnswerEvidence("short_answer", ["x"], null)).toBeNull();
    expect(deriveAnswerEvidence("short_answer", ["zzz"], passage)).toBeNull();
  });
});

describe("splitByAnswerMatches", () => {
  it("tách phần khớp đáp án để gạch chân", () => {
    const parts = splitByAnswerMatches("Bus number 12 leaves.", ["12"]);
    expect(parts).toEqual([
      { text: "Bus number ", match: false },
      { text: "12", match: true },
      { text: " leaves.", match: false }
    ]);
  });

  it("không có đáp án nguyên văn -> một phần không khớp", () => {
    expect(splitByAnswerMatches("See paragraph B.", ["B a laser technique"])).toEqual([
      { text: "See paragraph B.", match: false }
    ]);
  });
});
