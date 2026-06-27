import { describe, expect, it } from "vitest";
import {
  parseMarkdownTable,
  parseQuestionOptions,
  promptHasGap,
  splitPromptIntoGapSegments,
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
