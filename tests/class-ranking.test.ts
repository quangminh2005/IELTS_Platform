import { describe, expect, it } from "vitest";
import { rankClassmates, type ClassmateRow } from "../lib/class-ranking";

const now = new Date("2026-07-25T10:00:00+07:00");

// Học viên chỉ có 1 lần làm bài cũ (ngoài 14 ngày) -> recentActivityPercent = 0,
// completionRate = 100, nên rankingScore = scorePercent * 0.7 + 20.
function classmate(id: string, displayName: string, scorePercent: number): ClassmateRow {
  return {
    id,
    displayName,
    avatarUrl: null,
    attempts: [
      {
        scorePercent,
        startedAt: new Date("2026-06-01T08:00:00+07:00"),
        submittedAt: new Date("2026-06-01T09:00:00+07:00"),
        overallBand: null,
        answers: []
      }
    ],
    statuses: ["submitted"]
  };
}

describe("rankClassmates", () => {
  it("sắp xếp giảm dần theo điểm xếp hạng", () => {
    const ranked = rankClassmates(
      [classmate("a", "An", 50), classmate("b", "Bảo", 90), classmate("c", "Cường", 70)],
      now
    );

    expect(ranked.map((student) => student.displayName)).toEqual(["Bảo", "Cường", "An"]);
    // 90*0.7 + 100*0.2 + 0*0.1 = 63 + 20 = 83
    expect(ranked[0].rankingScore).toBe(83);
    expect(ranked[0].completionRate).toBe(100);
    expect(ranked[0].recentActivityPercent).toBe(0);
  });

  it("hoà điểm thì xếp theo tên", () => {
    const ranked = rankClassmates([classmate("y", "Yến", 80), classmate("a", "An", 80)], now);

    expect(ranked.map((student) => student.displayName)).toEqual(["An", "Yến"]);
  });

  it("không đủ điều kiện quy đổi band -> averageBandValue null, vẫn giữ %", () => {
    const ranked = rankClassmates([classmate("a", "An", 60)], now);

    expect(ranked[0].averageBandValue).toBeNull();
    expect(ranked[0].averageScorePercent).toBe(60);
  });

  it("dùng band giáo viên chấm khi có", () => {
    const rows: ClassmateRow[] = [
      {
        id: "a",
        displayName: "An",
        avatarUrl: null,
        attempts: [
          {
            scorePercent: null,
            startedAt: new Date("2026-06-01T08:00:00+07:00"),
            submittedAt: new Date("2026-06-01T09:00:00+07:00"),
            overallBand: 6.5,
            answers: []
          }
        ],
        statuses: ["reviewed"]
      }
    ];

    expect(rankClassmates(rows, now)[0].averageBandValue).toBe(6.5);
  });

  it("lớp rỗng -> mảng rỗng", () => {
    expect(rankClassmates([], now)).toEqual([]);
  });

  it("bài Viết/Nói chưa chấm không bị tính 0% vào điểm trung bình", () => {
    const rows: ClassmateRow[] = [
      {
        id: "a",
        displayName: "An",
        avatarUrl: null,
        attempts: [
          {
            scorePercent: 80,
            startedAt: new Date("2026-06-01T08:00:00+07:00"),
            submittedAt: new Date("2026-06-01T09:00:00+07:00"),
            overallBand: null,
            answers: [{ isCorrect: true, skill: "reading" }]
          },
          {
            // Bài Viết: không có câu tự chấm nên scorePercent = null, chưa chấm nên chưa có band.
            scorePercent: null,
            startedAt: new Date("2026-06-02T08:00:00+07:00"),
            submittedAt: new Date("2026-06-02T09:00:00+07:00"),
            overallBand: null,
            answers: [{ isCorrect: null, skill: "writing" }]
          }
        ],
        statuses: ["submitted", "submitted"]
      }
    ];

    expect(rankClassmates(rows, now)[0].averageScorePercent).toBe(80);
  });

  it("bài Viết/Nói đã chấm được quy band sang % và tính vào điểm trung bình", () => {
    const rows: ClassmateRow[] = [
      {
        id: "a",
        displayName: "An",
        avatarUrl: null,
        attempts: [
          {
            scorePercent: 60,
            startedAt: new Date("2026-06-01T08:00:00+07:00"),
            submittedAt: new Date("2026-06-01T09:00:00+07:00"),
            overallBand: null,
            answers: [{ isCorrect: true, skill: "reading" }]
          },
          {
            scorePercent: null,
            startedAt: new Date("2026-06-02T08:00:00+07:00"),
            submittedAt: new Date("2026-06-02T09:00:00+07:00"),
            overallBand: 9,
            answers: [{ isCorrect: null, skill: "writing" }]
          }
        ],
        statuses: ["reviewed", "reviewed"]
      }
    ];

    // (60 + 100) / 2 = 80
    expect(rankClassmates(rows, now)[0].averageScorePercent).toBe(80);
  });

  it("đếm số bài ĐÃ NỘP, không tính bài đang làm dở", () => {
    const rows: ClassmateRow[] = [
      {
        id: "a",
        displayName: "An",
        avatarUrl: null,
        attempts: [
          {
            scorePercent: 70,
            startedAt: new Date("2026-07-20T08:00:00+07:00"),
            submittedAt: new Date("2026-07-20T09:00:00+07:00"),
            overallBand: null,
            answers: []
          },
          {
            scorePercent: 50,
            startedAt: new Date("2026-07-22T08:00:00+07:00"),
            submittedAt: new Date("2026-07-22T09:00:00+07:00"),
            overallBand: null,
            answers: []
          },
          {
            // đang làm dở
            scorePercent: null,
            startedAt: new Date("2026-07-25T08:00:00+07:00"),
            submittedAt: null,
            overallBand: null,
            answers: []
          }
        ],
        statuses: ["submitted", "submitted", "in_progress"]
      }
    ];

    const ranked = rankClassmates(rows, now);

    expect(ranked[0].submittedCount).toBe(2);
    // Mở bài lúc 25/07 -> mốc hoạt động gần nhất là hôm nay.
    expect(ranked[0].daysSinceLastActivity).toBe(0);
  });

  it("học viên chưa nộp bài nào luôn xếp cuối và được đánh dấu chưa có dữ liệu", () => {
    const rows: ClassmateRow[] = [
      {
        // Mới vào lớp: có mở bài hôm qua (hoạt động gần đây = 100 -> 10 điểm) nhưng chưa nộp.
        id: "moi",
        displayName: "Mới",
        avatarUrl: null,
        attempts: [
          {
            scorePercent: null,
            startedAt: new Date("2026-07-24T08:00:00+07:00"),
            submittedAt: null,
            overallBand: null,
            answers: []
          }
        ],
        statuses: ["in_progress"]
      },
      {
        // Đã nộp 1/20 bài, điểm 0 -> chỉ 1 điểm xếp hạng, vẫn phải đứng trên "Mới".
        id: "cham",
        displayName: "Chăm",
        avatarUrl: null,
        attempts: [
          {
            scorePercent: 0,
            startedAt: new Date("2026-06-01T08:00:00+07:00"),
            submittedAt: new Date("2026-06-01T09:00:00+07:00"),
            overallBand: null,
            answers: [{ isCorrect: false, skill: "reading" }]
          }
        ],
        statuses: ["submitted", ...Array.from({ length: 19 }, () => "assigned")]
      }
    ];

    const ranked = rankClassmates(rows, now);

    expect(ranked.map((student) => student.displayName)).toEqual(["Chăm", "Mới"]);
    expect(ranked[0].hasSubmitted).toBe(true);
    expect(ranked[1].hasSubmitted).toBe(false);
    expect(ranked[1].submittedCount).toBe(0);
  });
});
