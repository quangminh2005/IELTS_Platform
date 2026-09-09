import { describe, expect, it } from "vitest";
import { daysAgoLabel, rankingScorePercent, studentRankingScore } from "../lib/student-score";

describe("daysAgoLabel", () => {
  it("nhãn tiếng Việt cho số ngày", () => {
    expect(daysAgoLabel(0)).toBe("Hôm nay");
    expect(daysAgoLabel(1)).toBe("Hôm qua");
    expect(daysAgoLabel(12)).toBe("12 ngày trước");
  });

  it("chưa từng làm bài -> gạch ngang", () => {
    expect(daysAgoLabel(null)).toBe("—");
  });
});

describe("rankingScorePercent", () => {
  it("bài có câu tự chấm -> dùng đúng % chấm tự động", () => {
    expect(rankingScorePercent({ scorePercent: 75, overallBand: null })).toBe(75);
  });

  it("bài Viết/Nói đã chấm -> quy band sang thang 100 (band 9 = 100%)", () => {
    expect(rankingScorePercent({ scorePercent: null, overallBand: 9 })).toBe(100);
    expect(rankingScorePercent({ scorePercent: null, overallBand: 6.5 })).toBeCloseTo(72.2, 1);
  });

  it("bài Viết/Nói chưa chấm -> null để không kéo tụt điểm trung bình", () => {
    expect(rankingScorePercent({ scorePercent: null, overallBand: null })).toBeNull();
  });

  it("bài Nghe/Đọc có band giáo viên chấm vẫn ưu tiên % tự chấm (không tính hai lần)", () => {
    expect(rankingScorePercent({ scorePercent: 60, overallBand: 8 })).toBe(60);
  });
});

describe("studentRankingScore - độ mới của hoạt động", () => {
  const now = new Date("2026-07-20T10:00:00+07:00");

  function scoreAfterDays(days: number) {
    const startedAt = new Date(now);
    startedAt.setDate(startedAt.getDate() - days);
    return studentRankingScore({
      scorePercents: [50],
      completions: [{ status: "submitted", submittedAt: null, deadline: null }],
      attemptTimes: [{ startedAt, submittedAt: startedAt }],
      now
    });
  }

  it("làm bài trong 3 ngày gần nhất -> vẫn tính là 100", () => {
    expect(scoreAfterDays(0).recentActivityPercent).toBe(100);
    expect(scoreAfterDays(3).recentActivityPercent).toBe(100);
  });

  it("nghỉ lâu hơn thì giảm dần chứ không rơi thẳng về 0", () => {
    // Ngày thứ 8: (14 - 8) / (14 - 3) = 54,5% -> 55
    expect(scoreAfterDays(8).recentActivityPercent).toBe(55);
    expect(scoreAfterDays(5).recentActivityPercent).toBeGreaterThan(
      scoreAfterDays(9).recentActivityPercent
    );
  });

  it("quá 14 ngày -> 0", () => {
    expect(scoreAfterDays(14).recentActivityPercent).toBe(0);
    expect(scoreAfterDays(30).recentActivityPercent).toBe(0);
  });

  it("trả về số ngày kể từ lần làm bài gần nhất", () => {
    expect(scoreAfterDays(5).daysSinceLastActivity).toBe(5);
    expect(
      studentRankingScore({ scorePercents: [], completions: [], attemptTimes: [], now })
        .daysSinceLastActivity
    ).toBeNull();
  });

  it("lấy mốc nộp bài khi bài mở từ lâu nhưng mới nộp", () => {
    const s = studentRankingScore({
      scorePercents: [50],
      completions: [{ status: "submitted", submittedAt: null, deadline: null }],
      attemptTimes: [
        {
          startedAt: new Date("2026-06-01T08:00:00+07:00"),
          submittedAt: new Date("2026-07-19T08:00:00+07:00")
        }
      ],
      now
    });

    expect(s.daysSinceLastActivity).toBe(1);
    expect(s.recentActivityPercent).toBe(100);
  });
});

describe("studentRankingScore", () => {
  const now = new Date("2026-07-08T10:00:00+07:00");

  it("gộp điểm TB + hoàn thành + hoạt động gần đây (0.7/0.2/0.1)", () => {
    const s = studentRankingScore({
      scorePercents: [80, 100], // TB = 90
      completions: [
        { status: "submitted", submittedAt: null, deadline: null },
        { status: "reviewed", submittedAt: null, deadline: null },
        { status: "assigned", submittedAt: null, deadline: null },
        { status: "assigned", submittedAt: null, deadline: null }
      ], // 2/4 = 50%
      attemptTimes: [{ startedAt: new Date("2026-07-07T08:00:00+07:00"), submittedAt: null }], // gần đây -> 100
      now,
    });
    expect(s.averageScorePercent).toBe(90);
    expect(s.completionRate).toBe(50);
    expect(s.recentActivityPercent).toBe(100);
    // 90*0.7 + 50*0.2 + 100*0.1 = 63 + 10 + 10 = 83
    expect(s.rankingScore).toBe(83);
  });

  it("không có dữ liệu → tất cả 0", () => {
    const s = studentRankingScore({ scorePercents: [], completions: [], attemptTimes: [], now });
    expect(s.averageScorePercent).toBe(0);
    expect(s.completionRate).toBe(0);
    expect(s.recentActivityPercent).toBe(0);
    expect(s.rankingScore).toBe(0);
  });

  it("bài nộp trễ chỉ được nửa suất trong tỉ lệ hoàn thành", () => {
    const deadline = new Date("2026-07-05T23:59:00+07:00");
    const s = studentRankingScore({
      scorePercents: [80],
      completions: [
        // Nộp trước hạn -> 1 suất.
        {
          status: "submitted",
          submittedAt: new Date("2026-07-05T20:00:00+07:00"),
          deadline
        },
        // Nộp sau hạn -> 0,5 suất.
        {
          status: "submitted",
          submittedAt: new Date("2026-07-06T08:00:00+07:00"),
          deadline
        }
      ],
      attemptTimes: [{ startedAt: new Date("2026-07-07T08:00:00+07:00"), submittedAt: null }],
      now
    });

    // (1 + 0,5) / 2 = 75%
    expect(s.completionRate).toBe(75);
  });

  it("bài không đặt hạn nộp thì nộp lúc nào cũng trọn suất", () => {
    const s = studentRankingScore({
      scorePercents: [80],
      completions: [
        {
          status: "submitted",
          submittedAt: new Date("2026-07-06T08:00:00+07:00"),
          deadline: null
        }
      ],
      attemptTimes: [{ startedAt: new Date("2026-07-07T08:00:00+07:00"), submittedAt: null }],
      now
    });

    expect(s.completionRate).toBe(100);
  });

  it("hoạt động quá 14 ngày → recentActivityPercent 0", () => {
    const s = studentRankingScore({
      scorePercents: [100],
      completions: [{ status: "submitted", submittedAt: null, deadline: null }],
      attemptTimes: [{ startedAt: new Date("2026-06-01T08:00:00+07:00"), submittedAt: new Date("2026-06-01T09:00:00+07:00") }],
      now,
    });
    expect(s.recentActivityPercent).toBe(0);
  });
});
