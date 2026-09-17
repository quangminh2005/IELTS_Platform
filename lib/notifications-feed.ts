import {
  buildStudentNotifications,
  countUnread,
  NOTIFICATION_LIMIT,
  type BugResolvedNotificationSource,
  type StudentNotification
} from "@/lib/notifications";
import { excludePracticeAssignment } from "@/lib/practice";
import { prisma } from "@/lib/prisma";

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
    bugs
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
