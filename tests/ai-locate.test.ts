import { describe, expect, it } from "vitest";
import { buildHighlightSegments, locateQuote, locateQuotes } from "@/lib/ai-grading/locate";

const text = "Many people believes that  technology are useful.\nIt’s help us everyday. People believes it.";

describe("locateQuote", () => {
  it("khớp nguyên văn", () => {
    const span = locateQuote(text, "people believes");
    expect(span).toEqual({ start: 5, end: 20 });
    expect(text.slice(span!.start, span!.end)).toBe("people believes");
  });

  it("chịu khoảng trắng thừa, nháy cong và hoa thường", () => {
    const span = locateQuote(text, "that technology ARE useful");
    expect(span).not.toBeNull();
    expect(text.slice(span!.start, span!.end)).toBe("that  technology are useful");

    const curly = locateQuote(text, "It's help us");
    expect(text.slice(curly!.start, curly!.end)).toBe("It’s help us");
  });

  it("không thấy → null; chuỗi rỗng → null", () => {
    expect(locateQuote(text, "this was never written")).toBeNull();
    expect(locateQuote(text, "   ")).toBeNull();
  });

  it("tìm từ vị trí from", () => {
    const span = locateQuote(text, "believes", 25);
    expect(text.slice(0, span!.start)).toContain("everyday. People ");
  });
});

describe("locateQuotes", () => {
  it("đoạn trích lặp lại lấy lần xuất hiện kế tiếp, không đè lên nhau", () => {
    const spans = locateQuotes(text, ["believes", "believes", "missing"]);
    expect(spans[0]!.start).toBeLessThan(spans[1]!.start);
    expect(spans[2]).toBeNull();
  });
});

describe("buildHighlightSegments", () => {
  it("cắt chữ thành đoạn thường + đoạn lỗi, bỏ span đè nhau", () => {
    const segments = buildHighlightSegments("abcdefghij", [
      { start: 2, end: 4 },
      null,
      { start: 3, end: 6 },
      { start: 7, end: 9 }
    ]);
    expect(segments).toEqual([
      { text: "ab", index: null },
      { text: "cd", index: 0 },
      { text: "efg", index: null },
      { text: "hi", index: 3 },
      { text: "j", index: null }
    ]);
  });
});
