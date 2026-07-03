// Kiểu dữ liệu và hàm thuần cho màn hình "Lịch giao bài" của giáo viên.
// Toàn bộ ở đây không phụ thuộc Prisma/React để test được và dùng chung
// cho cả server component lẫn client component.

import { formatBand } from "@/lib/band-score";

export type CalendarClass = { id: string; name: string };

export type CalendarAttempt = {
  id: string;
  status: string; // in_progress | submitted | reviewed
  submittedAt: string | null; // ISO
  elapsedSeconds: number;
  band: number | null;
  correct: number;
  total: number;
  scorePercent: number | null;
  hasPendingManual: boolean; // còn câu Writing/Speaking chưa chấm
};

export type CalendarRecipient = {
  studentId: string;
  displayName: string;
  email: string;
  classIds: string[];
  status: string; // assigned | in_progress | submitted | reviewed
  attempt: CalendarAttempt | null;
};

export type CalendarAssignment = {
  id: string;
  title: string;
  createdAt: string; // ISO
  deadline: string | null; // ISO
  unitCount: number;
  recipients: CalendarRecipient[];
};

export type CalendarMode = "assigned" | "deadline";

export type ClassGroup = {
  classId: string | null;
  className: string;
  students: CalendarRecipient[];
};

const VN_OFFSET_MS = 7 * 60 * 60 * 1000;

// 'YYYY-MM-DD' theo lịch Việt Nam (UTC+7) từ một mốc ISO.
export function vnDayKey(iso: string): string {
  return new Date(new Date(iso).getTime() + VN_OFFSET_MS).toISOString().slice(0, 10);
}

// Gom bài vào từng ngày. Chế độ "deadline" bỏ qua bài không có hạn nộp.
export function bucketAssignmentsByDay(
  assignments: CalendarAssignment[],
  mode: CalendarMode
): Map<string, CalendarAssignment[]> {
  const map = new Map<string, CalendarAssignment[]>();

  for (const assignment of assignments) {
    const anchor = mode === "deadline" ? assignment.deadline : assignment.createdAt;
    if (!anchor) {
      continue;
    }
    const key = vnDayKey(anchor);
    const list = map.get(key) ?? [];
    list.push(assignment);
    map.set(key, list);
  }

  return map;
}

// Lưới ô cho lịch tháng, tuần bắt đầu Thứ Hai. month 0-indexed.
export function buildMonthGrid(year: number, month: number): (string | null)[] {
  const firstDow = new Date(Date.UTC(year, month, 1)).getUTCDay(); // 0=CN..6=T7
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const leading = (firstDow + 6) % 7; // số ô trống trước ngày 1 (Thứ Hai = 0)

  const cells: (string | null)[] = [];
  for (let i = 0; i < leading; i += 1) {
    cells.push(null);
  }
  for (let day = 1; day <= daysInMonth; day += 1) {
    const key = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    cells.push(key);
  }
  while (cells.length % 7 !== 0) {
    cells.push(null);
  }

  return cells;
}

// Nộp trễ hạn? Chỉ đúng khi có cả mốc nộp lẫn hạn và nộp sau hạn.
export function isSubmissionLate(
  submittedAt: string | Date | null,
  deadline: string | Date | null
): boolean {
  if (!submittedAt || !deadline) {
    return false;
  }
  return new Date(submittedAt).getTime() > new Date(deadline).getTime();
}

// Đếm câu đã chấm tự động (Nghe/Đọc). Bỏ câu Writing/Speaking (isCorrect null).
export function countGradedAnswers(
  answers: Array<{ isCorrect: boolean | null }>
): { correct: number; total: number } {
  let correct = 0;
  let total = 0;

  for (const answer of answers) {
    if (answer.isCorrect === null) {
      continue;
    }
    total += 1;
    if (answer.isCorrect) {
      correct += 1;
    }
  }

  return { correct, total };
}

// Gom học viên theo lớp. Lọc theo 1 lớp -> chỉ lớp đó. "Tất cả" -> mỗi lớp có
// học viên nhận bài là một nhóm; học viên không thuộc lớp nào vào "Chưa xếp lớp".
// Học viên thuộc nhiều lớp sẽ xuất hiện ở mỗi nhóm lớp của họ (phản ánh đúng "theo lớp").
export function studentsGroupedByClass(
  recipients: CalendarRecipient[],
  classes: CalendarClass[],
  selectedClassId: string | null
): ClassGroup[] {
  if (selectedClassId) {
    const cls = classes.find((item) => item.id === selectedClassId);
    const students = recipients.filter((r) => r.classIds.includes(selectedClassId));
    return students.length > 0
      ? [{ classId: selectedClassId, className: cls?.name ?? "Lớp", students }]
      : [];
  }

  const groups: ClassGroup[] = [];
  for (const cls of classes) {
    const students = recipients.filter((r) => r.classIds.includes(cls.id));
    if (students.length > 0) {
      groups.push({ classId: cls.id, className: cls.name, students });
    }
  }

  const unassigned = recipients.filter(
    (r) => !classes.some((cls) => r.classIds.includes(cls.id))
  );
  if (unassigned.length > 0) {
    groups.push({ classId: null, className: "Chưa xếp lớp", students: unassigned });
  }

  return groups;
}

// Chuỗi "kết quả" hiển thị: band (hoặc %) + số câu đúng; kèm/hiện "Chờ chấm" cho
// phần chấm tay. Chỉ dùng cho attempt đã nộp/đã chấm.
export function formatAttemptResult(attempt: {
  band: number | null;
  correct: number;
  total: number;
  scorePercent: number | null;
  hasPendingManual: boolean;
  status: string;
}): string {
  if (attempt.status !== "submitted" && attempt.status !== "reviewed") {
    return "—";
  }

  if (attempt.total > 0) {
    const head =
      attempt.band !== null
        ? formatBand(attempt.band)
        : attempt.scorePercent !== null
          ? `${Math.round(attempt.scorePercent)}%`
          : "—";
    const body = `${head} · ${attempt.correct}/${attempt.total}`;
    return attempt.hasPendingManual ? `${body} · Chờ chấm` : body;
  }

  if (attempt.band !== null) {
    return formatBand(attempt.band);
  }
  return "Chờ chấm";
}
