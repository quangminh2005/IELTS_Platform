"use server";

import { requireStudent } from "@/lib/actions/attempts";
import { touchNotificationsRead } from "@/lib/notifications-feed";

// Học viên mở chuông = đã xem. Không revalidatePath: số đếm do chuông tự lấy qua
// API, revalidate chỉ làm trang đang xem nhấp nháy vô ích.
export async function markNotificationsRead(): Promise<void> {
  const student = await requireStudent();

  await touchNotificationsRead(student.id);
}
