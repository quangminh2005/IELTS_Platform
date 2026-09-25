import { redirect } from "next/navigation";
import { StudentCalendar } from "@/components/student-calendar";
import { vnDateKey } from "@/lib/attendance";
import { auth } from "@/lib/auth";
import { vnMidnight } from "@/lib/class-schedule";
import { getStudentSchedule } from "@/lib/class-schedule-query";
import { excludePracticeAssignment } from "@/lib/practice";
import { prisma } from "@/lib/prisma";
import {
  buildCalendarMonth,
  monthParam,
  resolveCalendarMonth,
  resolveSelectedDay,
  shiftMonth,
  toDeadlineEvents,
  toSessionEvents
} from "@/lib/student-calendar";

export const dynamic = "force-dynamic";

// Lịch học của học viên: buổi học của các lớp đang theo + hạn nộp bài trong tháng.
// Tham số URL: ?m=YYYY-MM (tháng đang xem), ?d=YYYY-MM-DD (ngày đang chọn).
export default async function StudentCalendarPage({
  searchParams
}: {
  searchParams?: { m?: string; d?: string };
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
  const { year, month } = resolveCalendarMonth(searchParams?.m, now);
  const prev = shiftMonth(year, month, -1);
  const next = shiftMonth(year, month, 1);
  const monthStart = vnMidnight(`${monthParam(year, month)}-01`);
  const monthEnd = vnMidnight(`${monthParam(next.year, next.month)}-01`);

  const [schedule, recipients] = await Promise.all([
    getStudentSchedule(student.id),
    prisma.assignmentRecipient.findMany({
      // Bài tự luyện không có hạn nộp, nhưng vẫn lọc rõ ràng như mọi danh sách bài giao.
      where: {
        studentId: student.id,
        assignment: { ...excludePracticeAssignment, deadline: { gte: monthStart, lt: monthEnd } }
      },
      select: {
        id: true,
        status: true,
        submittedAt: true,
        assignment: {
          select: {
            title: true,
            deadline: true,
            units: { select: { assignableUnit: { select: { skill: true } } } }
          }
        },
        attempts: { orderBy: { startedAt: "desc" }, take: 1, select: { id: true } }
      }
    })
  ]);

  const events = [
    ...toSessionEvents(schedule.classes, schedule.sessions),
    ...toDeadlineEvents(
      recipients.flatMap((recipient) =>
        recipient.assignment.deadline
          ? [
              {
                id: recipient.id,
                status: recipient.status,
                submittedAt: recipient.submittedAt,
                deadline: recipient.assignment.deadline,
                title: recipient.assignment.title,
                skills: recipient.assignment.units.map((unit) => unit.assignableUnit.skill),
                latestAttemptId: recipient.attempts[0]?.id ?? null
              }
            ]
          : []
      ),
      now
    )
  ];

  const current = resolveCalendarMonth(undefined, now);
  const isCurrentMonth = current.year === year && current.month === month;

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-semibold text-primary">Trang học viên</p>
        <h2 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">Lịch học</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          Buổi học của lớp và hạn nộp bài trong tháng. Bấm vào một ngày để xem chi tiết.
        </p>
      </header>

      {schedule.sessions.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border bg-card px-5 py-4 text-sm text-muted-foreground">
          Lớp của bạn chưa có lịch học — giáo viên sẽ cập nhật sớm. Hạn nộp bài vẫn hiện trên lịch.
        </p>
      ) : null}

      {/* key theo tháng: đổi tháng thì dựng lại component để ngày đang chọn không kẹt ở tháng cũ. */}
      <StudentCalendar
        key={monthParam(year, month)}
        calendar={buildCalendarMonth(year, month, events)}
        todayKey={vnDateKey(now)}
        initialSelected={resolveSelectedDay(searchParams?.d, year, month, now)}
        nowIso={now.toISOString()}
        prevHref={`/student/calendar?m=${monthParam(prev.year, prev.month)}`}
        nextHref={`/student/calendar?m=${monthParam(next.year, next.month)}`}
        todayHref={isCurrentMonth ? null : "/student/calendar"}
      />
    </div>
  );
}
