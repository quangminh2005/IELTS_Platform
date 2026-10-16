import { describe, expect, it } from "vitest";
import { diffWords } from "@/lib/ai-grading/word-diff";

function changed(segments: { text: string; changed: boolean }[]): string[] {
  return segments.filter((segment) => segment.changed).map((segment) => segment.text);
}

describe("diffWords — tô màu bản nâng cấp", () => {
  it("chỉ tô chữ bị thay, gộp các chữ liền nhau thành một vệt", () => {
    const diff = diffWords(
      "Many people believes that technology are useful.",
      "Many people believe that technology is extremely useful."
    );
    expect(changed(diff.original)).toEqual(["believes", "are"]);
    expect(changed(diff.improved)).toEqual(["believe", "is extremely"]);
  });

  it("ghép lại đúng nguyên văn hai bài, giữ xuống dòng giữa các đoạn", () => {
    const a = "First paragraph here.\n\nSecond one is short.";
    const b = "First paragraph here.\n\nThe second one is brief.";
    const diff = diffWords(a, b);
    expect(diff.original.map((s) => s.text).join("")).toBe(a);
    expect(diff.improved.map((s) => s.text).join("")).toBe(b);
    expect(diff.original.some((s) => s.changed && s.text.includes("\n"))).toBe(false);
  });

  it("không coi khác chỉ vì hoa/thường hay dấu câu dính chữ", () => {
    const diff = diffWords("In conclusion technology helps.", "In conclusion, Technology helps.");
    expect(changed(diff.original)).toEqual([]);
    expect(changed(diff.improved)).toEqual([]);
  });

  it("bài trống vẫn chạy: cả bản nâng cấp là chữ mới", () => {
    const diff = diffWords("", "New text");
    expect(diff.original).toEqual([]);
    expect(diff.improved).toEqual([{ text: "New text", changed: true }]);
  });
});
