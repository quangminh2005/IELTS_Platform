export type PracticeNoticeStatus = "success" | "error";

// Theo khuôn của lib/material-notices.ts / lib/assignment-notices.ts: server
// action redirect kèm query, trang render lại NoticeToast — thay vì throw ra
// màn hình lỗi đỏ của Next cho những tình huống thường ngày (giáo viên vừa gỡ
// đề khỏi thư viện tự luyện, đề chưa có phần nào...).
//
// Kèm thêm `practiceNonce` duy nhất mỗi lần gọi: hai lần lỗi LIÊN TIẾP có thể
// sinh ra cùng một nội dung `practiceMessage` (học viên bấm trúng đúng nút vừa
// lỗi) — nếu chỉ dựa vào nội dung message, các useEffect ở PracticeLibrary/
// NoticeToast sẽ không thấy gì đổi nên không chạy lại (hộp thoại không đóng,
// toast không hiện lại lần hai). Nonce đảm bảo mỗi lần redirect luôn là một
// giá trị mới, bất kể message có trùng hay không.
export function practiceNoticePath(status: PracticeNoticeStatus, message: string) {
  const params = new URLSearchParams({
    practiceStatus: status,
    practiceMessage: message,
    practiceNonce: Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
  });

  return `/student/practice?${params.toString()}`;
}
