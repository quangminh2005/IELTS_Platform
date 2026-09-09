// Nhãn "Nộp trễ" / "Quá hạn" dùng chung cho trang Kết quả, Lịch sử và Tổng quan,
// để ba nơi không lệch màu hay chữ.

const BASE = "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold";

// Bài ĐÃ nộp nhưng nộp sau hạn.
export function LateBadge({ className = "" }: { className?: string }) {
  return (
    <span
      className={`${BASE} border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400 ${className}`}
      title="Bài này nộp sau hạn nên chỉ được nửa điểm hoàn thành khi xếp hạng."
    >
      ⏰ Nộp trễ
    </span>
  );
}

// Bài CHƯA nộp mà đã qua hạn.
export function OverdueBadge({ className = "" }: { className?: string }) {
  return (
    <span
      className={`${BASE} border-red-500/40 bg-red-500/10 text-red-600 dark:text-red-400 ${className}`}
    >
      Quá hạn
    </span>
  );
}
