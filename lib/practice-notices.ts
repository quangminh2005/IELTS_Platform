export type PracticeNoticeStatus = "success" | "error";

// Theo khuôn của lib/material-notices.ts / lib/assignment-notices.ts: server
// action redirect kèm query, trang render lại NoticeToast — thay vì throw ra
// màn hình lỗi đỏ của Next cho những tình huống thường ngày (giáo viên vừa gỡ
// đề khỏi thư viện tự luyện, đề chưa có phần nào...).
export function practiceNoticePath(status: PracticeNoticeStatus, message: string) {
  const params = new URLSearchParams({
    practiceStatus: status,
    practiceMessage: message
  });

  return `/student/practice?${params.toString()}`;
}
