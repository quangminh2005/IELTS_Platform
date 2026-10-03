import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { MonthlyRecapPanel } from "@/components/monthly-recap-panel";
import { getStudentRecap } from "@/lib/monthly-recap-data";
import {
  monthKeyOf,
  monthName,
  monthNumberLabel,
  recentMonthKeys,
  resolveMonthKey,
  shiftMonthKey
} from "@/lib/monthly-recap";

// Xem lại Tổng kết tháng bất cứ lúc nào (popup ở trang chủ chỉ tự bật 7 ngày đầu tháng).
const MONTH_OPTIONS = 6;

export default async function StudentRecapPage({
  searchParams
}: {
  searchParams?: { month?: string };
}) {
  const session = await auth();

  if (!session?.user?.id || session.user.role !== "student") {
    redirect("/login");
  }

  const student = await prisma.studentProfile.findUnique({
    where: { userId: session.user.id },
    select: { id: true }
  });

  if (!student) {
    redirect("/waiting");
  }

  const now = new Date();
  // Chỉ cho xem các tháng đã kết thúc — tháng đang diễn ra chưa có gì để "tổng kết".
  const latest = shiftMonthKey(monthKeyOf(now), -1);
  const monthKey = resolveMonthKey(searchParams?.month, latest, MONTH_OPTIONS);
  const { recap, view } = await getStudentRecap(student.id, monthKey, now);

  return (
    <div className="space-y-6">
      <form method="get" className="flex flex-wrap items-end justify-end gap-2">
        <label className="block text-sm font-medium">
          <span className="mb-2 block">Xem tháng</span>
          <select
            name="month"
            defaultValue={monthKey}
            className="w-48 rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none ring-primary/40 focus:border-primary focus:ring-2"
          >
            {recentMonthKeys(latest, MONTH_OPTIONS).map((key) => (
              <option key={key} value={key}>
                Tháng {monthName(key)} · {monthNumberLabel(key)}
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-card transition hover:bg-primary/90"
        >
          Xem
        </button>
      </form>

      <div className="rounded-3xl border border-border bg-gradient-to-br from-primary/10 via-background to-background p-5 shadow-card sm:p-7">
        <MonthlyRecapPanel recap={recap} view={view} closeMode="link" />
      </div>
    </div>
  );
}
