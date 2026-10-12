import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ParentPracticeGoal } from "@/components/parent-practice-goal";
import type { WeekStatus } from "@/lib/practice-goal";
import type { PracticeGoalStatus } from "@/lib/practice-goal-data";

function status(over: Partial<WeekStatus> = {}, goal = 2): PracticeGoalStatus {
  const current: WeekStatus = {
    weekKey: "2026-10-19",
    done: 1,
    goal,
    met: false,
    ended: false,
    rejected: { too_short: 0, too_few_answers: 0 },
    ...over
  };
  return { goal, weeks: [current], current, percent: 100 };
}

const render = (value: PracticeGoalStatus | null) =>
  renderToStaticMarkup(createElement(ParentPracticeGoal, { status: value }));

describe("báo cáo phụ huynh — Tự luyện ở nhà", () => {
  it("chưa đạt: tiến độ tuần + chỉ tiêu thầy giao, không nhắc Xu", () => {
    const html = render(status());
    expect(html).toContain("Tự luyện ở nhà");
    expect(html).toContain("Tuần này: 1/2 phần");
    expect(html).toContain("chưa đạt");
    expect(html).toContain("Thầy giao 2 phần/tuần");
    expect(html).not.toContain("Xu");
  });

  it("đã đạt", () => {
    expect(render(status({ done: 2, met: true }))).toContain("đã đạt");
  });

  it("được miễn hoặc lỗi dữ liệu thì ẩn khối", () => {
    expect(render(status({ met: true }, 0))).toBe("");
    expect(render(null)).toBe("");
  });
});
