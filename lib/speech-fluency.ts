// Số đo độ trôi chảy Speaking từ mốc thời gian từng từ của Groq (spec
// docs/superpowers/specs/2026-10-06-speaking-fluency-timing-design.md).
// Bản phiên âm bỏ hết "um, uh" và khoảng lặng nên đọc trôi chảy hơn thực tế; khoảng
// hở giữa hai từ liền nhau thì vẫn còn → đo được tốc độ nói và chỗ ngừng thật.

export type TimedWord = { w: string; s: number; e: number };

export type FluencyStats = {
  wordCount: number;
  // Từ đầu từ đầu tiên đến hết từ cuối (bỏ lặng trước/sau khi nói).
  speakingSeconds: number;
  // null = câu quá ngắn để kết luận.
  wordsPerMinute: number | null;
  pausesOver1s: number;
  pausesOver2s: number;
  // Ngừng khi từ đứng trước chưa hết câu/vế (không có dấu câu) = đang tìm từ.
  midPhrasePausesOver1s: number;
  longestPause: number;
};

export const PAUSE_MIN_SECONDS = 1.0;
export const LONG_PAUSE_SECONDS = 2.0;
const MIN_SECONDS_FOR_RATE = 3;
const MIN_WORDS_FOR_RATE = 5;
const TIMING_VERSION = 1;

function endsClause(word: string): boolean {
  return /[.,?!;:…]["'”’)\]]?$/.test(word);
}

function rate(wordCount: number, seconds: number): number | null {
  if (wordCount < MIN_WORDS_FOR_RATE || seconds < MIN_SECONDS_FOR_RATE) return null;
  return Math.round((wordCount / seconds) * 60);
}

export function serializeSpeechTiming(words: TimedWord[]): string {
  return JSON.stringify({ v: TIMING_VERSION, words });
}

export function parseSpeechTiming(json: string | null | undefined): TimedWord[] | null {
  if (!json) return null;
  try {
    const data = JSON.parse(json) as { v?: unknown; words?: unknown };
    if (data?.v !== TIMING_VERSION || !Array.isArray(data.words)) return null;
    const words = data.words.filter(
      (item): item is TimedWord =>
        typeof item?.w === "string" && Number.isFinite(item?.s) && Number.isFinite(item?.e)
    );
    return words.length > 0 ? words : null;
  } catch {
    return null;
  }
}

export function computeFluencyStats(words: TimedWord[]): FluencyStats | null {
  if (words.length === 0) return null;

  let pausesOver1s = 0;
  let pausesOver2s = 0;
  let midPhrasePausesOver1s = 0;
  let longestPause = 0;

  for (let index = 1; index < words.length; index += 1) {
    const gap = words[index].s - words[index - 1].e;
    if (gap > longestPause) longestPause = gap;
    if (gap < PAUSE_MIN_SECONDS) continue;
    pausesOver1s += 1;
    if (gap >= LONG_PAUSE_SECONDS) pausesOver2s += 1;
    if (!endsClause(words[index - 1].w)) midPhrasePausesOver1s += 1;
  }

  const speakingSeconds = Math.max(0, words[words.length - 1].e - words[0].s);

  return {
    wordCount: words.length,
    speakingSeconds,
    wordsPerMinute: rate(words.length, speakingSeconds),
    pausesOver1s,
    pausesOver2s,
    midPhrasePausesOver1s,
    longestPause
  };
}

export function combineFluencyStats(list: FluencyStats[]): FluencyStats | null {
  if (list.length === 0) return null;
  const wordCount = list.reduce((sum, item) => sum + item.wordCount, 0);
  const speakingSeconds = list.reduce((sum, item) => sum + item.speakingSeconds, 0);
  return {
    wordCount,
    speakingSeconds,
    wordsPerMinute: rate(wordCount, speakingSeconds),
    pausesOver1s: list.reduce((sum, item) => sum + item.pausesOver1s, 0),
    pausesOver2s: list.reduce((sum, item) => sum + item.pausesOver2s, 0),
    midPhrasePausesOver1s: list.reduce((sum, item) => sum + item.midPhrasePausesOver1s, 0),
    longestPause: Math.max(...list.map((item) => item.longestPause))
  };
}

// Bản phiên âm gửi model: chèn "(pause 2.1s)" ở mỗi khoảng lặng ≥ 1 giây.
export function annotatePauses(words: TimedWord[]): string {
  const parts: string[] = [];
  words.forEach((word, index) => {
    if (index > 0) {
      const gap = word.s - words[index - 1].e;
      if (gap >= PAUSE_MIN_SECONDS) parts.push(`(pause ${gap.toFixed(1)}s)`);
    }
    parts.push(word.w);
  });
  return parts.join(" ");
}

// Model lỡ chép dấu ngừng vào đoạn trích lỗi → bỏ đi để đối chiếu với bản phiên âm sạch.
export function stripPauseMarkers(text: string): string {
  return text
    .replace(/\(pause \d+(?:\.\d+)?s\)/gi, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function seconds(value: number): string {
  return value.toFixed(1);
}

// Dòng cho thầy ở trang chấm (không hiện cho học viên).
export function formatFluencyLine(stats: FluencyStats): string {
  const speed =
    stats.wordsPerMinute === null ? "Câu quá ngắn để đo tốc độ" : `Tốc độ ~${stats.wordsPerMinute} từ/phút`;
  return [
    speed,
    `ngừng ≥1 giây: ${stats.pausesOver1s} lần (${stats.midPhrasePausesOver1s} giữa cụm từ)`,
    `≥2 giây: ${stats.pausesOver2s} lần`,
    `lâu nhất ${seconds(stats.longestPause).replace(".", ",")} giây`
  ].join(" · ");
}

// Dòng "Timing" trong prompt gửi model.
export function formatFluencyForModel(stats: FluencyStats): string {
  const speed =
    stats.wordsPerMinute === null ? "speaking rate: too short to measure" : `${stats.wordsPerMinute} words/min`;
  return [
    speed,
    `pauses ≥1s: ${stats.pausesOver1s} (${stats.midPhrasePausesOver1s} mid-phrase)`,
    `≥2s: ${stats.pausesOver2s}`,
    `longest ${seconds(stats.longestPause)}s`
  ].join(" · ");
}
