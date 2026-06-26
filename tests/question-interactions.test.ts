import { describe, expect, it } from "vitest";
import {
  parseMarkdownTable,
  parseQuestionOptions,
  splitPromptIntoSegments,
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
