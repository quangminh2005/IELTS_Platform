import { parsePracticeScopeKey } from "@/lib/practice";

// Số liệu "chăm chỉ tự luyện" mà GIÁO VIÊN nhìn thấy: gộp các lượt tự luyện thành
// một dòng cho mỗi học viên (trang /teacher/practice) và thành từng bộ luyện (khối
// trong trang chi tiết học viên). Tách khỏi UI để test được.
//
// Khác biệt quan trọng so với thống kê NĂNG LỰC (lib/question-stats.ts, dùng
// countsForStats = lượt 1): ở đây đếm MỌI lượt, kể cả lượt luyện lại thứ 2, 3 —
// vì đây là đo mức độ chăm chỉ, không phải đo trình độ. Luyện lại một đề ba lần là
// ba lần ngồi vào bàn học.

const MILLISECONDS_PER_DAY = 1000 * 60 * 60 * 24;

export const PRACTICE_RANGES = ["7d", "30d", "all"] as const;
export type PracticeRange = (typeof PRACTICE_RANGES)[number];

export const DEFAULT_PRACTICE_RANGE: PracticeRange = "7d";

export const PRACTICE_RANGE_LABELS: Record<PracticeRange, string> = {
  "7d": "7 ngày gần nhất",
  "30d": "30 ngày gần nhất",
  all: "Tất cả"
};

// Giá trị lạ trên URL rơi về mặc định thay vì lỗi trang.
export function parsePracticeRange(value: string | undefined | null): PracticeRange {
  return PRACTICE_RANGES.find((range) => range === value) ?? DEFAULT_PRACTICE_RANGE;
}

// Mốc bắt đầu của khoảng thống kê. null = không giới hạn (xem tất cả).
export function practiceRangeStart(range: PracticeRange, now: Date): Date | null {
  if (range === "all") {
    return null;
  }

  const days = range === "7d" ? 7 : 30;

  return new Date(now.getTime() - days * MILLISECONDS_PER_DAY);
}

export const PRACTICE_SORTS = ["attention", "rounds", "score", "name"] as const;
export type PracticeSort = (typeof PRACTICE_SORTS)[number];

export const DEFAULT_PRACTICE_SORT: PracticeSort = "attention";

export function parsePracticeSort(value: string | undefined | null): PracticeSort {
  return PRACTICE_SORTS.find((sort) => sort === value) ?? DEFAULT_PRACTICE_SORT;
}

// Một lượt tự luyện ĐÃ NỘP, rút gọn còn đúng các trường cần để gộp số liệu lớp.
export type PracticeAttemptRow = {
  studentId: string;
  practiceScopeKey: string | null;
  startedAt: Date;
  submittedAt: Date | null;
  elapsedSeconds: number;
  // null với bài Viết/Nói chưa chấm — không kéo điểm trung bình xuống.
  scorePercent: number | null;
};

export type PracticeStudentSummary = {
  rounds: number;
  // Số ĐỀ khác nhau đã luyện (luyện lẻ từng phần của cùng một đề vẫn tính là 1 đề).
  materialCount: number;
  totalSeconds: number;
  averagePercent: number | null;
  // null = trong khoảng thống kê chưa luyện lần nào.
  daysSinceLastPractice: number | null;
};

const EMPTY_SUMMARY: PracticeStudentSummary = {
  rounds: 0,
  materialCount: 0,
  totalSeconds: 0,
  averagePercent: null,
  daysSinceLastPractice: null
};

// Mốc thời gian của một lượt: ưu tiên lúc nộp, lượt cũ thiếu submittedAt thì lấy
// lúc bắt đầu để không bị rơi khỏi cột "gần nhất".
function attemptTime(attempt: { startedAt: Date; submittedAt: Date | null }): Date {
  return attempt.submittedAt ?? attempt.startedAt;
}

export function summarizePracticeByStudent(
  attempts: PracticeAttemptRow[],
  now: Date
): Map<string, PracticeStudentSummary> {
  type Accumulator = {
    rounds: number;
    materialIds: Set<string>;
    totalSeconds: number;
    percentTotal: number;
    percentCount: number;
    lastAt: number | null;
  };

  const accumulators = new Map<string, Accumulator>();

  for (const attempt of attempts) {
    const accumulator = accumulators.get(attempt.studentId) ?? {
      rounds: 0,
      materialIds: new Set<string>(),
      totalSeconds: 0,
      percentTotal: 0,
      percentCount: 0,
      lastAt: null
    };

    accumulator.rounds += 1;
    accumulator.totalSeconds += Math.max(0, attempt.elapsedSeconds);

    const scope = parsePracticeScopeKey(attempt.practiceScopeKey);
    if (scope !== null) {
      accumulator.materialIds.add(scope.materialId);
    }

    if (attempt.scorePercent !== null) {
      accumulator.percentTotal += attempt.scorePercent;
      accumulator.percentCount += 1;
    }

    const time = attemptTime(attempt).getTime();
    accumulator.lastAt = accumulator.lastAt === null ? time : Math.max(accumulator.lastAt, time);

    accumulators.set(attempt.studentId, accumulator);
  }

  const summaries = new Map<string, PracticeStudentSummary>();

  for (const [studentId, accumulator] of accumulators) {
    summaries.set(studentId, {
      rounds: accumulator.rounds,
      materialCount: accumulator.materialIds.size,
      totalSeconds: accumulator.totalSeconds,
      averagePercent:
        accumulator.percentCount > 0 ? accumulator.percentTotal / accumulator.percentCount : null,
      daysSinceLastPractice:
        accumulator.lastAt === null
          ? null
          : Math.max(0, Math.floor((now.getTime() - accumulator.lastAt) / MILLISECONDS_PER_DAY))
    });
  }

  return summaries;
}

export type PracticeStudentIdentity = { id: string; displayName: string };

export type PracticeStudentRow<T extends PracticeStudentIdentity> = T & {
  practice: PracticeStudentSummary;
};

function byName(a: PracticeStudentIdentity, b: PracticeStudentIdentity): number {
  return a.displayName.localeCompare(b.displayName, "vi");
}

// Thứ tự các cách sắp xếp. "attention" (mặc định) đẩy em CẦN NHẮC lên đầu: chưa
// luyện lần nào trước, rồi đến em lâu chưa luyện nhất — đúng việc giáo viên mở
// trang này ra để làm.
function comparatorFor<T extends PracticeStudentIdentity>(
  sort: PracticeSort
): (a: PracticeStudentRow<T>, b: PracticeStudentRow<T>) => number {
  if (sort === "rounds") {
    return (a, b) => b.practice.rounds - a.practice.rounds || byName(a, b);
  }

  if (sort === "score") {
    // Chưa có điểm nào thì xuống cuối — không có gì để so, không phải điểm 0.
    return (a, b) => {
      const left = a.practice.averagePercent;
      const right = b.practice.averagePercent;

      if (left === null && right === null) return byName(a, b);
      if (left === null) return 1;
      if (right === null) return -1;

      return right - left || byName(a, b);
    };
  }

  if (sort === "name") {
    return byName;
  }

  return (a, b) => {
    const left = a.practice.daysSinceLastPractice;
    const right = b.practice.daysSinceLastPractice;

    if (left === null && right === null) return byName(a, b);
    if (left === null) return -1;
    if (right === null) return 1;

    return right - left || byName(a, b);
  };
}

// Ghép danh sách học viên với số liệu đã gộp: học viên KHÔNG luyện lần nào vẫn phải
// có một dòng (đó mới là dòng giáo viên cần thấy), nên duyệt theo students chứ
// không theo attempts.
export function buildPracticeStudentRows<T extends PracticeStudentIdentity>(
  students: T[],
  attempts: PracticeAttemptRow[],
  options: { sort: PracticeSort; now: Date }
): PracticeStudentRow<T>[] {
  const summaries = summarizePracticeByStudent(attempts, options.now);

  const rows = students.map((student) => ({
    ...student,
    practice: summaries.get(student.id) ?? EMPTY_SUMMARY
  }));

  return rows.sort(comparatorFor<T>(options.sort));
}

export type PracticeTotals = {
  rounds: number;
  activeStudents: number;
  totalStudents: number;
  totalSeconds: number;
};

export function practiceTotals(
  rows: PracticeStudentRow<PracticeStudentIdentity>[]
): PracticeTotals {
  return {
    rounds: rows.reduce((total, row) => total + row.practice.rounds, 0),
    activeStudents: rows.filter((row) => row.practice.rounds > 0).length,
    totalStudents: rows.length,
    totalSeconds: rows.reduce((total, row) => total + row.practice.totalSeconds, 0)
  };
}

// ---------------------------------------------------------------------------
// Khối "Tự luyện" trong trang chi tiết học viên: gộp theo BỘ LUYỆN (mỗi bộ = một
// Assignment ảo = một phạm vi luyện), mới nhất lên trên.
// ---------------------------------------------------------------------------

export type PracticeAttemptDetail = {
  id: string;
  assignmentId: string;
  assignmentTitle: string;
  attemptRound: number;
  status: string;
  startedAt: Date;
  submittedAt: Date | null;
  elapsedSeconds: number;
  score: number | null;
  scorePercent: number | null;
};

export type PracticeSetGroup = {
  assignmentId: string;
  title: string;
  submittedCount: number;
  inProgressCount: number;
  // Lượt điểm cao nhất trong bộ (chỉ xét lượt có chấm tự động).
  bestScore: number | null;
  bestPercent: number | null;
  lastAt: Date;
  // Mọi lượt của bộ, mới nhất trước — kể cả lượt đang làm dở.
  attempts: PracticeAttemptDetail[];
};

export function isSubmittedAttempt(status: string): boolean {
  return status === "submitted" || status === "reviewed";
}

export function groupPracticeAttempts(attempts: PracticeAttemptDetail[]): PracticeSetGroup[] {
  const groups = new Map<string, PracticeSetGroup>();

  for (const attempt of attempts) {
    const time = attemptTime(attempt);
    const group = groups.get(attempt.assignmentId) ?? {
      assignmentId: attempt.assignmentId,
      title: attempt.assignmentTitle,
      submittedCount: 0,
      inProgressCount: 0,
      bestScore: null,
      bestPercent: null,
      lastAt: time,
      attempts: []
    };

    if (isSubmittedAttempt(attempt.status)) {
      group.submittedCount += 1;
    } else {
      group.inProgressCount += 1;
    }

    if (attempt.scorePercent !== null && (group.bestPercent === null || attempt.scorePercent > group.bestPercent)) {
      group.bestPercent = attempt.scorePercent;
      group.bestScore = attempt.score;
    }

    if (time.getTime() > group.lastAt.getTime()) {
      group.lastAt = time;
    }

    group.attempts.push(attempt);
    groups.set(attempt.assignmentId, group);
  }

  const list = [...groups.values()];

  for (const group of list) {
    group.attempts.sort((a, b) => attemptTime(b).getTime() - attemptTime(a).getTime());
  }

  return list.sort((a, b) => b.lastAt.getTime() - a.lastAt.getTime());
}
