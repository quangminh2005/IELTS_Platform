import { NextResponse } from "next/server";
import { requireStudent } from "@/lib/actions/attempts";
import { warmUpDatabase } from "@/lib/db-warmup";
import { getStudentNotifications } from "@/lib/notifications-feed";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Chuông hỏng KHÔNG được phép làm vỡ giao diện học viên: mọi lỗi đều trả về "không
// có thông báo nào" kèm HTTP 200, lỗi thật thì ghi log để còn dò.
const EMPTY = { items: [], unreadCount: 0 };

export async function GET(): Promise<NextResponse> {
  // Đánh thức Neon TRƯỚC khi kiểm đăng nhập: requireStudent cũng truy vấn DB, để
  // nó chết vì DB đang ngủ thì học viên đang đăng nhập hẳn hoi lại bị 401.
  try {
    await warmUpDatabase(() => prisma.$queryRaw`SELECT 1`);
  } catch (error) {
    console.error("[thong-bao] DB chưa sẵn sàng:", error);
    return NextResponse.json(EMPTY);
  }

  let studentId: string;

  try {
    studentId = (await requireStudent()).id;
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    return NextResponse.json(await getStudentNotifications(studentId));
  } catch (error) {
    console.error("[thong-bao] Không lấy được danh sách:", error);
    return NextResponse.json(EMPTY);
  }
}
