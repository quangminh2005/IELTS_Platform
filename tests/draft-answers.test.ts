import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { planDraftWrite } from "../lib/draft-answers";

const row = (questionId: string, value: string) => ({
  questionId,
  assignableUnitId: "unit-1",
  value
});

describe("planDraftWrite", () => {
  it("chỉ xoá đúng những câu client gửi lên, không đụng câu khác", () => {
    const plan = planDraftWrite({
      sent: [row("q1", "paris"), row("q2", "")],
      savedNonEmptyCount: 5
    });

    expect(plan.skip).toBe(false);
    expect(plan.deleteQuestionIds).toEqual(["q1", "q2"]);
    expect(plan.createRows).toEqual([row("q1", "paris")]);
  });

  // Đây là lỗi đã làm mất trắng bài Listening của một học sinh: nhịp tự lưu chạy
  // khi form chưa hiện (màn kiểm tra âm thanh) nên state rỗng, cũ xoá sạch DB.
  it("KHÔNG làm gì khi client không gửi câu nào (state rỗng do remount)", () => {
    const plan = planDraftWrite({ sent: [], savedNonEmptyCount: 40 });

    expect(plan.skip).toBe(true);
    expect(plan.deleteQuestionIds).toEqual([]);
    expect(plan.createRows).toEqual([]);
  });

  it("KHÔNG xoá khi client báo trống hết mà DB đang có bài làm", () => {
    const plan = planDraftWrite({
      sent: [row("q1", ""), row("q2", "")],
      savedNonEmptyCount: 40
    });

    expect(plan.skip).toBe(true);
  });

  it("cho phép xoá khi DB cũng chưa có gì (bài mới, chưa làm câu nào)", () => {
    const plan = planDraftWrite({
      sent: [row("q1", "")],
      savedNonEmptyCount: 0
    });

    expect(plan.skip).toBe(false);
    expect(plan.deleteQuestionIds).toEqual(["q1"]);
    expect(plan.createRows).toEqual([]);
  });

  it("vẫn lưu bình thường khi có ít nhất một câu còn nội dung", () => {
    const plan = planDraftWrite({
      sent: [row("q1", ""), row("q2", "cold and cloudy")],
      savedNonEmptyCount: 40
    });

    expect(plan.skip).toBe(false);
    expect(plan.deleteQuestionIds).toEqual(["q1", "q2"]);
    expect(plan.createRows).toEqual([row("q2", "cold and cloudy")]);
  });
});

// Ba lỗi phát hiện từ log buổi kiểm tra 24/07/2026. Test cấu trúc để không ai vô
// tình đưa lại hành vi cũ.
describe("chống tái phát lỗi buổi kiểm tra 24/07/2026", () => {
  const attempts = readFileSync(join(process.cwd(), "lib/actions/attempts.ts"), "utf8");
  const workspace = readFileSync(
    join(process.cwd(), "components/attempt-workspace.tsx"),
    "utf8"
  );

  it("nhịp tự lưu không còn xoá đáp án của cả attempt", () => {
    // Trước đây: answer.deleteMany({ where: { attemptId, ...notIn lockedUnitIds } })
    // xoá SẠCH rồi chép lại. Giờ phải xoá theo danh sách câu client gửi.
    expect(attempts).toContain("questionId: { in: plan.deleteQuestionIds }");
    expect(attempts).toContain("planDraftWrite({ sent: sentRows, savedNonEmptyCount })");
    expect(attempts).toContain("formData.has(`q_${question.id}`)");
  });

  it("thoát im lặng khi attempt đã nộp thay vì ném lỗi 500", () => {
    // Đúng 2 chỗ: saveAttemptDraft và saveHighlight.
    expect(attempts.match(/attempt\.status !== "in_progress"/g)).toHaveLength(2);
  });

  it("giờ làm bài lấy max, không ghi đè bằng giá trị client gửi", () => {
    expect(attempts).toContain(
      'Math.max(parsed.data.elapsedSeconds, skillRow?.elapsedSeconds ?? 0)'
    );
    expect(workspace).toContain(
      "Math.max(consumedRef.current, activeSkillRow?.elapsedSeconds ?? 0)"
    );
  });

  it("không tự lưu khi form chưa hiện trên màn hình", () => {
    expect(workspace).toContain("const formOnScreen = mounted && !needsSoundCheck");
    expect(workspace).toContain("!activeSkill || !formOnScreen");
  });
});
