import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// 6/10/2026: học viên gõ "Children" trên Android (Zalo) ra "nerdlihC". Ô gõ đáp án
// nhận `answers` (đổi theo từng phím) làm defaultValue nên mỗi phím React lại ghi
// đè thuộc tính value của chính ô đang gõ. Ô gõ chữ phải qua AnswerTextInput
// (giá trị ban đầu đóng băng lúc mount) và không dùng inline-flex.
const source = readFileSync("components/attempt-workspace.tsx", "utf8");

describe("ô gõ đáp án không bị ghi đè khi đang gõ", () => {
  it("không truyền đáp án sống thẳng vào defaultValue", () => {
    expect(source).not.toMatch(/defaultValue=\{savedAnswers/);
    expect(source).not.toMatch(/defaultValue=\{initialValue\}/);
    expect(source).not.toMatch(/defaultValue=\{answers/);
  });

  it("AnswerTextInput đóng băng giá trị ban đầu bằng useState", () => {
    expect(source).toMatch(/const \[frozenInitial\] = useState\(initialValue\)/);
    expect(source).toMatch(/defaultValue=\{frozenInitial\}/);
  });

  it("ô gõ chữ không dùng inline-flex", () => {
    expect(source).not.toMatch(/"mx-1 inline-flex h-8 w-(24|28|40)/);
  });
});
