// Logic "nộp trễ hạn". Tách riêng khỏi lib/assignment-calendar.ts (module lịch
// của giáo viên, kéo theo band-score + skills) để đường tính điểm xếp hạng
// (lib/student-score.ts) dùng được mà không phải nạp cả module lịch.
//
// Không có cột nào lưu "đã nộp trễ" — luôn suy ra từ mốc nộp và hạn nộp, nên
// luật ở đây có hiệu lực với cả dữ liệu cũ.

// Bài nộp trễ chỉ được nửa suất trong Tỉ lệ hoàn thành. Đổi mức phạt thì sửa
// đúng con số này.
export const LATE_COMPLETION_WEIGHT = 0.5;

// Trạng thái AssignmentRecipient được coi là đã nộp.
const SUBMITTED_STATUSES = new Set(["submitted", "reviewed"]);

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

// Một bài giao đáng bao nhiêu suất trong Tỉ lệ hoàn thành:
// nộp đúng hạn (hoặc bài không đặt hạn) = 1, nộp trễ = 0.5, chưa nộp = 0.
export function completionWeight(input: {
  status: string;
  submittedAt: Date | null;
  deadline: Date | null;
}): number {
  if (!SUBMITTED_STATUSES.has(input.status)) {
    return 0;
  }

  return isSubmissionLate(input.submittedAt, input.deadline) ? LATE_COMPLETION_WEIGHT : 1;
}
