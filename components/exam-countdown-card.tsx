import Link from "next/link";
import { formatBand } from "@/lib/band-score";
import type { ExamCountdown } from "@/lib/exam-countdown";

const EDIT_HREF = "/student/profile?edit=exam";

// Thẻ đếm ngược ngày thi ở góc trang chủ học viên (ý tưởng từ YouPass). Cả thẻ là
// link sang Hồ sơ, mở sẵn bảng chỉnh sửa ở ô ngày thi. Chưa đặt ngày thì thành lời
// mời đặt — nét đứt, nhỏ, không chiếm chỗ của danh sách bài.
export function ExamCountdownCard({
  view,
  targetBand
}: {
  view: ExamCountdown | null;
  targetBand: number | null;
}) {
  const base =
    "flex items-center gap-3 rounded-xl border px-4 py-3 shadow-card transition sm:max-w-xs";

  if (!view) {
    return (
      <Link
        href={EDIT_HREF}
        className={`${base} border-dashed border-border bg-card hover:border-primary/60`}
      >
        <span aria-hidden="true" className="text-2xl">📅</span>
        <span className="min-w-0">
          <span className="block text-sm font-semibold">Bạn thi IELTS ngày nào?</span>
          <span className="block text-xs text-muted-foreground">Đặt ngày thi để đếm ngược</span>
        </span>
      </Link>
    );
  }

  if (view.state === "today") {
    return (
      <Link href={EDIT_HREF} className={`${base} border-emerald-400/50 bg-emerald-500/10`}>
        <span aria-hidden="true" className="text-3xl">🍀</span>
        <span className="min-w-0">
          <span className="block font-bold text-emerald-700 dark:text-emerald-300">Hôm nay thi IELTS!</span>
          <span className="block text-xs text-muted-foreground">Bình tĩnh, tự tin — chúc bạn may mắn.</span>
        </span>
      </Link>
    );
  }

  if (view.state === "past") {
    return (
      <Link href={EDIT_HREF} className={`${base} border-border bg-card hover:border-primary/60`}>
        <span aria-hidden="true" className="text-2xl">🎓</span>
        <span className="min-w-0">
          <span className="block text-sm font-semibold">Bạn đã thi ngày {view.dateText}</span>
          <span className="block text-xs text-muted-foreground">Có lịch thi mới? Bấm để cập nhật</span>
        </span>
      </Link>
    );
  }

  const soon = view.state === "soon";
  const details = [
    view.dateText,
    view.weeksText,
    targetBand !== null ? `Mục tiêu ${formatBand(targetBand)}` : null
  ].filter(Boolean);

  return (
    <Link
      href={EDIT_HREF}
      title="Đổi ngày thi"
      className={`${base} ${
        soon
          ? "border-amber-400/60 bg-amber-500/10 hover:border-amber-500"
          : "border-primary/30 bg-primary/5 hover:border-primary/60"
      }`}
    >
      <span
        className={`flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-lg leading-none ${
          soon ? "bg-amber-500 text-white" : "bg-primary text-primary-foreground"
        }`}
      >
        <span className="text-xl font-bold tabular-nums">{view.days}</span>
        <span className="mt-0.5 text-[10px] font-semibold uppercase">ngày</span>
      </span>
      <span className="min-w-0">
        <span className="block font-semibold">{soon ? "Sắp thi rồi, cố lên!" : "Đếm ngược ngày thi IELTS"}</span>
        <span className="block text-xs text-muted-foreground">{details.join(" · ")}</span>
      </span>
    </Link>
  );
}
