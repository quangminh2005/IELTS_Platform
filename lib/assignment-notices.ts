export type AssignmentNoticeStatus = "success" | "error";

export function assignmentNoticePath(
  status: AssignmentNoticeStatus,
  message: string,
  // Token đổi sau mỗi lần tạo bài thành công. Trang dùng nó làm `key` để dựng
  // lại form "Tạo bài giao" (xoá hết phần/học viên đã tích) cho lần giao kế tiếp.
  resetToken?: string
) {
  const params = new URLSearchParams({
    assignmentsStatus: status,
    assignmentsMessage: message
  });

  if (resetToken) {
    params.set("assignmentsReset", resetToken);
  }

  return `/teacher/assignments?${params.toString()}`;
}
