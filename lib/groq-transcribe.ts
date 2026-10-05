import { isAllowedAudioUrl } from "@/lib/audio-source";
import { repairWebmTimestamps } from "@/lib/webm-timestamps";

// reason giúp nơi gọi xử lý riêng: "empty" = bản ghi rỗng (AI chấm bỏ qua câu đó
// thay vì hỏng cả bài), "rate_limit" = Groq hết hạn mức tạm thời.
export type TranscribeAudioResult =
  | { ok: true; transcript: string }
  | { ok: false; error: string; reason: "empty" | "rate_limit" | "other" };

export function isWebmAudio(contentType: string, url: string): boolean {
  return contentType.includes("webm") || /\.webm(\?|#|$)/i.test(url);
}

// Sự cố 5/10/2026: bản ghi WebM cũ (trước khi trình ghi âm có bước sửa mốc lúc tải
// lên, xem lib/webm-timestamps.ts) mang mốc thời gian tới 7 tiếng dù tiếng nói chỉ
// ~30 giây. Groq tính theo mốc đó → coi là hàng giờ âm thanh, từ chối (413) và còn
// làm nghẽn hạn mức 7.200 giây/giờ của gói miễn phí, kéo các bài bình thường lỗi
// theo. Sửa mốc ngay trên máy chủ trước khi gửi; sửa không được thì gửi nguyên bản.
export function prepareAudioBytes(bytes: Uint8Array, webm: boolean): Uint8Array {
  if (!webm) {
    return bytes;
  }
  try {
    return repairWebmTimestamps(bytes) ?? bytes;
  } catch {
    return bytes;
  }
}

export function groqErrorMessage(
  status: number,
  body: string
): { error: string; reason: "empty" | "rate_limit" | "other" } {
  if (body.includes("empty_audio_file")) {
    return { error: "Bản ghi trống, không có tiếng để phiên âm.", reason: "empty" };
  }
  if (status === 429 || body.includes("rate_limit_exceeded") || body.includes("seconds of audio per hour")) {
    return {
      error:
        "Dịch vụ phiên âm (Groq, gói miễn phí) đang vượt hạn mức 2 giờ âm thanh mỗi giờ. Đợi vài phút rồi thử lại.",
      reason: "rate_limit"
    };
  }
  return { error: `Lỗi Groq (${status}): ${body.slice(0, 200)}`, reason: "other" };
}

// Phiên âm một bản ghi Speaking bằng Groq (Whisper-large-v3-turbo). KHÔNG kiểm quyền —
// nơi gọi (server action) phải kiểm trước. Dùng chung cho nút "Phiên âm" và AI chấm.
export async function transcribeAudioUrl(audioUrl: string): Promise<TranscribeAudioResult> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return {
      ok: false,
      error: "Chưa cấu hình GROQ_API_KEY trên máy chủ. Thêm biến môi trường này trên Vercel rồi thử lại.",
      reason: "other"
    };
  }

  // URL lấy từ Answer.value do client gửi lên nên KHÔNG được tin: chốt đúng nguồn
  // Vercel Blob trước khi máy chủ đi tải, nếu không đây là đường bắt máy chủ gọi hộ
  // vào mạng nội bộ (xem lib/audio-source.ts).
  if (!isAllowedAudioUrl(audioUrl)) {
    return {
      ok: false,
      error: "Bản ghi của câu này không nằm ở kho file hợp lệ nên không phiên âm được.",
      reason: "other"
    };
  }

  // Tải file audio từ Vercel Blob. redirect "error": blob thật trả thẳng 200 không
  // chuyển hướng, nên nếu có 3xx thì đó là mưu chuyển hướng ngược vào mạng nội bộ
  // sau khi đã qua được vòng kiểm URL ở trên.
  let audioResponse: Response;
  try {
    audioResponse = await fetch(audioUrl, { redirect: "error" });
  } catch {
    return { ok: false, error: "Không tải được file ghi âm.", reason: "other" };
  }
  if (!audioResponse.ok) {
    return { ok: false, error: `Không tải được file ghi âm (HTTP ${audioResponse.status}).`, reason: "other" };
  }

  const contentType = audioResponse.headers.get("content-type") || "audio/webm";
  const original = new Uint8Array(await audioResponse.arrayBuffer());
  if (original.byteLength === 0) {
    return {
      ok: false,
      error: "File ghi âm của câu này rỗng (0 byte) — có thể lúc nộp bài tải lên bị hỏng.",
      reason: "empty"
    };
  }

  const audioBytes = prepareAudioBytes(original, isWebmAudio(contentType, audioUrl));
  const ext = contentType.includes("mp4")
    ? "mp4"
    : contentType.includes("ogg")
      ? "ogg"
      : contentType.includes("mpeg")
        ? "mp3"
        : "webm";
  const file = new File([new Uint8Array(audioBytes)], `answer.${ext}`, { type: contentType });

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
      return { ok: false, ...groqErrorMessage(res.status, await res.text()) };
    }

    transcript = (await res.text()).trim();
  } catch (error) {
    return { ok: false, error: `Lỗi gọi Groq: ${(error as Error).message}`, reason: "other" };
  }

  if (!transcript) {
    return { ok: false, error: "Không nhận được nội dung phiên âm (bản ghi có thể trống).", reason: "empty" };
  }

  return { ok: true, transcript };
}
