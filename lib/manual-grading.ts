// Dạng câu BẮT BUỘC giáo viên chấm tay: bài luận Writing và phần ghi âm Speaking.
// Các dạng khác trong bài Viết/Nói (vd Writing dạng điền chỗ trống vào bài mẫu) có
// đáp án nên hệ thống tự chấm — xem isManualGradedQuestion trong lib/attempt-grading.
export const MANUAL_QUESTION_TYPES = ["writing_task", "speaking_task"] as const;

export const MANUAL_SKILLS = ["writing", "speaking"] as const;

// Mảnh điều kiện Prisma cho AssignableUnit "thật sự cần chấm tay" — dùng chung cho
// hàng đợi chấm bài và thẻ "Bài chờ chấm" ở trang chủ giáo viên, để bài Viết tự
// chấm không lọt vào danh sách chờ.
export const manualGradedUnitWhere = {
  skill: { in: [...MANUAL_SKILLS] },
  questions: { some: { questionType: { in: [...MANUAL_QUESTION_TYPES] } } }
};
