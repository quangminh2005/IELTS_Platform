// Ghi kết quả của planRegularSessions xuống DB. Luôn chạy trong $transaction do
// nơi gọi mở (action của giáo viên hoặc cron), để đọc-tính-ghi không bị chen ngang.

import type { Prisma } from "@prisma/client";
import { planRegularSessions } from "@/lib/class-schedule";
import { prisma } from "@/lib/prisma";

// applyFrom bỏ trống = max(now, scheduleAppliesFrom): không bao giờ tạo lại buổi
// đã qua, cũng không đè các buổi nằm trước mốc áp dụng lịch mới.
export async function syncClassSessions(
  db: Prisma.TransactionClient,
  classId: string,
  now: Date,
  applyFrom?: Date
) {
  const classItem = await db.class.findUnique({
    where: { id: classId },
    select: {
      scheduleStartDate: true,
      scheduleEndDate: true,
      totalSessions: true,
      scheduleAppliesFrom: true,
      scheduleSlots: { select: { weekday: true, startMinute: true, endMinute: true } },
      sessions: {
        select: {
          id: true,
          startsAt: true,
          endsAt: true,
          status: true,
          kind: true,
          edited: true,
          originalStartsAt: true
        }
      }
    }
  });

  if (!classItem) {
    return null;
  }

  const from =
    applyFrom ?? new Date(Math.max(now.getTime(), classItem.scheduleAppliesFrom?.getTime() ?? 0));

  const plan = planRegularSessions({
    slots: classItem.scheduleSlots,
    scheduleStartDate: classItem.scheduleStartDate,
    scheduleEndDate: classItem.scheduleEndDate,
    totalSessions: classItem.totalSessions,
    existing: classItem.sessions,
    applyFrom: from,
    now
  });

  if (plan.deleteIds.length > 0) {
    await db.classSession.deleteMany({ where: { id: { in: plan.deleteIds } } });
  }
  if (plan.create.length > 0) {
    await db.classSession.createMany({
      data: plan.create.map((session) => ({
        classId,
        startsAt: session.startsAt,
        endsAt: session.endsAt
      }))
    });
  }

  return plan;
}

// Cron hằng ngày: lớp học liên tục (không số buổi, không ngày kết thúc) luôn được
// nối thêm để có sẵn 12 tuần. Không tạo thông báo — buổi mới theo đúng lịch cố định.
export async function topUpClassSessions(now: Date = new Date()): Promise<number> {
  const classes = await prisma.class.findMany({
    where: { totalSessions: null, scheduleEndDate: null, scheduleSlots: { some: {} } },
    select: { id: true }
  });

  let created = 0;
  for (const classItem of classes) {
    const plan = await prisma.$transaction((tx) => syncClassSessions(tx, classItem.id, now));
    created += plan?.create.length ?? 0;
  }
  return created;
}
