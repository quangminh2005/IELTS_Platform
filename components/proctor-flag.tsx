import { hasProctorFlag, proctorSummary, type ProctorCounts } from "@/lib/proctor-signals";

// Cờ cảnh báo hành vi đáng ngờ, dùng chung cho lịch giao bài / trang học viên / hàng
// đợi chấm để ba chỗ không bao giờ lệch nhau. Không có dấu hiệu thì không hiện gì.
// Theo đúng kiểu thẻ ⚠️ của durationSuspect sẵn có trong review-queue.tsx.
export function ProctorFlag({
  counts,
  className = ""
}: {
  counts: ProctorCounts;
  className?: string;
}) {
  if (!hasProctorFlag(counts)) {
    return null;
  }
  return (
    <span
      className={`cursor-help ${className}`.trim()}
      title={`${proctorSummary(counts)} — chỉ là dấu hiệu để hỏi lại học viên, không phải bằng chứng gian lận`}
    >
      ⚠️
    </span>
  );
}
