import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Người dùng bảng tin (Mạng xã hội Đợt 3): học viên HOẶC thầy. Mọi action ở
// lib/actions/feed.ts gọi hàm này đầu tiên. Nằm ngoài file "use server" để không bị
// lộ thành server action gọi được từ trình duyệt.
export type FeedUser = { userId: string; role: "teacher" | "student"; studentId: string | null };

export async function requireFeedUser(): Promise<FeedUser> {
  const session = await auth();
  const user = session?.user;

  if (!user?.id || (user.role !== "teacher" && user.role !== "student")) {
    throw new Error("Cần đăng nhập để dùng bảng tin.");
  }

  if (user.role === "teacher") {
    return { userId: user.id, role: "teacher", studentId: null };
  }

  const student = await prisma.studentProfile.findUnique({ where: { userId: user.id }, select: { id: true } });
  if (!student) {
    throw new Error("Student profile required.");
  }

  return { userId: user.id, role: "student", studentId: student.id };
}
