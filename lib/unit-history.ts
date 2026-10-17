// "Học viên nào đã làm phần nào" — để thầy khỏi giao trùng bài. Dùng ở kho Tài
// liệu (thẻ "N HS đã làm" + lọc theo học viên) và ở form Tạo bài giao (cảnh báo
// học viên đã làm / đang được giao phần vừa chọn).
//
// Module thuần: không đụng Prisma, không đụng React (xem tests/unit-history.test.ts).

// "done"     = đã nộp phần này (bài giao hoặc tự luyện).
// "assigned" = đang được giao phần này nhưng chưa nộp. Tự luyện mở mà chưa nộp
//              thì KHÔNG tính — chỉ là bấm xem thử.
export type UnitStudentStatus = "done" | "assigned";

// unitId -> studentId -> trạng thái.
export type UnitHistory = Record<string, Record<string, UnitStudentStatus>>;

// Một lượt nhận bài (AssignmentRecipient) đã dẹt sẵn từ Prisma.
export type UnitHistoryRow = {
  studentId: string;
  recipientStatus: string;
  isPractice: boolean;
  units: { id: string; skill: string }[];
  // Kỹ năng đã nộp riêng trong bất kỳ lượt nào (AttemptSkill.status = "submitted").
  submittedSkills: string[];
  // Có lượt làm nào đã nộp cả bài (Attempt.submittedAt) không.
  anyAttemptSubmitted: boolean;
};

const DONE_RECIPIENT = new Set(["submitted", "reviewed"]);

export function buildUnitHistory(rows: UnitHistoryRow[]): UnitHistory {
  const history: UnitHistory = {};

  for (const row of rows) {
    const wholeDone = DONE_RECIPIENT.has(row.recipientStatus) || row.anyAttemptSubmitted;
    const skillsDone = new Set(row.submittedSkills);

    for (const unit of row.units) {
      const done = wholeDone || skillsDone.has(unit.skill);
      if (!done && row.isPractice) {
        continue;
      }
      const byStudent = (history[unit.id] ??= {});
      // "done" luôn thắng "assigned" (được giao lại lần 2 mà lần 1 đã làm rồi).
      if (byStudent[row.studentId] !== "done") {
        byStudent[row.studentId] = done ? "done" : "assigned";
      }
    }
  }

  return history;
}

export type OverlapCount = { done: number; assigned: number };

// Trong các phần `unitIds`, học viên này đã làm bao nhiêu phần / đang được giao bao nhiêu.
export function studentOverlap(
  history: UnitHistory,
  studentId: string,
  unitIds: string[]
): OverlapCount {
  let done = 0;
  let assigned = 0;
  for (const unitId of unitIds) {
    const status = history[unitId]?.[studentId];
    if (status === "done") done += 1;
    else if (status === "assigned") assigned += 1;
  }
  return { done, assigned };
}

// Đếm số học viên đã làm / đang được giao MỘT phần.
export function unitStudentCounts(history: UnitHistory, unitId: string): OverlapCount {
  let done = 0;
  let assigned = 0;
  for (const status of Object.values(history[unitId] ?? {})) {
    if (status === "done") done += 1;
    else assigned += 1;
  }
  return { done, assigned };
}

// Gộp theo cả tài liệu: học viên "done" nếu đã làm ít nhất một phần của tài liệu,
// "assigned" nếu chưa làm phần nào nhưng đang được giao ít nhất một phần.
export function materialStudentStatus(
  history: UnitHistory,
  unitIds: string[]
): Record<string, UnitStudentStatus> {
  const result: Record<string, UnitStudentStatus> = {};
  for (const unitId of unitIds) {
    for (const [studentId, status] of Object.entries(history[unitId] ?? {})) {
      if (result[studentId] !== "done") {
        result[studentId] = status;
      }
    }
  }
  return result;
}

// Nhãn ngắn cho một học viên trong form giao bài, null = không trùng gì.
export function overlapLabel(overlap: OverlapCount, total: number): string | null {
  if (overlap.done > 0) {
    return total > 1 ? `Đã làm ${overlap.done}/${total} phần` : "Đã làm phần này";
  }
  if (overlap.assigned > 0) {
    return total > 1 ? `Đang được giao ${overlap.assigned}/${total} phần` : "Đang được giao phần này";
  }
  return null;
}

export type StudentUnitDetail = {
  // Nhãn các phần đã làm / đang được giao, theo đúng thứ tự `units` truyền vào.
  done: string[];
  assigned: string[];
};

// Chi tiết từng học viên với MỘT tài liệu: em đã làm những phần nào, đang được giao
// những phần nào. Học viên chưa đụng phần nào thì không có trong kết quả.
export function materialStudentDetail(
  history: UnitHistory,
  units: { id: string; label: string }[]
): Record<string, StudentUnitDetail> {
  const result: Record<string, StudentUnitDetail> = {};
  for (const unit of units) {
    for (const [studentId, status] of Object.entries(history[unit.id] ?? {})) {
      const detail = (result[studentId] ??= { done: [], assigned: [] });
      detail[status].push(unit.label);
    }
  }
  return result;
}
