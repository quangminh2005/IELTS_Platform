"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { actionFail, actionOk, type ActionResult } from "@/lib/action-result";
import { requireStudent } from "@/lib/actions/attempts";
import { requireTeacher } from "@/lib/actions/classes";
import { resolveAppUrl } from "@/lib/app-url";
import {
  BUG_CATEGORY_VALUES,
  BUG_DESCRIPTION_MAX,
  BUG_TEACHER_NOTE_MAX,
  bugCategoryLabel,
  buildBugReportEmail,
  describeDevice,
  formatBugContext,
  isAllowedBugImageUrl,
  isOverDailyLimit,
  parseBugContext
} from "@/lib/bug-report";
import { isEmailConfigured, sendEmail } from "@/lib/email";
import { prisma } from "@/lib/prisma";

// Chuỗi rỗng trên form nghĩa là "bỏ trống".
function optional(value: FormDataEntryValue | null): string | null {
  const text = String(value ?? "").trim();
  return text.length > 0 ? text : null;
}

const createSchema = z.object({
  // zod v4: tham số `error` thay cho errorMap cũ.
  category: z.enum(BUG_CATEGORY_VALUES, { error: "Hãy chọn loại lỗi." }),
  description: z
    .string()
    .trim()
    .min(1, "Hãy mô tả lỗi bạn gặp.")
    .max(BUG_DESCRIPTION_MAX, `Mô tả tối đa ${BUG_DESCRIPTION_MAX} ký tự.`),
  imageUrl: z
    .string()
    .refine(isAllowedBugImageUrl, "Ảnh phải là ảnh tải lên từ trang này.")
    .nullable(),
  pageUrl: z
    .string()
    .trim()
    .min(1, { error: "Đường dẫn trang chưa hợp lệ." })
    .max(500, { error: "Đường dẫn trang chưa hợp lệ." }),
  userAgent: z.string().max(500, { error: "Thông tin trình duyệt chưa hợp lệ." }).nullable(),
  viewport: z.string().max(20, { error: "Thông tin màn hình chưa hợp lệ." }).nullable(),
  attemptId: z.string().max(40, { error: "Mã bài làm chưa hợp lệ." }).nullable(),
  contextJson: z.string().max(500, { error: "Thông tin ngữ cảnh chưa hợp lệ." }).nullable()
});

// Phạm vi của giáo viên: báo lỗi của học viên đang thuộc ít nhất một lớp mình dạy.
function teacherScope(teacherId: string) {
  return { student: { classes: { some: { class: { teacherId } } } } };
}

const DAY_MS = 24 * 60 * 60 * 1000;

// Gửi mail báo lỗi cho giáo viên. KHÔNG dùng email đăng nhập của TeacherProfile:
// trên prod đó là địa chỉ demo (teacher@example.com) — Gmail trả thư về ngay
// (đã xảy ra 17/9/2026). Người nhận là BUG_REPORT_TO (nếu đặt, cách nhau bằng
// dấu phẩy), không thì chính hộp thư GMAIL_USER đang dùng để gửi — với lớp một
// giáo viên thì đó chính là Gmail của cô/thầy. Lỗi mail chỉ ghi log: học viên đã
// lưu xong thì phải thấy "Đã gửi".
function bugReportRecipients(): string | null {
  const configured = process.env.BUG_REPORT_TO?.trim();
  if (configured) {
    return configured;
  }
  const sender = process.env.GMAIL_USER?.trim();
  return sender ? sender : null;
}

async function notifyTeachers(report: {
  studentName: string;
  category: string;
  description: string;
  createdAt: Date;
  pageUrl: string;
  userAgent: string | null;
  viewport: string | null;
  contextJson: string | null;
  imageUrl: string | null;
}): Promise<void> {
  if (!isEmailConfigured()) {
    return;
  }

  const to = bugReportRecipients();
  if (!to) {
    return;
  }

  const mail = buildBugReportEmail({
    studentName: report.studentName,
    categoryLabel: bugCategoryLabel(report.category),
    description: report.description,
    createdAt: report.createdAt,
    pageUrl: report.pageUrl,
    device: describeDevice(report.userAgent),
    viewport: report.viewport,
    contextLine: formatBugContext(parseBugContext(report.contextJson)),
    imageUrl: report.imageUrl,
    appUrl: resolveAppUrl()
  });

  await sendEmail(to, mail.subject, mail.html, mail.text);
}

export async function createBugReport(formData: FormData): Promise<ActionResult> {
  const student = await requireStudent(); // NGOÀI try: lỗi phân quyền ném ra như cũ

  try {
    const parsed = createSchema.safeParse({
      category: optional(formData.get("category")),
      description: String(formData.get("description") ?? ""),
      imageUrl: optional(formData.get("imageUrl")),
      pageUrl: optional(formData.get("pageUrl")) ?? "/student",
      userAgent: optional(formData.get("userAgent")),
      viewport: optional(formData.get("viewport")),
      attemptId: optional(formData.get("attemptId")),
      contextJson: optional(formData.get("contextJson"))
    });

    if (!parsed.success) {
      throw new Error(parsed.error.issues[0]?.message ?? "Nội dung báo lỗi chưa hợp lệ.");
    }

    const recent = await prisma.bugReport.count({
      where: { studentId: student.id, createdAt: { gte: new Date(Date.now() - DAY_MS) } }
    });
    if (isOverDailyLimit(recent)) {
      throw new Error("Bạn đã gửi quá nhiều báo lỗi trong 24 giờ qua. Hãy chờ rồi gửi lại.");
    }

    const created = await prisma.bugReport.create({
      data: { studentId: student.id, ...parsed.data }
    });

    try {
      await notifyTeachers({ studentName: student.displayName, ...created });
    } catch (error) {
      console.error("[bao-loi] Không gửi được mail cho giáo viên:", error);
    }

    revalidatePath("/student/bugs");
    revalidatePath("/teacher/bugs");
    revalidatePath("/teacher");

    return actionOk("Đã gửi báo lỗi. Cô/thầy sẽ xem sớm.");
  } catch (error) {
    return actionFail(error, "Gửi báo lỗi");
  }
}

const resolveSchema = z.object({
  id: z.string().min(1),
  teacherNote: z
    .string()
    .trim()
    .max(BUG_TEACHER_NOTE_MAX, `Phản hồi tối đa ${BUG_TEACHER_NOTE_MAX} ký tự.`)
    .nullable()
});

export async function resolveBugReport(formData: FormData): Promise<ActionResult> {
  const teacher = await requireTeacher(); // NGOÀI try: lỗi phân quyền ném ra như cũ

  try {
    const parsed = resolveSchema.safeParse({
      id: optional(formData.get("id")),
      teacherNote: optional(formData.get("teacherNote"))
    });
    if (!parsed.success) {
      throw new Error(parsed.error.issues[0]?.message ?? "Dữ liệu chưa hợp lệ.");
    }

    // updateMany + where có scope: không tìm thấy (hoặc không thuộc lớp mình) thì
    // count = 0, không lộ báo lỗi của học viên lớp khác.
    const result = await prisma.bugReport.updateMany({
      where: { id: parsed.data.id, ...teacherScope(teacher.id) },
      data: { status: "resolved", resolvedAt: new Date(), teacherNote: parsed.data.teacherNote }
    });
    if (result.count === 0) {
      throw new Error("Không tìm thấy báo lỗi này.");
    }

    revalidatePath("/teacher/bugs");
    revalidatePath("/teacher");
    revalidatePath("/student/bugs");

    return actionOk("Đã đánh dấu xử lý.");
  } catch (error) {
    return actionFail(error, "Đánh dấu xử lý");
  }
}

export async function reopenBugReport(formData: FormData): Promise<ActionResult> {
  const teacher = await requireTeacher(); // NGOÀI try: lỗi phân quyền ném ra như cũ

  try {
    const id = optional(formData.get("id"));
    if (!id) {
      throw new Error("Thiếu mã báo lỗi.");
    }

    const result = await prisma.bugReport.updateMany({
      where: { id, ...teacherScope(teacher.id) },
      data: { status: "open", resolvedAt: null }
    });
    if (result.count === 0) {
      throw new Error("Không tìm thấy báo lỗi này.");
    }

    revalidatePath("/teacher/bugs");
    revalidatePath("/teacher");
    revalidatePath("/student/bugs");

    return actionOk("Đã mở lại báo lỗi.");
  } catch (error) {
    return actionFail(error, "Mở lại");
  }
}
