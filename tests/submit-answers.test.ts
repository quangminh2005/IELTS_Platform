import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fillMissingAnswers } from "../lib/submit-answers";

// Lỗi 17/09/2026: sau commit "chỉ dựng DOM cho phần đang mở", form nộp bài chỉ
// còn input của part đang mở → submitSkill xoá nháp rồi ghi lại đúng 1 part,
// 2 học viên mất 20/28 câu Listening. Đáp án phải được bù từ state `answers`.
describe("fillMissingAnswers", () => {
  it("bù mọi câu chưa có trong FormData từ state", () => {
    const formData = new FormData();
    formData.set("attemptId", "a1");
    formData.set("q_part1", "bike");

    fillMissingAnswers(formData, { q_part1_ignored: "", part1: "bike", part2: "B", part3: "" });

    expect(formData.get("q_part1")).toBe("bike");
    expect(formData.get("q_part2")).toBe("B");
    expect(formData.get("q_part3")).toBe("");
    expect(formData.get("attemptId")).toBe("a1");
  });

  it("KHÔNG ghi đè giá trị đã có trong DOM (input đang mở là mới nhất)", () => {
    const formData = new FormData();
    formData.set("q_x", "dom-value");

    fillMissingAnswers(formData, { x: "state-value" });

    expect(formData.get("q_x")).toBe("dom-value");
  });

  it("trả về số câu đã bù để ghi log", () => {
    const formData = new FormData();
    formData.set("q_a", "1");
    expect(fillMissingAnswers(formData, { a: "1", b: "2", c: "3" })).toBe(2);
  });
});

describe("chống tái phát: nộp bài không lệ thuộc DOM của part đang mở", () => {
  const workspace = readFileSync(
    join(process.cwd(), "components/attempt-workspace.tsx"),
    "utf8"
  );

  it("form nộp đi qua fillMissingAnswers trước khi gọi submitSkill", () => {
    expect(workspace).toContain("fillMissingAnswers(formData, answers)");
    expect(workspace).not.toContain("action={previewMode ? undefined : submitSkill}");
  });
});

describe("phòng thủ lớp 2: submitSkill lấy lại từ nháp cho câu form không gửi", () => {
  const attempts = readFileSync(join(process.cwd(), "lib/actions/attempts.ts"), "utf8");

  it("chỉ dùng formData khi có key, còn lại đọc Answer nháp đã lưu", () => {
    expect(attempts).toContain("formData.has(`q_${questionId}`)");
    expect(attempts).toContain("draftByQuestion.get(questionId)");
  });
});
