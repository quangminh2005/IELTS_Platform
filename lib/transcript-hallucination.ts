// Nhận diện bản phiên âm Whisper BỊA. Bản ghi im lặng / quá nhỏ / chỉ có tiếng ồn vẫn được
// Whisper "phiên âm" thành câu quen thuộc — thử 9/10/2026: file im lặng 30 giây → " Thank you.",
// và Groq vẫn báo no_speech_prob = 0 nên không dựa vào đó được. Trên prod từng có bài lưu
// "Thank you. Thank you. ..." → AI chấm Speaking ra band 1. Hàm thuần, dùng được cả ở client.

// Dài trước ngắn sau để "thank you for watching" không bị cắt thành "thank you" + thừa chữ.
const HALLUCINATION_PHRASES = [
  "subtitles by the amara org community",
  "thank you for watching",
  "thanks for watching",
  "thank you very much",
  "thank you so much",
  "please subscribe",
  "thank you",
  "subscribe",
  "bye bye",
  "thanks",
  "music",
  "bye",
  "you"
];
const PHRASE_PATTERN = new RegExp(`\\b(?:${HALLUCINATION_PHRASES.join("|")})\\b`, "g");

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z'\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function isLikelyHallucination(text: string): boolean {
  const normalized = normalize(text);
  if (!normalized) return true;

  // Bỏ hết các câu bịa quen thuộc mà không còn chữ nào = không có nội dung thật.
  if (!normalized.replace(PHRASE_PATTERN, " ").trim()) return true;

  // Vòng lặp: một câu lặp ≥ 3 lần và chiếm ít nhất nửa số câu.
  const sentences = text
    .split(/[.!?…]+/)
    .map(normalize)
    .filter(Boolean);
  if (sentences.length >= 3) {
    const counts = new Map<string, number>();
    for (const sentence of sentences) counts.set(sentence, (counts.get(sentence) ?? 0) + 1);
    const top = Math.max(...counts.values());
    if (top >= 3 && top / sentences.length >= 0.5) return true;
  }

  return false;
}
