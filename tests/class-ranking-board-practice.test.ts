import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ClassRankingBoard } from "@/components/class-ranking-board";
import type { RankedClassStudent } from "@/lib/class-ranking";

function student(id: string, over: Partial<RankedClassStudent> = {}): RankedClassStudent {
  return {
    id,
    displayName: `HS ${id}`,
    avatarUrl: null,
    avatarPreset: null,
    userImage: null,
    averageScorePercent: 80,
    averageBandValue: null,
    completionRate: 100,
    recentActivityPercent: 100,
    practiceGoal: 1,
    practiceGoalPercent: 100,
    practiceWeeksMet: 0,
    practiceWeeksConsidered: 0,
    practiceMetThisWeek: false,
    rankingScore: 80,
    hasSubmitted: true,
    submittedCount: 1,
    lateCount: 0,
    daysSinceLastActivity: 1,
    rankChange: null,
    previousRankingScore: null,
    ...over
  };
}

function render(students: RankedClassStudent[]): string {
  return renderToStaticMarkup(createElement(ClassRankingBoard, { students }));
}

describe("bảng xếp hạng — chỉ tiêu tự luyện", () => {
  it("em đạt chỉ tiêu tuần này có huy hiệu 🎯", () => {
    const html = render([student("a", { practiceMetThisWeek: true }), student("b")]);
    expect(html.match(/🎯/g)?.length).toBe(1);
  });

  it("giải thích Tự luyện a/b tuần cho cả bục và danh sách", () => {
    const four = ["a", "b", "c", "d"].map((id) => student(id, { practiceWeeksMet: 2, practiceWeeksConsidered: 3 }));
    const html = render(four);
    // 3 em trên bục + em thứ 4 ở danh sách (dòng điện thoại + cột máy tính)
    expect(html.match(/Tự luyện 2\/3 tuần/g)?.length).toBeGreaterThanOrEqual(4);
  });

  it("em được miễn chỉ tiêu không có dòng Tự luyện", () => {
    const html = render([student("a", { practiceGoal: 0, practiceWeeksMet: 1, practiceWeeksConsidered: 1 })]);
    expect(html).not.toContain("Tự luyện 1/1 tuần");
  });
});
