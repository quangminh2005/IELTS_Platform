import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PracticeGoalCard } from "@/components/practice-goal-card";
import type { PracticeGoalStatus } from "@/lib/practice-goal-data";
import type { WeekStatus } from "@/lib/practice-goal";

function week(over: Partial<WeekStatus> = {}): WeekStatus {
  return {
    weekKey: "2026-10-19",
    done: 0,
    goal: 1,
    met: false,
    ended: false,
    rejected: { too_short: 0, too_few_answers: 0 },
    ...over
  };
}

function status(current: WeekStatus, goal = current.goal): PracticeGoalStatus {
  return { goal, weeks: [current], current, percent: 100 };
}

// Vitest dự án không dịch JSX (tsconfig jsx: preserve) → dựng bằng createElement.
function render(value: PracticeGoalStatus): string {
  return renderToStaticMarkup(createElement(PracticeGoalCard, { status: value }));
}

describe("PracticeGoalCard", () => {
  it("chưa đạt: hiện tiến độ, thưởng/phạt và nút Luyện ngay", () => {
    const html = render(status(week({ done: 0, goal: 2 })));
    expect(html).toContain("0/2 phần");
    expect(html).toContain("Đạt +30 Xu · Không đạt −30 Xu");
    expect(html).toContain('href="/student/practice"');
  });

  it("đã đạt: báo +30 Xu, không còn nút", () => {
    const html = render(status(week({ done: 1, met: true })));
    expect(html).toContain("Đã đạt ✓ +30 Xu");
    expect(html).not.toContain("Luyện ngay");
  });

  it("nói rõ lượt bị loại và vì sao", () => {
    const html = render(status(week({ rejected: { too_short: 1, too_few_answers: 2 } })));
    expect(html).toContain("3 lượt chưa tính");
    expect(html).toContain("1 lượt làm dưới 3 phút");
    expect(html).toContain("2 lượt trả lời chưa tới một nửa");
  });

  it("được miễn (chỉ tiêu 0) thì không hiện thẻ", () => {
    expect(render(status(week({ goal: 0, met: true }), 0))).toBe("");
  });
});
