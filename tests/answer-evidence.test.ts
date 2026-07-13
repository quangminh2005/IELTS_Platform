import { describe, expect, it } from "vitest";
import {
  deriveAnswerEvidence,
  splitByAnswerMatches,
  fillSourceBlanks,
  buildEvidenceSegments
} from "@/lib/answer-evidence";

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

  it("khớp linh hoạt khoảng trắng: đáp án không cách khớp bản có cách", () => {
    const parts = splitByAnswerMatches("Postcode GT8 2LC here.", ["GT82LC"]);
    expect(parts).toEqual([
      { text: "Postcode ", match: false },
      { text: "GT8 2LC", match: true },
      { text: " here.", match: false }
    ]);
  });

  it("khớp linh hoạt khoảng trắng: đáp án có cách khớp bản không cách", () => {
    const parts = splitByAnswerMatches("Code GT82LC done.", ["GT8 2LC"]);
    expect(parts).toEqual([
      { text: "Code ", match: false },
      { text: "GT82LC", match: true },
      { text: " done.", match: false }
    ]);
  });

  it("chọn biến thể đáp án xuất hiện trong text", () => {
    const parts = splitByAnswerMatches("I am John Peterson here.", ["John Petterson", "John Peterson"]);
    expect(parts.some((p) => p.match && p.text === "John Peterson")).toBe(true);
  });

  it("tô đáp án đọc đánh vần (gạch nối)", () => {
    const parts = splitByAnswerMatches("Yes, it's H-A-R-D-I-E.", ["Hardie"]);
    expect(parts.some((p) => p.match && p.text === "H-A-R-D-I-E")).toBe(true);
  });

  it("tô đáp án đọc đánh vần (khoảng trắng)", () => {
    const parts = splitByAnswerMatches("spelt H A R D I E ok", ["Hardie"]);
    expect(parts.some((p) => p.match && p.text === "H A R D I E")).toBe(true);
  });

  it("không tô cách viết sai gây nhiễu (không khớp mờ)", () => {
    const parts = splitByAnswerMatches("Louisa: Hardy.", ["Hardie"]);
    expect(parts.every((p) => !p.match)).toBe(true);
  });

  it("không tô bừa đáp án 2 ký tự vào chuỗi có dấu ngăn cách", () => {
    const parts = splitByAnswerMatches("wear a t-shirt", ["at"]);
    expect(parts.every((p) => !p.match)).toBe(true);
  });
});

describe("fillSourceBlanks", () => {
  it("thay [[n]] bằng đáp án đúng của câu order n", () => {
    expect(fillSourceBlanks("The [[1]] is hot.", { 1: "core" })).toBe("The core is hot.");
  });

  it("thiếu đáp án -> ____", () => {
    expect(fillSourceBlanks("A [[2]] b", {})).toBe("A ____ b");
  });

  it("không có blank -> giữ nguyên", () => {
    expect(fillSourceBlanks("No blanks here", { 1: "x" })).toBe("No blanks here");
  });
});

describe("buildEvidenceSegments", () => {
  it("định vị câu dẫn chứng và gắn từ đáp án cho câu", () => {
    const source = "Man: What is your name? Louisa: It's Hardie. Man: Thanks.";
    const { segments, linkedOrders } = buildEvidenceSegments(
      source,
      [{ order: 1, evidence: "Louisa: It's Hardie.", answers: ["Hardie"] }],
      {}
    );
    expect(linkedOrders).toEqual([1]);
    expect(segments.some((s) => s.sentenceOrders.includes(1))).toBe(true);
    const ans = segments.find((s) => s.answerOrders.includes(1));
    expect(ans?.text).toBe("Hardie");
    // Ghép lại phải đúng nguyên văn nguồn (không mất/không thừa ký tự).
    expect(segments.map((s) => s.text).join("")).toBe(source);
  });

  it("bỏ qua câu có evidence không nằm trong nguồn", () => {
    const { segments, linkedOrders } = buildEvidenceSegments(
      "No such sentence here.",
      [{ order: 2, evidence: "Completely different text.", answers: ["x"] }],
      {}
    );
    expect(linkedOrders).toEqual([]);
    expect(segments).toEqual([
      { text: "No such sentence here.", sentenceOrders: [], answerOrders: [] }
    ]);
  });

  it("hai câu cùng một câu văn -> đoạn mang cả hai order", () => {
    const source = "The core and the mantle are hot layers.";
    const { segments } = buildEvidenceSegments(
      source,
      [
        { order: 1, evidence: "The core and the mantle are hot layers.", answers: ["core"] },
        { order: 2, evidence: "The core and the mantle are hot layers.", answers: ["mantle"] }
      ],
      {}
    );
    expect(
      segments.some((s) => s.sentenceOrders.includes(1) && s.sentenceOrders.includes(2))
    ).toBe(true);
    expect(segments.some((s) => s.answerOrders.includes(1) && s.text === "core")).toBe(true);
    expect(segments.some((s) => s.answerOrders.includes(2) && s.text === "mantle")).toBe(true);
  });

  it("điền [[n]] trong evidence để khớp nguồn đã điền", () => {
    const filled = "The summary says the answer is photosynthesis clearly.";
    const { segments, linkedOrders } = buildEvidenceSegments(
      filled,
      [
        {
          order: 3,
          evidence: "The summary says the answer is [[3]] clearly.",
          answers: ["photosynthesis"]
        }
      ],
      { 3: "photosynthesis" }
    );
    expect(linkedOrders).toEqual([3]);
    expect(
      segments.some((s) => s.answerOrders.includes(3) && s.text === "photosynthesis")
    ).toBe(true);
  });

  it("đáp án không khớp nguyên văn -> có câu, trống từ đáp án", () => {
    const source = "Yes, it's Hardy spelled differently.";
    const { segments } = buildEvidenceSegments(
      source,
      [{ order: 1, evidence: "Yes, it's Hardy spelled differently.", answers: ["Hardie"] }],
      {}
    );
    expect(segments.some((s) => s.sentenceOrders.includes(1))).toBe(true);
    expect(segments.every((s) => s.answerOrders.length === 0)).toBe(true);
  });
});
