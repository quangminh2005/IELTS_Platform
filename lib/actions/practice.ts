"use server";

import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { requireStudent } from "@/lib/actions/attempts";
import { PRACTICE_MODE, decideAttemptStart, practiceScopeKey, practiceSkillTimeLimits } from "@/lib/practice";
import { prisma } from "@/lib/prisma";

const startPracticeSchema = z.object({
  materialId: z.string().trim().min(1, "Thiếu đề luyện."),
  // Rỗng = luyện cả đề.
  unitId: z.string().trim().optional(),
  timed: z.enum(["0", "1"])
});

// Học viên bấm luyện một đề (hoặc một phần). Tạo ngầm "bài giao ảo" cho riêng em đó
// (nếu chưa có) rồi TỰ quyết định mở lượt mới hay tiếp tục lượt đang dở — đây là nơi
// duy nhất được phép mở lượt tự luyện mới, vì ý định của học viên rõ ràng (một request
// POST do bấm nút, không phải tác dụng phụ của việc mở trang như startAttempt).
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

  const existingAssignment = await prisma.assignment.findUnique({
    where: { practiceScopeKey: scopeKey },
    select: { id: true }
  });

  let assignmentId: string;

  if (existingAssignment) {
    assignmentId = existingAssignment.id;
  } else {
    // skillTimeLimitsJson của lượt đầu tiên được set luôn ở nhánh "tạo lượt mới" bên
    // dưới (mọi assignment vừa tạo đều chưa có Attempt nào => decideAttemptStart luôn
    // trả "new") — ở đây chỉ cần tạo khung Assignment, chưa cần set giờ.
    try {
      const created = await prisma.assignment.create({
        data: {
          teacherId: material.teacherId,
          classId: null,
          title,
          deadline: null,
          mode: PRACTICE_MODE,
          practiceScopeKey: scopeKey,
          units: {
            create: units.map((unit, index) => ({
              assignableUnitId: unit.id,
              order: index + 1
            }))
          }
        },
        select: { id: true }
      });

      assignmentId = created.id;
    } catch (error) {
      // Bấm nút "Luyện" hai lần gần như đồng thời: cả hai request cùng không thấy
      // assignment (findUnique ở trên chưa kịp thấy bản ghi của nhau) nên cùng cố
      // tạo — request thứ hai đụng ràng buộc unique practiceScopeKey và Prisma ném
      // P2002. Coi như request kia đã tạo xong, đọc lại rồi đi tiếp bình thường thay
      // vì để lỗi Prisma thô văng ra màn hình học viên.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        const recovered = await prisma.assignment.findUnique({
          where: { practiceScopeKey: scopeKey },
          select: { id: true }
        });

        if (!recovered) {
          throw error;
        }

        assignmentId = recovered.id;
      } else {
        throw error;
      }
    }
  }

  // Assignment đã có nhưng thiếu AssignmentRecipient của đúng học viên này (ví dụ dữ
  // liệu cũ từ trước khi hai bước này được gộp) — tạo bù, không rơi xuống nhánh tạo
  // Assignment mới (sẽ đâm vào ràng buộc unique practiceScopeKey và kẹt vĩnh viễn).
  let recipient = await prisma.assignmentRecipient.findFirst({
    where: { assignmentId, studentId: student.id },
    select: { id: true }
  });

  if (!recipient) {
    recipient = await prisma.assignmentRecipient.create({
      data: { assignmentId, studentId: student.id },
      select: { id: true }
    });
  }

  // Nêu rõ ý định thứ tự: lượt mới nhất theo SỐ LƯỢT trước, rồi mới đến thời điểm bắt
  // đầu — không dựa một mình vào startedAt (rủi ro nếu sau này có backfill/giờ lệch).
  const latestAttempt = await prisma.attempt.findFirst({
    where: { assignmentRecipientId: recipient.id, studentId: student.id },
    orderBy: [{ attemptRound: "desc" }, { startedAt: "desc" }]
  });

  const decision = decideAttemptStart(
    PRACTICE_MODE,
    latestAttempt
      ? {
          id: latestAttempt.id,
          status: latestAttempt.status,
          attemptRound: latestAttempt.attemptRound
        }
      : null
  );

  if (decision.kind === "resume") {
    // Lượt đang làm dở: KHÔNG đụng skillTimeLimitsJson. Ngân sách thời gian không
    // được chụp lại vào Attempt mà submitSkill đọc sống từ assignment mỗi lần nộp —
    // đổi giờ ở đây giữa chừng có thể khiến lượt đang dở bị auto-nộp oan ngay khi mở
    // lại (đổi từ "không tính giờ" sang "tính giờ" với thời gian đã làm vượt ngân sách
    // mới). Chỉ redirect vào đúng phòng đang làm.
    redirect(`/student/assignments/${recipient.id}`);
  }

  // Lượt mới: áp lựa chọn tính giờ CỦA LẦN BẤM NÀY rồi mới tạo Attempt, gộp trong một
  // transaction để không bao giờ có Attempt mới với skillTimeLimitsJson của lượt cũ.
  const recipientId = recipient.id;
  await prisma.$transaction(async (tx) => {
    await tx.assignment.update({
      where: { id: assignmentId },
      data: { skillTimeLimitsJson }
    });

    await tx.attempt.create({
      data: {
        assignmentRecipientId: recipientId,
        studentId: student.id,
        status: "in_progress",
        attemptRound: decision.attemptRound
      }
    });

    await tx.assignmentRecipient.update({
      where: { id: recipientId },
      data: { status: "in_progress" }
    });
  });

  // redirect() ném exception để Next chuyển hướng — KHÔNG đặt trong try/catch ở trên,
  // nếu không catch sẽ nuốt mất nó.
  redirect(`/student/assignments/${recipientId}`);
}
