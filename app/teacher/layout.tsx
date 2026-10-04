import { AppShell } from "@/components/app-shell";
import { ToastProvider } from "@/components/toast";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Số đỏ cạnh "Đổi quà" = phiếu học viên đổi đang chờ thầy trao. Layout chạy trên
// MỌI trang thầy nên chỉ một lệnh count; lỗi (bảng chưa kịp tạo…) thì bỏ số đỏ.
// auth() để NGOÀI try/catch: nó đọc cookie và ném tín hiệu "trang động" của Next lúc
// build — nuốt mất tín hiệu đó thì Next tưởng trang tĩnh được.
async function pendingRedemptionCount(): Promise<number> {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "teacher") return 0;

  try {
    return await prisma.rewardRedemption.count({
      where: { status: "pending", reward: { teacher: { userId: session.user.id } } }
    });
  } catch (error) {
    console.error("[doi-qua] Không đếm được phiếu chờ:", error);
    return 0;
  }
}

export default async function TeacherLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  const pending = await pendingRedemptionCount();

  return (
    <ToastProvider>
      <AppShell role="teacher" navBadges={pending > 0 ? { "/teacher/rewards": pending } : undefined}>
        {children}
      </AppShell>
    </ToastProvider>
  );
}
