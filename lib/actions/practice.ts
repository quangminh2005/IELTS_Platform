"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireStudent } from "@/lib/actions/attempts";
import { PRACTICE_MODE, practiceScopeKey, practiceSkillTimeLimits } from "@/lib/practice";
import { prisma } from "@/lib/prisma";

const startPracticeSchema = z.object({
  materialId: z.string().trim().min(1, "Thiếu đề luyện."),
  // Rỗng = luyện cả đề.
  unitId: z.string().trim().optional(),
  timed: z.enum(["0", "1"])
});

// Học viên bấm luyện một đề (hoặc một phần). Tạo ngầm "bài giao ảo" cho riêng em đó
// rồi chuyển thẳng vào phòng làm bài quen thuộc. Gọi lại lần sau sẽ dùng lại đúng bài
// giao ảo cũ — startAttempt lo việc mở lượt mới.
export async function startPractice(formData: FormData): Promise<never> {
  const student = await requireStudent();
  const parsed = startPracticeSchema.safeParse({
    materialId: formData.get("materialId"),
    unitId: formData.get("unitId") ?? undefined,
    timed: formData.get("timed")
  });

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ.");
  }

  const unitId = parsed.data.unitId && parsed.data.unitId.length > 0 ? parsed.data.unitId : null;

  // Chặn học viên đoán URL để mở đề giáo viên đang để dành làm bài kiểm tra.
  const material = await prisma.material.findFirst({
    where: { id: parsed.data.materialId, practiceOpen: true },
    select: {
      id: true,
      title: true,
      teacherId: true,
      units: {
        orderBy: [{ unitNumber: "asc" }, { createdAt: "asc" }],
        select: {
          id: true,
          title: true,
          skill: true,
          defaultTimeLimitMinutes: true
        }
      }
    }
  });

  if (!material) {
    throw new Error("Đề này không có trong thư viện tự luyện.");
  }

  const units = unitId ? material.units.filter((unit) => unit.id === unitId) : material.units;

  if (units.length === 0) {
    throw new Error("Không tìm thấy phần cần luyện.");
  }

  const scopeKey = practiceScopeKey(student.id, material.id, unitId);
  const skillTimeLimitsJson = practiceSkillTimeLimits(units, parsed.data.timed === "1");
  const title = unitId ? `${material.title} — ${units[0].title}` : material.title;

  const existing = await prisma.assignment.findUnique({
    where: { practiceScopeKey: scopeKey },
    select: { id: true, recipients: { where: { studentId: student.id }, select: { id: true } } }
  });

  const existingRecipientId = existing?.recipients[0]?.id;

  if (existing && existingRecipientId) {
    // Lượt luyện mới có thể chọn chế độ giờ khác lượt trước — cập nhật lại.
    await prisma.assignment.update({
      where: { id: existing.id },
      data: { skillTimeLimitsJson }
    });

    redirect(`/student/assignments/${existingRecipientId}`);
  }

  const recipientId = await prisma.$transaction(async (tx) => {
    const assignment = await tx.assignment.create({
      data: {
        teacherId: material.teacherId,
        classId: null,
        title,
        deadline: null,
        skillTimeLimitsJson,
        mode: PRACTICE_MODE,
        practiceScopeKey: scopeKey,
        units: {
          create: units.map((unit, index) => ({
            assignableUnitId: unit.id,
            order: index
          }))
        }
      },
      select: { id: true }
    });

    const recipient = await tx.assignmentRecipient.create({
      data: {
        assignmentId: assignment.id,
        studentId: student.id
      },
      select: { id: true }
    });

    return recipient.id;
  });

  redirect(`/student/assignments/${recipientId}`);
}
