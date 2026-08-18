import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getStudentNotifications, touchNotificationsRead } from "@/lib/notifications-feed";
import {
  NotificationEmpty,
  NotificationRow,
  type NotificationFeedItem
} from "@/components/notification-list";

export const dynamic = "force-dynamic";

export default async function StudentNotificationsPage() {
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

  const { items } = await getStudentNotifications(student.id);

  // Mở trang này cũng tính là đã xem. Phải đặt SAU khi đã lấy items, nếu không mọi
  // mục đều thành "đã đọc" ngay trong lần hiển thị đầu tiên.
  await touchNotificationsRead(student.id);

  const feedItems: NotificationFeedItem[] = items.map((item) => ({
    ...item,
    createdAt: item.createdAt.toISOString()
  }));

  return (
    <div className="grid gap-5">
      <header className="grid gap-1">
        <h1 className="text-2xl font-semibold">Thông báo</h1>
        <p className="text-sm text-muted-foreground">
          Bài đã chấm xong và bài mới được giao, mới nhất lên đầu.
        </p>
      </header>

      <section className="rounded-xl border border-border bg-card p-2">
        {feedItems.length > 0 ? (
          <div className="grid gap-1">
            {feedItems.map((item) => (
              <NotificationRow key={item.id} item={item} />
            ))}
          </div>
        ) : (
          <NotificationEmpty />
        )}
      </section>
    </div>
  );
}
