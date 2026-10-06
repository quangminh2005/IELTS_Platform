import { describe, expect, it } from "vitest";
import { groqErrorMessage, isWebmAudio, parseGroqVerbose, prepareAudioBytes } from "@/lib/groq-transcribe";

// Sự cố 5/10/2026: bản ghi WebM cũ (trước khi có bước sửa mốc lúc tải lên) mang mốc
// thời gian 7 tiếng → Groq coi là 7 tiếng âm thanh, từ chối (413) và làm nghẽn hạn
// mức 7.200 giây/giờ của gói miễn phí, kéo theo các bài bình thường cũng lỗi.
describe("chuẩn bị audio trước khi gửi Groq", () => {
  it("nhận ra WebM theo content-type hoặc đuôi file", () => {
    expect(isWebmAudio("audio/webm", "https://x/a.bin")).toBe(true);
    expect(isWebmAudio("application/octet-stream", "https://x/speaking-1.webm")).toBe(true);
    expect(isWebmAudio("audio/mp4", "https://x/speaking-upload-1.m4a")).toBe(false);
  });

  it("không phải WebM thì giữ nguyên", () => {
    const bytes = new Uint8Array([1, 2, 3]);
    expect(prepareAudioBytes(bytes, false)).toBe(bytes);
  });

  it("WebM không đọc được thì dùng nguyên file gốc, không ném lỗi", () => {
    const garbage = new Uint8Array([0, 1, 2, 3, 4, 5]);
    expect(prepareAudioBytes(garbage, true)).toBe(garbage);
  });
});

describe("thông báo lỗi Groq", () => {
  it("vượt hạn mức giây âm thanh/giờ → câu tiếng Việt dễ hiểu", () => {
    const body = '{"error":{"message":"Request too large for model `whisper-large-v3-turbo` ... on seconds of audio per hour (ASPH): Limit 7200, Requested 9163","type":"seconds","code":"rate_limit_exceeded"}}';
    const result = groqErrorMessage(413, body);
    expect(result.reason).toBe("rate_limit");
    expect(result.error).toContain("hạn mức");
    expect(result.error).not.toContain("{");
  });

  it("429 cũng là hạn mức", () => {
    expect(groqErrorMessage(429, '{"error":{"code":"rate_limit_exceeded"}}').reason).toBe("rate_limit");
  });

  it("file rỗng → reason empty", () => {
    const result = groqErrorMessage(400, '{"error":{"message":"file is empty","code":"empty_audio_file"}}');
    expect(result.reason).toBe("empty");
  });

  it("lỗi khác giữ mã + đoạn đầu chi tiết", () => {
    const result = groqErrorMessage(500, "internal");
    expect(result.reason).toBe("other");
    expect(result.error).toBe("Lỗi Groq (500): internal");
  });
});

describe("đọc phản hồi verbose_json của Groq", () => {
  it("lấy chữ + mốc từng từ, làm tròn 2 chữ số", () => {
    const result = parseGroqVerbose({
      text: "  Well, I think. ",
      words: [
        { word: "Well,", start: 0.12, end: 0.6234 },
        { word: " I", start: 0.62, end: 0.98 },
        { word: "", start: 1, end: 1.1 },
        { word: "think.", start: "x", end: 1.2 }
      ]
    });
    expect(result.transcript).toBe("Well, I think.");
    expect(result.words).toEqual([
      { w: "Well,", s: 0.12, e: 0.62 },
      { w: "I", s: 0.62, e: 0.98 }
    ]);
  });

  it("không có words → mảng rỗng, không ném lỗi", () => {
    expect(parseGroqVerbose({ text: "Hi" })).toEqual({ transcript: "Hi", words: [] });
    expect(parseGroqVerbose(null)).toEqual({ transcript: "", words: [] });
  });
});
