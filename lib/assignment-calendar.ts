// Kiểu dữ liệu và hàm thuần cho màn hình "Lịch giao bài" của giáo viên.
// Toàn bộ ở đây không phụ thuộc Prisma/React để test được và dùng chung
// cho cả server component lẫn client component.

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
