import { describe, expect, it } from "vitest";
import {
  annotatePauses,
  combineFluencyStats,
  computeFluencyStats,
  formatFluencyForModel,
  formatFluencyLine,
  parseSpeechTiming,
  serializeSpeechTiming,
  stripPauseMarkers,
  type TimedWord
} from "@/lib/speech-fluency";

// Nói liền nhưng có hai lần ngừng ~0,6 giây: một giữa cụm từ (bí từ), một giữa hai câu.
const shortWords: TimedWord[] = [
  { w: "I", s: 0, e: 0.2 },
  { w: "usually", s: 0.2, e: 0.6 },
  { w: "go", s: 0.6, e: 0.8 },
  { w: "to", s: 0.8, e: 0.9 },
  { w: "the", s: 0.9, e: 1.0 },
  { w: "supermarket.", s: 1.6, e: 2.3 },
  { w: "It", s: 2.9, e: 3.0 },
  { w: "is", s: 3.0, e: 3.2 },
  { w: "near", s: 3.2, e: 3.5 },
  { w: "my", s: 3.5, e: 3.6 },
  { w: "house.", s: 3.6, e: 4.0 }
];

// Lấy từ phản hồi Groq thật (đoạn TTS chèn ngừng 3 s và 2 s), rút gọn.
const words: TimedWord[] = [
  { w: "Well,", s: 0.12, e: 0.62 },
  { w: "I", s: 0.62, e: 0.98 },
  { w: "think", s: 0.98, e: 1.2 },
  { w: "it", s: 1.2, e: 1.42 },
  { w: "is", s: 1.42, e: 1.78 },
  { w: "nice.", s: 1.78, e: 3.5 },
  { w: "Because", s: 7.24, e: 7.6 },
  { w: "people", s: 7.6, e: 8.0 },
  { w: "are", s: 8.0, e: 8.16 },
  { w: "friendly.", s: 10.22, e: 10.8 }
];

describe("computeFluencyStats", () => {
  it("tính tốc độ từ từ đầu đến từ cuối và tách ngừng giữa cụm / giữa câu", () => {
    const stats = computeFluencyStats(words)!;
    expect(stats.wordCount).toBe(10);
    expect(stats.speakingSeconds).toBeCloseTo(10.68, 2);
    expect(stats.wordsPerMinute).toBe(56);
    expect(stats.pausesOver1s).toBe(2);
    expect(stats.pausesOver2s).toBe(2);
    // "nice." có dấu chấm → ngừng giữa câu; "are" không dấu → giữa cụm từ.
    expect(stats.midPhrasePausesOver1s).toBe(1);
    expect(stats.longestPause).toBeCloseTo(3.74, 2);
  });

  it("câu quá ngắn thì không kết luận tốc độ, độ dài mạch nói", () => {
    const stats = computeFluencyStats(words.slice(0, 3))!;
    expect(stats.wordsPerMinute).toBeNull();
    expect(stats.meanLengthOfRun).toBeNull();
    expect(stats.midPhrasePausesPerMinute).toBeNull();
  });

  it("đếm ngừng ngắn ≥ 0,5 giây, tách giữa cụm từ, tính độ dài mạch nói", () => {
    const stats = computeFluencyStats(shortWords)!;
    expect(stats.wordsPerMinute).toBe(165);
    expect(stats.pausesOver05s).toBe(2);
    // "the … supermarket" là giữa cụm từ; "supermarket. … It" là giữa hai câu.
    expect(stats.midPhrasePausesOver05s).toBe(1);
    expect(stats.pausesOver1s).toBe(0);
    // 11 từ chia thành 3 mạch.
    expect(stats.meanLengthOfRun).toBeCloseTo(3.67, 2);
    expect(stats.midPhrasePausesPerMinute).toBeCloseTo(15, 5);
  });

  it("bài mẫu: ngừng dài cũng là ngừng ≥ 0,5 giây", () => {
    const stats = computeFluencyStats(words)!;
    expect(stats.pausesOver05s).toBe(2);
    expect(stats.midPhrasePausesOver05s).toBe(1);
    expect(stats.meanLengthOfRun).toBeCloseTo(3.33, 2);
  });

  it("không có từ nào → null", () => {
    expect(computeFluencyStats([])).toBeNull();
  });
});

describe("combineFluencyStats", () => {
  it("cộng dồn và tính lại tốc độ trên tổng", () => {
    const a = computeFluencyStats(words)!;
    const total = combineFluencyStats([a, a])!;
    expect(total.wordCount).toBe(20);
    expect(total.pausesOver1s).toBe(4);
    expect(total.midPhrasePausesOver1s).toBe(2);
    expect(total.wordsPerMinute).toBe(56);
    expect(total.longestPause).toBeCloseTo(3.74, 2);
    // Mỗi câu trả lời là một mạch mới: 20 từ / (4 lần ngừng + 2 câu).
    expect(total.meanLengthOfRun).toBeCloseTo(3.33, 2);
    expect(total.midPhrasePausesOver05s).toBe(2);
  });

  it("danh sách rỗng → null", () => {
    expect(combineFluencyStats([])).toBeNull();
  });
});

describe("annotatePauses / stripPauseMarkers", () => {
  it("chèn dấu ngừng ≥ 0,5 giây vào đúng chỗ", () => {
    expect(annotatePauses(words)).toBe(
      "Well, I think it is nice. (pause 3.7s) Because people are (pause 2.1s) friendly."
    );
    expect(annotatePauses(shortWords)).toBe(
      "I usually go to the (pause 0.6s) supermarket. (pause 0.6s) It is near my house."
    );
  });

  it("bỏ dấu ngừng khỏi đoạn trích model trả về", () => {
    expect(stripPauseMarkers("people are (pause 2.1s) friendly")).toBe("people are friendly");
    expect(stripPauseMarkers("(Pause 1s) I goes")).toBe("I goes");
  });
});

describe("lưu / đọc mốc thời gian", () => {
  it("đọc lại đúng thứ đã lưu", () => {
    expect(parseSpeechTiming(serializeSpeechTiming(words))).toEqual(words);
  });

  it("JSON hỏng, sai phiên bản hoặc rỗng → null, không ném lỗi", () => {
    expect(parseSpeechTiming(null)).toBeNull();
    expect(parseSpeechTiming("{oops")).toBeNull();
    expect(parseSpeechTiming(JSON.stringify({ v: 2, words }))).toBeNull();
    expect(parseSpeechTiming(JSON.stringify({ v: 1, words: [] }))).toBeNull();
  });
});

describe("định dạng số đo", () => {
  const stats = computeFluencyStats(words)!;

  it("dòng tiếng Việt cho thầy (dấu phẩy thập phân)", () => {
    expect(formatFluencyLine(stats)).toBe(
      "Tốc độ ~56 từ/phút · trung bình ~3 từ mỗi mạch nói · ngừng giữa cụm từ ≥0,5 giây: 1 lần · ngừng ≥1 giây: 2 lần (≥2 giây: 2) · lâu nhất 3,7 giây"
    );
  });

  it("dòng tiếng Anh cho model", () => {
    expect(formatFluencyForModel(stats)).toBe(
      "56 words/min · mean length of run 3.3 words · mid-phrase pauses ≥0.5s: 1 (5.6/min) · pauses ≥1s: 2 (1 mid-phrase) · ≥2s: 2 · longest 3.7s"
    );
  });

  it("câu quá ngắn", () => {
    const short = computeFluencyStats(words.slice(0, 3))!;
    expect(formatFluencyLine(short)).toContain("quá ngắn để đo tốc độ");
    expect(formatFluencyForModel(short)).toContain("too short to measure");
    expect(formatFluencyLine(short)).not.toContain("mạch nói");
    expect(formatFluencyForModel(short)).not.toContain("/min)");
  });
});
