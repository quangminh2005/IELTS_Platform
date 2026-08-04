import { beforeEach, describe, expect, it, vi } from "vitest";
import { rankClassmates, getClassRanking, type ClassmateRow } from "../lib/class-ranking";
import {
  countsForStats,
  excludePracticeAssignment,
  onlyPracticeAssignment,
  PRACTICE_MODE
} from "../lib/practice";

// Mock ở đúng specifier mà lib/class-ranking.ts dùng (@/lib/prisma) để chắc chắn
// Vite phân giải về cùng một module — theo đúng cách tests/auth.test.ts đã làm.
// vi.mock được Vitest hoist lên đầu file (trước mọi import) nên khi
// lib/class-ranking.ts được import tĩnh ở trên, nó đã thấy bản mock này.
const prismaMock = vi.hoisted(() => ({
  classStudent: { findMany: vi.fn() },
  $queryRaw: vi.fn()
}));

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

const now = new Date("2026-07-25T10:00:00+07:00");

function daysBefore(days: number, hour = 8) {
  const date = new Date(now);
  date.setDate(date.getDate() - days);
  date.setHours(hour, 0, 0, 0);
  return date;
}

// Một bài đã giao và đã nộp cùng ngày.
function doneRecipient(daysAgo: number) {
  return { assignedAt: daysBefore(daysAgo), submittedAt: daysBefore(daysAgo, 9), status: "submitted" };
}

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
        reviewedAt: null,
        skillCounts: []
      }
    ],
    recipients: [
      {
        assignedAt: new Date("2026-06-01T07:00:00+07:00"),
        submittedAt: new Date("2026-06-01T09:00:00+07:00"),
        status: "submitted"
      }
    ]
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
            reviewedAt: new Date("2026-06-02T09:00:00+07:00"),
            skillCounts: []
          }
        ],
        recipients: [
          {
            assignedAt: new Date("2026-06-01T07:00:00+07:00"),
            submittedAt: new Date("2026-06-01T09:00:00+07:00"),
            status: "reviewed"
          }
        ]
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
            reviewedAt: null,
            skillCounts: [{ skill: "reading", correct: 1, total: 1 }]
          },
          {
            // Bài Viết: không có câu tự chấm nên scorePercent = null, chưa chấm nên chưa có band.
            scorePercent: null,
            startedAt: new Date("2026-06-02T08:00:00+07:00"),
            submittedAt: new Date("2026-06-02T09:00:00+07:00"),
            overallBand: null,
            reviewedAt: null,
            skillCounts: []
          }
        ],
        recipients: [doneRecipient(54), doneRecipient(53)]
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
            reviewedAt: null,
            skillCounts: [{ skill: "reading", correct: 1, total: 1 }]
          },
          {
            scorePercent: null,
            startedAt: new Date("2026-06-02T08:00:00+07:00"),
            submittedAt: new Date("2026-06-02T09:00:00+07:00"),
            overallBand: 9,
            reviewedAt: new Date("2026-06-03T09:00:00+07:00"),
            skillCounts: []
          }
        ],
        recipients: [doneRecipient(54), doneRecipient(53)]
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
            startedAt: daysBefore(5),
            submittedAt: daysBefore(5, 9),
            overallBand: null,
            reviewedAt: null,
            skillCounts: []
          },
          {
            scorePercent: 50,
            startedAt: daysBefore(3),
            submittedAt: daysBefore(3, 9),
            overallBand: null,
            reviewedAt: null,
            skillCounts: []
          },
          {
            // đang làm dở
            scorePercent: null,
            startedAt: daysBefore(0),
            submittedAt: null,
            overallBand: null,
            reviewedAt: null,
            skillCounts: []
          }
        ],
        recipients: [
          doneRecipient(5),
          doneRecipient(3),
          { assignedAt: daysBefore(0), submittedAt: null, status: "in_progress" }
        ]
      }
    ];

    const ranked = rankClassmates(rows, now);

    expect(ranked[0].submittedCount).toBe(2);
    // Mở bài sáng nay -> mốc hoạt động gần nhất là hôm nay.
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
            startedAt: daysBefore(1),
            submittedAt: null,
            overallBand: null,
            reviewedAt: null,
            skillCounts: []
          }
        ],
        recipients: [{ assignedAt: daysBefore(2), submittedAt: null, status: "in_progress" }]
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
            reviewedAt: null,
            skillCounts: [{ skill: "reading", correct: 0, total: 1 }]
          }
        ],
        recipients: [
          doneRecipient(54),
          ...Array.from({ length: 19 }, () => ({
            assignedAt: daysBefore(54),
            submittedAt: null,
            status: "assigned"
          }))
        ]
      }
    ];

    const ranked = rankClassmates(rows, now);

    expect(ranked.map((student) => student.displayName)).toEqual(["Chăm", "Mới"]);
    expect(ranked[0].hasSubmitted).toBe(true);
    expect(ranked[1].hasSubmitted).toBe(false);
    expect(ranked[1].submittedCount).toBe(0);
  });
});

describe("rankClassmates - xu hướng so với tuần trước", () => {
  // An: 10 ngày trước được 60%, 2 ngày trước được 100% -> tuần trước kém Bình,
  // tuần này vượt lên. Bình chỉ có bài 10 ngày trước.
  const an: ClassmateRow = {
    id: "an",
    displayName: "An",
    avatarUrl: null,
    attempts: [
      {
        scorePercent: 60,
        startedAt: daysBefore(10),
        submittedAt: daysBefore(10, 9),
        overallBand: null,
        reviewedAt: null,
        skillCounts: []
      },
      {
        scorePercent: 100,
        startedAt: daysBefore(2),
        submittedAt: daysBefore(2, 9),
        overallBand: null,
        reviewedAt: null,
        skillCounts: []
      }
    ],
    recipients: [doneRecipient(10), doneRecipient(2)]
  };

  const binh: ClassmateRow = {
    id: "binh",
    displayName: "Bình",
    avatarUrl: null,
    attempts: [
      {
        scorePercent: 70,
        startedAt: daysBefore(10),
        submittedAt: daysBefore(10, 9),
        overallBand: null,
        reviewedAt: null,
        skillCounts: []
      }
    ],
    recipients: [doneRecipient(10)]
  };

  it("vượt lên thì rankChange dương, tụt xuống thì âm", () => {
    const ranked = rankClassmates([an, binh], now);

    expect(ranked.map((student) => student.displayName)).toEqual(["An", "Bình"]);
    expect(ranked[0].rankChange).toBe(1);
    expect(ranked[1].rankChange).toBe(-1);
  });

  it("tuần trước chưa có bài nào -> rankChange null (mới vào bảng)", () => {
    const moi: ClassmateRow = {
      id: "moi",
      displayName: "Mới",
      avatarUrl: null,
      attempts: [
        {
          scorePercent: 90,
          startedAt: daysBefore(1),
          submittedAt: daysBefore(1, 9),
          overallBand: null,
          reviewedAt: null,
          skillCounts: []
        }
      ],
      recipients: [doneRecipient(1)]
    };

    const ranked = rankClassmates([binh, moi], now);

    expect(ranked[0].displayName).toBe("Mới");
    expect(ranked[0].rankChange).toBeNull();
    // Bình tuần trước đứng nhất, giờ tụt xuống hạng 2.
    expect(ranked[1].rankChange).toBe(-1);
  });

  it("bài mới nộp trong tuần không được tính vào ảnh chụp tuần trước", () => {
    const ranked = rankClassmates([an, binh], now);
    const anPrevious = ranked.find((student) => student.id === "an")?.previousRankingScore;
    const binhPrevious = ranked.find((student) => student.id === "binh")?.previousRankingScore;

    // Tuần trước An mới chỉ có bài 60%, thấp hơn bài 70% của Bình. Nếu ảnh chụp
    // tuần trước tính nhầm cả bài 100% vừa nộp thì An sẽ cao hơn.
    expect(anPrevious).toBeLessThan(binhPrevious as number);
  });
});

describe("getClassRanking - hình dạng truy vấn Prisma với bài tự luyện", () => {
  // Không dọn mock thì test sau (nếu ai thêm vào describe này) sẽ làm
  // toHaveBeenCalledTimes(1) bên dưới sai vì lý do chẳng liên quan gì tới
  // quy tắc đang kiểm ở đây.
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("chỉ OR lượt-đầu-tự-luyện vào attempts, và loại bài tự luyện khỏi recipients", async () => {
    // Lớp rỗng -> skillCountsByAttempt ngắn mạch (attemptIds = []), không cần
    // mock $queryRaw. Ta chỉ cần xem prisma.classStudent.findMany được gọi với
    // where/include gì.
    prismaMock.classStudent.findMany.mockResolvedValueOnce([]);

    await getClassRanking("class-1");

    expect(prismaMock.classStudent.findMany).toHaveBeenCalledTimes(1);
    const call = prismaMock.classStudent.findMany.mock.calls[0][0];
    const attemptsWhere = call.include.student.include.attempts.where;
    const recipientsWhere = call.include.student.include.recipients.where;

    // Nhánh lượt-đầu-tự-luyện: đúng bài tự luyện (onlyPracticeAssignment) VÀ
    // đúng attemptRound = 1 (countsForStats). Sai một trong hai là mọi lượt
    // luyện lại lại tràn vào xếp hạng.
    expect(attemptsWhere.OR[1]).toEqual({
      assignmentRecipient: { assignment: onlyPracticeAssignment },
      ...countsForStats
    });

    // Nhánh bài giao của lớp KHÔNG được mang attemptRound — bài giao thật luôn
    // là lượt 1 nên không cần lọc, và lọc nhầm sẽ ẩn attempt hợp lệ.
    expect(attemptsWhere.OR[0]).not.toHaveProperty("attemptRound");
    expect(attemptsWhere.OR[0].assignmentRecipient.assignment).not.toHaveProperty("attemptRound");

    // Khẳng định dương trên trọn hình dạng OR[0]: phải mang đúng
    // excludePracticeAssignment, không chỉ "không có attemptRound". Bỏ mất
    // excludePracticeAssignment mà vẫn giữ recipients.where nguyên vẹn là kịch
    // bản hỏng nặng nhất — mọi lượt luyện lại tràn vào điểm trung bình và
    // "hoạt động gần đây".
    expect(attemptsWhere.OR[0]).toEqual({
      assignmentRecipient: {
        assignment: { OR: [{ classId: "class-1" }, { classId: null }], ...excludePracticeAssignment }
      }
    });

    // Đúng 2 nhánh — thêm một nhánh thứ ba không lọc gì vẫn phải bị bắt.
    expect(attemptsWhere.OR).toHaveLength(2);

    // Tỉ lệ hoàn thành (recipients) phải loại hẳn bài tự luyện, không đếm bất
    // kỳ lượt nào của nó — kể cả lượt đầu.
    expect(recipientsWhere.assignment.mode).toEqual({ not: PRACTICE_MODE });
  });
});
