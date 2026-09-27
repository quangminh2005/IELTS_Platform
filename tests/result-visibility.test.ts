import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { visibleResultAnswers } from "@/lib/result-visibility";

const answers = [
  { id: "l1", assignableUnit: { skill: "listening" } },
  { id: "r1", assignableUnit: { skill: "reading" } },
  { id: "w1", assignableUnit: { skill: "writing" } }
];

describe("visibleResultAnswers", () => {
  it("lượt đã nộp hẳn -> hiện mọi câu", () => {
    expect(visibleResultAnswers("submitted", [], answers)).toHaveLength(3);
  });

  it("lượt đang làm -> chỉ hiện câu của kỹ năng đã nộp, giấu nháp", () => {
    const skills = [
      { skill: "listening", status: "submitted" },
      { skill: "reading", status: "in_progress" },
      { skill: "writing", status: "not_started" }
    ];
    expect(visibleResultAnswers("in_progress", skills, answers).map((a) => a.id)).toEqual(["l1"]);
  });

  it("lượt đang làm, chưa nộp kỹ năng nào -> không hiện gì", () => {
    expect(visibleResultAnswers("in_progress", [], answers)).toEqual([]);
  });
});

describe("trang Kết quả học viên", () => {
  it("lọc câu nháp trước khi gửi xuống client", () => {
    const source = readFileSync("app/student/results/[attemptId]/page.tsx", "utf8");
    expect(source).toContain("visibleResultAnswers(");
    // Không được truyền nguyên object attempt (còn đủ câu nháp) xuống ResultReview.
    expect(source).not.toMatch(/:\s*attempt;/);
    expect(source).not.toMatch(/attempt\.answers\.(filter|forEach|map)/);
  });
});
