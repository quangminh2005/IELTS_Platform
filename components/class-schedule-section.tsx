import { ClassScheduleForm } from "@/components/class-schedule-form";
import { ClassSessionList } from "@/components/class-session-list";
import { vnDateKey } from "@/lib/attendance";
import { formatHm, numberSessions } from "@/lib/class-schedule";
import { getClassScheduleForTeacher } from "@/lib/class-schedule-query";

// Lịch cố định + danh sách buổi của MỘT lớp (tab Lịch học của giáo viên).
// Nơi gọi phải kiểm lớp thuộc giáo viên đang đăng nhập trước khi render.
export async function ClassScheduleSection({ classId }: { classId: string }) {
  const schedule = await getClassScheduleForTeacher(classId);

  if (!schedule) {
    return (
      <p className="rounded-xl border border-border bg-card px-5 py-4 text-sm text-muted-foreground">
        Chưa tải được lịch học. Tải lại trang sau ít phút.
      </p>
    );
  }

  const now = new Date();
  const todayKey = vnDateKey(now);
  const sessionNumbers = numberSessions(schedule.sessions);

  return (
    <div className="grid gap-5 lg:grid-cols-[24rem_minmax(0,1fr)]">
      <ClassScheduleForm
        classId={classId}
        initialSlots={schedule.slots.map((slot) => ({
          weekday: slot.weekday,
          start: formatHm(slot.startMinute),
          end: formatHm(slot.endMinute)
        }))}
        startDate={schedule.scheduleStartDate ? vnDateKey(schedule.scheduleStartDate) : ""}
        totalSessions={schedule.totalSessions}
        endDate={schedule.scheduleEndDate ? vnDateKey(schedule.scheduleEndDate) : ""}
        location={schedule.location ?? ""}
        hasSessions={schedule.sessions.length > 0}
        todayKey={todayKey}
      />
      <ClassSessionList
        classId={classId}
        total={schedule.totalSessions}
        nowIso={now.toISOString()}
        todayKey={todayKey}
        sessions={schedule.sessions.map((session) => ({
          id: session.id,
          startsAt: session.startsAt.toISOString(),
          endsAt: session.endsAt.toISOString(),
          status: session.status,
          mode: session.mode,
          kind: session.kind,
          meetingUrl: session.meetingUrl,
          note: session.note,
          originalStartsAt: session.originalStartsAt?.toISOString() ?? null,
          number: sessionNumbers.get(session.id) ?? null
        }))}
      />
    </div>
  );
}
