import { isAllowedAudioUrl } from "@/lib/audio-source";

export type TranscribeAudioResult = { ok: true; transcript: string } | { ok: false; error: string };

// Phiên âm một bản ghi Speaking bằng Groq (Whisper-large-v3-turbo). KHÔNG kiểm quyền —
// nơi gọi (server action) phải kiểm trước. Dùng chung cho nút "Phiên âm" và AI chấm.
export async function transcribeAudioUrl(audioUrl: string): Promise<TranscribeAudioResult> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return {
      ok: false,
      error: "Chưa cấu hình GROQ_API_KEY trên máy chủ. Thêm biến môi trường này trên Vercel rồi thử lại."
    };
  }

  // URL lấy từ Answer.value do client gửi lên nên KHÔNG được tin: chốt đúng nguồn
  // Vercel Blob trước khi máy chủ đi tải, nếu không đây là đường bắt máy chủ gọi hộ
  // vào mạng nội bộ (xem lib/audio-source.ts).
  if (!isAllowedAudioUrl(audioUrl)) {
    return {
      ok: false,
      error: "Bản ghi của câu này không nằm ở kho file hợp lệ nên không phiên âm được."
    };
  }

  // Tải file audio từ Vercel Blob. redirect "error": blob thật trả thẳng 200 không
  // chuyển hướng, nên nếu có 3xx thì đó là mưu chuyển hướng ngược vào mạng nội bộ
  // sau khi đã qua được vòng kiểm URL ở trên.
  let audioResponse: Response;
  try {
    audioResponse = await fetch(audioUrl, { redirect: "error" });
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

  return { ok: true, transcript };
}
