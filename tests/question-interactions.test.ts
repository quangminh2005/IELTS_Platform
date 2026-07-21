import { describe, expect, it } from "vitest";
import {
  combineCompositeParts,
  countBlankParts,
  parseMarkdownTable,
  parseQuestionOptions,
  promptHasGap,
  splitCompositeParts,
  splitPromptIntoGapSegments,
  splitPromptIntoSegments,
  tableBlankPartIndexes,
  usesDragDropAnswer
} from "../lib/question-interactions";

describe("parseQuestionOptions", () => {
  it("reads string options from JSON arrays", () => {
    expect(parseQuestionOptions('["A lower expectations", "B average learners"]')).toEqual([
      "A lower expectations",
      "B average learners"
    ]);
  });

  it("ignores invalid option JSON", () => {
    expect(parseQuestionOptions("not json")).toEqual([]);
  });
});

describe("usesDragDropAnswer", () => {
  it("enables drag and drop for matching and inline option questions", () => {
    expect(usesDragDropAnswer("drag_drop_matching", ["A"])).toBe(true);
    expect(usesDragDropAnswer("inline_gap_fill", ["A"])).toBe(true);
  });

  it("keeps ordinary multiple choice questions as radio inputs", () => {
    expect(usesDragDropAnswer("multiple_choice", ["A", "B"])).toBe(false);
  });
});

describe("splitPromptIntoSegments", () => {
  it("splits prompts around IELTS-style placeholders", () => {
    expect(splitPromptIntoSegments("The answer is [[31]] and [[32]].")).toEqual([
      { type: "text", value: "The answer is " },
      { type: "blank", value: "31" },
      { type: "text", value: " and " },
      { type: "blank", value: "32" },
      { type: "text", value: "." }
    ]);
  });
});

describe("promptHasGap", () => {
  it("detects underscore blanks and [[n]] placeholders", () => {
    expect(promptHasGap("Diet consists of fern fronds and _____.")).toBe(true);
    expect(promptHasGap("The answer is [[24]].")).toBe(true);
  });

  it("is false for prompts without a blank", () => {
    expect(promptHasGap("Which TWO statements are true?")).toBe(false);
    expect(promptHasGap("[Arrival of settlers] context only")).toBe(false);
  });
});

describe("splitPromptIntoGapSegments", () => {
  it("splits short-answer prompts around underscore blanks", () => {
    expect(
      splitPromptIntoGapSegments(
        "[Notes] Diet consists of fern fronds, parts of a tree and _____."
      )
    ).toEqual([
      { type: "text", value: "[Notes] Diet consists of fern fronds, parts of a tree and " },
      { type: "blank", value: "" },
      { type: "text", value: "." }
    ]);
  });

  it("still handles [[n]] placeholders", () => {
    expect(splitPromptIntoGapSegments("Corals have a number of [[24]] which they use.")).toEqual([
      { type: "text", value: "Corals have a number of " },
      { type: "blank", value: "24" },
      { type: "text", value: " which they use." }
    ]);
  });

  it("returns the whole prompt as text when there is no blank", () => {
    expect(splitPromptIntoGapSegments("No blank here")).toEqual([
      { type: "text", value: "No blank here" }
    ]);
  });
});

describe("parseMarkdownTable", () => {
  it("parses pipe tables and preserves placeholders in cells", () => {
    expect(
      parseMarkdownTable(`
| Name | Location |
| --- | --- |
| The Junction | Good for [[1]] |
| Paloma | [[2]] food |
`)
    ).toEqual({
      headers: ["Name", "Location"],
      rows: [
        ["The Junction", "Good for [[1]]"],
        ["Paloma", "[[2]] food"]
      ]
    });
  });

  it("returns null for ordinary content", () => {
    expect(parseMarkdownTable("No table here")).toBeNull();
  });
});

// Ô ghép: đề in một câu thành nhiều chỗ trống ("both ___ and ___",
// "not ___ or ___") nhưng answer key chỉ đánh MỘT số.
describe("ô ghép (composite blanks)", () => {
  it("đếm số ô của mỗi câu trong thân ghi chú", () => {
    expect(countBlankParts("pictures of both [[33]] and [[33]], plus [[34]]")).toEqual({
      33: 2,
      34: 1
    });
  });

  it("đếm được ô ghép nằm trong ô của bảng", () => {
    expect(
      countBlankParts("| Leo Norris | [[6]] | • Not [[7]] or [[7]] | [[8]] |")
    ).toEqual({ 6: 1, 7: 2, 8: 1 });
  });

  it("tách đáp án đã lưu về đúng số ô", () => {
    expect(splitCompositeParts("competitive and stressed", 2)).toEqual([
      "competitive",
      "stressed"
    ]);
  });

  it("bù ô rỗng khi đáp án lưu còn thiếu phần", () => {
    expect(splitCompositeParts("competitive", 2)).toEqual(["competitive", ""]);
    expect(splitCompositeParts("", 2)).toEqual(["", ""]);
  });

  it("nối các ô lại bằng ' and ' để nộp/chấm", () => {
    expect(combineCompositeParts(["competitive", "stressed"])).toBe(
      "competitive and stressed"
    );
  });

  it("coi là CHƯA trả lời khi mọi ô đều trống", () => {
    expect(combineCompositeParts(["", "   "])).toBe("");
  });

  it("vẫn nộp phần đã điền khi mới điền một ô", () => {
    expect(combineCompositeParts(["competitive", ""])).toBe("competitive and ");
  });

  it("đánh số thứ tự các ô của bảng theo thứ tự đọc", () => {
    const table = parseMarkdownTable(`
| Name | Description |
| --- | --- |
| Leo | • Not [[7]] or [[7]] |
| Phil | [[2]] |
`);

    expect(tableBlankPartIndexes(table?.rows ?? [])).toEqual({
      // dòng 0, cột 1: segment 1 là ô đầu, segment 3 là ô thứ hai của cùng câu 7
      "0-1-1": 0,
      "0-1-3": 1,
      "1-1-0": 0
    });
  });
});
