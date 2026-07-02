"use server";

import { revalidatePath } from "next/cache";
import { requireTeacher } from "@/lib/actions/classes";
import { prisma } from "@/lib/prisma";

type TranscribeResult = { ok: true; transcript: string } | { ok: false; error: string };

// Phiên âm bản ghi Speaking của học sinh bằng Groq (Whisper-large-v3-turbo).
// Chỉ giáo viên sở hữu bài tập mới gọi được. Lưu vào Answer.transcript.
export async function transcribeAnswer(answerId: string): Promise<TranscribeResult> {
  const teacher = await requireTeacher();

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return {
      ok: false,
      error: "Chưa cấu hình GROQ_API_KEY trên máy chủ. Thêm biến môi trường này trên Vercel rồi thử lại."
    };
  }

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
  if (!answer.value || !/^https?:\/\//i.test(answer.value)) {
    return { ok: false, error: "Câu này chưa có bản ghi âm để phiên âm." };
  }

  // Tải file audio từ Vercel Blob.
  let audioResponse: Response;
  try {
    audioResponse = await fetch(answer.value);
  } catch {
    return { ok: false, error: "Không tải được file ghi âm." };
  }
  if (!audioResponse.ok) {
    return { ok: false, error: `Không tải được file ghi âm (HTTP ${audioResponse.status}).` };
  }

  const audioBuffer = await audioResponse.arrayBuffer();
  const contentType = audioResponse.headers.get("content-type") || "audio/webm";
  const ext = contentType.includes("mp4")
    ? "mp4"
    : contentType.includes("ogg")
      ? "ogg"
      : contentType.includes("mpeg")
        ? "mp3"
        : "webm";
  const file = new File([audioBuffer], `answer.${ext}`, { type: contentType });

  const form = new FormData();
  form.append("file", file);
  form.append("model", "whisper-large-v3-turbo");
  form.append("language", "en"); // Bài IELTS Speaking là tiếng Anh.
  form.append("response_format", "text");

  let transcript = "";
  try {
    const res = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form
    });

    if (!res.ok) {
      const detail = (await res.text()).slice(0, 200);
      return { ok: false, error: `Lỗi Groq (${res.status}): ${detail}` };
    }

    transcript = (await res.text()).trim();
  } catch (error) {
    return { ok: false, error: `Lỗi gọi Groq: ${(error as Error).message}` };
  }

  if (!transcript) {
    return { ok: false, error: "Không nhận được nội dung phiên âm (bản ghi có thể trống)." };
  }

  try {
    await prisma.answer.update({
      where: { id: answer.id },
      data: { transcript }
    });
  } catch (error) {
    // Cột transcript có thể chưa tồn tại (ensure-db chưa chạy). Vẫn trả kết quả
    // để giáo viên xem, chỉ là chưa lưu được.
    console.error("Lưu transcript thất bại:", (error as Error).message);
  }

  revalidatePath(`/teacher/review/${answer.attemptId}`);
  return { ok: true, transcript };
}
