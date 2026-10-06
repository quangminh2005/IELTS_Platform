import {
  buildStudentNotifications,
  countUnread,
  NOTIFICATION_LIMIT,
  type BugResolvedNotificationSource,
  type PrizeNotificationSource,
  type RewardNotificationSource,
  type StudentNotification
} from "@/lib/notifications";
import { buildScheduleNotificationSources } from "@/lib/class-schedule";
import { excludePracticeAssignment } from "@/lib/practice";
import { prisma } from "@/lib/prisma";
import { groupSocialNotifications, isReactionKind, type SocialNotificationGroup } from "@/lib/social";

// Theo dõi + cảm xúc (Mạng xã hội Đợt 2): chỉ gom 30 ngày gần nhất, tối đa 200 dòng
// mỗi bảng — đủ cho chuông 30 mục, không kéo cả lịch sử.
const SOCIAL_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;
const SOCIAL_ROW_LIMIT = 200;

export type StudentNotificationFeed = {
  items: StudentNotification[];
  unreadCount: number;
};

// Bài tự luyện chỉ bị loại ở nguồn "bài mới giao": học viên tự bấm luyện thì không
// cần ai báo là mình vừa có bài mới.
//
// NGƯỢC LẠI, nguồn "đã chấm xong" KHÔNG loại bài tự luyện: hàng đợi chấm bài của
// giáo viên có hẳn tab "Tự luyện" (app/teacher/review/page.tsx), nên bài tự luyện
// vẫn được chấm tay như thường. Lọc chúng ra là học viên tự luyện Writing rồi được
// chấm sẽ không bao giờ biết mà vào đọc nhận xét.
export async function getStudentNotifications(
  studentId: string
): Promise<StudentNotificationFeed> {
  const [student, reviews, recipients] = await Promise.all([
    prisma.studentProfile.findUnique({
      where: { id: studentId },
      select: { notificationsReadAt: true }
    }),
    prisma.teacherReview.findMany({
      where: { studentId },
      orderBy: { reviewedAt: "desc" },
      take: NOTIFICATION_LIMIT,
      select: {
        attemptId: true,
        overallBand: true,
        reviewedAt: true,
        attempt: {
          select: {
            assignmentRecipient: { select: { assignment: { select: { title: true } } } }
          }
        }
      }
    }),
    prisma.assignmentRecipient.findMany({
      where: { studentId, assignment: excludePracticeAssignment },
      orderBy: { assignedAt: "desc" },
      take: NOTIFICATION_LIMIT,
      select: {
        id: true,
        assignedAt: true,
        assignment: { select: { title: true } }
      }
    })
  ]);

  // Báo lỗi đã được giáo viên xử lý. Truy vấn riêng, bọc try/catch: bảng BugReport
  // mới thêm, nếu ensure-db chưa kịp chạy trên prod thì chuông vẫn phải hiện hai
  // nguồn còn lại.
  let bugs: BugResolvedNotificationSource[] = [];
  try {
    bugs = await prisma.bugReport.findMany({
      where: { studentId, status: "resolved", resolvedAt: { not: null } },
      orderBy: { resolvedAt: "desc" },
      take: NOTIFICATION_LIMIT,
      select: { id: true, category: true, teacherNote: true, resolvedAt: true }
    }).then((rows) =>
      rows.flatMap((row) =>
        row.resolvedAt ? [{ ...row, resolvedAt: row.resolvedAt }] : []
      )
    );
  } catch (error) {
    console.error("[thong-bao] Không đọc được BugReport:", error);
  }

  // Lịch học (bảng mới) — bọc try/catch như BugReport để chuông không sập theo.
  let scheduleSources: ReturnType<typeof buildScheduleNotificationSources> = {
    sessions: [],
    schedules: []
  };
  try {
    const memberships = await prisma.classStudent.findMany({
      where: { studentId },
      select: {
        classId: true,
        joinedAt: true,
        class: { select: { name: true, scheduleChangedAt: true } }
      }
    });
    const changedSessions =
      memberships.length === 0
        ? []
        : await prisma.classSession.findMany({
            where: {
              classId: { in: memberships.map((membership) => membership.classId) },
              changeKind: { not: null }
            },
            orderBy: { changedAt: "desc" },
            take: NOTIFICATION_LIMIT,
            select: {
              id: true,
              classId: true,
              startsAt: true,
              originalStartsAt: true,
              kind: true,
              changeKind: true,
              changedAt: true
            }
          });
    scheduleSources = buildScheduleNotificationSources({
      memberships: memberships.map((membership) => ({
        classId: membership.classId,
        className: membership.class.name,
        joinedAt: membership.joinedAt,
        scheduleChangedAt: membership.class.scheduleChangedAt
      })),
      sessions: changedSessions
    });
  } catch (error) {
    console.error("[thong-bao] Không đọc được lịch học:", error);
  }

  // Phiếu đổi quà đã trao / bị từ chối (bảng mới) — bọc try/catch như trên.
  let rewardSources: RewardNotificationSource[] = [];
  try {
    const rows = await prisma.rewardRedemption.findMany({
      where: { studentId, status: { in: ["delivered", "rejected"] }, resolvedAt: { not: null } },
      orderBy: { resolvedAt: "desc" },
      take: NOTIFICATION_LIMIT,
      select: { id: true, rewardName: true, status: true, teacherNote: true, resolvedAt: true }
    });
    rewardSources = rows.flatMap((row) =>
      row.resolvedAt && (row.status === "delivered" || row.status === "rejected")
        ? [{ ...row, status: row.status, resolvedAt: row.resolvedAt }]
        : []
    );
  } catch (error) {
    console.error("[thong-bao] Không đọc được phiếu đổi quà:", error);
  }

  // Thưởng Học Bá tháng (sổ Xu) — bọc try/catch như các nguồn trên.
  let prizeSources: PrizeNotificationSource[] = [];
  try {
    prizeSources = await prisma.coinTransaction.findMany({
      where: { studentId, kind: "monthly_prize" },
      orderBy: { createdAt: "desc" },
      take: NOTIFICATION_LIMIT,
      select: { key: true, amount: true, note: true, createdAt: true }
    });
  } catch (error) {
    console.error("[thong-bao] Không đọc được thưởng Học Bá:", error);
  }

  // Theo dõi + cảm xúc (bảng mới) — bọc try/catch như các nguồn trên.
  let socialGroups: SocialNotificationGroup[] = [];
  try {
    const since = new Date(Date.now() - SOCIAL_WINDOW_MS);
    const [follows, reactions] = await Promise.all([
      prisma.follow.findMany({
        where: { followingId: studentId, createdAt: { gte: since } },
        orderBy: { createdAt: "desc" },
        take: SOCIAL_ROW_LIMIT,
        select: { followerId: true, createdAt: true, follower: { select: { displayName: true } } }
      }),
      prisma.profileReaction.findMany({
        where: { toId: studentId, createdAt: { gte: since } },
        orderBy: { createdAt: "desc" },
        take: SOCIAL_ROW_LIMIT,
        select: { fromId: true, kind: true, createdAt: true, from: { select: { displayName: true } } }
      })
    ]);
    socialGroups = groupSocialNotifications(
      follows.map((row) => ({ followerId: row.followerId, name: row.follower.displayName, createdAt: row.createdAt })),
      reactions.flatMap((row) =>
        isReactionKind(row.kind)
          ? [{ fromId: row.fromId, name: row.from.displayName, kind: row.kind, createdAt: row.createdAt }]
          : []
      )
    );
  } catch (error) {
    console.error("[thong-bao] Không đọc được theo dõi / cảm xúc:", error);
  }

  const items = buildStudentNotifications(
    reviews.map((review) => ({
      attemptId: review.attemptId,
      title: review.attempt.assignmentRecipient.assignment.title,
      overallBand: review.overallBand,
      reviewedAt: review.reviewedAt
    })),
    recipients.map((recipient) => ({
      recipientId: recipient.id,
      title: recipient.assignment.title,
      assignedAt: recipient.assignedAt
    })),
    student?.notificationsReadAt ?? null,
    bugs,
    scheduleSources,
    rewardSources,
    prizeSources,
    socialGroups
  );

  return { items, unreadCount: countUnread(items) };
}

// Dùng chung cho chuông (qua server action) và cho trang danh sách (gọi thẳng khi
// render, vì mở trang cũng tính là đã xem).
export async function touchNotificationsRead(studentId: string): Promise<void> {
  await prisma.studentProfile.update({
    where: { id: studentId },
    data: { notificationsReadAt: new Date() }
  });
}
