import { AttendanceCalendar } from "@/components/attendance-calendar";
import { StatGrid } from "@/components/profile-side-cards";
import { busiestDayLabel, type MonthActivitySummary } from "@/lib/profile-activity";

// Lịch chăm học tháng + 4 ô số trên hồ sơ học viên khác (kiểu chin).
export function ProfileMonthActivity({
  summary,
  streakDays,
  prevHref,
  nextHref
}: {
  summary: MonthActivitySummary;
  streakDays: number;
  prevHref: string;
  nextHref: string | null;
}) {
  return (
    <section className="space-y-4">
      <AttendanceCalendar data={summary.attendance} prevHref={prevHref} nextHref={nextHref} />
      <StatGrid
        stats={[
          { label: "Tỉ lệ ngày học", value: `${summary.ratePercent}%` },
          { label: "Số ngày học", value: `${summary.activeDays} ngày` },
          { label: "Chuỗi hiện tại", value: `🔥 ${streakDays} ngày` },
          { label: "Ngày cày trâu nhất", value: summary.busiest ? busiestDayLabel(summary.busiest) : "—" }
        ]}
      />
    </section>
  );
}
