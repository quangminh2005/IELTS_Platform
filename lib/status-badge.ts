// Màu nhãn trạng thái bài giao, dùng chung cho Tổng quan + Lịch sử của học viên
// để cùng một trạng thái không mang hai màu ở hai trang.
//   - Đã chấm  → xanh dương (màu chính)
//   - Đã nộp   → xanh lá (việc đã xong — cùng tông "Đúng"/"Đã hoàn chỉnh")
//   - Đang làm → vàng (đang dở, cùng tông chip "Đang làm dở" ở Tự luyện)
//   - Chưa làm → xám
// Trước đây "Đã nộp" cũng vàng như "Đang làm dở" nên hai nghĩa khác nhau nhìn
// giống hệt nhau.
export function statusBadgeClasses(status: string) {
  if (status === "reviewed") {
    return "border-primary/40 bg-primary/10 text-primary";
  }

  if (status === "submitted") {
    return "border-emerald-400/50 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300";
  }

  if (status === "in_progress") {
    return "border-amber-400/50 bg-amber-500/10 text-amber-600 dark:text-amber-300";
  }

  return "border-border bg-muted text-muted-foreground";
}
