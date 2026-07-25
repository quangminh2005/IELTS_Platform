// Đồng bộ mốc thời gian transcript<->audio cho một phần Listening: tải audio từ
// Blob, gọi Groq Whisper lấy giây bắt đầu từng từ, khớp với transcript trong DB
// (lib/transcript-timing.ts) rồi lưu vào AssignableUnit.transcriptTimingJson.
//
// Được gọi sau khi giáo viên lưu/import phần nghe. Lỗi ở đây KHÔNG được làm hỏng
// việc lưu bài — bên gọi bắt lỗi/đọc kết quả và chỉ ghi log hoặc nhắn nhẹ.

import { prisma } from "@/lib/prisma";
import { buildTranscriptTiming, type AsrWord } from "@/lib/transcript-timing";

// Dưới ngưỡng này coi như audio và transcript không cùng nội dung (ví dụ audio
// gộp cả 4 part) -> KHÔNG lưu để tránh tua sai chỗ.
export const MIN_MATCH_RATIO = 0.5;

export type SyncTimingResult =
  | { ok: true; matchRatio: number }
  | { ok: false; error: string; matchRatio?: number };

export async function syncTranscriptTiming(unitId: string): Promise<SyncTimingResult> {
  const unit = await prisma.assignableUnit.findUnique({
    where: { id: unitId },
    select: { id: true, skill: true, audioUrl: true, transcript: true }
  });

  if (!unit || unit.skill !== "listening" || !unit.audioUrl || !unit.transcript) {
    return { ok: false, error: "Phần này không phải bài nghe có đủ audio + transcript." };
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return { ok: false, error: "Chưa cấu hình GROQ_API_KEY trên máy chủ." };
  }

  // Tải audio từ Vercel Blob.
  let audioResponse: Response;
  try {
    audioResponse = await fetch(unit.audioUrl);
  } catch {
    return { ok: false, error: "Không tải được file audio." };
  }
  if (!audioResponse.ok) {
    return { ok: false, error: `Không tải được file audio (HTTP ${audioResponse.status}).` };
  }

  const audioBuffer = await audioResponse.arrayBuffer();
  const contentType = audioResponse.headers.get("content-type") || "audio/mpeg";
  const ext = contentType.includes("mp4")
    ? "mp4"
    : contentType.includes("ogg")
      ? "ogg"
      : contentType.includes("webm")
        ? "webm"
        : "mp3";

  const form = new FormData();
  form.append("file", new File([audioBuffer], `part.${ext}`, { type: contentType }));
  form.append("model", "whisper-large-v3-turbo");
  form.append("language", "en");
  form.append("response_format", "verbose_json");
  form.append("timestamp_granularities[]", "word");

  let asrWords: AsrWord[] = [];
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
    const payload = (await res.json()) as {
      words?: Array<{ word: string; start: number }>;
    };
    asrWords = (payload.words ?? []).filter(
      (w) => typeof w.word === "string" && Number.isFinite(w.start)
    );
  } catch (error) {
    return { ok: false, error: `Lỗi gọi Groq: ${(error as Error).message}` };
  }

  if (asrWords.length === 0) {
    return { ok: false, error: "Groq không trả về mốc thời gian từng từ." };
  }

  const timing = buildTranscriptTiming(unit.transcript, asrWords);
  if (timing.matchRatio < MIN_MATCH_RATIO) {
    return {
      ok: false,
      matchRatio: timing.matchRatio,
      error: `Audio và transcript khớp quá thấp (${Math.round(timing.matchRatio * 100)}%) — kiểm tra lại file audio của phần này.`
    };
  }

  await prisma.assignableUnit.update({
    where: { id: unit.id },
    data: { transcriptTimingJson: JSON.stringify(timing) }
  });

  return { ok: true, matchRatio: timing.matchRatio };
}
