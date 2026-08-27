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

type Decoration = z.infer<typeof decorationSchema>;

// Học viên gửi đủ cả 5 trường mỗi lần lưu (form trang hồ sơ luôn có sẵn cả 5 ô) —
// nên ở đây "vắng mặt trên FormData" == "" == "muốn xoá trắng" là đúng ý đồ (đây là
// cách nút "Xoá ảnh" và xoá bio hoạt động).
function readDecoration(formData: FormData): Decoration {
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

function parseFieldOrThrow<T>(schema: z.ZodType<T>, raw: unknown): T {
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Thông tin hồ sơ chưa hợp lệ.");
  }
  return parsed.data;
}

// Biến thể của readDecoration dành riêng cho giáo viên. Form giáo viên thường CHỈ
// gửi vài trường (vd. chỉ studentId/displayName/email), không gửi đủ cả 5 trường
// trang trí như form học viên. Nếu hiểu "vắng mặt" là "xoá trắng" như readDecoration
// thì một lần lưu tên/email vô tình xoá sạch bio/avatar/coverColor/targetBand của
// học viên — và deleteOldAvatar() sẽ xoá luôn ảnh đã tải lên trên Blob, không cứu
// được. Nên ở đây dùng formData.has(...): trường nào KHÔNG có mặt trên form thì bỏ
// qua hẳn, không đưa khoá đó vào object trả về (không phải gán undefined — Prisma
// vẫn có thể hiểu undefined-nhưng-có-khoá theo cách khác nhau tuỳ phiên bản).
function readDecorationPatch(formData: FormData): Partial<Decoration> {
  const patch: Partial<Decoration> = {};

  if (formData.has("bio")) {
    patch.bio = parseFieldOrThrow(bioSchema, optional(formData.get("bio")));
  }
  if (formData.has("avatarUrl")) {
    patch.avatarUrl = parseFieldOrThrow(avatarUrlSchema, optional(formData.get("avatarUrl")));
  }
  if (formData.has("avatarPreset")) {
    patch.avatarPreset = parseFieldOrThrow(
      avatarPresetSchema,
      optional(formData.get("avatarPreset"))
    );
  }
  if (formData.has("coverColor")) {
    patch.coverColor = parseFieldOrThrow(
      coverColorSchema,
      optional(formData.get("coverColor"))
    );
  }
  if (formData.has("targetBand")) {
    patch.targetBand = parseFieldOrThrow(targetBandSchema, parseTargetBand(formData.get("targetBand")));
  }

  return patch;
}

// LƯU Ý: đây là chốt PHỤ (advisory) — kiểm-rồi-ghi (check-then-write), không có
// ràng buộc UNIQUE nào đứng sau trong schema nên vẫn có khe hẹp (race) giữa lúc
// kiểm và lúc ghi. Chốt THẬT khiến deleteOldAvatar() an toàn là tiền tố avatars/
// bắt buộc trong isAllowedAvatarUrl (lib/student-avatar.ts) — chốt đó đảm bảo dù
// avatarUrl trỏ tới file của ai, nó chỉ có thể là một file avatar, không bao giờ
// là audio Listening hay ảnh tài liệu. Hàm dưới đây chỉ để tránh học viên A vô
// tình/cố ý "mượn" đúng avatar học viên B đang dùng, không phải để chống xoá
// nhầm file quan trọng.
//
// Avatar hiện công khai trên bảng xếp hạng của lớp. Không có chốt này, một học viên
// đọc được URL Blob ảnh của bạn học (vốn công khai) có thể dán URL đó vào ô avatarUrl
// của chính mình. Lần đổi avatar SAU ĐÓ sẽ khiến deleteOldAvatar() xoá thẳng ảnh của
// người kia trên Blob, không khôi phục được. Chặn bằng một truy vấn: URL mới không
// được trùng avatarUrl của bất kỳ StudentProfile nào khác.
async function assertAvatarUrlNotTaken(newUrl: string | null, ownerId: string) {
  if (!newUrl) {
    return;
  }

  const taken = await prisma.studentProfile.findFirst({
    where: { avatarUrl: newUrl, id: { not: ownerId } },
    select: { id: true }
  });

  if (taken) {
    throw new Error("Ảnh đại diện này đang thuộc về một học viên khác.");
  }
}

// Xoá ảnh cũ trên Blob khi học viên đổi sang ảnh khác. Bọc try/catch: xoá hỏng thì
// chỉ còn một file rác (scripts/blob-orphans.mjs dọn được), không đáng để chặn việc
// lưu hồ sơ. LUÔN gọi hàm này SAU KHI ghi DB thành công (không phải trước) — nếu gọi
// trước và việc ghi DB sau đó thất bại, ảnh cũ đã mất trong khi hồ sơ vẫn trỏ tới nó.
//
// isAllowedAvatarUrl(oldUrl) là chốt AN TOÀN bắt buộc, không phải chốt hợp lệ dữ
// liệu thông thường: nó khoá oldUrl phải nằm dưới avatars/ trước khi cho phép
// del(). Tuyệt đối KHÔNG được nới lỏng hay bỏ điều kiện này — thà bỏ qua, để lại
// một file rác (dọn được bằng scripts/blob-orphans.mjs), còn hơn xoá nhầm file
// không phải avatar (vd. audio Listening) mà không có cách khôi phục.
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

    await assertAvatarUrlNotTaken(data.avatarUrl, student.id);

    await prisma.studentProfile.update({
      where: { id: student.id },
      data
    });

    // Xoá ảnh cũ SAU KHI ghi DB thành công — xem chú thích trên deleteOldAvatar().
    await deleteOldAvatar(student.avatarUrl, data.avatarUrl);

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

    // Chỉ trường nào giáo viên THỰC SỰ gửi lên mới bị ghi đè — xem chú thích trên
    // readDecorationPatch(). Form giáo viên có thể chỉ gửi tên/email, không gửi đủ
    // 5 trường trang trí như form học viên.
    const decoration = readDecorationPatch(formData);

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

    if ("avatarUrl" in decoration) {
      await assertAvatarUrlNotTaken(decoration.avatarUrl ?? null, student.id);
    }

    await prisma.studentProfile.update({
      where: { id: student.id },
      data: {
        displayName: fields.data.displayName,
        email: fields.data.email,
        ...decoration
      }
    });

    // Xoá ảnh cũ SAU KHI ghi DB thành công (xem chú thích trên deleteOldAvatar()).
    // Chỉ có "ảnh mới" khi giáo viên thực sự gửi trường avatarUrl — nếu form không
    // gửi trường này thì avatar không đổi, không có gì để xoá.
    if ("avatarUrl" in decoration) {
      await deleteOldAvatar(student.avatarUrl, decoration.avatarUrl ?? null);
    }

    revalidatePath(`/teacher/students/${student.id}`);
    revalidatePath("/teacher/classes");
    revalidatePath("/teacher");
    return actionOk(`Đã lưu hồ sơ của "${fields.data.displayName}".`);
  } catch (error) {
    return actionFail(error, "Lưu hồ sơ học viên");
  }
}
