"use server";

import { revalidatePath } from "next/cache";
import { requireTeacher } from "@/lib/actions/classes";
import { transcribeAudioUrl } from "@/lib/groq-transcribe";
import { prisma } from "@/lib/prisma";

type TranscribeResult = { ok: true; transcript: string } | { ok: false; error: string };

// Phiên âm bản ghi Speaking của học sinh bằng Groq (Whisper-large-v3-turbo).
// Chỉ giáo viên sở hữu bài tập mới gọi được. Lưu vào Answer.transcript.
// Phần tải audio + gọi Groq (kèm kiểm URL chống SSRF) nằm ở lib/groq-transcribe.ts.
export async function transcribeAnswer(answerId: string): Promise<TranscribeResult> {
  const teacher = await requireTeacher();

  const answer = await prisma.answer.findFirst({
    where: {
      id: answerId,
      attempt: { assignmentRecipient: { assignment: { teacherId: teacher.id } } }
    },
    select: { id: true, value: true, attemptId: true }
  });

  if (!answer) {
    return { ok: false, error: "Không tìm thấy bài làm." };
  }
  if (!answer.value) {
    return { ok: false, error: "Câu này chưa có bản ghi âm để phiên âm." };
  }

  const result = await transcribeAudioUrl(answer.value);
  if (!result.ok) {
    return result;
  }

  try {
    await prisma.answer.update({
      where: { id: answer.id },
      data: { transcript: result.transcript }
    });
  } catch (error) {
    // Cột transcript có thể chưa tồn tại (ensure-db chưa chạy). Vẫn trả kết quả
    // để giáo viên xem, chỉ là chưa lưu được.
    console.error("Lưu transcript thất bại:", (error as Error).message);
  }

  revalidatePath(`/teacher/review/${answer.attemptId}`);
  return { ok: true, transcript: result.transcript };
}
