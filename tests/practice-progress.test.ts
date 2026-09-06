import { describe, expect, it } from "vitest";
import {
  buildPracticeStudentRows,
  groupPracticeAttempts,
  parsePracticeRange,
  parsePracticeSort,
  practiceRangeStart,
  practiceTotals,
  summarizePracticeByStudent,
  type PracticeAttemptDetail,
  type PracticeAttemptRow
} from "@/lib/practice-progress";
import { parsePracticeScopeKey } from "@/lib/practice";

const now = new Date("2026-09-06T10:00:00.000Z");

function daysBefore(days: number): Date {
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
}

function attempt(overrides: Partial<PracticeAttemptRow> = {}): PracticeAttemptRow {
  return {
    studentId: "hs1",
    practiceScopeKey: "hs1:de1:all",
    startedAt: daysBefore(1),
    submittedAt: daysBefore(1),
    elapsedSeconds: 600,
    scorePercent: 80,
    ...overrides
  };
}

describe("parsePracticeScopeKey", () => {
  it("tách khoá cả đề và khoá từng phần", () => {
    expect(parsePracticeScopeKey("hs1:de1:all")).toEqual({
      studentId: "hs1",
      materialId: "de1",
      unitId: null
    });
    expect(parsePracticeScopeKey("hs1:de1:unitA")).toEqual({
      studentId: "hs1",
      materialId: "de1",
      unitId: "unitA"
    });
  });

  it("trả về null với khoá trống hoặc thiếu phân đoạn", () => {
    expect(parsePracticeScopeKey(null)).toBeNull();
    expect(parsePracticeScopeKey("")).toBeNull();
    expect(parsePracticeScopeKey("hs1:de1")).toBeNull();
  });
});

describe("khoảng thống kê", () => {
  it("mặc định là 7 ngày, giá trị lạ cũng rơi về mặc định", () => {
    expect(parsePracticeRange(undefined)).toBe("7d");
    expect(parsePracticeRange("linh tinh")).toBe("7d");
    expect(parsePracticeRange("30d")).toBe("30d");
  });

  it("mốc bắt đầu lùi đúng số ngày, 'all' không giới hạn", () => {
    expect(practiceRangeStart("7d", now)).toEqual(daysBefore(7));
    expect(practiceRangeStart("30d", now)).toEqual(daysBefore(30));
    expect(practiceRangeStart("all", now)).toBeNull();
  });

  it("cách sắp xếp lạ rơi về 'cần nhắc'", () => {
    expect(parsePracticeSort(undefined)).toBe("attention");
    expect(parsePracticeSort("rounds")).toBe("rounds");
  });
});

describe("summarizePracticeByStudent", () => {
  it("đếm MỌI lượt, kể cả lượt luyện lại cùng một đề", () => {
    const summaries = summarizePracticeByStudent(
      [
        attempt({ practiceScopeKey: "hs1:de1:all" }),
        attempt({ practiceScopeKey: "hs1:de1:all" }),
        attempt({ practiceScopeKey: "hs1:de2:all" })
      ],
      now
    );

    expect(summaries.get("hs1")?.rounds).toBe(3);
  });

  it("luyện lẻ từng phần của cùng một đề vẫn tính là một đề", () => {
    const summaries = summarizePracticeByStudent(
      [
        attempt({ practiceScopeKey: "hs1:de1:unitA" }),
        attempt({ practiceScopeKey: "hs1:de1:unitB" }),
        attempt({ practiceScopeKey: "hs1:de1:all" })
      ],
      now
    );

    expect(summaries.get("hs1")?.materialCount).toBe(1);
  });

  it("điểm trung bình bỏ qua lượt chưa chấm (scorePercent null)", () => {
    const summaries = summarizePracticeByStudent(
      [
        attempt({ scorePercent: 90 }),
        attempt({ scorePercent: 70 }),
        attempt({ scorePercent: null })
      ],
      now
    );

    expect(summaries.get("hs1")?.averagePercent).toBe(80);
    expect(summaries.get("hs1")?.rounds).toBe(3);
  });

  it("cả bộ đều chưa chấm thì không có điểm trung bình, không phải 0", () => {
    const summaries = summarizePracticeByStudent([attempt({ scorePercent: null })], now);

    expect(summaries.get("hs1")?.averagePercent).toBeNull();
  });

  it("lấy mốc gần nhất và cộng dồn thời gian luyện", () => {
    const summaries = summarizePracticeByStudent(
      [
        attempt({ startedAt: daysBefore(5), submittedAt: daysBefore(5), elapsedSeconds: 300 }),
        attempt({ startedAt: daysBefore(2), submittedAt: daysBefore(2), elapsedSeconds: 900 })
      ],
      now
    );

    expect(summaries.get("hs1")?.daysSinceLastPractice).toBe(2);
    expect(summaries.get("hs1")?.totalSeconds).toBe(1200);
  });

  it("lượt cũ thiếu submittedAt vẫn tính theo lúc bắt đầu", () => {
    const summaries = summarizePracticeByStudent(
      [attempt({ startedAt: daysBefore(3), submittedAt: null })],
      now
    );

    expect(summaries.get("hs1")?.daysSinceLastPractice).toBe(3);
  });
});

describe("buildPracticeStudentRows", () => {
  const students = [
    { id: "hs1", displayName: "An" },
    { id: "hs2", displayName: "Bình" },
    { id: "hs3", displayName: "Cường" }
  ];

  const attempts = [
    attempt({ studentId: "hs1", startedAt: daysBefore(1), submittedAt: daysBefore(1), scorePercent: 60 }),
    attempt({ studentId: "hs1", startedAt: daysBefore(2), submittedAt: daysBefore(2), scorePercent: 60 }),
    attempt({ studentId: "hs2", startedAt: daysBefore(6), submittedAt: daysBefore(6), scorePercent: 95 })
  ];

  it("học viên chưa luyện lần nào vẫn có một dòng", () => {
    const rows = buildPracticeStudentRows(students, attempts, { sort: "name", now });

    expect(rows).toHaveLength(3);
    expect(rows[2]).toMatchObject({ id: "hs3", practice: { rounds: 0, daysSinceLastPractice: null } });
  });

  it("mặc định đẩy em cần nhắc lên đầu: chưa luyện trước, rồi lâu nhất", () => {
    const rows = buildPracticeStudentRows(students, attempts, { sort: "attention", now });

    expect(rows.map((row) => row.id)).toEqual(["hs3", "hs2", "hs1"]);
  });

  it("sắp theo số lượt và theo điểm trung bình", () => {
    expect(
      buildPracticeStudentRows(students, attempts, { sort: "rounds", now }).map((row) => row.id)
    ).toEqual(["hs1", "hs2", "hs3"]);

    // hs3 chưa có điểm nào -> xuống cuối, không bị coi là 0 điểm.
    expect(
      buildPracticeStudentRows(students, attempts, { sort: "score", now }).map((row) => row.id)
    ).toEqual(["hs2", "hs1", "hs3"]);
  });

  it("cộng số liệu toàn lớp", () => {
    const rows = buildPracticeStudentRows(students, attempts, { sort: "attention", now });

    expect(practiceTotals(rows)).toEqual({
      rounds: 3,
      activeStudents: 2,
      totalStudents: 3,
      totalSeconds: 1800
    });
  });
});

describe("groupPracticeAttempts", () => {
  function detail(overrides: Partial<PracticeAttemptDetail> = {}): PracticeAttemptDetail {
    return {
      id: "l1",
      assignmentId: "bo1",
      assignmentTitle: "Cambridge 20 — Test 1",
      attemptRound: 1,
      status: "submitted",
      startedAt: daysBefore(3),
      submittedAt: daysBefore(3),
      elapsedSeconds: 1800,
      score: 30,
      scorePercent: 75,
      ...overrides
    };
  }

  it("gộp theo bộ luyện, bộ mới nhất lên trên", () => {
    const groups = groupPracticeAttempts([
      detail({ id: "l1", assignmentId: "bo1", startedAt: daysBefore(9), submittedAt: daysBefore(9) }),
      detail({ id: "l2", assignmentId: "bo2", assignmentTitle: "Test 2", startedAt: daysBefore(1), submittedAt: daysBefore(1) })
    ]);

    expect(groups.map((group) => group.assignmentId)).toEqual(["bo2", "bo1"]);
  });

  it("đếm riêng lượt đã nộp và lượt đang làm dở", () => {
    const [group] = groupPracticeAttempts([
      detail({ id: "l1", status: "reviewed" }),
      detail({ id: "l2", status: "submitted" }),
      detail({ id: "l3", status: "in_progress", submittedAt: null, score: null, scorePercent: null })
    ]);

    expect(group.submittedCount).toBe(2);
    expect(group.inProgressCount).toBe(1);
  });

  it("lấy lượt điểm cao nhất và giữ đúng số câu đúng của lượt đó", () => {
    const [group] = groupPracticeAttempts([
      detail({ id: "l1", score: 30, scorePercent: 75 }),
      detail({ id: "l2", score: 36, scorePercent: 90 }),
      detail({ id: "l3", score: null, scorePercent: null, status: "submitted" })
    ]);

    expect(group.bestPercent).toBe(90);
    expect(group.bestScore).toBe(36);
  });

  it("các lượt trong một bộ xếp mới nhất trước", () => {
    const [group] = groupPracticeAttempts([
      detail({ id: "cu", startedAt: daysBefore(8), submittedAt: daysBefore(8) }),
      detail({ id: "moi", startedAt: daysBefore(2), submittedAt: daysBefore(2) })
    ]);

    expect(group.attempts.map((item) => item.id)).toEqual(["moi", "cu"]);
  });
});
