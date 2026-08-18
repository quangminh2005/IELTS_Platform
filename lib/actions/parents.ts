"use server";

import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireTeacher } from "@/lib/actions/classes";
import { actionFail, actionOk, type ActionResult } from "@/lib/action-result";
import { resolveAppUrl } from "@/lib/app-url";
import { isEmailConfigured, sendEmail } from "@/lib/email";
import { buildParentSummary, type ParentPeriod } from "@/lib/parent-report";
import { buildParentReportEmail } from "@/lib/parent-report-email";
import { loadParentReportItems } from "@/lib/parent-report-query";
import { prisma } from "@/lib/prisma";

// Mã bí mật của link báo cáo. 24 byte ngẫu nhiên -> 32 ký tự base64url, đủ dài để
// không ai dò được bằng cách thử.
function newParentToken(): string {
  return randomBytes(24).toString("base64url");
}

const contactSchema = z.object({
  studentId: z.string().min(1, "Thiếu mã học viên."),
  parentName: z.string().trim().max(120, "Tên phụ huynh quá dài."),
  parentEmail: z
    .string()
    .trim()
    .max(200, "Email quá dài.")
    .refine(
      (value) => value === "" || z.string().email().safeParse(value).success,
      "Email phụ huynh chưa hợp lệ."
    )
});

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

export async function saveParentContact(formData: FormData): Promise<ActionResult> {
  const teacher = await requireTeacher(); // NGOÀI try: lỗi phân quyền ném ra như cũ

  try {
    const parsed = contactSchema.safeParse({
      studentId: formData.get("studentId"),
      parentName: formData.get("parentName") ?? "",
      parentEmail: formData.get("parentEmail") ?? ""
    });

    if (!parsed.success) {
      throw new Error(parsed.error.issues[0]?.message ?? "Thông tin phụ huynh chưa hợp lệ.");
    }

    const student = await findOwnedStudent(teacher.id, parsed.data.studentId);
    const email = parsed.data.parentEmail;
    const name = parsed.data.parentName;

    await prisma.studentProfile.update({
      where: { id: student.id },
      data: {
        parentEmail: email === "" ? null : email,
        parentName: name === "" ? null : name,
        // Có email mà chưa có link thì sinh link luôn. Xoá email KHÔNG xoá token,
        // để nhập lại email là link cũ dùng tiếp được.
        parentToken: student.parentToken ?? (email === "" ? null : newParentToken())
      }
    });

    revalidatePath(`/teacher/students/${student.id}`);

    return actionOk(
      email === "" ? "Đã tắt báo cáo cho phụ huynh." : "Đã lưu liên hệ phụ huynh."
    );
  } catch (error) {
    return actionFail(error, "Lưu liên hệ phụ huynh");
  }
}

export async function regenerateParentToken(formData: FormData): Promise<ActionResult> {
  const teacher = await requireTeacher();

  try {
    const studentId = String(formData.get("studentId") ?? "").trim();

    if (!studentId) {
      throw new Error("Thiếu mã học viên.");
    }

    const student = await findOwnedStudent(teacher.id, studentId);

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

export async function sendParentReportNow(formData: FormData): Promise<ActionResult> {
  const teacher = await requireTeacher();

  try {
    if (!isEmailConfigured()) {
      throw new Error("Chưa cấu hình GMAIL_USER / GMAIL_APP_PASSWORD.");
    }

    const studentId = String(formData.get("studentId") ?? "").trim();
    const period: ParentPeriod = formData.get("period") === "month" ? "month" : "week";

    if (!studentId) {
      throw new Error("Thiếu mã học viên.");
    }

    // Chặn quyền trước, rồi mới đọc thêm các cột cần cho mail.
    await findOwnedStudent(teacher.id, studentId);

    const student = await prisma.studentProfile.findUnique({
      where: { id: studentId },
      select: {
        displayName: true,
        parentEmail: true,
        parentName: true,
        parentToken: true
      }
    });

    if (!student?.parentEmail?.trim() || !student.parentToken) {
      throw new Error("Học viên này chưa có email phụ huynh.");
    }

    const items = await loadParentReportItems(studentId);
    const summary = buildParentSummary(items, new Date(), period);
    const mail = buildParentReportEmail({
      studentName: student.displayName,
      parentName: student.parentName,
      summary,
      link: `${resolveAppUrl()}/ph/${student.parentToken}`
    });

    await sendEmail(student.parentEmail, mail.subject, mail.html, mail.text);

    // CỐ TÌNH không cập nhật parentReportSentAt: gửi tay không được làm lỡ mail
    // tự động trưa Chủ nhật.
    return actionOk(`Đã gửi báo cáo tới ${student.parentEmail}.`);
  } catch (error) {
    return actionFail(error, "Gửi báo cáo");
  }
}
