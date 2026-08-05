import type { Prisma } from "@prisma/client";

// Bài tự luyện được dựng thành "bài giao ảo" (Assignment.mode = "practice") để tái
// dùng nguyên đường ống chấm/kết quả của bài giao. MỌI điều kiện lọc liên quan nằm ở
// file này — không nơi nào khác được viết chuỗi "practice" bằng tay.
export const PRACTICE_MODE = "practice";

// Khoá định danh một bộ luyện: mỗi (học viên × đề × phạm vi) chỉ có một Assignment.
// unitId = null nghĩa là luyện cả đề.
export function practiceScopeKey(
  studentId: string,
  materialId: string,
  unitId: string | null
): string {
  return `${studentId}:${materialId}:${unitId ?? "all"}`;
}

// Dùng ở where của Assignment.
export const excludePracticeAssignment = {
  mode: { not: PRACTICE_MODE }
} satisfies Prisma.AssignmentWhereInput;

export const onlyPracticeAssignment = {
  mode: PRACTICE_MODE
} satisfies Prisma.AssignmentWhereInput;

// Dùng ở where của AssignmentRecipient, hoặc lồng dưới attempt.assignmentRecipient.
export const excludePracticeRecipient = { assignment: excludePracticeAssignment };
export const onlyPracticeRecipient = { assignment: onlyPracticeAssignment };

// Lượt được tính vào xếp hạng và thống kê điểm yếu: bài giao (luôn là lượt 1) và
// lượt tự luyện ĐẦU TIÊN của mỗi đề. Các lượt luyện lại chỉ để học, không đẩy hạng.
export const countsForStats = { attemptRound: 1 } satisfies Prisma.AttemptWhereInput;

export type PracticeUnitTime = {
  skill: string;
  defaultTimeLimitMinutes: number | null;
};

// Gộp thời gian mặc định của các phần thành JSON theo kỹ năng cho
// Assignment.skillTimeLimitsJson. Trả về null khi học viên chọn "không tính giờ"
// hoặc không phần nào đặt thời gian — kỹ năng vắng mặt = không đếm ngược.
export function practiceSkillTimeLimits(
  units: PracticeUnitTime[],
  timed: boolean
): string | null {
  if (!timed) {
    return null;
  }

  const totals = new Map<string, number>();

  for (const unit of units) {
    if (unit.defaultTimeLimitMinutes === null) {
      continue;
    }

    totals.set(unit.skill, (totals.get(unit.skill) ?? 0) + unit.defaultTimeLimitMinutes);
  }

  if (totals.size === 0) {
    return null;
  }

  return JSON.stringify(Object.fromEntries(totals));
}

// Học viên bấm luyện lại một bộ đang có lượt LÀM DỞ: bộ luyện dùng chung một
// Assignment cho mọi lượt, nên lựa chọn tính giờ của lần bấm này chỉ được phép NỚI
// đồng hồ, không được siết.
//   - Chọn "không tính giờ" → gỡ giới hạn. An toàn tuyệt đối: submitSkill bỏ qua
//     submitReason "auto_timeout" khi kỹ năng không có ngân sách thời gian, nên gỡ
//     đồng hồ không thể làm bài bị tự nộp oan.
//   - Chọn "tính giờ" → giữ nguyên. Áp ngân sách mới lên một lượt đã làm quá lâu
//     (nhất là lượt vốn không tính giờ) sẽ khiến bài bị tự nộp ngay khi mở lại.
export function shouldClearTimeLimitsOnResume(
  currentSkillTimeLimitsJson: string | null,
  timed: boolean
): boolean {
  return !timed && currentSkillTimeLimitsJson !== null;
}

export type LatestAttempt = {
  id: string;
  status: string;
  attemptRound: number;
} | null;

export type StartDecision =
  | { kind: "resume"; attemptId: string }
  | { kind: "new"; attemptRound: number };

// Bài giao: một lần duy nhất (đã nộp thì trang tự chuyển sang xem kết quả).
// Bài tự luyện: nộp xong bấm lại là mở lượt mới. Lượt đang làm dở luôn được tiếp tục.
export function decideAttemptStart(mode: string, latest: LatestAttempt): StartDecision {
  if (latest === null) {
    return { kind: "new", attemptRound: 1 };
  }

  if (latest.status === "in_progress") {
    return { kind: "resume", attemptId: latest.id };
  }

  if (mode === PRACTICE_MODE) {
    return { kind: "new", attemptRound: latest.attemptRound + 1 };
  }

  return { kind: "resume", attemptId: latest.id };
}
