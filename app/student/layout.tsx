import { AppShell } from "@/components/app-shell";
import { ToastProvider } from "@/components/toast";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function StudentLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth();

  // Chỉ lấy đúng bốn cột cần để vẽ avatar — layout chạy trên MỌI trang của học
  // viên nên truy vấn phải nhẹ.
  const student = session?.user?.id
    ? await prisma.studentProfile.findUnique({
        where: { userId: session.user.id },
        select: {
          displayName: true,
          avatarUrl: true,
          avatarPreset: true,
          user: { select: { image: true } }
        }
      })
    : null;

  return (
    <ToastProvider>
      <AppShell
        role="student"
        studentAvatar={
          student
            ? {
                displayName: student.displayName,
                avatarUrl: student.avatarUrl,
                avatarPreset: student.avatarPreset,
                userImage: student.user?.image ?? null
              }
            : undefined
        }
      >
        {children}
      </AppShell>
    </ToastProvider>
  );
}
