import { describe, expect, it } from "vitest";
import { rankClassmates, type ClassmateRow } from "../lib/class-ranking";

const now = new Date("2026-07-25T10:00:00+07:00");

// Học viên chỉ có 1 lần làm bài cũ (ngoài 7 ngày) -> recentActivityPercent = 0,
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
});
