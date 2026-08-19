"use server";

import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { requireTeacher } from "@/lib/actions/classes";
import { actionFail, actionOk, type ActionResult } from "@/lib/action-result";
import { prisma } from "@/lib/prisma";

// Link báo cáo cho phụ huynh. Không có email, không gửi mail — giáo viên tạo link
// rồi tự đưa cho phụ huynh qua Zalo/tin nhắn, cách họ vẫn dùng hằng ngày.

// Mã bí mật của link. 24 byte ngẫu nhiên -> 32 ký tự base64url, đủ dài để không
// ai dò được bằng cách thử.
function newParentToken(): string {
  return randomBytes(24).toString("base64url");
}

// Chỉ tìm học viên NẰM TRONG lớp của chính giáo viên đang đăng nhập — không tin
// studentId gửi lên từ form.
async function findOwnedStudent(teacherId: string, studentId: string) {
  const student = await prisma.studentProfile.findFirst({
    where: {
      id: studentId,
      classes: { some: { class: { teacherId } } }
    },
    select: { id: true, displayName: true, parentToken: true }
  });

  if (!student) {
    throw new Error("Không tìm thấy học viên trong lớp của bạn.");
  }

  return student;
}

function readStudentId(formData: FormData): string {
  const studentId = String(formData.get("studentId") ?? "").trim();

  if (!studentId) {
    throw new Error("Thiếu mã học viên.");
  }

  return studentId;
}

export async function createParentLink(formData: FormData): Promise<ActionResult> {
  const teacher = await requireTeacher(); // NGOÀI try: lỗi phân quyền ném ra như cũ

  try {
    const student = await findOwnedStudent(teacher.id, readStudentId(formData));

    // Đã có link thì giữ nguyên — bấm nhầm hai lần không được đổi mã, vì đổi mã
    // là làm chết link phụ huynh đang dùng.
    if (student.parentToken) {
      return actionOk("Học viên này đã có link báo cáo.");
    }

    await prisma.studentProfile.update({
      where: { id: student.id },
      data: { parentToken: newParentToken() }
    });

    revalidatePath(`/teacher/students/${student.id}`);

    return actionOk("Đã tạo link báo cáo cho phụ huynh.");
  } catch (error) {
    return actionFail(error, "Tạo link báo cáo");
  }
}

export async function regenerateParentToken(formData: FormData): Promise<ActionResult> {
  const teacher = await requireTeacher();

  try {
    const student = await findOwnedStudent(teacher.id, readStudentId(formData));

    await prisma.studentProfile.update({
      where: { id: student.id },
      data: { parentToken: newParentToken() }
    });

    revalidatePath(`/teacher/students/${student.id}`);

    return actionOk("Đã tạo link mới. Link cũ không dùng được nữa.");
  } catch (error) {
    return actionFail(error, "Tạo lại link");
  }
}

export async function removeParentLink(formData: FormData): Promise<ActionResult> {
  const teacher = await requireTeacher();

  try {
    const student = await findOwnedStudent(teacher.id, readStudentId(formData));

    await prisma.studentProfile.update({
      where: { id: student.id },
      data: { parentToken: null }
    });

    revalidatePath(`/teacher/students/${student.id}`);

    return actionOk("Đã thu hồi link. Phụ huynh không xem được nữa.");
  } catch (error) {
    return actionFail(error, "Thu hồi link");
  }
}
