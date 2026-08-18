import { describe, expect, it } from "vitest";
import {
  buildParentSummary,
  pickStrengthsAndWeaknesses,
  periodRange,
  shouldSendReport,
  type ParentReportItem
} from "@/lib/parent-report";
import { buildParentReportEmail } from "@/lib/parent-report-email";

const NOW = new Date("2026-08-16T05:00:00.000Z");

function daysAgo(days: number): Date {
  return new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000);
}

function item(overrides: Partial<ParentReportItem> = {}): ParentReportItem {
  return {
    assignmentTitle: "Cam 20 Test 1 — Reading",
    skills: ["reading"],
    assignedAt: daysAgo(3),
    deadline: daysAgo(1),
    status: "submitted",
    submittedAt: daysAgo(2),
    scorePercent: 70,
    overallBand: null,
    reviewedAt: null,
    summaryFeedback: null,
    ...overrides
  };
}

describe("periodRange", () => {
  it("tuần lùi 7 ngày, tháng lùi 30 ngày", () => {
    expect(periodRange(NOW, "week").from).toEqual(daysAgo(7));
    expect(periodRange(NOW, "month").from).toEqual(daysAgo(30));
  });
});

describe("buildParentSummary", () => {
  it("đếm bài đã nộp trong kỳ và tính trung bình %", () => {
    const summary = buildParentSummary(
      [item({ scorePercent: 60 }), item({ scorePercent: 80 })],
      NOW,
      "week"
    );

    expect(summary.submittedCount).toBe(2);
    expect(summary.averagePercent).toBe(70);
  });

  it("bài Viết chưa chấm KHÔNG bị tính thành 0", () => {
    const summary = buildParentSummary(
      [
        item({ scorePercent: 80 }),
        item({ skills: ["writing"], scorePercent: null, overallBand: null })
      ],
      NOW,
      "week"
    );

    expect(summary.averagePercent).toBe(80);
  });

  it("bài Viết đã chấm quy band về thang 100", () => {
    const summary = buildParentSummary(
      [item({ skills: ["writing"], scorePercent: null, overallBand: 6.3 })],
      NOW,
      "week"
    );

    expect(summary.averageBand).toBe(6.3);
    expect(summary.averagePercent).toBeCloseTo(70, 0);
  });

  it("bài nộp ngoài kỳ không được tính", () => {
    const summary = buildParentSummary([item({ submittedAt: daysAgo(20) })], NOW, "week");

    expect(summary.submittedCount).toBe(0);
  });

  it("đếm bài quá hạn chưa làm", () => {
    const summary = buildParentSummary(
      [item({ status: "assigned", submittedAt: null, deadline: daysAgo(1) })],
      NOW,
      "week"
    );

    expect(summary.lateOrMissingCount).toBe(1);
    expect(summary.pending).toHaveLength(1);
  });

  it("bài chưa tới hạn không tính là nợ", () => {
    const summary = buildParentSummary(
      [
        item({
          status: "assigned",
          submittedAt: null,
          deadline: new Date(NOW.getTime() + 86_400_000)
        })
      ],
      NOW,
      "week"
    );

    expect(summary.lateOrMissingCount).toBe(0);
  });

  it("xu hướng tăng khi kỳ này khá hơn kỳ trước", () => {
    const summary = buildParentSummary(
      [
        item({ submittedAt: daysAgo(2), scorePercent: 80 }),
        item({ submittedAt: daysAgo(10), scorePercent: 60 })
      ],
      NOW,
      "week"
    );

    expect(summary.trend).toBe("up");
  });

  it("thiếu dữ liệu kỳ trước thì xu hướng là unknown", () => {
    const summary = buildParentSummary([item({ scorePercent: 80 })], NOW, "week");

    expect(summary.trend).toBe("unknown");
  });

  it("gom nhận xét của cô trong kỳ", () => {
    const summary = buildParentSummary(
      [
        item({
          skills: ["writing"],
          scorePercent: null,
          overallBand: 6,
          status: "reviewed",
          reviewedAt: daysAgo(1),
          summaryFeedback: "Bố cục tốt, cần thêm ví dụ."
        })
      ],
      NOW,
      "week"
    );

    expect(summary.comments).toHaveLength(1);
    expect(summary.comments[0].feedback).toBe("Bố cục tốt, cần thêm ví dụ.");
  });

  it("headline nói rõ chưa hoàn thành bài nào", () => {
    const summary = buildParentSummary([], NOW, "week");

    expect(summary.headline).toContain("chưa hoàn thành bài nào");
  });
});

describe("shouldSendReport", () => {
  it("không gửi khi kỳ đó trống trơn", () => {
    expect(shouldSendReport(buildParentSummary([], NOW, "week"))).toBe(false);
  });

  it("gửi khi có bài đã nộp", () => {
    expect(shouldSendReport(buildParentSummary([item()], NOW, "week"))).toBe(true);
  });

  it("gửi khi con đang nợ bài dù không nộp gì", () => {
    const summary = buildParentSummary(
      [item({ status: "assigned", submittedAt: null, deadline: daysAgo(1) })],
      NOW,
      "week"
    );

    expect(shouldSendReport(summary)).toBe(true);
  });
});

describe("pickStrengthsAndWeaknesses", () => {
  it("lấy 2 nhóm tốt nhất và 2 nhóm kém nhất, không trùng nhau", () => {
    const stats = [
      { key: "mc", label: "Trắc nghiệm", correct: 18, total: 20, percent: 90 },
      { key: "tfng", label: "True/False", correct: 12, total: 20, percent: 60 },
      { key: "matching", label: "Nối", correct: 8, total: 20, percent: 40 },
      { key: "gapfill", label: "Điền từ", correct: 16, total: 20, percent: 80 }
    ] as unknown as Parameters<typeof pickStrengthsAndWeaknesses>[0];

    const result = pickStrengthsAndWeaknesses(stats);

    expect(result.strengths.map((s) => s.percent)).toEqual([90, 80]);
    expect(result.weaknesses.map((s) => s.percent)).toEqual([40, 60]);
  });

  it("nhóm làm kém không được gọi là điểm mạnh dù là nhóm duy nhất", () => {
    const stats = [
      { key: "gapfill", label: "Điền từ", correct: 0, total: 12, percent: 0 }
    ] as unknown as Parameters<typeof pickStrengthsAndWeaknesses>[0];

    const result = pickStrengthsAndWeaknesses(stats);

    expect(result.strengths).toHaveLength(0);
    expect(result.weaknesses.map((s) => s.percent)).toEqual([0]);
  });

  it("bỏ qua nhóm quá ít câu", () => {
    const stats = [
      { key: "mc", label: "Trắc nghiệm", correct: 2, total: 3, percent: 67 }
    ] as unknown as Parameters<typeof pickStrengthsAndWeaknesses>[0];

    const result = pickStrengthsAndWeaknesses(stats);

    expect(result.strengths).toHaveLength(0);
    expect(result.weaknesses).toHaveLength(0);
  });
});

describe("buildParentReportEmail", () => {
  const summary = buildParentSummary(
    [
      item({ assignmentTitle: "Cam 20 Test 1 — Reading", scorePercent: 75 }),
      item({
        assignmentTitle: "Writing Task 2 tuần 3",
        skills: ["writing"],
        scorePercent: null,
        overallBand: 6,
        status: "reviewed",
        reviewedAt: daysAgo(1),
        summaryFeedback: "Ý tốt, cần chú ý ngữ pháp thì."
      })
    ],
    NOW,
    "week"
  );

  const mail = buildParentReportEmail({
    studentName: "Minh Anh",
    parentName: "chị Lan",
    summary,
    link: "https://example.com/ph/abc123"
  });

  it("tiêu đề nhắc tên học sinh", () => {
    expect(mail.subject).toContain("Minh Anh");
  });

  it("bản chữ thuần có link xem chi tiết", () => {
    expect(mail.text).toContain("https://example.com/ph/abc123");
  });

  it("bản HTML có nút xem chi tiết", () => {
    expect(mail.html).toContain("https://example.com/ph/abc123");
    expect(mail.html).toContain("Xem chi tiết");
  });

  it("liệt kê bài đã làm kèm điểm", () => {
    expect(mail.text).toContain("Cam 20 Test 1 — Reading");
    expect(mail.text).toContain("75%");
  });

  it("có nhận xét của cô", () => {
    expect(mail.text).toContain("Ý tốt, cần chú ý ngữ pháp thì.");
  });

  it("xưng hô theo tên phụ huynh", () => {
    expect(mail.text).toContain("chị Lan");
  });

  it("không có tên phụ huynh thì dùng câu chào chung", () => {
    const anonymous = buildParentReportEmail({
      studentName: "Minh Anh",
      parentName: null,
      summary,
      link: "https://example.com/ph/abc123"
    });

    expect(anonymous.text).toContain("Kính gửi phụ huynh");
  });

  it("escape ký tự HTML trong tên bài", () => {
    const risky = buildParentReportEmail({
      studentName: "Minh Anh",
      parentName: null,
      summary: buildParentSummary(
        [item({ assignmentTitle: "Bài <b>1</b> & 2", scorePercent: 50 })],
        NOW,
        "week"
      ),
      link: "https://example.com/ph/abc123"
    });

    expect(risky.html).toContain("&lt;b&gt;");
    expect(risky.html).toContain("&amp;");
  });
});
