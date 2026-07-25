import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { requireTeacher } from "@/lib/actions/classes";

// Guard cho các TRANG giáo viên: chưa đăng nhập (hoặc không phải giáo viên) thì
// đưa về trang đăng nhập, thay vì ném lỗi ra màn hình "Application error".
//
// Server action vẫn dùng requireTeacher() — ở đó ném lỗi mới đúng, vì action
// không có gì để điều hướng và lỗi phân quyền cần nổi lên chứ không im lặng.
export async function requireTeacherPage() {
  const session = await auth();

  if (!session?.user?.id || session.user.role !== "teacher") {
    redirect("/login");
  }

  // Đã chắc chắn là giáo viên; gọi lại để lấy (hoặc tạo lần đầu) TeacherProfile.
  return requireTeacher();
}
