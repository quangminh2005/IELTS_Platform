export type ClassNoticeStatus = "success" | "error";

// Xoá lớp / xoá học viên buộc phải rời trang chi tiết (trang đó không còn tồn tại)
// nên chúng redirect về danh sách lớp kèm thông báo ở query param; NoticeToast trên
// trang /teacher/classes đọc và hiện popup.
export function classNoticePath(status: ClassNoticeStatus, message: string) {
  const params = new URLSearchParams({
    classesStatus: status,
    classesMessage: message
  });

  return `/teacher/classes?${params.toString()}`;
}
