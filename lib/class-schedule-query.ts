// Đọc lịch học. Bọc try/catch: bảng lịch mới thêm, nếu ensure-db chưa kịp chạy
// trên prod thì trang vẫn hiện (chỉ thiếu lịch) thay vì màn hình lỗi.

import type { ScheduleSlot } from "@/lib/class-schedule";
import { prisma } from "@/lib/prisma";
import type { ScheduleClassInfo, ScheduleSessionRow } from "@/lib/student-calendar";

const sessionSelect = {
  id: true,
  classId: true,
  startsAt: true,
  endsAt: true,
  status: true,
  mode: true,
  kind: true,
  meetingUrl: true,
  note: true,
  originalStartsAt: true
} as const;

export type StudentScheduleClass = ScheduleClassInfo & { joinedAt: Date; scheduleChangedAt: Date | null };

export async function getStudentSchedule(
  studentId: string
): Promise<{ classes: StudentScheduleClass[]; sessions: ScheduleSessionRow[] }> {
  try {
    const memberships = await prisma.classStudent.findMany({
      where: { studentId },
      select: {
        joinedAt: true,
        class: {
          select: { id: true, name: true, location: true, totalSessions: true, scheduleChangedAt: true }
        }
      }
    });
    const classes = memberships.map((membership) => ({
      ...membership.class,
      joinedAt: membership.joinedAt
    }));
    if (classes.length === 0) {
      return { classes, sessions: [] };
    }
    // Lấy TOÀN BỘ buổi của các lớp (cột nhẹ): cần đủ để đánh số "Buổi X/Y".
    const sessions = await prisma.classSession.findMany({
      where: { classId: { in: classes.map((classItem) => classItem.id) } },
      orderBy: { startsAt: "asc" },
      select: sessionSelect
    });
    return { classes, sessions };
  } catch (error) {
    console.error("[lich-hoc] Không đọc được lịch học của học viên:", error);
    return { classes: [], sessions: [] };
  }
}

// Nơi gọi đã kiểm lớp thuộc giáo viên (findFirst theo teacherId) trước khi gọi.
export async function getClassScheduleForTeacher(classId: string): Promise<{
  scheduleStartDate: Date | null;
  scheduleEndDate: Date | null;
  totalSessions: number | null;
  location: string | null;
  slots: ScheduleSlot[];
  sessions: ScheduleSessionRow[];
} | null> {
  try {
    const classItem = await prisma.class.findUnique({
      where: { id: classId },
      select: {
        scheduleStartDate: true,
        scheduleEndDate: true,
        totalSessions: true,
        location: true,
        scheduleSlots: {
          orderBy: [{ weekday: "asc" }, { startMinute: "asc" }],
          select: { weekday: true, startMinute: true, endMinute: true }
        },
        sessions: { orderBy: { startsAt: "asc" }, select: sessionSelect }
      }
    });
    if (!classItem) {
      return null;
    }
    const { scheduleSlots, ...rest } = classItem;
    return { ...rest, slots: scheduleSlots };
  } catch (error) {
    console.error("[lich-hoc] Không đọc được lịch học của lớp:", error);
    return null;
  }
}
