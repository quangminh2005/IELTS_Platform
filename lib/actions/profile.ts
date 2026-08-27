"use server";

import { del } from "@vercel/blob";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { actionFail, actionOk, type ActionResult } from "@/lib/action-result";
import { requireStudent } from "@/lib/actions/attempts";
import { requireTeacher } from "@/lib/actions/classes";
import { prisma } from "@/lib/prisma";
import {
  AVATAR_PRESET_KEYS,
  COVER_COLOR_KEYS,
  isAllowedAvatarUrl
} from "@/lib/student-avatar";

// Chuỗi rỗng trên form nghĩa là "bỏ trống", không phải chuỗi "".
function optional(value: FormDataEntryValue | null): string | null {
  const text = String(value ?? "").trim();
  return text.length > 0 ? text : null;
}

const bioSchema = z
  .string()
  .max(280, "Giới thiệu tối đa 280 ký tự.")
  .nullable();

const avatarUrlSchema = z
  .string()
  .refine(isAllowedAvatarUrl, "Ảnh đại diện phải là ảnh tải lên từ trang này.")
  .nullable();

const avatarPresetSchema = z
  .string()
  .refine((v) => AVATAR_PRESET_KEYS.includes(v), "Avatar không hợp lệ.")
  .nullable();

const coverColorSchema = z
  .string()
  .refine((v) => COVER_COLOR_KEYS.includes(v), "Màu bìa không hợp lệ.")
  .nullable();

// Mục tiêu band: 0–9, bước 0.5. Bỏ trống -> null.
const targetBandSchema = z
  .number()
  .min(0, "Mục tiêu band phải từ 0 đến 9.")
  .max(9, "Mục tiêu band phải từ 0 đến 9.")
  .refine((v) => Number.isInteger(v * 2), "Mục tiêu band phải là bội của 0.5.")
  .nullable();

function parseTargetBand(value: FormDataEntryValue | null): number | null {
  const text = optional(value);
  if (text === null) {
    return null;
  }
  const parsed = Number(text);
  if (Number.isNaN(parsed)) {
    throw new Error("Mục tiêu band phải là một con số.");
  }
  return parsed;
}

const decorationSchema = z.object({
  bio: bioSchema,
  avatarUrl: avatarUrlSchema,
  avatarPreset: avatarPresetSchema,
  coverColor: coverColorSchema,
  targetBand: targetBandSchema
});

function readDecoration(formData: FormData) {
  const parsed = decorationSchema.safeParse({
    bio: optional(formData.get("bio")),
    avatarUrl: optional(formData.get("avatarUrl")),
    avatarPreset: optional(formData.get("avatarPreset")),
    coverColor: optional(formData.get("coverColor")),
    targetBand: parseTargetBand(formData.get("targetBand"))
  });

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Thông tin hồ sơ chưa hợp lệ.");
  }

  return parsed.data;
}

// Xoá ảnh cũ trên Blob khi học viên đổi sang ảnh khác. Bọc try/catch: xoá hỏng thì
// chỉ còn một file rác (scripts/blob-orphans.mjs dọn được), không đáng để chặn việc
// lưu hồ sơ.
async function deleteOldAvatar(oldUrl: string | null, newUrl: string | null) {
  if (!oldUrl || oldUrl === newUrl || !isAllowedAvatarUrl(oldUrl)) {
    return;
  }

  try {
    await del(oldUrl);
  } catch {
    // Bỏ qua có chủ ý — xem chú thích trên.
  }
}

const teacherFieldsSchema = z.object({
  studentId: z.string().min(1, "Thiếu mã học viên."),
  displayName: z.string().min(1, "Tên học viên không được để trống."),
  email: z.string().email("Email không hợp lệ.")
});

// Học viên tự sửa hồ sơ của CHÍNH MÌNH. requireStudent() tra hồ sơ theo phiên đăng
// nhập và trả về bản ghi; id lấy từ đó, TUYỆT ĐỐI không lấy từ FormData.
export async function updateMyProfile(formData: FormData): Promise<ActionResult> {
  const student = await requireStudent(); // NGOÀI try: lỗi phân quyền ném ra như cũ

  try {
    const data = readDecoration(formData);

    await deleteOldAvatar(student.avatarUrl, data.avatarUrl);

    await prisma.studentProfile.update({
      where: { id: student.id },
      data
    });

    revalidatePath("/student/profile");
    revalidatePath("/student");
    revalidatePath("/student/ranking");
    return actionOk("Đã lưu hồ sơ.");
  } catch (error) {
    return actionFail(error, "Lưu hồ sơ");
  }
}

// Giáo viên sửa hồ sơ học viên trong lớp mình — sửa được cả tên và email.
export async function updateStudentProfile(formData: FormData): Promise<ActionResult> {
  const teacher = await requireTeacher();

  try {
    const fields = teacherFieldsSchema.safeParse({
      studentId: formData.get("studentId"),
      displayName: String(formData.get("displayName") ?? "").trim(),
      email: String(formData.get("email") ?? "").trim().toLowerCase()
    });

    if (!fields.success) {
      throw new Error(fields.error.issues[0]?.message ?? "Thông tin chưa hợp lệ.");
    }

    const decoration = readDecoration(formData);

    // Chốt chặn quyền: lọc NGAY TRONG where, không lấy ra rồi mới đối chiếu.
    const student = await prisma.studentProfile.findFirst({
      where: {
        id: fields.data.studentId,
        classes: { some: { class: { teacherId: teacher.id } } }
      },
      select: { id: true, email: true, userId: true, avatarUrl: true }
    });

    if (!student) {
      throw new Error("Không tìm thấy học viên này trong lớp của bạn.");
    }

    // Email là khoá nối tài khoản Google (lib/auth.ts). Học viên đã đăng nhập rồi
    // mà đổi email thì họ mất quyền vào toàn bộ bài cũ — chặn hẳn, báo rõ lý do.
    if (fields.data.email !== student.email && student.userId !== null) {
      throw new Error(
        "Học viên này đã đăng nhập bằng Google nên không đổi được email — đổi sẽ làm mất toàn bộ bài đã làm. Hãy xoá học viên rồi thêm lại bằng email mới nếu thật sự cần."
      );
    }

    const duplicate = await prisma.studentProfile.findFirst({
      where: { email: fields.data.email, id: { not: student.id } },
      select: { id: true }
    });

    if (duplicate) {
      throw new Error("Email này đã thuộc về một học viên khác.");
    }

    await deleteOldAvatar(student.avatarUrl, decoration.avatarUrl);

    await prisma.studentProfile.update({
      where: { id: student.id },
      data: {
        displayName: fields.data.displayName,
        email: fields.data.email,
        ...decoration
      }
    });

    revalidatePath(`/teacher/students/${student.id}`);
    revalidatePath("/teacher/classes");
    revalidatePath("/teacher");
    return actionOk(`Đã lưu hồ sơ của "${fields.data.displayName}".`);
  } catch (error) {
    return actionFail(error, "Lưu hồ sơ học viên");
  }
}
